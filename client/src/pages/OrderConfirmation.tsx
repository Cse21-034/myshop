import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";

interface OrderItem {
  id: number;
  productName: string;
  productPrice: string;
  quantity: number;
  size?: string | null;
  color?: string | null;
}

interface Order {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  paymentMethod: string;
  status: string;
  subtotal: string;
  shipping: string;
  tax: string;
  total: string;
  depositAmount: string | null;
  remainingBalance: string | null;
  fulfillmentType: string | null;
  trackingNumber: string | null;
  createdAt: string;
  items: OrderItem[];
}

// ─── Tracking timeline ────────────────────────────────────────────────────────

const STEPS = ["pending", "processing", "shipped", "delivered"] as const;
type Step = typeof STEPS[number];

const STEP_LABELS: Record<Step, string> = {
  pending:    "Order Placed",
  processing: "Processing",
  shipped:    "Shipped",
  delivered:  "Delivered",
};

function getStepIndex(status: string): number {
  if (status === "cancelled") return -1;
  const idx = STEPS.indexOf(status as Step);
  // treat confirmed / awaiting_confirmation as processing
  return idx === -1 ? 1 : idx;
}

function TrackingTimeline({ status }: { status: string }) {
  if (status === "cancelled") {
    return (
      <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-red-700 text-sm font-medium">
        <span>❌</span> This order has been cancelled.
      </div>
    );
  }

  const current = getStepIndex(status);

  return (
    <div className="relative flex items-start justify-between mb-2">
      {STEPS.map((step, i) => {
        const done    = i < current;
        const active  = i === current;
        return (
          <div key={step} className="flex flex-col items-center flex-1 relative">
            {/* connector line */}
            {i > 0 && (
              <div className={`absolute left-0 top-4 w-full h-0.5 -translate-x-1/2 ${done || active ? "bg-green-500" : "bg-gray-200"}`} />
            )}
            {/* circle */}
            <div className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all
              ${done   ? "bg-green-500 border-green-500 text-white"
              : active ? "bg-white border-green-500 text-green-700"
                       : "bg-white border-gray-200 text-gray-400"}`}>
              {done ? "✓" : i + 1}
            </div>
            <p className={`mt-2 text-xs text-center leading-tight ${active ? "text-green-700 font-semibold" : done ? "text-green-600" : "text-gray-400"}`}>
              {STEP_LABELS[step]}
            </p>
          </div>
        );
      })}
    </div>
  );
}

export default function OrderConfirmation() {
  const [location] = useLocation();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const orderRef = useRef<HTMLDivElement>(null);

  // Extract orderId (and, for guests, the access token) from the query string
  const params = new URLSearchParams(window.location.search);
  const orderId = params.get("orderId");
  const token = params.get("token");

  // Exchange rate USD to BWP (update as necessary)
  const USD_TO_BWP = 13.5;

  // Helper to convert and format currency in BWP
  const convertToBWP = (usdString: string) => {
    const usd = parseFloat(usdString);
    if (isNaN(usd)) return "P 0.00";
    const bwp = usd * USD_TO_BWP;
    return `P ${bwp.toLocaleString("en-BW", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  useEffect(() => {
    if (!orderId) {
      setLoading(false);
      return;
    }

    (async () => {
      try {
        const url = token ? `/api/orders/${orderId}?token=${token}` : `/api/orders/${orderId}`;
        const response = await apiRequest("GET", url);
        const orderData = await response.json();
        setOrder(orderData);
      } catch (error) {
        console.error("Failed to fetch order", error);
      } finally {
        setLoading(false);
      }
    })();
  }, [orderId, token]);

  const downloadPDF = async () => {
    if (!orderRef.current) return;
    const element = orderRef.current;
    const canvas = await html2canvas(element, { scale: 2 });
    const imgData = canvas.toDataURL("image/png");

    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "pt",
      format: "a4",
    });

    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

    pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
    pdf.save(`order-receipt-${order?.id}.pdf`);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-grow container mx-auto px-[5px] sm:px-4 py-12 text-center">
          <p>Loading order details...</p>
        </main>
        <Footer />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-grow container mx-auto px-[5px] sm:px-4 py-12 text-center">
          <h1 className="text-3xl font-bold mb-4 text-red-600">Order not found</h1>
          <Button asChild>
            <a href="/shop">Continue Shopping</a>
          </Button>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-grow container mx-auto px-[5px] sm:px-4 py-12 max-w-3xl">
        <h1 className="text-3xl font-bold mb-6 text-primary">Order Receipt</h1>

        {/* Tracking timeline — shown above the printable receipt */}
        <div className="bg-white p-6 rounded shadow border border-gray-200 mb-6">
          <h2 className="font-semibold text-base mb-4">Order Status</h2>
          <TrackingTimeline status={order.status} />
          {order.trackingNumber && (
            <div className="mt-4 bg-gray-50 border border-gray-200 rounded-lg px-4 py-3">
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Tracking Number</p>
              <p className="font-mono font-bold text-gray-800 tracking-widest text-sm">{order.trackingNumber}</p>
            </div>
          )}
        </div>

        <div ref={orderRef} className="bg-white p-6 rounded shadow space-y-6 border border-gray-200">

          {/* Farm reservation banner */}
          {order.depositAmount && (
            <div className={`rounded-lg p-4 text-sm font-medium ${
              order.status === "confirmed"
                ? "bg-green-50 border border-green-300 text-green-800"
                : order.status === "cancelled"
                ? "bg-red-50 border border-red-300 text-red-800"
                : "bg-amber-50 border border-amber-300 text-amber-800"
            }`}>
              {order.status === "confirmed"
                ? "✅ Your reservation has been confirmed by the farm. Please contact the farm to arrange collection."
                : order.status === "cancelled"
                ? "❌ This reservation was not confirmed by the farm. A refund will be processed if a deposit was paid."
                : "⏳ Reservation pending — the farm will confirm availability within 24 hours."}
            </div>
          )}

          <section>
            <h2 className="font-semibold text-lg mb-2">Order #{order.id}</h2>
            <p>Date: {new Date(order.createdAt).toLocaleString()}</p>
            <p>Status: <span className="capitalize">{order.status.replace(/_/g, " ")}</span></p>
            {order.fulfillmentType && (
              <p>Collection: <span className="capitalize">{order.fulfillmentType}</span></p>
            )}
          </section>

          <section>
            <h3 className="font-semibold text-lg mb-2">Customer Info</h3>
            <p>{order.firstName} {order.lastName}</p>
            <p>{order.email}</p>
            <p>{order.phone}</p>
            <p>{order.address}</p>
            <p>{order.city}, {order.state} {order.zipCode}</p>
          </section>

          <section>
            <h3 className="font-semibold text-lg mb-2">Items</h3>
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b">
                  <th className="py-1">Product</th>
                  <th className="py-1">Options</th>
                  <th className="py-1">Qty</th>
                  <th className="py-1">Unit Price</th>
                  <th className="py-1">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {order.items.map(item => (
                  <tr key={item.id} className="border-b">
                    <td className="py-1">{item.productName}</td>
                    <td className="py-1 text-sm text-gray-600">
                      {item.size && <span>Size: {item.size} </span>}
                      {item.color && <span>Color: {item.color}</span>}
                    </td>
                    <td className="py-1">{item.quantity}</td>
                    <td className="py-1">{convertToBWP(item.productPrice)}</td>
                    <td className="py-1">{convertToBWP((parseFloat(item.productPrice) * item.quantity).toString())}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="text-right space-y-1">
            <div>Subtotal: {convertToBWP(order.subtotal)}</div>
            <div>Shipping: {convertToBWP(order.shipping)}</div>
            <div>Tax: {convertToBWP(order.tax)}</div>
            {order.depositAmount ? (
              <>
                <div className="text-gray-400 line-through">Full total: {convertToBWP(order.total)}</div>
                <div className="font-bold text-lg text-amber-700">
                  Deposit paid: {convertToBWP(order.depositAmount)}
                </div>
                <div className="text-gray-600">
                  Due on collection: {convertToBWP(order.remainingBalance ?? "0")}
                </div>
              </>
            ) : (
              <div className="font-bold text-lg">Total: {convertToBWP(order.total)}</div>
            )}
          </section>

          <section>
            <h3 className="font-semibold text-lg mb-2">Payment Method</h3>
            <p className="capitalize">{order.paymentMethod}</p>
          </section>
        </div>

        <div className="mt-6 flex justify-center">
          <Button onClick={downloadPDF}>Download Receipt (PDF)</Button>
        </div>

        <div className="mt-8 text-center">
          <Button asChild>
            <a href="/shop">Continue Shopping</a>
          </Button>
        </div>
      </main>
      <Footer />
    </div>
  );
}
