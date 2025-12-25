import { Router } from 'express';
import { auth, AuthRequest } from '../middleware/auth';
import { Notification } from '../models/Notification';
import { User } from '../models/User';
import { Post } from '../models/Post';
import { PostComment } from '../models/PostComment';
import { Review } from '../models/Review';
import { Payment } from '../models/Payment';
import { Order } from '../models/Order';
import { Product } from '../models/Product';

const router = Router();

// Get all notifications for current user
router.get('/', auth, async (req: AuthRequest, res) => {
  const currentUserId = req.user!._id.toString();
  const { limit = 50, skip = 0 } = req.query;

  try {
    const notifications = await Notification.find({ user: currentUserId })
      .populate('from', 'name profilePhoto')
      .populate('post', '_id')
      .populate('comment', '_id text')
      .populate('review', '_id rating comment')
      .populate('payment', '_id amount status')
      .populate('order', '_id total status')
      .populate('product', '_id name')
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .skip(Number(skip))
      .lean();

    const unreadCount = await Notification.countDocuments({
      user: currentUserId,
      read: false,
    });

    res.json({ notifications, unreadCount });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to fetch notifications' });
  }
});

// Get unread notification count
router.get('/count', auth, async (req: AuthRequest, res) => {
  const currentUserId = req.user!._id.toString();

  try {
    const count = await Notification.countDocuments({
      user: currentUserId,
      read: false,
    });

    res.json({ count });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to get notification count' });
  }
});

// Mark notification as read
router.patch('/:notificationId/read', auth, async (req: AuthRequest, res) => {
  const { notificationId } = req.params;
  const currentUserId = req.user!._id.toString();

  try {
    const notification = await Notification.findById(notificationId);
    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    if (notification.user.toString() !== currentUserId) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    notification.read = true;
    await notification.save();

    res.json({ message: 'Notification marked as read' });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to mark notification as read' });
  }
});

// Mark all notifications as read
router.patch('/read-all', auth, async (req: AuthRequest, res) => {
  const currentUserId = req.user!._id.toString();

  try {
    await Notification.updateMany(
      { user: currentUserId, read: false },
      { read: true }
    );

    res.json({ message: 'All notifications marked as read' });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to mark all notifications as read' });
  }
});

// Delete a notification
router.delete('/:notificationId', auth, async (req: AuthRequest, res) => {
  const { notificationId } = req.params;
  const currentUserId = req.user!._id.toString();

  try {
    const notification = await Notification.findById(notificationId);
    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    if (notification.user.toString() !== currentUserId) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    await Notification.findByIdAndDelete(notificationId);

    res.json({ message: 'Notification deleted' });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to delete notification' });
  }
});

// Delete multiple notifications
router.delete('/', auth, async (req: AuthRequest, res) => {
  const currentUserId = req.user!._id.toString();
  const { notificationIds } = req.body; // Array of notification IDs

  if (!Array.isArray(notificationIds) || notificationIds.length === 0) {
    return res.status(400).json({ message: 'Notification IDs array is required' });
  }

  try {
    const result = await Notification.deleteMany({
      _id: { $in: notificationIds },
      user: currentUserId, // Ensure user can only delete their own notifications
    });

    res.json({ message: `${result.deletedCount} notification(s) deleted` });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to delete notifications' });
  }
});

export default router;

