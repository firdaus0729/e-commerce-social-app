import { Notification } from '../models/Notification';
import mongoose from 'mongoose';

export async function createNotification(data: {
  user: mongoose.Types.ObjectId | string;
  from: mongoose.Types.ObjectId | string;
  type: 'like' | 'comment' | 'follow' | 'unfollow' | 'payment_success' | 'payment_failed' | 'review' | 'message' | 'post_mention' | 'story_reply' | 'story_like' | 'product_like' | 'product_dislike' | 'order_placed';
  post?: mongoose.Types.ObjectId | string;
  comment?: mongoose.Types.ObjectId | string;
  review?: mongoose.Types.ObjectId | string;
  payment?: mongoose.Types.ObjectId | string;
  order?: mongoose.Types.ObjectId | string;
  product?: mongoose.Types.ObjectId | string;
  story?: mongoose.Types.ObjectId | string;
  message?: string;
  metadata?: Record<string, any>;
}) {
  // Don't create notification if user is notifying themselves (except for system notifications like payment_success)
  if (data.user.toString() === data.from.toString() && !['payment_success', 'payment_failed', 'order_placed'].includes(data.type)) {
    return null;
  }

  try {
    const notification = await Notification.create({
      user: data.user,
      from: data.from,
      type: data.type,
      post: data.post,
      comment: data.comment,
      review: data.review,
      payment: data.payment,
      order: data.order,
      product: data.product,
      story: data.story,
      message: data.message,
      metadata: data.metadata,
      read: false,
    });

    return notification;
  } catch (error) {
    console.error('Failed to create notification:', error);
    return null;
  }
}

