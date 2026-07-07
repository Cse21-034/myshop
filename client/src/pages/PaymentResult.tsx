import { Link, useLocation } from "wouter";
import { CheckCircle2, XCircle, ShoppingBag, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

export default function PaymentResult() {
  const [location] = useLocation();
  const params = new URLSearchParams(location.split("?")[1] ?? "");
  const status        = params.get("status") ?? "failed";
  const failureReason = params.get("failureReason") ?? "";
  const orderId       = params.get("orderId") ?? "";

  const isSuccess = status === "success";

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header />

      <main className="flex-1 flex items-center justify-center px-4 py-16">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 max-w-md w-full p-8 text-center">
          {isSuccess ? (
            <>
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="h-8 w-8 text-green-600" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Payment Successful!</h1>
              <p className="text-gray-500 mb-6">
                Your payment has been confirmed and your order is being processed. You will receive a
                confirmation email and SMS shortly.
              </p>
              {orderId && (
                <p className="text-sm text-gray-400 mb-6">
                  Order reference: <span className="font-mono font-medium text-gray-700">{orderId}</span>
                </p>
              )}
              <div className="flex flex-col gap-3">
                <Button asChild className="gap-2">
                  <Link href="/orders">
                    View My Orders <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link href="/shop">
                    <ShoppingBag className="h-4 w-4 mr-2" /> Continue Shopping
                  </Link>
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <XCircle className="h-8 w-8 text-red-500" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Payment Failed</h1>
              <p className="text-gray-500 mb-3">
                {failureReason
                  ? failureReason
                  : "Your payment could not be processed. No charge has been made to your card."}
              </p>
              <p className="text-sm text-gray-400 mb-6">
                Please try again or choose a different payment method.
              </p>
              <div className="flex flex-col gap-3">
                <Button asChild className="gap-2">
                  <Link href="/checkout">
                    Try Again <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link href="/shop">
                    <ShoppingBag className="h-4 w-4 mr-2" /> Continue Shopping
                  </Link>
                </Button>
              </div>
            </>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
