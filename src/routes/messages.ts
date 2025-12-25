import { Router } from 'express';
import { auth, AuthRequest } from '../middleware/auth';
import { Message } from '../models/Message';
import { User } from '../models/User';
import { Post } from '../models/Post';

const router = Router();

// Send a message
router.post('/', auth, async (req: AuthRequest, res) => {
  const { receiverId, postId, type = 'text', text, mediaUrl, fileName, fileSize, duration } = req.body;
  if (!receiverId) {
    return res.status(400).json({ message: 'Receiver ID is required' });
  }
  // postId is optional for direct messages
  if (type === 'text' && !text) {
    return res.status(400).json({ message: 'Text is required for text messages' });
  }
  if (type !== 'text' && !mediaUrl) {
    return res.status(400).json({ message: 'Media URL is required for media messages' });
  }

  const message = await Message.create({
    sender: req.user!._id,
    receiver: receiverId,
    post: postId || null, // Allow null for direct messages
    type,
    text: text || '',
    mediaUrl,
    fileName,
    fileSize,
    duration,
    delivered: false,
    read: false,
  });

  const populatedMessage = await Message.findById(message._id)
    .populate('sender', 'name profilePhoto')
    .populate('receiver', 'name profilePhoto')
    .populate('post', '_id')
    .lean();

  res.status(201).json(populatedMessage);
});

// Get conversation between current user and another user for a specific post
router.get('/conversation/:postId/:userId', auth, async (req: AuthRequest, res) => {
  const { postId, userId } = req.params;
  const currentUserId = req.user!._id.toString();

  const messages = await Message.find({
    post: postId,
    $or: [
      { sender: currentUserId, receiver: userId },
      { sender: userId, receiver: currentUserId },
    ],
  })
    .populate('sender', 'name profilePhoto')
    .populate('receiver', 'name profilePhoto')
    .populate('post', '_id')
    .sort({ createdAt: 1 })
    .lean();

  // Mark messages as delivered (messages sent to current user)
  await Message.updateMany(
    {
      post: postId,
      sender: userId,
      receiver: currentUserId,
      delivered: false,
    },
    { delivered: true }
  );

  // Mark messages as read (messages sent to current user)
  await Message.updateMany(
    {
      post: postId,
      sender: userId,
      receiver: currentUserId,
      read: false,
    },
    { read: true }
  );

  res.json(messages);
});

// Get all users who have direct message chat history with current user
// NOTE: This route must come before /direct/:userId to avoid route conflicts
router.get('/direct/users', auth, async (req: AuthRequest, res) => {
  const currentUserId = req.user!._id.toString();

  // Get all unique users who have sent or received direct messages (no post)
  const sentMessages = await Message.find({
    post: null,
    sender: currentUserId,
  })
    .select('receiver')
    .distinct('receiver')
    .lean();

  const receivedMessages = await Message.find({
    post: null,
    receiver: currentUserId,
  })
    .select('sender')
    .distinct('sender')
    .lean();

  // Combine and get unique user IDs
  const allUserIds = [...new Set([
    ...sentMessages.map((id: any) => id.toString()),
    ...receivedMessages.map((id: any) => id.toString()),
  ])];

  // Get last message and unread count for each user
  const usersWithChats = await Promise.all(
    allUserIds.map(async (userId: string) => {
      const lastMessage = await Message.findOne({
        post: null,
        $or: [
          { sender: userId, receiver: currentUserId },
          { sender: currentUserId, receiver: userId },
        ],
      })
        .populate('sender', 'name profilePhoto')
        .populate('receiver', 'name profilePhoto')
        .sort({ createdAt: -1 })
        .lean();

      const unreadCount = await Message.countDocuments({
        post: null,
        sender: userId,
        receiver: currentUserId,
        read: false,
      });

      const user = await User.findById(userId).select('name profilePhoto').lean();

      return {
        user: {
          _id: user?._id,
          name: user?.name,
          profilePhoto: user?.profilePhoto,
        },
        lastMessage,
        unreadCount,
      };
    })
  );

  // Sort by last message time (most recent first)
  usersWithChats.sort((a, b) => {
    if (!a.lastMessage && !b.lastMessage) return 0;
    if (!a.lastMessage) return 1;
    if (!b.lastMessage) return -1;
    return new Date(b.lastMessage.createdAt).getTime() - new Date(a.lastMessage.createdAt).getTime();
  });

  const totalUnread = usersWithChats.reduce((sum, item) => sum + item.unreadCount, 0);

  res.json({ totalUnread, users: usersWithChats });
});

// Get unread direct message count from a specific user (without post)
router.get('/direct/unread/:userId', auth, async (req: AuthRequest, res) => {
  const { userId } = req.params;
  const currentUserId = req.user!._id.toString();

  const unreadCount = await Message.countDocuments({
    post: null, // Direct messages have no post
    sender: userId,
    receiver: currentUserId,
    read: false,
  });

  res.json({ unreadCount });
});

// Get direct conversation between current user and another user (without post)
// NOTE: This route must come after /direct/users to avoid route conflicts
router.get('/direct/:userId', auth, async (req: AuthRequest, res) => {
  const { userId } = req.params;
  const currentUserId = req.user!._id.toString();

  const messages = await Message.find({
    post: null, // Direct messages have no post
    $or: [
      { sender: currentUserId, receiver: userId },
      { sender: userId, receiver: currentUserId },
    ],
  })
    .populate('sender', 'name profilePhoto')
    .populate('receiver', 'name profilePhoto')
    .sort({ createdAt: 1 })
    .lean();

  // Mark messages as delivered and read
  await Message.updateMany(
    {
      post: null,
      sender: userId,
      receiver: currentUserId,
      delivered: false,
    },
    { delivered: true, read: true }
  );

  res.json(messages);
});

