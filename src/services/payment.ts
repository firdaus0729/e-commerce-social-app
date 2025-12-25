import { env } from '../config/env';
import checkoutNodeJssdk from '@paypal/checkout-server-sdk';

const PLATFORM_FEE_PERCENT = 5; // 5% platform fee

// PayPal SDK Client for Orders API
function paypalClient() {
  const clientId = env.paypalClientId;
  const clientSecret = env.paypalClientSecret;

  if (!clientId || !clientSecret) {
    throw new Error('PayPal credentials not configured');
  }

  const environment =
    env.paypalMode === 'live'
      ? new checkoutNodeJssdk.core.LiveEnvironment(clientId, clientSecret)
      : new checkoutNodeJssdk.core.SandboxEnvironment(clientId, clientSecret);

  return new checkoutNodeJssdk.core.PayPalHttpClient(environment);
}

// Get PayPal Access Token for REST API calls (used for Payouts API)
async function getPayPalAccessToken(): Promise<string> {
  const clientId = env.paypalClientId;
  const clientSecret = env.paypalClientSecret;

  if (!clientId || !clientSecret) {
    throw new Error('PayPal credentials not configured');
  }

  const baseUrl = env.paypalMode === 'live' 
    ? 'https://api.paypal.com' 
    : 'https://api.sandbox.paypal.com';

  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const response = await fetch(`${baseUrl}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to get PayPal access token: ${errorText}`);
  }

  const data = await response.json();
  return data.access_token;
}

export function calculatePlatformFee(amount: number): { platformFee: number; sellerAmount: number } {
  const platformFee = Math.round((amount * PLATFORM_FEE_PERCENT) / 100 * 100) / 100;
  const sellerAmount = Math.round((amount - platformFee) * 100) / 100;
  return { platformFee, sellerAmount };
}

/**
 * Create a PayPal Order with split payment (direct to seller, platform fee)
 * Money goes directly to seller's PayPal, platform fee goes to admin
 */
export async function createPayPalOrder(
  amount: number,
  currency: string,
  sellerPaypalEmail: string, // Seller's PayPal email - receives payment directly
  metadata: Record<string, string>
): Promise<{ id: string; approvalUrl: string }> {
  try {
    if (!sellerPaypalEmail || !sellerPaypalEmail.includes('@')) {
      throw new Error('Seller PayPal email is required for direct payment');
    }

    const { platformFee } = calculatePlatformFee(amount);
    const client = paypalClient();
    const request = new checkoutNodeJssdk.orders.OrdersCreateRequest();
    request.headers['prefer'] = 'return=representation';
    
    // Use split payment: seller receives directly, platform fee goes to admin
    request.requestBody({
      intent: 'CAPTURE',
      purchase_units: [
        {
          amount: {
            currency_code: currency,
            value: amount.toFixed(2),
          },
          payee: {
            email_address: sellerPaypalEmail, // Seller receives payment directly
          },
          payment_instruction: {
            platform_fees: [
              {
                amount: {
                  currency_code: currency,
                  value: platformFee.toFixed(2),
                },
                payee: {
                  email_address: env.paypalAdminEmail, // Platform fee goes to admin
                },
              },
            ],
          },
          description: `Order ${metadata.orderId}`,
          custom_id: metadata.orderId,
        },
      ],
      application_context: {
        brand_name: 'Live Shop',
        landing_page: 'NO_PREFERENCE',
        user_action: 'PAY_NOW',
        // If CLIENT_URL is not provided, fall back to EXPO_PUBLIC_API_URL or API_URL.
        // Native apps (APK/IPA) typically complete payments in-app; these URLs are used for web flows.
        return_url: `${process.env.CLIENT_URL ?? process.env.EXPO_PUBLIC_API_URL ?? process.env.API_URL ?? 'https://e-commerce-social-app.onrender.com'}/checkout/success`,
        cancel_url: `${process.env.CLIENT_URL ?? process.env.EXPO_PUBLIC_API_URL ?? process.env.API_URL ?? 'https://e-commerce-social-app.onrender.com'}/checkout/cancel`,
      },
    });

    const response = await client.execute(request);
    const order = response.result;

    if (order.status === 'CREATED' && order.links) {
      const approvalLink = order.links.find((link: any) => link.rel === 'approve');
      if (approvalLink) {
        return {
          id: order.id!,
          approvalUrl: approvalLink.href,
        };
      }
    }

    throw new Error('Failed to create PayPal order: No approval URL found');
  } catch (error: any) {
    console.error('PayPal Order Creation Error:', error);
    
    // Provide user-friendly error messages
    if (error.message?.includes('INVALID_REQUEST')) {
      throw new Error('Invalid payment request. Please check seller PayPal configuration.');
    }
    if (error.message?.includes('PAYEE_NOT_VERIFIED')) {
      throw new Error('Seller PayPal account is not verified. Please contact seller.');
    }
    
    throw new Error(`PayPal order creation failed: ${error.message || 'Unknown error'}`);
  }
}

