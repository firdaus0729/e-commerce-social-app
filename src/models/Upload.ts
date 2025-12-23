import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IUpload extends Document {
  url: string;
  filename: string;
  size: number;
  mimeType?: string;
  publicId?: string;
  uploader?: mongoose.Types.ObjectId;
}

const uploadSchema = new Schema<IUpload>(
  {
    url: { type: String, required: true },
    filename: { type: String, required: true },
    size: { type: Number, required: true },
    mimeType: { type: String },
    publicId: { type: String },
    uploader: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

export const Upload: Model<IUpload> = mongoose.models.Upload ?? mongoose.model<IUpload>('Upload', uploadSchema);
