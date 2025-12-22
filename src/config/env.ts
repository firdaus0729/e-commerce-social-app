import dotenv from 'dotenv';

dotenv.config();

export const env = {
  port: Number(process.env.PORT ?? 4000),
  mongoUri: process.env.MONGO_URI ?? 'mongodb+srv://firdausjulkifli0729_db_user:BCT0fbq0p5SGfCtb@live-shop.3l2ytrw.mongodb.net/live-shop',
  jwtSecret: process.env.JWT_SECRET ?? 'devsecret',
  clientUrl: process.env.CLIENT_URL ?? 'http://localhost:8081',
  paypalClientId: process.env.PAYPAL_CLIENT_ID ?? '',
  paypalClientSecret: process.env.PAYPAL_CLIENT_SECRET ?? '',
  paypalMode: process.env.PAYPAL_MODE ?? 'sandbox', // 'sandbox' or 'live'
  paypalAdminEmail: process.env.PAYPAL_ADMIN_EMAIL ?? '',
};