/**
 * Capture a PayPal Order (complete the payment)
 */
export async function capturePayPalOrder(orderId: string): Promise<{ status: string; id: string; captureId?: string }> {
  try {
    const client = paypalClient();
    const request = new checkoutNodeJssdk.orders.OrdersCaptureRequest(orderId);
    request.requestBody({});

    const response = await client.execute(request);
    const order = response.result;

    if (order.status === 'COMPLETED' && order.purchase_units && order.purchase_units.length > 0) {
      const capture = order.purchase_units[0].payments?.captures?.[0];
      return {
        status: 'COMPLETED',
        id: order.id!,
        captureId: capture?.id,
      };
    }

    return {
      status: order.status || 'UNKNOWN',
      id: order.id!,
    };
  } catch (error: any) {
    console.error('PayPal Capture Error:', error);
    throw new Error(`PayPal capture failed: ${error.message || 'Unknown error'}`);
  }
}

/**
 * Send PayPal Payout to seller (95% of order amount)
 */
export async function sendPayPalPayout(
  sellerEmail: string,
  amount: number,
  currency: string,
  note: string
): Promise<{ payoutId: string; status: string }> {
  try {
    if (!sellerEmail || !sellerEmail.includes('@')) {
      throw new Error('Invalid seller PayPal email');
    }

    const accessToken = await getPayPalAccessToken();
    const baseUrl = env.paypalMode === 'live' 
      ? 'https://api.paypal.com' 
      : 'https://api.sandbox.paypal.com';

    const payoutData = {
      sender_batch_header: {
        sender_batch_id: `payout_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        email_subject: 'Payment from Live Shop',
        email_message: `You received a payment of ${currency} ${amount.toFixed(2)} from Live Shop.`,
      },
      items: [
        {
          recipient_type: 'EMAIL',
          amount: {
            value: amount.toFixed(2),
            currency: currency,
          },
          receiver: sellerEmail,
          note: note,
          sender_item_id: `seller_payout_${Date.now()}`,
        },
      ],
    };

    const response = await fetch(`${baseUrl}/v1/payments/payouts`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payoutData),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('PayPal Payout API Error:', errorText);
      throw new Error(`PayPal payout failed: ${errorText}`);
    }

    const payout = await response.json();

    if (payout.batch_header) {
      return {
        payoutId: payout.batch_header.payout_batch_id!,
        status: payout.batch_header.batch_status || 'PENDING',
      };
    }

    throw new Error('Failed to create PayPal payout: Invalid response');
  } catch (error: any) {
    console.error('PayPal Payout Error:', error);
    throw new Error(`PayPal payout failed: ${error.message || 'Unknown error'}`);
  }
}

/**
 * Send platform fee (5%) to admin PayPal account
 */
export async function sendAdminFee(
  amount: number,
  currency: string,
  orderId: string
): Promise<{ payoutId: string; status: string }> {
  try {
    const adminEmail = env.paypalAdminEmail;
    if (!adminEmail || !adminEmail.includes('@')) {
      throw new Error('Admin PayPal email not configured');
    }

    return await sendPayPalPayout(
      adminEmail,
      amount,
      currency,
      `Platform fee (5%) for order ${orderId}`
    );
  } catch (error: any) {
    console.error('Admin Fee Payout Error:', error);
    throw new Error(`Admin fee payout failed: ${error.message || 'Unknown error'}`);
  }
}

/**
 * Get payout status
 */
export async function getPayoutStatus(payoutBatchId: string): Promise<{ status: string; items: any[] }> {
  try {
    const accessToken = await getPayPalAccessToken();
    const baseUrl = env.paypalMode === 'live' 
      ? 'https://api.paypal.com' 
      : 'https://api.sandbox.paypal.com';

    const response = await fetch(`${baseUrl}/v1/payments/payouts/${payoutBatchId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to get payout status: ${errorText}`);
    }

    const payout = await response.json();

    return {
      status: payout.batch_header?.batch_status || 'UNKNOWN',
      items: payout.items || [],
    };
  } catch (error: any) {
    console.error('PayPal Payout Status Error:', error);
    throw new Error(`Failed to get payout status: ${error.message || 'Unknown error'}`);
  }
}
