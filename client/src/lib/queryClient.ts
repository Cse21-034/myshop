// src/lib/queryClient.ts
import { QueryClient, QueryFunction } from "@tanstack/react-query";

const BASE_URL = (
  import.meta.env.VITE_API_BASE ||
  import.meta.env.VITE_API_BASE_URL ||
  "https://myshop-test-backend.onrender.com"
).replace(/\/$/, "");

let csrfTokenCache: string | null = null;
let csrfTokenPromise: Promise<string> | null = null;

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

async function refreshJwtToken(): Promise<string | null> {
  const refreshToken = localStorage.getItem("refreshToken");
  if (!refreshToken) {
    console.warn("No refresh token available");
    return null;
  }
  try {
    const res = await fetch(`${BASE_URL}/api/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
      credentials: "include",
    });
    if (!res.ok) {
      throw new Error("Failed to refresh token");
    }
    const { token } = await res.json();
    localStorage.setItem("jwtToken", token);
    console.log("🔄 Refreshed JWT token");
    return token;
  } catch (error) {
    console.error("Failed to refresh JWT token:", error);
    localStorage.removeItem("jwtToken");
    localStorage.removeItem("refreshToken");
    return null;
  }
}

async function getCsrfToken(): Promise<string> {
  const storedCsrfToken = localStorage.getItem("csrfToken");
  if (storedCsrfToken) {
    console.log("🔐 Using stored CSRF token from localStorage");
    csrfTokenCache = storedCsrfToken;
    return storedCsrfToken;
  }

  if (csrfTokenCache) {
    return csrfTokenCache;
  }

  if (csrfTokenPromise) {
    return csrfTokenPromise;
  }

  csrfTokenPromise = (async () => {
    try {
      const res = await fetch(`${BASE_URL}/api/csrf-token`, {
        credentials: "include",
        headers: { Accept: "application/json" },
      });
      await throwIfResNotOk(res);
      const data = await res.json();
      csrfTokenCache = data.csrfToken;
      localStorage.setItem("csrfToken", csrfTokenCache);
      setTimeout(() => {
        csrfTokenCache = null;
        localStorage.removeItem("csrfToken");
      }, 10 * 60 * 1000);
      return csrfTokenCache!;
    } catch (error) {
      console.error("Failed to get CSRF token:", error);
      throw error;
    } finally {
      csrfTokenPromise = null;
    }
  })();

  return csrfTokenPromise;
}

export function clearCsrfToken() {
  csrfTokenCache = null;
  csrfTokenPromise = null;
  localStorage.removeItem("csrfToken");
}

export async function apiRequest(method: string, url: string, data?: unknown): Promise<Response> {
  const fullUrl = url.startsWith("http") ? url : `${BASE_URL}${url}`;
  const headers: Record<string, string> = {
    Accept: "application/json",
    ...(data ? { "Content-Type": "application/json" } : {}),
  };

  let token = localStorage.getItem("jwtToken");
  if (token) {
    try {
      const decoded = JSON.parse(atob(token.split(".")[1]));
      if (decoded.exp * 1000 < Date.now()) {
        console.warn("Token expired, attempting refresh");
        token = await refreshJwtToken();
      }
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
    } catch (error) {
      console.error("Invalid JWT token, clearing:", error);
      localStorage.removeItem("jwtToken");
    }
  }

  if (method !== "GET") {
    try {
      const csrfToken = await getCsrfToken();
      if (csrfToken) {
        headers["X-CSRF-Token"] = csrfToken;
      } else {
        console.warn("No CSRF token available");
      }
    } catch (error) {
      console.error("Failed to fetch CSRF token:", error);
      throw new Error("CSRF token fetch failed");
    }
  }

  console.log("🔗 API Request:", { method, url, headers, hasToken: !!token });

  let res = await fetch(fullUrl, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  console.log("🔍 Response Cookies:", res.headers.get("Set-Cookie"));

  if (res.status === 401 && token) {
    console.warn("401 Unauthorized, attempting token refresh");
    token = await refreshJwtToken();
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
      res = await fetch(fullUrl, {
        method,
        headers,
        body: data ? JSON.stringify(data) : undefined,
        credentials: "include",
      });
      console.log("🔍 Retry Response Cookies:", res.headers.get("Set-Cookie"));
    }
  }

  if (res.status === 403 && method !== "GET") {
    console.warn("403 Forbidden, retrying with fresh CSRF token");
    clearCsrfToken();
    const retryToken = await getCsrfToken();
    if (retryToken) {
      headers["X-CSRF-Token"] = retryToken;
      res = await fetch(fullUrl, {
        method,
        headers,
        body: data ? JSON.stringify(data) : undefined,
        credentials: "include",
      });
      console.log("🔍 Retry Response Cookies:", res.headers.get("Set-Cookie"));
    }
  }

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";

export const getQueryFn: <T>(options: { on401: UnauthorizedBehavior }) => QueryFunction<T> =
  ({ on401 }) =>
  async ({ queryKey }) => {
    const urlOrPath = queryKey[0] as string;
    const fullUrl = urlOrPath.startsWith("http") ? urlOrPath : `${BASE_URL}${urlOrPath}`;

    const headers: Record<string, string> = {
      Accept: "application/json",
    };

    let token = localStorage.getItem("jwtToken");
    if (token) {
      try {
        const decoded = JSON.parse(atob(token.split(".")[1]));
        if (decoded.exp * 1000 < Date.now()) {
          console.warn("Token expired, attempting refresh");
          token = await refreshJwtToken();
        }
        if (token) {
          headers["Authorization"] = `Bearer ${token}`;
        }
      } catch (error) {
        console.error("Invalid JWT token, clearing:", error);
        localStorage.removeItem("jwtToken");
      }
    }

    try {
      const csrfToken = await getCsrfToken();
      if (csrfToken) {
        headers["X-CSRF-Token"] = csrfToken;
      }
    } catch (error) {
      console.debug("CSRF token not available for GET request:", error);
    }

    let res = await fetch(fullUrl, {
      credentials: "include",
      headers,
    });

    console.log("🔗 Query Response:", { url: fullUrl, status: res.status, headers });
    console.log("🔍 Response Cookies:", res.headers.get("Set-Cookie"));

    if (res.status === 401 && token && on401 !== "returnNull") {
      console.warn("401 Unauthorized, attempting token refresh");
      token = await refreshJwtToken();
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
        res = await fetch(fullUrl, {
          credentials: "include",
          headers,
        });
        console.log("🔍 Retry Response Cookies:", res.headers.get("Set-Cookie"));
      }
    }

    if (on401 === "returnNull" && res.status === 401) {
      return null as any;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const customQueryFn = async ({ queryKey }: { queryKey: readonly unknown[] }) => {
  const urlOrPath = queryKey[0] as string;
  const fullUrl = urlOrPath.startsWith("http") ? urlOrPath : `${BASE_URL}${urlOrPath}`;

  const headers: Record<string, string> = {
    Accept: "application/json",
  };

  let token = localStorage.getItem("jwtToken");
  if (token) {
    try {
      const decoded = JSON.parse(atob(token.split(".")[1]));
      if (decoded.exp * 1000 < Date.now()) {
        console.warn("Token expired, attempting refresh");
        token = await refreshJwtToken();
      }
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
    } catch (error) {
      console.error("Invalid JWT token, clearing:", error);
      localStorage.removeItem("jwtToken");
    }
  }

  try {
    const csrfToken = await getCsrfToken();
    if (csrfToken) {
      headers["X-CSRF-Token"] = csrfToken;
    }
  } catch (error) {
    console.debug("CSRF token not available:", error);
  }

  const res = await fetch(fullUrl, {
    credentials: "include",
    headers,
  });

  console.log("🔍 Response Cookies:", res.headers.get("Set-Cookie"));

  if (!res.ok) {
    if (res.status === 404) {
      throw new Error("Resource not found");
    }
    throw new Error(`Failed to fetch: ${res.status} ${res.statusText}`);
  }

  return res.json();
};

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000,
      retry: (failureCount, error) => {
        if (error?.message?.includes("401") || error?.message?.includes("403") || error?.message?.includes("404")) {
          return false;
        }
        return failureCount < 3;
      },
    },
    mutations: {
      retry: (failureCount, error) => {
        if (error?.message?.includes("4")) {
          return false;
        }
        return failureCount < 2;
      },
    },
  },
});

export function buildApiUrl(path: string): string {
  if (path.startsWith("http")) {
    return path;
  }
  return `${BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

export function createQueryKey(path: string, params?: Record<string, any>): string[] {
  const basePath = path.startsWith("/api/") ? path : `/api/${path.replace(/^\//, "")}`;
  if (params) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        searchParams.append(key, String(value));
      }
    });
    const queryString = searchParams.toString();
    return queryString ? [`${basePath}?${queryString}`] : [basePath];
  }
  return [basePath];
}

export { BASE_URL };
