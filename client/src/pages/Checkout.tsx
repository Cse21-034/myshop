 import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { useCart } from "@/context/CartContext";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Lock, CreditCard, CheckCircle, AlertCircle } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { CardElement, useStripe, useElements } from "@stripe/react-stripe-js";
import PayPalWrapper from "@/components/PayPalWrapper";
//import DirectPayPalIntegration from "@/components/DirectPayPalIntegration";
import type { Product } from "@shared/schema";

const botswanaPhoneRegex = /^(?:\+2677\d{7}|7\d{7})$/;

const checkoutSchema = z.object({
  firstName: z.string().min(2, "First name must be at least 2 characters"),
  lastName: z.string().min(2, "Last name must be at least 2 characters"),
  email: z.string().email("Please enter a valid email address"),
    phone: z
    .string()
    .regex(botswanaPhoneRegex, "Please enter a valid Botswana phone number"),
  address: z.string().min(5, "Please enter a complete address"),
  
  city: z.string().min(2, "Please enter a valid city"),
  
  state: z.string().min(2, "Please select a state"),
  zipCode: z.string().min(5, "Please enter a valid ZIP code"),
  paymentMethod: z.enum(["stripe", "paypal", "orangemoney", "cash"], {
    required_error: "Please select a payment method",
  }),
  orangeMoneyPhone: z.string().optional(),
});

type CheckoutFormData = z.infer<typeof checkoutSchema>;

