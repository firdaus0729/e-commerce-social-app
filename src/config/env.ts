import dotenv from 'dotenv';

dotenv.config();

const isProd = process.env.NODE_ENV === 'production';

if (isProd && !process.env.MONGO_URI) {
  throw new Error('MONGO_URI environment variable is required in production');
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 4000),
  // Prefer explicit env var for production; fall back to local Mongo for development
  // NOTE: in production `MONGO_URI` is required (see check above). Do NOT commit production credentials.
  mongoUri: process.env.MONGO_URI ?? 'mongodb://127.0.0.1:27017/live-shop',
  jwtSecret: process.env.JWT_SECRET ?? 'devsecret',
  // CORS allowed origins are handled inside app.ts with a small local-dev whitelist and
  // an optional ALLOW_ALL_ORIGINS toggle for quick testing.
  paypalClientId: process.env.PAYPAL_CLIENT_ID ?? '',
  paypalClientSecret: process.env.PAYPAL_CLIENT_SECRET ?? '',
  paypalMode: process.env.PAYPAL_MODE ?? 'sandbox', // 'sandbox' or 'live'
  paypalAdminEmail: process.env.PAYPAL_ADMIN_EMAIL ?? '',
  // Basic rate limit defaults
  rateLimitWindowMs: Number(process.env.RATE_LIMIT_WINDOW_MS ?? 1000 * 60 * 1),
  rateLimitMax: Number(process.env.RATE_LIMIT_MAX ?? 100),
  // Optional Cloudinary configuration - set these in your deploy environment to enable
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME ?? process.env.CLOUDINARY_CLOUDNAME ?? undefined,
    apiKey: process.env.CLOUDINARY_API_KEY ?? undefined,
    apiSecret: process.env.CLOUDINARY_API_SECRET ?? undefined,
    url: process.env.CLOUDINARY_URL ?? undefined,
  },
};

