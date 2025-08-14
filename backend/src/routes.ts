// server/src/routes.ts
import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { isAuthenticated } from "./googleAuth";
import { eq } from "drizzle-orm";
import { db } from "./db"; // Adjust path if your db file is elsewhere
import { contactMessages } from "./schema";
import { createStripePaymentIntent, initiateOrangeMoneyPayment } from "./payment";
import { createPayPalOrder, capturePayPalOrder } from "./paypal-service";
import {
  insertProductSchema,
  insertCategorySchema,
  insertCartItemSchema,
  insertOrderSchema,
  insertContactMessageSchema,
  updateUserSchema, // import updateUserSchema for profile validation
} from "./schema";
import { z } from "zod";
import csurf from "csurf";
import { sendWhatsAppMessage } from "./twilio";

export async function registerRoutes(app: Express): Promise<Server> {
  const csrfProtection = csurf();

  app.get("/api/auth/user", async (req: Request, res: Response) => {
    try {
      const user = req.isAuthenticated() ? req.user : null;
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user", code: "FETCH_USER_ERROR" });
    }
  });

  // New route: Update user profile
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
    
    // Validate input
    if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
      return res.status(400).json({ 
        message: "Invalid amount provided", 
        code: "INVALID_AMOUNT" 
      });
    }

    console.log('Creating PayPal order for amount:', amount, 'currency:', currency);
    
    const orderId = await createPayPalOrder(amount, currency);
    
    console.log('PayPal order created successfully:', orderId);
    res.json({ orderId });
  } catch (error: any) {
    console.error("Error creating PayPal order:", error.message || error);
    
    const statusCode = error.message?.includes('Invalid') ? 400 : 500;
    
    res.status(statusCode).json({ 
      message: error.message || "Failed to create PayPal order", 
      code: "PAYPAL_CREATE_ERROR" 
    });
  }
});

app.post("/api/payments/paypal/capture", csrfProtection, async (req: Request, res: Response) => {
  try {
    const { orderId } = req.body;
    
    // Validate input
    if (!orderId || typeof orderId !== 'string') {
      return res.status(400).json({ 
        message: "Invalid order ID provided", 
        code: "INVALID_ORDER_ID" 
      });
    }

    console.log('Capturing PayPal order:', orderId);
    
    const captureResult = await capturePayPalOrder(orderId);
    
    console.log('PayPal order captured successfully:', captureResult);
    res.json({ 
      status: "success", 
      id: captureResult.id,
      captureId: captureResult.captureId,
      amount: captureResult.amount
    });
  } catch (error: any) {
    console.error("Error capturing PayPal order:", error.message || error);
    
    const statusCode = error.message?.includes('Invalid') || error.message?.includes('not found') ? 400 : 500;
    
    res.status(statusCode).json({ 
      message: error.message || "Failed to capture PayPal order", 
      code: "PAYPAL_CAPTURE_ERROR" 
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

  app.post("/api/orders", csrfProtection, async (req: Request, res: Response) => {
    try {
      const userId = req.isAuthenticated() ? (req.user as any).id : undefined;
      const sessionId = req.sessionID;
      const { orderData, items } = req.body;
      const orderWithUser = { ...orderData, userId };
      const validatedOrder = insertOrderSchema.parse(orderWithUser);
      const order = await storage.createOrder(validatedOrder, items);
      await storage.clearCart(userId, sessionId);
          // **Send WhatsApp notification**
    await sendWhatsAppMessage({ ...order, items });
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
    if (isNaN(id)) return res.status(400).json({ message: "Invalid order id" });

    const order = await storage.getOrder(id);
    if (!order) {
      return res.status(404).json({ message: "Order not found", code: "ORDER_NOT_FOUND" });
    }

    // Verify user owns order or is admin
    const userId = (req.user as any).id;
    const user = await storage.getUser(userId);
    if (!user?.isAdmin && order.userId !== userId) {
      return res.status(403).json({ message: "Access denied", code: "FORBIDDEN" });
    }

    // Fetch the order items
    const items = await storage.getOrderItemsByOrderId(id);

    res.json({ ...order, items });
  } catch (error) {
    console.error("Error fetching order:", error);
    res.status(500).json({ message: "Failed to fetch order", code: "FETCH_ORDER_ERROR" });
  }
});


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
  // Update order status
app.put("/api/orders/:id/status", isAuthenticated, async (req, res) => {
  const id = parseInt(req.params.id);
  const { status } = req.body;
  const userId = (req.user as any).id;
  const user = await storage.getUser(userId);

  if (!user?.isAdmin) {
    return res.status(403).json({ message: "Forbidden" });
  }

  try {
    const updatedOrder = await storage.updateOrderStatus(id, status);
    res.json(updatedOrder);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to update order status" });
  }
});

// Update contact message status
app.put("/api/contact/:id/status", isAuthenticated, async (req, res) => {
  const id = parseInt(req.params.id);
  const { status } = req.body;
  const userId = (req.user as any).id;
  const user = await storage.getUser(userId);

  if (!user?.isAdmin) {
    return res.status(403).json({ message: "Forbidden" });
  }

  try {
    const updatedMessage = await storage.updateContactMessageStatus(id, status);
    res.json(updatedMessage);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to update message status" });
  }
});

// Delete contact message
app.delete("/api/contact/:id", isAuthenticated, async (req, res) => {
  const id = parseInt(req.params.id);
  const userId = (req.user as any).id;
  const user = await storage.getUser(userId);

  if (!user?.isAdmin) {
    return res.status(403).json({ message: "Forbidden" });
  }

  try {
    await db.delete(contactMessages).where(eq(contactMessages.id, id));
    res.json({ message: "Message deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to delete message" });
  }
});


  const httpServer = createServer(app);
  return httpServer;
}
