import { Router } from 'express';
import { auth, AuthRequest } from '../middleware/auth';
import { Post } from '../models/Post';
import { User } from '../models/User';
import { PostComment } from '../models/PostComment';
import { SavedPost } from '../models/SavedPost';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { createNotification } from '../utils/notifications';

const router = Router();

// Create a new post
router.post('/', auth, async (req: AuthRequest, res) => {
  const { images, caption } = req.body;
  if (!images || !Array.isArray(images) || images.length === 0) {
    return res.status(400).json({ message: 'At least one image is required' });
  }

  const post = await Post.create({
    user: req.user!._id,
    images,
    caption,
    views: [],
    likes: [],
  });

  const populatedPost = await Post.findById(post._id)
    .populate('user', 'name profilePhoto')
    .lean();

  res.status(201).json(populatedPost);
});

// Get posts by user
router.get('/user/:userId', async (req, res) => {
  const { userId } = req.params;
  const { page = 1, limit = 20 } = req.query;
  const skip = (Number(page) - 1) * Number(limit);
  const limitNum = Math.min(Number(limit), 50);

  try {
    // Use aggregation pipeline for better performance
    const pipeline: any[] = [
      { $match: { user: userId } },
      {
        $lookup: {
          from: 'postcomments',
          localField: '_id',
          foreignField: 'post',
          as: 'comments',
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: 'user',
          foreignField: '_id',
          as: 'userData',
          pipeline: [{ $project: { name: 1, profilePhoto: 1 } }],
        },
      },
      {
        $addFields: {
          likesCount: { $size: '$likes' },
          viewsCount: { $size: '$views' },
          commentsCount: { $size: '$comments' },
          user: { $arrayElemAt: ['$userData', 0] },
        },
      },
      {
        $project: {
          comments: 0,
          userData: 0,
        },
      },
      { $sort: { createdAt: -1 } },
      { $skip: skip },
      { $limit: limitNum },
    ];

    const posts = await Post.aggregate(pipeline);
    res.json(posts);
  } catch (error: any) {
    console.error('User posts error:', error);
    res.status(500).json({ message: error.message || 'Failed to fetch posts' });
  }
});

// Get current user's posts
router.get('/me', auth, async (req: AuthRequest, res) => {
  const { page = 1, limit = 20 } = req.query;
  const skip = (Number(page) - 1) * Number(limit);
  const limitNum = Math.min(Number(limit), 50);

  try {
    // Use aggregation pipeline for better performance
    const pipeline: any[] = [
      { $match: { user: req.user!._id } },
      {
        $lookup: {
          from: 'postcomments',
          localField: '_id',
          foreignField: 'post',
          as: 'comments',
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: 'user',
          foreignField: '_id',
          as: 'userData',
          pipeline: [{ $project: { name: 1, profilePhoto: 1 } }],
        },
      },
      {
        $addFields: {
          likesCount: { $size: '$likes' },
          viewsCount: { $size: '$views' },
          commentsCount: { $size: '$comments' },
          user: { $arrayElemAt: ['$userData', 0] },
        },
      },
      {
        $project: {
          comments: 0,
          userData: 0,
        },
      },
      { $sort: { createdAt: -1 } },
      { $skip: skip },
      { $limit: limitNum },
    ];

    const posts = await Post.aggregate(pipeline);
    res.json(posts);
  } catch (error: any) {
    console.error('My posts error:', error);
    res.status(500).json({ message: error.message || 'Failed to fetch posts' });
  }
});

// Get feed posts (show all posts, prioritize users who viewed my posts most)
router.get('/feed', async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const skip = (Number(page) - 1) * Number(limit);
  const limitNum = Math.min(Number(limit), 50); // Cap at 50

  try {
    // Use aggregation pipeline for better performance - get posts with comment counts in one query
    let pipeline: any[] = [
      {
        $lookup: {
          from: 'postcomments',
          localField: '_id',
          foreignField: 'post',
          as: 'comments',
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: 'user',
          foreignField: '_id',
          as: 'userData',
          pipeline: [{ $project: { name: 1, profilePhoto: 1 } }],
        },
      },
      {
        $addFields: {
          likesCount: { $size: '$likes' },
          viewsCount: { $size: '$views' },
          commentsCount: { $size: '$comments' },
          user: { $arrayElemAt: ['$userData', 0] },
        },
      },
      {
        $project: {
          comments: 0,
          userData: 0,
        },
      },
    ];

    // If user is authenticated, prioritize users who viewed their posts most
    const authHeader = req.headers.authorization;
    let userViewScores: Record<string, number> = {};
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.substring(7);
        const decoded = jwt.verify(token, env.jwtSecret) as { sub: string };
        const currentUserId = decoded.sub;

        // Optimize: Only get view counts, not all posts
        const myPosts = await Post.find({ user: currentUserId })
          .select('views')
          .lean();

        myPosts.forEach((myPost) => {
          myPost.views.forEach((viewerId: any) => {
            const viewerStr = viewerId.toString();
            if (viewerStr !== currentUserId) {
              userViewScores[viewerStr] = (userViewScores[viewerStr] || 0) + 1;
            }
          });
        });

        // Add sorting stage if we have view scores
        if (Object.keys(userViewScores).length > 0) {
          // Sort in memory after aggregation (simpler and works reliably)
          // Get more posts than needed for sorting, then paginate
          pipeline.push({
            $sort: { createdAt: -1 },
          });
          
          // Get more posts for sorting (up to 200 for better sorting)
          const allPosts = await Post.aggregate(pipeline);
          
          // Sort by view score
          allPosts.sort((a, b) => {
            const aUserId = a.user?._id?.toString() || '';
            const bUserId = b.user?._id?.toString() || '';
            const aScore = userViewScores[aUserId] || 0;
            const bScore = userViewScores[bUserId] || 0;
            
            if (aScore !== bScore) {
              return bScore - aScore;
            }
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
          });
          
          // Apply pagination
          const paginatedPosts = allPosts.slice(skip, skip + limitNum);
          return res.json(paginatedPosts);
        } else {
          pipeline.push({
            $sort: { createdAt: -1 },
          });
        }
      } catch (err) {
        // If token is invalid, just show all posts in chronological order
        pipeline.push({
          $sort: { createdAt: -1 },
        });
      }
    } else {
      pipeline.push({
        $sort: { createdAt: -1 },
      });
    }

    // Add pagination
    pipeline.push({ $skip: skip });
    pipeline.push({ $limit: limitNum });

    const posts = await Post.aggregate(pipeline);

    res.json(posts);
  } catch (error: any) {
    console.error('Feed error:', error);
    res.status(500).json({ message: error.message || 'Failed to fetch feed' });
  }
});

