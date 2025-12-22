import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IPostComment extends Document {
  post: mongoose.Types.ObjectId;
  user: mongoose.Types.ObjectId;
  text: string;
  createdAt: Date;
  updatedAt: Date;
}

const postCommentSchema = new Schema<IPostComment>(
  {
    post: { type: Schema.Types.ObjectId, ref: 'Post', required: true, index: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    text: { type: String, required: true },
  },
  { timestamps: true }
);

// Index for efficient queries
postCommentSchema.index({ post: 1, createdAt: -1 });

export const PostComment: Model<IPostComment> =
  mongoose.models.PostComment ?? mongoose.model<IPostComment>('PostComment', postCommentSchema);

