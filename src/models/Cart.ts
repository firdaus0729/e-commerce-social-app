import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ICartItem {
  product: mongoose.Types.ObjectId;
  quantity: number;
  reservedAt?: Date;
}

export interface ICart extends Document {
  user?: mongoose.Types.ObjectId;
  sessionId?: string;
  items: ICartItem[];
  currency: string;
}

const cartItemSchema = new Schema<ICartItem>(
  {
    product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    quantity: { type: Number, required: true, min: 1 },
    reservedAt: { type: Date },
  },
  { _id: false }
);

const cartSchema = new Schema<ICart>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User' },
    sessionId: { type: String, index: true },
    items: [cartItemSchema],
    currency: { type: String, default: 'USD' },
  },
  { timestamps: true }
);

cartSchema.index({ user: 1, sessionId: 1 });

export const Cart: Model<ICart> = mongoose.models.Cart ?? mongoose.model<ICart>('Cart', cartSchema);

