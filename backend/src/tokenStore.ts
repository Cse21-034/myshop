// In-memory token store with TTL.
// In production Redis could be used, but in-memory is sufficient here:
// reset tokens are short-lived (1h) and a server restart simply invalidates
// outstanding links (user can just request a new one).

interface TokenEntry {
  userId: string;
  email: string;
  expiresAt: number;
}

const store = new Map<string, TokenEntry>();

// Purge expired entries every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [token, entry] of store) {
    if (entry.expiresAt <= now) store.delete(token);
  }
}, 10 * 60 * 1000);

export function setResetToken(token: string, userId: string, email: string, ttlMs = 60 * 60 * 1000) {
  store.set(token, { userId, email, expiresAt: Date.now() + ttlMs });
}

export function getResetToken(token: string): TokenEntry | null {
  const entry = store.get(token);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    store.delete(token);
    return null;
  }
  return entry;
}

export function deleteResetToken(token: string) {
  store.delete(token);
}
