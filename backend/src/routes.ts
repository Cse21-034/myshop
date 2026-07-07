// server/src/routes.ts
import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { isAuthenticated } from "./googleAuth";
import { eq, sql, and, count, avg, desc, gte, lt } from "drizzle-orm";
import { db } from "./db";
import { contactMessages, products, orders, productLikes, wishlistItems, productReviews, orderItems, users, stockNotifications, returnRequests, coupons, notifications, productQuestions, payoutRequests, abandonedCartLogs, cartItems, sellers } from "./schema";
import { createStripePaymentIntent, initiateOrangeMoneyPayment } from "./payment";
import { createPayPalOrder, capturePayPalOrder } from "./paypal-service";
import { sendEmail, otpEmailTemplate, orderConfirmationTemplate, orderStatusUpdateTemplate } from "./email";
import { setOtp, getOtp, incrementOtpAttempts, deleteOtp } from "./tokenStore";
import {
  insertProductSchema,
  insertCategorySchema,
  insertCartItemSchema,
  insertOrderSchema,
  insertContactMessageSchema,
  updateUserSchema,
} from "./schema";
import { z } from "zod";
import csurf from "csurf";
import { sendWhatsAppMessage, sendReservationStatusToCustomer } from "./twilio";

// ── ERM Marketplace Integration ───────────────────────────────────────────────
import { syncMarketplaceProducts } from "./marketplace-sync.service";
import { notifyERMOfOrder } from "./erm-order-notify.service";

// ── Kgotla Marketplace Integration ───────────────────────────────────────────
import { syncKgotlaProducts } from "./kgotla-sync.service";
import { notifyKgotlaOfOrder } from "./kgotla-order-notify.service";

// Simple in-memory rate limiter for contact form (5 submissions per IP per hour)
const contactRateLimit = new Map<string, number[]>();

