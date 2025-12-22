import mongoose from 'mongoose';
import { env } from './config/env';

export const connectDb = async () => {
  try {
    await mongoose.connect(env.mongoUri, {
      // Recommended options
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 10000,
    } as any);
    console.log('MongoDB connected');
  } catch (err) {
    console.error('MongoDB connection error', err);
    process.exit(1);
  }
};

