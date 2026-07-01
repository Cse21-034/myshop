// server/src/routes.ts
import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { isAuthenticated } from "./googleAuth";
import { eq, sql } from "drizzle-orm";
import { db } from "./db";
import { contactMessages, products } from "./schema";
import { createStripePaymentIntent, initiateOrangeMoneyPayment } from "./payment";
import { createPayPalOrder, capturePayPalOrder } from "./paypal-service";
import { sendEmail, passwordResetTemplate } from "./email";
import { setResetToken, getResetToken, deleteResetToken } from "./tokenStore";
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
      const { storeName, description, phone, address, logoUrl } = req.body;
      const updated = await storage.updateSeller(seller.id, { storeName, description, phone, address, logoUrl });
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

  // ── Forgot password ──────────────────────────────────────────────────────
  app.post("/api/auth/forgot-password", async (req: Request, res: Response) => {
    try {
      const { email } = req.body;
      if (!email) return res.status(400).json({ message: "Email is required" });

      const user = await storage.getUserByEmail(email.toLowerCase().trim());

      // Always return 200 to prevent email enumeration
      if (!user) return res.json({ message: "If that email exists, a reset link has been sent." });
      if (!user.passwordHash) {
        return res.json({ message: "This account uses Google sign-in. Please log in with Google." });
      }

      const { randomBytes } = await import("crypto");
      const token = randomBytes(32).toString("hex");
      setResetToken(token, user.id, user.email!);

      const frontendUrl = (process.env.FRONTEND_URL || "https://shop.farmerm.com").replace(/\/$/, "");
      const resetUrl = `${frontendUrl}/reset-password?token=${token}`;
      const html = passwordResetTemplate(resetUrl, user.firstName || "there");

      await sendEmail(user.email!, "Reset your Fountstream password", html);
      res.json({ message: "If that email exists, a reset link has been sent." });
    } catch (err: any) {
      console.error("[Forgot password]", err);
      res.status(500).json({ message: "Failed to send reset email. Please try again." });
    }
  });

  // ── Verify reset token (GET — frontend polls before showing the form) ──────
  app.get("/api/auth/reset-password/:token", async (req: Request, res: Response) => {
    const entry = getResetToken(req.params.token);
    if (!entry) return res.status(400).json({ valid: false, message: "Link is invalid or has expired." });
    res.json({ valid: true, email: entry.email });
  });

  // ── Reset password ────────────────────────────────────────────────────────
  app.post("/api/auth/reset-password", async (req: Request, res: Response) => {
    try {
      const { token, password } = req.body;
      if (!token || !password) return res.status(400).json({ message: "Token and password are required" });
      if (password.length < 8) return res.status(400).json({ message: "Password must be at least 8 characters" });

      const entry = getResetToken(token);
      if (!entry) return res.status(400).json({ message: "Reset link is invalid or has expired. Please request a new one." });

      const bcrypt = await import("bcryptjs");
      const passwordHash = await bcrypt.hash(password, 12);
      await storage.updateUser(entry.userId, { passwordHash } as any);
      deleteResetToken(token);

      res.json({ message: "Password updated successfully. You can now sign in." });
    } catch (err: any) {
      console.error("[Reset password]", err);
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
      const filters = {
        categoryId: req.query.categoryId ? parseInt(req.query.categoryId as string) : undefined,
        search: req.query.search as string || undefined,
        minPrice: req.query.minPrice ? parseFloat(req.query.minPrice as string) : undefined,
        maxPrice: req.query.maxPrice ? parseFloat(req.query.maxPrice as string) : undefined,
        featured: req.query.featured === "true" ? true : undefined,
        active: req.query.active !== "false",
      };
      const products = await storage.getProducts(filters);
      res.json(products);
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
      res.json(product);
    } catch (error) {
      console.error("Error fetching product:", error);
      res.status(500).json({ message: "Failed to fetch product", code: "FETCH_PRODUCT_ERROR" });
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
      const validatedData = insertProductSchema.partial().parse(req.body);
      const product = await storage.updateProduct(id, validatedData);
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

      // Calculate deposit if any item belongs to a farm product with depositPercent > 0
      let depositAmount: number | undefined;
      let remainingBalance: number | undefined;
      let orderStatus = "pending";

      const total = parseFloat(orderData.total);
      const productIds: number[] = items.map((i: any) => i.productId).filter(Boolean);

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

      const orderWithUser = {
        ...orderData,
        userId,
        fulfillmentType: fulfillmentType ?? null,
        depositAmount: depositAmount !== undefined ? depositAmount.toFixed(2) : null,
        remainingBalance: remainingBalance !== undefined ? remainingBalance.toFixed(2) : null,
        status: orderStatus,
      };

      const validatedOrder = insertOrderSchema.parse(orderWithUser);
      const order = await storage.createOrder(validatedOrder, items);

      await storage.clearCart(userId, sessionId);
      await sendWhatsAppMessage({ ...order, items });
      notifyERMOfOrder(order, items).catch((err) =>
        console.error("[ERM Notify] Background notification failed:", err),
      );

      res.json(order);
    } catch (error) {
      console.error("Error creating order:", error);
      res.status(500).json({ message: "Failed to create order", code: "CREATE_ORDER_ERROR" });
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
      const { status } = req.body;
      const userId = (req.user as any).id;
      const user = await storage.getUser(userId);

      if (!user?.isAdmin) {
        return res.status(403).json({ message: "Admin access required", code: "FORBIDDEN" });
      }

      const updatedOrder = await storage.updateOrderStatus(id, status);

      // Notify customer via WhatsApp when a farm reservation is confirmed or cancelled
      if (status === "confirmed" || status === "cancelled") {
        const items = await storage.getOrderItemsByOrderId(id);
        sendReservationStatusToCustomer({ ...updatedOrder, items }, status === "confirmed").catch((err) =>
          console.error("[Twilio] Customer notification failed:", err)
        );
      }

      res.json(updatedOrder);
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

  const httpServer = createServer(app);
  return httpServer;
}
