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

// ─── Entity detail types ──────────────────────────────────────────────────────

export interface ERMEntityDetailsLivestock {
  species: string;
  breed: string | null;
  gender: string | null;
  ageMonths: number | null;
  weightKg: number | null;
  euStatus: string | null;
  healthStatus: string | null;
  lastHealthCheck: string | null;
  vaccinationsUpToDate: boolean | null;
  holdingNumber: string | null;
  veterinaryZone: string | null;
  tagNumber: string | null;
}

export interface ERMEntityDetailsCrop {
  cropType: string;
  variety: string | null;
  harvestDate: string | null;
  qualityGrade: string | null;
  unitDescription: string | null;
  fieldDistrict: string | null;
}

export interface ERMEntityDetailsPoultry {
  poultryType: string;        // "Broiler" | "Layer"
  breed: string | null;
  productType: string;        // "live_birds" | "eggs"
  averageWeightKg: number | null;
  eggsPerTray: number | null;
  batchCode: string | null;
}

export interface ERMEntityDetailsInventory {
  sku: string | null;
  condition: string | null;
  expiryDate: string | null;
  storageLocation: string | null;
}

export type ERMEntityDetails =
  | ERMEntityDetailsLivestock
  | ERMEntityDetailsCrop
  | ERMEntityDetailsPoultry
  | ERMEntityDetailsInventory;

// ─── Main listing type ────────────────────────────────────────────────────────

export interface ERMMarketplaceListing {
  id:             string;
  farmId:         string;
  farmName:       string | null;
  farmDistrict:   string | null;
  farmContact:    string | null;
  entityType:     string;   // "livestock" | "crop" | "poultry" | "inventory"
  entityId:       string;
  title:          string;
  description?:   string;
  price:          number;
  currency:       string;
  imageUrl?:      string;
  imageUrls?:     string[];
  quantity:       number | null;
  unit:           string | null;
  allowsDelivery: boolean | null;
  depositPercent: number | null;
  status:         string;
  createdAt:      string;
  updatedAt?:     string;
  entityDetails:  ERMEntityDetails | null;
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
  poultry: {
    name:        "Poultry",
    slug:        "poultry",
    description: "Poultry birds and eggs",
  },
  inventory: {
    name:        "Farm Supplies",
    slug:        "farm-supplies",
    description: "Farm equipment and supply items",
  },
};

const categoryCache = new Map<string, number>();

async function getOrCreateCategoryId(entityType: string): Promise<number> {
  const def = ENTITY_TYPE_CATEGORY[entityType];

  if (!def) {
    console.warn(`[ERM Sync] Unknown entityType "${entityType}" — falling back to farm-supplies`);
    return getOrCreateCategoryId("inventory");
  }

  if (categoryCache.has(def.slug)) return categoryCache.get(def.slug)!;

  const [existing] = await db.select().from(categories).where(eq(categories.slug, def.slug));

  if (existing) {
    categoryCache.set(def.slug, existing.id);
    return existing.id;
  }

  const [created] = await db
    .insert(categories)
    .values({ name: def.name, slug: def.slug, description: def.description, imageUrl: null })
    .returning();

  console.log(`[ERM Sync] Created category "${def.name}" (id=${created.id})`);
  categoryCache.set(def.slug, created.id);
  return created.id;
}

// ─── Image helpers ────────────────────────────────────────────────────────────

function isValidUrl(url: string): boolean {
  try {
    const p = new URL(url.trim());
    return p.protocol === "http:" || p.protocol === "https:";
  } catch {
    return false;
  }
}

