import { useState, useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useTheme } from "@/hooks/useTheme";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectTrigger, SelectContent, SelectItem, SelectValue,
} from "@/components/ui/select";
import { getQueryFn, createQueryKey, apiRequest } from "@/lib/queryClient";
import {
  User, ShoppingBag, Heart, MessageSquare, Lock, Settings,
  ChevronRight, Package,
} from "lucide-react";

const LANGUAGES = [
  { value: "en", label: "English" },
  { value: "fr", label: "French" },
  { value: "es", label: "Spanish" },
];

const CURRENCIES = [
  { value: "USD", label: "USD - $" },
  { value: "EUR", label: "EUR - €" },
  { value: "BWP", label: "BWP - P" },
  { value: "GBP", label: "GBP - £" },
];

type Tab = "overview" | "profile" | "security";

type ProfileFormData = {
  firstName: string;
  lastName: string;
  language: string;
  currency: string;
  profileImageUrl?: string;
};

type PasswordFormData = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-700",
  processing: "bg-blue-100 text-blue-700",
  shipped: "bg-indigo-100 text-indigo-700",
  delivered: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
  awaiting_confirmation: "bg-orange-100 text-orange-700",
};

function StatCard({ icon: Icon, label, value, color }: {
  icon: React.ElementType; label: string; value: string | number; color: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center gap-4">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${color}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        <p className="text-xs text-gray-500 mt-0.5">{label}</p>
      </div>
    </div>
  );
}

