import mongoose, { Schema, Document, Model } from 'mongoose';

export type StoryMediaType = 'image' | 'video';

export interface IStory extends Document {
  user: mongoose.Types.ObjectId;
  mediaUrl: string;
  mediaType: StoryMediaType;
  caption?: string;
  views: mongoose.Types.ObjectId[];
  likes: mongoose.Types.ObjectId[];
  replies: mongoose.Types.ObjectId[]; // References to StoryReply
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const storySchema = new Schema<IStory>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    mediaUrl: { type: String, required: true },
    mediaType: { type: String, enum: ['image', 'video'], required: true },
    caption: { type: String },
    views: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    likes: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    replies: [{ type: Schema.Types.ObjectId, ref: 'StoryReply' }],
    expiresAt: { 
      type: Date, 
      required: true,
    },
  },
  { timestamps: true }
);

// Index for efficient queries
storySchema.index({ user: 1, createdAt: -1 });
storySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL index for auto-deletion

export const Story: Model<IStory> = mongoose.models.Story ?? mongoose.model<IStory>('Story', storySchema);

