import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IProduct extends Document {
  store: mongoose.Types.ObjectId;
  title: string;
  description?: string;
  price: number;
  compareAtPrice?: number;
  currency: string;
  images: string[];
  stock: number;
  tags: string[];
  isPublished: boolean;
  visits: number;
  commentsCount: number;
  likes: number;
  dislikes: number;
  averageRating: number;
  reviewCount: number;
}

const productSchema = new Schema<IProduct>(
  {
    store: { type: Schema.Types.ObjectId, ref: 'Store', required: true, index: true },
    title: { type: String, required: true },
    description: String,
    price: { type: Number, required: true },
    compareAtPrice: Number,
    currency: { type: String, default: 'USD' },
    images: [{ type: String }],
    stock: { type: Number, default: 0 },
    tags: [{ type: String }],
    isPublished: { type: Boolean, default: false },
    visits: { type: Number, default: 0 },
    commentsCount: { type: Number, default: 0 },
    likes: { type: Number, default: 0 },
    dislikes: { type: Number, default: 0 },
    averageRating: { type: Number, default: 0 },
    reviewCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export const Product: Model<IProduct> =
  mongoose.models.Product ?? mongoose.model<IProduct>('Product', productSchema);

