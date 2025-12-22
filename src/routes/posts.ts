import { Router } from 'express';
import { auth, AuthRequest } from '../middleware/auth';
import { Post } from '../models/Post';
import { User } from '../models/User';
import { PostComment } from '../models/PostComment';
import { SavedPost } from '../models/SavedPost';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';

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
  const posts = await Post.find({ user: userId })
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
});

// Get current user's posts
router.get('/me', auth, async (req: AuthRequest, res) => {
  const posts = await Post.find({ user: req.user!._id })
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
});

// Get feed posts (show all posts, prioritize users who viewed my posts most)
router.get('/feed', async (req, res) => {
  // Get all posts from all users
  let posts = await Post.find({})
    .populate('user', 'name profilePhoto')
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();

  // If user is authenticated, prioritize users who viewed their posts
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const token = authHeader.substring(7);
      const decoded = jwt.verify(token, env.jwtSecret) as { sub: string };
      const currentUserId = decoded.sub;

      // Calculate view scores: prioritize users who viewed my posts most
      const myPosts = await Post.find({ user: currentUserId }).lean();
      const userViewScores: Record<string, number> = {};

      myPosts.forEach((myPost) => {
        myPost.views.forEach((viewerId: any) => {
          const viewerStr = viewerId.toString();
          if (viewerStr !== currentUserId) {
            userViewScores[viewerStr] = (userViewScores[viewerStr] || 0) + 1;
          }
        });
      });

      // Sort posts: prioritize posts from users with higher view scores
      posts.sort((a, b) => {
        const aUserId = (a.user as any)._id?.toString() || (a.user as any).toString();
        const bUserId = (b.user as any)._id?.toString() || (b.user as any).toString();
        const aScore = userViewScores[aUserId] || 0;
        const bScore = userViewScores[bUserId] || 0;

        if (aScore !== bScore) {
          return bScore - aScore; // Higher score first
        }
        // If scores are equal, sort by creation date (newest first)
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
    } catch (err) {
      // If token is invalid, just show all posts in chronological order
      console.log('Invalid token, showing all posts');
    }
  }

  // Get comment counts for all posts
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

  if (likeIndex >= 0) {
    post.likes.splice(likeIndex, 1);
  } else {
    post.likes.push(req.user!._id);
  }

  await post.save();
  res.json({ liked: likeIndex < 0, likesCount: post.likes.length });
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

  res.status(201).json(populatedComment);
});

export default router;

