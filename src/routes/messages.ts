import { Router } from 'express';
import { auth, AuthRequest } from '../middleware/auth';
import { Message } from '../models/Message';
import { User } from '../models/User';
import { Post } from '../models/Post';

const router = Router();

// Send a message
router.post('/', auth, async (req: AuthRequest, res) => {
  const { receiverId, postId, type = 'text', text, mediaUrl, fileName, fileSize, duration } = req.body;
  if (!receiverId || !postId) {
    return res.status(400).json({ message: 'Receiver ID and Post ID are required' });
  }
  if (type === 'text' && !text) {
    return res.status(400).json({ message: 'Text is required for text messages' });
  }
  if (type !== 'text' && !mediaUrl) {
    return res.status(400).json({ message: 'Media URL is required for media messages' });
  }

  const message = await Message.create({
    sender: req.user!._id,
    receiver: receiverId,
    post: postId,
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

