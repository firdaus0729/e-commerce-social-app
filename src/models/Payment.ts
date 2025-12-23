import mongoose, { Schema, Document, Model } from 'mongoose';

export type PaymentProvider = 'stripe' | 'paypal' | 'bank';
export type PaymentStatus = 'pending' | 'processing' | 'succeeded' | 'failed' | 'refunded' | 'cancelled';

export interface IPayment extends Document {
  order: mongoose.Types.ObjectId;
  user: mongoose.Types.ObjectId;
  store: mongoose.Types.ObjectId;
  amount: number;
  currency: string;
  platformFee: number; // Admin's cut
  sellerAmount: number; // Amount going to seller wallet
  provider: PaymentProvider;
  providerPaymentId?: string | null; // Stripe payment intent ID, PayPal order ID, or null for manual providers
  status: PaymentStatus;
  metadata?: Record<string, any>;
}

const paymentSchema = new Schema<IPayment>(
  {
    order: { type: Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    store: { type: Schema.Types.ObjectId, ref: 'Store', required: true },
    amount: { type: Number, required: true },
    currency: { type: String, default: 'USD' },
    platformFee: { type: Number, required: true },
    sellerAmount: { type: Number, required: true },
    provider: { type: String, enum: ['stripe', 'paypal', 'bank'], required: true },
    providerPaymentId: { type: String, required: false, index: true },
    status: {
      type: String,
      enum: ['pending', 'processing', 'succeeded', 'failed', 'refunded', 'cancelled'],
      default: 'pending',
    },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

export const Payment: Model<IPayment> =
  mongoose.models.Payment ?? mongoose.model<IPayment>('Payment', paymentSchema);

