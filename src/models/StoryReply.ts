import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IStoryReply extends Document {
  story: mongoose.Types.ObjectId;
  user: mongoose.Types.ObjectId;
  text: string;
  createdAt: Date;
  updatedAt: Date;
}

const storyReplySchema = new Schema<IStoryReply>(
  {
    story: { type: Schema.Types.ObjectId, ref: 'Story', required: true, index: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    text: { type: String, required: true },
  },
  { timestamps: true }
);

// Index for efficient queries
storyReplySchema.index({ story: 1, createdAt: -1 });

export const StoryReply: Model<IStoryReply> = mongoose.models.StoryReply ?? mongoose.model<IStoryReply>('StoryReply', storyReplySchema);

