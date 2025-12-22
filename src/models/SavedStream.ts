import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ISavedStream extends Document {
  user: mongoose.Types.ObjectId;
  stream: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const savedStreamSchema = new Schema<ISavedStream>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    stream: { type: Schema.Types.ObjectId, ref: 'Stream', required: true, index: true },
  },
  { timestamps: true }
);

// Ensure a stream is only saved once per user
savedStreamSchema.index({ user: 1, stream: 1 }, { unique: true });

export const SavedStream: Model<ISavedStream> =
  mongoose.models.SavedStream ??
  mongoose.model<ISavedStream>('SavedStream', savedStreamSchema);


