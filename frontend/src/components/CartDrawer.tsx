import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetClose } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useCart } from "@/context/CartContext";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Minus, Plus, X } from "lucide-react";
import type { Product } from "@shared/schema";

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CartDrawer({ isOpen, onClose }: CartDrawerProps) {
  const { items, updateQuantity, removeItem, itemCount } = useCart();

  // Fetch product details for cart items
  const { data: products = [] } = useQuery({
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

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="w-96 p-6">
        <SheetHeader>
          <SheetTitle className="flex items-center justify-between">
            Shopping Cart
            <Badge variant="secondary">{itemCount} items</Badge>
          </SheetTitle>
        </SheetHeader>

        <div className="flex flex-col h-full">
          {/* Cart Items */}
          <div className="flex-1 overflow-y-auto mt-6">
            {cartItemsWithProducts.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500 mb-4">Your cart is empty</p>
                <Button onClick={onClose} asChild>
                  <Link href="/shop">Continue Shopping</Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {cartItemsWithProducts.map((item) => (
                  <div key={item.id} className="flex items-center space-x-4 p-4 border border-gray-200 rounded-lg">
                    <img 
                      src={item.product?.images?.[0] || "https://images.unsplash.com/photo-1441986300917-64674bd600d8?ixlib=rb-4.0.3&auto=format&fit=crop&w=100&h=100"} 
                      alt={item.product?.name || 'Product'}
                      className="w-16 h-16 object-cover rounded"
                    />
                    <div className="flex-1">
                      <h4 className="font-medium text-sm">{item.product?.name}</h4>
                      {item.size && <p className="text-xs text-gray-600">Size: {item.size}</p>}
                      {item.color && <p className="text-xs text-gray-600">Color: {item.color}</p>}
                      <p className="text-secondary font-semibold">${item.product?.price}</p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button 
                        className="w-8 h-8 flex items-center justify-center border border-gray-300 rounded hover:bg-gray-100"
                        onClick={() => updateQuantity(item.id, Math.max(1, item.quantity - 1))}
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="w-8 text-center">{item.quantity}</span>
                      <button 
                        className="w-8 h-8 flex items-center justify-center border border-gray-300 rounded hover:bg-gray-100"
                        onClick={() => updateQuantity(item.id, item.quantity + 1)}
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                      <button 
                        className="w-8 h-8 flex items-center justify-center text-red-500 hover:bg-red-50 rounded"
                        onClick={() => removeItem(item.id)}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Cart Summary */}
          {cartItemsWithProducts.length > 0 && (
            <div className="border-t pt-4 mt-4">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
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
                <div className="flex justify-between font-bold text-lg">
                  <span>Total:</span>
                  <span className="text-secondary">${total.toFixed(2)}</span>
                </div>
              </div>
              
              <div className="space-y-2 mt-4">
                <Button asChild className="w-full bg-primary hover:bg-gray-800">
                  <Link href="/checkout" onClick={onClose}>
                    Proceed to Checkout
                  </Link>
                </Button>
                <Button variant="outline" asChild className="w-full">
                  <Link href="/cart" onClick={onClose}>
                    View Cart
                  </Link>
                </Button>
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
