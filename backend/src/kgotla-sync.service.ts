import { db } from "./db";
import { storage } from "./storage";
import { categories } from "./schema";
import { eq } from "drizzle-orm";
import { pgTable, varchar, integer, timestamp, index } from "drizzle-orm/pg-core";

// ─── Drizzle table for Kgotla item ID → Myshop product ID bridge ─────────────

export const kgotlaProductMap = pgTable(
  "kgotla_product_map",
  {
    id:             integer("id").primaryKey().generatedAlwaysAsIdentity(),
    productId:      integer("product_id").notNull().unique(),
    kgotlaItemId:   integer("kgotla_item_id").notNull().unique(),
    kgotlaSellerId: varchar("kgotla_seller_id"),
    lastSyncedAt:   timestamp("last_synced_at").defaultNow(),
  },
  (t) => [index("idx_kpm_kgotla_item_id").on(t.kgotlaItemId)],
);

// ─── Config ───────────────────────────────────────────────────────────────────

const KGOTLA_BASE_URL =
  process.env.KGOTLA_API_URL ?? "https://kgotla-backend.onrender.com";

const KGOTLA_MARKETPLACE_ENDPOINT = `${KGOTLA_BASE_URL}/api/marketplace`;

// ─── Types ────────────────────────────────────────────────────────────────────

interface KgotlaSeller {
  id:      string;
  name:    string;
  avatar:  string | null;
  rating:  number;
  reviews: number;
}

interface KgotlaListing {
  id:          number;
  title:       string;
  description: string;
  price:       number;    // Major units (e.g. 150 = P150)
  currency:    string;    // "BWP" | "ZAR" | "USD"
  images:      string[];  // base64-encoded strings
  category:    string;
  location:    string;
  isActive:    boolean;
  sellerId:    string;
  seller:      KgotlaSeller;
  featured:    boolean;
  isSponsored: boolean;
  updatedAt:   string;
  createdAt:   string;
}

// ─── Category map ─────────────────────────────────────────────────────────────

const KGOTLA_CATEGORY_MAP: Record<string, { name: string; slug: string; description: string }> = {
  "Traditional Crafts":   { name: "Traditional Crafts",   slug: "traditional-crafts",   description: "Handmade traditional crafts and artefacts" },
  "Food & Produce":       { name: "Food & Produce",        slug: "food-produce",          description: "Fresh food, groceries and farm produce" },
  "Livestock":            { name: "Livestock",             slug: "livestock",             description: "Farm animals for sale" },
  "Traditional Clothing": { name: "Traditional Clothing",  slug: "traditional-clothing",  description: "Traditional attire and clothing" },
  "Cultural Items":       { name: "Cultural Items",        slug: "cultural-items",        description: "Cultural and heritage items" },
  "Services":             { name: "Services",              slug: "services",              description: "Local professional services" },
  "Home & Living":        { name: "Home & Living",         slug: "home-living",           description: "Home décor and living products" },
  "Electronics & Phones": { name: "Electronics & Phones",  slug: "electronics-phones",    description: "Electronics, phones and accessories" },
  "Other":                { name: "Other",                 slug: "other",                 description: "Miscellaneous items" },
};

const KGOTLA_DEFAULT_CATEGORY = KGOTLA_CATEGORY_MAP["Other"];

const categoryCache = new Map<string, number>();

async function getOrCreateKgotlaCategoryId(kgotlaCategory: string): Promise<number> {
  const def = KGOTLA_CATEGORY_MAP[kgotlaCategory] ?? KGOTLA_DEFAULT_CATEGORY;

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

  console.log(`[Kgotla Sync] Created category "${def.name}" (id=${created.id})`);
  categoryCache.set(def.slug, created.id);
  return created.id;
}

// ─── Price conversion (major units → USD) ─────────────────────────────────────

function convertToUSD(price: number, currency: string): number {
  switch (currency.toUpperCase()) {
    case "BWP": return price / 13.5;
    case "ZAR": return price / 18.5;
    default:    return price;
  }
}

// ─── Cloudinary upload ────────────────────────────────────────────────────────

