import { useState } from "react";
import { useParams, Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Star, Check, ArrowLeft, Heart, Bookmark, ShieldCheck } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ProductCard from "@/components/ProductCard";
import type { Product } from "@shared/schema";

const backendURL = (import.meta.env.VITE_API_BASE_URL || "https://myshop-test-backend.onrender.com").replace(/\/$/, "");
const USD_TO_BWP = 13.5;

function fmtBWP(usd: string | undefined) {
  if (!usd) return "P 0.00";
  const n = parseFloat(usd);
  return isNaN(n) ? "P 0.00" : `P ${(n * USD_TO_BWP).toLocaleString("en-BW", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ─── Star display ─────────────────────────────────────────────────────────────

function StarDisplay({ rating, size = "sm" }: { rating: number; size?: "sm" | "md" }) {
  const cls = size === "md" ? "h-5 w-5" : "h-3.5 w-3.5";
  return (
    <div className="flex">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`${cls} ${i <= Math.round(rating) ? "text-yellow-400 fill-current" : "text-gray-200 fill-current"}`}
        />
      ))}
    </div>
  );
}

// ─── Interactive star picker ──────────────────────────────────────────────────

function StarPicker({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const [hovered, setHovered] = useState(0);
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((i) => (
        <button
          key={i}
          type="button"
          onClick={() => onChange(i)}
          onMouseEnter={() => setHovered(i)}
          onMouseLeave={() => setHovered(0)}
          className="focus:outline-none"
        >
          <Star className={`h-7 w-7 transition-colors ${i <= (hovered || value) ? "text-yellow-400 fill-current" : "text-gray-200 fill-current"}`} />
        </button>
      ))}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ProductPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const { addToCart } = useCart();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selectedSize, setSelectedSize] = useState("");
  const [selectedColor, setSelectedColor] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [mainImage, setMainImage] = useState(0);
  const [isZoomed, setIsZoomed] = useState(false);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  // Review form state
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewTitle, setReviewTitle] = useState("");
  const [reviewBody, setReviewBody] = useState("");

  // ── Data fetching ──────────────────────────────────────────────────────────

  const { data: product, isLoading } = useQuery<Product>({
    queryKey: ["product", id],
    queryFn: async () => {
      const res = await fetch(`${backendURL}/api/products/${id}`);
      if (!res.ok) throw new Error("Product not found");
      return res.json();
    },
    enabled: !!id,
  });

  const { data: social } = useQuery({
    queryKey: ["product-social", id, user?.id],
    queryFn: () => fetch(`${backendURL}/api/products/${id}/social`, { credentials: "include" }).then((r) => r.json()),
    enabled: !!id,
  });

  const { data: reviews = [] } = useQuery<any[]>({
    queryKey: ["product-reviews", id],
    queryFn: () => fetch(`${backendURL}/api/products/${id}/reviews`).then((r) => r.json()),
    enabled: !!id,
  });

  const { data: relatedProducts = [] } = useQuery({
    queryKey: ["related-products", product?.categoryId],
    queryFn: async () => {
      if (!product?.categoryId) return [];
      const res = await fetch(`${backendURL}/api/products?categoryId=${product.categoryId}&active=true`);
      if (!res.ok) return [];
      const data = await res.json();
      return (Array.isArray(data) ? data : data.data ?? []).filter((p: Product) => p.id !== product.id).slice(0, 4);
    },
    enabled: !!product?.categoryId,
  });

  // ── Mutations ──────────────────────────────────────────────────────────────

  const likeMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/products/${id}/like`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["product-social", id, user?.id] }),
    onError: () => toast({ title: "Please log in to like products", variant: "destructive" }),
  });

  const wishlistMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/products/${id}/wishlist`),
    onSuccess: (_, __, ctx) => {
      queryClient.invalidateQueries({ queryKey: ["product-social", id, user?.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/wishlist"] });
      const saved = !social?.wishlisted;
      toast({ title: saved ? "Added to wishlist" : "Removed from wishlist" });
    },
    onError: () => toast({ title: "Please log in to save to wishlist", variant: "destructive" }),
  });

  const reviewMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/products/${id}/reviews`, { rating: reviewRating, title: reviewTitle, body: reviewBody }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product-reviews", id] });
      queryClient.invalidateQueries({ queryKey: ["product-social", id, user?.id] });
      toast({ title: "Review submitted — thank you!" });
      setReviewRating(0); setReviewTitle(""); setReviewBody("");
    },
    onError: () => toast({ title: "Failed to submit review", variant: "destructive" }),
  });

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleAddToCart = () => {
    if (product?.sizes?.length && !selectedSize) {
      toast({ title: "Please select a size", variant: "destructive" }); return;
    }
    if (product?.colors?.length && !selectedColor) {
      toast({ title: "Please select a color", variant: "destructive" }); return;
    }
    addToCart(product!.id, quantity, selectedSize, selectedColor);
    toast({ title: "Added to cart", description: `${product!.name} has been added to your cart.` });
  };

  const handleImageInteraction = (e: React.MouseEvent) => e.preventDefault();

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setMousePosition({ x: ((e.clientX - rect.left) / rect.width) * 100, y: ((e.clientY - rect.top) / rect.height) * 100 });
  };

  // ── Loading / not found ────────────────────────────────────────────────────

  if (isLoading) return (
    <div className="min-h-screen bg-gray-50"><Header />
      <div className="container mx-auto px-4 py-8 animate-pulse">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div><div className="h-96 bg-gray-200 rounded-lg mb-4" /><div className="grid grid-cols-4 gap-2">{[...Array(4)].map((_, i) => <div key={i} className="h-20 bg-gray-200 rounded" />)}</div></div>
          <div className="space-y-4">{[...Array(5)].map((_, i) => <div key={i} className="h-6 bg-gray-200 rounded" />)}</div>
        </div>
      </div><Footer />
    </div>
  );

  if (!product) return (
    <div className="min-h-screen bg-gray-50"><Header />
      <div className="container mx-auto px-4 py-8 text-center">
        <h1 className="text-2xl font-bold mb-4">Product Not Found</h1>
        <Button asChild><Link href="/shop">Back to Shop</Link></Button>
      </div><Footer />
    </div>
  );

  const images = product.images?.length ? product.images : ["https://images.unsplash.com/photo-1542291026-7eec264c27ff?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&h=500"];
  const discountPct = product.originalPrice ? Math.round(((parseFloat(product.originalPrice) - parseFloat(product.price)) / parseFloat(product.originalPrice)) * 100) : 0;

  const avgRating = social?.avgRating ? parseFloat(social.avgRating) : 0;
  const reviewCount = social?.reviewCount ?? 0;
  const liked = social?.liked ?? false;
  const wishlisted = social?.wishlisted ?? false;
  const likeCount = social?.likeCount ?? 0;
  const canReview = social?.canReview ?? false;

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="container mx-auto px-4 py-4 sm:py-8">

        {/* Breadcrumb */}
        <div className="flex items-center space-x-2 text-xs sm:text-sm text-gray-600 mb-4">
          <Link href="/" className="hover:text-primary">Home</Link><span>/</span>
          <Link href="/shop" className="hover:text-primary">Shop</Link><span>/</span>
          <span className="text-primary truncate">{product.name}</span>
        </div>

        <Button variant="outline" className="mb-4 sm:mb-6 text-xs sm:text-sm h-8 sm:h-10" asChild>
          <Link href="/shop"><ArrowLeft className="h-3 w-3 sm:h-4 sm:w-4 mr-1" /><span className="hidden sm:inline">Back to Shop</span><span className="sm:hidden">Back</span></Link>
        </Button>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-12">

          {/* Images */}
          <div>
            <div className="mb-3 sm:mb-4">
              <div className="relative w-full h-64 sm:h-96 md:h-[500px] rounded-lg overflow-hidden cursor-crosshair"
                onMouseMove={handleMouseMove} onMouseEnter={() => setIsZoomed(true)} onMouseLeave={() => setIsZoomed(false)}>
                <img src={images[mainImage]} alt={product.name}
                  className={`w-full h-full object-cover select-none transition-transform duration-200 ${isZoomed ? "scale-150" : "scale-100"}`}
                  style={{ transformOrigin: `${mousePosition.x}% ${mousePosition.y}%`, userSelect: "none", pointerEvents: "none" }}
                  onContextMenu={handleImageInteraction} onDragStart={handleImageInteraction} />
                {!isZoomed && <div className="absolute top-2 right-2 bg-black bg-opacity-50 text-white text-xs px-2 py-1 rounded">Hover to zoom</div>}
              </div>
            </div>
            <div className="grid grid-cols-4 gap-1 sm:gap-2">
              {images.map((img, idx) => (
                <img key={idx} src={img} alt={`${product.name} ${idx + 1}`}
                  className={`w-full h-16 sm:h-20 object-cover rounded cursor-pointer border-2 transition-colors select-none ${mainImage === idx ? "border-secondary" : "border-transparent hover:border-secondary"}`}
                  onClick={() => setMainImage(idx)} onContextMenu={handleImageInteraction} onDragStart={handleImageInteraction}
                  style={{ userSelect: "none" }} />
              ))}
            </div>
          </div>

          {/* Details */}
          <div>
            <div className="flex items-start justify-between mb-3 sm:mb-4">
              <div>
                <h1 className="text-xl sm:text-3xl font-bold text-primary mb-2 leading-tight">{product.name}</h1>
                {product.featured && <Badge className="bg-secondary mb-2 text-xs px-2 py-1">Featured</Badge>}
              </div>
              {/* Like + Wishlist buttons */}
              <div className="flex gap-2">
                <button
                  onClick={() => likeMutation.mutate()}
                  className={`flex flex-col items-center gap-0.5 p-2 rounded-lg border transition-colors ${liked ? "bg-red-50 border-red-200 text-red-500" : "border-gray-200 text-gray-400 hover:border-red-200 hover:text-red-400"}`}
                  title="Like"
                >
                  <Heart className={`h-4 w-4 sm:h-5 sm:w-5 ${liked ? "fill-current" : ""}`} />
                  {likeCount > 0 && <span className="text-xs font-medium leading-none">{likeCount}</span>}
                </button>
                <button
                  onClick={() => wishlistMutation.mutate()}
                  className={`p-2 rounded-lg border transition-colors ${wishlisted ? "bg-primary/10 border-primary/30 text-primary" : "border-gray-200 text-gray-400 hover:border-primary/30 hover:text-primary"}`}
                  title={wishlisted ? "Remove from wishlist" : "Save to wishlist"}
                >
                  <Bookmark className={`h-4 w-4 sm:h-5 sm:w-5 ${wishlisted ? "fill-current" : ""}`} />
                </button>
              </div>
            </div>

            {/* Rating summary */}
            <div className="flex items-center gap-2 mb-3 sm:mb-4">
              <StarDisplay rating={avgRating} />
              <span className="text-sm font-semibold text-gray-700">{avgRating > 0 ? avgRating.toFixed(1) : "—"}</span>
              <span className="text-xs text-gray-500">({reviewCount} {reviewCount === 1 ? "review" : "reviews"})</span>
            </div>

            {/* Price */}
            <div className="mb-4 sm:mb-6">
              <div className="flex items-center space-x-2 mb-1">
                <span className="text-2xl sm:text-3xl font-bold text-secondary">{fmtBWP(product.price)}</span>
                {product.originalPrice && <span className="text-sm sm:text-lg text-gray-500 line-through">{fmtBWP(product.originalPrice)}</span>}
                {discountPct > 0 && <Badge variant="destructive" className="text-xs px-1">{discountPct}% OFF</Badge>}
              </div>
              <p className="text-xs sm:text-sm text-gray-600">{(product.stock ?? 0) > 0 ? `${product.stock} in stock` : "Out of stock"}</p>
            </div>

            <div className="mb-4 sm:mb-6">
              <p className="text-sm sm:text-base text-gray-700 leading-relaxed">
                {product.description || "Experience ultimate comfort and style with this premium product."}
              </p>
            </div>

            {/* Size */}
            {product.sizes?.length ? (
              <div className="mb-4 sm:mb-6">
                <h3 className="font-semibold mb-2 text-sm sm:text-base">Size</h3>
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                  {product.sizes.map((s) => (
                    <button key={s} onClick={() => setSelectedSize(s)}
                      className={`border px-2 py-1 sm:px-3 sm:py-2 rounded text-center text-xs sm:text-sm transition-colors ${selectedSize === s ? "border-secondary bg-secondary text-white" : "border-gray-300 hover:border-secondary"}`}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {/* Color */}
            {product.colors?.length ? (
              <div className="mb-4 sm:mb-6">
                <h3 className="font-semibold mb-2 text-sm sm:text-base">Color</h3>
                <div className="flex space-x-2">
                  {product.colors.map((c) => (
                    <button key={c} onClick={() => setSelectedColor(c)} title={c}
                      className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full border-4 transition-colors ${selectedColor === c ? "border-secondary" : "border-transparent hover:border-gray-300"}`}
                      style={{ backgroundColor: c.toLowerCase() }}>
                      {selectedColor === c && <Check className="h-3 w-3 sm:h-4 sm:w-4 text-white mx-auto" />}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {/* Quantity */}
            <div className="mb-4 sm:mb-6">
              <h3 className="font-semibold mb-2 text-sm sm:text-base">Quantity</h3>
              <div className="flex items-center space-x-3">
                <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center border border-gray-300 rounded hover:bg-gray-100 text-sm">-</button>
                <span className="text-base sm:text-lg font-semibold w-8 text-center">{quantity}</span>
                <button onClick={() => setQuantity(quantity + 1)} className="w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center border border-gray-300 rounded hover:bg-gray-100 text-sm">+</button>
              </div>
            </div>

            {/* Action buttons */}
            <div className="space-y-2 sm:space-y-3 mb-6 sm:mb-8">
              <Button className="w-full bg-primary hover:bg-gray-800 h-10 sm:h-12 text-sm sm:text-base" onClick={handleAddToCart} disabled={(product.stock ?? 0) <= 0}>
                {(product.stock ?? 0) <= 0 ? "Out of Stock" : "Add to Cart"}
              </Button>
              <Button variant="outline" className="w-full h-10 sm:h-12 text-sm sm:text-base">Buy Now</Button>
            </div>

            <Separator className="mb-4 sm:mb-6" />

            <div>
              <h3 className="font-semibold mb-2 text-sm sm:text-base">Features</h3>
              <ul className="space-y-1 sm:space-y-2 text-xs sm:text-sm text-gray-700">
                {["Free shipping on orders over P 1,012.50", "30-day return policy", "Premium materials", "1-year warranty"].map((f) => (
                  <li key={f} className="flex items-center"><Check className="h-3 w-3 sm:h-4 sm:w-4 text-green-500 mr-2 shrink-0" />{f}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* ── Reviews section ─────────────────────────────────────────────── */}
        <div className="mt-12 sm:mt-16">
          <h2 className="text-xl sm:text-2xl font-bold text-primary mb-6">Customer Reviews</h2>

          {/* Rating overview */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 mb-8 flex flex-col sm:flex-row items-center gap-6">
            <div className="text-center">
              <p className="text-5xl font-bold text-gray-900">{avgRating > 0 ? avgRating.toFixed(1) : "—"}</p>
              <StarDisplay rating={avgRating} size="md" />
              <p className="text-sm text-gray-500 mt-1">{reviewCount} {reviewCount === 1 ? "review" : "reviews"}</p>
            </div>
            <div className="flex-1 w-full space-y-2">
              {[5, 4, 3, 2, 1].map((star) => {
                const n = reviews.filter((r) => r.rating === star).length;
                const pct = reviewCount > 0 ? (n / reviewCount) * 100 : 0;
                return (
                  <div key={star} className="flex items-center gap-2 text-sm">
                    <span className="w-3 text-gray-600">{star}</span>
                    <Star className="h-3.5 w-3.5 text-yellow-400 fill-current" />
                    <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                      <div className="bg-yellow-400 h-2 rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="w-4 text-gray-500 text-xs">{n}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Write a review — verified purchasers only */}
          {canReview && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 mb-8">
              <h3 className="font-semibold text-base mb-4">Write a Review</h3>
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-gray-600 mb-2">Your rating</p>
                  <StarPicker value={reviewRating} onChange={setReviewRating} />
                </div>
                <Input placeholder="Review title (optional)" value={reviewTitle} onChange={(e) => setReviewTitle(e.target.value)} />
                <Textarea placeholder="Share your experience with this product…" rows={4} value={reviewBody} onChange={(e) => setReviewBody(e.target.value)} />
                <Button onClick={() => reviewRating > 0 && reviewMutation.mutate()} disabled={reviewRating === 0 || reviewMutation.isPending} className="gap-2">
                  {reviewMutation.isPending ? "Submitting…" : "Submit Review"}
                </Button>
              </div>
            </div>
          )}

          {!user && (
            <p className="text-sm text-gray-500 mb-8">
              <Link href="/" className="text-primary underline">Log in</Link> and purchase this product to leave a review.
            </p>
          )}

          {user && !canReview && !social?.userReview && (
            <p className="text-sm text-gray-500 mb-8">Only customers who have purchased this product can leave a review.</p>
          )}

          {/* User's existing review */}
          {social?.userReview && (
            <div className="bg-primary/5 border border-primary/10 rounded-xl p-5 mb-6">
              <div className="flex items-center gap-2 mb-2">
                <StarDisplay rating={social.userReview.rating} />
                <span className="text-xs text-gray-500">Your review</span>
                {social.userReview.verifiedPurchase && (
                  <span className="flex items-center gap-1 text-xs text-green-600"><ShieldCheck className="h-3 w-3" />Verified Purchase</span>
                )}
              </div>
              {social.userReview.title && <p className="font-semibold text-sm mb-1">{social.userReview.title}</p>}
              {social.userReview.body && <p className="text-sm text-gray-700">{social.userReview.body}</p>}
            </div>
          )}

          {/* All reviews */}
          {reviews.length === 0 ? (
            <p className="text-center text-gray-400 py-8">No reviews yet. Be the first!</p>
          ) : (
            <div className="space-y-4">
              {reviews.map((r) => (
                <div key={r.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <StarDisplay rating={r.rating} />
                        {r.verifiedPurchase && (
                          <span className="flex items-center gap-1 text-xs text-green-600"><ShieldCheck className="h-3 w-3" />Verified Purchase</span>
                        )}
                      </div>
                      {r.title && <p className="font-semibold text-sm mt-1">{r.title}</p>}
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-medium text-gray-700">{r.authorName}</p>
                      <p className="text-xs text-gray-400">{new Date(r.createdAt).toLocaleDateString("en-BW", { day: "numeric", month: "short", year: "numeric" })}</p>
                    </div>
                  </div>
                  {r.body && <p className="text-sm text-gray-700 leading-relaxed">{r.body}</p>}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Related products */}
        {relatedProducts.length > 0 && (
          <div className="mt-12 sm:mt-16">
            <h2 className="text-xl sm:text-2xl font-bold text-primary mb-6">Related Products</h2>
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
              {relatedProducts.map((p: Product) => <ProductCard key={p.id} product={p} />)}
            </div>
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
}
