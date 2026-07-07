import { pgTable, text, varchar, timestamp, jsonb, index, serial, integer, decimal, boolean, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// Session storage table (mandatory for Replit Auth)
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table (mandatory for Replit Auth)
export const users = pgTable("users", {
  id: varchar("id").primaryKey().notNull(),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  isAdmin: boolean("is_admin").default(false),
  isSeller: boolean("is_seller").default(false),
  passwordHash: varchar("password_hash"),   // null for Google OAuth users
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Sellers table — profile + approval status for marketplace sellers
export const sellers = pgTable("sellers", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id).unique().notNull(),
  storeName: varchar("store_name", { length: 255 }).notNull(),
  description: text("description"),
  logoUrl: varchar("logo_url"),
  phone: varchar("phone"),
  address: text("address"),
  location: varchar("location", { length: 255 }),        // area / city shown on product page
  yearFounded: integer("year_founded"),
  responseTime: varchar("response_time", { length: 100 }), // e.g. "Within 2 hours"
  onTimeDeliveryRate: integer("on_time_delivery_rate"),   // 0–100 %
  services: text("services"),                             // free-text list of services
  tradingHours: varchar("trading_hours", { length: 255 }), // e.g. "Mon–Fri 8am–5pm"
  status: varchar("status").default("pending"), // pending | approved | rejected | suspended
  commissionPercent: integer("commission_percent").default(10),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Categories table
export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  description: text("description"),
  imageUrl: varchar("image_url"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Products table - Enhanced with supplier URL and farm marketplace fields
export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  description: text("description"),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  originalPrice: decimal("original_price", { precision: 10, scale: 2 }),
  categoryId: integer("category_id").references(() => categories.id),
  images: jsonb("images").$type<string[]>().default([]),
  imageUrls: jsonb("image_urls").$type<string[]>().default([]),
  sizes: jsonb("sizes").$type<string[]>().default([]),
  colors: jsonb("colors").$type<string[]>().default([]),
  features: jsonb("features").$type<string[]>().default([]),
  stock: integer("stock").default(0),
  featured: boolean("featured").default(false),
  active: boolean("active").default(true),
  status: varchar("status").default("active"), // active, inactive, sold, out_of_stock
  supplierUrl: varchar("supplier_url"),
  // Seller marketplace
  sellerId: varchar("seller_id").references(() => users.id),
  // Farm marketplace fields
  entityType: varchar("entity_type"),       // livestock | crop | poultry | inventory | null for regular products
  entityDetails: jsonb("entity_details"),   // entity-specific details object
  farmName: varchar("farm_name"),
  farmDistrict: varchar("farm_district"),
  farmContact: varchar("farm_contact"),
  unit: varchar("unit").default("per piece"),
  allowsDelivery: boolean("allows_delivery").default(false),
  depositPercent: integer("deposit_percent").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Orders table
export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id),
  email: varchar("email").notNull(),
  firstName: varchar("first_name").notNull(),
  lastName: varchar("last_name").notNull(),
  phone: varchar("phone").notNull(),
  address: text("address").notNull(),
  city: varchar("city").notNull(),
  state: varchar("state").notNull(),
  zipCode: varchar("zip_code").notNull(),
  paymentMethod: varchar("payment_method").notNull(),
  paymentIntentId: varchar("payment_intent_id"),
  paypalOrderId: varchar("paypal_order_id"),
  orangeMoneyTransactionId: varchar("orange_money_transaction_id"),
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }).notNull(),
  shipping: decimal("shipping", { precision: 10, scale: 2 }).notNull(),
  tax: decimal("tax", { precision: 10, scale: 2 }).notNull(),
  total: decimal("total", { precision: 10, scale: 2 }).notNull(),
  status: varchar("status").default("pending"),
  // Farm marketplace fields
  fulfillmentType: varchar("fulfillment_type"),              // pickup | delivery
  depositAmount: decimal("deposit_amount", { precision: 10, scale: 2 }),
  remainingBalance: decimal("remaining_balance", { precision: 10, scale: 2 }),
  // Lets guests view their own order confirmation without logging in
  accessToken: varchar("access_token"),
  trackingNumber: varchar("tracking_number"),
  couponCode: varchar("coupon_code"),
  discountAmount: decimal("discount_amount", { precision: 10, scale: 2 }).default("0"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Order items table
export const orderItems = pgTable("order_items", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").references(() => orders.id),
  productId: integer("product_id").references(() => products.id),
  productName: varchar("product_name").notNull(),
  productPrice: decimal("product_price", { precision: 10, scale: 2 }).notNull(),
  quantity: integer("quantity").notNull(),
  size: varchar("size"),
  color: varchar("color"),
});

// Cart items table (for persistent cart)
export const cartItems = pgTable("cart_items", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id),
  sessionId: varchar("session_id"),
  productId: integer("product_id").references(() => products.id),
  quantity: integer("quantity").notNull(),
  size: varchar("size"),
  color: varchar("color"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Product likes — any logged-in user can like a product
export const productLikes = pgTable(
  "product_likes",
  {
    id:        serial("id").primaryKey(),
    userId:    varchar("user_id").references(() => users.id).notNull(),
    productId: integer("product_id").references(() => products.id).notNull(),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (t) => [uniqueIndex("uq_product_likes_user_product").on(t.userId, t.productId)],
);

// Wishlist items — private saved products per user
export const wishlistItems = pgTable(
  "wishlist_items",
  {
    id:        serial("id").primaryKey(),
    userId:    varchar("user_id").references(() => users.id).notNull(),
    productId: integer("product_id").references(() => products.id).notNull(),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (t) => [uniqueIndex("uq_wishlist_user_product").on(t.userId, t.productId)],
);

// Product reviews — verified-purchase star ratings with optional text
export const productReviews = pgTable(
  "product_reviews",
  {
    id:               serial("id").primaryKey(),
    userId:           varchar("user_id").references(() => users.id).notNull(),
    productId:        integer("product_id").references(() => products.id).notNull(),
    rating:           integer("rating").notNull(),   // 1-5
    title:            varchar("title", { length: 100 }),
    body:             text("body"),
    verifiedPurchase: boolean("verified_purchase").default(false),
    createdAt:        timestamp("created_at").defaultNow(),
  },
  (t) => [uniqueIndex("uq_product_reviews_user_product").on(t.userId, t.productId)],
);

// In-app notifications
export const notifications = pgTable("notifications", {
  id:        serial("id").primaryKey(),
  userId:    varchar("user_id").references(() => users.id).notNull(),
  type:      varchar("type").notNull(),   // order_update | return_update | stock_back | question_answered
  title:     varchar("title", { length: 200 }).notNull(),
  body:      text("body"),
  link:      varchar("link"),
  read:      boolean("read").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// Product Q&A
export const productQuestions = pgTable("product_questions", {
  id:          serial("id").primaryKey(),
  productId:   integer("product_id").references(() => products.id).notNull(),
  userId:      varchar("user_id").references(() => users.id).notNull(),
  question:    text("question").notNull(),
  answer:      text("answer"),
  answeredBy:  varchar("answered_by").references(() => users.id),
  answeredAt:  timestamp("answered_at"),
  createdAt:   timestamp("created_at").defaultNow(),
});

// Payout requests (seller → admin)
export const payoutRequests = pgTable("payout_requests", {
  id:        serial("id").primaryKey(),
  sellerId:  integer("seller_id").references(() => sellers.id).notNull(),
  amount:    decimal("amount", { precision: 10, scale: 2 }).notNull(),
  status:    varchar("status").default("pending"), // pending | approved | paid | rejected
  note:      text("note"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Abandoned cart notifications (track who we've already emailed)
export const abandonedCartLogs = pgTable("abandoned_cart_logs", {
  id:        serial("id").primaryKey(),
  userId:    varchar("user_id").references(() => users.id).notNull().unique(),
  sentAt:    timestamp("sent_at").defaultNow(),
});

// Stock notifications — subscribe to back-in-stock alerts
export const stockNotifications = pgTable(
  "stock_notifications",
  {
    id:        serial("id").primaryKey(),
    email:     varchar("email").notNull(),
    productId: integer("product_id").references(() => products.id).notNull(),
    notified:  boolean("notified").default(false),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (t) => [uniqueIndex("uq_stock_notify_email_product").on(t.email, t.productId)],
);

// Return / refund requests
export const returnRequests = pgTable("return_requests", {
  id:        serial("id").primaryKey(),
  orderId:   integer("order_id").references(() => orders.id).notNull(),
  userId:    varchar("user_id").references(() => users.id).notNull(),
  reason:    text("reason").notNull(),
  status:    varchar("status").default("pending"), // pending | approved | rejected
  adminNote: text("admin_note"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Coupons / discount codes
export const coupons = pgTable("coupons", {
  id:         serial("id").primaryKey(),
  code:       varchar("code", { length: 50 }).notNull().unique(),
  type:       varchar("type").notNull(),  // percent | fixed
  value:      decimal("value", { precision: 10, scale: 2 }).notNull(),
  minOrder:   decimal("min_order", { precision: 10, scale: 2 }).default("0"),
  maxUses:    integer("max_uses"),        // null = unlimited
  usedCount:  integer("used_count").default(0),
  expiresAt:  timestamp("expires_at"),
  active:     boolean("active").default(true),
  createdAt:  timestamp("created_at").defaultNow(),
});

// Contact messages table
export const contactMessages = pgTable("contact_messages", {
  id: serial("id").primaryKey(),
  name: varchar("name").notNull(),
  email: varchar("email").notNull(),
  subject: varchar("subject").notNull(),
  message: text("message").notNull(),
  status: varchar("status").default("unread"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Relations
export const usersRelations = relations(users, ({ one, many }) => ({
  orders: many(orders),
  cartItems: many(cartItems),
  seller: one(sellers, { fields: [users.id], references: [sellers.userId] }),
}));

export const sellersRelations = relations(sellers, ({ one }) => ({
  user: one(users, { fields: [sellers.userId], references: [users.id] }),
}));

export const categoriesRelations = relations(categories, ({ many }) => ({
  products: many(products),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  category: one(categories, {
    fields: [products.categoryId],
    references: [categories.id],
  }),
  orderItems: many(orderItems),
  cartItems: many(cartItems),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  user: one(users, {
    fields: [orders.userId],
    references: [users.id],
  }),
  items: many(orderItems),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, {
    fields: [orderItems.orderId],
    references: [orders.id],
  }),
  product: one(products, {
    fields: [orderItems.productId],
    references: [products.id],
  }),
}));

export const cartItemsRelations = relations(cartItems, ({ one }) => ({
  user: one(users, {
    fields: [cartItems.userId],
    references: [users.id],
  }),
  product: one(products, {
    fields: [cartItems.productId],
    references: [products.id],
  }),
}));

// Types
export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

export type InsertCategory = typeof categories.$inferInsert;
export type Category = typeof categories.$inferSelect;

export type InsertProduct = typeof products.$inferInsert;
export type Product = typeof products.$inferSelect;

export type InsertOrder = typeof orders.$inferInsert;
export type Order = typeof orders.$inferSelect;

export type InsertOrderItem = typeof orderItems.$inferInsert;
export type OrderItem = typeof orderItems.$inferSelect;

export type InsertProductLike = typeof productLikes.$inferInsert;
export type ProductLike = typeof productLikes.$inferSelect;

export type InsertWishlistItem = typeof wishlistItems.$inferInsert;
export type WishlistItem = typeof wishlistItems.$inferSelect;

export type InsertProductReview = typeof productReviews.$inferInsert;
export type ProductReview = typeof productReviews.$inferSelect;

export type InsertCartItem = typeof cartItems.$inferInsert;
export type CartItem = typeof cartItems.$inferSelect;

export type InsertContactMessage = typeof contactMessages.$inferInsert;
export type ContactMessage = typeof contactMessages.$inferSelect;

export type InsertSeller = typeof sellers.$inferInsert;
export type Seller = typeof sellers.$inferSelect;

export type InsertNotification = typeof notifications.$inferInsert;
export type Notification = typeof notifications.$inferSelect;

export type InsertProductQuestion = typeof productQuestions.$inferInsert;
export type ProductQuestion = typeof productQuestions.$inferSelect;

export type InsertPayoutRequest = typeof payoutRequests.$inferInsert;
export type PayoutRequest = typeof payoutRequests.$inferSelect;

export type InsertStockNotification = typeof stockNotifications.$inferInsert;
export type StockNotification = typeof stockNotifications.$inferSelect;

export type InsertReturnRequest = typeof returnRequests.$inferInsert;
export type ReturnRequest = typeof returnRequests.$inferSelect;

export type InsertCoupon = typeof coupons.$inferInsert;
export type Coupon = typeof coupons.$inferSelect;

// Enhanced schemas with new fields
export const insertCategorySchema = createInsertSchema(categories).omit({
  id: true,
  createdAt: true,
});

export const insertProductSchema = createInsertSchema(products).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  // Ensure proper validation for new fields
  status: z.enum(["active", "inactive", "sold", "out_of_stock"]).optional().default("active"),
  supplierUrl: z.string().url().optional().or(z.literal("")),
  images: z.array(z.string().url()).default([]),
  sizes: z.array(z.string()).default([]),
  colors: z.array(z.string()).default([]),
});

export const insertOrderSchema = createInsertSchema(orders).omit({
  id: true,
  createdAt: true,
  accessToken: true,
}).extend({
  paymentIntentId: z.string().optional(),
  paypalOrderId: z.string().optional(),
  orangeMoneyTransactionId: z.string().optional(),
  fulfillmentType: z.enum(["pickup", "delivery"]).nullish(),
  depositAmount: z.string().nullish(),
  remainingBalance: z.string().nullish(),
});

export const insertOrderItemSchema = createInsertSchema(orderItems).omit({
  id: true,
});

export const insertCartItemSchema = createInsertSchema(cartItems).omit({
  id: true,
  createdAt: true,
});

export const insertContactMessageSchema = createInsertSchema(contactMessages).omit({
  id: true,
  createdAt: true,
});

export const insertSellerSchema = createInsertSchema(sellers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  status: true,
  commissionPercent: true,
});

// New schema for user update validation
export const updateUserSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  language: z.string().optional(),
  currency: z.string().optional(),
  profileImageUrl: z.string().url().optional(),
});
