import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { isUnauthorizedError } from "@/lib/authUtils";
import { BASE_URL } from "@/lib/queryClient";
import {
  Package, ShoppingCart, Users, DollarSign, Mail, Plus, Edit, Trash2, X,
  Image as ImageIcon, Link, Palette, Ruler, RefreshCw, CheckCircle2,
  AlertCircle, Tractor, Store, CheckCircle, XCircle, Menu, TrendingUp,
  LayoutDashboard, LogOut, Activity, Bell, ExternalLink,
} from "lucide-react";
import CloudinaryUpload from "@/components/CloudinaryUpload";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ChartTooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend, AreaChart, Area,
} from "recharts";
import type { Product, Order, ContactMessage } from "@shared/schema";

// ── Schemas ──────────────────────────────────────────────────────────────────
const productSchema = z.object({
  name: z.string().min(1, "Product name is required"),
  slug: z.string().min(1, "Product slug is required"),
  description: z.string().optional(),
  price: z.string().min(1, "Price is required"),
  originalPrice: z.string().optional(),
  categoryId: z.number().optional(),
  images: z.array(z.string()).default([]),
  sizes: z.array(z.string()).default([]),
  colors: z.array(z.string()).default([]),
  stock: z.number().min(0),
  featured: z.boolean().default(false),
  active: z.boolean().default(true),
  status: z.enum(["active", "inactive", "sold", "out_of_stock"]).default("active"),
  supplierUrl: z.string().url().optional().or(z.literal("")),
});
const orderStatusSchema = z.object({
  status: z.enum(["awaiting_confirmation", "confirmed", "pending", "processing", "shipped", "delivered", "cancelled"]),
});
const messageStatusSchema = z.object({
  status: z.enum(["unread", "read", "replied"]),
});
type ProductFormData = z.infer<typeof productSchema>;

type Section = "overview" | "products" | "orders" | "messages" | "sellers" | "farm" | "kgotla";