async function uploadBase64ToCloudinary(base64: string): Promise<string | null> {
  const cloudName    = process.env.CLOUDINARY_CLOUD_NAME;
  const uploadPreset = process.env.CLOUDINARY_UPLOAD_PRESET;
  if (!cloudName || !uploadPreset) return null;

  const dataUrl = base64.startsWith("data:") ? base64 : `data:image/jpeg;base64,${base64}`;

  const body = new URLSearchParams();
  body.append("file", dataUrl);
  body.append("upload_preset", uploadPreset);
  body.append("folder", "kgotla");
  body.append("use_filename", "false");  // prevent Cloudinary parsing the data URL as a filename

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
    { method: "POST", body, signal: AbortSignal.timeout(20_000) },
  );

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Cloudinary upload failed (${res.status}): ${errText.slice(0, 200)}`);
  }

  const data = await res.json() as { secure_url: string };
  return data.secure_url;
}

async function uploadImages(base64Array: string[]): Promise<string[]> {
  if (!base64Array.length) return [];

  if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_UPLOAD_PRESET) {
    console.warn("[Kgotla Sync] Cloudinary not configured — skipping image upload");
    return [];
  }

  const urls: string[] = [];
  for (const b64 of base64Array.slice(0, 4)) {
    try {
      const url = await uploadBase64ToCloudinary(b64);
      if (url) urls.push(url);
    } catch (err: any) {
      console.warn(`[Kgotla Sync] Image upload skipped: ${err.message}`);
    }
  }
  return urls;
}

// ─── Slug builder ─────────────────────────────────────────────────────────────

function buildSlug(title: string, id: number): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
  return `${base}-k${id}`;
}

// ─── Fetch all active listings ────────────────────────────────────────────────

async function fetchAllKgotlaListings(): Promise<KgotlaListing[]> {
  const res = await fetch(KGOTLA_MARKETPLACE_ENDPOINT, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`Kgotla API returned ${res.status}`);
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

// ─── Main sync function ───────────────────────────────────────────────────────

export async function syncKgotlaProducts(): Promise<{
  created:     number;
  updated:     number;
  deactivated: number;
  errors:      string[];
}> {
  const summary = { created: 0, updated: 0, deactivated: 0, errors: [] as string[] };

  categoryCache.clear();

  let listings: KgotlaListing[];
  try {
    listings = await fetchAllKgotlaListings();
  } catch (err: any) {
    summary.errors.push(`Failed to fetch Kgotla listings: ${err.message}`);
    return summary;
  }

  const activeListings = listings.filter((l) => l.isActive !== false);
  console.log(`[Kgotla Sync] Fetched ${activeListings.length} active listings`);

  const existingMaps = await db.select().from(kgotlaProductMap);
  const mapByKgotlaId = new Map(existingMaps.map((m) => [m.kgotlaItemId, m]));
  const activeIds = new Set(activeListings.map((l) => l.id));

  // Deactivate products whose Kgotla listing is gone
  for (const mapping of existingMaps) {
    if (!activeIds.has(mapping.kgotlaItemId)) {
      try {
        await storage.updateProduct(mapping.productId, { active: false, status: "inactive" });
        summary.deactivated++;
      } catch (err: any) {
        summary.errors.push(`Deactivate product ${mapping.productId}: ${err.message}`);
      }
    }
  }

  // Create or update products
  for (const listing of activeListings) {
    try {
      const categoryId = await getOrCreateKgotlaCategoryId(listing.category);
      const usdPrice   = convertToUSD(listing.price, listing.currency);
      const images     = await uploadImages(listing.images ?? []);

      const entityDetails = {
        sellerId:         listing.sellerId,
        sellerName:       listing.seller?.name ?? "",
        sellerAvatar:     listing.seller?.avatar ?? null,
        sellerRating:     listing.seller?.rating ?? 0,
        sellerReviews:    listing.seller?.reviews ?? 0,
        location:         listing.location,
        kgotlaCategory:   listing.category,
        originalCurrency: listing.currency,
        originalPrice:    listing.price,
      };

      const existing = mapByKgotlaId.get(listing.id);

      if (existing) {
        await storage.updateProduct(existing.productId, {
          name:          listing.title,
          description:   listing.description ?? "",
          price:         usdPrice.toFixed(2),
          categoryId,
          ...(images.length > 0 && { images, imageUrls: images }),
          featured:      listing.featured ?? false,
          active:        true,
          status:        "active",
          entityDetails,
        });

        await db
          .update(kgotlaProductMap)
          .set({ lastSyncedAt: new Date() })
          .where(eq(kgotlaProductMap.kgotlaItemId, listing.id));

        summary.updated++;
      } else {
        const productData = {
          name:           listing.title,
          slug:           buildSlug(listing.title, listing.id),
          description:    listing.description ?? "",
          price:          usdPrice.toFixed(2),
          categoryId,
          images,
          imageUrls:      images,
          sizes:          [] as string[],
          colors:         [] as string[],
          stock:          1,
          featured:       listing.featured ?? false,
          active:         true,
          status:         "active" as const,
          entityType:     "kgotla",
          entityDetails,
          unit:           "per item",
          allowsDelivery: false,
          depositPercent: 0,
        };

        const newProduct = await storage.createProduct(productData as any);

        await db.insert(kgotlaProductMap).values({
          productId:      newProduct.id,
          kgotlaItemId:   listing.id,
          kgotlaSellerId: listing.sellerId,
          lastSyncedAt:   new Date(),
        });

        summary.created++;
        console.log(`[Kgotla Sync] Created product id=${newProduct.id} "${listing.title}"`);
      }
    } catch (err: any) {
      summary.errors.push(`Listing ${listing.id} ("${listing.title}"): ${err.message}`);
      console.error(`[Kgotla Sync] Error processing listing ${listing.id}:`, err.message);
    }
  }

  console.log(
    `[Kgotla Sync] Done — created: ${summary.created}, updated: ${summary.updated}, ` +
    `deactivated: ${summary.deactivated}, errors: ${summary.errors.length}`,
  );

  return summary;
}

// ─── Lookup helper used by order notification ─────────────────────────────────

export async function getKgotlaIdForProduct(
  productId: number,
): Promise<{ kgotlaItemId: number; kgotlaSellerId: string | null } | null> {
  const [row] = await db
    .select()
    .from(kgotlaProductMap)
    .where(eq(kgotlaProductMap.productId, productId));

  return row
    ? { kgotlaItemId: row.kgotlaItemId, kgotlaSellerId: row.kgotlaSellerId ?? null }
    : null;
}
