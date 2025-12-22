import mongoose, { Schema, Document, Model } from 'mongoose';

export type UserRole = 'user' | 'seller' | 'admin';

export interface IUser extends Document {
  email: string;
  password: string;
  name: string;
  role: UserRole;
  store?: mongoose.Types.ObjectId;
  profilePhoto?: string;
  bio?: string;
  paypalEmail?: string; // Buyer's PayPal email for payments
  followers: mongoose.Types.ObjectId[];
  following: mongoose.Types.ObjectId[];
}

const userSchema = new Schema<IUser>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, index: true },
    password: { type: String, required: true },
    name: { type: String, required: true },
    role: { type: String, enum: ['user', 'seller', 'admin'], default: 'user' },
    store: { type: Schema.Types.ObjectId, ref: 'Store' },
    profilePhoto: { type: String },
    bio: { type: String },
    paypalEmail: { 
      type: String,
      validate: {
        validator: function(v: string) {
          return !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
        },
        message: 'Invalid PayPal email format'
      }
    },
    followers: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    following: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  },
  { timestamps: true }
);

export const User: Model<IUser> = mongoose.models.User ?? mongoose.model<IUser>('User', userSchema);

