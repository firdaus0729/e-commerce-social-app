import { Notification } from '../models/Notification';
import mongoose from 'mongoose';

export async function createNotification(data: {
  user: mongoose.Types.ObjectId | string;
  from: mongoose.Types.ObjectId | string;
  type: 'like' | 'comment' | 'follow' | 'payment_success' | 'payment_failed' | 'review' | 'message' | 'post_mention' | 'story_reply';
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
  // Don't create notification if user is notifying themselves
  if (data.user.toString() === data.from.toString()) {
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

