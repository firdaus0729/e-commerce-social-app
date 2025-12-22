import { Router } from 'express';
import { auth, AuthRequest } from '../middleware/auth';
import { Product } from '../models/Product';
import { Store } from '../models/Store';
import { Engagement, Comment } from '../models/Engagement';
import { Review } from '../models/Review';

const router = Router();

router.post('/', auth, async (req: AuthRequest, res) => {
  const { title, description, price, stock, images, tags } = req.body;
  if (!title || !price) return res.status(400).json({ message: 'Title and price are required' });
  const store = await Store.findOne({ owner: req.user!._id });
  if (!store) return res.status(400).json({ message: 'Create a store first' });

  const product = await Product.create({
    title,
    description,
    price,
    stock: stock ?? 100,
    images: images ?? [],
    tags: tags ?? [],
    store: store._id,
    isPublished: true,
  });
  res.status(201).json(product);
});

router.get('/', async (req, res) => {
  const { store, q } = req.query;
  const query: Record<string, unknown> = { isPublished: true };
  if (store) query.store = store;
  if (q) query.title = { $regex: q as string, $options: 'i' };
  const products = await Product.find(query).sort({ createdAt: -1 }).limit(50);
  
  // Get engagement stats and ratings for all products
  const productsWithStats = await Promise.all(
    products.map(async (product) => {
      const likes = await Engagement.countDocuments({ product: product._id, type: 'like' });
      const dislikes = await Engagement.countDocuments({ product: product._id, type: 'dislike' });
      const commentsCount = await Comment.countDocuments({ product: product._id });
      const reviews = await Review.find({ product: product._id });
      const reviewCount = reviews.length;
      const averageRating = reviewCount > 0
        ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviewCount
        : 0;
      
      const productObj = product.toObject();
      return {
        ...productObj,
        likes,
        dislikes,
        commentsCount,
        visits: product.visits || 0,
        averageRating: Math.round(averageRating * 10) / 10,
        reviewCount,
      };
    })
  );
  
  res.json(productsWithStats);
});

router.get('/:id', async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) return res.status(404).json({ message: 'Product not found' });
  
  // Increment visit count
  await Product.findByIdAndUpdate(req.params.id, { $inc: { visits: 1 } });
  
  // Get engagement stats and ratings
  const likes = await Engagement.countDocuments({ product: product._id, type: 'like' });
  const dislikes = await Engagement.countDocuments({ product: product._id, type: 'dislike' });
  const commentsCount = await Comment.countDocuments({ product: product._id });
  const reviews = await Review.find({ product: product._id });
  const reviewCount = reviews.length;
  const averageRating = reviewCount > 0
    ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviewCount
    : 0;
  
  const productObj = product.toObject();
  res.json({
    ...productObj,
    likes,
    dislikes,
    commentsCount,
    visits: (product.visits || 0) + 1,
    averageRating: Math.round(averageRating * 10) / 10,
    reviewCount,
  });
});

router.patch('/:id', auth, async (req: AuthRequest, res) => {
  const store = await Store.findOne({ owner: req.user!._id });
  if (!store) return res.status(400).json({ message: 'Create a store first' });
  const product = await Product.findOneAndUpdate(
    { _id: req.params.id, store: store._id },
    req.body,
    { new: true }
  );
  if (!product) return res.status(404).json({ message: 'Product not found' });
  res.json(product);
});

router.delete('/:id', auth, async (req: AuthRequest, res) => {
  const store = await Store.findOne({ owner: req.user!._id });
  if (!store) return res.status(400).json({ message: 'Create a store first' });
  const product = await Product.findOneAndDelete({ _id: req.params.id, store: store._id });
  if (!product) return res.status(404).json({ message: 'Product not found' });
  
  // Clean up engagement data
  await Engagement.deleteMany({ product: product._id });
  await Comment.deleteMany({ product: product._id });
  
  res.json({ message: 'Product deleted' });
});

// Like/Dislike product
router.post('/:id/like', auth, async (req: AuthRequest, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) return res.status(404).json({ message: 'Product not found' });
  
  await Engagement.findOneAndUpdate(
    { product: product._id, user: req.user!._id },
    { product: product._id, user: req.user!._id, type: 'like' },
    { upsert: true, new: true }
  );
  
  // Remove dislike if exists
  await Engagement.deleteOne({ product: product._id, user: req.user!._id, type: 'dislike' });
  
  const likes = await Engagement.countDocuments({ product: product._id, type: 'like' });
  const dislikes = await Engagement.countDocuments({ product: product._id, type: 'dislike' });
  
  res.json({ likes, dislikes });
});

router.post('/:id/dislike', auth, async (req: AuthRequest, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) return res.status(404).json({ message: 'Product not found' });
  
  await Engagement.findOneAndUpdate(
    { product: product._id, user: req.user!._id },
    { product: product._id, user: req.user!._id, type: 'dislike' },
    { upsert: true, new: true }
  );
  
  // Remove like if exists
  await Engagement.deleteOne({ product: product._id, user: req.user!._id, type: 'like' });
  
  const likes = await Engagement.countDocuments({ product: product._id, type: 'like' });
  const dislikes = await Engagement.countDocuments({ product: product._id, type: 'dislike' });
  
  res.json({ likes, dislikes });
});

// Add comment
router.post('/:id/comments', auth, async (req: AuthRequest, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ message: 'Comment text is required' });
  
  const product = await Product.findById(req.params.id);
  if (!product) return res.status(404).json({ message: 'Product not found' });
  
  const comment = await Comment.create({
    product: product._id,
    user: req.user!._id,
    text,
  });
  
  const commentsCount = await Comment.countDocuments({ product: product._id });
  res.status(201).json({ ...comment.toObject(), commentsCount });
});

// Get comments
router.get('/:id/comments', async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) return res.status(404).json({ message: 'Product not found' });
  
  const comments = await Comment.find({ product: product._id })
    .populate('user', 'name email')
    .sort({ createdAt: -1 })
    .limit(50);
  
  res.json(comments);
});

// Add review/rating
router.post('/:id/reviews', auth, async (req: AuthRequest, res) => {
  const { rating, comment } = req.body;
  if (!rating || rating < 1 || rating > 5) {
    return res.status(400).json({ message: 'Rating must be between 1 and 5' });
  }
  
  const product = await Product.findById(req.params.id);
  if (!product) return res.status(404).json({ message: 'Product not found' });
  
  // Update or create review
  const review = await Review.findOneAndUpdate(
    { product: product._id, user: req.user!._id },
    { rating, comment: comment || '' },
    { upsert: true, new: true }
  );
  
  // Recalculate average rating
  const reviews = await Review.find({ product: product._id });
  const averageRating = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
  
  await Product.findByIdAndUpdate(product._id, {
    averageRating: Math.round(averageRating * 10) / 10,
    reviewCount: reviews.length,
  });
  
  res.status(201).json({
    ...review.toObject(),
    user: { id: req.user!._id, name: req.user!.name, email: req.user!.email },
  });
});

// Get reviews
router.get('/:id/reviews', async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) return res.status(404).json({ message: 'Product not found' });
  
  const reviews = await Review.find({ product: product._id })
    .populate('user', 'name email')
    .sort({ createdAt: -1 })
    .limit(50);
  
  res.json(reviews);
});

export default router;

