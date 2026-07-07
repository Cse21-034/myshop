/**
 * Email service — primary: Resend; fallback: Gmail (nodemailer).
 * Resend "from" addresses must come from a verified domain.
 * Categories map to different senders so they land in the right inbox tab.
 */

import nodemailer from "nodemailer";

// ── Resend category senders ───────────────────────────────────────────────────
// Override via env vars if your Resend domain differs.
const DOMAIN = process.env.RESEND_DOMAIN || "fountstream.com";
const SENDERS = {
  registration: process.env.RESEND_FROM_REGISTRATION || `Fountstream <no-reply@${DOMAIN}>`,
  order:        process.env.RESEND_FROM_ORDER        || `Fountstream Orders <orders@${DOMAIN}>`,
  support:      process.env.RESEND_FROM_SUPPORT      || `Fountstream Support <support@${DOMAIN}>`,
  billing:      process.env.RESEND_FROM_BILLING      || `Fountstream Billing <billing@${DOMAIN}>`,
  info:         process.env.RESEND_FROM_INFO         || `Fountstream <info@${DOMAIN}>`,
};

type SenderCategory = keyof typeof SENDERS;

// ── helpers ───────────────────────────────────────────────────────────────────

function htmlToText(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function gmailTransport() {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) return null;
  return nodemailer.createTransport({ service: "gmail", auth: { user, pass } });
}

async function sendViaResend(
  to: string,
  subject: string,
  html: string,
  category: SenderCategory = "info",
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY not set");

  const { Resend } = await import("resend");
  const resend = new Resend(apiKey);

  const from = SENDERS[category];
  const text = htmlToText(html);

  const { error } = await resend.emails.send({ from, to, subject, html, text });
  if (error) throw new Error(`Resend error: ${error.message}`);
}

// ── public API ────────────────────────────────────────────────────────────────

/**
 * Send an email. Tries Resend first; falls back to Gmail if Resend key is missing.
 * Gracefully logs a warning (never throws) when neither provider is configured.
 */
export async function sendEmail(
  to: string,
  subject: string,
  html: string,
  category: SenderCategory = "info",
): Promise<void> {
  // Try Resend first
  if (process.env.RESEND_API_KEY) {
    try {
      await sendViaResend(to, subject, html, category);
      console.log(`[Email] Sent via Resend (${category}) to ${to}`);
      return;
    } catch (err: any) {
      console.warn("[Email] Resend failed, trying Gmail:", err.message);
    }
  }

  // Fall back to Gmail
  const gmail = gmailTransport();
  if (gmail) {
    try {
      await gmail.sendMail({
        from: `Fountstream <${process.env.GMAIL_USER}>`,
        to,
        subject,
        html,
        text: htmlToText(html),
      });
      console.log(`[Email] Sent via Gmail to ${to}`);
      return;
    } catch (err: any) {
      console.error("[Email] Gmail also failed:", err.message);
    }
  }

  console.warn(`[Email] No provider configured — email to ${to} NOT sent (subject: ${subject})`);
}

// ── Convenience wrappers by category ─────────────────────────────────────────

export function sendOrderEmail(to: string, subject: string, html: string) {
  return sendEmail(to, subject, html, "order");
}

export function sendRegistrationEmail(to: string, subject: string, html: string) {
  return sendEmail(to, subject, html, "registration");
}

export function sendSupportEmail(to: string, subject: string, html: string) {
  return sendEmail(to, subject, html, "support");
}

// ── Templates ─────────────────────────────────────────────────────────────────

