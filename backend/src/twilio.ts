import Twilio from "twilio";

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;

if (!accountSid || !authToken) {
  throw new Error("Twilio environment variables are missing!");
}

const client = Twilio(accountSid, authToken);

export async function sendWhatsAppMessage(order: any) {
  const to = process.env.WHATSAPP_TO;
  const from = process.env.TWILIO_WHATSAPP_FROM;

  if (!to || !from) throw new Error("WhatsApp numbers are not configured!");

  const messageBody = `
📦 New Order Received!
Order ID: ${order.id}
Customer: ${order.userId ?? "Guest"}
Total: ${order.total}
Items: ${order.items?.map((i: any) => `${i.name} x${i.quantity}`).join(", ") ?? "N/A"}
`;

  try {
    await client.messages.create({
      from,
      to,
      body: messageBody,
    });
    console.log("WhatsApp message sent!");
  } catch (error) {
    console.error("Failed to send WhatsApp message:", error);
  }
}