export default function Checkout() {
  const [, setLocation] = useLocation();
  const [paypalError, setPaypalError] = useState<string | null>(null);
  const [paypalOrderId, setPaypalOrderId] = useState<string | null>(null);
  const [fulfillmentType, setFulfillmentType] = useState<"pickup" | "delivery">("pickup");
  const [couponInput, setCouponInput] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; discount: number } | null>(null);
  const [couponError, setCouponError] = useState("");
  const { items, itemCount, clearCart } = useCart();
  const { toast } = useToast();
  const stripe = useStripe();
  const elements = useElements();

  const USD_TO_BWP = 13.5; // Update this to current rate if needed

  const convertToBWP = (usdPrice: string | undefined) => {
    if (!usdPrice) return 0;
    const n = parseFloat(usdPrice);
    return isNaN(n) ? 0 : n * USD_TO_BWP;
  };

  const formatBWP = (amount: number) => {
    return `P ${amount.toLocaleString("en-BW", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const form = useForm<CheckoutFormData>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      address: "",
      city: "",
      state: "",
      zipCode: "",
      paymentMethod: "stripe",
      orangeMoneyPhone: "",
    },
  });

  const { data: products = [], isLoading: productsLoading } = useQuery({
    queryKey: ["/api/products"],
    enabled: items.length > 0,
  });

  const cartItemsWithProducts = items.map(item => {
    const product = products.find((p: Product) => p.id === item.productId);
    return {
      ...item,
      product,
    };
  });

  // Calculate all prices in USD (numbers)
  const subtotal = cartItemsWithProducts.reduce((total, item) => {
    return total + (item.product ? parseFloat(item.product.price) * item.quantity : 0);
  }, 0);

  // Shipping $9.99 if subtotal below $75 USD, else free shipping
  const shipping = subtotal > 75 ? 0 : 9.99;

  // Tax 8% in USD
  const tax = subtotal * 0.08;

  // Coupon discount (in USD)
  const couponDiscount = appliedCoupon?.discount ?? 0;

  // Total price in USD (full product value — always stored in order record)
  const total = Math.max(0, subtotal + shipping + tax - couponDiscount);

  // Deposit logic: if any cart item is a farm product with depositPercent > 0,
  // the customer only pays the deposit now; the rest is due on collection.
  const maxDepositPercent = Math.max(
    ...cartItemsWithProducts.map(item => (item.product as any)?.depositPercent ?? 0),
    0
  );
  const isFarmOrder = maxDepositPercent > 0;
  const payableNow = isFarmOrder
    ? parseFloat((total * maxDepositPercent / 100).toFixed(2))
    : total;
  const dueOnCollection = isFarmOrder
    ? parseFloat((total - payableNow).toFixed(2))
    : 0;

  
  const createOrderMutation = useMutation({
    mutationFn: async (orderData: CheckoutFormData & { paymentIntentId?: string; paypalOrderId?: string; orangeMoneyTransactionId?: string }) => {
      const orderItems = cartItemsWithProducts.map(item => ({
        productId: item.productId,
        productName: item.product?.name || "",
        productPrice: item.product?.price || "0", // Keep price stored in USD for backend
        quantity: item.quantity,
        size: item.size,
        color: item.color,
      }));

      const orderPayload = {
        orderData: {
          email: orderData.email,
          firstName: orderData.firstName,
          lastName: orderData.lastName,
          phone: orderData.phone,
          address: orderData.address,
          city: orderData.city,
          state: orderData.state,
          zipCode: orderData.zipCode,
          paymentMethod: orderData.paymentMethod,
          paymentIntentId: orderData.paymentIntentId,
          paypalOrderId: orderData.paypalOrderId,
          orangeMoneyTransactionId: orderData.orangeMoneyTransactionId,

          subtotal: subtotal.toFixed(2),
          shipping: shipping.toFixed(2),
          tax: tax.toFixed(2),
          total: total.toFixed(2),
          couponCode: appliedCoupon?.code ?? undefined,
          discountAmount: couponDiscount > 0 ? couponDiscount.toFixed(2) : undefined,

          status: orderData.paymentMethod === "cash" ? "pending" : "paid",
        },
        items: orderItems,
        fulfillmentType: isFarmOrder ? fulfillmentType : undefined,
      };

      const response = await apiRequest("POST", "/api/orders", orderPayload);
      const data = await response.json();
      return data;
    },
    onSuccess: (orderResponse) => {
      toast({
        title: "Order placed successfully!",
        description: "You will receive a confirmation email shortly.",
      });
      clearCart();
      const tokenParam = orderResponse.accessToken ? `&token=${orderResponse.accessToken}` : "";
      setLocation(`/order-confirmation?orderId=${orderResponse.id}${tokenParam}`);
    },
    onError: (error) => {
      toast({
        title: "Order failed",
        description: error.message || "There was an error processing your order.",
        variant: "destructive",
      });
    },
  });

  const handleStripePayment = async (orderData: CheckoutFormData) => {
    if (!stripe || !elements) {
      toast({ title: "Error", description: "Stripe not initialized", variant: "destructive" });
      return;
    }

    const cardElement = elements.getElement(CardElement);
    if (!cardElement) {
      toast({ title: "Error", description: "Card input not found", variant: "destructive" });
      return;
    }

    try {
      const response = await apiRequest("POST", "/api/payments/stripe/create", {
        amount: payableNow,
        currency: "usd",
      });
      const { clientSecret } = await response.json();

      const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
        payment_method: { card: cardElement },
      });

      if (error) {
        throw new Error(error.message);
      }

      createOrderMutation.mutate({ ...orderData, paymentIntentId: paymentIntent.id });
    } catch (error) {
      toast({
        title: "Payment failed",
        description: error.message || "There was an error processing your payment.",
        variant: "destructive",
      });
    }
  };

  const handlePayPalPayment = async (orderData: CheckoutFormData, paypalOrderId: string) => {
    try {
      const response = await apiRequest("POST", "/api/payments/paypal/capture", { 
        orderId: paypalOrderId 
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to capture PayPal payment");
      }
      
      const captureData = await response.json();
      createOrderMutation.mutate({ ...orderData, paypalOrderId: captureData.id || paypalOrderId });
    } catch (error) {
      console.error("PayPal payment error:", error);
      toast({
        title: "Payment failed",
        description: error.message || "There was an error processing your PayPal payment.",
        variant: "destructive",
      });
    }
  };

  const handleOrangeMoneyPayment = async (orderData: CheckoutFormData) => {
    if (!orderData.orangeMoneyPhone) {
      toast({ title: "Error", description: "Please provide a phone number for Orange Money", variant: "destructive" });
      return;
    }

    try {
      const response = await apiRequest("POST", "/api/payments/orangemoney/initiate", {
        phone: orderData.orangeMoneyPhone,
        amount: payableNow,
        currency: "XAF",
      });
      const { transactionId } = await response.json();
      createOrderMutation.mutate({ ...orderData, orangeMoneyTransactionId: transactionId });
    } catch (error) {
      toast({
        title: "Payment failed",
        description: error.message || "There was an error processing your Orange Money payment.",
        variant: "destructive",
      });
    }
  };

  const onSubmit = async (data: CheckoutFormData) => {
    if (data.paymentMethod === "stripe") {
      await handleStripePayment(data);
    } else if (data.paymentMethod === "paypal") {
      // PayPal handled by PayPalButtons component
      // Validate form first
      const isFormValid = await form.trigger();
      if (!isFormValid) {
        toast({
          title: "Form Error",
          description: "Please fill in all required fields before proceeding with PayPal payment.",
          variant: "destructive",
        });
        return;
      }
    } else if (data.paymentMethod === "orangemoney") {
      await handleOrangeMoneyPayment(data);
    } else {
      createOrderMutation.mutate(data);
    }
  };

  if (!productsLoading && items.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="container mx-auto px-4 py-16">
          <div className="text-center max-w-md mx-auto">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Your cart is empty</h1>
            <p className="text-gray-600 mb-6">Add some items to your cart before checkout.</p>
            <Button asChild>
              <Link href="/shop">Continue Shopping</Link>
            </Button>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  // Config checks for payment methods:
  const paypalClientId = import.meta.env.VITE_PAYPAL_CLIENT_ID;
  const isPayPalAvailable = !!paypalClientId && paypalClientId !== "" && paypalClientId !== "your-paypal-client-id-here";
   console.log("PayPal Config:", { paypalClientId, isPayPalAvailable });
  
  const stripePublishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
  const isStripeAvailable = !!stripePublishableKey && stripePublishableKey !== "" && stripePublishableKey !== "your-stripe-publishable-key-here";

  const orangeMoneyApiKey = import.meta.env.VITE_ORANGE_MONEY_API_KEY;
  const isOrangeMoneyAvailable = !!orangeMoneyApiKey && orangeMoneyApiKey !== "" && orangeMoneyApiKey !== "your-orange-money-api-key-here";

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-primary mb-2">Checkout</h1>
          <div className="flex items-center text-sm text-gray-600">
            <Lock className="h-4 w-4 mr-1" />
            Secure checkout
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          <div>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <CreditCard className="h-5 w-5 mr-2" />
                  Billing Information
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="firstName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>First Name</FormLabel>
                            <FormControl>
                             <Input placeholder="Thabo" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="lastName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Last Name</FormLabel>
                            <FormControl>
                              <Input placeholder="Mosela" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email Address</FormLabel>
                          <FormControl>
                            <Input type="email" placeholder="Thabo.mosela@example.com" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Phone Number</FormLabel>
                          <FormControl>
                            <Input type="tel" placeholder="72212372 or +26773749682" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="address"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Street Address</FormLabel>
                          <FormControl>
                           <Input
  placeholder="Plot 1234, Gaborone West / 15 Main Road, Francistown"
  {...field}
/>

                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      <FormField
                        control={form.control}
                        name="city"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>City/Town</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select City" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="Gaborone">Gaborone</SelectItem>
                                <SelectItem value="Francistown">Francistown</SelectItem>
                                <SelectItem value="Molepolole">Molepolole</SelectItem>
                                <SelectItem value="Maun">Maun</SelectItem>
                                <SelectItem value="Serowe">Serowe</SelectItem>
                                <SelectItem value="Selibe-Phikwe">Selibe-Phikwe</SelectItem>
                                <SelectItem value="Kanye">Kanye</SelectItem>
                                <SelectItem value="Mochudi">Mochudi</SelectItem>
                                <SelectItem value="Mahalapye">Mahalapye</SelectItem>
                                <SelectItem value="Palapye">Palapye</SelectItem>
                                <SelectItem value="Lobatse">Lobatse</SelectItem>
                                <SelectItem value="Jwaneng">Jwaneng</SelectItem>
                                <SelectItem value="Kasane">Kasane</SelectItem>
                                <SelectItem value="Orapa">Orapa</SelectItem>
                                <SelectItem value="Letlhakane">Letlhakane</SelectItem>
                                <SelectItem value="Ghanzi">Ghanzi</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="state"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>District</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select District" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="South East">South East</SelectItem>
                                <SelectItem value="North East">North East</SelectItem>
                                <SelectItem value="Kweneng">Kweneng</SelectItem>
                                <SelectItem value="North West">North West</SelectItem>
                                <SelectItem value="Central">Central</SelectItem>
                                <SelectItem value="Southern">Southern</SelectItem>
                                <SelectItem value="Kgatleng">Kgatleng</SelectItem>
                                <SelectItem value="Kgalagadi">Kgalagadi</SelectItem>
                                <SelectItem value="Ghanzi">Ghanzi</SelectItem>
     
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="zipCode"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>ZIP Code</FormLabel>
                            <FormControl>
                              <Input placeholder="10001" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <div className="pt-6 border-t border-gray-200">
                      <FormField
                        control={form.control}
                        name="paymentMethod"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Payment Method</FormLabel>
                           <FormControl>
                              <RadioGroup
                                onValueChange={field.onChange}
                                defaultValue={field.value}
                                className="space-y-3"
                              >
                                <div className="flex items-center space-x-2">
                                  <RadioGroupItem
                                    value="stripe"
                                    id="stripe"
                                    disabled={!isStripeAvailable}
                                  />
                                  <label
                                    htmlFor="stripe"
                                    className={`text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 ${
                                      !isStripeAvailable ? "text-gray-400" : ""
                                    }`}
                                  >
                                    Credit/Debit Card (Stripe)
                                    {!isStripeAvailable && (
                                      <span className="ml-2 text-xs text-red-500">(Not configured)</span>
                                    )}
                                  </label>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <RadioGroupItem
                                    value="paypal"
                                    id="paypal"
                                    disabled={!isPayPalAvailable}
                                  />
                                  <label
                                    htmlFor="paypal"
                                    className={`text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 ${
                                      !isPayPalAvailable ? "text-gray-400" : ""
                                    }`}
                                  >
                                    PayPal
                                    {!isPayPalAvailable && (
                                      <span className="ml-2 text-xs text-red-500">(Not configured)</span>
                                    )}
                                  </label>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <RadioGroupItem
                                    value="orangemoney"
                                    id="orangemoney"
                                    disabled={!isOrangeMoneyAvailable}
                                  />
                                  <label
                                    htmlFor="orangemoney"
                                    className={`text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 ${
                                      !isOrangeMoneyAvailable ? "text-gray-400" : ""
                                    }`}
                                  >
                                    Orange Money
                                    {!isOrangeMoneyAvailable && (
                                      <span className="ml-2 text-xs text-red-500">(Not configured)</span>
                                    )}
                                  </label>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <RadioGroupItem value="cash" id="cash" />
                                  <label
                                    htmlFor="cash"
                                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                  >
                                    Cash on Delivery
                                  </label>
                                </div>
                              </RadioGroup>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    {form.watch("paymentMethod") === "stripe" && (
                      <div className="pt-4">
                        <FormItem>
                          <FormLabel>Card Details</FormLabel>
                          <FormControl>
                            <CardElement
                              options={{
                                style: {
                                  base: {
                                    fontSize: "16px",
                                    color: "#424770",
                                    "::placeholder": { color: "#aab7c4" },
                                  },
                                  invalid: { color: "#9e2146" },
                                },
                              }}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      </div>
                    )}
                    {form.watch("paymentMethod") === "orangemoney" && (
                      <div className="pt-4">
                        <FormField
                          control={form.control}
                          name="orangeMoneyPhone"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Orange Money Phone Number</FormLabel>
                              <FormControl>
                                <Input type="tel" placeholder="+237 6XX XXX XXX" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    )}
                    {form.watch("paymentMethod") === "paypal" && isPayPalAvailable && (
                      <div className="pt-4">
                        <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-md">
                          <p className="text-sm text-blue-800">
                            Please fill out all billing information above, then use the PayPal button below to complete your payment.
                          </p>
                        </div>

                     
                        <PayPalWrapper
                          clientId={paypalClientId}
                          total={total}
                          onCreateOrder={async () => {
                            // Validate form before creating PayPal order
                            const isValid = await form.trigger();
                            if (!isValid) {
                              throw new Error("Please fill in all required fields");
                            }

                            setPaypalError(null);
                            const response = await apiRequest("POST", "/api/payments/paypal/create", {
                              amount: payableNow.toFixed(2),
                              currency: "USD"
                            });

                            if (!response.ok) {
                              const errorData = await response.json();
                              throw new Error(errorData.message || "Failed to create PayPal order");
                            }

                            const { orderId } = await response.json();
                            setPaypalOrderId(orderId);
                            return orderId;
                          }}
                          onApprove={async (orderId) => {
                            setPaypalError(null);
                            const formValues = form.getValues();
                            await handlePayPalPayment(formValues, orderId);
                          }}
                          onError={(error) => {
                            const errorMessage = error?.message || "PayPal payment failed";
                            setPaypalError(errorMessage);
                          }}
                          onCancel={() => {
                            setPaypalError(null);
                          }}
                        />
  {/*  

// And replace the PayPalWrapper usage with:
<DirectPayPalIntegration
  clientId={paypalClientId}
  total={total}
  onCreateOrder={createPayPalOrder}
  onApprove={async (orderId) => {
    setPaypalError(null);
    const formValues = form.getValues();
    await handlePayPalPayment(formValues, orderId);
  }}
  onError={(error) => {
    const errorMessage = typeof error === 'string' ? error : 
      error?.message || "PayPal payment failed";
    setPaypalError(errorMessage);
  }}
  onCancel={() => {
    setPaypalError(null);
  }}
/>
*/}

                        
                        {paypalError && (
                          <div className="mt-4 p-3 border border-red-300 bg-red-50 rounded-md">
                            <div className="flex items-center">
                              <AlertCircle className="h-4 w-4 text-red-600 mr-2 flex-shrink-0" />
                              <p className="text-sm text-red-800">{paypalError}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                    {form.watch("paymentMethod") === "paypal" && !isPayPalAvailable && (
                      <div className="pt-4">
                        <div className="p-4 border border-yellow-300 bg-yellow-50 rounded-md">
                          <div className="flex items-center">
                            <AlertCircle className="h-5 w-5 text-yellow-600 mr-2" />
                            <div>
                              <p className="text-sm text-yellow-800">
                                PayPal is not configured. Please check your PayPal Client ID environment variable.
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                    <div className="pt-6">
                      <Button
                        type="submit"
                        className="w-full bg-primary hover:bg-gray-800"
                        disabled={
                          createOrderMutation.isPending || 
                          form.watch("paymentMethod") === "paypal" || // Disable for PayPal since buttons handle the submission
                          (form.watch("paymentMethod") === "stripe" && !isStripeAvailable) ||
                          (form.watch("paymentMethod") === "orangemoney" && !isOrangeMoneyAvailable)
                        }
                      >
                        {createOrderMutation.isPending ? "Processing..." : 
                         form.watch("paymentMethod") === "paypal" ? "Use PayPal Button Above" :
                         "Place Order"}
                      </Button>
                    </div>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </div>
          <div>
            <Card>
              <CardHeader>
                <CardTitle>Order Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {cartItemsWithProducts.map((item) => (
                    <div key={item.id} className="flex items-center space-x-4">
                      <img
                        src={item.product?.images?.[0] || "https://images.unsplash.com/photo-1441986300917-64674bd600d8?ixlib=rb-4.0.3&auto=format&fit=crop&w=80&h=80"}
                        alt={item.product?.name || 'Product'}
                        className="w-16 h-16 object-cover rounded"
                      />
                      <div className="flex-1">
                        <h4 className="font-medium">{item.product?.name}</h4>
                        <div className="text-sm text-gray-600">
                          {item.size && <span>Size: {item.size}</span>}
                          {item.size && item.color && <span>, </span>}
                          {item.color && <span>Color: {item.color}</span>}
                        </div>
                        <p className="text-sm text-gray-600">Qty: {item.quantity}</p>
                      </div>
                      <span className="font-semibold">
                        {/* convert and format price */}
                        {item.product ? formatBWP(convertToBWP(item.product.price) * item.quantity) : "P 0.00"}
                      </span>
                    </div>
                  ))}
                </div>
                <Separator className="my-6" />

                {isFarmOrder && (
                  <div className="mb-4">
                    <p className="text-sm font-medium mb-2">Collection method</p>
                    <RadioGroup
                      value={fulfillmentType}
                      onValueChange={(v) => setFulfillmentType(v as "pickup" | "delivery")}
                      className="flex gap-4"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="pickup" id="pickup" />
                        <label htmlFor="pickup" className="text-sm cursor-pointer">Pickup</label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="delivery" id="delivery" />
                        <label htmlFor="delivery" className="text-sm cursor-pointer">Delivery</label>
                      </div>
                    </RadioGroup>
                  </div>
                )}

                {/* Coupon code */}
                <div className="mb-3">
                  {appliedCoupon ? (
                    <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded px-3 py-2 text-sm">
                      <span className="text-green-700 font-medium">"{appliedCoupon.code}" applied</span>
                      <button className="text-green-600 hover:text-red-500 text-xs" onClick={() => setAppliedCoupon(null)}>Remove</button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <input className="flex-1 border border-gray-200 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary" placeholder="Coupon code" value={couponInput} onChange={(e) => { setCouponInput(e.target.value.toUpperCase()); setCouponError(""); }} />
                      <button className="shrink-0 bg-primary text-white text-sm px-3 py-1.5 rounded hover:bg-gray-800 disabled:opacity-50" disabled={!couponInput}
                        onClick={async () => {
                          setCouponError("");
                          try {
                            const r = await fetch(`${import.meta.env.VITE_API_BASE_URL || "https://myshop-test-backend.onrender.com"}/api/coupons/apply`, { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ code: couponInput, orderTotal: (subtotal + shipping + tax).toFixed(2) }) });
                            const data = await r.json();
                            if (!r.ok) { setCouponError(data.message || "Invalid coupon"); return; }
                            setAppliedCoupon({ code: data.coupon.code, discount: data.discount });
                            setCouponInput("");
                          } catch { setCouponError("Failed to apply coupon"); }
                        }}>Apply</button>
                    </div>
                  )}
                  {couponError && <p className="text-xs text-red-500 mt-1">{couponError}</p>}
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Subtotal ({itemCount} items):</span>
                    <span>{formatBWP(convertToBWP(subtotal.toFixed(2)))}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Delivery:</span>
                    <span>{shipping === 0 ? "Free" : formatBWP(convertToBWP(shipping.toFixed(2)))}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>VAT (14%):</span>
                    <span>{formatBWP(convertToBWP(tax.toFixed(2)))}</span>
                  </div>
                  {couponDiscount > 0 && (
                    <div className="flex justify-between text-green-600 font-medium">
                      <span>Discount ({appliedCoupon?.code}):</span>
                      <span>-{formatBWP(convertToBWP(couponDiscount.toFixed(2)))}</span>
                    </div>
                  )}
                  <Separator className="my-2" />
                  {isFarmOrder ? (
                    <>
                      <div className="flex justify-between text-gray-500 line-through">
                        <span>Full total:</span>
                        <span>{formatBWP(convertToBWP(total.toFixed(2)))}</span>
                      </div>
                      <div className="flex justify-between text-lg font-bold text-amber-700">
                        <span>Deposit due now ({maxDepositPercent}%):</span>
                        <span>{formatBWP(convertToBWP(payableNow.toFixed(2)))}</span>
                      </div>
                      <div className="flex justify-between text-sm text-gray-500">
                        <span>Due on collection:</span>
                        <span>{formatBWP(convertToBWP(dueOnCollection.toFixed(2)))}</span>
                      </div>
                    </>
                  ) : (
                    <div className="flex justify-between text-lg font-bold">
                      <span>Total:</span>
                      <span className="text-secondary">{formatBWP(convertToBWP(total.toFixed(2)))}</span>
                    </div>
                  )}
                </div>
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <div className="space-y-2">
                    <div className="flex items-center text-sm text-gray-600">
                      <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                      Free delivery on orders over {formatBWP(75 * USD_TO_BWP)}
                    </div>
                    <div className="flex items-center text-sm text-gray-600">
                      <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                      30-day return policy
                    </div>
                    <div className="flex items-center text-sm text-gray-600">
                      <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                      Secure payment processing
                    </div>
                    <div className="flex items-center text-sm text-gray-600">
                      <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                      Cash on delivery available
                    </div>
                    <div className="flex items-center text-sm text-gray-600">
                      <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                      Delivery within Botswana only
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
