import { createServer } from 'http';
import { createApp } from './app';
import { connectDb } from './db';
import { env } from './config/env';
import { setupWebSocket } from './websocket';
import { releaseExpiredReservations } from './services/cart-reservations';

const start = async () => {
  await connectDb();
  
  const app = createApp();
  const httpServer = createServer(app);
  
  // Setup WebSocket for WebRTC signaling
  setupWebSocket(httpServer);
  
  httpServer.listen(env.port, () => {
    console.log(`API listening on http://localhost:${env.port}`);
    console.log(`WebSocket server ready for WebRTC signaling`);
  });

  // Periodically release expired cart reservations (every 5 minutes)
  setInterval(() => {
    releaseExpiredReservations().catch((err) => console.error('Reservation cleanup error', err));
  }, 1000 * 60 * 5);
};

start();

