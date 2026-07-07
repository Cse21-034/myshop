import { useEffect, useState, lazy, Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { Headphones, ShoppingBag, Truck, Shield, Star } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getQueryFn, createQueryKey, BASE_URL } from "@/lib/queryClient";
import ProductCard from "@/components/ProductCard";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import type { Product, Category } from "@shared/schema";

const AuthModal = lazy(() => import("@/components/AuthModal"));

export default function Landing() {
  const queryClient = useQueryClient();
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authTab, setAuthTab] = useState<"login" | "register">("login");

  function openAuth(tab: "login" | "register") {
    setAuthTab(tab);
    setAuthModalOpen(true);
  }

  // Fetch featured products
  const { data: featuredProducts = [], error: productsError } = useQuery({
    queryKey: createQueryKey("/api/products", { featured: true, active: true }),
    queryFn: getQueryFn({ on401: "returnNull" }),
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  // Fetch categories
  const { data: categories = [], error: categoriesError } = useQuery({
    queryKey: createQueryKey("/api/categories"),
    queryFn: getQueryFn({ on401: "returnNull" }),
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  // Debug logging
  useEffect(() => {
    console.log("BASE_URL:", BASE_URL);
    console.log("Categories data:", categories);
    if (categoriesError) {
      console.error("Categories fetch error:", categoriesError);
    }
    if (productsError) {
      console.error("Products fetch error:", productsError);
    }
  }, [categories, categoriesError, productsError]);

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="relative h-64 sm:h-80 md:h-96 lg:h-[500px]">
          <img 
            src="https://images.unsplash.com/photo-1441986300917-64674bd600d8?ixlib=rb-4.0.3&auto=format&fit=crop&w=1920&h=500" 
            alt="Fashion collection lifestyle"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center">
            <div className="text-center text-white px-4 max-w-4xl mx-auto">
              <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-6xl font-bold mb-3 sm:mb-4 leading-tight">
                New Collection
              </h1>
              <p className="text-sm sm:text-base md:text-lg lg:text-xl mb-6 sm:mb-8 px-2">
                Discover the latest trends in fashion, footwear, and accessories
              </p>
              <div className="flex flex-col sm:flex-row justify-center space-y-3 sm:space-y-0 sm:space-x-4">
                <Button 
                  size="lg"
                  className="bg-secondary hover:bg-yellow-600 text-white px-6 py-2 sm:px-8 sm:py-3 h-10 sm:h-12 text-sm sm:text-base"
                  asChild
                >
                  <Link href="/shop">Shop Now</Link>
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="text-white border-white hover:bg-white hover:text-black px-6 py-2 sm:px-8 sm:py-3 h-10 sm:h-12 text-sm sm:text-base"
                  onClick={() => openAuth("login")}
                >
                  <span className="hidden sm:inline">Sign In to Shop</span>
                  <span className="sm:hidden">Sign In</span>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-12 sm:py-16 bg-white">
        <div className="container mx-auto px-[10px] sm:px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 md:gap-8">
            <div className="text-center">
              <div className="w-12 h-12 sm:w-16 sm:h-16 bg-secondary rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
                <Truck className="h-6 w-6 sm:h-8 sm:w-8 text-white" />
              </div>
              <h3 className="font-semibold mb-1 sm:mb-2 text-sm sm:text-base">Free Shipping</h3>
              <p className="text-gray-600 text-xs sm:text-sm">On orders over $75</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 sm:w-16 sm:h-16 bg-secondary rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
                <Shield className="h-6 w-6 sm:h-8 sm:w-8 text-white" />
              </div>
              <h3 className="font-semibold mb-1 sm:mb-2 text-sm sm:text-base">Secure Payment</h3>
              <p className="text-gray-600 text-xs sm:text-sm">100% secure transactions</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 sm:w-16 sm:h-16 bg-secondary rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
                <Star className="h-6 w-6 sm:h-8 sm:w-8 text-white" />
              </div>
              <h3 className="font-semibold mb-1 sm:mb-2 text-sm sm:text-base">Quality Products</h3>
              <p className="text-gray-600 text-xs sm:text-sm">Premium materials & craftsmanship</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 sm:w-16 sm:h-16 bg-secondary rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
                <ShoppingBag className="h-6 w-6 sm:h-8 sm:w-8 text-white" />
              </div>
              <h3 className="font-semibold mb-1 sm:mb-2 text-sm sm:text-base">Easy Returns</h3>
              <p className="text-gray-600 text-xs sm:text-sm">30-day return policy</p>
            </div>
          </div>
        </div>
      </section>

      {/* Category Grid */}
      <section className="py-12 sm:py-16 bg-gray-50">
        <div className="container mx-auto px-[10px] sm:px-4">
          <h2 className="text-2xl sm:text-3xl font-bold text-center mb-8 sm:mb-12 text-primary">
            Shop by Category
          </h2>
          {categoriesError ? (
            <p className="text-center text-red-600 text-sm sm:text-base">
              Error loading categories: {categoriesError.message}
            </p>
          ) : categories.length === 0 ? (
            <p className="text-center text-gray-600 text-sm sm:text-base">No categories available.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6 md:gap-8">
              {categories.slice(0, 3).map((category: Category) => (
                <div key={category.id} className="group cursor-pointer">
                  <img 
                    src={category.imageUrl || "https://images.unsplash.com/photo-1441984904996-e0b6ba687e04?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=300"} 
                    alt={category.name}
                    className="w-full h-48 sm:h-56 md:h-64 object-cover rounded-lg group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="mt-3 sm:mt-4 text-center">
                    <h3 className="text-lg sm:text-xl font-semibold text-primary">{category.name}</h3>
                    <p className="text-gray-600 mt-1 sm:mt-2 text-sm sm:text-base line-clamp-2">
                      {category.description}
                    </p>
                    <Button className="mt-3 sm:mt-4 h-8 sm:h-10 text-xs sm:text-sm" variant="outline" asChild>
                      <Link href={`/shop?category=${category.slug}`}>
                        <span className="hidden sm:inline">Browse {category.name}</span>
                        <span className="sm:hidden">Browse</span>
                      </Link>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Featured Products */}
      {productsError ? (
        <p className="text-center text-red-600 py-8 text-sm sm:text-base">
          Error loading products: {productsError.message}
        </p>
      ) : featuredProducts.length > 0 && (
        <section className="py-12 sm:py-16 bg-white">
          <div className="container mx-auto px-[10px] sm:px-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 sm:mb-12 space-y-4 sm:space-y-0">
              <h2 className="text-2xl sm:text-3xl font-bold text-primary">Featured Products</h2>
              <Button variant="outline" className="self-start sm:self-auto h-9 sm:h-10 text-sm sm:text-base" asChild>
                <Link href="/shop">
                  <span className="hidden sm:inline">View All Products</span>
                  <span className="sm:hidden">View All</span>
                </Link>
              </Button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
              {featuredProducts.slice(0, 4).map((product: Product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Call to Action */}
      <section className="py-12 sm:py-16 bg-primary text-white">
        <div className="container mx-auto px-[10px] sm:px-4 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold mb-3 sm:mb-4 leading-tight">
            Ready to Start Shopping?
          </h2>
          <p className="text-base sm:text-xl mb-6 sm:mb-8 text-gray-200 px-2">
            Join thousands of satisfied customers and discover your perfect style
          </p>
          <div className="flex flex-col sm:flex-row justify-center space-y-3 sm:space-y-0 sm:space-x-4">
            <Button
              size="lg"
              className="bg-secondary hover:bg-yellow-600 text-white px-6 py-2 sm:px-8 sm:py-3 h-10 sm:h-12 text-sm sm:text-base"
              onClick={() => openAuth("register")}
            >
              <span className="hidden sm:inline">Create Account</span>
              <span className="sm:hidden">Sign Up</span>
            </Button>
            <Button 
              size="lg"
              variant="outline"
              className="text-white border-white hover:bg-white hover:text-primary px-6 py-2 sm:px-8 sm:py-3 h-10 sm:h-12 text-sm sm:text-base"
              asChild
            >
              <Link href="/shop">
                <span className="hidden sm:inline">Browse Products</span>
                <span className="sm:hidden">Browse</span>
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <Footer />

      <Suspense fallback={null}>
        <AuthModal open={authModalOpen} onOpenChange={setAuthModalOpen} defaultTab={authTab} />
      </Suspense>
    </div>
  );
}
