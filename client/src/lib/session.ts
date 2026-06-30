// src/lib/session.ts
export function getSessionId(): string {
  const key = "myshop_session_id";
  let sessionId = localStorage.getItem(key);

  if (!sessionId) {
    sessionId = crypto.randomUUID();
    localStorage.setItem(key, sessionId);
  }

  return sessionId;
}
