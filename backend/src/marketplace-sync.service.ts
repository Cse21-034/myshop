/**
 * ERM Marketplace Sync Service
 *
 * Fixes applied vs previous version:
 *  1. IMAGE URL  — ERM sends image_url as a plain string. This file now
 *                  validates it is a real URL before wrapping it in an array,
 *                  so images[] is never empty when a URL exists.
 *
 *  2. CATEGORIES — ERM entity_type (livestock / crop / inventory) is mapped to
 *                  a category in the e-commerce categories table.
 *                  If the category doesn't exist yet it is created automatically.
 *                  The resulting integer category_id is then set on the product.
 */

import { db } from "./db";
import { storage } from "./storage";
import { categories, products } from "./schema";
import { eq, sql } from "drizzle-orm";
import { pgTable, varchar, integer, timestamp, index } from "drizzle-orm/pg-core";

// ─── Drizzle table for the UUID → integer ID bridge ──────────────────────────
export const marketplaceProductMap = pgTable(
  "marketplace_product_map",
  {
    id:            integer("id").primaryKey().generatedAlwaysAsIdentity(),
    productId:     integer("product_id").notNull().unique(),
    marketplaceId: varchar("marketplace_id", { length: 36 }).notNull().unique(),
    farmId:        varchar("farm_id"),
    entityType:    varchar("entity_type"),
    lastSyncedAt:  timestamp("last_synced_at").defaultNow(),
  },
  (t) => [index("idx_mpm_marketplace_id").on(t.marketplaceId)],
);

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ERMMarketplaceListing {
  id:          string;   // UUID
  farmId:      string;   // camelCase — actual ERM API field name
  entityType:  string;   // "livestock" | "crop" | "inventory"
  entityId:    string;
  title:       string;
  description?: string;
  price:       number;
  currency:    string;
  imageUrl?:   string;   // camelCase — actual ERM API field name
  quantity?:   number;
  status:      string;
  createdAt:   string;
  updatedAt?:  string;
}

export interface ERMPublicResponse {
  success: boolean;
  data: ERMMarketplaceListing[];
  pagination: {
    total:   number;
    limit:   number;
    offset:  number;
    hasNext: boolean;
  };
}

// ─── Config ───────────────────────────────────────────────────────────────────

const ERM_BASE_URL =
  process.env.ERM_API_URL ?? "https://farm-management-api-6p6h.onrender.com";

const ERM_MARKETPLACE_ENDPOINT = `${ERM_BASE_URL}/api/v1/external/marketplace`;

// ─── Category map ─────────────────────────────────────────────────────────────
//
// Maps ERM entityType → { name, slug } for the e-commerce categories table.
// Only 3 valid entity types exist in ERM: livestock, crop, inventory.
//
const ENTITY_TYPE_CATEGORY: Record<string, { name: string; slug: string; description: string }> = {
  livestock: {
    name:        "Livestock",
    slug:        "livestock",
    description: "Farm animals available for sale",
  },
  crop: {
    name:        "Crops",
    slug:        "crops",
    description: "Agricultural produce and harvests",
  },
  inventory: {
    name:        "Farm Supplies",
    slug:        "farm-supplies",
    description: "Farm equipment and supply items",
  },
};

// ─── In-memory category cache (slug → integer id) ─────────────────────────────
// Avoids hitting the DB on every product during a sync run.
const categoryCache = new Map<string, number>();

/**
 * Look up or create an e-commerce category for the given ERM entity_type.
 * Returns the integer category id.
 */
async function getOrCreateCategoryId(entityType: string): Promise<number> {
  const def = ENTITY_TYPE_CATEGORY[entityType];

  if (!def) {
    // Should never happen — ERM only has livestock, crop, inventory
    console.warn(
      `[ERM Sync] ⚠️  Unknown entityType "${entityType}" — skipping category assignment`,
    );
    // Use livestock as a safe fallback rather than creating a junk category
    return getOrCreateCategoryId("livestock");
  }

  // Return from cache if we already resolved this slug
  if (categoryCache.has(def.slug)) {
    return categoryCache.get(def.slug)!;
  }

  // Try to find existing category by slug
  const [existing] = await db
    .select()
    .from(categories)
    .where(eq(categories.slug, def.slug));

  if (existing) {
    categoryCache.set(def.slug, existing.id);
    return existing.id;
  }

  // Category doesn't exist yet — create it
  const [created] = await db
    .insert(categories)
    .values({
      name:        def.name,
      slug:        def.slug,
      description: def.description,
      imageUrl:    null,
    })
    .returning();

  console.log(`[ERM Sync] ✅ Created category "${def.name}" (id=${created.id})`);
  categoryCache.set(def.slug, created.id);
  return created.id;
}

// ─── Image URL helper ─────────────────────────────────────────────────────────

/**
 * ERM sends image_url as a plain string (or null/undefined).
 * The e-commerce products.images column is a string[] (jsonb array).
 *
 * This function:
 *  - Returns [] if image_url is missing or blank
 *  - Validates the string is a real URL before wrapping it
 *  - Returns [image_url] if valid
 */
