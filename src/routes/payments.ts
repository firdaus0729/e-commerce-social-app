import express, { Router } from 'express';
import { auth, AuthRequest } from '../middleware/auth';
import { Cart } from '../models/Cart';
import { Order } from '../models/Order';
import { Payment } from '../models/Payment';
import { StoreStats } from '../models/StoreStats';
import { Product } from '../models/Product';
import { Store } from '../models/Store';
import { User } from '../models/User';
import {
  calculatePlatformFee,
  createPayPalOrder,
  capturePayPalOrder,
  sendPayPalPayout,
  sendAdminFee,
} from '../services/payment';

const router = Router();

// Create payment intent for checkout
router.post('/checkout/create-intent', auth, async (req: AuthRequest, res) => {
  try {
    const provider = req.body.provider || 'paypal';
    const cart = await Cart.findOne({ user: req.user!._id }).populate('items.product');
    
    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ message: 'Cart is empty' });
    }

    // Stock is reserved when items are added to cart, so we don't re-check product.stock here.

    // Refresh reservation timestamps to lock items for the checkout period
    const now = new Date();
    cart.items.forEach((i) => (i.reservedAt = now));
    await cart.save();

    const items = cart.items.map((i) => ({
      product: (i.product as any)._id,
      title: (i.product as any).title,
      price: (i.product as any).price,
      quantity: i.quantity,
    }));

    const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
    const total = subtotal;
    const store = (cart.items[0].product as any).store;

    // Create order in pending state
    const order = await Order.create({
      user: req.user!._id,
      store,
      items,
      subtotal,
      total,
      currency: cart.currency || 'USD',
      status: 'pending',
      paymentProvider: provider,
    });
    const { platformFee, sellerAmount } = calculatePlatformFee(total);
    const storeDoc = await Store.findById(store);

    // Handle PayPal provider
    if (provider === 'paypal') {
      // Check seller has PayPal email configured
      const storeDoc = await Store.findById(store);
      if (!storeDoc?.paypalEmail) {
        return res.status(400).json({ 
          message: 'Seller has not configured PayPal payment. Please contact the seller.',
          code: 'SELLER_PAYPAL_NOT_CONFIGURED'
        });
      }

      // Check buyer has PayPal email linked (recommended but not strictly required)
      const buyer = await User.findById(req.user!._id);
      if (!buyer?.paypalEmail) {
        return res.status(400).json({ 
          message: 'Please link your PayPal account in profile settings to checkout.',
          code: 'BUYER_PAYPAL_NOT_LINKED',
          action: 'LINK_PAYPAL'
        });
      }

      // Create PayPal order with split payment (direct to seller)
      const paypalOrder = await createPayPalOrder(
        total, 
        order.currency, 
        storeDoc.paypalEmail, // Seller's PayPal email - receives payment directly
        {
          orderId: order._id.toString(),
          userId: req.user!._id.toString(),
          storeId: store.toString(),
        }
      );

      await Payment.create({
        order: order._id,
        user: req.user!._id,
        store,
        amount: total,
        currency: order.currency,
        platformFee,
        sellerAmount,
        provider: 'paypal',
        providerPaymentId: paypalOrder.id,
        status: 'pending',
      });

      await Order.findByIdAndUpdate(order._id, { paymentIntentId: paypalOrder.id });

      res.json({
        orderId: order._id,
        paypalOrderId: paypalOrder.id,
        approvalUrl: paypalOrder.approvalUrl,
        amount: total,
        currency: order.currency,
      });
      return;
    }

    // Handle bank transfers (offsite/manual) - create payment record and return instructions
    if (provider === 'bank') {
      if (!storeDoc?.bankDetails || !storeDoc.bankDetails.accountNumber) {
        return res.status(400).json({ message: 'Seller has not configured bank payout. Please contact the seller.', code: 'SELLER_BANK_NOT_CONFIGURED' });
      }

      await Payment.create({
        order: order._id,
        user: req.user!._id,
        store,
        amount: total,
        currency: order.currency,
        platformFee,
        sellerAmount,
        provider: 'bank',
        providerPaymentId: null,
        status: 'pending',
      });

      res.json({
        orderId: order._id,
        amount: total,
        currency: order.currency,
        instructions: `Please transfer ${order.currency} ${total.toFixed(2)} to the seller bank account: ${storeDoc.bankDetails.accountName} - ${storeDoc.bankDetails.accountNumber} (${storeDoc.bankDetails.bankName}). After transfer, confirm payment in the app.`
      });
      return;
    }
  } catch (err: any) {
    res.status(500).json({ message: err.message || 'Failed to create payment intent' });
  }
});

// Confirm payment (called after client-side confirmation)
router.post('/checkout/confirm', auth, async (req: AuthRequest, res) => {
  try {
    const { orderId, paymentIntentId } = req.body;

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    if (order.user?.toString() !== req.user!._id.toString()) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    const payment = await Payment.findOne({ order: orderId, providerPaymentId: paymentIntentId });
    if (!payment) {
      return res.status(404).json({ message: 'Payment not found' });
    }

    // If this payment was created for a bank transfer, confirm without calling PayPal
    if (payment.provider === 'bank') {
      payment.status = 'succeeded';
      if (!payment.metadata) payment.metadata = {};
      payment.metadata.confirmedBy = req.user!._id.toString();
      await payment.save();

      order.status = 'paid';
      await order.save();

      const stats = await StoreStats.findOne({ store: order.store });
      if (stats) {
        stats.productsSold += order.items.reduce((sum, i) => sum + i.quantity, 0);
        stats.totalRevenue += payment.amount;
        stats.walletBalance += payment.sellerAmount;
        await stats.save();
      }

      const cart = await Cart.findOne({ user: req.user!._id });
      if (cart) {
        cart.items = [];
        await cart.save();
      }

      return res.json({ success: true, order, payment });
    }

    const capture = await capturePayPalOrder(paymentIntentId);
    
    if (capture.status === 'COMPLETED') {
      payment.status = 'succeeded';
      
      // Store PayPal capture ID in metadata
      if (!payment.metadata) {
        payment.metadata = {};
      }
      payment.metadata.paypalOrderId = paymentIntentId;
      payment.metadata.captureId = capture.captureId;
      
      await payment.save();

      order.status = 'paid';
      await order.save();

      // Inventory was reserved when items were added to cart; no further decrement needed here

      // Update store wallet
      const stats = await StoreStats.findOne({ store: order.store });
      if (stats) {
        stats.productsSold += order.items.reduce((sum, i) => sum + i.quantity, 0);
        stats.totalRevenue += payment.amount;
        stats.walletBalance += payment.sellerAmount;
        await stats.save();
      }

      // Note: With split payments, money goes directly to seller and admin
      // No need for separate payouts - PayPal handles the split automatically

      // Clear cart
      const cart = await Cart.findOne({ user: req.user!._id });
      if (cart) {
        cart.items = [];
        await cart.save();
      }

      res.json({ 
        success: true, 
        order, 
        payment,
      });
    } else {
      res.status(400).json({ message: `Payment status: ${capture.status}` });
    }
  } catch (err: any) {
    res.status(500).json({ message: err.message || 'Failed to confirm payment' });
  }
});

export default router;

