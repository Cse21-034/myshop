import { useEffect, useRef } from "react";

const BACKEND = (import.meta.env.VITE_API_BASE_URL || "https://myshop-test-backend.onrender.com")
  .replace(/\/$/, "")
  .replace(/^http/, "ws"); // http → ws, https → wss

export function useChatSocket(
  chatId: number | null,
  onMessage: (msg: any) => void,
) {
  const wsRef    = useRef<WebSocket | null>(null);
  const cbRef    = useRef(onMessage);
  cbRef.current  = onMessage;

  useEffect(() => {
    if (!chatId) return;

    const token = localStorage.getItem("jwtToken");
    if (!token) return;

    const url = `${BACKEND}/ws?token=${encodeURIComponent(token)}`;
    const ws  = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: "subscribe", chatId }));
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "message" && data.chatId === chatId) {
          cbRef.current(data.message);
        }
      } catch {}
    };

    // Keepalive ping every 25 s so the connection isn't dropped by idle timeouts
    const ping = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "ping" }));
    }, 25_000);

    ws.onerror  = () => {};
    ws.onclose  = () => clearInterval(ping);

    return () => {
      clearInterval(ping);
      ws.close();
      wsRef.current = null;
    };
  }, [chatId]);
}
