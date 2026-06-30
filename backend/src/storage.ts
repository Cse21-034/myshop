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
  updateUser(
    id: string,
    updates: Partial<{
      firstName: string;
      lastName: string;
      language?: string;
      currency?: string;
      profileImageUrl?: string;
    }>
  ): Promise<User | null>;
  getOrderItemsByOrderId(orderId: number): Promise<OrderItem[]>;
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
    status?: string;
  }): Promise<(Product & { category: Category | null })[]>;
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
  deleteOrder(id: number): Promise<void>;
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

  async updateUser(
    id: string,
    updates: Partial<{
      firstName: string;
      lastName: string;
      language?: string;
      currency?: string;
      profileImageUrl?: string;
    }>
  ): Promise<User | null> {
    const [updatedUser] = await db
      .update(users)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return updatedUser ?? null;
  }

  async deleteOrder(id: number): Promise<void> {
    // Delete associated order items first
    await db.delete(orderItems).where(eq(orderItems.orderId, id));
    // Then delete the order
    await db.delete(orders).where(eq(orders.id, id));
  }
  
  async getOrderItemsByOrderId(orderId: number): Promise<OrderItem[]> {
    return await db.select().from(orderItems).where(eq(orderItems.orderId, orderId));
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
    status?: string;
  }): Promise<(Product & { category: Category | null })[]> {
    const conditions: any[] = [];

    if (filters?.categoryId) {
      conditions.push(eq(products.categoryId, filters.categoryId));
    }
    if (filters?.search) {
      conditions.push(like(products.name, `%${filters.search}%`));
    }
    if (filters?.minPrice !== undefined) {
      conditions.push(gte(products.price, filters.minPrice.toString()));
    }
    if (filters?.maxPrice !== undefined) {
      conditions.push(lte(products.price, filters.maxPrice.toString()));
    }
    if (filters?.featured !== undefined) {
      conditions.push(eq(products.featured, filters.featured));
    }


    
    if (filters?.active !== undefined) {
      conditions.push(eq(products.active, filters.active));
    }else {
    conditions.push(eq(products.active, true));
  }

    
    if (filters?.status) {
      conditions.push(eq(products.status, filters.status));
    }else {
    conditions.push(eq(products.status, "active")); // ✅ Use string literal
  }

    // Build query with conditional where clause inline
    const rows = await db
      .select({
        id: products.id,
        name: products.name,
        description: products.description,
        price: products.price,
        originalPrice: products.originalPrice,
        categoryId: products.categoryId,
        slug: products.slug,
        images: products.images,
        imageUrls: products.imageUrls,
        featured: products.featured,
        active: products.active,
        status: products.status,
        supplierUrl: products.supplierUrl,
        createdAt: products.createdAt,
        updatedAt: products.updatedAt,
        sizes: products.sizes,
        colors: products.colors,
        stock: products.stock,
        entityType: products.entityType,
        entityDetails: products.entityDetails,
        farmName: products.farmName,
        farmDistrict: products.farmDistrict,
        farmContact: products.farmContact,
        unit: products.unit,
        allowsDelivery: products.allowsDelivery,
        depositPercent: products.depositPercent,

        category_id: categories.id,
        category_name: categories.name,
        category_slug: categories.slug,
        category_description: categories.description,
        category_imageUrl: categories.imageUrl,
        category_createdAt: categories.createdAt,
      })
      .from(products)
      .leftJoin(categories, eq(products.categoryId, categories.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(products.createdAt));

    // Map to nested product-category structure, handling nullable category fields
    return rows.map(row => {
      const {
        category_id,
        category_name,
        category_slug,
        category_description,
        category_imageUrl,
        category_createdAt,
        ...productFields
      } = row;

      // Construct category object or null
      const category = category_id != null ? {
        id: category_id,
        name: category_name || "",
        slug: category_slug || "",
        description: category_description || "",
        imageUrl: category_imageUrl || "",
        createdAt: category_createdAt || null,
      } : null;

      return { ...productFields, category };
    });
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
    const productData = {
      ...product,
      images: product.images || [],
      imageUrls: (product as any).imageUrls || [],
      sizes: product.sizes || [],
      colors: product.colors || [],
      status: product.status || 'active',
      supplierUrl: product.supplierUrl || null,
      entityType: (product as any).entityType || null,
      entityDetails: (product as any).entityDetails || null,
      farmName: (product as any).farmName || null,
      farmDistrict: (product as any).farmDistrict || null,
      farmContact: (product as any).farmContact || null,
      unit: (product as any).unit || 'per piece',
      allowsDelivery: (product as any).allowsDelivery ?? false,
      depositPercent: (product as any).depositPercent ?? 0,
    };

    const [newProduct] = await db.insert(products).values(productData).returning();
    return newProduct;
  }

  async updateProduct(id: number, product: Partial<InsertProduct>): Promise<Product> {
    const updateData: any = { ...product, updatedAt: new Date() };

    if (product.images !== undefined) updateData.images = product.images;
    if ((product as any).imageUrls !== undefined) updateData.imageUrls = (product as any).imageUrls;
    if (product.sizes !== undefined) updateData.sizes = product.sizes;
    if (product.colors !== undefined) updateData.colors = product.colors;
    if (product.status !== undefined) updateData.status = product.status;
    if (product.supplierUrl !== undefined) updateData.supplierUrl = product.supplierUrl || null;
    if ((product as any).entityType !== undefined) updateData.entityType = (product as any).entityType;
    if ((product as any).entityDetails !== undefined) updateData.entityDetails = (product as any).entityDetails;
    if ((product as any).farmName !== undefined) updateData.farmName = (product as any).farmName;
    if ((product as any).farmDistrict !== undefined) updateData.farmDistrict = (product as any).farmDistrict;
    if ((product as any).farmContact !== undefined) updateData.farmContact = (product as any).farmContact;
    if ((product as any).unit !== undefined) updateData.unit = (product as any).unit;
    if ((product as any).allowsDelivery !== undefined) updateData.allowsDelivery = (product as any).allowsDelivery;
    if ((product as any).depositPercent !== undefined) updateData.depositPercent = (product as any).depositPercent;

    const [updatedProduct] = await db
      .update(products)
      .set(updateData)
      .where(eq(products.id, id))
      .returning();

    return updatedProduct;
  }

  async deleteProduct(id: number): Promise<void> {
    await db.delete(products).where(eq(products.id, id));
  }

  async getCartItems(userId?: string, sessionId?: string): Promise<CartItem[]> {
    console.log(`🔍 Fetching cart items for userId=${userId}, sessionId=${sessionId}`);
    const conditions = [];
    if (userId) {
      conditions.push(eq(cartItems.userId, userId));
    }
    if (sessionId) {
      conditions.push(eq(cartItems.sessionId, sessionId));
    }
    if (conditions.length === 0) {
      console.log("🔍 No userId or sessionId provided, returning empty cart");
      return [];
    }
    const items = await db
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
    console.log(`🔍 Cart items fetched:`, items);
    return items;
  }

  async addToCart(item: InsertCartItem): Promise<CartItem> {
    console.log(`🔍 Adding to cart:`, item);
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
    console.log(`🔍 Existing cart item:`, existingItem);
    if (existingItem.length > 0) {
      const [updatedItem] = await db
        .update(cartItems)
        .set({ quantity: existingItem[0].quantity + item.quantity })
        .where(eq(cartItems.id, existingItem[0].id))
        .returning();
      console.log(`🔍 Updated cart item:`, updatedItem);
      return updatedItem;
    }

    const [newItem] = await db.insert(cartItems).values(item).returning();
    console.log(`🔍 Created new cart item:`, newItem);
    return newItem;
  }

  async updateCartItem(id: number, quantity: number): Promise<CartItem> {
    console.log(`🔍 Updating cart item id=${id} with quantity=${quantity}`);
    const [updatedItem] = await db
      .update(cartItems)
      .set({ quantity })
      .where(eq(cartItems.id, id))
      .returning();
    console.log(`🔍 Updated cart item:`, updatedItem);
    return updatedItem;
  }

  async removeFromCart(id: number): Promise<void> {
    console.log(`🔍 Removing cart item id=${id}`);
    await db.delete(cartItems).where(eq(cartItems.id, id));
    console.log(`🔍 Cart item removed`);
  }

  async clearCart(userId?: string, sessionId?: string): Promise<void> {
    console.log(`🔍 Clearing cart for userId=${userId}, sessionId=${sessionId}`);
    const conditions = [];
    if (userId) {
      conditions.push(eq(cartItems.userId, userId));
    }
    if (sessionId) {
      conditions.push(eq(cartItems.sessionId, sessionId));
    }
    if (conditions.length > 0) {
      await db.delete(cartItems).where(and(...conditions));
      console.log(`🔍 Cart cleared`);
    }
  }

  async mergeCart(sessionId: string, userId: string): Promise<void> {
    try {
      console.log(`🔍 Attempting to merge cart: sessionId=${sessionId}, userId=${userId}`);
      const userCartItems = await db
        .select({
          productId: cartItems.productId,
          size: cartItems.size,
          color: cartItems.color,
        })
        .from(cartItems)
        .where(eq(cartItems.userId, userId));
      console.log(`🔍 User cart items:`, userCartItems);

      const userCartSet = new Set(
        userCartItems.map((item) => `${item.productId}-${item.size || ''}-${item.color || ''}`)
      );

      const guestCartItems = await db
        .select()
        .from(cartItems)
        .where(and(eq(cartItems.sessionId, sessionId), sql`${cartItems.productId} IS NOT NULL`));
      console.log(`🔍 Guest cart items:`, guestCartItems);

      for (const item of guestCartItems) {
        if (!item.productId) continue;
        const itemKey = `${item.productId}-${item.size || ''}-${item.color || ''}`;
        if (!userCartSet.has(itemKey)) {
          console.log(`🔍 Transferring guest item ${item.id} to user ${userId}`);
          await db
            .update(cartItems)
            .set({ userId, sessionId: null })
            .where(eq(cartItems.id, item.id));
        } else {
          console.log(`🔍 Merging quantities for item ${item.id} with existing user item`);
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
            console.log(`🔍 Merged item ${item.id} with user item ${existingItem[0].id}`);
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
    // Check stock availability before creating the order
    for (const item of items) {
      if (!item.productId) continue;
      const [product] = await db.select({ stock: products.stock, name: products.name })
        .from(products)
        .where(eq(products.id, item.productId));
      if (!product) throw new Error(`Product not found: ${item.productId}`);
      if ((product.stock ?? 0) < item.quantity) {
        throw new Error(`Insufficient stock for "${product.name}". Available: ${product.stock ?? 0}`);
      }
    }

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

    // Decrement stock for each ordered item
    for (const item of items) {
      if (!item.productId) continue;
      const [updated] = await db
        .update(products)
        .set({ stock: sql`${products.stock} - ${item.quantity}`, updatedAt: new Date() })
        .where(eq(products.id, item.productId))
        .returning({ stock: products.stock });
      if ((updated?.stock ?? 0) <= 0) {
        await db.update(products)
          .set({ status: "out_of_stock", active: false })
          .where(eq(products.id, item.productId!));
      }
    }

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
