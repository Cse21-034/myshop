import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { KeyRound, CheckCircle2, XCircle, Eye, EyeOff } from "lucide-react";
import { BASE_URL, getCsrfToken, clearCsrfToken } from "@/lib/queryClient";

type Status = "checking" | "invalid" | "ready" | "submitting" | "done";

export default function ResetPassword() {
  const [location] = useLocation();
  const token = new URLSearchParams(window.location.search).get("token") || "";

  const [status, setStatus] = useState<Status>("checking");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) { setStatus("invalid"); return; }
    fetch(`${BASE_URL}/api/auth/reset-password/${token}`)
      .then(r => r.json())
      .then(data => {
        if (data.valid) { setEmail(data.email); setStatus("ready"); }
        else setStatus("invalid");
      })
      .catch(() => setStatus("invalid"));
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password !== confirm) { setError("Passwords don't match."); return; }
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }

    setStatus("submitting");
    try {
      let csrfToken = await getCsrfToken();
      let res = await fetch(`${BASE_URL}/api/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken },
        credentials: "include",
        body: JSON.stringify({ token, password }),
      });
      if (res.status === 403) {
        clearCsrfToken();
        csrfToken = await getCsrfToken();
        res = await fetch(`${BASE_URL}/api/auth/reset-password`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken },
          credentials: "include",
          body: JSON.stringify({ token, password }),
        });
      }
      const data = await res.json();
      if (!res.ok) { setError(data.message || "Something went wrong."); setStatus("ready"); return; }
      setStatus("done");
    } catch {
      setError("Network error. Please try again.");
      setStatus("ready");
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header />
      <main className="flex-grow flex items-center justify-center px-4 py-12">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center space-y-1">
            <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-2">
              <KeyRound className="h-6 w-6 text-primary" />
            </div>
            <CardTitle className="text-2xl">Reset password</CardTitle>
            {email && <CardDescription>for {email}</CardDescription>}
          </CardHeader>
          <CardContent>
            {status === "checking" && (
              <p className="text-center text-gray-500 py-6">Verifying link…</p>
            )}

            {status === "invalid" && (
              <div className="text-center space-y-4">
                <XCircle className="h-12 w-12 text-red-400 mx-auto" />
                <p className="font-medium text-gray-800">Link is invalid or has expired</p>
                <p className="text-sm text-gray-500">Reset links are valid for 1 hour. Please request a new one.</p>
                <Link href="/forgot-password">
                  <Button className="w-full">Request New Link</Button>
                </Link>
              </div>
            )}

            {(status === "ready" || status === "submitting") && (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1">
                  <Label htmlFor="pw">New password</Label>
                  <div className="relative">
                    <Input
                      id="pw"
                      type={showPw ? "text" : "password"}
                      placeholder="Min 8 characters"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      required
                      autoFocus
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      onClick={() => setShowPw(v => !v)}
                    >
                      {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="confirm">Confirm new password</Label>
                  <Input
                    id="confirm"
                    type={showPw ? "text" : "password"}
                    placeholder="Repeat password"
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    required
                  />
                </div>

                {error && (
                  <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</p>
                )}

                {/* Password strength hint */}
                {password.length > 0 && (
                  <div className="flex gap-1">
                    {[...Array(4)].map((_, i) => (
                      <div
                        key={i}
                        className={`h-1 flex-1 rounded-full transition-colors ${
                          password.length > i * 3 + 3
                            ? password.length >= 12 ? "bg-green-500"
                              : password.length >= 8 ? "bg-yellow-400"
                              : "bg-red-400"
                            : "bg-gray-200"
                        }`}
                      />
                    ))}
                  </div>
                )}

                <Button type="submit" className="w-full" disabled={status === "submitting"}>
                  {status === "submitting" ? "Saving…" : "Set New Password"}
                </Button>
              </form>
            )}

            {status === "done" && (
              <div className="text-center space-y-4">
                <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto" />
                <p className="font-medium text-gray-800">Password updated!</p>
                <p className="text-sm text-gray-500">You can now sign in with your new password.</p>
                <Link href="/">
                  <Button className="w-full">Sign In</Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  );
}