const USD_TO_BWP = 13.5;
function fmtBWP(usd: string | number): string {
  const n = typeof usd === "string" ? parseFloat(usd) : usd;
  return `P ${(n * USD_TO_BWP).toLocaleString("en-BW", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function orderConfirmationTemplate(order: {
  id: number;
  firstName: string;
  total: string;
  paymentMethod: string;
  address: string;
  city: string;
  depositAmount?: string | null;
  remainingBalance?: string | null;
  items: { productName: string; quantity: number; productPrice: string }[];
}): string {
  const itemRows = order.items
    .map(
      (item) =>
        `<tr>
          <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;font-size:14px">${item.productName}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;text-align:center;font-size:14px">${item.quantity}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;text-align:right;font-size:14px">${fmtBWP(parseFloat(item.productPrice) * item.quantity)}</td>
        </tr>`
    )
    .join("");

  const isDeposit = !!(order.depositAmount && parseFloat(order.depositAmount) > 0);
  const amountSection = isDeposit
    ? `<p style="margin:4px 0;color:#888;text-decoration:line-through;font-size:13px">Full total: ${fmtBWP(order.total)}</p>
       <p style="margin:4px 0;font-size:18px;font-weight:700;color:#b45309">Deposit paid: ${fmtBWP(order.depositAmount!)}</p>
       <p style="margin:4px 0;color:#888;font-size:13px">Due on collection: ${fmtBWP(order.remainingBalance ?? "0")}</p>`
    : `<p style="margin:4px 0;font-size:18px;font-weight:700;color:#1a4731">Total: ${fmtBWP(order.total)}</p>`;

  const paymentLabel =
    order.paymentMethod === "cash"
      ? "Cash on Delivery"
      : order.paymentMethod.charAt(0).toUpperCase() + order.paymentMethod.slice(1);

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:sans-serif;background:#f5f5f5;margin:0;padding:24px">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08)">
    <div style="background:#1a4731;padding:28px 32px;text-align:center">
      <h1 style="color:#fff;margin:0;font-size:24px;font-weight:700">Fountstream</h1>
      <p style="color:#86efac;margin:8px 0 0;font-size:14px">Order Confirmed ✓</p>
    </div>
    <div style="padding:32px">
      <h2 style="color:#111;margin:0 0 8px;font-size:20px">Thank you, ${order.firstName}!</h2>
      <p style="color:#555;margin:0 0 20px;line-height:1.6">Your order has been placed successfully. Here's your summary:</p>
      <div style="background:#f0faf4;border-radius:8px;padding:16px;margin-bottom:20px;border-left:4px solid #1a4731">
        <p style="margin:0 0 4px;font-size:12px;color:#888;text-transform:uppercase;letter-spacing:1px">Order Number</p>
        <p style="margin:0;font-size:22px;font-weight:700;color:#1a4731">#${order.id}</p>
      </div>
      <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
        <thead>
          <tr style="background:#f9fafb">
            <th style="padding:8px 12px;text-align:left;font-size:11px;color:#888;font-weight:600;text-transform:uppercase">Product</th>
            <th style="padding:8px 12px;text-align:center;font-size:11px;color:#888;font-weight:600;text-transform:uppercase">Qty</th>
            <th style="padding:8px 12px;text-align:right;font-size:11px;color:#888;font-weight:600;text-transform:uppercase">Subtotal</th>
          </tr>
        </thead>
        <tbody>${itemRows}</tbody>
      </table>
      <div style="text-align:right;border-top:2px solid #f0f0f0;padding-top:16px;margin-bottom:24px">${amountSection}</div>
      <div style="font-size:13px;color:#555;line-height:2;background:#f9fafb;border-radius:8px;padding:16px">
        <div><strong style="color:#111">Delivery to:</strong> ${order.address}, ${order.city}</div>
        <div><strong style="color:#111">Payment:</strong> ${paymentLabel}</div>
        ${order.paymentMethod === "cash" ? `<div style="color:#b45309;font-size:12px;margin-top:4px">⚠ Cash payment due on delivery.</div>` : ""}
      </div>
    </div>
    <div style="background:#f9f9f9;padding:16px 32px;text-align:center">
      <p style="color:#aaa;font-size:12px;margin:0">© ${new Date().getFullYear()} Fountstream — Thank you for shopping with us!</p>
    </div>
  </div>
</body>
</html>`.trim();
}

