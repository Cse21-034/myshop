import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getQueryFn, createQueryKey, apiRequest } from "@/lib/queryClient";
import SellerLayout from "@/components/SellerLayout";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Send, ArrowLeft } from "lucide-react";
import { useChatSocket } from "@/hooks/useChatSocket";

const backendURL = (import.meta.env.VITE_API_BASE_URL || "https://myshop-test-backend.onrender.com").replace(/\/$/, "");

export default function SellerMessages() {
  const queryClient = useQueryClient();
  const [selectedChatId, setSelectedChatId] = useState<number | null>(null);
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: chats = [], isLoading } = useQuery<any[]>({
    queryKey: createQueryKey("/api/seller/chats"),
    queryFn: getQueryFn({ on401: "returnNull" }),
    refetchInterval: 10000,
  });

  const { data: thread, refetch: refetchThread } = useQuery({
    queryKey: ["seller-chat-thread", selectedChatId],
    queryFn: () => fetch(`${backendURL}/api/chats/${selectedChatId}/messages`, { credentials: "include" }).then(r => r.json()),
    enabled: !!selectedChatId,
  });

  const onSocketMessage = useCallback(() => {
    refetchThread();
    queryClient.invalidateQueries({ queryKey: createQueryKey("/api/seller/chats") });
  }, [refetchThread, queryClient]);

  useChatSocket(selectedChatId, onSocketMessage);

  useEffect(() => {
    if (thread?.messages?.length) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [thread]);

  const sendMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/chats/${selectedChatId}/messages`, { content: input }),
    onSuccess: () => {
      setInput("");
      refetchThread();
      queryClient.invalidateQueries({ queryKey: createQueryKey("/api/seller/chats") });
    },
  });

  const totalUnread = (chats as any[]).reduce((s, c) => s + (c.unread ?? 0), 0);

  return (
    <SellerLayout title={`Messages${totalUnread > 0 ? ` (${totalUnread})` : ""}`}>
      {() => (
        <div className="flex h-[calc(100vh-8rem)] bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">

          {/* Conversation list */}
          <div className={`w-full sm:w-72 lg:w-80 border-r border-gray-100 flex flex-col shrink-0 ${selectedChatId ? "hidden sm:flex" : "flex"}`}>
            <div className="px-4 py-3 border-b border-gray-50">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Conversations</p>
            </div>
            {isLoading ? (
              <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">Loading…</div>
            ) : (chats as any[]).length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-gray-400 text-sm text-center px-6">
                <MessageSquare className="h-10 w-10 mb-3 opacity-20" />
                <p>No customer messages yet.</p>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
                {(chats as any[]).map((c: any) => (
                  <button
                    key={c.id}
                    onClick={() => setSelectedChatId(c.id)}
                    className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors ${selectedChatId === c.id ? "bg-primary/5 border-l-2 border-primary" : ""}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-gray-900 truncate">{c.productName}</p>
                        <p className="text-xs text-gray-500 truncate">{c.buyerName}</p>
                        {c.lastMessage && (
                          <p className="text-xs text-gray-400 mt-1 truncate">{c.lastMessage.content}</p>
                        )}
                      </div>
                      <div className="shrink-0 flex flex-col items-end gap-1">
                        {c.unread > 0 && (
                          <span className="bg-primary text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">{c.unread}</span>
                        )}
                        {c.lastMessage && (
                          <p className="text-[10px] text-gray-400">
                            {new Date(c.lastMessage.createdAt).toLocaleTimeString("en-BW", { hour: "2-digit", minute: "2-digit" })}
                          </p>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Message thread */}
          {selectedChatId ? (
            <div className="flex-1 flex flex-col min-w-0">
              {/* Thread header */}
              <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-3 shrink-0 bg-white">
                <button onClick={() => setSelectedChatId(null)} className="sm:hidden p-1 rounded hover:bg-gray-100">
                  <ArrowLeft className="h-4 w-4 text-gray-500" />
                </button>
                {thread?.chat?.product && (
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{thread.chat.product.name}</p>
                    <p className="text-xs text-gray-400 truncate">
                      {(chats as any[]).find(c => c.id === selectedChatId)?.buyerName}
                      {" · "}
                      {(chats as any[]).find(c => c.id === selectedChatId)?.buyerEmail}
                    </p>
                  </div>
                )}
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 min-h-0">
                {!thread?.messages?.length ? (
                  <div className="flex flex-col items-center justify-center h-full text-gray-400 text-sm text-center">
                    <MessageSquare className="h-8 w-8 mb-2 opacity-20" />
                    <p>No messages yet in this conversation.</p>
                  </div>
                ) : thread.messages.map((m: any) => {
                  const isMine = m.senderId === thread.chat.sellerId;
                  return (
                    <div key={m.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${isMine ? "bg-primary text-white rounded-br-sm" : "bg-gray-100 text-gray-800 rounded-bl-sm"}`}>
                        {!isMine && <p className="text-[10px] font-semibold mb-1 opacity-60">{m.senderName}</p>}
                        <p className="leading-relaxed">{m.content}</p>
                        <p className={`text-[10px] mt-1 ${isMine ? "text-white/60 text-right" : "text-gray-400"}`}>
                          {new Date(m.createdAt).toLocaleTimeString("en-BW", { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                    </div>
                  );
                })}
                <div ref={bottomRef} />
              </div>

              {/* Reply input */}
              <div className="px-4 py-3 border-t border-gray-100 shrink-0 bg-white">
                <div className="flex gap-2">
                  <input
                    type="text"
                    className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    placeholder="Reply to customer…"
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && !e.shiftKey && input.trim() && sendMutation.mutate()}
                  />
                  <button
                    onClick={() => input.trim() && sendMutation.mutate()}
                    disabled={!input.trim() || sendMutation.isPending}
                    className="bg-primary text-white rounded-xl px-3 py-2 hover:bg-primary/90 disabled:opacity-40 transition-colors"
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="hidden sm:flex flex-1 items-center justify-center text-gray-400 text-sm flex-col gap-2">
              <MessageSquare className="h-10 w-10 opacity-20" />
              <p>Select a conversation to start replying</p>
            </div>
          )}
        </div>
      )}
    </SellerLayout>
  );
}
