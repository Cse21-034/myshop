import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { isAuthenticated } from "./googleAuth";
import { createStripePaymentIntent, capturePayPalOrder, createPayPalOrder, initiateOrangeMoneyPayment } from "./payment";
import {
  insertProductSchema,
  insertCategorySchema,
  insertCartItemSchema,
  insertOrderSchema,
  insertContactMessageSchema,
} from "./schema";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth routes
  app.get("/api/auth/user", async (req: Request, res: Response) => {
    try {
      const user = req.isAuthenticated() ? req.user : null;
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user", code: "FETCH_USER_ERROR" });
    }
  });

  // Payment routes
  app.post("/api/payments/stripe/create", async (req: Request, res: Response) => {
    try {
      const { amount, currency } = req.body;
      const clientSecret = await createStripePaymentIntent(amount, currency);
      res.json({ clientSecret });
    } catch (error) {
      console.error("Error creating Stripe payment intent:", error);
      res.status(500).json({ message: "Failed to create payment intent", code: "STRIPE_CREATE_ERROR" });
    }
  });

  app.post("/api/payments/paypal/create", async (req: Request, res: Response) => {
    try {
      const { amount, currency } = req.body;
      const orderId = await createPayPalOrder(amount, currency);
      res.json({ orderId });
    } catch (error) {
      console.error("Error creating PayPal order:", error);
      res.status(500).json({ message: "Failed to create PayPal order", code: "PAYPAL_CREATE_ERROR" });
    }
  });

  app.post("/api/payments/paypal/capture", async (req: Request, res: Response) => {
    try {
      const { orderId } = req.body;
      await capturePayPalOrder(orderId);
      res.json({ status: "success" });
    } catch (error) {
      console.error("Error capturing PayPal order:", error);
      res.status(500).json({ message: "Failed to capture PayPal order", code: "PAYPAL_CAPTURE_ERROR" });
    }
  });

  app.post("/api/payments/orangemoney/initiate", async (req: Request, res: Response) => {
    try {
      const { phone, amount, currency } = req.body;
      const transactionId = await initiateOrangeMoneyPayment(phone, amount, currency);
      res.json({ transactionId });
    } catch (error) {
      console.error("Error initiating Orange Money payment:", error);
      res.status(500).json({ message: "Failed to initiate Orange Money payment", code: "ORANGEMONEY_INITIATE_ERROR" });
    }
  });

  // Category routes
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

  // Product routes
  app.get("/api/products", async (req: Request, res: Response) => {
    try {
      const filters = {
        categoryId: req.query.categoryId ? parseInt(req.query.categoryId as string) : undefined,
        search: req.query.search as string,
        minPrice: req.query.minPrice ? parseFloat(req.query.minPrice as string) : undefined,
        maxPrice: req.query.maxPrice ? parseFloat(req.query.maxPrice as string) : undefined,
        featured: req.query.featured === "true",
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

  // Cart routes
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

  app.post("/api/cart", async (req: Request, res: Response) => {
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

  app.put("/api/cart/:id", async (req: Request, res: Response) => {
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

  app.delete("/api/cart/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      await storage.removeFromCart(id);
      res.json({ message: "Item removed from cart" });
    } catch (error) {
      console.error("Error removing from cart:", error);
      res.status(500).json({ message: "Failed to remove from cart", code: "REMOVE_CART_ERROR" });
    }
  });

  app.delete("/api/cart", async (req: Request, res: Response) => {
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

  // Order routes
  app.post("/api/orders", async (req: Request, res: Response) => {
    try {
      const userId = req.isAuthenticated() ? (req.user as any).id : undefined;
      const sessionId = req.sessionID;
      const { orderData, items } = req.body;
      const orderWithUser = { ...orderData, userId };
      const validatedOrder = insertOrderSchema.parse(orderWithUser);
      const order = await storage.createOrder(validatedOrder, items);
      await storage.clearCart(userId, sessionId);
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

  app.get("/api/orders/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const order = await storage.getOrder(id);
      if (!order) {
        return res.status(404).json({ message: "Order not found", code: "ORDER_NOT_FOUND" });
      }
      const userId = (req.user as any).id;
      const user = await storage.getUser(userId);
      if (!user?.isAdmin && order.userId !== userId) {
        return res.status(403).json({ message: "Access denied", code: "FORBIDDEN" });
      }
      res.json(order);
    } catch (error) {
      console.error("Error fetching order:", error);
      res.status(500).json({ message: "Failed to fetch order", code: "FETCH_ORDER_ERROR" });
    }
  });

  // Contact routes
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

  // Admin stats route
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
