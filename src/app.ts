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
import storyRoutes from './routes/stories';
import notificationRoutes from './routes/notifications';
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
  // Keep a small dev whitelist for local web testing. Native clients (APK/.ipa) typically
  // do not send an Origin header, and those requests are allowed below.
  const defaultLocalOrigins = ['http://localhost:19006', 'http://localhost:8081'];
  const allowedOrigins = Array.from(new Set([...defaultLocalOrigins]));

  // Allow all origins when explicitly requested via env var (useful for quick deploys)
  const allowAll = (process.env.ALLOW_ALL_ORIGINS || '').toLowerCase() === 'true';

  const corsOptions = {
    origin: (origin: string | undefined, cb: (err: Error | null, allow?: boolean) => void) => {
      // allow server-side or non-browser requests
      if (!origin) return cb(null, true);
      if (allowAll) return cb(null, true);
      if (allowedOrigins.includes(origin)) return cb(null, true);
      console.warn('[cors] Rejected origin:', origin, 'allowedOrigins=', allowedOrigins);
      return cb(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-access-token', 'Accept'],
    preflightContinue: false,
    optionsSuccessStatus: 204,
  } as any;

  app.use(cors(corsOptions));
  // Ensure preflight requests are handled
  app.options('*', cors(corsOptions));

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
  app.use('/stories', storyRoutes);
  app.use('/notifications', notificationRoutes);
  app.use('/uploads', express.static('uploads'));

  app.use(errorHandler);
  return app;
};

