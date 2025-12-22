import { Router } from 'express';
import { auth, AuthRequest } from '../middleware/auth';
import { Product } from '../models/Product';
import { Store } from '../models/Store';
import { Order } from '../models/Order';
import { User } from '../models/User';

const router = Router();

// Ensure only admins can access these routes
const requireAdmin = (req: AuthRequest, res: any, next: any) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access required' });
  }
  next();
};

// Products overview with seller and buyers
router.get('/products', auth, requireAdmin, async (req: AuthRequest, res) => {
  // Load recent products with their stores and owners
  const products = await Product.find()
    .sort({ createdAt: -1 })
    .limit(100)
    .populate({
      path: 'store',
      populate: { path: 'owner', model: User, select: 'name email profilePhoto' },
    });

  const productIds = products.map((p) => p._id);

  // Find all orders that include these products
  const orders = await Order.find({ 'items.product': { $in: productIds } })
    .populate('user', 'name email profilePhoto')
    .lean();

  const buyersByProduct = new Map<string, any[]>();

  for (const order of orders) {
    const buyer: any = (order as any).user;
    if (!buyer) continue;

    for (const item of order.items) {
      const productId = item.product.toString();
      const buyers = buyersByProduct.get(productId) ?? [];

      if (!buyers.some((b) => b.id === buyer._id.toString())) {
        buyers.push({
          id: buyer._id.toString(),
          name: buyer.name,
          email: buyer.email,
          profilePhoto: buyer.profilePhoto,
        });
      }

      buyersByProduct.set(productId, buyers);
    }
  }

  const result = products.map((p) => {
    const store = p.store as any;
    const owner = store?.owner as any;

    return {
      id: p._id.toString(),
      title: p.title,
      price: p.price,
      image: p.images?.[0] ?? null,
      seller: owner
        ? {
            id: owner._id.toString(),
            name: owner.name,
            email: owner.email,
            profilePhoto: owner.profilePhoto,
          }
        : null,
      buyers: buyersByProduct.get(p._id.toString()) ?? [],
    };
  });

  res.json(result);
});

// Transactions overview (orders) with seller and buyer
router.get('/transactions', auth, requireAdmin, async (req: AuthRequest, res) => {
  const orders = await Order.find()
    .sort({ createdAt: -1 })
    .limit(100)
    .populate('user', 'name email profilePhoto')
    .populate({
      path: 'store',
      populate: { path: 'owner', model: User, select: 'name email profilePhoto' },
    })
    .lean();

  const transactions = orders.map((order: any) => {
    const store = order.store;
    const seller = store?.owner;
    const buyer = order.user;

    return {
      id: order._id.toString(),
      total: order.total,
      currency: order.currency,
      paymentProvider: order.paymentProvider,
      createdAt: order.createdAt,
      seller: seller
        ? {
            id: seller._id.toString(),
            name: seller.name,
            email: seller.email,
            profilePhoto: seller.profilePhoto,
          }
        : null,
      buyer: buyer
        ? {
            id: buyer._id.toString(),
            name: buyer.name,
            email: buyer.email,
            profilePhoto: buyer.profilePhoto,
          }
        : null,
    };
  });

  res.json(transactions);
});

export default router;

