import { Router } from 'express';
import { auth, AuthRequest } from '../middleware/auth';
import { Story } from '../models/Story';
import { StoryReply } from '../models/StoryReply';
import { User } from '../models/User';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';

const router = Router();

// Create a new story (expires in 24 hours)
router.post('/', auth, async (req: AuthRequest, res) => {
  try {
    console.log('[stories] POST / - Request received', {
      hasBody: !!req.body,
      bodyKeys: req.body ? Object.keys(req.body) : [],
      userId: req.user?._id,
    });
    
    const { mediaUrl, mediaType, caption } = req.body;
    
    if (!mediaUrl || !mediaType) {
      return res.status(400).json({ message: 'mediaUrl and mediaType are required' });
    }

    if (!['image', 'video'].includes(mediaType)) {
      return res.status(400).json({ message: 'mediaType must be "image" or "video"' });
    }

    if (!req.user) {
      return res.status(401).json({ message: 'User not authenticated' });
    }

    // Set expiration to 24 hours from now
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    console.log('[stories] Creating story with data:', {
      userId: req.user._id,
      mediaUrl,
      mediaType,
      hasCaption: !!caption,
      expiresAt,
    });

    let story;
    try {
      story = await Story.create({
        user: req.user._id,
        mediaUrl,
        mediaType,
        caption: caption?.trim() || undefined,
        views: [],
        likes: [],
        replies: [],
        expiresAt,
      });
      console.log('[stories] Story created successfully:', story._id);
    } catch (createError: any) {
      console.error('[stories] Error creating story in database:', createError);
      return res.status(500).json({ 
        message: 'Failed to create story in database',
        error: createError.message 
      });
    }

    let populatedStory;
    try {
      populatedStory = await Story.findById(story._id)
        .populate('user', 'name profilePhoto')
        .lean();
      
      if (!populatedStory) {
        console.error('[stories] Story created but not found after creation');
        return res.status(500).json({ message: 'Failed to retrieve created story' });
      }
      console.log('[stories] Story populated successfully');
    } catch (populateError: any) {
      console.error('[stories] Error populating story:', populateError);
      return res.status(500).json({ 
        message: 'Failed to populate story data',
        error: populateError.message 
      });
    }

    res.status(201).json(populatedStory);
  } catch (error: any) {
    console.error('Error creating story:', error);
    const errorMessage = error.message || 'Failed to create story';
    console.error('Error details:', {
      message: errorMessage,
      stack: error.stack,
      name: error.name,
    });
    res.status(500).json({ message: errorMessage });
  }
});

// Get stories feed (stories from users you follow + your own stories)
router.get('/feed', async (req, res) => {
  try {
    // Get current user if authenticated
    let currentUserId: string | null = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.substring(7);
        const decoded = jwt.verify(token, env.jwtSecret) as { sub: string };
        currentUserId = decoded.sub;
      } catch (err) {
        // Invalid token, continue without user
      }
    }

    // Get all active stories (not expired)
    const now = new Date();
    let stories = await Story.find({ expiresAt: { $gt: now } })
      .populate('user', 'name profilePhoto')
      .sort({ createdAt: -1 })
      .lean();

    // Group stories by user
    const storiesByUser: Record<string, any[]> = {};
    stories.forEach((story) => {
      const userId = (story.user as any)._id?.toString() || (story.user as any).toString();
      if (!storiesByUser[userId]) {
        storiesByUser[userId] = [];
      }
      storiesByUser[userId].push(story);
    });

    // Get user info for each user who has stories
    const userIds = Object.keys(storiesByUser);
    const users = await User.find({ _id: { $in: userIds } })
      .select('name profilePhoto')
      .lean();

    // Build response with user info and their stories
    const feed = users.map((user) => {
      const userStories = storiesByUser[user._id.toString()]
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()); // Oldest first
      
      // Check if current user has viewed all stories from this user
      let allViewed = false;
      if (currentUserId) {
        allViewed = userStories.every((story) => 
          story.views.some((viewerId: any) => viewerId.toString() === currentUserId)
        );
      }

      return {
        user: {
          _id: user._id,
          name: user.name,
          profilePhoto: user.profilePhoto,
        },
        stories: userStories.map((story) => ({
          ...story,
          viewsCount: story.views.length,
          likesCount: story.likes.length,
          isViewed: currentUserId ? story.views.some((viewerId: any) => viewerId.toString() === currentUserId) : false,
          isLiked: currentUserId ? story.likes.some((likeId: any) => likeId.toString() === currentUserId) : false,
        })),
        allViewed,
      };
    });

    // Sort: unviewed stories first, then by most recent story
    feed.sort((a, b) => {
      if (a.allViewed !== b.allViewed) {
        return a.allViewed ? 1 : -1; // Unviewed first
      }
      const aLatest = a.stories[a.stories.length - 1]?.createdAt || new Date(0);
      const bLatest = b.stories[b.stories.length - 1]?.createdAt || new Date(0);
      return new Date(bLatest).getTime() - new Date(aLatest).getTime();
    });

    res.json(feed);
  } catch (error: any) {
    console.error('Get stories feed error', error);
    res.status(500).json({ message: error.message || 'Failed to fetch stories' });
  }
});

