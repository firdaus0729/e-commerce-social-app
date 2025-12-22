import mongoose, { Schema, Document, Model } from 'mongoose';

export type StreamStatus = 'scheduled' | 'live' | 'ended';

export interface IStream extends Document {
  store: mongoose.Types.ObjectId;
  title: string;
  status: StreamStatus;
  playbackUrl?: string;
  pinnedProduct?: mongoose.Types.ObjectId;
  startTime?: Date;
  roomId?: string; // MediaSoup room ID
  broadcasterId?: mongoose.Types.ObjectId; // User who is broadcasting
  viewerCount?: number;
  rtpCapabilities?: any; // MediaSoup RTP capabilities
}

const streamSchema = new Schema<IStream>(
  {
    store: { type: Schema.Types.ObjectId, ref: 'Store', required: true },
    title: { type: String, required: true },
    status: { type: String, enum: ['scheduled', 'live', 'ended'], default: 'scheduled' },
    playbackUrl: String,
    pinnedProduct: { type: Schema.Types.ObjectId, ref: 'Product' },
    startTime: Date,
    roomId: String,
    broadcasterId: { type: Schema.Types.ObjectId, ref: 'User' },
    viewerCount: { type: Number, default: 0 },
    rtpCapabilities: Schema.Types.Mixed,
  },
  { timestamps: true }
);

export const Stream: Model<IStream> =
  mongoose.models.Stream ?? mongoose.model<IStream>('Stream', streamSchema);

