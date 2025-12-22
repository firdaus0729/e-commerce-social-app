import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { env } from './config/env';
import authRoutes from './routes/auth';
import storeRoutes from './routes/stores';
import productRoutes from './routes/products';
import cartRoutes from './routes/cart';
import orderRoutes from './routes/orders';
import streamRoutes from './routes/streams';
import streamCommentRoutes from './routes/stream-comments';
import uploadRoutes from './routes/upload';
import paymentRoutes from './routes/payments';
import postRoutes from './routes/posts';
import userRoutes from './routes/users';
import messageRoutes from './routes/messages';
import adminRoutes from './routes/admin';
import { errorHandler } from './middleware/error';

export const createApp = () => {
  const app = express();
  // Allow dev origins; tighten in production
  app.use(cors()); // permissive for testing; restrict in production

  app.use(express.json({ limit: '1mb' }));
  app.use(morgan('dev'));

  app.get('/health', (_req, res) => res.json({ status: 'ok' }));
  app.use('/auth', authRoutes);
  app.use('/stores', storeRoutes);
  app.use('/products', productRoutes);
  app.use('/cart', cartRoutes);
  app.use('/orders', orderRoutes);
  app.use('/streams', streamRoutes);
  app.use('/stream-comments', streamCommentRoutes);
  app.use('/upload', uploadRoutes);
  app.use('/payments', paymentRoutes);
  app.use('/posts', postRoutes);
  app.use('/users', userRoutes);
  app.use('/messages', messageRoutes);
  app.use('/admin', adminRoutes);
  app.use('/uploads', express.static('uploads'));

  app.use(errorHandler);
  return app;
};

