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
import { Lock, CreditCard, CheckCircle } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import type { Product } from "@shared/schema";

const checkoutSchema = z.object({
  firstName: z.string().min(2, "First name must be at least 2 characters"),
  lastName: z.string().min(2, "Last name must be at least 2 characters"),
  email: z.string().email("Please enter a valid email address"),
  phone: z.string().min(10, "Please enter a valid phone number"),
  address: z.string().min(5, "Please enter a complete address"),
  city: z.string().min(2, "Please enter a valid city"),
  state: z.string().min(2, "Please select a state"),
  zipCode: z.string().min(5, "Please enter a valid ZIP code"),
  paymentMethod: z.enum(["credit", "paypal", "cash"], {
    required_error: "Please select a payment method",
  }),
});

type CheckoutFormData = z.infer<typeof checkoutSchema>;

export default function Checkout() {
  const [, setLocation] = useLocation();
  const { items, itemCount, clearCart } = useCart();
  const { toast } = useToast();

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
      paymentMethod: "credit",
    },
  });

  // Fetch product details for cart items
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

  const subtotal = cartItemsWithProducts.reduce((total, item) => {
    return total + (item.product ? parseFloat(item.product.price) * item.quantity : 0);
  }, 0);

  const shipping = subtotal > 75 ? 0 : 9.99;
  const tax = subtotal * 0.08;
  const total = subtotal + shipping + tax;

  const createOrderMutation = useMutation({
    mutationFn: async (orderData: CheckoutFormData) => {
      const orderItems = cartItemsWithProducts.map(item => ({
        productId: item.productId,
        productName: item.product?.name || "",
        productPrice: item.product?.price || "0",
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
          subtotal: subtotal.toString(),
          shipping: shipping.toString(),
          tax: tax.toString(),
          total: total.toString(),
          status: "pending",
        },
        items: orderItems,
      };

      await apiRequest("POST", "/api/orders", orderPayload);
    },
    onSuccess: () => {
      toast({
        title: "Order placed successfully!",
        description: "You will receive a confirmation email shortly.",
      });
      clearCart();
      setLocation("/");
    },
    onError: (error) => {
      toast({
        title: "Order failed",
        description: error.message || "There was an error processing your order.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: CheckoutFormData) => {
    createOrderMutation.mutate(data);
  };

  // Redirect if cart is empty
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
          {/* Checkout Form */}
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
                              <Input placeholder="John" {...field} />
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
                              <Input placeholder="Doe" {...field} />
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
                            <Input type="email" placeholder="john.doe@example.com" {...field} />
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
                            <Input type="tel" placeholder="(555) 123-4567" {...field} />
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
                            <Input placeholder="123 Main Street" {...field} />
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
                            <FormLabel>City</FormLabel>
                            <FormControl>
                              <Input placeholder="New York" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="state"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>State</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select State" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="AL">Alabama</SelectItem>
                                <SelectItem value="CA">California</SelectItem>
                                <SelectItem value="FL">Florida</SelectItem>
                                <SelectItem value="NY">New York</SelectItem>
                                <SelectItem value="TX">Texas</SelectItem>
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
                                  <RadioGroupItem value="credit" id="credit" />
                                  <label htmlFor="credit" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                    Credit Card
                                  </label>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <RadioGroupItem value="paypal" id="paypal" />
                                  <label htmlFor="paypal" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                    PayPal
                                  </label>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <RadioGroupItem value="cash" id="cash" />
                                  <label htmlFor="cash" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
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

                    <div className="pt-6">
                      <Button 
                        type="submit" 
                        className="w-full bg-primary hover:bg-gray-800"
                        disabled={createOrderMutation.isPending}
                      >
                        {createOrderMutation.isPending ? "Processing..." : "Place Order"}
                      </Button>
                    </div>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </div>

          {/* Order Summary */}
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
                        ${(parseFloat(item.product?.price || '0') * item.quantity).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>

                <Separator className="my-6" />

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Subtotal ({itemCount} items):</span>
                    <span>${subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Shipping:</span>
                    <span>{shipping === 0 ? "Free" : `$${shipping.toFixed(2)}`}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Tax:</span>
                    <span>${tax.toFixed(2)}</span>
                  </div>
                  <Separator className="my-2" />
                  <div className="flex justify-between text-lg font-bold">
                    <span>Total:</span>
                    <span className="text-secondary">${total.toFixed(2)}</span>
                  </div>
                </div>

                {/* Security Info */}
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <div className="space-y-2">
                    <div className="flex items-center text-sm text-gray-600">
                      <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                      Free shipping on orders over $75
                    </div>
                    <div className="flex items-center text-sm text-gray-600">
                      <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                      30-day return policy
                    </div>
                    <div className="flex items-center text-sm text-gray-600">
                      <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                      Secure payment processing
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
