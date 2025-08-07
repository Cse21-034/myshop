// paypal-service.ts
import axios from 'axios';

const PAYPAL_BASE_URL = process.env.NODE_ENV === 'production' 
  ? 'https://api.paypal.com' 
  : 'https://api.sandbox.paypal.com';

const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET;

// Get PayPal access token
async function getPayPalAccessToken(): Promise<string> {
  try {
    const auth = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString('base64');
    
    const response = await axios.post(
      `${PAYPAL_BASE_URL}/v1/oauth2/token`,
      'grant_type=client_credentials',
      {
        headers: {
          'Authorization': `Basic ${auth}`,
          'Accept': 'application/json',
          'Accept-Language': 'en_US',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    return response.data.access_token;
  } catch (error) {
    console.error('Error getting PayPal access token:', error.response?.data || error.message);
    throw new Error('Failed to get PayPal access token');
  }
}

// Create PayPal order
export async function createPayPalOrder(amount: string, currency: string = 'USD'): Promise<string> {
  try {
    const accessToken = await getPayPalAccessToken();

    const orderData = {
      intent: 'CAPTURE',
      purchase_units: [
        {
          amount: {
            currency_code: currency,
            value: amount,
          },
        },
      ],
      application_context: {
        return_url: `${process.env.FRONTEND_URL}/order-confirmation`,
        cancel_url: `${process.env.FRONTEND_URL}/checkout`,
        shipping_preference: 'NO_SHIPPING', // We handle shipping separately
        user_action: 'PAY_NOW',
        brand_name: 'Fountstream', // Replace with your actual store name
      },
    };

    const response = await axios.post(
      `${PAYPAL_BASE_URL}/v2/checkout/orders`,
      orderData,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
          'PayPal-Request-Id': `order-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`, // Unique request ID
        },
      }
    );

    if (response.data.id) {
      console.log('PayPal order created successfully:', response.data.id);
      return response.data.id;
    } else {
      throw new Error('PayPal order creation failed - no order ID returned');
    }
  } catch (error) {
    console.error('Error creating PayPal order:', error.response?.data || error.message);
    
    if (error.response?.data?.details) {
      const details = error.response.data.details;
      const errorMessages = details.map((detail: any) => detail.description || detail.issue).join('; ');
      throw new Error(`PayPal order creation failed: ${errorMessages}`);
    }
    
    throw new Error('Failed to create PayPal order');
  }
}

// Capture PayPal order
export async function capturePayPalOrder(orderId: string): Promise<any> {
  try {
    const accessToken = await getPayPalAccessToken();

    const response = await axios.post(
      `${PAYPAL_BASE_URL}/v2/checkout/orders/${orderId}/capture`,
      {},
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
          'PayPal-Request-Id': `capture-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`, // Unique request ID
        },
      }
    );

    if (response.data.status === 'COMPLETED') {
      console.log('PayPal order captured successfully:', response.data.id);
      return {
        id: response.data.id,
        status: response.data.status,
        captureId: response.data.purchase_units?.[0]?.payments?.captures?.[0]?.id,
        amount: response.data.purchase_units?.[0]?.payments?.captures?.[0]?.amount,
      };
    } else {
      throw new Error(`PayPal capture failed with status: ${response.data.status}`);
    }
  } catch (error) {
    console.error('Error capturing PayPal order:', error.response?.data || error.message);
    
    if (error.response?.data?.details) {
      const details = error.response.data.details;
      const errorMessages = details.map((detail: any) => detail.description || detail.issue).join('; ');
      throw new Error(`PayPal capture failed: ${errorMessages}`);
    }
    
    throw new Error('Failed to capture PayPal order');
  }
}

// Get PayPal order details (optional - for verification)
export async function getPayPalOrderDetails(orderId: string): Promise<any> {
  try {
    const accessToken = await getPayPalAccessToken();

    const response = await axios.get(
      `${PAYPAL_BASE_URL}/v2/checkout/orders/${orderId}`,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    );

    return response.data;
  } catch (error) {
    console.error('Error getting PayPal order details:', error.response?.data || error.message);
    throw new Error('Failed to get PayPal order details');
  }
}
