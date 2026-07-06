import { Switch, Route, useLocation } from "wouter";
import { useEffect } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import { CartProvider } from "@/context/CartContext";
import CookieConsent from "react-cookie-consent";
import { Elements } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { Loader2 } from "lucide-react";
 
// Initialize Stripe
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

// Fallback ShoppingBag SVG
const ShoppingBag = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l-1 12H6L5 9z" />
  </svg>
);

// Pages
import NotFound from "@/pages/not-found";
import Landing from "@/pages/Landing";
import Home from "@/pages/Home";
import Shop from "@/pages/Shop";
import Product from "@/pages/Product";
import Cart from "@/pages/Cart";
import Checkout from "@/pages/Checkout";
import Admin from "@/pages/Admin";
import About from "@/pages/About";
import Contact from "@/pages/Contact";
import OrderConfirmation from "@/pages/OrderConfirmation";
import Orders from "@/pages/Orders";
import Profile from "@/pages/Profile";
import FarmMarket from "@/pages/FarmMarket";
import FarmProduct from "@/pages/FarmProduct";
import ForgotPassword from "@/pages/ForgotPassword";
import ResetPassword from "@/pages/ResetPassword";
import SellerApply from "@/pages/SellerApply";
import SellerDashboard from "@/pages/SellerDashboard";
import SellerProducts from "@/pages/SellerProducts";
import SellerOrders from "@/pages/SellerOrders";
import TrackOrder from "@/pages/TrackOrder";
import Wishlist from "@/pages/Wishlist";

// Professional Loading Screen with consistent colors and mobile optimization
function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="text-center space-y-6 md:space-y-8 w-full max-w-sm">
        <div className="relative">
          <div className="w-16 h-16 md:w-20 md:h-20 mx-auto bg-secondary rounded-2xl flex items-center justify-center shadow-lg">
            <ShoppingBag className="w-8 h-8 md:w-10 md:h-10 text-white" />
          </div>
          <div className="absolute inset-0 w-16 h-16 md:w-20 md:h-20 mx-auto rounded-2xl border-2 border-secondary/40 animate-ping opacity-20"></div>
        </div>
        <div className="space-y-2">
          <h1 className="text-xl md:text-2xl font-bold text-primary tracking-tight">
            Fountstresm
          </h1>
          <p className="text-gray-600 text-xs md:text-sm px-2">
            Loading your shopping experience...
          </p>
        </div>
        <div className="flex items-center justify-center space-x-2">
          <Loader2 className="w-4 h-4 md:w-5 md:h-5 text-secondary animate-spin" />
          <div className="flex space-x-1">
            <div className="w-1.5 h-1.5 md:w-2 md:h-2 bg-secondary rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
            <div className="w-1.5 h-1.5 md:w-2 md:h-2 bg-secondary rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
            <div className="w-1.5 h-1.5 md:w-2 md:h-2 bg-secondary rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
          </div>
        </div>
        <div className="w-48 md:w-64 mx-auto">
          <div className="h-0.5 md:h-1 bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full bg-secondary rounded-full animate-pulse"></div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ProtectedRoute wrapper
function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  
  useEffect(() => {
    if (!isAuthenticated) {
      navigate("/");
    }
  }, [isAuthenticated, navigate]);
  
  if (!isAuthenticated) return null;
  
  return <Component />;
}

// Main router
function Router() {
  const { isAuthenticated, isLoading } = useAuth();
  
  if (isLoading) return <LoadingScreen />;
  
  return (
    <Switch>
      <Route path="/" component={isAuthenticated ? Home : Landing} />
      <Route path="/shop" component={Shop} />
      <Route path="/product/:id" component={Product} />
      <Route path="/cart" component={Cart} />
      <Route path="/checkout" component={Checkout} />
      <Route path="/admin" component={() => <ProtectedRoute component={Admin} />} />
      <Route path="/orders" component={() => <ProtectedRoute component={Orders} />} />
     <Route path="/profile" component={() => <ProtectedRoute component={Profile} />} />
      <Route path="/about" component={About} />
      <Route path="/contact" component={Contact} />
      <Route path="/farm-market" component={FarmMarket} />
      <Route path="/farm-product/:id" component={FarmProduct} />
      <Route path="/seller/apply" component={() => <ProtectedRoute component={SellerApply} />} />
      <Route path="/seller/dashboard" component={() => <ProtectedRoute component={SellerDashboard} />} />
      <Route path="/seller/products/new" component={() => <ProtectedRoute component={SellerProducts} />} />
      <Route path="/seller/products" component={() => <ProtectedRoute component={SellerProducts} />} />
      <Route path="/seller/orders" component={() => <ProtectedRoute component={SellerOrders} />} />
      <Route path="/forgot-password" component={ForgotPassword} />
      <Route path="/reset-password" component={ResetPassword} />
      <Route path="/order-confirmation" component={OrderConfirmation} />
      <Route path="/track-order" component={TrackOrder} />
      <Route path="/wishlist" component={() => <ProtectedRoute component={Wishlist} />} />
      <Route component={NotFound} />
    </Switch>
  );
}

// App wrapper with consistent color scheme
function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <CartProvider>
          <Elements stripe={stripePromise}>
            <Toaster />
            <Router />
            <CookieConsent
              location="bottom"
              buttonText="Accept"
              declineButtonText="Decline"
              cookieName="cookieConsent"
              containerClasses="fixed bottom-2 left-2 right-2 md:bottom-4 md:left-0 md:right-0 md:mx-auto md:max-w-lg bg-white shadow-lg p-3 md:p-4 flex flex-col sm:flex-row items-center justify-between z-50 rounded-lg border"
              buttonClasses="bg-primary text-white font-semibold py-2 px-3 md:px-4 rounded-md text-sm hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary/50 w-full sm:w-auto mt-2 sm:mt-0"
              declineButtonClasses="border border-gray-300 text-gray-700 font-semibold py-2 px-3 md:px-4 rounded-md text-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-300 w-full sm:w-auto mb-2 sm:mb-0 sm:mr-2"
              contentClasses="text-gray-700 text-xs md:text-sm mb-3 sm:mb-0 sm:mr-3 text-center sm:text-left"
              expires={365}
              enableDeclineButton={true}
              onAccept={() => {
                console.log("✅ Cookie consent accepted");
                queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
              }}
              onDecline={() => {
                console.warn("❌ Cookie consent declined, falling back to JWT or manual cookie enabling");
                alert(
                  "Some features, like login, may require cookies. Please enable third-party cookies in your browser settings or try again later."
                );
              }}
            >
              This website uses cookies to enable essential features like authentication and cart management. By accepting, you agree to the use of cookies.
            </CookieConsent>
          </Elements>
        </CartProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
