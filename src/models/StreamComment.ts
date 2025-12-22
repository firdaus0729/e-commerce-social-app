import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IStreamComment extends Document {
  stream: mongoose.Types.ObjectId;
  user: mongoose.Types.ObjectId;
  text: string;
  createdAt: Date;
  updatedAt: Date;
}

const streamCommentSchema = new Schema<IStreamComment>(
  {
    stream: { type: Schema.Types.ObjectId, ref: 'Stream', required: true, index: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    text: { type: String, required: true, maxlength: 500 },
  },
  { timestamps: true }
);

export const StreamComment: Model<IStreamComment> =
  mongoose.models.StreamComment ?? mongoose.model<IStreamComment>('StreamComment', streamCommentSchema);

