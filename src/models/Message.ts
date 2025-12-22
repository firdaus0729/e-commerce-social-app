import mongoose, { Schema, Document, Model } from 'mongoose';

export type MessageType = 'text' | 'image' | 'video' | 'audio' | 'file' | 'gif';

export interface IMessage extends Document {
  sender: mongoose.Types.ObjectId;
  receiver: mongoose.Types.ObjectId;
  post: mongoose.Types.ObjectId;
  type: MessageType;
  text?: string;
  mediaUrl?: string;
  fileName?: string;
  fileSize?: number;
  duration?: number; // For audio/video messages
  delivered: boolean;
  read: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const messageSchema = new Schema<IMessage>(
  {
    sender: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    receiver: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    post: { type: Schema.Types.ObjectId, ref: 'Post', required: true, index: true },
    type: { type: String, enum: ['text', 'image', 'video', 'audio', 'file', 'gif'], default: 'text', required: true },
    text: { type: String },
    mediaUrl: { type: String },
    fileName: { type: String },
    fileSize: { type: Number },
    duration: { type: Number },
    delivered: { type: Boolean, default: false },
    read: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Index for efficient conversation queries
messageSchema.index({ sender: 1, receiver: 1, post: 1, createdAt: -1 });
messageSchema.index({ receiver: 1, sender: 1, post: 1, createdAt: -1 });
messageSchema.index({ post: 1, createdAt: -1 });

export const Message: Model<IMessage> =
  mongoose.models.Message ?? mongoose.model<IMessage>('Message', messageSchema);

