import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IEngagement extends Document {
  product: mongoose.Types.ObjectId;
  user: mongoose.Types.ObjectId;
  type: 'like' | 'dislike';
}

export interface IComment extends Document {
  product: mongoose.Types.ObjectId;
  user: mongoose.Types.ObjectId;
  text: string;
}

const engagementSchema = new Schema<IEngagement>(
  {
    product: { type: Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, enum: ['like', 'dislike'], required: true },
  },
  { timestamps: true }
);

engagementSchema.index({ product: 1, user: 1 }, { unique: true });

const commentSchema = new Schema<IComment>(
  {
    product: { type: Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    text: { type: String, required: true },
  },
  { timestamps: true }
);

export const Engagement: Model<IEngagement> =
  mongoose.models.Engagement ?? mongoose.model<IEngagement>('Engagement', engagementSchema);

export const Comment: Model<IComment> =
  mongoose.models.Comment ?? mongoose.model<IComment>('Comment', commentSchema);