function buildImagesArray(imageUrl?: string | null): string[] {
  if (!imageUrl || imageUrl.trim() === "") return [];

  try {
    const parsed = new URL(imageUrl.trim());
    // Only allow http/https URLs
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return [];
    return [imageUrl.trim()];
  } catch {
    console.warn(`[ERM Sync] ⚠️  Skipping invalid image URL: ${imageUrl}`);
    return [];
  }
}

// ─── Slug builder ─────────────────────────────────────────────────────────────

function buildSlug(title: string, uuid: string): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
  return `${base}-${uuid.slice(0, 8)}`;
}

// ─── Fetch helpers ────────────────────────────────────────────────────────────

async function fetchERMPage(offset: number, limit = 100): Promise<ERMPublicResponse> {
  const url = `${ERM_MARKETPLACE_ENDPOINT}?status=active&limit=${limit}&offset=${offset}`;
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) {
    throw new Error(`ERM API returned ${res.status} for ${url}`);
  }

  return res.json() as Promise<ERMPublicResponse>;
}

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

export async function syncMarketplaceProducts(): Promise<{
  created:     number;
  updated:     number;
  deactivated: number;
  errors:      string[];
}> {
  const summary = { created: 0, updated: 0, deactivated: 0, errors: [] as string[] };

  // Clear category cache at start of each sync so stale data is not used
  categoryCache.clear();

  // 1. Fetch all active ERM listings
  let ermListings: ERMMarketplaceListing[];
  try {
    ermListings = await fetchAllERMListings();
  } catch (err: any) {
    summary.errors.push(`Failed to fetch ERM listings: ${err.message}`);
    return summary;
  }

  console.log(`[ERM Sync] Fetched ${ermListings.length} active listings from ERM`);

  // 2. Load existing mappings
  const existingMaps = await db.select().from(marketplaceProductMap);
  const mapByMarketplaceId = new Map(existingMaps.map((m) => [m.marketplaceId, m]));
  const activeERMIds = new Set(ermListings.map((l) => l.id));

  // 3. Deactivate products whose ERM listing is gone
  for (const mapping of existingMaps) {
    if (!activeERMIds.has(mapping.marketplaceId)) {
      try {
        await storage.updateProduct(mapping.productId, {
          active: false,
          status: "inactive",
        });
        summary.deactivated++;
      } catch (err: any) {
        summary.errors.push(`Deactivate product ${mapping.productId}: ${err.message}`);
      }
    }
  }

  // 4. Create or update products
  for (const listing of ermListings) {
    try {
      // ── FIX 1: Resolve category id from entity_type ──────────────────────
      const categoryId = await getOrCreateCategoryId(listing.entityType);

      // ── FIX 2: Build images array from single imageUrl string ─────────────
      const images = buildImagesArray(listing.imageUrl);

      const productData = {
        name:        listing.title,
        slug:        buildSlug(listing.title, listing.id),
        description: listing.description ?? "",
        price:       listing.price.toFixed(2),
        categoryId,          // ← integer, properly set now
        images,              // ← string[], properly set now
        sizes:       [] as string[],
        colors:      [] as string[],
        // Use quantity from ERM if provided, otherwise default to 1.
        // Never use 999 — a farmer listing 1 cow has stock of 1, not 999.
        stock:       listing.status === "active" ? (listing.quantity ?? 1) : 0,
        featured:    false,
        active:      listing.status === "active",
        status:      listing.status === "active" ? "active" : "inactive",
        supplierUrl: `${ERM_BASE_URL}/api/v1/external/marketplace/${listing.id}`,
      };

      const existing = mapByMarketplaceId.get(listing.id);

      if (existing) {
        // Update — refresh price, images, stock, category
        await storage.updateProduct(existing.productId, {
          name:        productData.name,
          description: productData.description,
          price:       productData.price,
          categoryId:  productData.categoryId,
          images:      productData.images,
          stock:       productData.stock,
          active:      productData.active,
          status:      productData.status,
          supplierUrl: productData.supplierUrl,
        });

        await db
          .update(marketplaceProductMap)
          .set({ lastSyncedAt: new Date() })
          .where(eq(marketplaceProductMap.marketplaceId, listing.id));

        summary.updated++;

        console.log(
          `[ERM Sync] ↻  Updated product id=${existing.productId} ` +
          `"${listing.title}" | images=${productData.images.length} | categoryId=${categoryId}`,
        );
      } else {
        // Create new product
        const newProduct = await storage.createProduct(productData as any);

        await db.insert(marketplaceProductMap).values({
          productId:     newProduct.id,
          marketplaceId: listing.id,
          farmId:        listing.farmId,
          entityType:    listing.entityType,
          lastSyncedAt:  new Date(),
        });

        summary.created++;

        console.log(
          `[ERM Sync] ＋ Created product id=${newProduct.id} ` +
          `"${listing.title}" | images=${productData.images.length} | categoryId=${categoryId}`,
        );
      }
    } catch (err: any) {
      summary.errors.push(`Listing ${listing.id} ("${listing.title}"): ${err.message}`);
      console.error(`[ERM Sync] ❌ Error processing listing ${listing.id}:`, err.message);
    }
  }

  console.log(
    `[ERM Sync] Done — created: ${summary.created}, updated: ${summary.updated}, ` +
    `deactivated: ${summary.deactivated}, errors: ${summary.errors.length}`,
  );

  return summary;
}

// ─── Lookup helper used by order notification ─────────────────────────────────

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
