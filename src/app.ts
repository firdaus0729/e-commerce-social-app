import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
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
  // Security middleware
  app.use(helmet());

  // Respect proxy headers (for correct secure cookies and IPs) when deployed behind a proxy
  if (env.nodeEnv === 'production') {
    app.set('trust proxy', 1);
  }

  // Configure CORS to allow only known origins and support credentials
  const defaultLocalOrigins = ['http://localhost:19006', 'http://localhost:8081'];
  const allowedOrigins = Array.from(new Set([...(env.allowedOrigins || []), ...defaultLocalOrigins]));
  const corsOptions = {
    origin: (origin: string | undefined, cb: (err: Error | null, allow?: boolean) => void) => {
      if (!origin) return cb(null, true); // allow non-browser requests like mobile or server-to-server
      if (allowedOrigins.includes(origin)) return cb(null, true);
      return cb(new Error('Not allowed by CORS'));
    },
    credentials: true,
  };

  app.use(cors(corsOptions));

  app.use(express.json({ limit: '2mb' }));
  app.use(morgan(env.nodeEnv === 'production' ? 'combined' : 'dev'));

  // Basic rate limiting
  const limiter = rateLimit({ windowMs: env.rateLimitWindowMs, max: env.rateLimitMax });
  app.use(limiter);

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

