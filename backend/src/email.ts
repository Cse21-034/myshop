import nodemailer from "nodemailer";

// ─── helpers ─────────────────────────────────────────────────────────────────

function gmailTransport() {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) return null;

  return nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass },
  });
}

async function sendViaResend(to: string, subject: string, html: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY not set");

  const { Resend } = await import("resend");
  const resend = new Resend(apiKey);

  const from = process.env.RESEND_FROM_EMAIL || "Fountstream <noreply@farmerm.com>";
  const { error } = await resend.emails.send({ from, to, subject, html });
  if (error) throw new Error(`Resend error: ${error.message}`);
}

// ─── public API ──────────────────────────────────────────────────────────────

export async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  // Try Gmail first
  const gmail = gmailTransport();
  if (gmail) {
    try {
      await gmail.sendMail({
        from: `Fountstream <${process.env.GMAIL_USER}>`,
        to,
        subject,
        html,
      });
      console.log(`[Email] Sent via Gmail to ${to}`);
      return;
    } catch (err: any) {
      console.warn("[Email] Gmail failed, falling back to Resend:", err.message);
    }
  }

  // Fall back to Resend
  await sendViaResend(to, subject, html);
  console.log(`[Email] Sent via Resend to ${to}`);
}

// ─── templates ───────────────────────────────────────────────────────────────

export function passwordResetTemplate(resetUrl: string, firstName: string): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:sans-serif;background:#f5f5f5;margin:0;padding:24px;">
  <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08)">
    <div style="background:#1a4731;padding:28px 32px;text-align:center">
      <h1 style="color:#fff;margin:0;font-size:24px;font-weight:700">Fountstream</h1>
    </div>
    <div style="padding:32px">
      <h2 style="color:#111;margin:0 0 12px;font-size:20px">Reset your password</h2>
      <p style="color:#555;margin:0 0 24px;line-height:1.6">
        Hi ${firstName}, we received a request to reset your Fountstream password.
        Click the button below to choose a new one. This link expires in <strong>1 hour</strong>.
      </p>
      <a href="${resetUrl}"
         style="display:inline-block;background:#1a4731;color:#fff;text-decoration:none;padding:14px 28px;border-radius:8px;font-weight:600;font-size:15px">
        Reset Password
      </a>
      <p style="color:#888;margin:24px 0 0;font-size:13px;line-height:1.5">
        If you didn't request this, you can safely ignore this email — your password won't change.<br><br>
        Or copy this link: <a href="${resetUrl}" style="color:#1a4731;word-break:break-all">${resetUrl}</a>
      </p>
    </div>
    <div style="background:#f9f9f9;padding:16px 32px;text-align:center">
      <p style="color:#aaa;font-size:12px;margin:0">© ${new Date().getFullYear()} Fountstream · shop.farmerm.com</p>
    </div>
  </div>
</body>
</html>`.trim();
}
