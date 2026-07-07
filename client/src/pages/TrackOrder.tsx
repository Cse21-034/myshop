import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Search, Package, MapPin, Phone, Mail } from "lucide-react";

const BASE_URL = (import.meta.env.VITE_API_BASE_URL || "https://myshop-test-backend.onrender.com").replace(/\/$/, "");
const USD_TO_BWP = 13.5;

function fmtBWP(usd: string | number) {
  const n = typeof usd === "string" ? parseFloat(usd) : usd;
  return `P ${(n * USD_TO_BWP).toLocaleString("en-BW", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ─── Tracking timeline (mirrors OrderConfirmation) ────────────────────────────

const STEPS = ["pending", "processing", "shipped", "delivered"] as const;
type Step = typeof STEPS[number];
const STEP_LABELS: Record<Step, string> = {
  pending: "Order Placed", processing: "Processing", shipped: "Shipped", delivered: "Delivered",
};

function getStepIndex(status: string): number {
  if (status === "cancelled") return -1;
  const idx = STEPS.indexOf(status as Step);
  return idx === -1 ? 1 : idx; // treat confirmed / awaiting_confirmation as processing
}

const STATUS_COLORS: Record<string, string> = {
  delivered:             "bg-green-100 text-green-800",
  shipped:               "bg-purple-100 text-purple-800",
  processing:            "bg-blue-100 text-blue-800",
  confirmed:             "bg-blue-100 text-blue-800",
  awaiting_confirmation: "bg-amber-100 text-amber-800",
  cancelled:             "bg-red-100 text-red-800",
  pending:               "bg-gray-100 text-gray-700",
};

function TrackingTimeline({ status }: { status: string }) {
  if (status === "cancelled") {
    return (
      <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-red-700 text-sm font-medium">
        <span>❌</span> This order has been cancelled.
      </div>
    );
  }
  const current = getStepIndex(status);
  return (
    <div className="relative flex items-start justify-between">
      {STEPS.map((step, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <div key={step} className="flex flex-col items-center flex-1 relative">
            {i > 0 && (
              <div className={`absolute left-0 top-4 w-full h-0.5 -translate-x-1/2 ${done || active ? "bg-green-500" : "bg-gray-200"}`} />
            )}
            <div className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2
              ${done ? "bg-green-500 border-green-500 text-white" : active ? "bg-white border-green-500 text-green-700" : "bg-white border-gray-200 text-gray-400"}`}>
              {done ? "✓" : i + 1}
            </div>
            <p className={`mt-2 text-xs text-center leading-tight ${active ? "text-green-700 font-semibold" : done ? "text-green-600" : "text-gray-400"}`}>
              {STEP_LABELS[step]}
            </p>
          </div>
        );
      })}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

interface OrderItem { id: number; productName: string; productPrice: string; quantity: number; }
interface TrackedOrder {
  id: number; firstName: string; lastName: string; email: string; phone: string;
  address: string; city: string; state: string; zipCode: string;
  status: string; paymentMethod: string; trackingNumber: string | null;
  subtotal: string; shipping: string; tax: string; total: string;
  createdAt: string; items: OrderItem[];
}

export default function TrackOrder() {
  const [email, setEmail] = useState("");
  const [orderId, setOrderId] = useState("");
  const [order, setOrder] = useState<TrackedOrder | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setOrder(null); setLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/api/orders/track`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), orderId: parseInt(orderId) }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.message || "Order not found. Please check your email and order ID.");
        return;
      }
      setOrder(await res.json());
    } catch {
      setError("Unable to reach the server. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header />
      <main className="flex-grow container mx-auto px-[5px] sm:px-4 py-10 max-w-2xl">
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Package className="h-7 w-7 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Track Your Order</h1>
          <p className="text-gray-500 mt-1 text-sm">Enter your order details to see the latest status</p>
        </div>

        <Card className="border-0 shadow-sm mb-6">
          <CardContent className="p-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email">Email address</Label>
                <Input
                  id="email" type="email" placeholder="you@example.com"
                  value={email} onChange={(e) => setEmail(e.target.value)} required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="orderId">Order ID</Label>
                <Input
                  id="orderId" type="number" placeholder="e.g. 123"
                  value={orderId} onChange={(e) => setOrderId(e.target.value)} required
                />
                <p className="text-xs text-gray-400">Your order ID is in your confirmation email, e.g. "Order #123"</p>
              </div>
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">{error}</div>
              )}
              <Button type="submit" className="w-full gap-2" disabled={loading}>
                <Search className="h-4 w-4" />
                {loading ? "Looking up…" : "Track Order"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {order && (
          <div className="space-y-4">
            {/* Status + timeline */}
            <Card className="border-0 shadow-sm">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <p className="text-xs text-gray-400 uppercase tracking-wide">Order #{order.id}</p>
                    <p className="text-sm text-gray-500">{new Date(order.createdAt).toLocaleDateString("en-BW", { day: "numeric", month: "long", year: "numeric" })}</p>
                  </div>
                  <Badge className={STATUS_COLORS[order.status] ?? "bg-gray-100 text-gray-700"}>
                    {order.status.replace(/_/g, " ")}
                  </Badge>
                </div>
                <TrackingTimeline status={order.status} />
                {order.trackingNumber && (
                  <div className="mt-5 bg-gray-50 border border-gray-200 rounded-lg px-4 py-3">
                    <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Tracking Number</p>
                    <p className="font-mono font-bold text-gray-800 tracking-widest text-sm">{order.trackingNumber}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Items */}
            <Card className="border-0 shadow-sm">
              <CardContent className="p-6">
                <h3 className="font-semibold text-sm text-gray-700 mb-3">Items Ordered</h3>
                <div className="space-y-2">
                  {order.items.map((item) => (
                    <div key={item.id} className="flex justify-between text-sm">
                      <span className="text-gray-700">{item.productName} <span className="text-gray-400">× {item.quantity}</span></span>
                      <span className="font-medium">{fmtBWP(parseFloat(item.productPrice) * item.quantity)}</span>
                    </div>
                  ))}
                  <div className="border-t border-gray-100 pt-2 mt-2 flex justify-between font-semibold text-sm">
                    <span>Total</span>
                    <span>{fmtBWP(order.total)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Delivery info */}
            <Card className="border-0 shadow-sm">
              <CardContent className="p-6">
                <h3 className="font-semibold text-sm text-gray-700 mb-3">Delivery Details</h3>
                <div className="space-y-2 text-sm text-gray-600">
                  <div className="flex gap-2"><MapPin className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" /><span>{order.address}, {order.city}, {order.state} {order.zipCode}</span></div>
                  <div className="flex gap-2"><Phone className="h-4 w-4 text-gray-400 shrink-0" /><span>{order.phone}</span></div>
                  <div className="flex gap-2"><Mail className="h-4 w-4 text-gray-400 shrink-0" /><span>{order.email}</span></div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
