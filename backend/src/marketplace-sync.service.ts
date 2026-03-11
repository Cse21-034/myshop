/**
 * ERM Marketplace Sync Service
 *
 * Fetches listings from the ERM public API and syncs them into the
 * e-commerce products table. The UUID→integer ID bridge lives in
 * the marketplace_product_map table so the rest of the e-commerce
 * codebase never needs to change.
 *
 * Flow:
 *   ERM API  ──fetch──►  syncMarketplaceProducts()
 *                              │
 *                    for each ERM listing
 *                              │
 *              ┌───────────────┴──────────────────┐
 *              │ already mapped?                  │ new listing
 *              ▼                                  ▼
 *       updateProduct()                  createProduct()
 *                                       insertMapping()
 */

import { db } from "./db";
import { storage } from "./storage";
import { products } from "./schema";
import { eq, sql } from "drizzle-orm";
import { pgTable, varchar, integer, timestamp, index } from "drizzle-orm/pg-core";

// ─── Mapping table (add this migration to your DB) ───────────────────────────
// Run once:
//   CREATE TABLE marketplace_product_map (
//     id            SERIAL PRIMARY KEY,
//     product_id    INTEGER NOT NULL UNIQUE REFERENCES products(id) ON DELETE CASCADE,
//     marketplace_id VARCHAR(36) NOT NULL UNIQUE,
//     farm_id        TEXT,
//     entity_type    TEXT,
//     last_synced_at TIMESTAMP DEFAULT NOW()
//   );

export const marketplaceProductMap = pgTable(
  "marketplace_product_map",
  {
    id:             integer("id").primaryKey().generatedAlwaysAsIdentity(),
    productId:      integer("product_id").notNull().unique(),
    marketplaceId:  varchar("marketplace_id", { length: 36 }).notNull().unique(),
    farmId:         varchar("farm_id"),
    entityType:     varchar("entity_type"),
    lastSyncedAt:   timestamp("last_synced_at").defaultNow(),
  },
  (t) => [index("idx_mpm_marketplace_id").on(t.marketplaceId)],
);

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ERMMarketplaceListing {
  id: string;            // UUID
  farm_id: string;
  entity_type: string;
  entity_id: string;
  title: string;
  description?: string;
  price: number;
  currency: string;
  image_url?: string;
  status: string;
  created_at: string;
  updated_at?: string;
}

export interface ERMPublicResponse {
  success: boolean;
  data: ERMMarketplaceListing[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasNext: boolean;
  };
}

// ─── Config ───────────────────────────────────────────────────────────────────

const ERM_BASE_URL =
  process.env.ERM_API_URL ?? "https://farm-management-api-6p6h.onrender.com";

const ERM_MARKETPLACE_ENDPOINT = `${ERM_BASE_URL}/api/v1/external/marketplace`;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Convert an ERM currency code to the slug expected by the e-commerce site.
 * Extend this map as needed.
 */
function currencyToCategory(currency: string, entityType: string): string {
  const entityMap: Record<string, string> = {
    livestock: "livestock",
    crop:      "crops",
    inventory: "farm-supplies",
  };
  return entityMap[entityType] ?? "marketplace";
}

/**
 * Build a URL-safe slug from a title + UUID fragment so it is always unique.
 */
function buildSlug(title: string, uuid: string): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
  return `${base}-${uuid.slice(0, 8)}`;
}

/**
 * Map ERM listing fields → e-commerce InsertProduct shape.
 */
function ermListingToProduct(listing: ERMMarketplaceListing) {
  return {
    name:         listing.title,
    slug:         buildSlug(listing.title, listing.id),
    description:  listing.description ?? "",
    price:        listing.price.toFixed(2),
    images:       listing.image_url ? [listing.image_url] : [],
    sizes:        [] as string[],
    colors:       [] as string[],
    stock:        listing.status === "active" ? 999 : 0,
    featured:     false,
    active:       listing.status === "active",
    status:       listing.status === "active" ? "active" : "inactive",
    // Store ERM UUID here so admins can see the source
    supplierUrl:  `${ERM_BASE_URL}/api/v1/external/marketplace/${listing.id}`,
  } as const;
}

// ─── Fetch helpers ────────────────────────────────────────────────────────────

