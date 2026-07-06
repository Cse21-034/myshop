import { getKgotlaIdForProduct } from "./kgotla-sync.service";
import type { Order, OrderItem } from "./schema";

// ─── Config ───────────────────────────────────────────────────────────────────

const KGOTLA_BASE_URL =
  process.env.KGOTLA_API_URL ?? "https://kgotla-backend.onrender.com";

const KGOTLA_ORDER_ENDPOINT = `${KGOTLA_BASE_URL}/api/external/orders`;
const KGOTLA_SECRET = process.env.KGOTLA_API_SECRET ?? "";

// ─── Types ────────────────────────────────────────────────────────────────────

interface KgotlaOrderPayload {
  myshop_order_id:  number;   // lets Kgotla reference back in status webhooks
  kgotla_item_id:   number;
  quantity:         number;
  unit_price:       number;
  currency:         string;
  buyer_name:       string;
  buyer_email:      string;
  buyer_phone:      string;
  shipping_address: string;
  payment_method:   string;
  ordered_at:       string;
}

// ─── Core function ────────────────────────────────────────────────────────────

export async function notifyKgotlaOfOrder(
  order: Order & { items?: OrderItem[] },
  items: OrderItem[],
): Promise<void> {
  if (process.env.KGOTLA_NOTIFY_ORDERS !== "true") {
    console.log("[Kgotla Notify] Skipped (KGOTLA_NOTIFY_ORDERS not set to 'true')");
    return;
  }

  const shippingAddress = [order.address, order.city, order.state, order.zipCode]
    .filter(Boolean)
    .join(", ");

  const notifications: Promise<void>[] = items.map(async (item) => {
    if (!item.productId) return;

    const kgotlaRef = await getKgotlaIdForProduct(item.productId);
    if (!kgotlaRef) return;

    const payload: KgotlaOrderPayload = {
      myshop_order_id:  order.id,
      kgotla_item_id:   kgotlaRef.kgotlaItemId,
      quantity:         item.quantity,
      unit_price:       parseFloat(item.productPrice),
      currency:         "USD",
      buyer_name:       `${order.firstName} ${order.lastName}`.trim(),
      buyer_email:      order.email,
      buyer_phone:      order.phone,
      shipping_address: shippingAddress,
      payment_method:   "cash_on_delivery",
      ordered_at:       new Date().toISOString(),
    };

    try {
      const res = await fetch(KGOTLA_ORDER_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-myshop-secret": KGOTLA_SECRET,
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(8_000),
      });

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        console.error(
          `[Kgotla Notify] Failed for item ${kgotlaRef.kgotlaItemId}: HTTP ${res.status} — ${body}`,
        );
      } else {
        const data = await res.json().catch(() => ({}));
        console.log(`[Kgotla Notify] Notified for item ${kgotlaRef.kgotlaItemId}:`, data);
      }
    } catch (err: any) {
      // Never let notification failure break the order flow
      console.error(
        `[Kgotla Notify] Network error for item ${kgotlaRef.kgotlaItemId}: ${err.message}`,
      );
    }
  });

  await Promise.allSettled(notifications);
}
