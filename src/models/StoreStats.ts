import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IStoreStats extends Document {
  store: mongoose.Types.ObjectId;
  productsSold: number;
  walletBalance: number;
  totalRevenue: number;
}

const storeStatsSchema = new Schema<IStoreStats>(
  {
    store: { type: Schema.Types.ObjectId, ref: 'Store', required: true, unique: true, index: true },
    productsSold: { type: Number, default: 0 },
    walletBalance: { type: Number, default: 0 },
    totalRevenue: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export const StoreStats: Model<IStoreStats> =
  mongoose.models.StoreStats ?? mongoose.model<IStoreStats>('StoreStats', storeStatsSchema);

