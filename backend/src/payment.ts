import { Request, Response } from "express";
import paypal from "paypal-rest-sdk";
import axios, { AxiosResponse } from "axios";
import { z } from "zod";

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
        console.error("❌ PayPal payment creation failed:", error);
        return res.status(500).json({ error: "Failed to initiate PayPal payment" });
      }
      const approvalUrl = payment.links.find((link: any) => link.rel === "approval_url")?.href;
      if (approvalUrl) {
        res.json({ approvalUrl });
      } else {
        res.status(500).json({ error: "No approval URL found" });
      }
    });
  } catch (error) {
    console.error("❌ PayPal payment validation failed:", error);
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
