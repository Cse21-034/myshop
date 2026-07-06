import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { getQueryFn, createQueryKey } from "@/lib/queryClient";
import {
  LayoutDashboard, Package, ShoppingCart, Store, ExternalLink,
  Menu, X, Plus, Clock, TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";

// ── Nav item ──────────────────────────────────────────────────────────────────
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

// ── Gate screens ──────────────────────────────────────────────────────────────
function NoSellerScreen() {
  const [, navigate] = useLocation();
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4">
      <div className="text-center max-w-sm">
        <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Store className="h-8 w-8 text-gray-400" />
        </div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">No seller account</h1>
        <p className="text-gray-500 text-sm mb-6">Apply to become a seller to start listing your products.</p>
        <Button onClick={() => navigate("/seller/apply")} className="w-full">Apply Now</Button>
        <button onClick={() => navigate("/")} className="mt-3 text-sm text-gray-400 hover:text-gray-600">Back to store</button>
      </div>
    </div>
  );
}

function PendingScreen({ status }: { status: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="text-center max-w-sm">
        <div className="w-16 h-16 bg-amber-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Clock className="h-8 w-8 text-amber-500" />
        </div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">
          {status === "pending" ? "Application under review" : "Account suspended"}
        </h1>
        <p className="text-gray-500 text-sm">
          {status === "pending"
            ? "We're reviewing your application. You'll be notified once approved."
            : "Your seller account has been suspended. Please contact support."}
        </p>
      </div>
    </div>
  );
}

// ── Main layout ───────────────────────────────────────────────────────────────
interface SellerLayoutProps {
  children: (seller: any) => React.ReactNode;
  title: string;
  action?: React.ReactNode;
}

export default function SellerLayout({ children, title, action }: SellerLayoutProps) {
  const [location, navigate] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user } = useAuth();

  const { data: seller, isLoading } = useQuery({
    queryKey: createQueryKey("/api/seller/me"),
    queryFn: getQueryFn({ on401: "returnNull" }),
  });

  const { data: stats } = useQuery({
    queryKey: createQueryKey("/api/seller/stats"),
    queryFn: getQueryFn({ on401: "returnNull" }),
    enabled: seller?.status === "approved",
  });

  if (isLoading) return null;
  if (!seller) return <NoSellerScreen />;
  if (seller.status !== "approved") return <PendingScreen status={seller.status} />;

  function isActive(href: string) {
    if (href === "/seller/dashboard") return location === "/seller/dashboard";
    return location.startsWith(href);
  }

  function go(href: string) { navigate(href); setSidebarOpen(false); }

  const pendingOrders = (stats?.recentOrders ?? []).filter((o: any) => o.status === "awaiting_confirmation").length;

  const sidebar = (
    <aside className="flex flex-col h-full bg-slate-900 text-white">
      {/* Store info */}
      <div className="px-4 py-5 border-b border-slate-800">
        <div className="flex items-center gap-3">
          {seller.logoUrl ? (
            <img src={seller.logoUrl} alt="" className="w-9 h-9 rounded-lg object-cover" />
          ) : (
            <div className="w-9 h-9 bg-emerald-500 rounded-lg flex items-center justify-center text-white font-bold text-sm">
              {seller.storeName?.[0] ?? "S"}
            </div>
          )}
          <div className="min-w-0">
            <p className="font-bold text-white text-sm leading-none truncate">{seller.storeName}</p>
            <p className="text-xs text-slate-400 mt-0.5">Seller Dashboard</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        <NavItem icon={LayoutDashboard} label="Overview" active={isActive("/seller/dashboard")} onClick={() => go("/seller/dashboard")} />
        <NavItem icon={Package} label="Products" active={isActive("/seller/products")} onClick={() => go("/seller/products")} />
        <NavItem icon={ShoppingCart} label="Orders" active={isActive("/seller/orders")} badge={pendingOrders || undefined} onClick={() => go("/seller/orders")} />
        <NavItem icon={TrendingUp} label="Earnings" active={isActive("/seller/earnings")} onClick={() => go("/seller/earnings")} />
      </nav>

      {/* Bottom */}
      <div className="px-3 py-4 border-t border-slate-800 space-y-1">
        <button onClick={() => go("/seller/products/new")} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-slate-400 hover:bg-slate-800 hover:text-white transition-all">
          <Plus className="h-4 w-4" /> Add Product
        </button>
        <a href="/" className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-slate-400 hover:bg-slate-800 hover:text-white transition-all">
          <ExternalLink className="h-4 w-4" /> View Store
        </a>
        <div className="flex items-center gap-3 px-3 py-2 mt-1">
          <div className="w-7 h-7 rounded-full bg-emerald-500 flex items-center justify-center text-xs font-bold">
            {user?.firstName?.[0] ?? "S"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-white truncate">{user?.firstName} {user?.lastName}</p>
            <p className="text-xs text-slate-500 truncate">{user?.email}</p>
          </div>
        </div>
      </div>
    </aside>
  );

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

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
            <h1 className="text-lg font-bold text-gray-900">{title}</h1>
            <p className="text-xs text-gray-400">{seller.storeName}</p>
          </div>
          {action}
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {children(seller)}
        </main>
      </div>
    </div>
  );
}
