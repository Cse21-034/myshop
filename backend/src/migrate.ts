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