// Get stories by a specific user
router.get('/user/:userId', async (req, res) => {
  const { userId } = req.params;
  const now = new Date();

  const stories = await Story.find({ 
    user: userId, 
    expiresAt: { $gt: now } 
  })
    .populate('user', 'name profilePhoto')
    .sort({ createdAt: 1 }) // Oldest first (for story viewer)
    .lean();

  // Get current user if authenticated
  let currentUserId: string | null = null;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const token = authHeader.substring(7);
      const decoded = jwt.verify(token, env.jwtSecret) as { sub: string };
      currentUserId = decoded.sub;
    } catch (err) {
      // Invalid token
    }
  }

  const storiesWithStats = stories.map((story) => ({
    ...story,
    viewsCount: story.views.length,
    likesCount: story.likes.length,
    isViewed: currentUserId ? story.views.some((viewerId: any) => viewerId.toString() === currentUserId) : false,
    isLiked: currentUserId ? story.likes.some((likeId: any) => likeId.toString() === currentUserId) : false,
  }));

  res.json(storiesWithStats);
});

// Get current user's stories
router.get('/me', auth, async (req: AuthRequest, res) => {
  const now = new Date();
  const stories = await Story.find({ 
    user: req.user!._id, 
    expiresAt: { $gt: now } 
  })
    .populate('user', 'name profilePhoto')
    .sort({ createdAt: 1 })
    .lean();

  const storiesWithStats = stories.map((story) => ({
    ...story,
    viewsCount: story.views.length,
    likesCount: story.likes.length,
  }));

  res.json(storiesWithStats);
});

// View a story (mark as viewed)
router.post('/:id/view', auth, async (req: AuthRequest, res) => {
  const story = await Story.findById(req.params.id);
  if (!story) return res.status(404).json({ message: 'Story not found' });

  // Check if story has expired
  if (new Date() > story.expiresAt) {
    return res.status(410).json({ message: 'Story has expired' });
  }

  const userId = req.user!._id.toString();
  if (!story.views.some((id: any) => id.toString() === userId)) {
    story.views.push(req.user!._id);
    await story.save();
  }

  res.json({ success: true, viewsCount: story.views.length });
});

// Like/unlike a story
router.post('/:id/like', auth, async (req: AuthRequest, res) => {
  const story = await Story.findById(req.params.id);
  if (!story) return res.status(404).json({ message: 'Story not found' });

  // Check if story has expired
  if (new Date() > story.expiresAt) {
    return res.status(410).json({ message: 'Story has expired' });
  }

  const userId = req.user!._id.toString();
  const likeIndex = story.likes.findIndex((id: any) => id.toString() === userId);

  if (likeIndex >= 0) {
    story.likes.splice(likeIndex, 1);
  } else {
    story.likes.push(req.user!._id);
  }

  await story.save();
  res.json({ liked: likeIndex < 0, likesCount: story.likes.length });
});

// Reply to a story
router.post('/:id/reply', auth, async (req: AuthRequest, res) => {
  const { text } = req.body;
  if (!text || !text.trim()) {
    return res.status(400).json({ message: 'Reply text is required' });
  }

  const story = await Story.findById(req.params.id);
  if (!story) return res.status(404).json({ message: 'Story not found' });

  // Check if story has expired
  if (new Date() > story.expiresAt) {
    return res.status(410).json({ message: 'Story has expired' });
  }

  const reply = await StoryReply.create({
    story: story._id,
    user: req.user!._id,
    text: text.trim(),
  });

  story.replies.push(reply._id);
  await story.save();

  const populatedReply = await StoryReply.findById(reply._id)
    .populate('user', 'name profilePhoto')
    .lean();

  res.status(201).json(populatedReply);
});

// Get replies for a story
router.get('/:id/replies', async (req, res) => {
  const replies = await StoryReply.find({ story: req.params.id })
    .populate('user', 'name profilePhoto')
    .sort({ createdAt: 1 })
    .lean();

  res.json(replies);
});

// Delete a story
router.delete('/:id', auth, async (req: AuthRequest, res) => {
  const story = await Story.findById(req.params.id);
  if (!story) return res.status(404).json({ message: 'Story not found' });

  if (story.user.toString() !== req.user!._id.toString()) {
    return res.status(403).json({ message: 'Not authorized' });
  }

  // Delete all replies
  await StoryReply.deleteMany({ story: story._id });

  await Story.findByIdAndDelete(req.params.id);
  res.json({ success: true });
});

// Get story views (who viewed the story)
router.get('/:id/views', auth, async (req: AuthRequest, res) => {
  const story = await Story.findById(req.params.id)
    .populate('views', 'name profilePhoto')
    .lean();

  if (!story) return res.status(404).json({ message: 'Story not found' });

  if (story.user.toString() !== req.user!._id.toString()) {
    return res.status(403).json({ message: 'Not authorized' });
  }

  res.json({ views: story.views });
});

export default router;

