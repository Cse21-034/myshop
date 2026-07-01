import { useEffect } from "react";
import { useLocation } from "wouter";

// Password reset is now OTP-based — everything happens on /forgot-password.
// Redirect any old bookmarked /reset-password links.
export default function ResetPassword() {
  const [, navigate] = useLocation();
  useEffect(() => { navigate("/forgot-password"); }, [navigate]);
  return null;
}