// Get unread message count for a specific conversation on a post
router.get('/unread/:postId/:userId', auth, async (req: AuthRequest, res) => {
  const { postId, userId } = req.params;
  const currentUserId = req.user!._id.toString();

  const unreadCount = await Message.countDocuments({
    post: postId,
    sender: userId,
    receiver: currentUserId,
    read: false,
  });

  res.json({ unreadCount });
});

// Batch get unread message counts for multiple posts
router.post('/batch/unread-counts', auth, async (req: AuthRequest, res) => {
  const { postIds } = req.body; // Array of post IDs (strings)
  const currentUserId = req.user!._id.toString();

  if (!Array.isArray(postIds) || postIds.length === 0) {
    return res.json({});
  }

  try {
    const counts: Record<string, number> = {};

    // Get all posts with their owners in one query
    const posts = await Post.find({ _id: { $in: postIds } })
      .select('user')
      .lean();

    // Group posts by owner
    const ownerPosts: Record<string, string[]> = {}; // ownerId -> [postIds]
    const postOwnerMap: Record<string, string> = {}; // postId -> ownerId

    posts.forEach((post) => {
      const postId = post._id.toString();
      const ownerId = (post.user as any).toString();
      postOwnerMap[postId] = ownerId;

      if (!ownerPosts[ownerId]) {
        ownerPosts[ownerId] = [];
      }
      ownerPosts[ownerId].push(postId);
    });

    // Batch query unread counts using aggregation
    const unreadCounts = await Message.aggregate([
      {
        $match: {
          post: { $in: postIds },
          receiver: currentUserId,
          read: false,
        },
      },
      {
        $group: {
          _id: { post: '$post', sender: '$sender' },
        },
      },
      {
        $group: {
          _id: '$_id.post',
          count: { $sum: 1 },
        },
      },
    ]);

    // Initialize all counts to 0
    postIds.forEach((postId: string) => {
      counts[postId] = 0;
    });

    // Fill in actual counts
    unreadCounts.forEach((item) => {
      const postId = item._id.toString();
      if (postOwnerMap[postId] === currentUserId) {
        // For post owner, count is number of unique senders
        counts[postId] = item.count;
      } else {
        // For regular user, only count messages from post owner
        const ownerId = postOwnerMap[postId];
        // We need to filter by sender = ownerId, so we'll do a separate query
      }
    });

    // For regular users, get counts filtered by sender = owner
    await Promise.all(
      Object.entries(ownerPosts).map(async ([ownerId, postIdsForOwner]) => {
        if (ownerId !== currentUserId) {
          const ownerUnreadCounts = await Message.aggregate([
            {
              $match: {
                post: { $in: postIdsForOwner },
                sender: ownerId,
                receiver: currentUserId,
                read: false,
              },
            },
            {
              $group: {
                _id: '$post',
                count: { $sum: 1 },
              },
            },
          ]);

          ownerUnreadCounts.forEach((item) => {
            counts[item._id.toString()] = item.count;
          });
        }
      })
    );

    res.json(counts);
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to get unread counts' });
  }
});

// Get all users who have chatted about a specific post (for post owner)
router.get('/post/:postId/users', auth, async (req: AuthRequest, res) => {
  const { postId } = req.params;
  const currentUserId = req.user!._id.toString();

  // Get post owner
  const post = await Post.findById(postId).lean();
  if (!post) return res.status(404).json({ message: 'Post not found' });

  const postOwnerId = post.user.toString();
  if (postOwnerId !== currentUserId) {
    return res.status(403).json({ message: 'Not authorized' });
  }

  // Get all users who have chatted about this post (both sent and received)
  const sentMessages = await Message.find({
    post: postId,
    sender: currentUserId,
  })
    .select('receiver')
    .distinct('receiver')
    .lean();

  const receivedMessages = await Message.find({
    post: postId,
    receiver: currentUserId,
  })
    .select('sender')
    .distinct('sender')
    .lean();

  // Combine and get unique user IDs
  const allUserIds = [...new Set([
    ...sentMessages.map((id: any) => id.toString()),
    ...receivedMessages.map((id: any) => id.toString()),
  ])];

  // Get last message and unread count for each user
  const usersWithChats = await Promise.all(
    allUserIds.map(async (userId: string) => {
      const lastMessage = await Message.findOne({
        post: postId,
        $or: [
          { sender: userId, receiver: currentUserId },
          { sender: currentUserId, receiver: userId },
        ],
      })
        .populate('sender', 'name profilePhoto')
        .populate('receiver', 'name profilePhoto')
        .sort({ createdAt: -1 })
        .lean();

      const unreadCount = await Message.countDocuments({
        post: postId,
        sender: userId,
        receiver: currentUserId,
        read: false,
      });

      const user = await User.findById(userId).select('name profilePhoto').lean();

      return {
        user: {
          _id: user?._id,
          name: user?.name,
          profilePhoto: user?.profilePhoto,
        },
        lastMessage,
        unreadCount,
      };
    })
  );

  const totalUnread = usersWithChats.reduce((sum, item) => sum + item.unreadCount, 0);

  res.json({ totalUnread, users: usersWithChats });
});

// Delete a message (only sender can delete their own message)
router.delete('/:messageId', auth, async (req: AuthRequest, res) => {
  const { messageId } = req.params;
  const currentUserId = req.user!._id.toString();

  const message = await Message.findById(messageId);
  if (!message) {
    return res.status(404).json({ message: 'Message not found' });
  }

  // Only allow deletion by message sender
  if (message.sender.toString() !== currentUserId) {
    return res.status(403).json({ message: 'Not authorized to delete this message' });
  }

  await Message.findByIdAndDelete(messageId);
  res.json({ message: 'Message deleted' });
});

export default router;
