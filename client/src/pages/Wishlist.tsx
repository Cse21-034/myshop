import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bookmark, ShoppingCart, Trash2, ArrowLeft } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

const backendURL = (import.meta.env.VITE_API_BASE_URL || "https://myshop-test-backend.onrender.com").replace(/\/$/, "");
const USD_TO_BWP = 13.5;

function fmtBWP(usd: string | undefined) {
  if (!usd) return "P 0.00";
  const n = parseFloat(usd);
  return isNaN(n) ? "P 0.00" : `P ${(n * USD_TO_BWP).toLocaleString("en-BW", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function WishlistPage() {
  const { addToCart } = useCart();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: items = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/wishlist"],
    queryFn: () => fetch(`${backendURL}/api/wishlist`, { credentials: "include" }).then((r) => {
      if (!r.ok) throw new Error("Failed to load wishlist");
      return r.json();
    }),
  });

  const removeMutation = useMutation({
    mutationFn: (productId: number) => apiRequest("POST", `/api/products/${productId}/wishlist`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/wishlist"] });
      toast({ title: "Removed from wishlist" });
    },
  });

  const handleAddToCart = (item: any) => {
    addToCart(item.product.id, 1, undefined, undefined);
    toast({ title: "Added to cart", description: item.product.name });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="container mx-auto px-[5px] sm:px-4 py-8">
        <Button variant="outline" className="mb-6 text-sm h-9" asChild>
          <Link href="/shop"><ArrowLeft className="h-4 w-4 mr-1" />Back to Shop</Link>
        </Button>

        <div className="flex items-center gap-3 mb-8">
          <Bookmark className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold text-primary">My Wishlist</h1>
          {items.length > 0 && <Badge variant="secondary">{items.length}</Badge>}
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-100 animate-pulse">
                <div className="h-48 bg-gray-200 rounded-t-xl" />
                <div className="p-4 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-3/4" />
                  <div className="h-4 bg-gray-200 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-24">
            <Bookmark className="h-16 w-16 text-gray-200 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-500 mb-2">Your wishlist is empty</h2>
            <p className="text-gray-400 mb-6">Save products you love by clicking the bookmark icon on any product.</p>
            <Button asChild>
              <Link href="/shop">Browse Products</Link>
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {items.map((item: any) => {
              const p = item.product;
              const image = p.images?.[0] ?? p.imageUrls?.[0] ?? "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&h=400&fit=crop";
              const discountPct = p.originalPrice ? Math.round(((parseFloat(p.originalPrice) - parseFloat(p.price)) / parseFloat(p.originalPrice)) * 100) : 0;

              return (
                <div key={item.id} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden group">
                  <Link href={`/product/${p.id}`}>
                    <div className="relative h-48 overflow-hidden">
                      <img src={image} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                      {discountPct > 0 && <Badge variant="destructive" className="absolute top-2 left-2 text-xs">{discountPct}% OFF</Badge>}
                    </div>
                  </Link>
                  <div className="p-4">
                    <Link href={`/product/${p.id}`}>
                      <h3 className="font-semibold text-sm text-gray-900 mb-1 line-clamp-2 hover:text-primary transition-colors">{p.name}</h3>
                    </Link>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-base font-bold text-primary">{fmtBWP(p.price)}</span>
                      {p.originalPrice && <span className="text-xs text-gray-400 line-through">{fmtBWP(p.originalPrice)}</span>}
                    </div>
                    <p className="text-xs text-gray-500 mb-3">{(p.stock ?? 0) > 0 ? `${p.stock} in stock` : <span className="text-red-500">Out of stock</span>}</p>
                    <div className="flex gap-2">
                      <Button size="sm" className="flex-1 h-8 text-xs gap-1" onClick={() => handleAddToCart(item)} disabled={(p.stock ?? 0) <= 0}>
                        <ShoppingCart className="h-3 w-3" />Add to Cart
                      </Button>
                      <Button size="sm" variant="outline" className="h-8 w-8 p-0 text-gray-400 hover:text-red-500 hover:border-red-300" onClick={() => removeMutation.mutate(p.id)} title="Remove">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
}
