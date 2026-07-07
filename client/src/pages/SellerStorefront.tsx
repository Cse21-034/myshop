import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { MapPin, Clock, Star, Package, Award, Phone, Calendar } from "lucide-react";

const USD_TO_BWP = 13.5;
function fmtBWP(price: string | number) {
  const n = typeof price === "string" ? parseFloat(price) : price;
  return `P ${(n * USD_TO_BWP).toLocaleString("en-BW", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const BACKEND = (import.meta.env.VITE_API_BASE_URL || "https://myshop-test-backend.onrender.com").replace(/\/$/, "");

export default function SellerStorefront() {
  const { id } = useParams<{ id: string }>();

  const { data, isLoading, error } = useQuery({
    queryKey: ["store", id],
    queryFn: async () => {
      const res = await fetch(`${BACKEND}/api/stores/${id}`);
      if (!res.ok) throw new Error("Store not found");
      return res.json();
    },
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="flex items-center justify-center py-32">
          <p className="text-gray-400">Loading store…</p>
        </div>
        <Footer />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="flex flex-col items-center justify-center py-32 text-center">
          <p className="text-xl font-semibold text-gray-700 mb-2">Store not found</p>
          <p className="text-gray-400 text-sm mb-6">This store may not exist or is not yet approved.</p>
          <Link href="/shop" className="text-primary underline text-sm">Browse the shop</Link>
        </div>
        <Footer />
      </div>
    );
  }

  const { seller, products, avgRating, totalReviews } = data;

  // Update page title
  document.title = `${seller.storeName} — Fountstream`;

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      {/* Store banner */}
      <div className="bg-primary text-white">
        <div className="container mx-auto px-4 py-10 max-w-6xl">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
            {/* Logo */}
            {seller.logoUrl ? (
              <img
                src={seller.logoUrl}
                alt={seller.storeName}
                className="w-20 h-20 rounded-2xl object-cover border-2 border-white/20 shrink-0"
              />
            ) : (
              <div className="w-20 h-20 rounded-2xl bg-white/20 flex items-center justify-center text-3xl font-bold shrink-0">
                {seller.storeName?.[0] ?? "S"}
              </div>
            )}

            {/* Store info */}
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h1 className="text-2xl font-bold">{seller.storeName}</h1>
                <Badge className="bg-white/20 text-white border-white/30 text-xs">Verified Seller</Badge>
              </div>

              {seller.description && (
                <p className="text-white/80 text-sm max-w-lg leading-relaxed mb-3">{seller.description}</p>
              )}

              <div className="flex flex-wrap gap-4 text-sm text-white/80">
                {avgRating && (
                  <span className="flex items-center gap-1">
                    <Star className="h-4 w-4 fill-amber-300 text-amber-300" />
                    <strong className="text-white">{avgRating}</strong>
                    <span>({totalReviews} reviews)</span>
                  </span>
                )}
                {seller.location && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-4 w-4" />{seller.location}
                  </span>
                )}
                {seller.tradingHours && (
                  <span className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />{seller.tradingHours}
                  </span>
                )}
                {seller.yearFounded && (
                  <span className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />Est. {seller.yearFounded}
                  </span>
                )}
              </div>
            </div>

            {/* Quick stats */}
            <div className="flex gap-4 shrink-0 text-center">
              <div className="bg-white/10 rounded-xl px-4 py-3">
                <p className="text-2xl font-bold">{products.length}</p>
                <p className="text-xs text-white/70">Products</p>
              </div>
              {totalReviews > 0 && (
                <div className="bg-white/10 rounded-xl px-4 py-3">
                  <p className="text-2xl font-bold">{avgRating}</p>
                  <p className="text-xs text-white/70">Avg Rating</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Store details bar */}
      {(seller.phone || seller.responseTime || seller.onTimeDeliveryRate || seller.services) && (
        <div className="bg-white border-b border-gray-100">
          <div className="container mx-auto px-4 max-w-6xl py-3 flex flex-wrap gap-5 text-sm text-gray-600">
            {seller.phone && (
              <span className="flex items-center gap-1.5">
                <Phone className="h-4 w-4 text-gray-400" />{seller.phone}
              </span>
            )}
            {seller.responseTime && (
              <span className="flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-gray-400" />Responds {seller.responseTime}
              </span>
            )}
            {seller.onTimeDeliveryRate && (
              <span className="flex items-center gap-1.5">
                <Award className="h-4 w-4 text-gray-400" />{seller.onTimeDeliveryRate}% on-time delivery
              </span>
            )}
            {seller.services && (
              <span className="flex items-center gap-1.5">
                <Package className="h-4 w-4 text-gray-400" />{seller.services}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Products grid */}
      <main className="container mx-auto px-4 py-8 max-w-6xl">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Products <span className="text-gray-400 font-normal">({products.length})</span>
        </h2>

        {products.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Package className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>No products listed yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {products.map((product: any) => (
              <Link key={product.id} href={`/product/${product.id}`}>
                <Card className="border-0 shadow-sm hover:shadow-md transition-shadow cursor-pointer group overflow-hidden">
                  <div className="aspect-square overflow-hidden bg-gray-100">
                    <img
                      src={product.images?.[0] || product.imageUrls?.[0] || "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=400&h=400&fit=crop"}
                      alt={product.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                  <CardContent className="p-3">
                    <p className="font-medium text-sm text-gray-900 truncate leading-tight mb-1">{product.name}</p>
                    <p className="text-sm font-bold text-primary">{fmtBWP(product.price)}</p>
                    {product.originalPrice && parseFloat(product.originalPrice) > parseFloat(product.price) && (
                      <p className="text-xs text-gray-400 line-through">{fmtBWP(product.originalPrice)}</p>
                    )}
                    {(product.stock ?? 0) === 0 && (
                      <Badge variant="secondary" className="text-[10px] mt-1">Out of stock</Badge>
                    )}
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
