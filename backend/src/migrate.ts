import { db } from "./db";
import { sql } from "drizzle-orm";

async function migrate() {
  console.log("[Migrate] Running database migrations...");

  const migrations = [
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