// View a post (add user to views)
router.post('/:id/view', auth, async (req: AuthRequest, res) => {
  const post = await Post.findById(req.params.id);
  if (!post) return res.status(404).json({ message: 'Post not found' });

  const userId = req.user!._id.toString();
  if (!post.views.some((id: any) => id.toString() === userId)) {
    post.views.push(req.user!._id);
    await post.save();
  }

  res.json({ success: true });
});

// Like/unlike a post
router.post('/:id/like', auth, async (req: AuthRequest, res) => {
  const post = await Post.findById(req.params.id);
  if (!post) return res.status(404).json({ message: 'Post not found' });

  const userId = req.user!._id.toString();
  const likeIndex = post.likes.findIndex((id: any) => id.toString() === userId);

  const wasLiked = likeIndex >= 0;
  
  if (wasLiked) {
    post.likes.splice(likeIndex, 1);
  } else {
    post.likes.push(req.user!._id);
    // Create notification for post owner
    const postOwnerId = (post.user as any).toString();
    await createNotification({
      user: postOwnerId,
      from: req.user!._id,
      type: 'like',
      post: post._id,
    });
  }

  await post.save();
  res.json({ liked: !wasLiked, likesCount: post.likes.length });
});

// Save a post (idempotent - saving the same post twice keeps it saved)
router.post('/:id/save', auth, async (req: AuthRequest, res) => {
  const post = await Post.findById(req.params.id);
  if (!post) return res.status(404).json({ message: 'Post not found' });

  const userId = req.user!._id;

  try {
    const existing = await SavedPost.findOne({ user: userId, post: post._id });
    if (existing) {
      return res.json({ saved: true });
    }

    await SavedPost.create({ user: userId, post: post._id });
    return res.status(201).json({ saved: true });
  } catch (error: any) {
    // Handle unique index race condition gracefully
    if (error.code === 11000) {
      return res.json({ saved: true });
    }
    return res.status(500).json({ message: error.message });
  }
});

// Get current user's saved posts
router.get('/saved', auth, async (req: AuthRequest, res) => {
  try {
    const saved = await SavedPost.find({ user: req.user!._id })
      .sort({ createdAt: -1 })
      .lean();

    const postIds = saved.map((s) => s.post);
    const posts = await Post.find({ _id: { $in: postIds } })
      .populate('user', 'name profilePhoto')
      .sort({ createdAt: -1 })
      .lean();

    const postsWithStats = await Promise.all(
      posts.map(async (post) => {
        const commentsCount = await PostComment.countDocuments({ post: post._id });
        return {
          ...post,
          likesCount: post.likes.length,
          viewsCount: post.views.length,
          commentsCount,
        };
      })
    );

    res.json(postsWithStats);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// Delete a post
router.delete('/:id', auth, async (req: AuthRequest, res) => {
  const post = await Post.findById(req.params.id);
  if (!post) return res.status(404).json({ message: 'Post not found' });

  if (post.user.toString() !== req.user!._id.toString()) {
    return res.status(403).json({ message: 'Not authorized' });
  }

  await Post.findByIdAndDelete(req.params.id);
  res.json({ success: true });
});

// Get comments for a post
router.get('/:id/comments', async (req, res) => {
  const comments = await PostComment.find({ post: req.params.id })
    .populate('user', 'name profilePhoto')
    .sort({ createdAt: 1 })
    .lean();

  res.json(comments);
});

// Add a comment to a post
router.post('/:id/comments', auth, async (req: AuthRequest, res) => {
  const { text } = req.body;
  if (!text || !text.trim()) {
    return res.status(400).json({ message: 'Comment text is required' });
  }

  const post = await Post.findById(req.params.id);
  if (!post) return res.status(404).json({ message: 'Post not found' });

  const comment = await PostComment.create({
    post: post._id,
    user: req.user!._id,
    text: text.trim(),
  });

  const populatedComment = await PostComment.findById(comment._id)
    .populate('user', 'name profilePhoto')
    .lean();

  // Create notification for post owner
  const postOwnerId = (post.user as any).toString();
  await createNotification({
    user: postOwnerId,
    from: req.user!._id,
    type: 'comment',
    post: post._id,
    comment: comment._id,
  });

  res.status(201).json(populatedComment);
});

export default router;

