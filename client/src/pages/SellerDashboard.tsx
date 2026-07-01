import { useMemo } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { getQueryFn, createQueryKey } from "@/lib/queryClient";
import SellerLayout from "@/components/SellerLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Package, ShoppingCart, DollarSign, Plus, TrendingUp, ArrowRight } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ChartTooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend, AreaChart, Area,
} from "recharts";

const USD_TO_BWP = 13.5;
const fmtBWP = (usd: string | number) => {
  const n = typeof usd === "string" ? parseFloat(usd) : usd;
  return `P ${(n * USD_TO_BWP).toLocaleString("en-BW", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const STATUS_COLOR: Record<string, string> = {
  pending: "bg-gray-100 text-gray-700",
  processing: "bg-blue-100 text-blue-700",
  shipped: "bg-indigo-100 text-indigo-700",
  delivered: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-red-100 text-red-700",
  awaiting_confirmation: "bg-amber-100 text-amber-700",
  confirmed: "bg-emerald-100 text-emerald-700",
};

const PIE_COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6"];

function StatCard({ label, value, sub, icon: Icon, color }: {
  label: string; value: string | number; sub?: string;
  icon: React.ElementType; color: string;
}) {
  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
            <p className="text-2xl font-bold text-gray-900">{value}</p>
            {sub && <p className="text-xs text-gray-400">{sub}</p>}
          </div>
          <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${color}`}>
            <Icon className="h-5 w-5 text-white" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function SellerDashboard() {
  const [, navigate] = useLocation();

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: createQueryKey("/api/seller/stats"),
    queryFn: getQueryFn({ on401: "returnNull" }),
  });

  const { data: allOrders = [] } = useQuery({
    queryKey: createQueryKey("/api/seller/orders"),
    queryFn: getQueryFn({ on401: "returnNull" }),
  });

  // Revenue by month (last 6 months)
  const revenueByMonth = useMemo(() => {
    const map: Record<string, number> = {};
    for (let i = 5; i >= 0; i--) {
      const d = new Date(); d.setMonth(d.getMonth() - i);
      map[d.toLocaleDateString("en-US", { month: "short" })] = 0;
    }
    (allOrders as any[]).forEach((o) => {
      const key = new Date(o.createdAt).toLocaleDateString("en-US", { month: "short" });
      if (key in map) map[key] += parseFloat(o.total || "0") * USD_TO_BWP;
    });
    return Object.entries(map).map(([month, revenue]) => ({ month, revenue: parseFloat(revenue.toFixed(2)) }));
  }, [allOrders]);

  // Orders by status
  const ordersByStatus = useMemo(() => {
    const map: Record<string, number> = {};
    (allOrders as any[]).forEach((o) => { map[o.status] = (map[o.status] || 0) + 1; });
    const labels: Record<string, string> = {
      pending: "Pending", processing: "Processing", shipped: "Shipped",
      delivered: "Delivered", cancelled: "Cancelled", confirmed: "Confirmed",
      awaiting_confirmation: "Awaiting",
    };
    return Object.entries(map).map(([s, v]) => ({ name: labels[s] || s, value: v }));
  }, [allOrders]);

  // Order volume last 14 days
  const ordersByDay = useMemo(() => {
    const map: Record<string, number> = {};
    for (let i = 13; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      map[d.toLocaleDateString("en-US", { month: "short", day: "numeric" })] = 0;
    }
    (allOrders as any[]).forEach((o) => {
      const key = new Date(o.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" });
      if (key in map) map[key]++;
    });
    return Object.entries(map).map(([day, orders]) => ({ day, orders }));
  }, [allOrders]);

  const recentOrders = stats?.recentOrders ?? [];
  const totalRevenueBWP = parseFloat(stats?.totalRevenue ?? "0") * USD_TO_BWP;

  return (
    <SellerLayout
      title="Overview"
      action={
        <Button onClick={() => navigate("/seller/products/new")} size="sm" className="gap-2">
          <Plus className="h-4 w-4" /> Add Product
        </Button>
      }
    >
      {() => (
        <div className="space-y-6">
          {/* Stat cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard
              label="Products"
              value={statsLoading ? "—" : stats?.totalProducts ?? 0}
              sub="in your store"
              icon={Package}
              color="bg-blue-500"
            />
            <StatCard
              label="Orders"
              value={statsLoading ? "—" : stats?.totalOrders ?? 0}
              sub={`${(allOrders as any[]).filter((o: any) => o.status === "awaiting_confirmation").length} pending`}
              icon={ShoppingCart}
              color="bg-emerald-500"
            />
            <StatCard
              label="Revenue"
              value={statsLoading ? "—" : `P ${totalRevenueBWP.toLocaleString("en-BW", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              sub="all time (BWP)"
              icon={DollarSign}
              color="bg-amber-500"
            />
          </div>

          {/* Charts row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Revenue bar */}
            <Card className="col-span-1 lg:col-span-2 border-0 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-gray-700">Revenue — Last 6 Months (BWP)</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={revenueByMonth} margin={{ top: 4, right: 8, left: -4, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} tickFormatter={(v) => `P${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`} />
                    <ChartTooltip formatter={(v: number) => [`P ${v.toLocaleString("en-BW", { minimumFractionDigits: 2 })}`, "Revenue"]} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                    <Bar dataKey="revenue" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Orders by status pie */}
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-gray-700">Orders by Status</CardTitle>
              </CardHeader>
              <CardContent>
                {ordersByStatus.length > 0 ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie data={ordersByStatus} cx="50%" cy="45%" innerRadius={50} outerRadius={75} paddingAngle={3} dataKey="value">
                        {ordersByStatus.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                      </Pie>
                      <ChartTooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                      <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[220px] text-gray-400 text-sm">No orders yet</div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Order activity area */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-gray-700">Order Activity — Last 14 Days</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={140}>
                <AreaChart data={ordersByDay} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="sellerOrderGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="day" tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} interval={1} />
                  <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <ChartTooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <Area type="monotone" dataKey="orders" stroke="#10b981" strokeWidth={2} fill="url(#sellerOrderGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Recent orders */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-sm font-semibold text-gray-700">Recent Orders</CardTitle>
              <Button variant="ghost" size="sm" className="text-xs text-emerald-600 gap-1" onClick={() => navigate("/seller/orders")}>
                View all <ArrowRight className="h-3 w-3" />
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              {recentOrders.length === 0 ? (
                <p className="text-center text-sm text-gray-400 py-10">
                  No orders yet. Share your products to get your first sale!
                </p>
              ) : (
                <div className="divide-y divide-gray-50">
                  {recentOrders.map((order: any) => (
                    <div key={order.id} className="flex items-center justify-between px-6 py-3 hover:bg-gray-50/50 transition-colors">
                      <div>
                        <p className="text-sm font-medium text-gray-800">Order #{order.id}</p>
                        <p className="text-xs text-gray-400">{order.firstName} {order.lastName} · {new Date(order.createdAt).toLocaleDateString()}</p>
                      </div>
                      <div className="text-right space-y-1">
                        <Badge className={`text-xs ${STATUS_COLOR[order.status] ?? "bg-gray-100"}`}>
                          {order.status.replace(/_/g, " ")}
                        </Badge>
                        <p className="text-sm font-bold text-gray-800">{fmtBWP(order.total)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </SellerLayout>
  );
}
