import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getQueryFn, createQueryKey, apiRequest } from "@/lib/queryClient";
import SellerLayout from "@/components/SellerLayout";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ShoppingCart, ChevronDown, ChevronUp, Truck } from "lucide-react";

const USD_TO_BWP = 13.5;
const fmtBWP = (usd: string | number) => {
  const n = typeof usd === "string" ? parseFloat(usd) : usd;
  return `P ${(n * USD_TO_BWP).toLocaleString("en-BW", { minimumFractionDigits: 2 })}`;
};

const STATUS_COLOR: Record<string, string> = {
  pending: "bg-gray-100 text-gray-700",
  processing: "bg-blue-100 text-blue-700",
  shipped: "bg-indigo-100 text-indigo-700",
  delivered: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-red-100 text-red-700",
  awaiting_confirmation: "bg-amber-100 text-amber-700",
  confirmed: "bg-emerald-100 text-emerald-700",
  paid: "bg-emerald-100 text-emerald-700",
};

const SELLER_STATUSES = [
  { value: "processing", label: "Processing" },
  { value: "shipped", label: "Shipped" },
  { value: "delivered", label: "Delivered" },
  { value: "cancelled", label: "Cancelled" },
];

function OrderCard({ order, onUpdated }: { order: any; onUpdated: () => void }) {
  const { toast } = useToast();
  const [expanded, setExpanded] = useState(false);
  const [newStatus, setNewStatus] = useState(order.status);
  const [tracking, setTracking] = useState((order as any).trackingNumber ?? "");

  const updateMutation = useMutation({
    mutationFn: () =>
      apiRequest("PATCH", `/api/seller/orders/${order.id}/status`, {
        status: newStatus,
        trackingNumber: tracking || undefined,
      }),
    onSuccess: () => {
      toast({ title: "Order updated", description: `Order #${order.id} is now ${newStatus}.` });
      onUpdated();
    },
    onError: async (err: any) => {
      let msg = "Failed to update order.";
      try { const j = JSON.parse((err?.message || "").replace(/^\d+:\s*/, "")); msg = j?.message || msg; } catch {}
      toast({ title: "Error", description: msg, variant: "destructive" });
    },
  });

  const canUpdate = SELLER_STATUSES.some(s => s.value === newStatus);
  const hasChanges = newStatus !== order.status || tracking !== (order.trackingNumber ?? "");

  return (
    <Card className="border-0 shadow-sm overflow-hidden">
      <CardHeader className="px-5 py-4 bg-gray-50/80 border-b border-gray-100">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-gray-900 text-sm">Order #{order.id}</p>
            <p className="text-xs text-gray-500 mt-0.5">
              {order.firstName} {order.lastName}
              {order.email && <> · <span>{order.email}</span></>}
            </p>
            {(order.phone || order.city) && (
              <p className="text-xs text-gray-400">
                {[order.phone, order.city, order.state].filter(Boolean).join(" · ")}
              </p>
            )}
            <p className="text-xs text-gray-400 mt-0.5">
              {new Date(order.createdAt).toLocaleString()}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Badge className={`text-xs ${STATUS_COLOR[order.status] ?? "bg-gray-100"}`}>
              {order.status.replace(/_/g, " ")}
            </Badge>
            <button onClick={() => setExpanded(e => !e)} className="p-1 rounded hover:bg-gray-200 transition-colors">
              {expanded ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
            </button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-5">
        {/* Items table */}
        <div className="rounded-lg border border-gray-100 overflow-hidden mb-4">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left text-xs font-medium text-gray-500 px-4 py-2">Product</th>
                  <th className="text-center text-xs font-medium text-gray-500 px-2 py-2">Qty</th>
                  <th className="text-right text-xs font-medium text-gray-500 px-4 py-2">Price</th>
                  <th className="text-right text-xs font-medium text-gray-500 px-4 py-2">Subtotal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {order.items.map((item: any) => (
                  <tr key={item.id} className="hover:bg-gray-50/50">
                    <td className="px-4 py-2.5 font-medium">{item.productName}</td>
                    <td className="px-2 py-2.5 text-center text-gray-600">{item.quantity}</td>
                    <td className="px-4 py-2.5 text-right text-gray-600">{fmtBWP(item.productPrice)}</td>
                    <td className="px-4 py-2.5 text-right font-semibold">
                      {fmtBWP((parseFloat(item.productPrice) * item.quantity).toString())}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer row */}
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs text-gray-400">
            Payment: <span className="capitalize text-gray-600 font-medium">{order.paymentMethod}</span>
          </p>
          {order.depositAmount ? (
            <div className="text-right">
              <p className="text-xs text-gray-400 line-through">Full: {fmtBWP(order.total)}</p>
              <p className="text-sm font-bold text-amber-700">Deposit paid: {fmtBWP(order.depositAmount)}</p>
            </div>
          ) : (
            <p className="text-sm font-bold text-gray-900">Total: {fmtBWP(order.total)}</p>
          )}
        </div>

        {/* Update panel — toggled by expand */}
        {expanded && (
          <div className="border-t border-gray-100 pt-4 space-y-3">
            <p className="text-xs font-semibold text-gray-600 flex items-center gap-1.5">
              <Truck className="h-3.5 w-3.5" /> Update Order Status
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Status</label>
                <Select value={newStatus} onValueChange={setNewStatus}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SELLER_STATUSES.map(s => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Tracking Number (optional)</label>
                <Input
                  className="h-9 text-sm"
                  placeholder="e.g. BW123456789"
                  value={tracking}
                  onChange={e => setTracking(e.target.value)}
                />
              </div>
            </div>
            <Button
              size="sm"
              disabled={!canUpdate || !hasChanges || updateMutation.isPending}
              onClick={() => updateMutation.mutate()}
              className="gap-2"
            >
              {updateMutation.isPending ? "Saving…" : "Save & Notify Buyer"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function SellerOrders() {
  const queryClient = useQueryClient();
  const { data: orders = [], isLoading } = useQuery({
    queryKey: createQueryKey("/api/seller/orders"),
    queryFn: getQueryFn({ on401: "returnNull" }),
  });

  function refetch() {
    queryClient.invalidateQueries({ queryKey: createQueryKey("/api/seller/orders") });
  }

  return (
    <SellerLayout title="My Orders">
      {() => (
        <div className="space-y-3">
          {isLoading ? (
            <p className="text-center text-gray-400 py-12">Loading orders…</p>
          ) : (orders as any[]).length === 0 ? (
            <Card className="border-0 shadow-sm">
              <CardContent className="flex flex-col items-center py-16 text-center">
                <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mb-4">
                  <ShoppingCart className="h-7 w-7 text-gray-400" />
                </div>
                <p className="text-gray-500 text-sm">No orders yet. Share your products to get your first sale!</p>
              </CardContent>
            </Card>
          ) : (
            (orders as any[]).map((order) => (
              <OrderCard key={order.id} order={order} onUpdated={refetch} />
            ))
          )}
        </div>
      )}
    </SellerLayout>
  );
}