async function fetchERMPage(
  offset: number,
  limit = 100,
): Promise<ERMPublicResponse> {
  const url = `${ERM_MARKETPLACE_ENDPOINT}?status=active&limit=${limit}&offset=${offset}`;
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    // 10-second timeout (Node 18+ AbortSignal)
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) {
    throw new Error(`ERM API returned ${res.status} for ${url}`);
  }

  return res.json() as Promise<ERMPublicResponse>;
}

/** Fetch ALL active ERM listings (handles pagination automatically). */
async function fetchAllERMListings(): Promise<ERMMarketplaceListing[]> {
  const all: ERMMarketplaceListing[] = [];
  let offset = 0;
  const limit = 100;

  while (true) {
    const page = await fetchERMPage(offset, limit);
    if (!page.success || !page.data?.length) break;

    all.push(...page.data);

    if (!page.pagination.hasNext) break;
    offset += limit;
  }

  return all;
}

// ─── Main sync function ───────────────────────────────────────────────────────

/**
 * Pull all active listings from ERM and upsert them into the e-commerce DB.
 *
 * Returns a summary of what changed.
 */
export async function syncMarketplaceProducts(): Promise<{
  created: number;
  updated: number;
  deactivated: number;
  errors: string[];
}> {
  const summary = { created: 0, updated: 0, deactivated: 0, errors: [] as string[] };

  // 1. Fetch all active ERM listings
  let ermListings: ERMMarketplaceListing[];
  try {
    ermListings = await fetchAllERMListings();
  } catch (err: any) {
    summary.errors.push(`Failed to fetch ERM listings: ${err.message}`);
    return summary;
  }

  console.log(`[ERM Sync] Fetched ${ermListings.length} active listings`);

  // 2. Load existing mappings (marketplace_id → product_id)
  const existingMaps = await db.select().from(marketplaceProductMap);
  const mapByMarketplaceId = new Map(
    existingMaps.map((m) => [m.marketplaceId, m]),
  );
  const activeERMIds = new Set(ermListings.map((l) => l.id));

  // 3. Deactivate products whose ERM listing is no longer active
  for (const mapping of existingMaps) {
    if (!activeERMIds.has(mapping.marketplaceId)) {
      try {
        await storage.updateProduct(mapping.productId, {
          active: false,
          status: "inactive",
        });
        summary.deactivated++;
      } catch (err: any) {
        summary.errors.push(
          `Deactivate product ${mapping.productId}: ${err.message}`,
        );
      }
    }
  }

  // 4. Create or update products
  for (const listing of ermListings) {
    try {
      const productData = ermListingToProduct(listing);
      const existing = mapByMarketplaceId.get(listing.id);

      if (existing) {
        // Update existing product (price/stock/status may have changed)
        await storage.updateProduct(existing.productId, {
          name:        productData.name,
          description: productData.description,
          price:       productData.price,
          images:      productData.images as string[],
          stock:       productData.stock,
          active:      productData.active,
          status:      productData.status,
          supplierUrl: productData.supplierUrl,
        });

        // Refresh sync timestamp
        await db
          .update(marketplaceProductMap)
          .set({ lastSyncedAt: new Date() })
          .where(eq(marketplaceProductMap.marketplaceId, listing.id));

        summary.updated++;
      } else {
        // Create new product
        const newProduct = await storage.createProduct(productData as any);

        // Record the UUID → integer mapping
        await db.insert(marketplaceProductMap).values({
          productId:     newProduct.id,
          marketplaceId: listing.id,
          farmId:        listing.farm_id,
          entityType:    listing.entity_type,
          lastSyncedAt:  new Date(),
        });

        summary.created++;
      }
    } catch (err: any) {
      summary.errors.push(`Listing ${listing.id}: ${err.message}`);
    }
  }

  console.log(
    `[ERM Sync] Done — created: ${summary.created}, updated: ${summary.updated}, ` +
    `deactivated: ${summary.deactivated}, errors: ${summary.errors.length}`,
  );

  return summary;
}

// ─── Lookup helper used by order notification ─────────────────────────────────

/**
 * Given an e-commerce integer product ID, return the ERM marketplace UUID.
 * Returns null if the product was not imported from ERM.
 */
export async function getERMIdForProduct(
  productId: number,
): Promise<{ marketplaceId: string; farmId: string | null } | null> {
  const [row] = await db
    .select()
    .from(marketplaceProductMap)
    .where(eq(marketplaceProductMap.productId, productId));

  return row
    ? { marketplaceId: row.marketplaceId, farmId: row.farmId ?? null }
    : null;
}
