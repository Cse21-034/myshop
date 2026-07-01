import { useQuery } from "@tanstack/react-query";
import { getQueryFn, createQueryKey } from "@/lib/queryClient";
import SellerLayout from "@/components/SellerLayout";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShoppingCart } from "lucide-react";

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

export default function SellerOrders() {
  const { data: orders = [], isLoading } = useQuery({
    queryKey: createQueryKey("/api/seller/orders"),
    queryFn: getQueryFn({ on401: "returnNull" }),
  });

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
              <Card key={order.id} className="border-0 shadow-sm overflow-hidden">
                <CardHeader className="px-5 py-4 bg-gray-50/80 border-b border-gray-100">
                  <div className="flex items-start justify-between gap-3">
                    <div>
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
                    <Badge className={`text-xs flex-shrink-0 ${STATUS_COLOR[order.status] ?? "bg-gray-100"}`}>
                      {order.status.replace(/_/g, " ")}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-5">
                  {/* Items table */}
                  <div className="rounded-lg border border-gray-100 overflow-hidden mb-4">
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

                  {/* Footer */}
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-gray-400">
                      Payment: <span className="capitalize text-gray-600 font-medium">{order.paymentMethod}</span>
                    </p>
                    {order.depositAmount ? (
                      <div className="text-right">
                        <p className="text-xs text-gray-400 line-through">Full: {fmtBWP(order.total)}</p>
                        <p className="text-sm font-bold text-amber-700">Deposit paid: {fmtBWP(order.depositAmount)}</p>
                        <p className="text-xs text-gray-500">Due on collection: {fmtBWP(order.remainingBalance ?? "0")}</p>
                      </div>
                    ) : (
                      <p className="text-sm font-bold text-gray-900">Total: {fmtBWP(order.total)}</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}
    </SellerLayout>
  );
}
