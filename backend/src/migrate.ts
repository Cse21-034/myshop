import { db } from "./db";
import { sql } from "drizzle-orm";

async function migrate() {
  console.log("[Migrate] Running database migrations...");

  const migrations = [
    // Users — email/password auth
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash varchar`,

    // Products — farm marketplace columns
    `ALTER TABLE products ADD COLUMN IF NOT EXISTS image_urls jsonb DEFAULT '[]'`,
    `ALTER TABLE products ADD COLUMN IF NOT EXISTS entity_type varchar`,
    `ALTER TABLE products ADD COLUMN IF NOT EXISTS entity_details jsonb`,
    `ALTER TABLE products ADD COLUMN IF NOT EXISTS farm_name varchar`,
    `ALTER TABLE products ADD COLUMN IF NOT EXISTS farm_district varchar`,
    `ALTER TABLE products ADD COLUMN IF NOT EXISTS farm_contact varchar`,
    `ALTER TABLE products ADD COLUMN IF NOT EXISTS unit varchar DEFAULT 'per piece'`,
    `ALTER TABLE products ADD COLUMN IF NOT EXISTS allows_delivery boolean DEFAULT false`,
    `ALTER TABLE products ADD COLUMN IF NOT EXISTS deposit_percent integer DEFAULT 0`,

    // Orders — fulfillment and deposit columns
    `ALTER TABLE orders ADD COLUMN IF NOT EXISTS fulfillment_type varchar`,
    `ALTER TABLE orders ADD COLUMN IF NOT EXISTS deposit_amount decimal(10,2)`,
    `ALTER TABLE orders ADD COLUMN IF NOT EXISTS remaining_balance decimal(10,2)`,
    `ALTER TABLE orders ADD COLUMN IF NOT EXISTS access_token varchar`,

    // Seller marketplace
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS is_seller boolean DEFAULT false`,
    `ALTER TABLE products ADD COLUMN IF NOT EXISTS seller_id varchar`,
    `CREATE TABLE IF NOT EXISTS sellers (
      id serial PRIMARY KEY,
      user_id varchar UNIQUE NOT NULL REFERENCES users(id),
      store_name varchar(255) NOT NULL,
      description text,
      logo_url varchar,
      phone varchar,
      address text,
      status varchar DEFAULT 'pending',
      commission_percent integer DEFAULT 10,
      created_at timestamp DEFAULT now(),
      updated_at timestamp DEFAULT now()
    )`,
    `ALTER TABLE sellers ADD COLUMN IF NOT EXISTS location varchar(255)`,
    `ALTER TABLE sellers ADD COLUMN IF NOT EXISTS year_founded integer`,
    `ALTER TABLE sellers ADD COLUMN IF NOT EXISTS response_time varchar(100)`,
    `ALTER TABLE sellers ADD COLUMN IF NOT EXISTS on_time_delivery_rate integer`,
    `ALTER TABLE sellers ADD COLUMN IF NOT EXISTS services text`,
    `ALTER TABLE sellers ADD COLUMN IF NOT EXISTS trading_hours varchar(255)`,

    // ERM marketplace bridge table
    `CREATE TABLE IF NOT EXISTS marketplace_product_map (
      id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      product_id integer NOT NULL UNIQUE,
      marketplace_id varchar(36) NOT NULL UNIQUE,
      farm_id varchar,
      entity_type varchar,
      last_synced_at timestamp DEFAULT now()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_mpm_marketplace_id ON marketplace_product_map(marketplace_id)`,

    // Order tracking
    `ALTER TABLE orders ADD COLUMN IF NOT EXISTS tracking_number varchar`,

    // Product social features
    `CREATE TABLE IF NOT EXISTS product_likes (
      id serial PRIMARY KEY,
      user_id varchar NOT NULL REFERENCES users(id),
      product_id integer NOT NULL REFERENCES products(id),
      created_at timestamp DEFAULT now(),
      UNIQUE(user_id, product_id)
    )`,
    `CREATE TABLE IF NOT EXISTS wishlist_items (
      id serial PRIMARY KEY,
      user_id varchar NOT NULL REFERENCES users(id),
      product_id integer NOT NULL REFERENCES products(id),
      created_at timestamp DEFAULT now(),
      UNIQUE(user_id, product_id)
    )`,
    `CREATE TABLE IF NOT EXISTS product_reviews (
      id serial PRIMARY KEY,
      user_id varchar NOT NULL REFERENCES users(id),
      product_id integer NOT NULL REFERENCES products(id),
      rating integer NOT NULL CHECK(rating >= 1 AND rating <= 5),
      title varchar(100),
      body text,
      verified_purchase boolean DEFAULT false,
      created_at timestamp DEFAULT now(),
      UNIQUE(user_id, product_id)
    )`,

    // In-app notifications
    `CREATE TABLE IF NOT EXISTS notifications (
      id serial PRIMARY KEY,
      user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type varchar NOT NULL,
      title varchar(200) NOT NULL,
      body text,
      link varchar,
      read boolean DEFAULT false,
      created_at timestamp DEFAULT now()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id)`,

    // Product Q&A
    `CREATE TABLE IF NOT EXISTS product_questions (
      id serial PRIMARY KEY,
      product_id integer NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      user_id varchar NOT NULL REFERENCES users(id),
      question text NOT NULL,
      answer text,
      answered_by varchar REFERENCES users(id),
      answered_at timestamp,
      created_at timestamp DEFAULT now()
    )`,

    // Payout requests
    `CREATE TABLE IF NOT EXISTS payout_requests (
      id serial PRIMARY KEY,
      seller_id integer NOT NULL REFERENCES sellers(id),
      amount decimal(10,2) NOT NULL,
      status varchar DEFAULT 'pending',
      note text,
      created_at timestamp DEFAULT now()
    )`,

    // Abandoned cart email log
    `CREATE TABLE IF NOT EXISTS abandoned_cart_logs (
      id serial PRIMARY KEY,
      user_id varchar NOT NULL UNIQUE REFERENCES users(id),
      sent_at timestamp DEFAULT now()
    )`,

    // Stock notifications
    `CREATE TABLE IF NOT EXISTS stock_notifications (
      id serial PRIMARY KEY,
      email varchar NOT NULL,
      product_id integer NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      notified boolean DEFAULT false,
      created_at timestamp DEFAULT now(),
      UNIQUE(email, product_id)
    )`,

    // Return / refund requests
    `CREATE TABLE IF NOT EXISTS return_requests (
      id serial PRIMARY KEY,
      order_id integer NOT NULL REFERENCES orders(id),
      user_id varchar NOT NULL REFERENCES users(id),
      reason text NOT NULL,
      status varchar DEFAULT 'pending',
      admin_note text,
      created_at timestamp DEFAULT now()
    )`,

    // Coupon / discount codes
    `CREATE TABLE IF NOT EXISTS coupons (
      id serial PRIMARY KEY,
      code varchar(50) NOT NULL UNIQUE,
      type varchar NOT NULL,
      value decimal(10,2) NOT NULL,
      min_order decimal(10,2) DEFAULT 0,
      max_uses integer,
      used_count integer DEFAULT 0,
      expires_at timestamp,
      active boolean DEFAULT true,
      created_at timestamp DEFAULT now()
    )`,

    // Coupon usage tracking (which order used which coupon)
    `ALTER TABLE orders ADD COLUMN IF NOT EXISTS coupon_code varchar`,
    `ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_amount decimal(10,2) DEFAULT 0`,

    // Kgotla marketplace bridge table
    `CREATE TABLE IF NOT EXISTS kgotla_product_map (
      id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      product_id integer NOT NULL UNIQUE,
      kgotla_item_id integer NOT NULL UNIQUE,
      kgotla_seller_id varchar,
      last_synced_at timestamp DEFAULT now()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_kpm_kgotla_item_id ON kgotla_product_map(kgotla_item_id)`,
  ];

  for (const statement of migrations) {
    try {
      await db.execute(sql.raw(statement));
      console.log(`[Migrate] OK: ${statement.slice(0, 60)}...`);
    } catch (err: any) {
      console.error(`[Migrate] Failed: ${statement.slice(0, 60)}... — ${err.message}`);
    }
  }

  console.log("[Migrate] Done.");
}

migrate().catch((err) => {
  console.error("[Migrate] Fatal error:", err);
  process.exit(1);
});
