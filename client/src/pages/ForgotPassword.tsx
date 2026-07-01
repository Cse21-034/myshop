import { useState, useRef, useEffect } from "react";
import { Link } from "wouter";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Mail, ShieldCheck, KeyRound, CheckCircle2, ArrowLeft, Eye, EyeOff } from "lucide-react";
import { BASE_URL, getCsrfToken, clearCsrfToken } from "@/lib/queryClient";

type Step = "email" | "otp" | "password" | "done";

async function csrfPost(path: string, body: object) {
  let csrf = await getCsrfToken();
  let res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf },
    credentials: "include",
    body: JSON.stringify(body),
  });
  if (res.status === 403) {
    clearCsrfToken();
    csrf = await getCsrfToken();
    res = await fetch(`${BASE_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf },
      credentials: "include",
      body: JSON.stringify(body),
    });
  }
  return res;
}

// ── 6-digit OTP input ────────────────────────────────────────────────────────
function OtpInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = value.padEnd(6, "").split("").slice(0, 6);

  function focus(i: number) {
    inputs.current[Math.max(0, Math.min(5, i))]?.focus();
  }

  function handleKey(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace") {
      e.preventDefault();
      if (digits[i]) {
        const next = digits.map((d, j) => (j === i ? "" : d)).join("").slice(0, 6);
        onChange(next.trimEnd());
      } else {
        focus(i - 1);
      }
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      focus(i - 1);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      focus(i + 1);
    }
  }

  function handleChange(i: number, raw: string) {
    const char = raw.replace(/\D/g, "").slice(-1);
    if (!char) return;
    const next = digits.map((d, j) => (j === i ? char : d)).join("").slice(0, 6);
    onChange(next);
    if (i < 5) focus(i + 1);
  }

  function handlePaste(e: React.ClipboardEvent) {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted) {
      onChange(pasted);
      focus(Math.min(5, pasted.length));
    }
  }

  return (
    <div className="flex gap-2 justify-center" onPaste={handlePaste}>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <input
          key={i}
          ref={(el) => { inputs.current[i] = el; }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={digits[i] || ""}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKey(i, e)}
          onFocus={(e) => e.target.select()}
          className={
            "w-11 h-14 text-center text-2xl font-bold border-2 rounded-lg outline-none transition-colors " +
            (digits[i]
              ? "border-primary bg-primary/5 text-primary"
              : "border-gray-300 bg-white text-gray-800") +
            " focus:border-primary focus:ring-2 focus:ring-primary/20"
          }
        />
      ))}
    </div>
  );
}

// ── Password strength bar ─────────────────────────────────────────────────────
function StrengthBar({ password }: { password: string }) {
  if (!password.length) return null;
  return (
    <div className="flex gap-1">
      {[...Array(4)].map((_, i) => (
        <div
          key={i}
          className={`h-1 flex-1 rounded-full transition-colors ${
            password.length > i * 3 + 3
              ? password.length >= 12
                ? "bg-green-500"
                : password.length >= 8
                ? "bg-yellow-400"
                : "bg-red-400"
              : "bg-gray-200"
          }`}
        />
      ))}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ForgotPassword() {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [countdown, setCountdown] = useState(0);

  // Resend countdown timer
  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await csrfPost("/api/auth/forgot-password", { email });
      const data = await res.json();
      if (!res.ok) {
        if (data.code === "USE_GOOGLE") {
          setError(data.message);
        } else if (res.status === 429) {
          setError(data.message);
        } else {
          setError(data.message || "Something went wrong.");
        }
        return;
      }
      setCountdown(60);
      setStep("otp");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    if (countdown > 0) return;
    setError("");
    setLoading(true);
    try {
      const res = await csrfPost("/api/auth/forgot-password", { email });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || "Could not resend code.");
        return;
      }
      setOtp("");
      setCountdown(60);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    if (otp.length < 6) { setError("Please enter all 6 digits."); return; }
    setError("");
    setLoading(true);
    try {
      const res = await csrfPost("/api/auth/verify-otp", { email, otp });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || "Verification failed.");
        if (data.code === "LOCKED" || data.code === "EXPIRED") setOtp("");
        return;
      }
      setResetToken(data.resetToken);
      setStep("password");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) { setError("Passwords don't match."); return; }
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    setError("");
    setLoading(true);
    try {
      const res = await csrfPost("/api/auth/reset-password", { resetToken, password });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || "Something went wrong.");
        return;
      }
      setStep("done");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header />
      <main className="flex-grow flex items-center justify-center px-4 py-12">
        <Card className="w-full max-w-md">

          {/* ── Step 1: Email ── */}
          {step === "email" && (
            <>
              <CardHeader className="text-center space-y-1">
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-2">
                  <Mail className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="text-2xl">Forgot password?</CardTitle>
                <CardDescription>Enter your email and we'll send you a 6-digit code.</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSendOtp} className="space-y-4">
                  <div className="space-y-1">
                    <Label htmlFor="email">Email address</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      autoFocus
                    />
                  </div>
                  {error && (
                    <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</p>
                  )}
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? "Sending…" : "Send Code"}
                  </Button>
                  <Link href="/">
                    <button type="button" className="flex items-center gap-1 text-sm text-gray-500 hover:text-primary mx-auto mt-1">
                      <ArrowLeft className="h-3.5 w-3.5" /> Back to Sign In
                    </button>
                  </Link>
                </form>
              </CardContent>
            </>
          )}

          {/* ── Step 2: OTP ── */}
          {step === "otp" && (
            <>
              <CardHeader className="text-center space-y-1">
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-2">
                  <ShieldCheck className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="text-2xl">Enter verification code</CardTitle>
                <CardDescription>
                  We sent a 6-digit code to <strong>{email}</strong>.<br />
                  Check your inbox (and spam folder). It expires in 15 minutes.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleVerifyOtp} className="space-y-6">
                  <OtpInput value={otp} onChange={setOtp} />

                  {error && (
                    <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2 text-center">{error}</p>
                  )}

                  <Button type="submit" className="w-full" disabled={loading || otp.length < 6}>
                    {loading ? "Verifying…" : "Verify Code"}
                  </Button>

                  <div className="text-center space-y-2">
                    <p className="text-sm text-gray-500">Didn't receive a code?</p>
                    <button
                      type="button"
                      onClick={handleResend}
                      disabled={countdown > 0 || loading}
                      className="text-sm font-medium text-primary hover:underline disabled:text-gray-400 disabled:no-underline"
                    >
                      {countdown > 0 ? `Resend in ${countdown}s` : "Resend Code"}
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => { setStep("email"); setOtp(""); setError(""); }}
                    className="flex items-center gap-1 text-sm text-gray-500 hover:text-primary mx-auto"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" /> Change email
                  </button>
                </form>
              </CardContent>
            </>
          )}

          {/* ── Step 3: New password ── */}
          {step === "password" && (
            <>
              <CardHeader className="text-center space-y-1">
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-2">
                  <KeyRound className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="text-2xl">Set new password</CardTitle>
                <CardDescription>Choose a strong password for your account.</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleResetPassword} className="space-y-4">
                  <div className="space-y-1">
                    <Label htmlFor="pw">New password</Label>
                    <div className="relative">
                      <Input
                        id="pw"
                        type={showPw ? "text" : "password"}
                        placeholder="Min 8 characters"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        autoFocus
                      />
                      <button
                        type="button"
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        onClick={() => setShowPw((v) => !v)}
                      >
                        {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    <StrengthBar password={password} />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="confirm">Confirm password</Label>
                    <Input
                      id="confirm"
                      type={showPw ? "text" : "password"}
                      placeholder="Repeat password"
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      required
                    />
                  </div>
                  {error && (
                    <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</p>
                  )}
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? "Saving…" : "Set New Password"}
                  </Button>
                </form>
              </CardContent>
            </>
          )}

          {/* ── Step 4: Done ── */}
          {step === "done" && (
            <>
              <CardHeader className="text-center space-y-1">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-2">
                  <CheckCircle2 className="h-6 w-6 text-green-600" />
                </div>
                <CardTitle className="text-2xl">Password updated!</CardTitle>
                <CardDescription>You can now sign in with your new password.</CardDescription>
              </CardHeader>
              <CardContent>
                <Link href="/">
                  <Button className="w-full">Sign In</Button>
                </Link>
              </CardContent>
            </>
          )}

        </Card>
      </main>
      <Footer />
    </div>
  );
}
