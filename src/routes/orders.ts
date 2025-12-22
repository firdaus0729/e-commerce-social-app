import { Router } from 'express';
import { auth, AuthRequest } from '../middleware/auth';
import { Cart } from '../models/Cart';
import { Order } from '../models/Order';
import { Product } from '../models/Product';

const router = Router();

// Legacy endpoint - now redirects to payment flow
// Use /payments/checkout/create-intent instead
router.post('/', auth, async (req: AuthRequest, res) => {
  res.status(400).json({ 
    message: 'Please use /payments/checkout/create-intent to create a payment. This endpoint is deprecated.' 
  });
});

router.get('/', auth, async (req: AuthRequest, res) => {
  const orders = await Order.find({ user: req.user!._id })
    .sort({ createdAt: -1 })
    .limit(50);
  res.json(orders);
});

export default router;

