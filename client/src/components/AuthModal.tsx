import { useState } from "react";
import { Link } from "wouter";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { BASE_URL } from "@/lib/queryClient";
import { useQueryClient } from "@tanstack/react-query";

const backendURL = (import.meta.env.VITE_API_BASE_URL || "https://myshop-test-backend.onrender.com").replace(/\/$/, "");

interface AuthModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTab?: "login" | "register";
}

export default function AuthModal({ open, onOpenChange, defaultTab = "login" }: AuthModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [loginData, setLoginData] = useState({ email: "", password: "" });
  const [registerData, setRegisterData] = useState({ firstName: "", lastName: "", email: "", password: "", confirm: "" });
  const [loading, setLoading] = useState(false);

  function storeTokens(token: string, refreshToken: string) {
    localStorage.setItem("jwtToken", token);
    localStorage.setItem("refreshToken", refreshToken);
    queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(loginData),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({
          title: "Login failed",
          description: data.message,
          variant: "destructive",
        });
        return;
      }
      storeTokens(data.token, data.refreshToken);
      toast({ title: "Welcome back!", description: `Signed in as ${data.user.email}` });
      onOpenChange(false);
    } catch {
      toast({ title: "Login failed", description: "Network error, please try again.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    if (registerData.password !== registerData.confirm) {
      toast({ title: "Passwords don't match", variant: "destructive" });
      return;
    }
    if (registerData.password.length < 8) {
      toast({ title: "Password too short", description: "Must be at least 8 characters.", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          email: registerData.email,
          password: registerData.password,
          firstName: registerData.firstName,
          lastName: registerData.lastName,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Registration failed", description: data.message, variant: "destructive" });
        return;
      }
      storeTokens(data.token, data.refreshToken);
      toast({ title: "Account created!", description: `Welcome, ${data.user.firstName}!` });
      onOpenChange(false);
    } catch {
      toast({ title: "Registration failed", description: "Network error, please try again.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  const sessionId = localStorage.getItem("myshop_session_id") || "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center text-xl font-bold text-primary">Fountstream</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue={defaultTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="login">Sign In</TabsTrigger>
            <TabsTrigger value="register">Create Account</TabsTrigger>
          </TabsList>

          {/* ── Login ── */}
          <TabsContent value="login" className="space-y-4 pt-2">
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-1">
                <Label htmlFor="login-email">Email</Label>
                <Input
                  id="login-email"
                  type="email"
                  placeholder="you@example.com"
                  value={loginData.email}
                  onChange={(e) => setLoginData(d => ({ ...d, email: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label htmlFor="login-password">Password</Label>
                  <Link
                    href="/forgot-password"
                    onClick={() => onOpenChange(false)}
                    className="text-xs text-primary hover:underline"
                  >
                    Forgot password?
                  </Link>
                </div>
                <Input
                  id="login-password"
                  type="password"
                  placeholder="••••••••"
                  value={loginData.password}
                  onChange={(e) => setLoginData(d => ({ ...d, password: e.target.value }))}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Signing in…" : "Sign In"}
              </Button>
            </form>

            <div className="relative">
              <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
              <div className="relative flex justify-center text-xs text-gray-400"><span className="bg-white px-2">or</span></div>
            </div>

            <a
              href={`${backendURL}/auth/google?sessionId=${sessionId}`}
              className="flex items-center justify-center gap-2 w-full border rounded-md py-2 px-4 text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="" className="w-5 h-5" />
              Continue with Google
            </a>
          </TabsContent>

          {/* ── Register ── */}
          <TabsContent value="register" className="space-y-4 pt-2">
            <form onSubmit={handleRegister} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="reg-first">First Name</Label>
                  <Input
                    id="reg-first"
                    placeholder="Jane"
                    value={registerData.firstName}
                    onChange={(e) => setRegisterData(d => ({ ...d, firstName: e.target.value }))}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="reg-last">Last Name</Label>
                  <Input
                    id="reg-last"
                    placeholder="Doe"
                    value={registerData.lastName}
                    onChange={(e) => setRegisterData(d => ({ ...d, lastName: e.target.value }))}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="reg-email">Email</Label>
                <Input
                  id="reg-email"
                  type="email"
                  placeholder="you@example.com"
                  value={registerData.email}
                  onChange={(e) => setRegisterData(d => ({ ...d, email: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="reg-password">Password</Label>
                <Input
                  id="reg-password"
                  type="password"
                  placeholder="Min 8 characters"
                  value={registerData.password}
                  onChange={(e) => setRegisterData(d => ({ ...d, password: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="reg-confirm">Confirm Password</Label>
                <Input
                  id="reg-confirm"
                  type="password"
                  placeholder="Repeat password"
                  value={registerData.confirm}
                  onChange={(e) => setRegisterData(d => ({ ...d, confirm: e.target.value }))}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Creating account…" : "Create Account"}
              </Button>
            </form>

            <div className="relative">
              <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
              <div className="relative flex justify-center text-xs text-gray-400"><span className="bg-white px-2">or</span></div>
            </div>

            <a
              href={`${backendURL}/auth/google?sessionId=${sessionId}`}
              className="flex items-center justify-center gap-2 w-full border rounded-md py-2 px-4 text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="" className="w-5 h-5" />
              Continue with Google
            </a>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
