import type { Twilio as TwilioClient } from "twilio";

// Lazy-initialise the Twilio client so the module never crashes on import
// when TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN are not set (e.g. dev env).
let _client: TwilioClient | null = null;
function getClient(): TwilioClient | null {
  if (_client) return _client;
  const sid   = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) {
    console.warn("[Twilio] TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN not set — WhatsApp disabled");
    return null;
  }
  // Dynamic require avoids TS evaluation of missing types at compile-time
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const Twilio = require("twilio");
  _client = new Twilio(sid, token) as TwilioClient;
  return _client;
}

const USD_TO_BWP = 13.5;
function convertToBWP(usdString: string): string {
  const usd = parseFloat(usdString);
  if (isNaN(usd)) return "P 0.00";
  const bwp = usd * USD_TO_BWP;
  return `P ${bwp.toLocaleString("en-BW", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export async function sendReservationStatusToCustomer(order: any, confirmed: boolean) {
  const client = getClient();
  const from   = process.env.TWILIO_WHATSAPP_FROM;
  if (!client || !from || !order.phone) return;

  const customerPhone = order.phone.startsWith("+") ? order.phone : `+${order.phone}`;
  const depositBWP    = order.depositAmount   ? convertToBWP(order.depositAmount)   : null;
  const remainingBWP  = order.remainingBalance ? convertToBWP(order.remainingBalance) : null;

  const body = confirmed
    ? `✅ *Reservation Confirmed!*\n\nHi ${order.firstName}, your reservation (Order #${order.id}) has been confirmed by the farm.\n\n${depositBWP ? `Deposit paid: ${depositBWP}\nRemaining balance due on collection: ${remainingBWP}\n\n` : ""}Please contact the farm to arrange collection.\nThank you for shopping with Fountstream!`
    : `❌ *Reservation Cancelled*\n\nHi ${order.firstName}, unfortunately your reservation (Order #${order.id}) could not be confirmed by the farm.\n\nIf you paid a deposit, a refund will be processed shortly.\nSorry for the inconvenience — please contact us for more information.`;

  try {
    await client.messages.create({ from, to: `whatsapp:${customerPhone}`, body });
    console.log(`[Twilio] Reservation ${confirmed ? "confirmation" : "rejection"} sent to ${customerPhone}`);
  } catch (error) {
    console.error("[Twilio] Failed to send reservation notification:", error);
  }
}

export async function sendWhatsAppMessage(order: any) {
  const client = getClient();
  const to     = process.env.WHATSAPP_TO;
  const from   = process.env.TWILIO_WHATSAPP_FROM;

  if (!client || !to || !from) {
    console.warn("[Twilio] WhatsApp not configured — skipping order notification");
    return;
  }

  const itemsText = order.items?.map((i: any) => {
    const options = [
      i.size  ? `Size: ${i.size}`  : null,
      i.color ? `Color: ${i.color}` : null,
    ].filter(Boolean).join(", ");
    const subtotalBWP = convertToBWP((parseFloat(i.productPrice) * i.quantity).toString());
    return `• ${i.productName} ${options ? `(${options})` : ""} x${i.quantity} = ${subtotalBWP}`;
  }).join("\n") ?? "N/A";

  const messageBody = `
📦 New Order Received!
Order ID: ${order.id}
Date: ${new Date(order.createdAt).toLocaleString()}
Customer: ${order.firstName} ${order.lastName} (${order.userId ?? "Guest"})
Email: ${order.email}
Phone: ${order.phone}
Address: ${order.address}, ${order.city}, ${order.state}, ${order.zipCode}

Items:
${itemsText}

Subtotal: ${convertToBWP(order.subtotal)}
Shipping: ${convertToBWP(order.shipping)}
Tax: ${convertToBWP(order.tax)}
💰 Total: ${convertToBWP(order.total)}

Payment Method: ${order.paymentMethod}
Status: ${order.status}
`.trim();

  try {
    await client.messages.create({ from, to, body: messageBody });
    console.log("[Twilio] WhatsApp order notification sent");
  } catch (error) {
    console.error("[Twilio] Failed to send WhatsApp message:", error);
  }
}
