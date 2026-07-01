import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { getQueryFn, createQueryKey } from "@/lib/queryClient";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ShoppingCart } from "lucide-react";

const USD_TO_BWP = 13.5;
const fmtBWP = (usd: string) => `P ${(parseFloat(usd) * USD_TO_BWP).toLocaleString("en-BW", { minimumFractionDigits: 2 })}`;

const statusColor: Record<string, string> = {
  pending: "bg-gray-100 text-gray-700",
  processing: "bg-blue-100 text-blue-700",
  shipped: "bg-indigo-100 text-indigo-700",
  delivered: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
  awaiting_confirmation: "bg-amber-100 text-amber-700",
  confirmed: "bg-green-100 text-green-700",
  paid: "bg-green-100 text-green-700",
};

export default function SellerOrders() {
  const [, navigate] = useLocation();

  const { data: seller } = useQuery({
    queryKey: createQueryKey("/api/seller/me"),
    queryFn: getQueryFn({ on401: "returnNull" }),
  });

  const { data: orders = [], isLoading } = useQuery({
    queryKey: createQueryKey("/api/seller/orders"),
    queryFn: getQueryFn({ on401: "returnNull" }),
    enabled: seller?.status === "approved",
  });

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header />
      <main className="flex-grow container mx-auto px-4 py-8 max-w-5xl">
        <div className="flex items-center gap-2 mb-6">
          <Button variant="ghost" size="sm" onClick={() => navigate("/seller/dashboard")}><ArrowLeft className="h-4 w-4" /></Button>
          <h1 className="text-2xl font-bold text-primary">My Orders</h1>
        </div>

        {isLoading ? (
          <p className="text-center text-gray-500 py-12">Loading orders...</p>
        ) : orders.length === 0 ? (
          <Card className="text-center py-16">
            <CardContent>
              <ShoppingCart className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No orders yet. Share your products to get your first sale!</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {orders.map((order: any) => (
              <Card key={order.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Order #{order.id}</CardTitle>
                    <Badge className={`text-xs ${statusColor[order.status] ?? "bg-gray-100"}`}>
                      {order.status.replace(/_/g, " ")}
                    </Badge>
                  </div>
                  <div className="text-sm text-gray-500 space-y-0.5">
                    <p>{order.firstName} {order.lastName} · {order.email}</p>
                    <p>{order.phone} · {order.city}, {order.state}</p>
                    <p>{new Date(order.createdAt).toLocaleString()}</p>
                  </div>
                </CardHeader>
                <CardContent>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-gray-500">
                        <th className="pb-1">Product</th>
                        <th className="pb-1">Qty</th>
                        <th className="pb-1 text-right">Price</th>
                        <th className="pb-1 text-right">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {order.items.map((item: any) => (
                        <tr key={item.id} className="border-b last:border-0">
                          <td className="py-1">{item.productName}</td>
                          <td className="py-1">{item.quantity}</td>
                          <td className="py-1 text-right">{fmtBWP(item.productPrice)}</td>
                          <td className="py-1 text-right">{fmtBWP((parseFloat(item.productPrice) * item.quantity).toString())}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="flex justify-between items-center mt-3 pt-2 border-t">
                    <span className="text-sm text-gray-500">Payment: <span className="capitalize">{order.paymentMethod}</span></span>
                    {order.depositAmount ? (
                      <div className="text-right">
                        <p className="text-xs text-gray-400 line-through">Total: {fmtBWP(order.total)}</p>
                        <p className="font-bold text-amber-700">Deposit: {fmtBWP(order.depositAmount)}</p>
                        <p className="text-xs text-gray-500">Due on collection: {fmtBWP(order.remainingBalance ?? "0")}</p>
                      </div>
                    ) : (
                      <p className="font-bold">{fmtBWP(order.total)}</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
