import { Request, Response } from "express";
import paypal from "paypal-rest-sdk";
import axios, { AxiosResponse } from "axios";
import { z } from "zod";
import Stripe from "stripe";

const paypalPaymentSchema = z.object({
  amount: z.number().positive(),
  currency: z.string().min(3).max(3),
  description: z.string().optional(),
});

const orangeMoneyPaymentSchema = z.object({
  phone: z.string().regex(/^\+\d{10,}$/),
  amount: z.number().positive(),
  currency: z.string().min(3).max(3),
});

const stripePaymentSchema = z.object({
  amount: z.number().positive(),
  currency: z.string().min(3).max(3),
});

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-06-20",
});

export async function createStripePaymentIntent(amount: number, currency: string): Promise<string> {
  try {
    const validatedData = stripePaymentSchema.parse({ amount, currency });
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(validatedData.amount * 100), // Convert to cents
      currency: validatedData.currency,
      automatic_payment_methods: { enabled: true },
    });
    return paymentIntent.client_secret!;
  } catch (error: any) {
    console.error("Stripe payment intent creation failed:", error);
    throw new Error("Failed to create Stripe payment intent");
  }
}

export async function createPayPalOrder(amount: number, currency: string): Promise<string> {
  try {
    const validatedData = paypalPaymentSchema.parse({ amount, currency });
    paypal.configure({
      mode: process.env.PAYPAL_MODE || "sandbox",
      client_id: process.env.PAYPAL_CLIENT_ID!,
      client_secret: process.env.PAYPAL_CLIENT_SECRET!,
    });

    const createPaymentJson = {
      intent: "sale",
      payer: { payment_method: "paypal" },
      redirect_urls: {
        return_url: `${process.env.API_BASE}/payment/paypal/success`,
        cancel_url: `${process.env.API_BASE}/payment/paypal/cancel`,
      },
      transactions: [
        {
          amount: { total: validatedData.amount.toFixed(2), currency: validatedData.currency },
          description: "MyShop Purchase",
        },
      ],
    };

    return new Promise((resolve, reject) => {
      paypal.payment.create(createPaymentJson, (error: any, payment: any) => {
        if (error) {
          console.error("PayPal payment creation failed:", error);
          reject(new Error("Failed to create PayPal order"));
        } else {
          const approvalUrl = payment.links.find((link: any) => link.rel === "approval_url")?.href;
          if (approvalUrl) {
            resolve(payment.id); // Return order ID
          } else {
            reject(new Error("No approval URL found"));
          }
        }
      });
    });
  } catch (error: any) {
    console.error("PayPal order creation failed:", error);
    throw new Error("Failed to create PayPal order");
  }
}

export async function capturePayPalOrder(orderId: string): Promise<void> {
  try {
    return new Promise((resolve, reject) => {
      paypal.payment.execute(orderId, { payer_id: "payer_id" }, (error: any, payment: any) => {
        if (error) {
          console.error("PayPal order capture failed:", error);
          reject(new Error("Failed to capture PayPal order"));
        } else {
          resolve();
        }
      });
    });
  } catch (error: any) {
    console.error("PayPal order capture failed:", error);
    throw new Error("Failed to capture PayPal order");
  }
}

export async function initiatePaypalPayment(req: Request, res: Response) {
  try {
    const { amount, currency, description } = paypalPaymentSchema.parse(req.body);

    paypal.configure({
      mode: process.env.PAYPAL_MODE || "sandbox",
      client_id: process.env.PAYPAL_CLIENT_ID!,
      client_secret: process.env.PAYPAL_CLIENT_SECRET!,
    });

    const createPaymentJson = {
      intent: "sale",
      payer: { payment_method: "paypal" },
      redirect_urls: {
        return_url: `${process.env.API_BASE}/payment/paypal/success`,
        cancel_url: `${process.env.API_BASE}/payment/paypal/cancel`,
      },
      transactions: [
        {
          amount: { total: amount.toFixed(2), currency },
          description: description || "MyShop Purchase",
        },
      ],
    };

    paypal.payment.create(createPaymentJson, (error: any, payment: any) => {
      if (error) {
        console.error("PayPal payment creation failed:", error);
        return res.status(500).json({ error: "Failed to initiate PayPal payment" });
      }
      const approvalUrl = payment.links.find((link: any) => link.rel === "approval_url")?.href;
      if (approvalUrl) {
        res.json({ approvalUrl });
      } else {
        res.status(500).json({ error: "No approval URL found" });
      }
    });
  } catch (error: any) {
    console.error("PayPal payment validation failed:", error);
    res.status(400).json({ error: "Invalid payment data" });
  }
}

export async function initiateOrangeMoneyPayment(phone: string, amount: number, currency: string): Promise<string> {
  try {
    orangeMoneyPaymentSchema.parse({ phone, amount, currency });

    const response: AxiosResponse = await axios.post(
      `${process.env.ORANGE_MONEY_API_URL}/payment`,
      {
        phone,
        amount,
        currency,
        merchant_key: process.env.ORANGE_MONEY_MERCHANT_KEY,
      },
      {
        headers: {
          Authorization: `Bearer ${await getOrangeMoneyToken()}`,
        },
      }
    );
    return response.data.transactionId;
  } catch (error: any) {
    console.error("Orange Money payment initiation failed:", error);
    throw new Error("Failed to initiate Orange Money payment");
  }
}

async function getOrangeMoneyToken(): Promise<string> {
  try {
    const response: AxiosResponse = await axios.post(
      `${process.env.ORANGE_MONEY_API_URL}/token`,
      {
        client_id: process.env.ORANGE_MONEY_CLIENT_ID,
        client_secret: process.env.ORANGE_MONEY_CLIENT_SECRET,
        grant_type: "client_credentials",
      }
    );
    return response.data.access_token;
  } catch (error: any) {
    console.error("Orange Money token fetch failed:", error);
    throw new Error("Failed to fetch Orange Money token");
  }
}
