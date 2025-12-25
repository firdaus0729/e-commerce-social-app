import mongoose, { Schema, Document, Model } from 'mongoose';

export type NotificationType = 
  | 'like' 
  | 'comment' 
  | 'follow' 
  | 'payment_success' 
  | 'payment_failed' 
  | 'review' 
  | 'message'
  | 'post_mention'
  | 'story_reply';

export interface INotification extends Document {
  user: mongoose.Types.ObjectId; // User who receives the notification
  from: mongoose.Types.ObjectId; // User who triggered the notification
  type: NotificationType;
  read: boolean;
  // Reference fields (optional, depending on notification type)
  post?: mongoose.Types.ObjectId;
  comment?: mongoose.Types.ObjectId;
  review?: mongoose.Types.ObjectId;
  payment?: mongoose.Types.ObjectId;
  order?: mongoose.Types.ObjectId;
  product?: mongoose.Types.ObjectId;
  story?: mongoose.Types.ObjectId;
  // Additional data
  message?: string; // Custom message or preview
  metadata?: Record<string, any>; // Additional data
  createdAt: Date;
  updatedAt: Date;
}

const notificationSchema = new Schema<INotification>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    from: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { 
      type: String, 
      enum: ['like', 'comment', 'follow', 'payment_success', 'payment_failed', 'review', 'message', 'post_mention', 'story_reply'], 
      required: true,
      index: true
    },
    read: { type: Boolean, default: false, index: true },
    post: { type: Schema.Types.ObjectId, ref: 'Post', index: true },
    comment: { type: Schema.Types.ObjectId, ref: 'PostComment', index: true },
    review: { type: Schema.Types.ObjectId, ref: 'Review', index: true },
    payment: { type: Schema.Types.ObjectId, ref: 'Payment', index: true },
    order: { type: Schema.Types.ObjectId, ref: 'Order', index: true },
    product: { type: Schema.Types.ObjectId, ref: 'Product', index: true },
    story: { type: Schema.Types.ObjectId, ref: 'Story', index: true },
    message: { type: String },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

// Index for efficient queries
notificationSchema.index({ user: 1, read: 1, createdAt: -1 });
notificationSchema.index({ user: 1, createdAt: -1 });
notificationSchema.index({ from: 1, createdAt: -1 });

export const Notification: Model<INotification> =
  mongoose.models.Notification ?? mongoose.model<INotification>('Notification', notificationSchema);