export function orderStatusUpdateTemplate(order: {
  id: number;
  firstName: string;
  status: string;
  trackingNumber?: string | null;
}): string {
  const statusConfig: Record<string, { label: string; message: string; color: string; emoji: string }> = {
    processing:            { label: "Processing",  message: "We've received your order and are getting it ready.",        color: "#2563eb", emoji: "🔄" },
    shipped:               { label: "Shipped",     message: "Your order is on its way! Expect delivery soon.",            color: "#7c3aed", emoji: "🚚" },
    delivered:             { label: "Delivered",   message: "Your order has been delivered. Enjoy your purchase!",        color: "#16a34a", emoji: "✅" },
    cancelled:             { label: "Cancelled",   message: "Your order has been cancelled. Contact us if you need help.", color: "#dc2626", emoji: "❌" },
    confirmed:             { label: "Confirmed",   message: "Your reservation has been confirmed by the seller.",          color: "#16a34a", emoji: "✅" },
    awaiting_confirmation: { label: "Pending",     message: "Your order is awaiting confirmation from the seller.",        color: "#d97706", emoji: "⏳" },
  };

  const cfg = statusConfig[order.status] ?? { label: order.status, message: "Your order status has been updated.", color: "#1a4731", emoji: "📦" };

  const trackingSection = order.trackingNumber
    ? `<div style="margin-top:16px;background:#f0faf4;border-radius:8px;padding:14px;border-left:4px solid #1a4731">
        <p style="margin:0 0 4px;font-size:11px;color:#888;text-transform:uppercase;letter-spacing:1px">Tracking Number</p>
        <p style="margin:0;font-size:16px;font-weight:700;color:#1a4731;letter-spacing:2px">${order.trackingNumber}</p>
      </div>`
    : "";

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:sans-serif;background:#f5f5f5;margin:0;padding:24px">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08)">
    <div style="background:#1a4731;padding:28px 32px;text-align:center">
      <h1 style="color:#fff;margin:0;font-size:24px;font-weight:700">Fountstream</h1>
      <p style="color:#86efac;margin:8px 0 0;font-size:14px">Order Update</p>
    </div>
    <div style="padding:32px">
      <h2 style="color:#111;margin:0 0 8px;font-size:20px">Hi ${order.firstName},</h2>
      <p style="color:#555;margin:0 0 20px;line-height:1.6">Your order status has been updated.</p>
      <div style="background:#f9fafb;border-radius:8px;padding:20px;margin-bottom:20px;text-align:center">
        <p style="margin:0 0 8px;font-size:32px">${cfg.emoji}</p>
        <p style="margin:0 0 6px;font-size:11px;color:#888;text-transform:uppercase;letter-spacing:1px">Order #${order.id} is now</p>
        <p style="margin:0;font-size:24px;font-weight:700;color:${cfg.color}">${cfg.label}</p>
      </div>
      <p style="color:#555;margin:0 0 16px;line-height:1.6;text-align:center">${cfg.message}</p>
      ${trackingSection}
      <div style="margin-top:24px;text-align:center">
        <a href="${process.env.FRONTEND_URL ?? "https://myshop-test.vercel.app"}/track-order" style="display:inline-block;background:#1a4731;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600;font-size:14px">Track My Order</a>
      </div>
    </div>
    <div style="background:#f9f9f9;padding:16px 32px;text-align:center">
      <p style="color:#aaa;font-size:12px;margin:0">© ${new Date().getFullYear()} Fountstream — Thank you for shopping with us!</p>
    </div>
  </div>
</body>
</html>`.trim();
}

export function otpEmailTemplate(otp: string, firstName: string): string {
  const digits = otp
    .split("")
    .map(
      (d) =>
        `<span style="display:inline-block;width:46px;height:56px;line-height:56px;` +
        `text-align:center;font-size:30px;font-weight:800;color:#1a4731;` +
        `background:#f0faf4;border:2px solid #1a4731;border-radius:8px;margin:0 4px">${d}</span>`
    )
    .join("");

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:sans-serif;background:#f5f5f5;margin:0;padding:24px;">
  <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08)">
    <div style="background:#1a4731;padding:28px 32px;text-align:center">
      <h1 style="color:#fff;margin:0;font-size:24px;font-weight:700">Fountstream</h1>
    </div>
    <div style="padding:32px;text-align:center">
      <h2 style="color:#111;margin:0 0 8px;font-size:20px">Your verification code</h2>
      <p style="color:#555;margin:0 0 28px;line-height:1.6;text-align:left">
        Hi ${firstName}, here is your one-time code to reset your Fountstream password.
        Enter it on the website within <strong>15 minutes</strong>.
      </p>
      <div style="margin:0 0 28px;letter-spacing:2px">${digits}</div>
      <p style="color:#888;margin:0;font-size:13px;line-height:1.6;text-align:left">
        Never share this code with anyone. Fountstream staff will never ask for it.<br><br>
        If you didn't request this, you can safely ignore this email — your password won't change.
      </p>
    </div>
    <div style="background:#f9f9f9;padding:16px 32px;text-align:center">
      <p style="color:#aaa;font-size:12px;margin:0">© ${new Date().getFullYear()} Fountstream · shop.farmerm.com</p>
    </div>
  </div>
</body>
</html>`.trim();
}

export function paymentSuccessTemplate(order: {
  id: number;
  firstName: string;
  total: string;
  reference: string;
}): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:sans-serif;background:#f5f5f5;margin:0;padding:24px">
  <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08)">
    <div style="background:#1a4731;padding:28px 32px;text-align:center">
      <h1 style="color:#fff;margin:0;font-size:24px;font-weight:700">Fountstream</h1>
      <p style="color:#86efac;margin:8px 0 0;font-size:14px">Payment Received ✓</p>
    </div>
    <div style="padding:32px;text-align:center">
      <p style="font-size:40px;margin:0 0 12px">💳</p>
      <h2 style="color:#111;margin:0 0 8px;font-size:20px">Hi ${order.firstName},</h2>
      <p style="color:#555;margin:0 0 20px;line-height:1.6">We've received your card payment for order <strong>#${order.id}</strong>.</p>
      <div style="background:#f0faf4;border-radius:8px;padding:16px;margin-bottom:20px;text-align:left">
        <p style="margin:0 0 4px;font-size:12px;color:#888;text-transform:uppercase">Reference</p>
        <p style="margin:0;font-size:15px;font-weight:700;color:#1a4731;font-family:monospace">${order.reference}</p>
        <p style="margin:12px 0 4px;font-size:12px;color:#888;text-transform:uppercase">Amount</p>
        <p style="margin:0;font-size:18px;font-weight:700;color:#1a4731">${fmtBWP(order.total)}</p>
      </div>
      <p style="color:#888;font-size:13px">Your order is now being processed. You'll receive shipping updates soon.</p>
    </div>
    <div style="background:#f9f9f9;padding:16px 32px;text-align:center">
      <p style="color:#aaa;font-size:12px;margin:0">© ${new Date().getFullYear()} Fountstream</p>
    </div>
  </div>
</body>
</html>`.trim();
}
