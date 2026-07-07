import crypto from "crypto";

export interface PayGateCheckoutRequest {
  reference: string;
  /** Amount in BWP cents (e.g. P 99.00 → 9900) */
  amount: number;
  currency: string;
  email: string;
  returnUrl: string;
  notifyUrl: string;
}

class PayGateService {
  readonly INITIATE_URL = "https://secure.paygate.co.za/payweb3/initiate.trans";
  readonly PROCESS_URL  = "https://secure.paygate.co.za/payweb3/process.trans";

  private get merchantId()  { return process.env.PAYGATE_MERCHANT_ID  || ""; }
  private get merchantKey() { return process.env.PAYGATE_MERCHANT_KEY || ""; }

  get isConfigured() { return !!(this.merchantId && this.merchantKey); }

  /**
   * Build the fields to POST to PayGate's initiate endpoint.
   * Field ORDER is critical for the MD5 checksum — do not sort or add extras.
   */
  buildInitiateParams(req: PayGateCheckoutRequest): Record<string, string> {
    if (!this.isConfigured) throw new Error("PAYGATE_MERCHANT_ID and PAYGATE_MERCHANT_KEY must be set");

    // PayGate requires SAST (UTC+2); format: YYYY-MM-DD HH:MM:SS
    const now = new Date(Date.now() + 2 * 60 * 60 * 1000);
    const transactionDate = now.toISOString().replace("T", " ").substring(0, 19);

    const fields: Record<string, string> = {
      PAYGATE_ID:       this.merchantId,
      REFERENCE:        req.reference,
      AMOUNT:           String(req.amount),
      CURRENCY:         req.currency,
      RETURN_URL:       req.returnUrl,
      TRANSACTION_DATE: transactionDate,
      LOCALE:           "en",
      COUNTRY:          "BWA",
      EMAIL:            req.email,
      NOTIFY_URL:       req.notifyUrl,
    };

    const checksum = crypto
      .createHash("md5")
      .update(Object.values(fields).join("") + this.merchantKey)
      .digest("hex");

    return { ...fields, CHECKSUM: checksum };
  }

  /**
   * Build the PROCESS POST checksum (3 fields: PAYGATE_ID + PAY_REQUEST_ID + REFERENCE + key).
   */
  buildProcessChecksum(payRequestId: string, reference: string): string {
    return crypto
      .createHash("md5")
      .update(this.merchantId + payRequestId + reference + this.merchantKey)
      .digest("hex");
  }

  /**
   * Verify checksum on the callback (server-to-server POST from PayGate).
   * Excludes CHECKSUM from values before hashing.
   */
  verifyCallbackChecksum(data: Record<string, string>): boolean {
    const { CHECKSUM, ...rest } = data;
    if (!CHECKSUM) return false;
    const calc = crypto
      .createHash("md5")
      .update(Object.values(rest).join("") + this.merchantKey)
      .digest("hex");
    return calc.toLowerCase() === CHECKSUM.toLowerCase();
  }

  /**
   * Verify checksum on the browser return redirect.
   */
  verifyReturnChecksum(payRequestId: string, reference: string, checksum: string): boolean {
    if (!checksum) return false;
    const calc = crypto
      .createHash("md5")
      .update(this.merchantId + payRequestId + reference + this.merchantKey)
      .digest("hex");
    return calc.toLowerCase() === checksum.toLowerCase();
  }
}

export const payGate = new PayGateService();

// ── PayGate result code descriptions ─────────────────────────────────────────
const RESULT_CODE_MESSAGES: Record<string, string> = {
  "990001": "Approved",
  "990017": "Auth done",
  "900009": "Look up invalid",
  "900010": "Security violation",
  "900011": "Expiry invalid",
  "900012": "Card expired",
  "900013": "Insufficient funds",
  "900014": "Card blocked",
  "900015": "Card risk",
  "900207": "Declined",
  "900209": "3D Secure lookup timeout",
  "900210": "3D Secure auth failed",
  "990020": "Auth voided",
};

export function getResultCodeMessage(code: string): string {
  return RESULT_CODE_MESSAGES[code] ?? `Payment declined (code ${code})`;
}
