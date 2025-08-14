// src/lib/twilio.ts
import Twilio from "twilio";

const client = Twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

export async function sendWhatsAppMessage(order: any) {
  const to = process.env.WHATSAPP_TO;

  const messageBody = `
📦 New Order Received!
Order ID: ${order.id}
Customer: ${order.userId ?? "Guest"}
Total: ${order.total}
Items: ${order.items?.map((i: any) => `${i.name} x${i.quantity}`).join(", ") ?? "N/A"}
`;

  try {
    await client.messages.create({
      from: process.env.TWILIO_WHATSAPP_FROM,
      to,
      body: messageBody,
    });
    console.log("WhatsApp message sent!");
  } catch (error) {
    console.error("Failed to send WhatsApp message:", error);
  }
}
