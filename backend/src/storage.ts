// server/src/storage.ts
import {
  users,
  categories,
  products,
  orders,
  orderItems,
  cartItems,
  contactMessages,
  type User,
  type UpsertUser,
  type Category,
  type InsertCategory,
  type Product,
  type InsertProduct,
  type Order,
  type InsertOrder,
  type OrderItem,
  type InsertOrderItem,
  type CartItem,
  type InsertCartItem,
  type ContactMessage,
  type InsertContactMessage,
} from "./schema";
import { db } from "./db";
import { eq, desc, and, like, gte, lte, sql } from "drizzle-orm";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  getCategories(): Promise<Category[]>;
  createCategory(category: InsertCategory): Promise<Category>;
  updateCategory(id: number, category: Partial<InsertCategory>): Promise<Category>;
  deleteCategory(id: number): Promise<void>;
  getProducts(filters?: {
    categoryId?: number;
    search?: string;
    minPrice?: number;
    maxPrice?: number;
    featured?: boolean;
    active?: boolean;
  }): Promise<Product[]>;
  getProduct(id: number): Promise<Product | undefined>;
  getProductBySlug(slug: string): Promise<Product | undefined>;
  createProduct(product: InsertProduct): Promise<Product>;
  updateProduct(id: number, product: Partial<InsertProduct>): Promise<Product>;
  deleteProduct(id: number): Promise<void>;
  getCartItems(userId?: string, sessionId?: string): Promise<CartItem[]>;
  addToCart(item: InsertCartItem): Promise<CartItem>;
  updateCartItem(id: number, quantity: number): Promise<CartItem>;
  removeFromCart(id: number): Promise<void>;
  clearCart(userId?: string, sessionId?: string): Promise<void>;
  mergeCart(sessionId: string, userId: string): Promise<void>;
  createOrder(order: InsertOrder, items: InsertOrderItem[]): Promise<Order>;
  getOrders(userId?: string): Promise<Order[]>;
  getOrder(id: number): Promise<Order | undefined>;
  updateOrderStatus(id: number, status: string): Promise<Order>;
  createContactMessage(message: InsertContactMessage): Promise<ContactMessage>;
  getContactMessages(): Promise<ContactMessage[]>;
  updateContactMessageStatus(id: number, status: string): Promise<ContactMessage>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: { ...userData, updatedAt: new Date() },
      })
      .returning();
    return user;
  }

  async getCategories(): Promise<Category[]> {
    return await db.select().from(categories).orderBy(categories.name);
  }

  async createCategory(category: InsertCategory): Promise<Category> {
    const [newCategory] = await db.insert(categories).values(category).returning();
    return newCategory;
  }

  async updateCategory(id: number, category: Partial<InsertCategory>): Promise<Category> {
    const [updatedCategory] = await db
      .update(categories)
      .set(category)
      .where(eq(categories.id, id))
      .returning();
    return updatedCategory;
  }

  async deleteCategory(id: number): Promise<void> {
    await db.delete(categories).where(eq(categories.id, id));
  }

  async getProducts(filters?: {
    categoryId?: number;
    search?: string;
    minPrice?: number;
    maxPrice?: number;
    featured?: boolean;
    active?: boolean;
  }): Promise<Product[]> {
    let query = db.select().from(products);
    const conditions = [];

    if (filters?.categoryId) {
      conditions.push(eq(products.categoryId, filters.categoryId));
    }
    if (filters?.search) {
      conditions.push(like(products.name, `%${filters.search}%`));
    }
    if (filters?.minPrice) {
      conditions.push(gte(products.price, filters.minPrice.toString()));
    }
    if (filters?.maxPrice) {
      conditions.push(lte(products.price, filters.maxPrice.toString()));
    }
    if (filters?.featured !== undefined) {
      conditions.push(eq(products.featured, filters.featured));
    }
    if (filters?.active !== undefined) {
      conditions.push(eq(products.active, filters.active));
    }

    if (conditions.length > 0) {
      return await query.where(and(...conditions)).orderBy(desc(products.createdAt));
    }
    return await query.orderBy(desc(products.createdAt));
  }

  async getProduct(id: number): Promise<Product | undefined> {
    const [product] = await db.select().from(products).where(eq(products.id, id));
    return product;
  }

  async getProductBySlug(slug: string): Promise<Product | undefined> {
    const [product] = await db.select().from(products).where(eq(products.slug, slug));
    return product;
  }

  async createProduct(product: InsertProduct): Promise<Product> {
    const [newProduct] = await db.insert(products).values(product).returning();
    return newProduct;
  }

  async updateProduct(id: number, product: Partial<InsertProduct>): Promise<Product> {
    const [updatedProduct] = await db
      .update(products)
      .set({ ...product, updatedAt: new Date() })
      .where(eq(products.id, id))
      .returning();
    return updatedProduct;
  }

  async deleteProduct(id: number): Promise<void> {
    await db.delete(products).where(eq(products.id, id));
  }

  async getCartItems(userId?: string, sessionId?: string): Promise<CartItem[]> {
    const conditions = [];
    if (userId) {
      conditions.push(eq(cartItems.userId, userId));
    }
    if (sessionId) {
      conditions.push(eq(cartItems.sessionId, sessionId));
    }
    if (conditions.length === 0) {
      return [];
    }
    return await db
      .select({
        id: cartItems.id,
        userId: cartItems.userId,
        sessionId: cartItems.sessionId,
        productId: cartItems.productId,
        quantity: cartItems.quantity,
        size: cartItems.size,
        color: cartItems.color,
        createdAt: cartItems.createdAt,
        product: {
          id: products.id,
          name: products.name,
          price: products.price,
          images: products.images,
        },
      })
      .from(cartItems)
      .innerJoin(products, eq(cartItems.productId, products.id))
      .where(and(...conditions))
      .orderBy(cartItems.createdAt);
  }

  async addToCart(item: InsertCartItem): Promise<CartItem> {
    const conditions = [];
    if (item.productId) {
      conditions.push(eq(cartItems.productId, item.productId));
    }
    if (item.userId) {
      conditions.push(eq(cartItems.userId, item.userId));
    }
    if (item.sessionId) {
      conditions.push(eq(cartItems.sessionId, item.sessionId));
    }
    if (item.size) {
      conditions.push(eq(cartItems.size, item.size));
    } else {
      conditions.push(sql`${cartItems.size} IS NULL`);
    }
    if (item.color) {
      conditions.push(eq(cartItems.color, item.color));
    } else {
      conditions.push(sql`${cartItems.color} IS NULL`);
    }

    const existingItem = await db.select().from(cartItems).where(and(...conditions));
    if (existingItem.length > 0) {
      const [updatedItem] = await db
        .update(cartItems)
        .set({ quantity: existingItem[0].quantity + item.quantity })
        .where(eq(cartItems.id, existingItem[0].id))
        .returning();
      return updatedItem;
    }

    const [newItem] = await db.insert(cartItems).values(item).returning();
    return newItem;
  }

  async updateCartItem(id: number, quantity: number): Promise<CartItem> {
    const [updatedItem] = await db
      .update(cartItems)
      .set({ quantity })
      .where(eq(cartItems.id, id))
      .returning();
    return updatedItem;
  }

  async removeFromCart(id: number): Promise<void> {
    await db.delete(cartItems).where(eq(cartItems.id, id));
  }

  async clearCart(userId?: string, sessionId?: string): Promise<void> {
    const conditions = [];
    if (userId) {
      conditions.push(eq(cartItems.userId, userId));
    }
    if (sessionId) {
      conditions.push(eq(cartItems.sessionId, sessionId));
    }
    if (conditions.length > 0) {
      await db.delete(cartItems).where(and(...conditions));
    }
  }

  async mergeCart(sessionId: string, userId: string): Promise<void> {
    try {
      // Check for existing cart items for the user to avoid duplicates
      const userCartItems = await db
        .select({
          productId: cartItems.productId,
          size: cartItems.size,
          color: cartItems.color,
        })
        .from(cartItems)
        .where(eq(cartItems.userId, userId));

      const userCartSet = new Set(
        userCartItems.map((item) => `${item.productId}-${item.size || ''}-${item.color || ''}`)
      );

      // Fetch guest cart items, excluding those with null productId
      const guestCartItems = await db
        .select()
        .from(cartItems)
        .where(and(eq(cartItems.sessionId, sessionId), sql`${cartItems.productId} IS NOT NULL`));

      for (const item of guestCartItems) {
        if (!item.productId) continue; // Skip items with null productId
        const itemKey = `${item.productId}-${item.size || ''}-${item.color || ''}`;
        if (!userCartSet.has(itemKey)) {
          // Update guest cart item to user ID
          await db
            .update(cartItems)
            .set({ userId, sessionId: null })
            .where(eq(cartItems.id, item.id));
        } else {
          // If item exists in user cart, update quantity
          const conditions = [
            eq(cartItems.userId, userId),
            eq(cartItems.productId, item.productId),
            item.size ? eq(cartItems.size, item.size) : sql`${cartItems.size} IS NULL`,
            item.color ? eq(cartItems.color, item.color) : sql`${cartItems.color} IS NULL`,
          ];
          const existingItem = await db
            .select()
            .from(cartItems)
            .where(and(...conditions));
          if (existingItem.length > 0) {
            await db
              .update(cartItems)
              .set({ quantity: existingItem[0].quantity + item.quantity })
              .where(eq(cartItems.id, existingItem[0].id));
            await db.delete(cartItems).where(eq(cartItems.id, item.id));
          }
        }
      }

      console.log(`✅ Merged ${guestCartItems.length} cart items from session ${sessionId} to user ${userId}`);
    } catch (error) {
      console.error("❌ Failed to merge cart:", error);
      throw error;
    }
  }

  async createOrder(order: InsertOrder, items: InsertOrderItem[]): Promise<Order> {
    const [newOrder] = await db
      .insert(orders)
      .values({
        ...order,
        paymentIntentId: order.paymentIntentId,
        paypalOrderId: order.paypalOrderId,
        orangeMoneyTransactionId: order.orangeMoneyTransactionId,
      })
      .returning();
    const orderItemsWithOrderId = items.map((item) => ({ ...item, orderId: newOrder.id }));
    await db.insert(orderItems).values(orderItemsWithOrderId);
    return newOrder;
  }

  async getOrders(userId?: string): Promise<Order[]> {
    const conditions = userId ? [eq(orders.userId, userId)] : [];
    return await db
      .select()
      .from(orders)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(orders.createdAt));
  }

  async getOrder(id: number): Promise<Order | undefined> {
    const [order] = await db.select().from(orders).where(eq(orders.id, id));
    return order;
  }

  async updateOrderStatus(id: number, status: string): Promise<Order> {
    const [updatedOrder] = await db
      .update(orders)
      .set({ status })
      .where(eq(orders.id, id))
      .returning();
    return updatedOrder;
  }

  async createContactMessage(message: InsertContactMessage): Promise<ContactMessage> {
    const [newMessage] = await db.insert(contactMessages).values(message).returning();
    return newMessage;
  }

  async getContactMessages(): Promise<ContactMessage[]> {
    return await db.select().from(contactMessages).orderBy(desc(contactMessages.createdAt));
  }

  async updateContactMessageStatus(id: number, status: string): Promise<ContactMessage> {
    const [updatedMessage] = await db
      .update(contactMessages)
      .set({ status })
      .where(eq(contactMessages.id, id))
      .returning();
    return updatedMessage;
  }
}

export const storage = new DatabaseStorage();
