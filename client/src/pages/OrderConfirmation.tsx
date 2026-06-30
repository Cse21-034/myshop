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
  createdAt: string;
  items: OrderItem[];
}

export default function OrderConfirmation() {
  const [location] = useLocation();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const orderRef = useRef<HTMLDivElement>(null);

  // Extract orderId from query string, e.g. ?orderId=123
  const params = new URLSearchParams(window.location.search);
  const orderId = params.get("orderId");

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
        const response = await apiRequest("GET", `/api/orders/${orderId}`);
        const orderData = await response.json();
        setOrder(orderData);
      } catch (error) {
        console.error("Failed to fetch order", error);
      } finally {
        setLoading(false);
      }
    })();
  }, [orderId]);

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
        <main className="flex-grow container mx-auto px-4 py-12 text-center">
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
        <main className="flex-grow container mx-auto px-4 py-12 text-center">
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
      <main className="flex-grow container mx-auto px-4 py-12 max-w-3xl">
        <h1 className="text-3xl font-bold mb-6 text-primary">Order Receipt</h1>

        <div ref={orderRef} className="bg-white p-6 rounded shadow space-y-6 border border-gray-200">
          <section>
            <h2 className="font-semibold text-lg mb-2">Order #{order.id}</h2>
            <p>Date: {new Date(order.createdAt).toLocaleString()}</p>
            <p>Status: <span className="capitalize">{order.status}</span></p>
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
                  <th className="py-1">Price</th>
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
            <div className="font-bold text-lg">Total: {convertToBWP(order.total)}</div>
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