function buildImagesArray(listing: ERMMarketplaceListing): string[] {
  // Prefer imageUrls array from ERM (up to 10 images)
  if (listing.imageUrls && listing.imageUrls.length > 0) {
    return listing.imageUrls.filter(u => u && isValidUrl(u));
  }
  // Fall back to single imageUrl
  if (listing.imageUrl && isValidUrl(listing.imageUrl)) {
    return [listing.imageUrl.trim()];
  }
  return [];
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

// ─── Stock helper ─────────────────────────────────────────────────────────────

function resolveStock(listing: ERMMarketplaceListing): number {
  if (listing.quantity === null || listing.quantity === undefined) return 1;
  return Math.max(0, listing.quantity);
}

// ─── Fetch helpers ────────────────────────────────────────────────────────────

async function fetchERMPage(offset: number, limit = 100): Promise<ERMPublicResponse> {
  const url = `${ERM_MARKETPLACE_ENDPOINT}?status=active&limit=${limit}&offset=${offset}`;
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`ERM API returned ${res.status} for ${url}`);
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

  categoryCache.clear();

  let ermListings: ERMMarketplaceListing[];
  try {
    ermListings = await fetchAllERMListings();
  } catch (err: any) {
    summary.errors.push(`Failed to fetch ERM listings: ${err.message}`);
    return summary;
  }

  console.log(`[ERM Sync] Fetched ${ermListings.length} active listings from ERM`);

  const existingMaps = await db.select().from(marketplaceProductMap);
  const mapByMarketplaceId = new Map(existingMaps.map((m) => [m.marketplaceId, m]));
  const activeERMIds = new Set(ermListings.map((l) => l.id));

  // Deactivate products whose ERM listing is gone
  for (const mapping of existingMaps) {
    if (!activeERMIds.has(mapping.marketplaceId)) {
      try {
        await storage.updateProduct(mapping.productId, { active: false, status: "inactive" });
        summary.deactivated++;
      } catch (err: any) {
        summary.errors.push(`Deactivate product ${mapping.productId}: ${err.message}`);
      }
    }
  }

  // Create or update products
  for (const listing of ermListings) {
    try {
      const categoryId = await getOrCreateCategoryId(listing.entityType);
      const images = buildImagesArray(listing);
      const stock = resolveStock(listing);

      const productData = {
        name:          listing.title,
        slug:          buildSlug(listing.title, listing.id),
        description:   listing.description ?? "",
        price:         listing.price.toFixed(2),
        categoryId,
        images,
        imageUrls:     images,
        sizes:         [] as string[],
        colors:        [] as string[],
        stock:         listing.status === "active" ? stock : 0,
        featured:      false,
        active:        listing.status === "active",
        status:        listing.status === "active" ? "active" : "inactive",
        supplierUrl:   `${ERM_MARKETPLACE_ENDPOINT}/${listing.id}`,
        // Farm fields
        entityType:    listing.entityType,
        entityDetails: listing.entityDetails ?? null,
        farmName:      listing.farmName ?? null,
        farmDistrict:  listing.farmDistrict ?? null,
        farmContact:   listing.farmContact ?? null,
        unit:          listing.unit ?? "per piece",
        allowsDelivery: listing.allowsDelivery ?? false,
        depositPercent: listing.depositPercent ?? 0,
      };

      const existing = mapByMarketplaceId.get(listing.id);

      if (existing) {
        await storage.updateProduct(existing.productId, {
          name:          productData.name,
          description:   productData.description,
          price:         productData.price,
          categoryId:    productData.categoryId,
          images:        productData.images,
          imageUrls:     productData.imageUrls,
          stock:         productData.stock,
          active:        productData.active,
          status:        productData.status,
          supplierUrl:   productData.supplierUrl,
          entityType:    productData.entityType,
          entityDetails: productData.entityDetails,
          farmName:      productData.farmName,
          farmDistrict:  productData.farmDistrict,
          farmContact:   productData.farmContact,
          unit:          productData.unit,
          allowsDelivery: productData.allowsDelivery,
          depositPercent: productData.depositPercent,
        });

        await db
          .update(marketplaceProductMap)
          .set({ lastSyncedAt: new Date() })
          .where(eq(marketplaceProductMap.marketplaceId, listing.id));

        summary.updated++;
        console.log(`[ERM Sync] Updated product id=${existing.productId} "${listing.title}" [${listing.entityType}]`);
      } else {
        const newProduct = await storage.createProduct(productData as any);

        await db.insert(marketplaceProductMap).values({
          productId:     newProduct.id,
          marketplaceId: listing.id,
          farmId:        listing.farmId,
          entityType:    listing.entityType,
          lastSyncedAt:  new Date(),
        });

        summary.created++;
        console.log(`[ERM Sync] Created product id=${newProduct.id} "${listing.title}" [${listing.entityType}]`);
      }
    } catch (err: any) {
      summary.errors.push(`Listing ${listing.id} ("${listing.title}"): ${err.message}`);
      console.error(`[ERM Sync] Error processing listing ${listing.id}:`, err.message);
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

  return row ? { marketplaceId: row.marketplaceId, farmId: row.farmId ?? null } : null;
}
