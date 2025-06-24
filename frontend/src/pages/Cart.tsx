import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useCart } from "@/context/CartContext";
import { Minus, Plus, X, ShoppingBag, ArrowRight } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import type { Product } from "@shared/schema";

export default function Cart() {
  const { items, updateQuantity, removeItem, clearCart, itemCount } = useCart();

  // Fetch product details for cart items
  const { data: products = [], isLoading } = useQuery({
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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/4 mb-6" />
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-4">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-32 bg-gray-200 rounded-lg" />
                ))}
              </div>
              <div className="h-64 bg-gray-200 rounded-lg" />
            </div>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-primary">Shopping Cart</h1>
          <Badge variant="secondary" className="text-lg px-3 py-1">
            {itemCount} {itemCount === 1 ? 'item' : 'items'}
          </Badge>
        </div>

        {cartItemsWithProducts.length === 0 ? (
          <div className="text-center py-16">
            <div className="max-w-md mx-auto">
              <div className="w-24 h-24 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-6">
                <ShoppingBag className="h-12 w-12 text-gray-400" />
              </div>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">Your cart is empty</h2>
              <p className="text-gray-600 mb-8">
                Looks like you haven't added any items to your cart yet.
              </p>
              <Button size="lg" asChild>
                <Link href="/shop">Start Shopping</Link>
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Cart Items */}
            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Items in your cart</CardTitle>
                    <Button variant="ghost" onClick={clearCart} className="text-red-500 hover:text-red-700">
                      Clear Cart
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    {cartItemsWithProducts.map((item, index) => (
                      <div key={item.id}>
                        <div className="flex items-center space-x-4">
                          <div className="relative">
                            <img 
                              src={item.product?.images?.[0] || "https://images.unsplash.com/photo-1441986300917-64674bd600d8?ixlib=rb-4.0.3&auto=format&fit=crop&w=150&h=150"} 
                              alt={item.product?.name || 'Product'}
                              className="w-20 h-20 object-cover rounded-lg"
                            />
                          </div>
                          
                          <div className="flex-1">
                            <h3 className="font-semibold text-lg">{item.product?.name}</h3>
                            <div className="text-sm text-gray-600 space-y-1">
                              {item.size && <p>Size: {item.size}</p>}
                              {item.color && <p>Color: {item.color}</p>}
                            </div>
                            <p className="text-secondary font-bold text-lg">${item.product?.price}</p>
                          </div>

                          <div className="flex items-center space-x-3">
                            <button 
                              className="w-10 h-10 flex items-center justify-center border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
                              onClick={() => updateQuantity(item.id, Math.max(1, item.quantity - 1))}
                            >
                              <Minus className="h-4 w-4" />
                            </button>
                            <span className="w-12 text-center font-semibold">{item.quantity}</span>
                            <button 
                              className="w-10 h-10 flex items-center justify-center border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
                              onClick={() => updateQuantity(item.id, item.quantity + 1)}
                            >
                              <Plus className="h-4 w-4" />
                            </button>
                          </div>

                          <div className="text-right">
                            <p className="font-bold text-lg">
                              ${(parseFloat(item.product?.price || '0') * item.quantity).toFixed(2)}
                            </p>
                            <button 
                              className="text-red-500 hover:text-red-700 mt-2"
                              onClick={() => removeItem(item.id)}
                            >
                              <X className="h-5 w-5" />
                            </button>
                          </div>
                        </div>
                        {index < cartItemsWithProducts.length - 1 && <Separator className="mt-6" />}
                      </div>
                    ))}
                  </div>
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
                    <Separator />
                    <div className="flex justify-between text-lg font-bold">
                      <span>Total:</span>
                      <span className="text-secondary">${total.toFixed(2)}</span>
                    </div>

                    {subtotal < 75 && (
                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mt-4">
                        <p className="text-sm text-yellow-800">
                          Add ${(75 - subtotal).toFixed(2)} more to get free shipping!
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="space-y-3 mt-6">
                    <Button asChild className="w-full bg-primary hover:bg-gray-800">
                      <Link href="/checkout">
                        Proceed to Checkout
                        <ArrowRight className="h-4 w-4 ml-2" />
                      </Link>
                    </Button>
                    <Button variant="outline" asChild className="w-full">
                      <Link href="/shop">Continue Shopping</Link>
                    </Button>
                  </div>

                  {/* Security badges */}
                  <div className="mt-6 pt-6 border-t border-gray-200">
                    <div className="text-center">
                      <p className="text-sm text-gray-600 mb-2">Secure checkout guaranteed</p>
                      <div className="flex justify-center items-center space-x-2 text-xs text-gray-500">
                        <span>SSL Encrypted</span>
                        <span>•</span>
                        <span>Safe & Secure</span>
                        <span>•</span>
                        <span>30-Day Returns</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
}
