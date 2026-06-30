import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useCallback } from "react";
import { getQueryFn, clearCsrfToken, apiRequest, BASE_URL } from "@/lib/queryClient";

interface User {
  id: string;
  email: string;
  isAdmin: boolean;
  firstName?: string;
  lastName?: string;
  profileImageUrl?: string;
  language?: string;
  currency?: string;
}

export function useAuth() {
  const queryClient = useQueryClient();

  const { data, isLoading, error, isFetching, refetch } = useQuery<User | null>({
    queryKey: ["/api/auth/user"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    retry: false,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const updateUser = useCallback(
    async (updates: Partial<User>) => {
      const response = await fetch(`${BASE_URL}/api/user/profile`, {
        method: "PUT",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Authorization: localStorage.getItem("jwtToken")
            ? `Bearer ${localStorage.getItem("jwtToken")}`
            : "",
        },
        body: JSON.stringify(updates),
      });
      if (!response.ok) throw new Error("Failed to update profile");
      const updatedUser = await response.json();
      queryClient.setQueryData(["/api/auth/user"], updatedUser);
      return updatedUser;
    },
    [queryClient]
  );

  const debugAuth = useCallback(async () => {
    try {
      const response = await fetch(`${BASE_URL}/api/auth/debug`, {
        credentials: "include",
        headers: {
          Accept: "application/json",
          Authorization: localStorage.getItem("jwtToken")
            ? `Bearer ${localStorage.getItem("jwtToken")}`
            : "",
        },
      });
      const debugData = await response.json();
      console.log("🔍 Auth Debug:", debugData);
      console.log("🔍 Browser Cookies:", document.cookie);
      return debugData;
    } catch (error) {
      console.error("❌ Debug failed:", error);
      return null;
    }
  }, []);

  const refreshToken = useCallback(async () => {
    try {
      const refreshToken = localStorage.getItem("refreshToken");
      if (!refreshToken) {
        throw new Error("No refresh token available");
      }
      console.log("🔄 Sending refresh token:", refreshToken);
      const response = await apiRequest("POST", "/api/auth/refresh", { refreshToken });
      const { token } = await response.json();
      localStorage.setItem("jwtToken", token);
      console.log("✅ Refreshed JWT token:", token);
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      return token;
    } catch (error: any) {
      console.error("❌ Token refresh failed:", error.message);
      localStorage.removeItem("jwtToken");
      localStorage.removeItem("refreshToken");
      queryClient.setQueryData(["/api/auth/user"], null);
      return null;
    }
  }, [queryClient]);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const loginStatus = urlParams.get("login");
    const logoutStatus = urlParams.get("logout");
    const token = urlParams.get("token");
    const refreshToken = urlParams.get("refreshToken");
    const csrfToken = urlParams.get("csrfToken");

    if (loginStatus === "success") {
      if (token) localStorage.setItem("jwtToken", token);
      if (refreshToken) localStorage.setItem("refreshToken", refreshToken);
      if (csrfToken) localStorage.setItem("csrfToken", csrfToken);
      clearCsrfToken();
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cart"] });
      refetch();
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (loginStatus === "failed" || loginStatus === "error") {
      queryClient.setQueryData(["/api/auth/user"], null);
      clearCsrfToken();
      localStorage.removeItem("jwtToken");
      localStorage.removeItem("refreshToken");
      localStorage.removeItem("csrfToken");
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    if (logoutStatus === "success") {
      queryClient.clear();
      clearCsrfToken();
      localStorage.removeItem("jwtToken");
      localStorage.removeItem("refreshToken");
      localStorage.removeItem("csrfToken");
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [queryClient, refetch]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && !data && !isLoading) {
        setTimeout(async () => {
          const token = localStorage.getItem("jwtToken");
          if (token) {
            try {
              const decoded = JSON.parse(atob(token.split(".")[1]));
              const exp = decoded.exp * 1000;
              if (Date.now() >= exp - 5 * 60 * 1000) {
                await refreshToken();
              }
            } catch (error) {
              await refreshToken();
            }
          }
          queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
          refetch();
        }, 300);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [data, isLoading, queryClient, refetch, refreshToken]);

  useEffect(() => {
    const interval = setInterval(async () => {
      const token = localStorage.getItem("jwtToken");
      if (token) {
        try {
          const decoded = JSON.parse(atob(token.split(".")[1]));
          const exp = decoded.exp * 1000;
          if (Date.now() >= exp - 5 * 60 * 1000) {
            await refreshToken();
          }
        } catch {
          await refreshToken();
        }
      }
    }, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [refreshToken]);

  const login = useCallback(() => {
    const sessionId = document.cookie.match(/session=([^;]+)/)?.[1];
    const redirectUrl = new URL(`${BASE_URL}/auth/google`);
    if (sessionId) {
      redirectUrl.searchParams.append("state", sessionId);
    }
    window.location.href = redirectUrl.toString();
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch(`${BASE_URL}/auth/logout`, {
        credentials: "include",
        headers: {
          Accept: "application/json",
          Authorization: localStorage.getItem("jwtToken")
            ? `Bearer ${localStorage.getItem("jwtToken")}`
            : "",
        },
      });
      queryClient.clear();
      clearCsrfToken();
      localStorage.removeItem("jwtToken");
      localStorage.removeItem("refreshToken");
      localStorage.removeItem("csrfToken");
      queryClient.setQueryData(["/api/auth/user"], null);
      window.location.href = "/?logout=success";
    } catch {
      queryClient.clear();
      clearCsrfToken();
      localStorage.removeItem("jwtToken");
      localStorage.removeItem("refreshToken");
      localStorage.removeItem("csrfToken");
      queryClient.setQueryData(["/api/auth/user"], null);
      window.location.href = "/";
    }
  }, [queryClient]);

  const forceRefresh = useCallback(async () => {
    clearCsrfToken();
    queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
    return refetch();
  }, [queryClient, refetch]);

  return {
    user: data ?? null,
    isLoading,
    isFetching,
    isAuthenticated: !!data,
    error,
    refetch,
    login,
    logout,
    forceRefresh,
    debugAuth,
    refreshToken,
    updateUser,
  };
}
