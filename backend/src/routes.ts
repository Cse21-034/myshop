import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupGoogleAuth, isAuthenticated } from "./googleAuth";
import { 
  insertProductSchema,
  insertCategorySchema,
  insertCartItemSchema,
  insertOrderSchema,
  insertContactMessageSchema,
} from "./schema";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  setupGoogleAuth(app);

// Middleware to attach X-Session-Id to req.sessionID
app.use((req: Request, res: Response, next: NextFunction) => {
  const sessionId = req.header("X-Session-Id");
  if (sessionId) {
    (req as any).sessionID = sessionId;
  }
  next();
});

  // Auth routes
 app.get('/api/auth/user', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user || !(req as any).isAuthenticated?.()) {
      return res.json(null); // allow guest users
    }
    res.json(user);
  } catch (error) {
    console.error("Error fetching user:", error);
    res.status(500).json({ message: "Failed to fetch user" });
  }
});


  // Category routes
  app.get('/api/categories', async (req: Request, res: Response) => {
    try {
      const categories = await storage.getCategories();
      res.json(categories);
    } catch (error) {
      console.error("Error fetching categories:", error);
      res.status(500).json({ message: "Failed to fetch categories" });
    }
  });

  app.post('/api/categories', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const user = await storage.getUser((req as any).user.claims.sub);
      if (!user?.isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const validatedData = insertCategorySchema.parse(req.body);
      const category = await storage.createCategory(validatedData);
      res.json(category);
    } catch (error) {
      console.error("Error creating category:", error);
      res.status(500).json({ message: "Failed to create category" });
    }
  });

  // Product routes
  app.get('/api/products', async (req: Request, res: Response) => {
    try {
      const filters = {
        categoryId: req.query.categoryId ? parseInt(req.query.categoryId as string) : undefined,
        search: req.query.search as string,
        minPrice: req.query.minPrice ? parseFloat(req.query.minPrice as string) : undefined,
        maxPrice: req.query.maxPrice ? parseFloat(req.query.maxPrice as string) : undefined,
        featured: req.query.featured === 'true',
        active: req.query.active !== 'false', // Default to true
      };

      const products = await storage.getProducts(filters);
      res.json(products);
    } catch (error) {
      console.error("Error fetching products:", error);
      res.status(500).json({ message: "Failed to fetch products" });
    }
  });

  app.get('/api/products/:id', async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const product = await storage.getProduct(id);
      
      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }
      
      res.json(product);
    } catch (error) {
      console.error("Error fetching product:", error);
      res.status(500).json({ message: "Failed to fetch product" });
    }
  });

  app.post('/api/products', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const user = await storage.getUser((req as any).user.claims.sub);
      if (!user?.isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const validatedData = insertProductSchema.parse(req.body);
      const product = await storage.createProduct(validatedData);
      res.json(product);
    } catch (error) {
      console.error("Error creating product:", error);
      res.status(500).json({ message: "Failed to create product" });
    }
  });

  app.put('/api/products/:id', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const user = await storage.getUser((req as any).user.claims.sub);
      if (!user?.isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const id = parseInt(req.params.id);
      const validatedData = insertProductSchema.partial().parse(req.body);
      const product = await storage.updateProduct(id, validatedData);
      res.json(product);
    } catch (error) {
      console.error("Error updating product:", error);
      res.status(500).json({ message: "Failed to update product" });
    }
  });

  app.delete('/api/products/:id', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const user = await storage.getUser((req as any).user.claims.sub);
      if (!user?.isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const id = parseInt(req.params.id);
      await storage.deleteProduct(id);
      res.json({ message: "Product deleted successfully" });
    } catch (error) {
      console.error("Error deleting product:", error);
      res.status(500).json({ message: "Failed to delete product" });
    }
  });

  // Cart routes
  app.get('/api/cart', async (req: Request, res: Response) => {
    try {
      const userId = (req as any).isAuthenticated() ? (req as any).user.claims.sub : undefined;
      const sessionId = !userId ? (req as any).sessionID : undefined;
      
      const items = await storage.getCartItems(userId, sessionId);
      res.json(items);
    } catch (error) {
      console.error("Error fetching cart:", error);
      res.status(500).json({ message: "Failed to fetch cart" });
    }
  });

  app.post('/api/cart', async (req: Request, res: Response) => {
    try {
        console.log('Session ID:', (req as any).sessionID);
    console.log('Is Authenticated:', (req as any).isAuthenticated?.());
    console.log('User:', (req as any).user);
      
      const userId = (req as any).isAuthenticated() ? (req as any).user.claims.sub : undefined;
      const sessionId = !userId ? (req as any).sessionID : undefined;

    console.log('UserId:', userId, 'SessionId:', sessionId);
      
      const cartItemData = {
        ...req.body,
        userId,
        sessionId,
      };

      const validatedData = insertCartItemSchema.parse(cartItemData);
      const item = await storage.addToCart(validatedData);
      res.json(item);
    } catch (error) {
      console.error("Error adding to cart:", error);
      res.status(500).json({ message: "Failed to add to cart" });
    }
  });

  app.put('/api/cart/:id', async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const { quantity } = req.body;
      
      if (!quantity || quantity < 1) {
        return res.status(400).json({ message: "Invalid quantity" });
      }

      const item = await storage.updateCartItem(id, quantity);
      res.json(item);
    } catch (error) {
      console.error("Error updating cart item:", error);
      res.status(500).json({ message: "Failed to update cart item" });
    }
  });

  app.delete('/api/cart/:id', async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      await storage.removeFromCart(id);
      res.json({ message: "Item removed from cart" });
    } catch (error) {
      console.error("Error removing from cart:", error);
      res.status(500).json({ message: "Failed to remove from cart" });
    }
  });

  app.delete('/api/cart', async (req: Request, res: Response) => {
    try {
      const userId = (req as any).isAuthenticated() ? (req as any).user.claims.sub : undefined;
      const sessionId = !userId ? (req as any).sessionID : undefined;
      
      await storage.clearCart(userId, sessionId);
      res.json({ message: "Cart cleared" });
    } catch (error) {
      console.error("Error clearing cart:", error);
      res.status(500).json({ message: "Failed to clear cart" });
    }
  });

  // Order routes
  app.post('/api/orders', async (req: Request, res: Response) => {
    try {
      const userId = (req as any).isAuthenticated() ? (req as any).user.claims.sub : undefined;
      const sessionId = !userId ? (req as any).sessionID : undefined;

      const { orderData, items } = req.body;
      
      const orderWithUser = {
        ...orderData,
        userId,
      };

      const validatedOrder = insertOrderSchema.parse(orderWithUser);
      const order = await storage.createOrder(validatedOrder, items);

      // Clear cart after successful order
      await storage.clearCart(userId, sessionId);

      res.json(order);
    } catch (error) {
      console.error("Error creating order:", error);
      res.status(500).json({ message: "Failed to create order" });
    }
  });

  app.get('/api/orders', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.claims.sub;
      const user = await storage.getUser(userId);
      
      // If admin, show all orders, otherwise just user's orders
      const orders = await storage.getOrders(user?.isAdmin ? undefined : userId);
      res.json(orders);
    } catch (error) {
      console.error("Error fetching orders:", error);
      res.status(500).json({ message: "Failed to fetch orders" });
    }
  });

  app.get('/api/orders/:id', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const order = await storage.getOrder(id);
      
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }

      const userId = (req as any).user.claims.sub;
      const user = await storage.getUser(userId);
      
      // Only allow access to own orders or if admin
      if (!user?.isAdmin && order.userId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }

      res.json(order);
    } catch (error) {
      console.error("Error fetching order:", error);
      res.status(500).json({ message: "Failed to fetch order" });
    }
  });

  // Contact routes
  app.post('/api/contact', async (req: Request, res: Response) => {
    try {
      const validatedData = insertContactMessageSchema.parse(req.body);
      const message = await storage.createContactMessage(validatedData);
      res.json(message);
    } catch (error) {
      console.error("Error creating contact message:", error);
      res.status(500).json({ message: "Failed to send message" });
    }
  });

  app.get('/api/contact', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const user = await storage.getUser((req as any).user.claims.sub);
      if (!user?.isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const messages = await storage.getContactMessages();
      res.json(messages);
    } catch (error) {
      console.error("Error fetching contact messages:", error);
      res.status(500).json({ message: "Failed to fetch messages" });
    }
  });

  // Admin stats route
  app.get('/api/admin/stats', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const user = await storage.getUser((req as any).user.claims.sub);
      if (!user?.isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }

      // Get basic stats
      const products = await storage.getProducts();
      const orders = await storage.getOrders();
      const messages = await storage.getContactMessages();

      const totalRevenue = orders.reduce((sum, order) => sum + parseFloat(order.total), 0);
      const uniqueCustomers = new Set(orders.filter(o => o.userId).map(o => o.userId)).size;

      const stats = {
        totalProducts: products.length,
        totalOrders: orders.length,
        totalCustomers: uniqueCustomers,
        revenue: totalRevenue,
        unreadMessages: messages.filter(m => m.status === 'unread').length,
      };

      res.json(stats);
    } catch (error) {
      console.error("Error fetching admin stats:", error);
      res.status(500).json({ message: "Failed to fetch stats" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
