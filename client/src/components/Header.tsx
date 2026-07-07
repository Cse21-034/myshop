// src/components/Header.tsx
import { useState, useEffect, lazy, Suspense, useRef } from "react";
const AuthModal = lazy(() => import("./AuthModal"));
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  Menu,
  User,
  ShoppingCart,
  Headphones,
  Bell,
  CheckCheck,
  X as XIcon,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useCart } from "@/context/CartContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import CartDrawer from "./CartDrawer";
import { clearCsrfToken } from "@/lib/queryClient";

const backendURL = (import.meta.env.VITE_API_BASE_URL || "https://myshop-test-backend.onrender.com").replace(/\/$/, "");

export default function Header() {
  const [location] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authTab, setAuthTab] = useState<"login" | "register">("login");
  const { user, isAuthenticated } = useAuth();
  const { itemCount } = useCart();
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get("login") === "success") {
      const token = urlParams.get("token");
      const refreshToken = urlParams.get("refreshToken");
      const csrfToken = urlParams.get("csrfToken");
      if (token) {
        localStorage.setItem("jwtToken", token);
        localStorage.setItem("refreshToken", refreshToken || "");
        localStorage.setItem("csrfToken", csrfToken || "");
        console.log("🔐 Stored tokens from OAuth redirect");
      }
      window.history.replaceState({}, document.title, location.pathname);
    } else if (urlParams.get("logout") === "success") {
      localStorage.removeItem("jwtToken");
      localStorage.removeItem("refreshToken");
      clearCsrfToken();
      console.log("🔐 Cleared tokens on logout");
    }
  }, [location]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      window.location.href = `/shop?search=${encodeURIComponent(searchQuery)}`;
    }
  };

  const sessionId = localStorage.getItem("myshop_session_id") || "";
  const queryClient = useQueryClient();
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  const { data: notifList = [] } = useQuery<any[]>({
    queryKey: ["/api/notifications"],
    queryFn: () => fetch(`${backendURL}/api/notifications`, { credentials: "include" }).then(r => r.ok ? r.json() : []),
    enabled: isAuthenticated,
    refetchInterval: 60000,
  });

  const unreadCount = notifList.filter((n: any) => !n.read).length;

  const readAllMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/notifications/read-all"),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/notifications"] }),
  });

  const deleteNotifMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/notifications/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/notifications"] }),
  });

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <>
      <div className="bg-primary text-white text-center py-2 text-sm">
        Free delivery on orders over $75 | Use code: FREESHIP
      </div>

      <header className="bg-white shadow-sm sticky top-0 z-50">
        <nav className="container mx-auto px-[5px] sm:px-4 py-4">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <Link href="/" className="flex items-center space-x-2">
              <Headphones className="text-secondary text-2xl" />
              <span className="text-2xl font-bold text-primary">Fountstream</span>
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center space-x-8">
              <Link
                href="/"
                className={`text-gray-700 hover:text-primary transition-colors ${
                  location === "/" ? "text-primary font-semibold" : ""
                }`}
              >
                Home
              </Link>
              <Link
                href="/shop"
                className={`text-gray-700 hover:text-primary transition-colors ${
                  location === "/shop" ? "text-primary font-semibold" : ""
                }`}
              >
                Shop
              </Link>
              <DropdownMenu>
                <DropdownMenuTrigger className="text-gray-700 hover:text-primary transition-colors flex items-center">
                  Categories
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem>
                    <Link href="/shop?category=clothing">Clothing</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <Link href="/shop?category=footwear">Footwear</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <Link href="/shop?category=accessories">Accessories</Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Link
                href="/farm-market"
                className={`text-gray-700 hover:text-primary transition-colors ${
                  location === "/farm-market" ? "text-primary font-semibold" : ""
                }`}
              >
                Farm Market
              </Link>
              <Link
                href="/about"
                className={`text-gray-700 hover:text-primary transition-colors ${
                  location === "/about" ? "text-primary font-semibold" : ""
                }`}
              >
                About
              </Link>
              <Link
                href="/contact"
                className={`text-gray-700 hover:text-primary transition-colors ${
                  location === "/contact" ? "text-primary font-semibold" : ""
                }`}
              >
                Contact
              </Link>
            </div>

            {/* Search & Actions */}
            <div className="flex items-center space-x-4">
              {/* Search */}
              <form onSubmit={handleSearch} className="hidden lg:flex relative">
                <Input
                  type="text"
                  placeholder="Search products..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 pr-4 py-2"
                />
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              </form>

              {/* User Account */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm">
                  {isAuthenticated && (user?.photos?.[0]?.value || user?.profileImageUrl) ? (
  <img
    src={user?.photos?.[0]?.value || user?.profileImageUrl}
    alt="User"
    className="w-6 h-6 rounded-full"
  />
) : (
  <User className="h-5 w-5" />
)}

                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {isAuthenticated ? (
                    <>
                      <DropdownMenuItem>
                        <Link href="/profile" className="flex items-center gap-2">
{(user?.photos?.[0]?.value || user?.profileImageUrl) && (
  <img
    src={user?.photos?.[0]?.value || user?.profileImageUrl}
    alt="Profile"
    className="w-5 h-5 rounded-full"
  />
)}

                          <span>{user.displayName || user.firstName}</span>
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <Link href="/orders">My Orders</Link>
                      </DropdownMenuItem>
                      {(user?.isSeller || user?.isAdmin) && (
                        <DropdownMenuItem>
                          <Link href="/seller/dashboard">Seller Dashboard</Link>
                        </DropdownMenuItem>
                      )}
                      {!user?.isSeller && !user?.isAdmin && (
                        <DropdownMenuItem>
                          <Link href="/seller/apply">Become a Seller</Link>
                        </DropdownMenuItem>
                      )}
                      {user?.isAdmin && (
                        <DropdownMenuItem>
                          <Link href="/admin">Admin Dashboard</Link>
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem>
                        <a href={`${backendURL}/auth/logout`}>Logout</a>
                      </DropdownMenuItem>
                    </>
                  ) : (
                    <>
                      <DropdownMenuItem onSelect={() => { setAuthTab("login"); setAuthModalOpen(true); }}>
                        Sign In
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => { setAuthTab("register"); setAuthModalOpen(true); }}>
                        Create Account
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Notification Bell */}
              {isAuthenticated && (
                <div className="relative" ref={notifRef}>
                  <button className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors" onClick={() => setNotifOpen(!notifOpen)}>
                    <Bell className="h-5 w-5 text-gray-600" />
                    {unreadCount > 0 && (
                      <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">{unreadCount > 9 ? "9+" : unreadCount}</span>
                    )}
                  </button>
                  {notifOpen && (
                    <div className="absolute right-0 top-full mt-2 w-80 bg-white border border-gray-100 rounded-xl shadow-xl z-50 overflow-hidden">
                      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                        <span className="font-semibold text-sm">Notifications</span>
                        {unreadCount > 0 && (
                          <button className="text-xs text-primary flex items-center gap-1 hover:underline" onClick={() => readAllMutation.mutate()}>
                            <CheckCheck className="h-3.5 w-3.5" />Mark all read
                          </button>
                        )}
                      </div>
                      <div className="max-h-80 overflow-y-auto divide-y divide-gray-50">
                        {notifList.length === 0 ? (
                          <div className="text-center text-sm text-gray-400 py-8">No notifications</div>
                        ) : notifList.map((n: any) => (
                          <div key={n.id} className={`flex items-start gap-3 px-4 py-3 hover:bg-gray-50 transition-colors ${!n.read ? "bg-blue-50/40" : ""}`}>
                            <div className={`w-2 h-2 rounded-full mt-2 shrink-0 ${!n.read ? "bg-primary" : "bg-transparent"}`} />
                            <div className="flex-1 min-w-0">
                              {n.link ? (
                                <a href={n.link} className="text-sm font-medium text-gray-900 hover:text-primary line-clamp-2" onClick={() => setNotifOpen(false)}>{n.title}</a>
                              ) : (
                                <p className="text-sm font-medium text-gray-900 line-clamp-2">{n.title}</p>
                              )}
                              {n.body && <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{n.body}</p>}
                              <p className="text-[10px] text-gray-400 mt-1">{new Date(n.createdAt).toLocaleString("en-BW", { dateStyle: "short", timeStyle: "short" })}</p>
                            </div>
                            <button className="text-gray-300 hover:text-red-400 shrink-0 mt-1" onClick={() => deleteNotifMutation.mutate(n.id)}>
                              <XIcon className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Shopping Cart */}
              <Button
                variant="ghost"
                size="sm"
                className="relative"
                onClick={() => setIsCartOpen(true)}
              >
                <ShoppingCart className="h-5 w-5" />
                {itemCount > 0 && (
                  <Badge
                    variant="destructive"
                    className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center p-0 text-xs"
                  >
                    {itemCount}
                  </Badge>
                )}
              </Button>

              {/* Mobile Menu Toggle */}
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="sm" className="md:hidden">
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left">
                  <div className="flex flex-col space-y-4 mt-8">
                    <Link href="/" className="text-lg">Home</Link>
                    <Link href="/shop" className="text-lg">Shop</Link>
                    <Link href="/farm-market" className="text-lg">Farm Market</Link>
                    <Link href="/about" className="text-lg">About</Link>
                    <Link href="/contact" className="text-lg">Contact</Link>
                    {isAuthenticated ? (
                      <>
                        <Link href="/profile" className="text-lg">My Profile</Link>
                        <Link href="/orders" className="text-lg">My Orders</Link>
 

                       

                        {(user?.isSeller || user?.isAdmin) && (
                          <Link href="/seller/dashboard" className="text-lg">Seller Dashboard</Link>
                        )}
                        {!user?.isSeller && !user?.isAdmin && (
                          <Link href="/seller/apply" className="text-lg">Become a Seller</Link>
                        )}
                        {(user?.isAdmin === true || user?.isAdmin === "true") && (
                          <Link href="/admin" className="text-lg">Admin Dashboard</Link>
                        )}
                        <a href={`${backendURL}/auth/logout`} className="text-lg">Logout</a>
                      </>
                    ) : (
                      <>
                        <button onClick={() => { setAuthTab("login"); setAuthModalOpen(true); }} className="text-lg text-left">Sign In</button>
                        <button onClick={() => { setAuthTab("register"); setAuthModalOpen(true); }} className="text-lg text-left">Create Account</button>
                      </>
                    )}
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </nav>
      </header>

      <CartDrawer isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />
      <Suspense fallback={null}>
        <AuthModal open={authModalOpen} onOpenChange={setAuthModalOpen} defaultTab={authTab} />
      </Suspense>
    </>
  );
}
