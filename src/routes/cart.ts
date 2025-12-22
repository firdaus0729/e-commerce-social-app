import { Router } from 'express';
import { auth, AuthRequest } from '../middleware/auth';
import { Cart } from '../models/Cart';
import { Product } from '../models/Product';

const router = Router();

router.get('/', auth, async (req: AuthRequest, res) => {
  let cart = await Cart.findOne({ user: req.user!._id }).populate('items.product');
  if (!cart) {
    cart = await Cart.create({ user: req.user!._id, items: [], currency: 'USD' });
  }
  
  // Format response to match frontend expectations
  const cartObj = cart.toObject();
  res.json({
    _id: cartObj._id,
    items: cartObj.items.map((item: any) => ({
      product: item.product,
      quantity: item.quantity,
    })),
    currency: cartObj.currency || 'USD',
  });
});

// Add item to cart (also handles update)
router.post('/items', auth, async (req: AuthRequest, res) => {
  const { productId, quantity } = req.body;
  if (!productId) return res.status(400).json({ message: 'Product ID is required' });
  
  const product = await Product.findById(productId);
  if (!product) return res.status(404).json({ message: 'Product not found' });
  if (!product.isPublished) return res.status(400).json({ message: 'Product is not available' });
  
  const qty = Math.max(1, Number(quantity) || 1);
  if (product.stock !== undefined && product.stock < qty) {
    return res.status(400).json({ message: 'Insufficient stock' });
  }

  let cart = await Cart.findOne({ user: req.user!._id });
  if (!cart) cart = await Cart.create({ user: req.user!._id, items: [], currency: 'USD' });
  
  const existing = cart.items.find((i) => i.product.toString() === productId);
  if (existing) {
    // Reserve additional quantity
    existing.quantity += qty;
    existing.reservedAt = new Date();
    // Decrement product stock by the newly reserved amount
    await Product.findByIdAndUpdate(productId, { $inc: { stock: -qty } });
  } else {
    cart.items.push({ product: product._id, quantity: qty, reservedAt: new Date() });
    // Decrement product stock by reserved quantity
    await Product.findByIdAndUpdate(productId, { $inc: { stock: -qty } });
  }
  
  await cart.save();
  const populated = await cart.populate('items.product');
  
  res.json({
    _id: populated._id,
    items: populated.items.map((item: any) => ({
      product: item.product,
      quantity: item.quantity,
    })),
    currency: populated.currency || 'USD',
  });
});

router.patch('/items/:productId', auth, async (req: AuthRequest, res) => {
  const qty = Math.max(1, Number(req.body.quantity) || 1);
  const cart = await Cart.findOne({ user: req.user!._id });
  if (!cart) return res.status(404).json({ message: 'Cart not found' });
  const item = cart.items.find((i) => i.product.toString() === req.params.productId);
  if (!item) return res.status(404).json({ message: 'Item not found' });
  const delta = qty - item.quantity;
  if (delta > 0) {
    // reserve additional
    const product = await Product.findById(item.product);
    if (!product) return res.status(404).json({ message: 'Product not found' });
    if (product.stock !== undefined && product.stock < delta) {
      return res.status(400).json({ message: 'Insufficient stock' });
    }
    await Product.findByIdAndUpdate(item.product, { $inc: { stock: -delta } });
  } else if (delta < 0) {
    // release excess
    await Product.findByIdAndUpdate(item.product, { $inc: { stock: -delta } });
  }
  item.quantity = qty;
  item.reservedAt = new Date();
  await cart.save();
  res.json(await cart.populate('items.product'));
});

router.delete('/items/:productId', auth, async (req: AuthRequest, res) => {
  const cart = await Cart.findOne({ user: req.user!._id });
  if (!cart) return res.status(404).json({ message: 'Cart not found' });
  const item = cart.items.find((i) => i.product.toString() === req.params.productId);
  if (item) {
    // return reserved stock
    await Product.findByIdAndUpdate(item.product, { $inc: { stock: item.quantity } });
  }
  cart.items = cart.items.filter((i) => i.product.toString() !== req.params.productId);
  await cart.save();
  res.json(await cart.populate('items.product'));
});

export default router;

