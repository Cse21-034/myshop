import Twilio from "twilio";

// Twilio setup
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;

if (!accountSid || !authToken) {
  throw new Error("Twilio environment variables are missing!");
}

const client = Twilio(accountSid, authToken);

// Exchange rate USD -> BWP
const USD_TO_BWP = 13.5;
const convertToBWP = (usdString: string) => {
  const usd = parseFloat(usdString);
  if (isNaN(usd)) return "P 0.00";
  const bwp = usd * USD_TO_BWP;
  return `P ${bwp.toLocaleString("en-BW", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export async function sendReservationStatusToCustomer(order: any, confirmed: boolean) {
  const from = process.env.TWILIO_WHATSAPP_FROM;
  if (!from || !order.phone) return;

  const customerPhone = order.phone.startsWith("+") ? order.phone : `+${order.phone}`;
  const depositBWP = order.depositAmount ? convertToBWP(order.depositAmount) : null;
  const remainingBWP = order.remainingBalance ? convertToBWP(order.remainingBalance) : null;

  const body = confirmed
    ? `✅ *Reservation Confirmed!*\n\nHi ${order.firstName}, your reservation (Order #${order.id}) has been confirmed by the farm.\n\n${depositBWP ? `Deposit paid: ${depositBWP}\nRemaining balance due on collection: ${remainingBWP}\n\n` : ""}Please contact the farm to arrange collection.\nThank you for shopping with Fountstream!`
    : `❌ *Reservation Cancelled*\n\nHi ${order.firstName}, unfortunately your reservation (Order #${order.id}) could not be confirmed by the farm.\n\nIf you paid a deposit, a refund will be processed shortly.\nSorry for the inconvenience — please contact us for more information.`;

  try {
    await client.messages.create({ from, to: `whatsapp:${customerPhone}`, body });
    console.log(`[Twilio] Reservation ${confirmed ? "confirmation" : "rejection"} sent to customer ${customerPhone}`);
  } catch (error) {
    console.error("[Twilio] Failed to send customer reservation notification:", error);
  }
}

export async function sendWhatsAppMessage(order: any) {
  const to = process.env.WHATSAPP_TO;
  const from = process.env.TWILIO_WHATSAPP_FROM;

  if (!to || !from) throw new Error("WhatsApp numbers are not configured!");

  // Prepare item list
  const itemsText = order.items?.map((i: any) => {
    const options = [
      i.size ? `Size: ${i.size}` : null,
      i.color ? `Color: ${i.color}` : null
    ].filter(Boolean).join(", ");

    const subtotalBWP = convertToBWP((parseFloat(i.productPrice) * i.quantity).toString());

    return `• ${i.productName} ${options ? `(${options})` : ""} x${i.quantity} = ${subtotalBWP}`;
  }).join("\n") ?? "N/A";

  // Message body
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
