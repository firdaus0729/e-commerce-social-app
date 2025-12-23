import { Router } from 'express';
import slugify from 'slugify';
import { auth, AuthRequest } from '../middleware/auth';
import { Store } from '../models/Store';
import { User } from '../models/User';
import { Product } from '../models/Product';
import { StoreStats } from '../models/StoreStats';
import { Order } from '../models/Order';

const router = Router();

router.post('/', auth, async (req: AuthRequest, res) => {
  const { name, description, logo, banner } = req.body;
  if (!name) return res.status(400).json({ message: 'Name is required' });
  const slug = slugify(name, { lower: true, strict: true });
  const existing = await Store.findOne({ slug });
  if (existing) return res.status(409).json({ message: 'Store name already taken' });

  const store = await Store.create({
    name,
    description,
    slug,
    logo,
    banner,
    owner: req.user!._id,
  });

  await User.findByIdAndUpdate(req.user!._id, { role: 'seller', store: store._id });
  
  // Initialize store stats
  await StoreStats.create({ store: store._id, productsSold: 0, walletBalance: 0, totalRevenue: 0 });
  
  res.status(201).json(store);
});

router.get('/', async (req, res) => {
  const stores = await Store.find({ isActive: true }).sort({ createdAt: -1 }).limit(50);
  res.json(
    stores.map((store) => ({
      ...store.toObject(),
      owner: store.owner.toString(),
    }))
  );
});

// Get store by ID (must be before /:slug route)
router.get('/id/:id', async (req, res) => {
  const store = await Store.findById(req.params.id).populate('owner', 'name email');
  if (!store) return res.status(404).json({ message: 'Store not found' });
  const storeObj = store.toObject();
  res.json({
    ...storeObj,
    owner: storeObj.owner?._id?.toString(),
  });
});
// Get store stats (must be before /:slug route)
router.get('/:id/stats', auth, async (req: AuthRequest, res) => {
  const store = await Store.findById(req.params.id);
  if (!store) return res.status(404).json({ message: 'Store not found' });
  
  // Check ownership
  if (store.owner.toString() !== req.user!._id.toString()) {
    return res.status(403).json({ message: 'Access denied' });
  }
  
  let stats = await StoreStats.findOne({ store: store._id });
  if (!stats) {
    stats = await StoreStats.create({ store: store._id, productsSold: 0, walletBalance: 0, totalRevenue: 0 });
  }
  
  // Calculate actual products sold from orders
  const orders = await Order.find({ store: store._id, status: { $in: ['paid', 'processing', 'shipped', 'delivered'] } });
  const productsSold = orders.reduce((sum, order) => {
    return sum + order.items.reduce((itemSum, item) => itemSum + item.quantity, 0);
  }, 0);
  
  const totalRevenue = orders.reduce((sum, order) => sum + order.total, 0);
  
  // Update stats
  stats.productsSold = productsSold;
  stats.totalRevenue = totalRevenue;
  await stats.save();
  
  res.json({
    productsSold: stats.productsSold,
    walletBalance: stats.walletBalance,
    totalRevenue: stats.totalRevenue,
  });
});

// Get store by slug (must be after /id/:id and /:id/stats)
router.get('/:slug', async (req, res) => {
  const store = await Store.findOne({ slug: req.params.slug }).populate('owner', 'name email');
  if (!store) return res.status(404).json({ message: 'Store not found' });
  const storeObj = store.toObject();
  res.json({
    ...storeObj,
    owner: storeObj.owner.toString(),
  });
});

// Update store (owner only)
router.patch('/:id', auth, async (req: AuthRequest, res) => {
  const { name, description, logo, banner } = req.body;
  const update: Record<string, unknown> = { description };
  if (name) {
    update.name = name;
    update.slug = slugify(name, { lower: true, strict: true });
  }
  if (logo !== undefined) update.logo = logo;
  if (banner !== undefined) update.banner = banner;
  const store = await Store.findOneAndUpdate(
    { _id: req.params.id, owner: req.user!._id },
    update,
    { new: true }
  );
  if (!store) return res.status(404).json({ message: 'Store not found' });
  res.json(store);
});

// Update PayPal email for store (owner only)
router.patch('/:id/paypal-email', auth, async (req: AuthRequest, res) => {
  const { paypalEmail } = req.body;
  
  if (!paypalEmail || !paypalEmail.includes('@')) {
    return res.status(400).json({ message: 'Valid PayPal email is required' });
  }

  const store = await Store.findOne({ _id: req.params.id, owner: req.user!._id });
  if (!store) {
    return res.status(404).json({ message: 'Store not found' });
  }

  store.paypalEmail = paypalEmail;
  store.payoutProvider = 'paypal';
  await store.save();

  res.json({ 
    message: 'PayPal email updated successfully',
    paypalEmail: store.paypalEmail,
  });
});

// Update bank details for store (owner only)
router.patch('/:id/bank-details', auth, async (req: AuthRequest, res) => {
  const { accountName, accountNumber, bankName, iban } = req.body;

  if (!accountName || !accountNumber || !bankName) {
    return res.status(400).json({ message: 'accountName, accountNumber and bankName are required' });
  }

  const store = await Store.findOne({ _id: req.params.id, owner: req.user!._id });
  if (!store) return res.status(404).json({ message: 'Store not found' });

  store.bankDetails = { accountName, accountNumber, bankName, iban };
  store.payoutProvider = 'bank';
  await store.save();

  res.json({ message: 'Bank details updated', bankDetails: store.bankDetails });
});

// Delete store and cascade delete products (owner only)
router.delete('/:id', auth, async (req: AuthRequest, res) => {
  const store = await Store.findOneAndDelete({ _id: req.params.id, owner: req.user!._id });
  if (!store) return res.status(404).json({ message: 'Store not found' });
  await Product.deleteMany({ store: store._id });
  await User.findByIdAndUpdate(req.user!._id, { store: null });
  res.json({ message: 'Store and products deleted' });
});

export default router;