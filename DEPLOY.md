# Deployment notes

Required environment variables (set these on your host or cloud provider):

- `NODE_ENV=production`
- `PORT` (optional, defaults to 4000)
- `MONGO_URI` (required in production) — full connection string for your MongoDB Atlas or managed DB
- `JWT_SECRET` — strong secret for signing JWTs
- `CLIENT_URL` — comma-separated allowed frontend origins (e.g. https://app.example.com)
- `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_MODE` (live or sandbox), `PAYPAL_ADMIN_EMAIL` (optional)
- Optional rate limiting overrides: `RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_MAX`

Quick deploy steps (example using plain Node on a server):

1. Install and build

```bash
npm ci
npm run build
```

2. Start (recommended to use a process manager like `pm2` or `systemd`)

```bash
NODE_ENV=production MONGO_URI="<your uri>" JWT_SECRET="<secret>" CLIENT_URL="https://your-frontend.example.com" npm start
```

Notes and recommendations:

- Ensure `MONGO_URI` uses TLS (mongodb+srv) when connecting to Atlas and that your network allows egress to MongoDB.
- When behind a reverse proxy / load balancer, the app now sets `trust proxy` so secure cookies and IP detection work correctly.
- Set `CLIENT_URL` so CORS only allows your deployed frontends. You can provide multiple origins separated by commas.
- Use environment-specific configuration in your hosting provider (Render, Vercel, Heroku, DigitalOcean App Platform, etc.).
- After deployment test `/health` endpoint and WebSocket connectivity from your frontend.
