import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ISavedPost extends Document {
  user: mongoose.Types.ObjectId;
  post: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const savedPostSchema = new Schema<ISavedPost>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    post: { type: Schema.Types.ObjectId, ref: 'Post', required: true, index: true },
  },
  { timestamps: true }
);

// Ensure a post is only saved once per user
savedPostSchema.index({ user: 1, post: 1 }, { unique: true });

export const SavedPost: Model<ISavedPost> =
  mongoose.models.SavedPost ?? mongoose.model<ISavedPost>('SavedPost', savedPostSchema);


