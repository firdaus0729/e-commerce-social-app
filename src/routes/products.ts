import { Router } from 'express';
import { auth, AuthRequest } from '../middleware/auth';
import { Product } from '../models/Product';
import { Store } from '../models/Store';
import { Engagement, Comment } from '../models/Engagement';
import { Review } from '../models/Review';
import { createNotification } from '../utils/notifications';

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
  const { store, q, page = 1, limit = 50 } = req.query;
  const skip = (Number(page) - 1) * Number(limit);
  const limitNum = Math.min(Number(limit), 100);
  
  // Build match query
  const matchQuery: Record<string, any> = { isPublished: true };
  if (store) matchQuery.store = store;
  if (q) matchQuery.title = { $regex: q as string, $options: 'i' };
  
  try {
    // Use aggregation pipeline for better performance
    const pipeline: any[] = [
      { $match: matchQuery },
      {
        $lookup: {
          from: 'engagements',
          let: { productId: '$_id' },
          pipeline: [
            { $match: { $expr: { $and: [{ $eq: ['$product', '$$productId'] }, { $eq: ['$type', 'like'] }] } } },
            { $count: 'count' },
          ],
          as: 'likesData',
        },
      },
      {
        $lookup: {
          from: 'engagements',
          let: { productId: '$_id' },
          pipeline: [
            { $match: { $expr: { $and: [{ $eq: ['$product', '$$productId'] }, { $eq: ['$type', 'dislike'] }] } } },
            { $count: 'count' },
          ],
          as: 'dislikesData',
        },
      },
      {
        $lookup: {
          from: 'comments',
          localField: '_id',
          foreignField: 'product',
          as: 'commentsData',
        },
      },
      {
        $lookup: {
          from: 'reviews',
          localField: '_id',
          foreignField: 'product',
          as: 'reviewsData',
        },
      },
      {
        $addFields: {
          likes: { $ifNull: [{ $arrayElemAt: ['$likesData.count', 0] }, 0] },
          dislikes: { $ifNull: [{ $arrayElemAt: ['$dislikesData.count', 0] }, 0] },
          commentsCount: { $size: '$commentsData' },
          reviewCount: { $size: '$reviewsData' },
          averageRating: {
            $cond: {
              if: { $gt: [{ $size: '$reviewsData' }, 0] },
              then: {
                $round: [
                  {
                    $divide: [
                      { $sum: '$reviewsData.rating' },
                      { $size: '$reviewsData' },
                    ],
                  },
                  1,
                ],
              },
              else: 0,
            },
          },
        },
      },
      {
        $project: {
          likesData: 0,
          dislikesData: 0,
          commentsData: 0,
          reviewsData: 0,
        },
      },
      { $sort: { createdAt: -1 } },
      { $skip: skip },
      { $limit: limitNum },
    ];
    
    const products = await Product.aggregate(pipeline);
    res.json(products);
  } catch (error: any) {
    console.error('Products error:', error);
    res.status(500).json({ message: error.message || 'Failed to fetch products' });
  }
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
  const product = await Product.findById(req.params.id).populate('store');
  if (!product) return res.status(404).json({ message: 'Product not found' });
  
  // Check if already liked (to avoid duplicate notifications)
  const existingEngagement = await Engagement.findOne({ 
    product: product._id, 
    user: req.user!._id, 
    type: 'like' 
  });
  const isNewLike = !existingEngagement;
  
  await Engagement.findOneAndUpdate(
    { product: product._id, user: req.user!._id },
    { product: product._id, user: req.user!._id, type: 'like' },
    { upsert: true, new: true }
  );
  
  // Remove dislike if exists
  await Engagement.deleteOne({ product: product._id, user: req.user!._id, type: 'dislike' });
  
  // Create notification for product owner (store owner) only for new likes
  if (isNewLike) {
    const store = product.store as any;
    if (store?.owner) {
      await createNotification({
        user: store.owner,
        from: req.user!._id,
        type: 'product_like',
        product: product._id,
        message: `${req.user!.name} liked your product "${product.title}"`,
      });
    }
  }
  
  const likes = await Engagement.countDocuments({ product: product._id, type: 'like' });
  const dislikes = await Engagement.countDocuments({ product: product._id, type: 'dislike' });
  
  res.json({ likes, dislikes });
});

router.post('/:id/dislike', auth, async (req: AuthRequest, res) => {
  const product = await Product.findById(req.params.id).populate('store');
  if (!product) return res.status(404).json({ message: 'Product not found' });
  
  // Check if already disliked (to avoid duplicate notifications)
  const existingEngagement = await Engagement.findOne({ 
    product: product._id, 
    user: req.user!._id, 
    type: 'dislike' 
  });
  const isNewDislike = !existingEngagement;
  
  await Engagement.findOneAndUpdate(
    { product: product._id, user: req.user!._id },
    { product: product._id, user: req.user!._id, type: 'dislike' },
    { upsert: true, new: true }
  );
  
  // Remove like if exists
  await Engagement.deleteOne({ product: product._id, user: req.user!._id, type: 'like' });
  
  // Create notification for product owner (store owner) only for new dislikes
  if (isNewDislike) {
    const store = product.store as any;
    if (store?.owner) {
      await createNotification({
        user: store.owner,
        from: req.user!._id,
        type: 'product_dislike',
        product: product._id,
        message: `${req.user!.name} disliked your product "${product.title}"`,
      });
    }
  }
  
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
  
  const product = await Product.findById(req.params.id).populate('store');
  if (!product) return res.status(404).json({ message: 'Product not found' });
  
  // Check if this is a new review or update
  const existingReview = await Review.findOne({
    product: product._id,
    user: req.user!._id,
  });
  const isNewReview = !existingReview;
  
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
  
  // Create notification for product owner (store owner) only for new reviews
  if (isNewReview) {
    const store = product.store as any;
    if (store?.owner) {
      await createNotification({
        user: store.owner,
        from: req.user!._id,
        type: 'review',
        product: product._id,
        review: review._id,
        message: `${req.user!.name} reviewed your product "${product.title}"`,
      });
    }
  }
  
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

