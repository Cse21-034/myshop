/**
 * ERM Order Notification Service
 *
 * After a customer places an order on the e-commerce site, this service:
 *  1. Identifies which items in the order came from the ERM marketplace.
 *  2. Sends an order notification to the ERM API for each such item.
 *  3. Optionally marks those listings as "sold" on ERM if stock hits 0.
 *
 * The ERM "external order" endpoint does NOT exist yet in your ERM codebase,
 * so this file also contains the spec you need to implement on the ERM side
 * (see `ERM_ORDER_ENDPOINT` and the payload shape below).
 */

import { getERMIdForProduct } from "./marketplace-sync.service";
import type { Order, OrderItem } from "./schema";

// ─── Config ───────────────────────────────────────────────────────────────────

const ERM_BASE_URL =
  process.env.ERM_API_URL ?? "https://farm-management-api-6p6h.onrender.com";

/**
 * ERM endpoint to receive order notifications.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │  YOU NEED TO ADD THIS ROUTE TO YOUR ERM routes file:                    │
 * │                                                                          │
 * │  POST /api/v1/external/marketplace/orders                                │
 * │                                                                          │
 * │  Body: {                                                                 │
 * │    ecommerce_order_id : number,                                          │
 * │    marketplace_id     : string,   // UUID of the listing                 │
 * │    farm_id            : string,                                          │
 * │    quantity           : number,                                          │
 * │    unit_price         : number,                                          │
 * │    currency           : string,                                          │
 * │    buyer_name         : string,                                          │
 * │    buyer_email        : string,                                          │
 * │    buyer_phone        : string,                                          │
 * │    shipping_address   : string,                                          │
 * │    payment_method     : string,                                          │
 * │    ordered_at         : string,   // ISO timestamp                       │
 * │  }                                                                       │
 * │                                                                          │
 * │  The route should:                                                       │
 * │   - Record the order in an `external_orders` table                       │
 * │   - Optionally update listing status to "sold" if qty exhausted          │
 * │   - Return { success: true, external_order_id: "..." }                   │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
const ERM_ORDER_ENDPOINT = `${ERM_BASE_URL}/api/v1/external/marketplace/orders`;

// Shared secret so ERM can verify the request came from your e-commerce site
const ERM_WEBHOOK_SECRET = process.env.ERM_WEBHOOK_SECRET ?? "";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ERMOrderPayload {
  ecommerce_order_id: number;
  marketplace_id:     string;
  farm_id:            string | null;
  quantity:           number;
  unit_price:         number;
  currency:           string;
  buyer_name:         string;
  buyer_email:        string;
  buyer_phone:        string;
  shipping_address:   string;
  payment_method:     string;
  ordered_at:         string;
}

// ─── Core function ────────────────────────────────────────────────────────────

/**
 * Called from routes.ts after `storage.createOrder()` succeeds.
 *
 * @param order   The newly created order (from e-commerce DB).
 * @param items   The order line items (productId, quantity, productPrice …).
 */
export async function notifyERMOfOrder(
  order: Order & { items?: OrderItem[] },
  items: OrderItem[],
): Promise<void> {
  // Skip if ERM notifications are disabled
  if (process.env.ERM_NOTIFY_ORDERS !== "true") {
    console.log("[ERM Notify] Skipped (ERM_NOTIFY_ORDERS not set to 'true')");
    return;
  }

  const shippingAddress = [
    order.address,
    order.city,
    order.state,
    order.zipCode,
  ]
    .filter(Boolean)
    .join(", ");

  const notifications: Promise<void>[] = items.map(async (item) => {
    if (!item.productId) return;

    // Check if this product came from ERM
    const ermRef = await getERMIdForProduct(item.productId);
    if (!ermRef) return; // locally-managed product, nothing to notify

    const payload: ERMOrderPayload = {
      ecommerce_order_id: order.id,
      marketplace_id:     ermRef.marketplaceId,
      farm_id:            ermRef.farmId,
      quantity:           item.quantity,
      unit_price:         parseFloat(item.productPrice),
      currency:           "USD", // extend if your e-commerce tracks currency per order
      buyer_name:         `${order.firstName} ${order.lastName}`.trim(),
      buyer_email:        order.email,
      buyer_phone:        order.phone,
      shipping_address:   shippingAddress,
      payment_method:     order.paymentMethod,
      ordered_at:         new Date().toISOString(),
    };

    try {
      const res = await fetch(ERM_ORDER_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // Simple shared-secret auth — replace with HMAC if you want stronger security
          "x-ecommerce-secret": ERM_WEBHOOK_SECRET,
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(8_000),
      });

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        console.error(
          `[ERM Notify] ❌ Failed for listing ${ermRef.marketplaceId}: ` +
          `HTTP ${res.status} — ${body}`,
        );
      } else {
        const data = await res.json().catch(() => ({}));
        console.log(
          `[ERM Notify] ✅ Notified for listing ${ermRef.marketplaceId}:`,
          data,
        );
      }
    } catch (err: any) {
      // Never let a notification failure break the order flow
      console.error(
        `[ERM Notify] ❌ Network error for listing ${ermRef.marketplaceId}: ${err.message}`,
      );
    }
  });

  await Promise.allSettled(notifications);
}
