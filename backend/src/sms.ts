import crypto from "crypto";

const LINKSMS_API_URL =
  process.env.LINKSMS_API_URL ||
  "https://apiv2client.linksms.co.bw/v1/api/developers/send-sms";

export function generateOtp(): string {
  return String(crypto.randomInt(100_000, 1_000_000));
}

// Normalise any BW number to 8-digit local form
// +26771234567 / 071234567 / 26771234567 → 71234567
export function toLocalBW(phone: string): string {
  const d = phone.replace(/\D/g, "");
  if (d.startsWith("00267")) return d.slice(5);
  if (d.startsWith("267")) return d.slice(3);
  if (d.startsWith("0")) return d.slice(1);
  return d;
}

export async function sendSms(to: string, message: string): Promise<void> {
  const apiKey = process.env.LINKSMS_API_KEY;
  const senderId = (process.env.LINKSMS_SENDER_ID || "Myshop").slice(0, 11);
  const localNum = toLocalBW(to);

  if (!apiKey) {
    // Dev fallback — never crashes
    console.log(`[SMS dev-mode] To: ${localNum} | ${message}`);
    return;
  }

  const res = await fetch(LINKSMS_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sender_id: senderId,
      country_code: "267",
      phone_numbers: [localNum],
      message,
      api_key: apiKey,
    }),
  });

  const raw = await res.text();
  let data: any = {};
  try {
    data = JSON.parse(raw);
  } catch {}

  if (!res.ok || data.success === false) {
    throw new Error(`LinkSMS error (${res.status}): ${data.message || raw}`);
  }
}

// Fire-and-forget — never throws; use for notifications, not OTP
export async function sendSmsQuiet(to: string, message: string): Promise<void> {
  try {
    await sendSms(to, message);
  } catch (e: any) {
    console.error("[SMS] Failed:", e.message);
  }
}

// OTP — let it throw so callers can report failures
export async function sendOtpSms(phone: string, code: string): Promise<void> {
  await sendSms(
    phone,
    `Fountstream verification code: ${code}. Valid for 10 minutes. Do not share this code.`
  );
}

// ── Per-event templates (≤160 chars, ASCII) ───────────────────────────────────
const SITE = (process.env.FRONTEND_URL || "https://myshop-test.vercel.app").replace(/\/$/, "");

export const smsTemplates = {
  welcome: (name: string) =>
    `Fountstream: Welcome ${name}! Your account is ready. ${SITE}`,

  orderPlaced: (orderId: number, total: string) =>
    `Fountstream: Order #${orderId} (P${total}) placed. Track at ${SITE}/orders`,

  orderShipped: (orderId: number, tracking?: string) =>
    `Fountstream: Order #${orderId} shipped${tracking ? ` — tracking: ${tracking}` : ""}. ${SITE}/track-order`,

  orderDelivered: (orderId: number) =>
    `Fountstream: Order #${orderId} delivered! Rate at ${SITE}/orders`,

  paymentReceived: (orderId: number, amount: string) =>
    `Fountstream: Payment P${amount} received for order #${orderId}. ${SITE}`,

  paymentFailed: (orderId: number) =>
    `Fountstream: Payment for order #${orderId} failed. Retry at ${SITE}/orders`,

  sellerNewOrder: (orderId: number, amount: string) =>
    `Fountstream: New order #${orderId} worth P${amount}! ${SITE}/seller/orders`,
};
