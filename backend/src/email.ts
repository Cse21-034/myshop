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
