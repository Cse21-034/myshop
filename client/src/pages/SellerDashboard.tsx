import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { getQueryFn, createQueryKey } from "@/lib/queryClient";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Package, ShoppingCart, DollarSign, Plus, ArrowRight, Clock, Store } from "lucide-react";

const USD_TO_BWP = 13.5;
const fmtBWP = (usd: string | number) => {
  const n = typeof usd === "string" ? parseFloat(usd) : usd;
  return `P ${(n * USD_TO_BWP).toLocaleString("en-BW", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const statusColor: Record<string, string> = {
  pending: "bg-gray-100 text-gray-700",
  processing: "bg-blue-100 text-blue-700",
  shipped: "bg-indigo-100 text-indigo-700",
  delivered: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
  awaiting_confirmation: "bg-amber-100 text-amber-700",
  confirmed: "bg-green-100 text-green-700",
};

export default function SellerDashboard() {
  const [, navigate] = useLocation();

  const { data: seller, isLoading: sellerLoading } = useQuery({
    queryKey: createQueryKey("/api/seller/me"),
    queryFn: getQueryFn({ on401: "returnNull" }),
  });

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: createQueryKey("/api/seller/stats"),
    queryFn: getQueryFn({ on401: "returnNull" }),
    enabled: seller?.status === "approved",
  });

  if (sellerLoading) return null;

  if (!seller) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-grow container mx-auto px-4 py-16 text-center max-w-md">
          <Store className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">No seller account</h1>
          <p className="text-gray-600 mb-6">Apply to become a seller to start listing your products.</p>
          <Button onClick={() => navigate("/seller/apply")}>Apply Now</Button>
        </main>
        <Footer />
      </div>
    );
  }

  if (seller.status !== "approved") {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-grow container mx-auto px-4 py-16 text-center max-w-md">
          <Clock className="h-16 w-16 text-amber-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">
            {seller.status === "pending" ? "Application under review" : "Account suspended"}
          </h1>
          <p className="text-gray-600">
            {seller.status === "pending"
              ? "We're reviewing your application. You'll be notified once approved."
              : "Your seller account has been suspended. Please contact support."}
          </p>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header />
      <main className="flex-grow container mx-auto px-4 py-8 max-w-5xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            {seller.logoUrl ? (
              <img src={seller.logoUrl} alt="logo" className="w-12 h-12 rounded-full object-cover" />
            ) : (
              <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center">
                <Store className="h-6 w-6 text-white" />
              </div>
            )}
            <div>
              <h1 className="text-2xl font-bold text-primary">{seller.storeName}</h1>
              <p className="text-sm text-gray-500">Seller Dashboard</p>
            </div>
          </div>
          <Button onClick={() => navigate("/seller/products/new")} className="gap-2">
            <Plus className="h-4 w-4" /> Add Product
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <Card>
            <CardContent className="pt-6 flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <Package className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Products</p>
                <p className="text-2xl font-bold">{statsLoading ? "—" : stats?.totalProducts ?? 0}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 flex items-center gap-4">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <ShoppingCart className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Orders</p>
                <p className="text-2xl font-bold">{statsLoading ? "—" : stats?.totalOrders ?? 0}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 flex items-center gap-4">
              <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                <DollarSign className="h-6 w-6 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Revenue</p>
                <p className="text-2xl font-bold">{statsLoading ? "—" : fmtBWP(stats?.totalRevenue ?? "0")}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick links */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/seller/products")}>
            <CardContent className="pt-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Package className="h-5 w-5 text-primary" />
                <span className="font-medium">Manage Products</span>
              </div>
              <ArrowRight className="h-4 w-4 text-gray-400" />
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/seller/orders")}>
            <CardContent className="pt-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <ShoppingCart className="h-5 w-5 text-primary" />
                <span className="font-medium">View Orders</span>
              </div>
              <ArrowRight className="h-4 w-4 text-gray-400" />
            </CardContent>
          </Card>
        </div>

        {/* Recent orders */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Recent Orders</CardTitle>
            <Button variant="outline" size="sm" onClick={() => navigate("/seller/orders")}>View all</Button>
          </CardHeader>
          <CardContent>
            {!stats?.recentOrders?.length ? (
              <p className="text-center text-gray-500 py-6">No orders yet. Share your products to get your first sale!</p>
            ) : (
              <div className="space-y-3">
                {stats.recentOrders.map((order: any) => (
                  <div key={order.id} className="flex items-center justify-between py-2 border-b last:border-0">
                    <div>
                      <p className="font-medium text-sm">Order #{order.id}</p>
                      <p className="text-xs text-gray-500">{order.firstName} {order.lastName} · {new Date(order.createdAt).toLocaleDateString()}</p>
                    </div>
                    <div className="text-right">
                      <Badge className={`text-xs ${statusColor[order.status] ?? "bg-gray-100"}`}>{order.status.replace(/_/g, " ")}</Badge>
                      <p className="text-sm font-semibold mt-1">{fmtBWP(order.total)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  );
}