// ── Chart colours ─────────────────────────────────────────────────────────────
const PIE_COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];
const STATUS_LABEL: Record<string, string> = {
  pending: "Pending", processing: "Processing", shipped: "Shipped",
  delivered: "Delivered", cancelled: "Cancelled", confirmed: "Confirmed",
  awaiting_confirmation: "Awaiting",
};

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, icon: Icon, color, sub }: {
  label: string; value: string | number; icon: React.ElementType;
  color: string; sub?: string;
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

// ── Sidebar nav item ──────────────────────────────────────────────────────────
function NavItem({ icon: Icon, label, active, badge, onClick }: {
  icon: React.ElementType; label: string; active: boolean;
  badge?: number; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
        active
          ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
          : "text-slate-400 hover:bg-slate-800 hover:text-white"
      }`}
    >
      <Icon className="h-4 w-4 flex-shrink-0" />
      <span className="flex-1 text-left">{label}</span>
      {badge ? (
        <span className="bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
          {badge > 9 ? "9+" : badge}
        </span>
      ) : null}
    </button>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function Admin() {
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [section, setSection] = useState<Section>("overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [isProductDialogOpen, setIsProductDialogOpen] = useState(false);
  const [isOrderDialogOpen, setIsOrderDialogOpen] = useState(false);
  const [isMessageDialogOpen, setIsMessageDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [editingMessage, setEditingMessage] = useState<ContactMessage | null>(null);
  const [newSize, setNewSize] = useState("");
  const [newColor, setNewColor] = useState("");
  const [supplierUrl, setSupplierUrl] = useState("");
  const [syncResult, setSyncResult] = useState<{ created: number; updated: number; deactivated: number } | null>(null);
  const [kgotlaSyncResult, setKgotlaSyncResult] = useState<{ created: number; updated: number; deactivated: number } | null>(null);

  const productForm = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: "", slug: "", description: "", price: "", originalPrice: "",
      categoryId: undefined, images: [], sizes: [], colors: [],
      stock: 0, featured: false, active: true, status: "active", supplierUrl: "",
    },
  });
  const orderForm = useForm<z.infer<typeof orderStatusSchema>>({
    resolver: zodResolver(orderStatusSchema),
    defaultValues: { status: "pending" },
  });
  const messageForm = useForm<z.infer<typeof messageStatusSchema>>({
    resolver: zodResolver(messageStatusSchema),
    defaultValues: { status: "unread" },
  });

  const watchedImages = productForm.watch("images");
  const watchedSizes = productForm.watch("sizes");
  const watchedColors = productForm.watch("colors");
  const watchedStock = productForm.watch("stock");
  const watchedStatus = productForm.watch("status");

  useEffect(() => {
    if (watchedStock === 0 && watchedStatus !== "sold") productForm.setValue("status", "out_of_stock");
    else if (watchedStock > 0 && watchedStatus === "out_of_stock") productForm.setValue("status", "active");
  }, [watchedStock, watchedStatus]);

  useEffect(() => {
    const sub = productForm.watch((value, { name }) => {
      if (name === "name" && value.name && !editingProduct) {
        productForm.setValue("slug", value.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, ""));
      }
    });
    return () => sub.unsubscribe();
  }, [productForm, editingProduct]);

  useEffect(() => {
    if (!authLoading && (!user || !user.isAdmin)) {
      toast({ title: "Unauthorized", variant: "destructive" });
      setTimeout(() => { window.location.href = "/"; }, 1000);
    }
  }, [user, authLoading]);

  // ── Queries ─────────────────────────────────────────────────────────────────
  const { data: stats } = useQuery({ queryKey: ["/api/admin/stats"] });
  const { data: products = [] } = useQuery({
    queryKey: ["/api/products"],
    queryFn: async () => (await fetch(`${BASE_URL}/api/products`)).json(),
  });
  const { data: categories = [] } = useQuery({
    queryKey: ["/api/categories"],
    queryFn: async () => (await fetch(`${BASE_URL}/api/categories`)).json(),
  });
  const { data: orders = [] } = useQuery({ queryKey: ["/api/orders"], retry: false });
  const { data: messages = [] } = useQuery({ queryKey: ["/api/contact"], retry: false });
  const { data: sellers = [], refetch: refetchSellers } = useQuery({ queryKey: ["/api/admin/sellers"], retry: false });
  const { data: ermStatus, refetch: refetchErmStatus } = useQuery({
    queryKey: ["/api/erm/status"],
    queryFn: async () => {
      const res = await fetch(`${BASE_URL}/api/erm/status`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    retry: false,
  });
  const { data: kgotlaStatus, refetch: refetchKgotlaStatus } = useQuery({
    queryKey: ["/api/kgotla/status"],
    queryFn: async () => {
      const res = await fetch(`${BASE_URL}/api/kgotla/status`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    retry: false,
  });

  // ── Chart data derived client-side ───────────────────────────────────────
  const revenueByMonth = useMemo(() => {
    const months: Record<string, number> = {};
    for (let i = 5; i >= 0; i--) {
      const d = new Date(); d.setMonth(d.getMonth() - i);
      months[d.toLocaleDateString("en-US", { month: "short" })] = 0;
    }
    (orders as Order[]).forEach((o) => {
      const key = new Date(o.createdAt!).toLocaleDateString("en-US", { month: "short" });
      if (key in months) months[key] += parseFloat(o.total) || 0;
    });
    return Object.entries(months).map(([month, revenue]) => ({ month, revenue: parseFloat(revenue.toFixed(2)) }));
  }, [orders]);

  const ordersByStatus = useMemo(() => {
    const map: Record<string, number> = {};
    (orders as Order[]).forEach((o) => { map[o.status] = (map[o.status] || 0) + 1; });
    return Object.entries(map).map(([status, count]) => ({ name: STATUS_LABEL[status] || status, value: count }));
  }, [orders]);

  const ordersByDay = useMemo(() => {
    const map: Record<string, number> = {};
    for (let i = 13; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      map[d.toLocaleDateString("en-US", { month: "short", day: "numeric" })] = 0;
    }
    (orders as Order[]).forEach((o) => {
      const key = new Date(o.createdAt!).toLocaleDateString("en-US", { month: "short", day: "numeric" });
      if (key in map) map[key]++;
    });
    return Object.entries(map).map(([day, orders]) => ({ day, orders }));
  }, [orders]);

  const unreadCount = (messages as ContactMessage[]).filter((m) => m.status === "unread").length;
  const pendingSellers = (sellers as any[]).filter((s) => s.status === "pending").length;
  const pendingOrders = (orders as Order[]).filter((o) => o.status === "awaiting_confirmation").length;

  // ── Mutations ────────────────────────────────────────────────────────────────
  const productMutation = useMutation({
    mutationFn: async (data: ProductFormData) => {
      const url = editingProduct ? `/api/products/${editingProduct.id}` : "/api/products";
      await apiRequest(editingProduct ? "PUT" : "POST", url, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      setIsProductDialogOpen(false); setEditingProduct(null); productForm.reset();
      setNewSize(""); setNewColor(""); setSupplierUrl("");
      toast({ title: editingProduct ? "Product updated" : "Product created" });
    },
    onError: (e) => toast({ title: "Error", description: (e as Error).message, variant: "destructive" }),
  });

  const deleteProductMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/products/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      toast({ title: "Product deleted" });
    },
    onError: (e) => toast({ title: "Error", description: (e as Error).message, variant: "destructive" }),
  });

  const updateOrderMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) =>
      apiRequest("PUT", `/api/orders/${id}/status`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      setIsOrderDialogOpen(false); setEditingOrder(null);
      toast({ title: "Order updated" });
    },
    onError: (e) => toast({ title: "Error", description: (e as Error).message, variant: "destructive" }),
  });

  const deleteOrderMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/orders/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      toast({ title: "Order deleted" });
    },
    onError: (e) => toast({ title: "Error", description: (e as Error).message, variant: "destructive" }),
  });

  const confirmReservationMutation = useMutation({
    mutationFn: ({ id, action }: { id: number; action: "confirmed" | "cancelled" }) =>
      apiRequest("PUT", `/api/orders/${id}/status`, { status: action }),
    onSuccess: (_, { action }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      toast({ title: action === "confirmed" ? "Reservation confirmed" : "Reservation rejected" });
    },
    onError: (e) => toast({ title: "Error", description: (e as Error).message, variant: "destructive" }),
  });

  const resendToERMMutation = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/admin/orders/${id}/notify-erm`, {}),
    onSuccess: (_, id) => toast({ title: "Sent to ERM", description: `Order #${id} resent.` }),
    onError: (e) => toast({ title: "Failed", description: (e as Error).message, variant: "destructive" }),
  });

  const updateMessageMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      apiRequest("PUT", `/api/contact/${id}/status`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contact"] });
      setIsMessageDialogOpen(false); setEditingMessage(null);
      toast({ title: "Message updated" });
    },
    onError: (e) => toast({ title: "Error", description: (e as Error).message, variant: "destructive" }),
  });

  const deleteMessageMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/contact/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contact"] });
      toast({ title: "Message deleted" });
    },
    onError: (e) => toast({ title: "Error", description: (e as Error).message, variant: "destructive" }),
  });

  const sellerStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      apiRequest("PUT", `/api/admin/sellers/${id}/status`, { status }),
    onSuccess: () => { refetchSellers(); toast({ title: "Seller status updated." }); },
    onError: () => toast({ title: "Failed to update seller.", variant: "destructive" }),
  });

  const ermSyncMutation = useMutation({
    mutationFn: async () => (await apiRequest("POST", "/api/erm/sync")).json(),
    onSuccess: (data) => {
      const s = data.summary ?? data;
      setSyncResult({ created: s.created ?? 0, updated: s.updated ?? 0, deactivated: s.deactivated ?? 0 });
      refetchErmStatus(); queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({ title: "ERM sync complete", description: `${s.created ?? 0} created, ${s.updated ?? 0} updated, ${s.deactivated ?? 0} deactivated.` });
    },
    onError: (e) => toast({ title: "Sync failed", description: (e as Error).message, variant: "destructive" }),
  });
  const kgotlaSyncMutation = useMutation({
    mutationFn: async () => (await apiRequest("POST", "/api/kgotla/sync")).json(),
    onSuccess: (data) => {
      const s = data.summary ?? data;
      setKgotlaSyncResult({ created: s.created ?? 0, updated: s.updated ?? 0, deactivated: s.deactivated ?? 0 });
      refetchKgotlaStatus(); queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({ title: "Kgotla sync complete", description: `${s.created ?? 0} created, ${s.updated ?? 0} updated, ${s.deactivated ?? 0} deactivated.` });
    },
    onError: (e) => toast({ title: "Kgotla sync failed", description: (e as Error).message, variant: "destructive" }),
  });

  // ── Handlers ─────────────────────────────────────────────────────────────────
  function handleEditProduct(p: Product) {
    setEditingProduct(p);
    productForm.reset({
      name: p.name, slug: p.slug, description: p.description || "",
      price: p.price, originalPrice: p.originalPrice || "",
      categoryId: p.categoryId || undefined, images: p.images || [],
      sizes: p.sizes || [], colors: p.colors || [], stock: p.stock || 0,
      featured: p.featured || false, active: p.active ?? true,
      status: (p as any).status || "active", supplierUrl: (p as any).supplierUrl || "",
    });
    setSupplierUrl((p as any).supplierUrl || "");
    setIsProductDialogOpen(true);
  }

  function getStatusBadge(status: string, stock: number) {
    if (status === "sold") return <Badge variant="destructive">Sold</Badge>;
    if (status === "out_of_stock" || stock === 0) return <Badge variant="secondary">Out of Stock</Badge>;
    if (status === "inactive") return <Badge variant="outline" className="text-gray-600">Inactive</Badge>;
    return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">Active</Badge>;
  }

  function go(s: Section) { setSection(s); setSidebarOpen(false); }

  if (authLoading || !user?.isAdmin) return null;

  // ── Sidebar ───────────────────────────────────────────────────────────────────
  const sidebar = (
    <aside className="flex flex-col h-full bg-slate-900 text-white">
      {/* Logo */}
      <div className="px-4 py-5 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center text-white font-bold text-sm">F</div>
          <div>
            <p className="font-bold text-white text-sm leading-none">Fountstream</p>
            <p className="text-xs text-slate-400 mt-0.5">Admin Dashboard</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <p className="text-xs text-slate-500 uppercase tracking-widest px-3 mb-2">Main</p>
        <NavItem icon={LayoutDashboard} label="Overview" active={section === "overview"} onClick={() => go("overview")} />
        <NavItem icon={Package} label="Products" active={section === "products"} onClick={() => go("products")} />
        <NavItem icon={ShoppingCart} label="Orders" active={section === "orders"} badge={pendingOrders || undefined} onClick={() => go("orders")} />
        <p className="text-xs text-slate-500 uppercase tracking-widest px-3 pt-4 mb-2">Manage</p>
        <NavItem icon={Mail} label="Messages" active={section === "messages"} badge={unreadCount || undefined} onClick={() => go("messages")} />
        <NavItem icon={Store} label="Sellers" active={section === "sellers"} badge={pendingSellers || undefined} onClick={() => go("sellers")} />
        <NavItem icon={Tractor} label="Farm Market" active={section === "farm"} onClick={() => go("farm")} />
        <NavItem icon={Store} label="Kgotla Market" active={section === "kgotla"} onClick={() => go("kgotla")} />
      </nav>

      {/* Bottom */}
      <div className="px-3 py-4 border-t border-slate-800 space-y-1">
        <a href="/" className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-slate-400 hover:bg-slate-800 hover:text-white transition-all">
          <ExternalLink className="h-4 w-4" /> View Store
        </a>
        <div className="flex items-center gap-3 px-3 py-2">
          <div className="w-7 h-7 rounded-full bg-emerald-500 flex items-center justify-center text-xs font-bold">
            {user.firstName?.[0] ?? "A"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-white truncate">{user.firstName} {user.lastName}</p>
            <p className="text-xs text-slate-500 truncate">{user.email}</p>
          </div>
        </div>
      </div>
    </aside>
  );

  // ── Overview section ──────────────────────────────────────────────────────────
  const overviewSection = (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Products" value={(stats as any)?.totalProducts ?? products.length} icon={Package} color="bg-blue-500" sub="in catalogue" />
        <StatCard label="Total Orders" value={(stats as any)?.totalOrders ?? orders.length} icon={ShoppingCart} color="bg-emerald-500" sub={`${pendingOrders} pending`} />
        <StatCard label="Customers" value={(stats as any)?.totalCustomers ?? "—"} icon={Users} color="bg-violet-500" sub="registered users" />
        <StatCard label="Revenue" value={`$${((stats as any)?.revenue ?? 0).toFixed(2)}`} icon={DollarSign} color="bg-amber-500" sub="all time" />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Revenue bar chart */}
        <Card className="col-span-1 lg:col-span-2 border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-gray-700">Revenue — Last 6 Months</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={revenueByMonth} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} />
                <ChartTooltip formatter={(v: number) => [`$${v.toFixed(2)}`, "Revenue"]} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Bar dataKey="revenue" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Order status pie */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-gray-700">Orders by Status</CardTitle>
          </CardHeader>
          <CardContent>
            {ordersByStatus.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={ordersByStatus} cx="50%" cy="45%" innerRadius={55} outerRadius={80} paddingAngle={3} dataKey="value">
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

      {/* Order activity area chart */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-gray-700">Order Activity — Last 14 Days</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={ordersByDay} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
              <defs>
                <linearGradient id="orderGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="day" tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} interval={1} />
              <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} allowDecimals={false} />
              <ChartTooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              <Area type="monotone" dataKey="orders" stroke="#10b981" strokeWidth={2} fill="url(#orderGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Recent orders */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-semibold text-gray-700">Recent Orders</CardTitle>
          <Button variant="ghost" size="sm" className="text-xs text-emerald-600" onClick={() => setSection("orders")}>View all</Button>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-gray-100">
                  <TableHead className="text-xs pl-6">Order</TableHead>
                  <TableHead className="text-xs">Customer</TableHead>
                  <TableHead className="text-xs">Total</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                  <TableHead className="text-xs pr-6 hidden sm:table-cell">Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(orders as Order[]).slice(0, 5).map((o) => (
                  <TableRow key={o.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                    <TableCell className="pl-6 font-mono text-xs text-gray-500">#{o.id}</TableCell>
                    <TableCell className="text-sm font-medium">{o.firstName} {o.lastName}</TableCell>
                    <TableCell className="text-sm font-semibold">${o.total}</TableCell>
                    <TableCell>
                      <Badge className={`text-xs ${
                        o.status === "delivered" ? "bg-emerald-100 text-emerald-700"
                        : o.status === "awaiting_confirmation" ? "bg-amber-100 text-amber-700"
                        : o.status === "cancelled" ? "bg-red-100 text-red-700"
                        : "bg-blue-100 text-blue-700"
                      }`}>{STATUS_LABEL[o.status] || o.status}</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-gray-400 pr-6 hidden sm:table-cell">{new Date(o.createdAt!).toLocaleDateString()}</TableCell>
                  </TableRow>
                ))}
                {orders.length === 0 && (
                  <TableRow><TableCell colSpan={5} className="text-center text-sm text-gray-400 py-8">No orders yet</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  // ── Products section ──────────────────────────────────────────────────────────
  const productDialog = (
    <Dialog open={isProductDialogOpen} onOpenChange={setIsProductDialogOpen}>
      <DialogTrigger asChild>
        <Button onClick={() => { setEditingProduct(null); productForm.reset(); setNewSize(""); setNewColor(""); setSupplierUrl(""); }} className="gap-2">
          <Plus className="h-4 w-4" /> Add Product
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editingProduct ? "Edit Product" : "Add New Product"}</DialogTitle>
        </DialogHeader>
        <Form {...productForm}>
          <form onSubmit={productForm.handleSubmit((d) => productMutation.mutate({ ...d, supplierUrl: supplierUrl || undefined }))} className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <FormField control={productForm.control} name="name" render={({ field }) => (
                <FormItem><FormLabel>Product Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={productForm.control} name="slug" render={({ field }) => (
                <FormItem><FormLabel>Slug</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
            </div>
            <FormField control={productForm.control} name="description" render={({ field }) => (
              <FormItem><FormLabel>Description</FormLabel><FormControl><Textarea {...field} rows={3} /></FormControl><FormMessage /></FormItem>
            )} />
            <div className="grid grid-cols-3 gap-4">
              <FormField control={productForm.control} name="price" render={({ field }) => (
                <FormItem><FormLabel>Price</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={productForm.control} name="originalPrice" render={({ field }) => (
                <FormItem><FormLabel>Original Price</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={productForm.control} name="categoryId" render={({ field }) => (
                <FormItem><FormLabel>Category</FormLabel>
                  <Select onValueChange={(v) => field.onChange(Number(v))} value={field.value?.toString()}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger></FormControl>
                    <SelectContent>{(categories as any[]).map((c: any) => <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>)}</SelectContent>
                  </Select><FormMessage />
                </FormItem>
              )} />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium flex items-center gap-2"><Link className="h-4 w-4" />Supplier URL</label>
              <Input type="url" placeholder="https://supplier.com/product" value={supplierUrl} onChange={(e) => setSupplierUrl(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormField control={productForm.control} name="stock" render={({ field }) => (
                <FormItem><FormLabel>Stock</FormLabel><FormControl><Input type="number" {...field} onChange={(e) => field.onChange(Number(e.target.value))} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={productForm.control} name="status" render={({ field }) => (
                <FormItem><FormLabel>Status</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                      <SelectItem value="sold">Sold</SelectItem>
                      <SelectItem value="out_of_stock">Out of Stock</SelectItem>
                    </SelectContent>
                  </Select><FormMessage />
                </FormItem>
              )} />
            </div>
            <div className="space-y-2">
              <FormLabel className="flex items-center gap-2"><ImageIcon className="h-4 w-4" />Product Images</FormLabel>
              <CloudinaryUpload images={watchedImages ?? []} onChange={(urls) => productForm.setValue("images", urls)} />
            </div>
            <div className="space-y-3">
              <FormLabel className="flex items-center gap-2"><Ruler className="h-4 w-4" />Available Sizes</FormLabel>
              <div className="flex gap-2">
                <Input placeholder="S, M, L, XL…" value={newSize} onChange={(e) => setNewSize(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), newSize.trim() && (productForm.setValue("sizes", [...(productForm.getValues("sizes") || []), newSize.trim()]), setNewSize("")))} />
                <Button type="button" variant="outline" onClick={() => { if (newSize.trim()) { productForm.setValue("sizes", [...(productForm.getValues("sizes") || []), newSize.trim()]); setNewSize(""); } }}>Add</Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {(watchedSizes || []).map((s, i) => (
                  <Badge key={i} variant="secondary" className="gap-1">{s}
                    <button type="button" onClick={() => productForm.setValue("sizes", (watchedSizes || []).filter((_, j) => j !== i))}><X className="h-3 w-3" /></button>
                  </Badge>
                ))}
              </div>
            </div>
            <div className="space-y-3">
              <FormLabel className="flex items-center gap-2"><Palette className="h-4 w-4" />Available Colors</FormLabel>
              <div className="flex gap-2">
                <Input placeholder="Red, Blue…" value={newColor} onChange={(e) => setNewColor(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), newColor.trim() && (productForm.setValue("colors", [...(productForm.getValues("colors") || []), newColor.trim()]), setNewColor("")))} />
                <Button type="button" variant="outline" onClick={() => { if (newColor.trim()) { productForm.setValue("colors", [...(productForm.getValues("colors") || []), newColor.trim()]); setNewColor(""); } }}>Add</Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {(watchedColors || []).map((c, i) => (
                  <Badge key={i} variant="secondary" className="gap-1">{c}
                    <button type="button" onClick={() => productForm.setValue("colors", (watchedColors || []).filter((_, j) => j !== i))}><X className="h-3 w-3" /></button>
                  </Badge>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-6">
              <FormField control={productForm.control} name="featured" render={({ field }) => (
                <FormItem className="flex items-center gap-2 space-y-0"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><FormLabel className="font-normal">Featured</FormLabel></FormItem>
              )} />
              <FormField control={productForm.control} name="active" render={({ field }) => (
                <FormItem className="flex items-center gap-2 space-y-0"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><FormLabel className="font-normal">Active</FormLabel></FormItem>
              )} />
            </div>
            <Button type="submit" className="w-full" disabled={productMutation.isPending}>
              {productMutation.isPending ? "Saving…" : editingProduct ? "Update Product" : "Create Product"}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );

  const productsSection = (
    <Card className="border-0 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Products ({products.length})</CardTitle>
        {productDialog}
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-b border-gray-100">
              <TableHead className="pl-6 text-xs">Product</TableHead>
              <TableHead className="text-xs hidden md:table-cell">Category</TableHead>
              <TableHead className="text-xs">Price</TableHead>
              <TableHead className="text-xs">Stock</TableHead>
              <TableHead className="text-xs hidden sm:table-cell">Status</TableHead>
              <TableHead className="text-xs pr-6">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(products as Product[]).map((p) => (
              <TableRow key={p.id} className="hover:bg-gray-50/50 border-b border-gray-50">
                <TableCell className="pl-6">
                  <div className="flex items-center gap-3">
                    <img src={p.images?.[0] || "https://placehold.co/40x40/e5e7eb/9ca3af?text=?"} alt={p.name} className="w-9 h-9 rounded-lg object-cover" />
                    <div>
                      <p className="text-sm font-medium">{p.name}</p>
                      <p className="text-xs text-gray-400">#{p.id}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-sm text-gray-600 hidden md:table-cell">{(categories as any[]).find((c: any) => c.id === p.categoryId)?.name || "—"}</TableCell>
                <TableCell>
                  <p className="text-sm font-semibold">${p.price}</p>
                  {p.originalPrice && <p className="text-xs text-gray-400 line-through">${p.originalPrice}</p>}
                </TableCell>
                <TableCell>
                  <Badge variant={p.stock > 0 ? "outline" : "destructive"} className="text-xs">{p.stock > 0 ? `${p.stock}` : "0"}</Badge>
                </TableCell>
                <TableCell className="hidden sm:table-cell">
                  <div className="flex gap-1 flex-wrap">
                    {p.featured && <Badge className="text-xs bg-amber-100 text-amber-700">Featured</Badge>}
                    {getStatusBadge((p as any).status || "active", p.stock)}
                  </div>
                </TableCell>
                <TableCell className="pr-6">
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => handleEditProduct(p)}><Edit className="h-3.5 w-3.5" /></Button>
                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-red-500 hover:text-red-700" onClick={() => confirm("Delete product?") && deleteProductMutation.mutate(p.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    {(p as any).supplierUrl && <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => window.open((p as any).supplierUrl, "_blank")}><ExternalLink className="h-3.5 w-3.5" /></Button>}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        </div>
      </CardContent>
    </Card>
  );

  // ── Orders section ────────────────────────────────────────────────────────────
  const ordersSection = (
    <Card className="border-0 shadow-sm">
      <CardHeader>
        <CardTitle className="text-base">Orders ({orders.length})</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-b border-gray-100">
              <TableHead className="pl-6 text-xs">ID</TableHead>
              <TableHead className="text-xs">Customer</TableHead>
              <TableHead className="text-xs">Total</TableHead>
              <TableHead className="text-xs">Status</TableHead>
              <TableHead className="text-xs hidden sm:table-cell">Date</TableHead>
              <TableHead className="text-xs pr-6">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(orders as Order[]).map((o) => {
              const isReservation = o.status === "awaiting_confirmation";
              const isFarm = !!(o as any).fulfillmentType;
              const isCashPending = (o as any).paymentMethod === "cash" && o.status === "pending";
              return (
                <TableRow key={o.id} className={`hover:bg-gray-50/50 border-b border-gray-50 ${isReservation ? "bg-amber-50/50" : isCashPending ? "bg-orange-50/40" : ""}`}>
                  <TableCell className="pl-6 font-mono text-xs text-gray-500">#{o.id}</TableCell>
                  <TableCell>
                    <p className="text-sm font-medium">{o.firstName} {o.lastName}</p>
                    <p className="text-xs text-gray-400">{o.email}</p>
                  </TableCell>
                  <TableCell>
                    <p className="text-sm font-semibold">${o.total}</p>
                    {(o as any).depositAmount && <p className="text-xs text-amber-600">Deposit: ${(o as any).depositAmount}</p>}
                    {isCashPending && <span className="text-xs font-medium text-orange-600 bg-orange-100 rounded px-1.5 py-0.5 mt-0.5 inline-block">Cash due</span>}
                  </TableCell>
                  <TableCell>
                    <Badge className={`text-xs ${
                      o.status === "delivered" ? "bg-emerald-100 text-emerald-700"
                      : o.status === "awaiting_confirmation" ? "bg-amber-100 text-amber-700"
                      : o.status === "cancelled" ? "bg-red-100 text-red-700"
                      : o.status === "confirmed" ? "bg-green-100 text-green-700"
                      : "bg-blue-100 text-blue-700"
                    }`}>{STATUS_LABEL[o.status] || o.status}</Badge>
                  </TableCell>
                  <TableCell className="text-xs text-gray-400 hidden sm:table-cell">{new Date(o.createdAt!).toLocaleDateString()}</TableCell>
                  <TableCell className="pr-6">
                    <div className="flex gap-1 flex-wrap">
                      {isReservation && <>
                        <Button size="sm" className="h-7 px-2 text-xs bg-emerald-600 hover:bg-emerald-700" onClick={() => confirmReservationMutation.mutate({ id: o.id, action: "confirmed" })}>Confirm</Button>
                        <Button size="sm" variant="destructive" className="h-7 px-2 text-xs" onClick={() => confirmReservationMutation.mutate({ id: o.id, action: "cancelled" })}>Reject</Button>
                      </>}
                      {isFarm && <Button size="sm" variant="outline" className="h-7 px-2 text-xs border-orange-300 text-orange-600" onClick={() => resendToERMMutation.mutate(o.id)}>
                        <RefreshCw className="h-3 w-3 mr-1" />ERM
                      </Button>}
                      <Dialog open={isOrderDialogOpen} onOpenChange={setIsOrderDialogOpen}>
                        <DialogTrigger asChild>
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => { setEditingOrder(o); orderForm.reset({ status: o.status }); setIsOrderDialogOpen(true); }}><Edit className="h-3.5 w-3.5" /></Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader><DialogTitle>Update Order #{editingOrder?.id}</DialogTitle></DialogHeader>
                          <Form {...orderForm}>
                            <form onSubmit={orderForm.handleSubmit((d) => editingOrder && updateOrderMutation.mutate({ id: editingOrder.id, status: d.status }))} className="space-y-4">
                              <FormField control={orderForm.control} name="status" render={({ field }) => (
                                <FormItem><FormLabel>Status</FormLabel>
                                  <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                    <SelectContent>
                                      {["awaiting_confirmation","confirmed","pending","processing","shipped","delivered","cancelled"].map((s) => <SelectItem key={s} value={s}>{STATUS_LABEL[s] || s}</SelectItem>)}
                                    </SelectContent>
                                  </Select><FormMessage />
                                </FormItem>
                              )} />
                              <Button type="submit" className="w-full" disabled={updateOrderMutation.isPending}>Update</Button>
                            </form>
                          </Form>
                        </DialogContent>
                      </Dialog>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-500" onClick={() => confirm("Delete order?") && deleteOrderMutation.mutate(o.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        </div>
      </CardContent>
    </Card>
  );

  // ── Messages section ──────────────────────────────────────────────────────────
  const messagesSection = (
    <Card className="border-0 shadow-sm">
      <CardHeader><CardTitle className="text-base">Contact Messages</CardTitle></CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-b border-gray-100">
              <TableHead className="pl-6 text-xs">Name</TableHead>
              <TableHead className="text-xs hidden md:table-cell">Email</TableHead>
              <TableHead className="text-xs">Subject</TableHead>
              <TableHead className="text-xs">Status</TableHead>
              <TableHead className="text-xs hidden sm:table-cell">Date</TableHead>
              <TableHead className="text-xs pr-6">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(messages as ContactMessage[]).map((m) => (
              <TableRow key={m.id} className={`hover:bg-gray-50/50 border-b border-gray-50 ${m.status === "unread" ? "font-medium" : ""}`}>
                <TableCell className="pl-6 text-sm">{m.name}</TableCell>
                <TableCell className="text-sm text-gray-600 hidden md:table-cell">{m.email}</TableCell>
                <TableCell className="text-sm max-w-[180px] truncate">{m.subject}</TableCell>
                <TableCell>
                  <Badge className={`text-xs ${m.status === "unread" ? "bg-red-100 text-red-700" : m.status === "replied" ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-600"}`}>{m.status}</Badge>
                </TableCell>
                <TableCell className="text-xs text-gray-400 hidden sm:table-cell">{new Date(m.createdAt!).toLocaleDateString()}</TableCell>
                <TableCell className="pr-6">
                  <div className="flex gap-1">
                    <Dialog open={isMessageDialogOpen} onOpenChange={setIsMessageDialogOpen}>
                      <DialogTrigger asChild>
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => { setEditingMessage(m); messageForm.reset({ status: m.status }); setIsMessageDialogOpen(true); }}><Edit className="h-3.5 w-3.5" /></Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader><DialogTitle>Message from {editingMessage?.name}</DialogTitle></DialogHeader>
                        {editingMessage && <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3 my-2">{(editingMessage as any).message}</p>}
                        <Form {...messageForm}>
                          <form onSubmit={messageForm.handleSubmit((d) => editingMessage && updateMessageMutation.mutate({ id: editingMessage.id, status: d.status }))} className="space-y-4">
                            <FormField control={messageForm.control} name="status" render={({ field }) => (
                              <FormItem><FormLabel>Status</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                  <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                  <SelectContent>
                                    <SelectItem value="unread">Unread</SelectItem>
                                    <SelectItem value="read">Read</SelectItem>
                                    <SelectItem value="replied">Replied</SelectItem>
                                  </SelectContent>
                                </Select><FormMessage />
                              </FormItem>
                            )} />
                            <Button type="submit" className="w-full" disabled={updateMessageMutation.isPending}>Update</Button>
                          </form>
                        </Form>
                      </DialogContent>
                    </Dialog>
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-500" onClick={() => confirm("Delete message?") && deleteMessageMutation.mutate(m.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        </div>
      </CardContent>
    </Card>
  );

  // ── Sellers section ───────────────────────────────────────────────────────────
  const sellersSection = (
    <Card className="border-0 shadow-sm">
      <CardHeader><CardTitle className="text-base">Seller Applications ({(sellers as any[]).length})</CardTitle></CardHeader>
      <CardContent className="p-0">
        {(sellers as any[]).length === 0 ? (
          <p className="text-center text-sm text-gray-400 py-10">No seller applications yet.</p>
        ) : (
          <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-b border-gray-100">
                <TableHead className="pl-6 text-xs">Store</TableHead>
                <TableHead className="text-xs hidden md:table-cell">Owner</TableHead>
                <TableHead className="text-xs hidden md:table-cell">Contact</TableHead>
                <TableHead className="text-xs hidden sm:table-cell">Applied</TableHead>
                <TableHead className="text-xs">Status</TableHead>
                <TableHead className="text-xs pr-6">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(sellers as any[]).map((s) => (
                <TableRow key={s.id} className="hover:bg-gray-50/50 border-b border-gray-50">
                  <TableCell className="pl-6">
                    <div className="flex items-center gap-2">
                      {s.logoUrl ? <img src={s.logoUrl} className="w-8 h-8 rounded-lg object-cover" alt="" />
                        : <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center"><Store className="h-4 w-4 text-gray-400" /></div>}
                      <div>
                        <p className="text-sm font-medium">{s.storeName}</p>
                        <p className="text-xs text-gray-400 max-w-[140px] truncate">{s.description}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <p className="text-sm">{s.user?.firstName} {s.user?.lastName}</p>
                    <p className="text-xs text-gray-400">{s.user?.email}</p>
                  </TableCell>
                  <TableCell className="hidden md:table-cell"><p className="text-xs">{s.phone}</p><p className="text-xs text-gray-400">{s.address}</p></TableCell>
                  <TableCell className="text-xs text-gray-400 hidden sm:table-cell">{new Date(s.createdAt).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <Badge className={`text-xs ${s.status === "approved" ? "bg-emerald-100 text-emerald-700" : s.status === "rejected" ? "bg-red-100 text-red-700" : s.status === "suspended" ? "bg-orange-100 text-orange-700" : "bg-amber-100 text-amber-700"}`}>{s.status}</Badge>
                  </TableCell>
                  <TableCell className="pr-6">
                    <div className="flex gap-1">
                      {s.status !== "approved" && <Button size="sm" className="h-7 px-2 text-xs bg-emerald-600 hover:bg-emerald-700 gap-1" disabled={sellerStatusMutation.isPending} onClick={() => sellerStatusMutation.mutate({ id: s.id, status: "approved" })}><CheckCircle className="h-3 w-3" />Approve</Button>}
                      {s.status === "approved" && <Button size="sm" variant="outline" className="h-7 px-2 text-xs border-orange-300 text-orange-600" disabled={sellerStatusMutation.isPending} onClick={() => sellerStatusMutation.mutate({ id: s.id, status: "suspended" })}>Suspend</Button>}
                      {s.status === "pending" && <Button size="sm" variant="destructive" className="h-7 px-2 text-xs gap-1" disabled={sellerStatusMutation.isPending} onClick={() => sellerStatusMutation.mutate({ id: s.id, status: "rejected" })}><XCircle className="h-3 w-3" />Reject</Button>}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );

  // ── Farm section ──────────────────────────────────────────────────────────────
  const farmSection = (
    <div className="space-y-4">
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Tractor className="h-4 w-4 text-emerald-600" />ERM Farm Marketplace Sync</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-gray-500">Pull the latest listings from ERM. New products are created, existing ones updated, sold-out listings deactivated.</p>
          <Button onClick={() => ermSyncMutation.mutate()} disabled={ermSyncMutation.isPending} className="bg-emerald-600 hover:bg-emerald-700 gap-2">
            <RefreshCw className={`h-4 w-4 ${ermSyncMutation.isPending ? "animate-spin" : ""}`} />
            {ermSyncMutation.isPending ? "Syncing…" : "Sync Now"}
          </Button>
          {syncResult && (
            <div className="flex gap-4 rounded-lg bg-emerald-50 border border-emerald-100 p-4 text-sm text-emerald-800">
              <CheckCircle2 className="h-5 w-5 flex-shrink-0" />
              <div><p className="font-semibold mb-1">Sync complete</p>
                <div className="flex gap-4 text-xs"><span><strong>{syncResult.created}</strong> created</span><span><strong>{syncResult.updated}</strong> updated</span><span><strong>{syncResult.deactivated}</strong> deactivated</span></div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      <Card className="border-0 shadow-sm">
        <CardHeader><CardTitle className="text-base">ERM Connection Status</CardTitle></CardHeader>
        <CardContent>
          {ermStatus ? (
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-2 text-emerald-600"><CheckCircle2 className="h-4 w-4" /><span className="font-medium">ERM API configured</span></div>
              <div className="grid grid-cols-2 gap-y-1.5 gap-x-6 text-xs text-gray-600">
                <span className="font-medium text-gray-700">API URL</span><span className="truncate">{ermStatus.ermApiUrl}</span>
                <span className="font-medium text-gray-700">Auto-sync</span><span>{ermStatus.autoSyncEnabled ? `Every ${ermStatus.syncIntervalMinutes} min` : "Disabled"}</span>
                <span className="font-medium text-gray-700">Order notifications</span><span>{ermStatus.orderNotifyEnabled ? "Enabled" : "Disabled"}</span>
              </div>
              {!ermStatus.autoSyncEnabled && (
                <div className="flex gap-2 rounded-md bg-amber-50 border border-amber-100 p-3 text-xs text-amber-700">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  <span>Set <strong>ERM_AUTO_SYNC=true</strong> in Render environment variables to enable auto-sync.</span>
                </div>
              )}
            </div>
          ) : <p className="text-sm text-gray-400">Loading…</p>}
        </CardContent>
      </Card>
    </div>
  );

  // ── Kgotla section ────────────────────────────────────────────────────────────
  const kgotlaSection = (
    <div className="space-y-4">
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Store className="h-4 w-4 text-blue-600" />
            Kgotla Marketplace Sync
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-gray-500">
            Pull the latest listings from Kgotla. New products are created, existing ones updated, and removed listings are deactivated. All Kgotla items are set to Cash on Delivery.
          </p>
          <Button
            onClick={() => kgotlaSyncMutation.mutate()}
            disabled={kgotlaSyncMutation.isPending}
            className="bg-blue-600 hover:bg-blue-700 gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${kgotlaSyncMutation.isPending ? "animate-spin" : ""}`} />
            {kgotlaSyncMutation.isPending ? "Syncing…" : "Sync Now"}
          </Button>
          {kgotlaSyncResult && (
            <div className="flex gap-4 rounded-lg bg-blue-50 border border-blue-100 p-4 text-sm text-blue-800">
              <CheckCircle2 className="h-5 w-5 flex-shrink-0" />
              <div>
                <p className="font-semibold mb-1">Sync complete</p>
                <div className="flex gap-4 text-xs">
                  <span><strong>{kgotlaSyncResult.created}</strong> created</span>
                  <span><strong>{kgotlaSyncResult.updated}</strong> updated</span>
                  <span><strong>{kgotlaSyncResult.deactivated}</strong> deactivated</span>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      <Card className="border-0 shadow-sm">
        <CardHeader><CardTitle className="text-base">Kgotla Connection Status</CardTitle></CardHeader>
        <CardContent>
          {kgotlaStatus ? (
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-2 text-blue-600">
                <CheckCircle2 className="h-4 w-4" />
                <span className="font-medium">Kgotla API configured</span>
              </div>
              <div className="grid grid-cols-2 gap-y-1.5 gap-x-6 text-xs text-gray-600">
                <span className="font-medium text-gray-700">API URL</span>
                <span className="truncate">{kgotlaStatus.kgotlaApiUrl}</span>
                <span className="font-medium text-gray-700">Auto-sync</span>
                <span>{kgotlaStatus.autoSyncEnabled ? `Every ${kgotlaStatus.syncIntervalMinutes} min` : "Disabled"}</span>
                <span className="font-medium text-gray-700">Order notifications</span>
                <span>{kgotlaStatus.orderNotifyEnabled ? "Enabled" : "Disabled"}</span>
                <span className="font-medium text-gray-700">Cloudinary images</span>
                <span>{kgotlaStatus.cloudinaryConfigured ? "Configured" : "Not configured"}</span>
              </div>
              {!kgotlaStatus.autoSyncEnabled && (
                <div className="flex gap-2 rounded-md bg-amber-50 border border-amber-100 p-3 text-xs text-amber-700">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  <span>Set <strong>KGOTLA_AUTO_SYNC=true</strong> in Render environment variables to enable auto-sync.</span>
                </div>
              )}
              {!kgotlaStatus.cloudinaryConfigured && (
                <div className="flex gap-2 rounded-md bg-amber-50 border border-amber-100 p-3 text-xs text-amber-700">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  <span>Set <strong>CLOUDINARY_CLOUD_NAME</strong> and <strong>CLOUDINARY_UPLOAD_PRESET</strong> to enable product images.</span>
                </div>
              )}
            </div>
          ) : <p className="text-sm text-gray-400">Loading…</p>}
        </CardContent>
      </Card>
    </div>
  );

  const SECTION_TITLES: Record<Section, string> = {
    overview: "Overview", products: "Products", orders: "Orders",
    messages: "Messages", sellers: "Sellers", farm: "Farm Market", kgotla: "Kgotla Market",
  };

  // ── Full layout ───────────────────────────────────────────────────────────────
  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Mobile overlay */}
      {sidebarOpen && <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-50 w-60 transform transition-transform duration-200 ease-in-out lg:relative lg:translate-x-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
        {sidebar}
      </div>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="flex items-center gap-4 px-4 md:px-6 py-4 bg-white border-b border-gray-100 flex-shrink-0">
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors">
            <Menu className="h-5 w-5 text-gray-600" />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-gray-900">{SECTION_TITLES[section]}</h1>
            <p className="text-xs text-gray-400">Fountstream Admin</p>
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button onClick={() => go("messages")} className="relative p-2 rounded-lg hover:bg-gray-100">
                <Bell className="h-5 w-5 text-gray-500" />
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
              </button>
            )}
            <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center text-xs font-bold text-white">
              {user.firstName?.[0] ?? "A"}
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {section === "overview" && overviewSection}
          {section === "products" && productsSection}
          {section === "orders" && ordersSection}
          {section === "messages" && messagesSection}
          {section === "sellers" && sellersSection}
          {section === "farm" && farmSection}
          {section === "kgotla" && kgotlaSection}
        </main>
      </div>
    </div>
  );
}
