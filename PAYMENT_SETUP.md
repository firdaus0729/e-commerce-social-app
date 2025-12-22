# Payment Gateway Integration Setup

This marketplace uses Stripe and PayPal for payments, with the platform acting as an intermediary. When a user pays, the money goes to the platform first, then a 5% platform fee is deducted, and the remainder is transferred to the seller's wallet.

## Architecture

- **Payment Flow**: User → Platform (Admin) → Seller Wallet
- **Platform Fee**: 5% of transaction amount
- **Seller Receives**: 95% of transaction amount (deposited to store wallet)

## Environment Variables

Add these to your `.env` file:

```env
# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# PayPal (optional - for PayPal integration)
PAYPAL_CLIENT_ID=your_paypal_client_id
PAYPAL_CLIENT_SECRET=your_paypal_client_secret
PAYPAL_MODE=sandbox  # or 'live' for production
```

## Stripe Setup

1. **Get API Keys**:
   - Sign up at https://stripe.com
   - Get your test keys from Dashboard → Developers → API keys
   - Add `STRIPE_SECRET_KEY` to `.env`

2. **Webhook Setup**:
   - In Stripe Dashboard → Developers → Webhooks
   - Add endpoint: `https://your-domain.com/payments/webhooks/stripe`
   - Select events: `payment_intent.succeeded`, `payment_intent.payment_failed`
   - Copy webhook signing secret to `STRIPE_WEBHOOK_SECRET`

3. **Testing**:
   - Use test card: `4242 4242 4242 4242`
   - Any future expiry date, any CVC
   - See https://stripe.com/docs/testing for more test cards

## PayPal Setup (Optional)

1. **Get API Credentials**:
   - Sign up at https://developer.paypal.com
   - Create an app in Dashboard
   - Get Client ID and Secret
   - Add to `.env`

2. **Install PayPal SDK** (if implementing full PayPal):
   ```bash
   npm install @paypal/checkout-server-sdk
   ```

## Payment Flow

### 1. Create Payment Intent

**Endpoint**: `POST /payments/checkout/create-intent`

**Request**:
```json
{
  "provider": "stripe" // or "paypal"
}
```

**Response**:
```json
{
  "orderId": "order_id",
  "clientSecret": "pi_xxx_secret_xxx", // For Stripe
  "paypalOrderId": "paypal_order_id", // For PayPal
  "approvalUrl": "https://paypal.com/...", // For PayPal
  "amount": 100.00,
  "currency": "USD"
}
```

### 2. Confirm Payment

**Endpoint**: `POST /payments/checkout/confirm`

**Request**:
```json
{
  "orderId": "order_id",
  "paymentIntentId": "pi_xxx" // or PayPal order ID
}
```

**Response**:
```json
{
  "success": true,
  "order": { ... },
  "payment": { ... }
}
```

## Frontend Integration

### Stripe (React Native)

Install Stripe SDK:
```bash
npm install @stripe/stripe-react-native
```

Example integration in `checkout.tsx`:
```typescript
import { useStripe } from '@stripe/stripe-react-native';

const { initPaymentSheet, presentPaymentSheet } = useStripe();

// After getting clientSecret
await initPaymentSheet({
  paymentIntentClientSecret: clientSecret,
});

const { error } = await presentPaymentSheet();
if (!error) {
  // Confirm payment
}
```

### PayPal (React Native)

Use WebView for PayPal approval:
```typescript
import { WebView } from 'react-native-webview';

// Open approvalUrl in WebView
// After approval, capture the order
```

## Database Models

### Payment Model
- Tracks all payments
- Links to Order, User, Store
- Stores platform fee and seller amount
- Tracks payment status

### Order Model
- Updated with `paymentProvider` and `paymentIntentId`
- Status: `pending` → `paid` → `processing` → `shipped` → `delivered`

### StoreStats Model
- `walletBalance`: Accumulated seller earnings (after platform fee)
- `totalRevenue`: Total revenue before fees
- `productsSold`: Count of products sold

## Webhook Security

- Stripe webhooks are verified using the signing secret
- PayPal webhooks should be verified using PayPal's webhook verification
- Always verify webhook signatures in production

## Testing

1. **Stripe Test Mode**:
   - Use test API keys
   - Use test cards from Stripe docs
   - Webhooks can be tested using Stripe CLI: `stripe listen --forward-to localhost:4000/payments/webhooks/stripe`

2. **PayPal Sandbox**:
   - Use sandbox credentials
   - Test with sandbox accounts
   - Use PayPal's test card numbers

## Production Checklist

- [ ] Replace test API keys with live keys
- [ ] Set `PAYPAL_MODE=live` for PayPal
- [ ] Configure production webhook URLs
- [ ] Enable webhook signature verification
- [ ] Set up proper error logging
- [ ] Implement retry logic for failed payments
- [ ] Set up monitoring/alerts for payment failures
- [ ] Test refund flow
- [ ] Document seller payout process

## Seller Payouts

Sellers can withdraw funds from their wallet balance. Implement a payout route:

```typescript
router.post('/stores/:id/payout', auth, async (req, res) => {
  // Transfer walletBalance to seller's bank account
  // Using Stripe Connect or PayPal Payouts
});
```

