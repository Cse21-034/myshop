interface OtpEntry {
  otp: string;
  userId: string;
  email: string;
  expiresAt: number;
  attempts: number;
  createdAt: number;
}

// Keyed by lowercase email
const store = new Map<string, OtpEntry>();

// Purge expired entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (entry.expiresAt <= now) store.delete(key);
  }
}, 5 * 60 * 1000);

export function setOtp(
  email: string,
  otp: string,
  userId: string,
  ttlMs = 15 * 60 * 1000
) {
  store.set(email.toLowerCase(), {
    otp,
    userId,
    email: email.toLowerCase(),
    expiresAt: Date.now() + ttlMs,
    attempts: 0,
    createdAt: Date.now(),
  });
}

export function getOtp(email: string): OtpEntry | null {
  const entry = store.get(email.toLowerCase());
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    store.delete(email.toLowerCase());
    return null;
  }
  return entry;
}

// Returns new attempt count. Deletes OTP after 5 wrong attempts.
export function incrementOtpAttempts(email: string): number {
  const entry = store.get(email.toLowerCase());
  if (!entry) return 5;
  entry.attempts += 1;
  if (entry.attempts >= 5) {
    store.delete(email.toLowerCase());
  }
  return entry.attempts;
}

export function deleteOtp(email: string) {
  store.delete(email.toLowerCase());
}
