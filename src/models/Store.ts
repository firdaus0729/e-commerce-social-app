import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IStore extends Document {
  owner: mongoose.Types.ObjectId;
  name: string;
  slug: string;
  description?: string;
  logo?: string;
  banner?: string;
  payoutProvider?: 'stripe' | 'paypal';
  payoutAccountId?: string;
  paypalEmail?: string; // Seller's PayPal email for receiving payouts
  isActive: boolean;
}

const storeSchema = new Schema<IStore>(
  {
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    description: String,
    logo: String,
    banner: String,
    payoutProvider: { type: String, enum: ['stripe', 'paypal'] },
    payoutAccountId: String,
    paypalEmail: { type: String }, // Seller's PayPal email for receiving payouts
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const Store: Model<IStore> =
  mongoose.models.Store ?? mongoose.model<IStore>('Store', storeSchema);

