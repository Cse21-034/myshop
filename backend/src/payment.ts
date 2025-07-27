import Stripe from "stripe";
import paypal from "paypal-rest-sdk";
import axios from "axios";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-06-20",
});

paypal.configure({
  mode: process.env.NODE_ENV === "production" ? "live" : "sandbox",
  client_id: process.env.PAYPAL_CLIENT_ID!,
  client_secret: process.env.PAYPAL_CLIENT_SECRET!,
});

export async function createStripePaymentIntent(amount: number, currency: string): Promise<string> {
  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency,
      payment_method_types: ["card"],
    });
    return paymentIntent.client_secret!;
  } catch (error) {
    console.error("Stripe payment intent creation failed:", error);
    throw new Error("Failed to create Stripe payment intent");
  }
}

export async function createPayPalOrder(amount: number, currency: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const order = {
      intent: "CAPTURE",
      purchase_units: [
        {
          amount: {
            currency_code: currency,
            value: amount.toFixed(2),
          },
        },
      ],
      application_context: {
        return_url: "https://myshop-test-backend.onrender.com/api/payments/paypal/capture",
        cancel_url: "https://test-front-mocha.vercel.app/checkout",
      },
    };

    paypal.payment.create(order, (error, payment) => {
      if (error) {
        console.error("PayPal order creation failed:", error);
        reject(new Error("Failed to create PayPal order"));
      } else {
        resolve(payment.id!);
      }
    });
  });
}

export async function capturePayPalOrder(orderId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    paypal.payment.execute(orderId, {}, (error, payment) => {
      if (error) {
        console.error("PayPal order capture failed:", error);
        reject(new Error("Failed to capture PayPal order"));
      } else {
        resolve();
      }
    });
  });
}

export async function initiateOrangeMoneyPayment(phone: string, amount: number, currency: string): Promise<string> {
  try {
    // Placeholder: Replace with actual Orange Money API call
    const response = await axios.post(
      `${process.env.ORANGE_MONEY_API_URL}/payment`,
      {
        phone,
        amount,
        currency,
        merchant_key: process.env.ORANGE_MONEY_MERCHANT_KEY,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.ORANGE_MONEY_CLIENT_ID}:${process.env.ORANGE_MONEY_CLIENT_SECRET}`,
        },
      }
    );
    return response.data.transactionId; // Adjust based on actual API response
  } catch (error) {
    console.error("Orange Money payment initiation failed:", error);
    throw new Error("Failed to initiate Orange Money payment");
  }
}