export default function Profile() {
  const [, navigate] = useLocation();
  const { user, isLoading, updateUser } = useAuth();
  const { toast } = useToast();
  const { theme, toggleTheme } = useTheme();
  const [tab, setTab] = useState<Tab>("overview");

  const { data: orders = [] } = useQuery<any[]>({
    queryKey: createQueryKey("/api/orders"),
    queryFn: getQueryFn({ on401: "returnNull" }),
    enabled: !!user,
  });

  const { data: wishlist = [] } = useQuery<any[]>({
    queryKey: createQueryKey("/api/wishlist"),
    queryFn: getQueryFn({ on401: "returnNull" }),
    enabled: !!user,
  });

  const { data: chats = [] } = useQuery<any[]>({
    queryKey: createQueryKey("/api/buyer/chats"),
    queryFn: getQueryFn({ on401: "returnNull" }),
    enabled: !!user,
  });

  // Profile form
  const {
    register: regProfile,
    handleSubmit: handleProfile,
    control,
    reset: resetProfile,
    watch,
    formState: { errors: profileErrors, isSubmitting: profileSubmitting },
  } = useForm<ProfileFormData>({
    defaultValues: {
      firstName: "", lastName: "", language: "en", currency: "BWP", profileImageUrl: "",
    },
  });

  const profileImageUrl = watch("profileImageUrl");

  useEffect(() => {
    if (user) {
      resetProfile({
        firstName: user.firstName || "",
        lastName: user.lastName || "",
        language: (user as any).language || "en",
        currency: (user as any).currency || "BWP",
        profileImageUrl: user.profileImageUrl || "",
      });
    }
  }, [user, resetProfile]);

  async function onProfileSubmit(data: ProfileFormData) {
    if (!user) return;
    try {
      await updateUser?.({ ...user, ...data });
      toast({ title: "Profile updated", description: "Your details have been saved." });
    } catch {
      toast({ title: "Error", description: "Failed to update profile.", variant: "destructive" });
    }
  }

  // Password form
  const {
    register: regPwd,
    handleSubmit: handlePwd,
    reset: resetPwd,
    formState: { errors: pwdErrors, isSubmitting: pwdSubmitting },
  } = useForm<PasswordFormData>({
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  });

  const changePwdMutation = useMutation({
    mutationFn: (data: { currentPassword: string; newPassword: string }) =>
      apiRequest("POST", "/api/user/change-password", data),
    onSuccess: () => {
      toast({ title: "Password changed", description: "Your password has been updated successfully." });
      resetPwd();
    },
    onError: (err: any) => {
      let msg = "Failed to change password.";
      try {
        const raw = err?.message || "";
        const jsonStr = raw.replace(/^\d+:\s*/, "");
        const parsed = JSON.parse(jsonStr);
        msg = parsed?.message || msg;
      } catch {}
      toast({ title: "Error", description: msg, variant: "destructive" });
    },
  });

  async function onPasswordSubmit(data: PasswordFormData) {
    if (data.newPassword !== data.confirmPassword) {
      toast({ title: "Error", description: "New passwords do not match.", variant: "destructive" });
      return;
    }
    changePwdMutation.mutate({ currentPassword: data.currentPassword, newPassword: data.newPassword });
  }

  if (isLoading) return (
    <><Header /><div className="min-h-screen flex items-center justify-center text-gray-500">Loading…</div><Footer /></>
  );
  if (!user) return (
    <><Header /><div className="min-h-screen flex items-center justify-center text-gray-500">Please log in.</div><Footer /></>
  );

  const isGoogleUser = !(user as any).passwordHash;
  const recentOrders = (orders as any[]).slice(0, 4);
  const recentChats = (chats as any[]).slice(0, 3);
  const memberSince = (user as any).createdAt
    ? new Date((user as any).createdAt).toLocaleDateString("en-BW", { month: "long", year: "numeric" })
    : "—";

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: "overview", label: "Overview", icon: User },
    { id: "profile", label: "Edit Profile", icon: Settings },
    { id: "security", label: "Security", icon: Lock },
  ];

  return (
    <>
      <Header />
      <main className="container mx-auto px-[10px] sm:px-4 py-6 sm:py-10 max-w-4xl min-h-screen">

        {/* Profile Header Card */}
        <div className="bg-gradient-to-r from-primary to-primary/80 rounded-2xl p-5 sm:p-7 text-white mb-6 shadow-md">
          <div className="flex items-center gap-4">
            {user.profileImageUrl ? (
              <img src={user.profileImageUrl} alt="" className="w-16 h-16 sm:w-20 sm:h-20 rounded-full object-cover border-2 border-white/40 shrink-0" />
            ) : (
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-white/20 flex items-center justify-center shrink-0 text-3xl font-bold">
                {user.firstName?.[0]?.toUpperCase() ?? "?"}
              </div>
            )}
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold truncate">{user.firstName} {user.lastName}</h1>
              <p className="text-white/70 text-sm mt-0.5 truncate">{user.email}</p>
              <p className="text-white/50 text-xs mt-1">Member since {memberSince}</p>
              {(user as any).isAdmin && <Badge className="mt-2 bg-white/20 text-white border-0 text-xs">Admin</Badge>}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-6 overflow-x-auto">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap flex-1 justify-center ${
                tab === t.id ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <t.icon className="h-4 w-4" />
              {t.label}
            </button>
          ))}
        </div>

        {/* ── OVERVIEW TAB ─────────────────────────────────────────────── */}
        {tab === "overview" && (
          <div className="space-y-6">
            {/* Stats */}
            <div className="grid grid-cols-3 gap-3">
              <StatCard icon={ShoppingBag} label="Total Orders" value={(orders as any[]).length} color="bg-blue-100 text-blue-600" />
              <StatCard icon={Heart} label="Wishlist" value={(wishlist as any[]).length} color="bg-pink-100 text-pink-600" />
              <StatCard icon={MessageSquare} label="Chats" value={(chats as any[]).length} color="bg-emerald-100 text-emerald-600" />
            </div>

            {/* Recent Orders */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-gray-500" />
                  <h2 className="text-sm font-semibold text-gray-800">Recent Orders</h2>
                </div>
                <button
                  onClick={() => navigate("/orders")}
                  className="text-xs text-primary hover:underline flex items-center gap-1"
                >
                  View all <ChevronRight className="h-3 w-3" />
                </button>
              </div>
              {recentOrders.length === 0 ? (
                <div className="py-10 text-center text-gray-400 text-sm">
                  <ShoppingBag className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p>No orders yet. <button onClick={() => navigate("/shop")} className="text-primary underline">Start shopping</button></p>
                </div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {recentOrders.map((o: any) => (
                    <div key={o.id} className="flex items-center gap-3 px-4 py-3">
                      <div className="w-9 h-9 bg-gray-100 rounded-lg flex items-center justify-center shrink-0">
                        <Package className="h-4 w-4 text-gray-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">Order #{o.id}</p>
                        <p className="text-xs text-gray-400">
                          {new Date(o.createdAt).toLocaleDateString("en-BW", { day: "numeric", month: "short", year: "numeric" })}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-semibold text-gray-900">P {parseFloat(o.totalAmount || 0).toFixed(2)}</p>
                        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${statusColors[o.status] ?? "bg-gray-100 text-gray-600"}`}>
                          {(o.status || "").replace(/_/g, " ")}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Wishlist shortcut */}
            <button
              onClick={() => navigate("/wishlist")}
              className="w-full bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-4 flex items-center gap-3 hover:bg-gray-50 transition-colors"
            >
              <div className="w-9 h-9 bg-pink-100 rounded-lg flex items-center justify-center">
                <Heart className="h-4 w-4 text-pink-500" />
              </div>
              <div className="flex-1 text-left">
                <p className="text-sm font-semibold text-gray-900">My Wishlist</p>
                <p className="text-xs text-gray-400">{(wishlist as any[]).length} saved items</p>
              </div>
              <ChevronRight className="h-4 w-4 text-gray-300" />
            </button>

            {/* Recent Chats */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-50">
                <MessageSquare className="h-4 w-4 text-gray-500" />
                <h2 className="text-sm font-semibold text-gray-800">My Conversations</h2>
              </div>
              {recentChats.length === 0 ? (
                <div className="py-8 text-center text-gray-400 text-sm">
                  <MessageSquare className="h-7 w-7 mx-auto mb-2 opacity-30" />
                  <p>No conversations yet.</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {recentChats.map((c: any) => (
                    <div
                      key={c.id}
                      onClick={() => navigate(`/product/${c.productId}`)}
                      className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors"
                    >
                      <div className="w-9 h-9 bg-emerald-50 rounded-lg flex items-center justify-center shrink-0">
                        <MessageSquare className="h-4 w-4 text-emerald-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{c.productName || "Product"}</p>
                        {c.lastMessage && (
                          <p className="text-xs text-gray-400 truncate">{c.lastMessage.content}</p>
                        )}
                      </div>
                      <ChevronRight className="h-4 w-4 text-gray-300 shrink-0" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── EDIT PROFILE TAB ─────────────────────────────────────────── */}
        {tab === "profile" && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 sm:p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-5">Personal Information</h2>
            <form onSubmit={handleProfile(onProfileSubmit)} className="space-y-5">
              {/* Avatar */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Profile Photo URL</label>
                <Input
                  type="url"
                  placeholder="https://example.com/photo.jpg"
                  {...regProfile("profileImageUrl", {
                    pattern: { value: /^https?:\/\/.+$/, message: "Enter a valid URL" },
                  })}
                />
                {profileErrors.profileImageUrl && (
                  <p className="text-red-500 text-xs mt-1">{profileErrors.profileImageUrl.message}</p>
                )}
                {profileImageUrl && (
                  <img
                    src={profileImageUrl}
                    alt=""
                    className="mt-3 w-16 h-16 rounded-full object-cover border border-gray-200"
                    onError={e => { (e.currentTarget as HTMLImageElement).src = ""; }}
                  />
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                  <Input {...regProfile("firstName", { required: "Required" })} />
                  {profileErrors.firstName && <p className="text-red-500 text-xs mt-1">{profileErrors.firstName.message}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                  <Input {...regProfile("lastName", { required: "Required" })} />
                  {profileErrors.lastName && <p className="text-red-500 text-xs mt-1">{profileErrors.lastName.message}</p>}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <Input value={user.email || ""} disabled className="bg-gray-50 text-gray-400 cursor-not-allowed" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Language</label>
                  <Controller name="language" control={control} render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger><SelectValue placeholder="Language" /></SelectTrigger>
                      <SelectContent>
                        {LANGUAGES.map(l => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
                  <Controller name="currency" control={control} render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger><SelectValue placeholder="Currency" /></SelectTrigger>
                      <SelectContent>
                        {CURRENCIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )} />
                </div>
              </div>

              {/* Theme */}
              <div className="flex items-center justify-between py-2 border-t border-gray-50">
                <div>
                  <p className="text-sm font-medium text-gray-700">Theme</p>
                  <p className="text-xs text-gray-400">Currently: {theme === "dark" ? "Dark" : "Light"} mode</p>
                </div>
                <button
                  type="button"
                  onClick={toggleTheme}
                  className="text-sm text-primary border border-primary/30 rounded-lg px-3 py-1.5 hover:bg-primary/5 transition-colors"
                >
                  Switch to {theme === "dark" ? "Light" : "Dark"}
                </button>
              </div>

              <Button type="submit" disabled={profileSubmitting} className="w-full">
                {profileSubmitting ? "Saving…" : "Save Changes"}
              </Button>
            </form>
          </div>
        )}

        {/* ── SECURITY TAB ─────────────────────────────────────────────── */}
        {tab === "security" && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 sm:p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-1">Change Password</h2>
            {isGoogleUser ? (
              <div className="mt-4 p-4 bg-blue-50 rounded-xl text-sm text-blue-700">
                <p className="font-medium">Google Account</p>
                <p className="mt-1 text-blue-600 text-xs">
                  Your account uses Google sign-in. Password management is handled by Google — you cannot set a local password here.
                </p>
              </div>
            ) : (
              <form onSubmit={handlePwd(onPasswordSubmit)} className="space-y-4 mt-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
                  <Input
                    type="password"
                    placeholder="Enter current password"
                    {...regPwd("currentPassword", { required: "Required" })}
                  />
                  {pwdErrors.currentPassword && <p className="text-red-500 text-xs mt-1">{pwdErrors.currentPassword.message}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
                  <Input
                    type="password"
                    placeholder="At least 8 characters"
                    {...regPwd("newPassword", {
                      required: "Required",
                      minLength: { value: 8, message: "Must be at least 8 characters" },
                    })}
                  />
                  {pwdErrors.newPassword && <p className="text-red-500 text-xs mt-1">{pwdErrors.newPassword.message}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
                  <Input
                    type="password"
                    placeholder="Repeat new password"
                    {...regPwd("confirmPassword", { required: "Required" })}
                  />
                  {pwdErrors.confirmPassword && <p className="text-red-500 text-xs mt-1">{pwdErrors.confirmPassword.message}</p>}
                </div>
                <Button type="submit" disabled={changePwdMutation.isPending || pwdSubmitting} className="w-full">
                  {changePwdMutation.isPending ? "Updating…" : "Update Password"}
                </Button>
              </form>
            )}
          </div>
        )}

      </main>
      <Footer />
    </>
  );
}
