import dotenv from 'dotenv';

dotenv.config();

const isProd = process.env.NODE_ENV === 'production';

if (isProd && !process.env.MONGO_URI) {
  throw new Error('MONGO_URI environment variable is required in production');
}

const clientUrlRaw = process.env.CLIENT_URL ?? 'http://localhost:8081';

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 4000),
  // Prefer explicit env var for production; fall back to local Mongo for development
  // NOTE: in production `MONGO_URI` is required (see check above). Do NOT commit production credentials.
  mongoUri: process.env.MONGO_URI ?? 'mongodb://127.0.0.1:27017/live-shop',
  jwtSecret: process.env.JWT_SECRET ?? 'devsecret',
  // Allow comma-separated client URLs in CLIENT_URL (e.g. https://app.example.com,https://admin.example.com)
  clientUrl: clientUrlRaw,
  allowedOrigins: clientUrlRaw.split(',').map((s) => s.trim()).filter(Boolean),
  paypalClientId: process.env.PAYPAL_CLIENT_ID ?? '',
  paypalClientSecret: process.env.PAYPAL_CLIENT_SECRET ?? '',
  paypalMode: process.env.PAYPAL_MODE ?? 'sandbox', // 'sandbox' or 'live'
  paypalAdminEmail: process.env.PAYPAL_ADMIN_EMAIL ?? '',
  // Basic rate limit defaults
  rateLimitWindowMs: Number(process.env.RATE_LIMIT_WINDOW_MS ?? 1000 * 60 * 1),
  rateLimitMax: Number(process.env.RATE_LIMIT_MAX ?? 100),
};