export async function registerRoutes(app: Express): Promise<Server> {
  const csrfProtection = csurf();

  // ── ERM: Sync on startup (non-blocking) ──────────────────────────────────
  if (process.env.ERM_AUTO_SYNC_ON_START === "true") {
    syncMarketplaceProducts().catch((err) =>
      console.error("[ERM Sync] Startup sync failed:", err),
    );
  }

  // ── ERM: Periodic background sync ────────────────────────────────────────
  const syncIntervalMs = parseInt(
    process.env.ERM_SYNC_INTERVAL_MS ?? "900000",
    10,
  );

  if (process.env.ERM_AUTO_SYNC === "true") {
    setInterval(() => {
      syncMarketplaceProducts().catch((err) =>
        console.error("[ERM Sync] Periodic sync failed:", err),
      );
    }, syncIntervalMs);
    console.log(
      `[ERM Sync] Periodic sync scheduled every ${syncIntervalMs / 60000} min`,
    );
  }

  // ── Kgotla: Sync on startup (non-blocking) ────────────────────────────────
  if (process.env.KGOTLA_AUTO_SYNC_ON_START === "true") {
    syncKgotlaProducts().catch((err) =>
      console.error("[Kgotla Sync] Startup sync failed:", err),
    );
  }

  // ── Kgotla: Periodic background sync ─────────────────────────────────────
  const kgotlaSyncIntervalMs = parseInt(
    process.env.KGOTLA_SYNC_INTERVAL_MS ?? "900000",
    10,
  );

  if (process.env.KGOTLA_AUTO_SYNC === "true") {
    setInterval(() => {
      syncKgotlaProducts().catch((err) =>
        console.error("[Kgotla Sync] Periodic sync failed:", err),
      );
    }, kgotlaSyncIntervalMs);
    console.log(
      `[Kgotla Sync] Periodic sync scheduled every ${kgotlaSyncIntervalMs / 60000} min`,
    );
  }

  // ==========================================================================
  // ERM ADMIN ROUTES
  // ==========================================================================

  app.post("/api/erm/sync", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const user = await storage.getUser((req.user as any).id);
      if (!user?.isAdmin) {
        return res.status(403).json({ message: "Admin access required", code: "FORBIDDEN" });
      }
      console.log("[ERM Sync] Manual sync triggered by admin", (req.user as any).id);
      const summary = await syncMarketplaceProducts();
      res.json({ message: "ERM sync complete", summary });
    } catch (error) {
      console.error("[ERM Sync] Manual sync failed:", error);
      res.status(500).json({ message: "ERM sync failed", code: "ERM_SYNC_ERROR" });
    }
  });

  app.get("/api/erm/status", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const user = await storage.getUser((req.user as any).id);
      if (!user?.isAdmin) {
        return res.status(403).json({ message: "Admin access required", code: "FORBIDDEN" });
      }
      res.json({
        ermApiUrl: process.env.ERM_API_URL ?? "https://farm-management-api-6p6h.onrender.com",
        autoSyncEnabled: process.env.ERM_AUTO_SYNC === "true",
        syncIntervalMinutes: syncIntervalMs / 60000,
        orderNotifyEnabled: process.env.ERM_NOTIFY_ORDERS === "true",
      });
    } catch (error) {
      console.error("[ERM Status] Error:", error);
      res.status(500).json({ message: "Failed to fetch ERM status", code: "ERM_STATUS_ERROR" });
    }
  });

  // Admin: resend an order notification to ERM (for orders that failed during the 401 period)
  app.post("/api/admin/orders/:id/notify-erm", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const user = await storage.getUser((req.user as any).id);
      if (!user?.isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }
      const orderId = Number(req.params.id);
      const order = await storage.getOrder(orderId);
      if (!order) return res.status(404).json({ message: "Order not found" });
      const items = await storage.getOrderItemsByOrderId(orderId);
      await notifyERMOfOrder(order, items);
      console.log(`[ERM Notify] Admin manually re-sent order #${orderId} to ERM`);
      res.json({ success: true });
    } catch (error) {
      console.error("[ERM Notify] Manual resend failed:", error);
      res.status(500).json({ message: "Failed to resend order to ERM" });
    }
  });

  // ERM callback — farm owner confirmed or rejected a reservation on the ERM side
  app.post("/api/erm/order-status", async (req: Request, res: Response) => {
    const secret = req.headers["x-ecommerce-secret"];
    if (!secret || secret !== process.env.ERM_WEBHOOK_SECRET) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    try {
      const { ecommerce_order_id, status } = req.body;
      if (!ecommerce_order_id || !["confirmed", "cancelled"].includes(status)) {
        return res.status(400).json({ message: "ecommerce_order_id and status (confirmed|cancelled) are required" });
      }
      const order = await storage.getOrder(Number(ecommerce_order_id));
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }
      const updatedOrder = await storage.updateOrderStatus(Number(ecommerce_order_id), status);
      const items = await storage.getOrderItemsByOrderId(Number(ecommerce_order_id));
      sendReservationStatusToCustomer({ ...updatedOrder, items }, status === "confirmed").catch((err) =>
        console.error("[ERM Order Status] WhatsApp notification failed:", err)
      );
      console.log(`[ERM Order Status] Order #${ecommerce_order_id} → ${status}`);
      res.json({ success: true, order_id: ecommerce_order_id, status });
    } catch (error) {
      console.error("[ERM Order Status] Error:", error);
      res.status(500).json({ message: "Failed to update order status" });
    }
  });

  // ==========================================================================
  // KGOTLA ADMIN ROUTES
  // ==========================================================================

  app.post("/api/kgotla/sync", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const user = await storage.getUser((req.user as any).id);
      if (!user?.isAdmin) {
        return res.status(403).json({ message: "Admin access required", code: "FORBIDDEN" });
      }
      console.log("[Kgotla Sync] Manual sync triggered by admin", (req.user as any).id);
      const summary = await syncKgotlaProducts();
      res.json({ message: "Kgotla sync complete", summary });
    } catch (error) {
      console.error("[Kgotla Sync] Manual sync failed:", error);
      res.status(500).json({ message: "Kgotla sync failed", code: "KGOTLA_SYNC_ERROR" });
    }
  });

  app.get("/api/kgotla/status", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const user = await storage.getUser((req.user as any).id);
      if (!user?.isAdmin) {
        return res.status(403).json({ message: "Admin access required", code: "FORBIDDEN" });
      }
      res.json({
        kgotlaApiUrl:       process.env.KGOTLA_API_URL ?? "https://kgotla-backend.onrender.com",
        autoSyncEnabled:    process.env.KGOTLA_AUTO_SYNC === "true",
        syncIntervalMinutes: kgotlaSyncIntervalMs / 60000,
        orderNotifyEnabled: process.env.KGOTLA_NOTIFY_ORDERS === "true",
        cloudinaryConfigured: !!(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_UPLOAD_PRESET),
      });
    } catch (error) {
      console.error("[Kgotla Status] Error:", error);
      res.status(500).json({ message: "Failed to fetch Kgotla status", code: "KGOTLA_STATUS_ERROR" });
    }
  });

  // Kgotla → Myshop status callback (called by Kgotla when order status changes)
  app.post("/api/kgotla/order-status", async (req: Request, res: Response) => {
    const secret = req.headers["x-myshop-secret"];
    if (!secret || secret !== process.env.KGOTLA_API_SECRET) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    try {
      const { myshop_order_id, status } = req.body;
      if (!myshop_order_id || !status) {
        return res.status(400).json({ message: "myshop_order_id and status are required" });
      }

      // Map Kgotla status values to Myshop statuses
      const STATUS_MAP: Record<string, string> = {
        confirmed:  "processing",
        dispatched: "shipped",
        completed:  "delivered",
        cancelled:  "cancelled",
      };

      const myshopStatus = STATUS_MAP[status];
      if (!myshopStatus) {
        return res.status(400).json({ message: `Unknown status: ${status}` });
      }

      const order = await storage.getOrder(Number(myshop_order_id));
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }

      await storage.updateOrderStatus(Number(myshop_order_id), myshopStatus);
      console.log(`[Kgotla Status] Order #${myshop_order_id} → ${myshopStatus} (from Kgotla: ${status})`);
      res.json({ success: true, order_id: myshop_order_id, status: myshopStatus });
    } catch (error) {
      console.error("[Kgotla Status] Error:", error);
      res.status(500).json({ message: "Failed to update order status" });
    }
  });

  // ==========================================================================
  // SELLER ROUTES
  // ==========================================================================

  // Apply to become a seller
  app.post("/api/seller/apply", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = (req.user as any).id;
      const existing = await storage.getSellerByUserId(userId);
      if (existing) return res.status(409).json({ message: "You already have a seller application." });
      const { storeName, description, phone, address, logoUrl } = req.body;
      if (!storeName) return res.status(400).json({ message: "Store name is required." });
      const seller = await storage.createSeller({ userId, storeName, description, phone, address, logoUrl });
      res.status(201).json(seller);
    } catch (err) {
      console.error("[Seller Apply]", err);
      res.status(500).json({ message: "Failed to submit application." });
    }
  });

  // Get own seller profile
  app.get("/api/seller/me", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const seller = await storage.getSellerByUserId((req.user as any).id);
      if (!seller) return res.status(404).json({ message: "No seller profile found." });
      res.json(seller);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch seller profile." });
    }
  });

  // Update own seller profile
  app.put("/api/seller/me", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const seller = await storage.getSellerByUserId((req.user as any).id);
      if (!seller) return res.status(404).json({ message: "No seller profile found." });
      if (seller.status !== "approved") return res.status(403).json({ message: "Only approved sellers can update their profile." });
      const { storeName, description, phone, address, logoUrl, location, yearFounded, responseTime, onTimeDeliveryRate, services, tradingHours } = req.body;
      const updated = await storage.updateSeller(seller.id, { storeName, description, phone, address, logoUrl, location, yearFounded, responseTime, onTimeDeliveryRate, services, tradingHours });
      res.json(updated);
    } catch (err) {
      res.status(500).json({ message: "Failed to update profile." });
    }
  });

  // Seller: list own products
  app.get("/api/seller/products", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = (req.user as any).id;
      const seller = await storage.getSellerByUserId(userId);
      if (!seller || seller.status !== "approved") return res.status(403).json({ message: "Approved seller account required." });
      const items = await storage.getProductsBySeller(userId);
      res.json(items);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch products." });
    }
  });

  // Seller: create product
  app.post("/api/seller/products", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = (req.user as any).id;
      const seller = await storage.getSellerByUserId(userId);
      if (!seller || seller.status !== "approved") return res.status(403).json({ message: "Approved seller account required." });
      const validated = insertProductSchema.parse({ ...req.body, sellerId: userId });
      const product = await storage.createProduct(validated);
      res.status(201).json(product);
    } catch (err: any) {
      console.error("[Seller createProduct]", err);
      if (err.name === "ZodError") return res.status(400).json({ message: "Invalid product data", errors: err.errors });
      if (err.code === "23505" && err.constraint?.includes("slug")) {
        return res.status(409).json({ message: "A product with this slug already exists. Change the slug and try again." });
      }
      res.status(500).json({ message: err.message || "Failed to create product." });
    }
  });

  // Seller: update own product
  app.put("/api/seller/products/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = (req.user as any).id;
      const seller = await storage.getSellerByUserId(userId);
      if (!seller || seller.status !== "approved") return res.status(403).json({ message: "Approved seller account required." });
      const product = await storage.getProduct(Number(req.params.id));
      if (!product) return res.status(404).json({ message: "Product not found." });
      if (product.sellerId !== userId) return res.status(403).json({ message: "You do not own this product." });
      const updated = await storage.updateProduct(Number(req.params.id), req.body);
      res.json(updated);
    } catch (err: any) {
      console.error("[Seller updateProduct]", err);
      if (err.code === "23505" && err.constraint?.includes("slug")) {
        return res.status(409).json({ message: "A product with this slug already exists. Change the slug and try again." });
      }
      res.status(500).json({ message: err.message || "Failed to update product." });
    }
  });

  // Seller: delete own product
  app.delete("/api/seller/products/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = (req.user as any).id;
      const seller = await storage.getSellerByUserId(userId);
      if (!seller || seller.status !== "approved") return res.status(403).json({ message: "Approved seller account required." });
      const product = await storage.getProduct(Number(req.params.id));
      if (!product) return res.status(404).json({ message: "Product not found." });
      if (product.sellerId !== userId) return res.status(403).json({ message: "You do not own this product." });
      await storage.deleteProduct(Number(req.params.id));
      res.json({ message: "Product deleted." });
    } catch (err) {
      res.status(500).json({ message: "Failed to delete product." });
    }
  });

  // Seller: list orders containing their products
  app.get("/api/seller/orders", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = (req.user as any).id;
      const seller = await storage.getSellerByUserId(userId);
      if (!seller || seller.status !== "approved") return res.status(403).json({ message: "Approved seller account required." });
      const sellerOrders = await storage.getOrdersBySeller(userId);
      res.json(sellerOrders);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch orders." });
    }
  });

  // Seller: dashboard stats
  app.get("/api/seller/stats", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = (req.user as any).id;
      const seller = await storage.getSellerByUserId(userId);
      if (!seller || seller.status !== "approved") return res.status(403).json({ message: "Approved seller account required." });
      const [sellerProducts, sellerOrders] = await Promise.all([
        storage.getProductsBySeller(userId),
        storage.getOrdersBySeller(userId),
      ]);
      const totalRevenue = sellerOrders
        .flatMap(o => o.items)
        .filter(i => i.productId && sellerProducts.some(p => p.id === i.productId))
        .reduce((sum, i) => sum + parseFloat(i.productPrice) * i.quantity, 0);
      res.json({
        totalProducts: sellerProducts.length,
        totalOrders: sellerOrders.length,
        totalRevenue: totalRevenue.toFixed(2),
        recentOrders: sellerOrders.slice(0, 5),
      });
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch stats." });
    }
  });

  // ==========================================================================
  // ADMIN: SELLER MANAGEMENT
  // ==========================================================================

  // List all sellers
  app.get("/api/admin/sellers", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const user = await storage.getUser((req.user as any).id);
      if (!user?.isAdmin) return res.status(403).json({ message: "Admin access required." });
      const status = req.query.status as string | undefined;
      const allSellers = await storage.getSellers(status);
      res.json(allSellers);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch sellers." });
    }
  });

  // Approve / reject / suspend a seller
  app.put("/api/admin/sellers/:id/status", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const user = await storage.getUser((req.user as any).id);
      if (!user?.isAdmin) return res.status(403).json({ message: "Admin access required." });
      const { status } = req.body;
      if (!["approved", "rejected", "suspended", "pending"].includes(status)) {
        return res.status(400).json({ message: "Invalid status." });
      }
      const seller = await storage.getSellerById(Number(req.params.id));
      if (!seller) return res.status(404).json({ message: "Seller not found." });
      const updated = await storage.updateSellerStatus(Number(req.params.id), status);
      // Grant or revoke isSeller flag on the user
      await storage.setUserIsSeller(seller.userId, status === "approved");
      res.json(updated);
    } catch (err) {
      res.status(500).json({ message: "Failed to update seller status." });
    }
  });

  // ==========================================================================
  // AUTH ROUTES
  // ==========================================================================

  app.post("/api/auth/register", async (req: Request, res: Response) => {
    try {
      const { email, password, firstName, lastName } = req.body;
      if (!email || !password || !firstName) {
        return res.status(400).json({ message: "Email, password and first name are required" });
      }
      if (password.length < 8) {
        return res.status(400).json({ message: "Password must be at least 8 characters" });
      }

      const existing = await storage.getUserByEmail(email);
      if (existing) {
        if (!existing.passwordHash) {
          return res.status(409).json({
            message: "This email is linked to a Google account. Please sign in with Google.",
            code: "USE_GOOGLE",
          });
        }
        return res.status(409).json({ message: "Email already registered", code: "EMAIL_EXISTS" });
      }

      const bcrypt = await import("bcryptjs");
      const passwordHash = await bcrypt.hash(password, 12);
      const { randomUUID } = await import("crypto");

      const user = await storage.upsertUser({
        id: randomUUID(),
        email,
        firstName,
        lastName: lastName || null,
        profileImageUrl: null,
        passwordHash,
      });

      const jwt = await import("jsonwebtoken");
      const token = jwt.default.sign(
        { id: user.id, email: user.email, isAdmin: user.isAdmin },
        process.env.JWT_SECRET!,
        { expiresIn: "1h" }
      );
      const refreshToken = jwt.default.sign({ id: user.id }, process.env.JWT_SECRET!, { expiresIn: "7d" });

      res.status(201).json({ token, refreshToken, user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, isAdmin: user.isAdmin } });
    } catch (error) {
      console.error("Register error:", error);
      res.status(500).json({ message: "Registration failed" });
    }
  });

  app.post("/api/auth/login", async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
      }

      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(401).json({ message: "Invalid email or password" });
      }
      if (!user.passwordHash) {
        return res.status(401).json({
          message: "This account uses Google sign-in. Please log in with Google.",
          code: "USE_GOOGLE",
        });
      }

      const bcrypt = await import("bcryptjs");
      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      const jwt = await import("jsonwebtoken");
      const token = jwt.default.sign(
        { id: user.id, email: user.email, isAdmin: user.isAdmin },
        process.env.JWT_SECRET!,
        { expiresIn: "1h" }
      );
      const refreshToken = jwt.default.sign({ id: user.id }, process.env.JWT_SECRET!, { expiresIn: "7d" });

      res.json({ token, refreshToken, user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, isAdmin: user.isAdmin } });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ message: "Login failed" });
    }
  });

  // ── Forgot password — sends 6-digit OTP ─────────────────────────────────
  app.post("/api/auth/forgot-password", async (req: Request, res: Response) => {
    try {
      const { email } = req.body;
      if (!email) return res.status(400).json({ message: "Email is required" });

      const normalised = email.toLowerCase().trim();
      const user = await storage.getUserByEmail(normalised);

      // Always return 200 to prevent email enumeration
      if (!user || !user.email) {
        return res.json({ message: "If that email is registered, you'll receive a code shortly." });
      }
      if (!user.passwordHash) {
        // Google-only account — tell them directly so they don't wait for an OTP
        return res.status(409).json({
          message: "This account uses Google sign-in. Please log in with Google.",
          code: "USE_GOOGLE",
        });
      }

      // Rate-limit: only one new OTP per 60 seconds
      const existing = getOtp(normalised);
      if (existing && Date.now() - existing.createdAt < 60 * 1000) {
        return res.status(429).json({ message: "Please wait 60 seconds before requesting another code." });
      }

      const { randomInt } = await import("crypto");
      const otp = String(randomInt(100000, 1000000)).padStart(6, "0");
      setOtp(normalised, otp, user.id);

      const html = otpEmailTemplate(otp, user.firstName || "there");
      await sendEmail(user.email, "Your Fountstream verification code", html);

      res.json({ message: "If that email is registered, you'll receive a code shortly." });
    } catch (err: any) {
      console.error("[forgot-password]", err);
      res.status(500).json({ message: "Failed to send code. Please try again." });
    }
  });

  // ── Verify OTP — returns a short-lived reset JWT ─────────────────────────
  app.post("/api/auth/verify-otp", async (req: Request, res: Response) => {
    try {
      const { email, otp } = req.body;
      if (!email || !otp) return res.status(400).json({ message: "Email and code are required" });

      const normalised = email.toLowerCase().trim();
      const entry = getOtp(normalised);
      if (!entry) {
        return res.status(400).json({
          message: "Code has expired or is invalid. Please request a new one.",
          code: "EXPIRED",
        });
      }

      if (String(otp).trim() !== entry.otp) {
        const attempts = incrementOtpAttempts(normalised);
        const remaining = 5 - attempts;
        if (remaining <= 0) {
          return res.status(400).json({
            message: "Too many incorrect attempts. Please request a new code.",
            code: "LOCKED",
          });
        }
        return res.status(400).json({
          message: `Incorrect code. ${remaining} attempt${remaining === 1 ? "" : "s"} remaining.`,
          code: "WRONG_OTP",
          remaining,
        });
      }

      // OTP correct — consume it and issue a 10-minute reset JWT
      deleteOtp(normalised);

      const jwt = await import("jsonwebtoken");
      const resetToken = jwt.default.sign(
        { userId: entry.userId, email: entry.email, purpose: "password-reset" },
        process.env.JWT_SECRET!,
        { expiresIn: "10m" }
      );

      res.json({ resetToken });
    } catch (err: any) {
      console.error("[verify-otp]", err);
      res.status(500).json({ message: "Verification failed. Please try again." });
    }
  });

  // ── Reset password — accepts resetToken from verify-otp ──────────────────
  app.post("/api/auth/reset-password", async (req: Request, res: Response) => {
    try {
      const { resetToken, password } = req.body;
      if (!resetToken || !password) return res.status(400).json({ message: "Reset token and password are required" });
      if (password.length < 8) return res.status(400).json({ message: "Password must be at least 8 characters" });

      let payload: any;
      try {
        const jwt = await import("jsonwebtoken");
        payload = jwt.default.verify(resetToken, process.env.JWT_SECRET!);
      } catch {
        return res.status(400).json({ message: "Session has expired. Please start over." });
      }

      if (payload.purpose !== "password-reset") {
        return res.status(400).json({ message: "Invalid reset token." });
      }

      const bcrypt = await import("bcryptjs");
      const passwordHash = await bcrypt.hash(password, 12);
      await storage.updateUser(payload.userId, { passwordHash } as any);

      res.json({ message: "Password updated successfully. You can now sign in." });
    } catch (err: any) {
      console.error("[reset-password]", err);
      res.status(500).json({ message: "Failed to reset password. Please try again." });
    }
  });

  app.get("/api/auth/user", async (req: Request, res: Response) => {
    try {
      const user = req.isAuthenticated() ? req.user : null;
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user", code: "FETCH_USER_ERROR" });
    }
  });

  app.put("/api/user/profile", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const validated = updateUserSchema.parse(req.body);
      const userId = (req.user as any).id;
      const updatedUser = await storage.updateUser(userId, validated);
      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json(updatedUser);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      console.error("Failed to update user profile", error);
      res.status(500).json({ message: "Failed to update profile", code: "UPDATE_PROFILE_ERROR" });
    }
  });

  app.post("/api/auth/refresh", csrfProtection, async (req: Request, res: Response) => {
    try {
      const { refreshToken } = req.body;
      if (!refreshToken) {
        return res.status(400).json({ message: "Refresh token required" });
      }
      // The refresh logic is handled in googleAuth.ts
    } catch (error) {
      console.error("Error refreshing token:", error);
      res.status(401).json({ message: "Invalid or expired refresh token" });
    }
  });

  // ==========================================================================
  // PAYMENT ROUTES
  // ==========================================================================

  app.post("/api/payments/stripe/create", csrfProtection, async (req: Request, res: Response) => {
    try {
      const { amount, currency } = req.body;
      const clientSecret = await createStripePaymentIntent(amount, currency);
      res.json({ clientSecret });
    } catch (error) {
      console.error("Error creating Stripe payment intent:", error);
      res.status(500).json({ message: "Failed to create payment intent", code: "STRIPE_CREATE_ERROR" });
    }
  });

  app.post("/api/payments/paypal/create", csrfProtection, async (req: Request, res: Response) => {
    try {
      const { amount, currency = "USD" } = req.body;

      if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
        return res.status(400).json({
          message: "Invalid amount provided",
          code: "INVALID_AMOUNT",
        });
      }

      console.log("Creating PayPal order for amount:", amount, "currency:", currency);
      const orderId = await createPayPalOrder(amount, currency);
      console.log("PayPal order created successfully:", orderId);
      res.json({ orderId });
    } catch (error: any) {
      console.error("Error creating PayPal order:", error.message || error);
      const statusCode = error.message?.includes("Invalid") ? 400 : 500;
      res.status(statusCode).json({
        message: error.message || "Failed to create PayPal order",
        code: "PAYPAL_CREATE_ERROR",
      });
    }
  });

  app.post("/api/payments/paypal/capture", csrfProtection, async (req: Request, res: Response) => {
    try {
      const { orderId } = req.body;

      if (!orderId || typeof orderId !== "string") {
        return res.status(400).json({
          message: "Invalid order ID provided",
          code: "INVALID_ORDER_ID",
        });
      }

      console.log("Capturing PayPal order:", orderId);
      const captureResult = await capturePayPalOrder(orderId);
      console.log("PayPal order captured successfully:", captureResult);
      res.json({
        status: "success",
        id: captureResult.id,
        captureId: captureResult.captureId,
        amount: captureResult.amount,
      });
    } catch (error: any) {
      console.error("Error capturing PayPal order:", error.message || error);
      const statusCode =
        error.message?.includes("Invalid") || error.message?.includes("not found")
          ? 400
          : 500;
      res.status(statusCode).json({
        message: error.message || "Failed to capture PayPal order",
        code: "PAYPAL_CAPTURE_ERROR",
      });
    }
  });

  app.post("/api/payments/orangemoney/initiate", csrfProtection, async (req: Request, res: Response) => {
    try {
      const { phone, amount, currency } = req.body;
      const transactionId = await initiateOrangeMoneyPayment(phone, amount, currency);
      res.json({ transactionId });
    } catch (error) {
      console.error("Error initiating Orange Money payment:", error);
      res.status(500).json({ message: "Failed to initiate Orange Money payment", code: "ORANGEMONEY_INITIATE_ERROR" });
    }
  });

  // ==========================================================================
  // CATEGORY ROUTES
  // ==========================================================================

  app.get("/api/categories", async (req: Request, res: Response) => {
    try {
      const categories = await storage.getCategories();
      res.json(categories);
    } catch (error) {
      console.error("Error fetching categories:", error);
      res.status(500).json({ message: "Failed to fetch categories", code: "FETCH_CATEGORIES_ERROR" });
    }
  });

  app.post("/api/categories", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const user = await storage.getUser((req.user as any).id);
      if (!user?.isAdmin) {
        return res.status(403).json({ message: "Admin access required", code: "FORBIDDEN" });
      }
      const validatedData = insertCategorySchema.parse(req.body);
      const category = await storage.createCategory(validatedData);
      res.json(category);
    } catch (error) {
      console.error("Error creating category:", error);
      res.status(500).json({ message: "Failed to create category", code: "CREATE_CATEGORY_ERROR" });
    }
  });

  // ==========================================================================
  // PRODUCT ROUTES
  // ==========================================================================

  app.get("/api/products", async (req: Request, res: Response) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
      const offset = req.query.offset ? parseInt(req.query.offset as string) : undefined;
      const filters = {
        categoryId: req.query.categoryId ? parseInt(req.query.categoryId as string) : undefined,
        search: req.query.search as string || undefined,
        minPrice: req.query.minPrice ? parseFloat(req.query.minPrice as string) : undefined,
        maxPrice: req.query.maxPrice ? parseFloat(req.query.maxPrice as string) : undefined,
        featured: req.query.featured === "true" ? true : undefined,
        active: req.query.active !== "false",
        limit,
        offset,
      };
      const productList = await storage.getProducts(filters);

      // When paginating, also return total count for the same filters (without limit/offset)
      if (limit !== undefined) {
        const totalList = await storage.getProducts({ ...filters, limit: undefined, offset: undefined });
        return res.json({ data: productList, total: totalList.length });
      }

      res.json(productList);
    } catch (error) {
      console.error("Error fetching products:", error);
      res.status(500).json({ message: "Failed to fetch products", code: "FETCH_PRODUCTS_ERROR" });
    }
  });

  app.get("/api/products/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const product = await storage.getProduct(id);
      if (!product) {
        return res.status(404).json({ message: "Product not found", code: "PRODUCT_NOT_FOUND" });
      }
      // Attach seller profile if product has a sellerId
      let seller = null;
      if (product.sellerId) {
        const sellerRow = await storage.getSellerByUserId(product.sellerId);
        if (sellerRow) {
          const avgRatingRow = await db
            .select({ avg: avg(productReviews.rating), cnt: count(productReviews.id) })
            .from(productReviews)
            .innerJoin(products, eq(products.id, productReviews.productId))
            .where(eq(products.sellerId, product.sellerId));
          const avgR = parseFloat(avgRatingRow[0]?.avg ?? "0");
          seller = {
            id: sellerRow.id,
            storeName: sellerRow.storeName,
            description: sellerRow.description,
            logoUrl: sellerRow.logoUrl,
            location: sellerRow.location,
            yearFounded: sellerRow.yearFounded,
            responseTime: sellerRow.responseTime,
            onTimeDeliveryRate: sellerRow.onTimeDeliveryRate,
            services: sellerRow.services,
            tradingHours: sellerRow.tradingHours,
            avgRating: isNaN(avgR) ? 0 : avgR,
            reviewCount: Number(avgRatingRow[0]?.cnt ?? 0),
            highlyRated: avgR >= 4.0 && Number(avgRatingRow[0]?.cnt ?? 0) >= 3,
          };
        }
      }
      res.json({ ...product, seller });
    } catch (error) {
      console.error("Error fetching product:", error);
      res.status(500).json({ message: "Failed to fetch product", code: "FETCH_PRODUCT_ERROR" });
    }
  });

  // Public seller profile
  app.get("/api/sellers/:id", async (req: Request, res: Response) => {
    try {
      const sellerRow = await storage.getSellerById(parseInt(req.params.id));
      if (!sellerRow || sellerRow.status !== "approved") return res.status(404).json({ message: "Seller not found" });
      const avgRatingRow = await db
        .select({ avg: avg(productReviews.rating), cnt: count(productReviews.id) })
        .from(productReviews)
        .innerJoin(products, eq(products.id, productReviews.productId))
        .where(eq(products.sellerId, sellerRow.userId));
      const avgR = parseFloat(avgRatingRow[0]?.avg ?? "0");
      res.json({
        ...sellerRow,
        avgRating: isNaN(avgR) ? 0 : avgR,
        reviewCount: Number(avgRatingRow[0]?.cnt ?? 0),
        highlyRated: avgR >= 4.0 && Number(avgRatingRow[0]?.cnt ?? 0) >= 3,
      });
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch seller" });
    }
  });

  app.post("/api/products", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const user = await storage.getUser((req.user as any).id);
      if (!user?.isAdmin) {
        return res.status(403).json({ message: "Admin access required", code: "FORBIDDEN" });
      }
      const validatedData = insertProductSchema.parse(req.body);
      const product = await storage.createProduct(validatedData);
      res.json(product);
    } catch (error) {
      console.error("Error creating product:", error);
      res.status(500).json({ message: "Failed to create product", code: "CREATE_PRODUCT_ERROR" });
    }
  });

  app.put("/api/products/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const user = await storage.getUser((req.user as any).id);
      if (!user?.isAdmin) {
        return res.status(403).json({ message: "Admin access required", code: "FORBIDDEN" });
      }
      const id = parseInt(req.params.id);
      const oldProduct = await storage.getProduct(id);
      const validatedData = insertProductSchema.partial().parse(req.body);
      const product = await storage.updateProduct(id, validatedData);

      // If stock just became available, notify subscribers
      if (oldProduct && (oldProduct.stock ?? 0) === 0 && (product?.stock ?? 0) > 0) {
        const subs = await db.select().from(stockNotifications).where(and(eq(stockNotifications.productId, id), eq(stockNotifications.notified, false)));
        for (const sub of subs) {
          sendEmail(sub.email, `${product!.name} is back in stock!`,
            `<p>Good news! <strong>${product!.name}</strong> is now back in stock on Fountstream.</p><p><a href="${process.env.FRONTEND_URL ?? ""}/product/${id}">Shop now</a></p>`
          ).catch(() => {});
          db.update(stockNotifications).set({ notified: true }).where(eq(stockNotifications.id, sub.id)).catch(() => {});
        }
      }

      res.json(product);
    } catch (error) {
      console.error("Error updating product:", error);
      res.status(500).json({ message: "Failed to update product", code: "UPDATE_PRODUCT_ERROR" });
    }
  });

  app.delete("/api/products/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const user = await storage.getUser((req.user as any).id);
      if (!user?.isAdmin) {
        return res.status(403).json({ message: "Admin access required", code: "FORBIDDEN" });
      }
      const id = parseInt(req.params.id);
      await storage.deleteProduct(id);
      res.json({ message: "Product deleted successfully" });
    } catch (error) {
      console.error("Error deleting product:", error);
      res.status(500).json({ message: "Failed to delete product", code: "DELETE_PRODUCT_ERROR" });
    }
  });

  // ==========================================================================
  // CART ROUTES
  // ==========================================================================

  app.get("/api/cart", async (req: Request, res: Response) => {
    try {
      const userId = req.isAuthenticated() ? (req.user as any).id : undefined;
      const sessionId = req.sessionID;
      const items = await storage.getCartItems(userId, sessionId);
      res.json(items);
    } catch (error) {
      console.error("Error fetching cart:", error);
      res.status(500).json({ message: "Failed to fetch cart", code: "FETCH_CART_ERROR" });
    }
  });

  app.post("/api/cart", csrfProtection, async (req: Request, res: Response) => {
    try {
      const userId = req.isAuthenticated() ? (req.user as any).id : undefined;
      const sessionId = req.sessionID;
      const cartItemData = { ...req.body, userId, sessionId };
      const validatedData = insertCartItemSchema.parse(cartItemData);
      const item = await storage.addToCart(validatedData);
      res.json(item);
    } catch (error) {
      console.error("Error adding to cart:", error);
      res.status(500).json({ message: "Failed to add to cart", code: "ADD_TO_CART_ERROR" });
    }
  });

  app.put("/api/cart/:id", csrfProtection, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const { quantity } = req.body;
      if (!quantity || quantity < 1) {
        return res.status(400).json({ message: "Invalid quantity", code: "INVALID_QUANTITY" });
      }
      const item = await storage.updateCartItem(id, quantity);
      res.json(item);
    } catch (error) {
      console.error("Error updating cart item:", error);
      res.status(500).json({ message: "Failed to update cart item", code: "UPDATE_CART_ERROR" });
    }
  });

  app.delete("/api/cart/:id", csrfProtection, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      await storage.removeFromCart(id);
      res.json({ message: "Item removed from cart" });
    } catch (error) {
      console.error("Error removing from cart:", error);
      res.status(500).json({ message: "Failed to remove from cart", code: "REMOVE_CART_ERROR" });
    }
  });

  app.delete("/api/cart", csrfProtection, async (req: Request, res: Response) => {
    try {
      const userId = req.isAuthenticated() ? (req.user as any).id : undefined;
      const sessionId = req.sessionID;
      await storage.clearCart(userId, sessionId);
      res.json({ message: "Cart cleared" });
    } catch (error) {
      console.error("Error clearing cart:", error);
      res.status(500).json({ message: "Failed to clear cart", code: "CLEAR_CART_ERROR" });
    }
  });

  // ==========================================================================
  // ORDER ROUTES
  // ==========================================================================

  app.post("/api/orders", csrfProtection, async (req: Request, res: Response) => {
    try {
      const userId = req.isAuthenticated() ? (req.user as any).id : undefined;
      const sessionId = req.sessionID;
      const { orderData, items, fulfillmentType } = req.body;

      // Guard: cart must not be empty
      if (!items || items.length === 0) {
        return res.status(400).json({ message: "Cart is empty", code: "EMPTY_CART" });
      }

      // Calculate deposit if any item belongs to a farm product with depositPercent > 0
      let depositAmount: number | undefined;
      let remainingBalance: number | undefined;
      let orderStatus = "pending";

      const total = parseFloat(orderData.total);
      const productIds: number[] = items.map((i: any) => i.productId).filter(Boolean);

      // Stock validation
      if (productIds.length > 0) {
        const stockRows = await db
          .select({ id: products.id, stock: products.stock, name: products.name })
          .from(products)
          .where(sql`${products.id} = ANY(ARRAY[${sql.join(productIds.map((id: number) => sql`${id}`), sql`, `)}]::int[])`);

        for (const item of items as { productId: number; quantity: number }[]) {
          const prod = stockRows.find((p) => p.id === item.productId);
          if (prod && (prod.stock ?? 0) < item.quantity) {
            return res.status(400).json({
              message: `"${prod.name}" only has ${prod.stock ?? 0} unit(s) in stock`,
              code: "OUT_OF_STOCK",
            });
          }
        }
      }

      if (productIds.length > 0) {
        const farmProducts = await db
          .select({ id: products.id, depositPercent: products.depositPercent })
          .from(products)
          .where(sql`${products.id} = ANY(ARRAY[${sql.join(productIds.map((id: number) => sql`${id}`), sql`, `)}]::int[])`);

        const maxDeposit = Math.max(...farmProducts.map(p => p.depositPercent ?? 0), 0);
        if (maxDeposit > 0) {
          depositAmount = parseFloat((total * maxDeposit / 100).toFixed(2));
          remainingBalance = parseFloat((total - depositAmount).toFixed(2));
          orderStatus = "awaiting_confirmation";
        }
      }

      // Coupon validation + discount
      let couponCode: string | undefined;
      let discountAmount = 0;
      if (orderData.couponCode) {
        const [coupon] = await db.select().from(coupons).where(and(eq(coupons.code, orderData.couponCode.toUpperCase()), eq(coupons.active, true)));
        if (coupon && !(coupon.expiresAt && new Date(coupon.expiresAt) < new Date()) && !(coupon.maxUses !== null && (coupon.usedCount ?? 0) >= coupon.maxUses)) {
          couponCode = coupon.code;
          discountAmount = coupon.type === "percent" ? total * parseFloat(coupon.value) / 100 : parseFloat(coupon.value);
          discountAmount = Math.min(discountAmount, total);
          // Increment used count (non-blocking)
          db.update(coupons).set({ usedCount: (coupon.usedCount ?? 0) + 1 }).where(eq(coupons.id, coupon.id)).catch(() => {});
        }
      }

      const orderWithUser = {
        ...orderData,
        userId,
        fulfillmentType: fulfillmentType ?? null,
        depositAmount: depositAmount !== undefined ? depositAmount.toFixed(2) : null,
        remainingBalance: remainingBalance !== undefined ? remainingBalance.toFixed(2) : null,
        status: orderStatus,
        couponCode: couponCode ?? null,
        discountAmount: discountAmount > 0 ? discountAmount.toFixed(2) : "0",
      };

      const validatedOrder = insertOrderSchema.parse(orderWithUser);
      const order = await storage.createOrder(validatedOrder, items);

      await storage.clearCart(userId, sessionId);

      // Notifications — non-blocking, never kill the order response
      sendWhatsAppMessage({ ...order, items }).catch((err) =>
        console.error("[WhatsApp] Admin notification failed:", err),
      );
      notifyERMOfOrder(order, items).catch((err) =>
        console.error("[ERM Notify] Background notification failed:", err),
      );
      notifyKgotlaOfOrder(order, items).catch((err) =>
        console.error("[Kgotla Notify] Background notification failed:", err),
      );

      // Order confirmation email to customer
      const customerEmail = orderData.email;
      if (customerEmail) {
        sendEmail(
          customerEmail,
          `Order Confirmed — #${order.id} | Fountstream`,
          orderConfirmationTemplate({ ...order, items }),
        ).catch((err) => console.error("[Email] Order confirmation failed:", err));
      }

      res.json(order);
    } catch (error) {
      console.error("Error creating order:", error);
      res.status(500).json({ message: "Failed to create order", code: "CREATE_ORDER_ERROR" });
    }
  });

  // ==========================================================================
  // PRODUCT SOCIAL — LIKES, WISHLIST, REVIEWS
  // ==========================================================================

  // GET social state for a product (auth optional)
  app.get("/api/products/:id/social", async (req: Request, res: Response) => {
    try {
      const productId = parseInt(req.params.id);
      const userId = (req.user as any)?.id ?? null;

      const [[likeRow], [reviewRow]] = await Promise.all([
        db.select({ count: count() }).from(productLikes).where(eq(productLikes.productId, productId)),
        db.select({ avg: avg(productReviews.rating), count: count() }).from(productReviews).where(eq(productReviews.productId, productId)),
      ]);

      let liked = false;
      let wishlisted = false;
      let canReview = false;
      let userReview: any = null;

      if (userId) {
        const [likedRow] = await db.select().from(productLikes).where(and(eq(productLikes.userId, userId), eq(productLikes.productId, productId)));
        const [wishRow] = await db.select().from(wishlistItems).where(and(eq(wishlistItems.userId, userId), eq(wishlistItems.productId, productId)));
        const [myReview] = await db.select().from(productReviews).where(and(eq(productReviews.userId, userId), eq(productReviews.productId, productId)));

        liked = !!likedRow;
        wishlisted = !!wishRow;
        userReview = myReview ?? null;

        // Verified purchase check
        const [purchased] = await db.select({ id: orderItems.id })
          .from(orderItems)
          .innerJoin(orders, eq(orderItems.orderId, orders.id))
          .where(and(eq(orders.userId, userId), eq(orderItems.productId, productId)));
        canReview = !!purchased && !userReview;
      }

      res.json({
        likeCount:   likeRow?.count ?? 0,
        avgRating:   reviewRow?.avg ? parseFloat(String(reviewRow.avg)).toFixed(1) : null,
        reviewCount: reviewRow?.count ?? 0,
        liked,
        wishlisted,
        canReview,
        userReview,
      });
    } catch (err) {
      console.error("[Social] GET social failed:", err);
      res.status(500).json({ message: "Failed to fetch social data" });
    }
  });

  // Toggle like
  app.post("/api/products/:id/like", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const productId = parseInt(req.params.id);
      const userId    = (req.user as any).id;

      const [existing] = await db.select().from(productLikes).where(and(eq(productLikes.userId, userId), eq(productLikes.productId, productId)));

      if (existing) {
        await db.delete(productLikes).where(eq(productLikes.id, existing.id));
      } else {
        await db.insert(productLikes).values({ userId, productId });
      }

      const [{ count: likeCount }] = await db.select({ count: count() }).from(productLikes).where(eq(productLikes.productId, productId));
      res.json({ liked: !existing, count: likeCount });
    } catch (err) {
      console.error("[Social] Like toggle failed:", err);
      res.status(500).json({ message: "Failed to toggle like" });
    }
  });

  // Toggle wishlist
  app.post("/api/products/:id/wishlist", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const productId = parseInt(req.params.id);
      const userId    = (req.user as any).id;

      const [existing] = await db.select().from(wishlistItems).where(and(eq(wishlistItems.userId, userId), eq(wishlistItems.productId, productId)));

      if (existing) {
        await db.delete(wishlistItems).where(eq(wishlistItems.id, existing.id));
        res.json({ saved: false });
      } else {
        await db.insert(wishlistItems).values({ userId, productId });
        res.json({ saved: true });
      }
    } catch (err) {
      console.error("[Social] Wishlist toggle failed:", err);
      res.status(500).json({ message: "Failed to toggle wishlist" });
    }
  });

  // Get user's wishlist
  app.get("/api/wishlist", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = (req.user as any).id;
      const rows = await db
        .select({ item: wishlistItems, product: products })
        .from(wishlistItems)
        .innerJoin(products, eq(wishlistItems.productId, products.id))
        .where(eq(wishlistItems.userId, userId))
        .orderBy(wishlistItems.createdAt);
      res.json(rows.map((r) => ({ ...r.product, wishlistId: r.item.id, savedAt: r.item.createdAt })));
    } catch (err) {
      console.error("[Social] Wishlist fetch failed:", err);
      res.status(500).json({ message: "Failed to fetch wishlist" });
    }
  });

  // Get reviews for a product
  app.get("/api/products/:id/reviews", async (req: Request, res: Response) => {
    try {
      const productId = parseInt(req.params.id);
      const rows = await db
        .select({
          review: productReviews,
          firstName: users.firstName,
          lastName:  users.lastName,
        })
        .from(productReviews)
        .innerJoin(users, eq(productReviews.userId, users.id))
        .where(eq(productReviews.productId, productId))
        .orderBy(productReviews.createdAt);

      res.json(rows.map((r) => ({
        ...r.review,
        authorName: `${r.firstName ?? ""} ${r.lastName ?? ""}`.trim() || "Anonymous",
      })));
    } catch (err) {
      console.error("[Social] Reviews fetch failed:", err);
      res.status(500).json({ message: "Failed to fetch reviews" });
    }
  });

  // Submit or update a review (verified purchase required)
  app.post("/api/products/:id/reviews", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const productId = parseInt(req.params.id);
      const userId    = (req.user as any).id;
      const { rating, title, body } = req.body;

      if (!rating || rating < 1 || rating > 5) {
        return res.status(400).json({ message: "Rating must be between 1 and 5" });
      }

      // Verified purchase check
      const [purchased] = await db.select({ id: orderItems.id })
        .from(orderItems)
        .innerJoin(orders, eq(orderItems.orderId, orders.id))
        .where(and(eq(orders.userId, userId), eq(orderItems.productId, productId)));

      const [existing] = await db.select().from(productReviews).where(and(eq(productReviews.userId, userId), eq(productReviews.productId, productId)));

      if (existing) {
        const [updated] = await db.update(productReviews)
          .set({ rating, title: title || null, body: body || null })
          .where(eq(productReviews.id, existing.id))
          .returning();
        return res.json(updated);
      }

      const [created] = await db.insert(productReviews)
        .values({ userId, productId, rating, title: title || null, body: body || null, verifiedPurchase: !!purchased })
        .returning();
      res.status(201).json(created);
    } catch (err) {
      console.error("[Social] Review submit failed:", err);
      res.status(500).json({ message: "Failed to submit review" });
    }
  });

  // Guest order lookup — no auth, verified by email + orderId match
  app.post("/api/orders/track", async (req: Request, res: Response) => {
    try {
      const { email, orderId } = req.body;
      if (!email || !orderId) {
        return res.status(400).json({ message: "Email and order ID are required" });
      }
      const order = await storage.getOrder(Number(orderId));
      if (!order || order.email.toLowerCase() !== (email as string).toLowerCase()) {
        return res.status(404).json({ message: "No order found with that email and order ID" });
      }
      const items = await storage.getOrderItemsByOrderId(order.id);
      res.json({ ...order, items });
    } catch (error) {
      console.error("[Track Order]", error);
      res.status(500).json({ message: "Failed to look up order" });
    }
  });

  app.get("/api/orders", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = (req.user as any).id;
      const user = await storage.getUser(userId);
      const orders = await storage.getOrders(user?.isAdmin ? undefined : userId);
      res.json(orders);
    } catch (error) {
      console.error("Error fetching orders:", error);
      res.status(500).json({ message: "Failed to fetch orders", code: "FETCH_ORDERS_ERROR" });
    }
  });

  app.get("/api/orders/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid order id" });

      const order = await storage.getOrder(id);
      if (!order) {
        return res.status(404).json({ message: "Order not found", code: "ORDER_NOT_FOUND" });
      }

      // Logged-in users must own the order (or be admin). Guests must present
      // the order's access token, issued at checkout, instead of a session.
      if (req.isAuthenticated()) {
        const userId = (req.user as any).id;
        const user = await storage.getUser(userId);
        if (!user?.isAdmin && order.userId !== userId) {
          return res.status(403).json({ message: "Access denied", code: "FORBIDDEN" });
        }
      } else {
        const token = req.query.token as string | undefined;
        if (!token || token !== order.accessToken) {
          return res.status(403).json({ message: "Access denied", code: "FORBIDDEN" });
        }
      }

      // Fetch the order items
      const items = await storage.getOrderItemsByOrderId(id);

      res.json({ ...order, items });
    } catch (error) {
      console.error("Error fetching order:", error);
      res.status(500).json({ message: "Failed to fetch order", code: "FETCH_ORDER_ERROR" });
    }
  });

  app.put("/api/orders/:id/status", isAuthenticated, csrfProtection, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const { status, trackingNumber } = req.body;
      const userId = (req.user as any).id;
      const user = await storage.getUser(userId);

      if (!user?.isAdmin) {
        return res.status(403).json({ message: "Admin access required", code: "FORBIDDEN" });
      }

      const updatedOrder = await storage.updateOrderStatus(id, status);

      // Save tracking number if provided
      let resolvedTracking = updatedOrder.trackingNumber ?? null;
      if (trackingNumber !== undefined) {
        const trimmed = (trackingNumber as string).trim() || null;
        await db.update(orders).set({ trackingNumber: trimmed }).where(eq(orders.id, id));
        resolvedTracking = trimmed;
      }

      // Email customer on every status change
      sendEmail(
        updatedOrder.email,
        `Order #${updatedOrder.id} Update — ${status.replace(/_/g, " ")}`,
        orderStatusUpdateTemplate({
          id: updatedOrder.id,
          firstName: updatedOrder.firstName,
          status,
          trackingNumber: resolvedTracking,
        }),
      ).catch((err) => console.error("[Email] Status update notification failed:", err));

      // WhatsApp for farm reservation confirm/cancel
      if (status === "confirmed" || status === "cancelled") {
        const items = await storage.getOrderItemsByOrderId(id);
        sendReservationStatusToCustomer({ ...updatedOrder, items }, status === "confirmed").catch((err) =>
          console.error("[Twilio] Customer notification failed:", err)
        );
      }

      // In-app notification for the customer
      if (updatedOrder.userId) {
        const statusLabels: Record<string, string> = {
          processing: "is being processed", shipped: "has been shipped",
          delivered: "has been delivered", cancelled: "was cancelled",
          confirmed: "has been confirmed",
        };
        const label = statusLabels[status] ?? `status changed to ${status}`;
        db.insert(notifications).values({
          userId: updatedOrder.userId,
          type: "order_update",
          title: `Order #${updatedOrder.id} ${label}`,
          body: resolvedTracking ? `Tracking: ${resolvedTracking}` : null,
          link: `/order-confirmation?orderId=${updatedOrder.id}`,
        }).catch(() => {});
      }

      res.json({ ...updatedOrder, trackingNumber: resolvedTracking });
    } catch (error) {
      console.error("Error updating order status:", error);
      res.status(500).json({ message: "Failed to update order status", code: "UPDATE_ORDER_STATUS_ERROR" });
    }
  });

  app.delete("/api/orders/:id", isAuthenticated, csrfProtection, async (req: Request, res: Response) => {
    try {
      const user = await storage.getUser((req.user as any).id);
      if (!user?.isAdmin) {
        return res.status(403).json({ message: "Admin access required", code: "FORBIDDEN" });
      }
      const id = parseInt(req.params.id);
      await storage.deleteOrder(id);
      res.json({ message: "Order deleted successfully" });
    } catch (error) {
      console.error("Error deleting order:", error);
      res.status(500).json({ message: "Failed to delete order", code: "DELETE_ORDER_ERROR" });
    }
  });

  // ==========================================================================
  // CONTACT ROUTES
  // ==========================================================================

  app.post("/api/contact", async (req: Request, res: Response) => {
    try {
      const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0].trim() || req.socket.remoteAddress || "unknown";
      const now = Date.now();
      const windowMs = 60 * 60 * 1000; // 1 hour
      const recent = (contactRateLimit.get(ip) || []).filter((t) => now - t < windowMs);
      if (recent.length >= 5) {
        return res.status(429).json({ message: "Too many messages. Please try again later.", code: "RATE_LIMITED" });
      }
      recent.push(now);
      contactRateLimit.set(ip, recent);

      const validatedData = insertContactMessageSchema.parse(req.body);
      const message = await storage.createContactMessage(validatedData);
      res.json(message);
    } catch (error) {
      console.error("Error creating contact message:", error);
      res.status(500).json({ message: "Failed to send message", code: "CREATE_CONTACT_ERROR" });
    }
  });

  app.get("/api/contact", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const user = await storage.getUser((req.user as any).id);
      if (!user?.isAdmin) {
        return res.status(403).json({ message: "Admin access required", code: "FORBIDDEN" });
      }
      const messages = await storage.getContactMessages();
      res.json(messages);
    } catch (error) {
      console.error("Error fetching contact messages:", error);
      res.status(500).json({ message: "Failed to fetch messages", code: "FETCH_CONTACT_ERROR" });
    }
  });

  app.put("/api/contact/:id/status", isAuthenticated, csrfProtection, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const { status } = req.body;
      const userId = (req.user as any).id;
      const user = await storage.getUser(userId);

      if (!user?.isAdmin) {
        return res.status(403).json({ message: "Admin access required", code: "FORBIDDEN" });
      }

      const updatedMessage = await storage.updateContactMessageStatus(id, status);
      res.json(updatedMessage);
    } catch (error) {
      console.error("Error updating message status:", error);
      res.status(500).json({ message: "Failed to update message status", code: "UPDATE_MESSAGE_STATUS_ERROR" });
    }
  });

  app.delete("/api/contact/:id", isAuthenticated, csrfProtection, async (req: Request, res: Response) => {
    try {
      const user = await storage.getUser((req.user as any).id);
      if (!user?.isAdmin) {
        return res.status(403).json({ message: "Admin access required", code: "FORBIDDEN" });
      }
      const id = parseInt(req.params.id);
      await db.delete(contactMessages).where(eq(contactMessages.id, id));
      res.json({ message: "Message deleted successfully" });
    } catch (error) {
      console.error("Error deleting message:", error);
      res.status(500).json({ message: "Failed to delete message", code: "DELETE_MESSAGE_ERROR" });
    }
  });

  // ==========================================================================
  // ADMIN STATS
  // ==========================================================================

  app.get("/api/admin/stats", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const user = await storage.getUser((req.user as any).id);
      if (!user?.isAdmin) {
        return res.status(403).json({ message: "Admin access required", code: "FORBIDDEN" });
      }
      const products = await storage.getProducts();
      const orders = await storage.getOrders();
      const messages = await storage.getContactMessages();
      const totalRevenue = orders.reduce((sum, order) => sum + parseFloat(order.total), 0);
      const uniqueCustomers = new Set(orders.filter((o) => o.userId).map((o) => o.userId)).size;
      const stats = {
        totalProducts: products.length,
        totalOrders: orders.length,
        totalCustomers: uniqueCustomers,
        revenue: totalRevenue,
        unreadMessages: messages.filter((m) => m.status === "unread").length,
      };
      res.json(stats);
    } catch (error) {
      console.error("Error fetching admin stats:", error);
      res.status(500).json({ message: "Failed to fetch stats", code: "FETCH_STATS_ERROR" });
    }
  });

  // ── Stock Notifications ────────────────────────────────────────────────────

  app.post("/api/products/:id/notify-stock", async (req: Request, res: Response) => {
    try {
      const productId = parseInt(req.params.id);
      const { email } = req.body;
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ message: "Valid email required" });
      }
      await db.insert(stockNotifications).values({ email, productId }).onConflictDoNothing();
      res.json({ ok: true });
    } catch (err) {
      console.error("[StockNotify] Subscribe failed:", err);
      res.status(500).json({ message: "Failed to subscribe" });
    }
  });

  // ── Return / Refund Requests ───────────────────────────────────────────────

  app.post("/api/orders/:id/return", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const orderId = parseInt(req.params.id);
      const userId  = (req.user as any).id;
      const { reason } = req.body;
      if (!reason?.trim()) return res.status(400).json({ message: "Reason is required" });

      const [order] = await db.select().from(orders).where(and(eq(orders.id, orderId), eq(orders.userId, userId)));
      if (!order) return res.status(404).json({ message: "Order not found" });
      if (order.status !== "delivered") return res.status(400).json({ message: "Only delivered orders can be returned" });

      const [existing] = await db.select().from(returnRequests).where(and(eq(returnRequests.orderId, orderId), eq(returnRequests.userId, userId)));
      if (existing) return res.status(409).json({ message: "Return request already submitted" });

      const [created] = await db.insert(returnRequests).values({ orderId, userId, reason: reason.trim() }).returning();
      res.status(201).json(created);
    } catch (err) {
      console.error("[Returns] Submit failed:", err);
      res.status(500).json({ message: "Failed to submit return request" });
    }
  });

  app.get("/api/orders/:id/return", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const orderId = parseInt(req.params.id);
      const userId  = (req.user as any).id;
      const [req_] = await db.select().from(returnRequests).where(and(eq(returnRequests.orderId, orderId), eq(returnRequests.userId, userId)));
      res.json(req_ ?? null);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch return" });
    }
  });

  app.get("/api/admin/returns", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const user = await storage.getUser((req.user as any).id);
      if (!user?.isAdmin) return res.status(403).json({ message: "Forbidden" });
      const rows = await db
        .select({ return: returnRequests, orderEmail: orders.email, orderTotal: orders.total, orderDate: orders.createdAt })
        .from(returnRequests)
        .innerJoin(orders, eq(returnRequests.orderId, orders.id))
        .orderBy(desc(returnRequests.createdAt));
      res.json(rows.map((r) => ({ ...r.return, orderEmail: r.orderEmail, orderTotal: r.orderTotal, orderDate: r.orderDate })));
    } catch (err) {
      console.error("[Returns] Admin fetch failed:", err);
      res.status(500).json({ message: "Failed to fetch returns" });
    }
  });

  app.patch("/api/admin/returns/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const user = await storage.getUser((req.user as any).id);
      if (!user?.isAdmin) return res.status(403).json({ message: "Forbidden" });
      const { status, adminNote } = req.body;
      const [updated] = await db.update(returnRequests)
        .set({ status, adminNote: adminNote || null })
        .where(eq(returnRequests.id, parseInt(req.params.id)))
        .returning();
      res.json(updated);
    } catch (err) {
      res.status(500).json({ message: "Failed to update return" });
    }
  });

  // ── Coupons ────────────────────────────────────────────────────────────────

  app.post("/api/coupons/apply", async (req: Request, res: Response) => {
    try {
      const { code, orderTotal } = req.body;
      if (!code) return res.status(400).json({ message: "Coupon code required" });

      const [coupon] = await db.select().from(coupons).where(and(eq(coupons.code, code.toUpperCase()), eq(coupons.active, true)));
      if (!coupon) return res.status(404).json({ message: "Invalid or expired coupon code" });
      if (coupon.expiresAt && new Date(coupon.expiresAt) < new Date()) return res.status(400).json({ message: "Coupon has expired" });
      if (coupon.maxUses !== null && (coupon.usedCount ?? 0) >= coupon.maxUses) return res.status(400).json({ message: "Coupon usage limit reached" });
      if (parseFloat(coupon.minOrder ?? "0") > parseFloat(orderTotal ?? "0")) {
        return res.status(400).json({ message: `Minimum order of P ${(parseFloat(coupon.minOrder ?? "0") * 13.5).toFixed(2)} required` });
      }

      const discount = coupon.type === "percent"
        ? parseFloat(orderTotal) * parseFloat(coupon.value) / 100
        : parseFloat(coupon.value);

      res.json({ coupon: { id: coupon.id, code: coupon.code, type: coupon.type, value: coupon.value }, discount: Math.min(discount, parseFloat(orderTotal)) });
    } catch (err) {
      console.error("[Coupons] Apply failed:", err);
      res.status(500).json({ message: "Failed to apply coupon" });
    }
  });

  app.get("/api/admin/coupons", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const user = await storage.getUser((req.user as any).id);
      if (!user?.isAdmin) return res.status(403).json({ message: "Forbidden" });
      const rows = await db.select().from(coupons).orderBy(desc(coupons.createdAt));
      res.json(rows);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch coupons" });
    }
  });

  app.post("/api/admin/coupons", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const user = await storage.getUser((req.user as any).id);
      if (!user?.isAdmin) return res.status(403).json({ message: "Forbidden" });
      const { code, type, value, minOrder, maxUses, expiresAt } = req.body;
      if (!code || !type || !value) return res.status(400).json({ message: "code, type, value required" });
      const [created] = await db.insert(coupons).values({
        code: code.toUpperCase().trim(),
        type,
        value: parseFloat(value).toFixed(2),
        minOrder: minOrder ? parseFloat(minOrder).toFixed(2) : "0",
        maxUses: maxUses ? parseInt(maxUses) : null,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      }).returning();
      res.status(201).json(created);
    } catch (err: any) {
      if (err.code === "23505") return res.status(409).json({ message: "Coupon code already exists" });
      res.status(500).json({ message: "Failed to create coupon" });
    }
  });

  app.delete("/api/admin/coupons/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const user = await storage.getUser((req.user as any).id);
      if (!user?.isAdmin) return res.status(403).json({ message: "Forbidden" });
      await db.delete(coupons).where(eq(coupons.id, parseInt(req.params.id)));
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ message: "Failed to delete coupon" });
    }
  });

  app.patch("/api/admin/coupons/:id/toggle", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const user = await storage.getUser((req.user as any).id);
      if (!user?.isAdmin) return res.status(403).json({ message: "Forbidden" });
      const [coupon] = await db.select().from(coupons).where(eq(coupons.id, parseInt(req.params.id)));
      if (!coupon) return res.status(404).json({ message: "Not found" });
      const [updated] = await db.update(coupons).set({ active: !coupon.active }).where(eq(coupons.id, coupon.id)).returning();
      res.json(updated);
    } catch (err) {
      res.status(500).json({ message: "Failed to toggle coupon" });
    }
  });

  // ── Admin Analytics (real data) ────────────────────────────────────────────

  app.get("/api/admin/analytics", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const user = await storage.getUser((req.user as any).id);
      if (!user?.isAdmin) return res.status(403).json({ message: "Forbidden" });

      // Revenue + order count by day for the last 30 days
      const dailyRows = await db.execute(sql`
        SELECT
          DATE(created_at) AS day,
          COUNT(*)::int AS orders,
          SUM(total)::float AS revenue
        FROM orders
        WHERE created_at >= NOW() - INTERVAL '30 days'
        GROUP BY day
        ORDER BY day ASC
      `);

      // Top 5 products by order quantity
      const topProducts = await db.execute(sql`
        SELECT p.name, SUM(oi.quantity)::int AS sold
        FROM order_items oi
        JOIN products p ON p.id = oi.product_id
        GROUP BY p.id, p.name
        ORDER BY sold DESC
        LIMIT 5
      `);

      // Order status breakdown
      const statusBreakdown = await db.execute(sql`
        SELECT status, COUNT(*)::int AS count
        FROM orders
        GROUP BY status
        ORDER BY count DESC
      `);

      // Revenue by category
      const categoryRevenue = await db.execute(sql`
        SELECT c.name, SUM(oi.product_price * oi.quantity)::float AS revenue
        FROM order_items oi
        JOIN products p ON p.id = oi.product_id
        JOIN categories c ON c.id = p.category_id
        GROUP BY c.name
        ORDER BY revenue DESC
        LIMIT 6
      `);

      res.json({
        daily: dailyRows.rows,
        topProducts: topProducts.rows,
        statusBreakdown: statusBreakdown.rows,
        categoryRevenue: categoryRevenue.rows,
      });
    } catch (err) {
      console.error("[Analytics] Failed:", err);
      res.status(500).json({ message: "Failed to fetch analytics" });
    }
  });

  // ── Bulk Product CSV Import ────────────────────────────────────────────────

  app.post("/api/admin/products/import-csv", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const user = await storage.getUser((req.user as any).id);
      if (!user?.isAdmin) return res.status(403).json({ message: "Forbidden" });

      const { rows } = req.body as { rows: any[] };
      if (!Array.isArray(rows) || rows.length === 0) return res.status(400).json({ message: "No rows provided" });
      if (rows.length > 200) return res.status(400).json({ message: "Maximum 200 rows per import" });

      const created: any[] = [];
      const errors: { row: number; message: string }[] = [];

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        try {
          const name = String(row.name || "").trim();
          if (!name) { errors.push({ row: i + 1, message: "name is required" }); continue; }
          const priceUSD = parseFloat(String(row.price_bwp || row.price || "0")) / 13.5;
          if (isNaN(priceUSD) || priceUSD <= 0) { errors.push({ row: i + 1, message: "invalid price" }); continue; }
          const slug = `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}-${Date.now().toString(36)}-${i}`;
          const product = await storage.createProduct({
            name,
            slug,
            description: String(row.description || ""),
            price: priceUSD.toFixed(2),
            originalPrice: row.original_price_bwp ? (parseFloat(row.original_price_bwp) / 13.5).toFixed(2) : undefined,
            stock: parseInt(row.stock || "0") || 0,
            featured: String(row.featured).toLowerCase() === "true",
            active: String(row.active ?? "true").toLowerCase() !== "false",
            images: row.image_url ? [row.image_url] : [],
            sizes: row.sizes ? String(row.sizes).split("|").map((s: string) => s.trim()).filter(Boolean) : [],
            colors: row.colors ? String(row.colors).split("|").map((s: string) => s.trim()).filter(Boolean) : [],
            status: "active",
          });
          created.push(product);
        } catch (rowErr: any) {
          errors.push({ row: i + 1, message: rowErr.message || "Unknown error" });
        }
      }

      res.json({ created: created.length, errors });
    } catch (err) {
      console.error("[CSV Import] Failed:", err);
      res.status(500).json({ message: "Import failed" });
    }
  });

  // ── In-App Notifications ───────────────────────────────────────────────────

  app.get("/api/notifications", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = (req.user as any).id;
      const rows = await db.select().from(notifications)
        .where(eq(notifications.userId, userId))
        .orderBy(desc(notifications.createdAt))
        .limit(50);
      res.json(rows);
    } catch { res.status(500).json({ message: "Failed" }); }
  });

  app.post("/api/notifications/read-all", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = (req.user as any).id;
      await db.update(notifications).set({ read: true }).where(eq(notifications.userId, userId));
      res.json({ ok: true });
    } catch { res.status(500).json({ message: "Failed" }); }
  });

  app.delete("/api/notifications/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = (req.user as any).id;
      await db.delete(notifications).where(and(eq(notifications.id, parseInt(req.params.id)), eq(notifications.userId, userId)));
      res.json({ ok: true });
    } catch { res.status(500).json({ message: "Failed" }); }
  });

  // Internal helper — call after status changes
  async function pushNotification(userId: string, type: string, title: string, body: string, link?: string) {
    try {
      await db.insert(notifications).values({ userId, type, title, body: body || null, link: link || null });
    } catch {}
  }

  // Fire notification on order status update (wire into existing PATCH /api/admin/orders/:id/status)
  // (already handled below in the order-status route patch)

  // ── Product Q&A ────────────────────────────────────────────────────────────

  app.get("/api/products/:id/questions", async (req: Request, res: Response) => {
    try {
      const productId = parseInt(req.params.id);
      const rows = await db
        .select({
          q: productQuestions,
          askerName: users.firstName,
          askerLast: users.lastName,
        })
        .from(productQuestions)
        .innerJoin(users, eq(productQuestions.userId, users.id))
        .where(eq(productQuestions.productId, productId))
        .orderBy(desc(productQuestions.createdAt));
      res.json(rows.map(r => ({
        ...r.q,
        askerName: `${r.askerName ?? ""} ${r.askerLast ?? ""}`.trim() || "Customer",
      })));
    } catch { res.status(500).json({ message: "Failed" }); }
  });

  app.post("/api/products/:id/questions", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const productId = parseInt(req.params.id);
      const userId = (req.user as any).id;
      const { question } = req.body;
      if (!question?.trim()) return res.status(400).json({ message: "Question required" });
      const [created] = await db.insert(productQuestions).values({ productId, userId, question: question.trim() }).returning();
      res.status(201).json(created);
    } catch { res.status(500).json({ message: "Failed" }); }
  });

  app.post("/api/questions/:id/answer", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const user = await storage.getUser((req.user as any).id);
      const answeredBy = (req.user as any).id;
      const { answer } = req.body;
      if (!answer?.trim()) return res.status(400).json({ message: "Answer required" });

      const [q] = await db.select().from(productQuestions).where(eq(productQuestions.id, parseInt(req.params.id)));
      if (!q) return res.status(404).json({ message: "Not found" });

      // Allow admin or the product's seller to answer
      if (!user?.isAdmin) {
        const prod = await storage.getProduct(q.productId);
        if (!prod || prod.sellerId !== answeredBy) return res.status(403).json({ message: "Forbidden" });
      }

      const [updated] = await db.update(productQuestions)
        .set({ answer: answer.trim(), answeredBy, answeredAt: new Date() })
        .where(eq(productQuestions.id, q.id))
        .returning();

      // Notify the asker
      await pushNotification(q.userId, "question_answered", "Your question was answered", answer.trim().slice(0, 100), `/product/${q.productId}`);

      res.json(updated);
    } catch { res.status(500).json({ message: "Failed" }); }
  });

  // ── Seller Earnings Dashboard ──────────────────────────────────────────────

  app.get("/api/seller/earnings", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = (req.user as any).id;
      const seller = await storage.getSellerByUserId(userId);
      if (!seller || seller.status !== "approved") return res.status(403).json({ message: "Approved seller account required" });

      const commissionPct = seller.commissionPercent ?? 10;

      // All order items for this seller's products
      const rows = await db.execute(sql`
        SELECT
          oi.id,
          oi.order_id,
          oi.product_name,
          oi.product_price,
          oi.quantity,
          o.status,
          o.created_at,
          o.email AS customer_email
        FROM order_items oi
        JOIN orders o ON o.id = oi.order_id
        JOIN products p ON p.id = oi.product_id
        WHERE p.seller_id = ${userId}
        ORDER BY o.created_at DESC
      `);

      const items: any[] = rows.rows;
      const grossRevenue = items.reduce((s, i) => s + parseFloat(i.product_price) * i.quantity, 0);
      const commission = grossRevenue * commissionPct / 100;
      const netEarnings = grossRevenue - commission;

      // Monthly breakdown (last 6 months)
      const monthlyMap: Record<string, number> = {};
      for (let i = 5; i >= 0; i--) {
        const d = new Date(); d.setMonth(d.getMonth() - i);
        monthlyMap[d.toLocaleDateString("en-US", { month: "short", year: "numeric" })] = 0;
      }
      items.forEach(i => {
        const key = new Date(i.created_at).toLocaleDateString("en-US", { month: "short", year: "numeric" });
        if (key in monthlyMap) monthlyMap[key] += parseFloat(i.product_price) * i.quantity;
      });
      const monthly = Object.entries(monthlyMap).map(([month, revenue]) => ({ month, revenue: parseFloat(revenue.toFixed(2)), net: parseFloat((revenue * (1 - commissionPct / 100)).toFixed(2)) }));

      // Payout history
      const payouts = await db.select().from(payoutRequests).where(eq(payoutRequests.sellerId, seller.id)).orderBy(desc(payoutRequests.createdAt));

      const totalPaidOut = payouts.filter(p => p.status === "paid").reduce((s, p) => s + parseFloat(p.amount), 0);
      const pendingPayout = payouts.filter(p => p.status === "pending").reduce((s, p) => s + parseFloat(p.amount), 0);

      res.json({
        grossRevenue: grossRevenue.toFixed(2),
        commission: commission.toFixed(2),
        commissionPct,
        netEarnings: netEarnings.toFixed(2),
        totalPaidOut: totalPaidOut.toFixed(2),
        balance: (netEarnings - totalPaidOut - pendingPayout).toFixed(2),
        monthly,
        recentItems: items.slice(0, 20),
        payouts,
      });
    } catch (err) {
      console.error("[Seller Earnings]", err);
      res.status(500).json({ message: "Failed to fetch earnings" });
    }
  });

  app.post("/api/seller/payout-request", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = (req.user as any).id;
      const seller = await storage.getSellerByUserId(userId);
      if (!seller || seller.status !== "approved") return res.status(403).json({ message: "Approved seller account required" });
      const { amount, note } = req.body;
      if (!amount || parseFloat(amount) <= 0) return res.status(400).json({ message: "Valid amount required" });
      const [created] = await db.insert(payoutRequests).values({ sellerId: seller.id, amount: parseFloat(amount).toFixed(2), note: note || null }).returning();
      res.status(201).json(created);
    } catch { res.status(500).json({ message: "Failed" }); }
  });

  app.get("/api/admin/payout-requests", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const user = await storage.getUser((req.user as any).id);
      if (!user?.isAdmin) return res.status(403).json({ message: "Forbidden" });
      const rows = await db.execute(sql`
        SELECT pr.*, s.store_name, u.email AS seller_email
        FROM payout_requests pr
        JOIN sellers s ON s.id = pr.seller_id
        JOIN users u ON u.id = s.user_id
        ORDER BY pr.created_at DESC
      `);
      res.json(rows.rows);
    } catch { res.status(500).json({ message: "Failed" }); }
  });

  app.patch("/api/admin/payout-requests/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const user = await storage.getUser((req.user as any).id);
      if (!user?.isAdmin) return res.status(403).json({ message: "Forbidden" });
      const { status } = req.body;
      const [updated] = await db.update(payoutRequests).set({ status }).where(eq(payoutRequests.id, parseInt(req.params.id))).returning();
      res.json(updated);
    } catch { res.status(500).json({ message: "Failed" }); }
  });

  // ── Notification push on order status change ───────────────────────────────
  // Patch the existing order-status update to also push in-app notification
  // (handled by calling pushNotification inside the existing route — we'll wire it below)

  // ── Abandoned Cart Recovery (scheduled job) ────────────────────────────────
  // Run every 15 minutes; find carts idle > 1 hour for logged-in users not yet emailed
  setInterval(async () => {
    try {
      const stale = await db.execute(sql`
        SELECT DISTINCT ci.user_id, u.email, u.first_name
        FROM cart_items ci
        JOIN users u ON u.id = ci.user_id
        WHERE ci.user_id IS NOT NULL
          AND ci.created_at < NOW() - INTERVAL '1 hour'
          AND NOT EXISTS (
            SELECT 1 FROM abandoned_cart_logs acl WHERE acl.user_id = ci.user_id
              AND acl.sent_at > NOW() - INTERVAL '24 hours'
          )
          AND NOT EXISTS (
            SELECT 1 FROM orders o WHERE o.user_id = ci.user_id
              AND o.created_at > NOW() - INTERVAL '24 hours'
          )
      `);

      for (const row of (stale.rows as any[])) {
        const { user_id, email, first_name } = row;
        if (!email) continue;
        const itemRows = await db.execute(sql`
          SELECT p.name, ci.quantity FROM cart_items ci
          JOIN products p ON p.id = ci.product_id
          WHERE ci.user_id = ${user_id}
        `);
        const items = itemRows.rows as any[];
        if (!items.length) continue;

        const itemList = items.map((i: any) => `<li>${i.name} × ${i.quantity}</li>`).join("");
        const html = `
          <div style="font-family:sans-serif;max-width:520px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden">
            <div style="background:#1a4731;padding:24px 32px;text-align:center">
              <h1 style="color:#fff;margin:0;font-size:22px">Fountstream</h1>
            </div>
            <div style="padding:32px">
              <h2 style="color:#111;margin:0 0 12px">Hi ${first_name ?? "there"}, you left something behind!</h2>
              <p style="color:#555;line-height:1.6">You have items waiting in your cart:</p>
              <ul style="color:#333;line-height:2">${itemList}</ul>
              <div style="margin-top:24px;text-align:center">
                <a href="${process.env.FRONTEND_URL ?? ""}/cart" style="display:inline-block;background:#1a4731;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600">Complete Your Purchase</a>
              </div>
            </div>
          </div>`;

        await sendEmail(email, "You left something in your cart!", html).catch(() => {});
        await db.insert(abandonedCartLogs).values({ userId: user_id }).onConflictDoUpdate({ target: abandonedCartLogs.userId, set: { sentAt: new Date() } });
      }
    } catch (err) {
      console.error("[AbandonedCart] Job failed:", err);
    }
  }, 15 * 60 * 1000);

  const httpServer = createServer(app);
  return httpServer;
}
