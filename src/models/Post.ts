import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IPost extends Document {
  user: mongoose.Types.ObjectId;
  images: string[];
  caption?: string;
  views: mongoose.Types.ObjectId[];
  likes: mongoose.Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

const postSchema = new Schema<IPost>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    images: [{ type: String, required: true }],
    caption: { type: String },
    views: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    likes: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  },
  { timestamps: true }
);

// Index for efficient queries
postSchema.index({ user: 1, createdAt: -1 });

export const Post: Model<IPost> = mongoose.models.Post ?? mongoose.model<IPost>('Post', postSchema);

