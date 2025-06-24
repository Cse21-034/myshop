import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { Headphones, ShoppingBag, Truck, Shield, Star } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import ProductCard from "@/components/ProductCard";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import type { Product } from "@shared/schema";

export default function Landing() {
  const { data: featuredProducts = [] } = useQuery({
    queryKey: ["/api/products", { featured: true }],
    queryFn: async () => {
      const response = await fetch("/api/products?featured=true&active=true");
      if (!response.ok) throw new Error("Failed to fetch featured products");
      return response.json();
    },
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["/api/categories"],
    queryFn: async () => {
      const response = await fetch("/api/categories");
      if (!response.ok) throw new Error("Failed to fetch categories");
      return response.json();
    },
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="relative h-96 md:h-[500px]">
          <img 
            src="https://images.unsplash.com/photo-1441986300917-64674bd600d8?ixlib=rb-4.0.3&auto=format&fit=crop&w=1920&h=500" 
            alt="Fashion collection lifestyle"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center">
            <div className="text-center text-white px-4 max-w-4xl mx-auto">
              <h1 className="text-4xl md:text-6xl font-bold mb-4">New Collection</h1>
              <p className="text-lg md:text-xl mb-8">
                Discover the latest trends in fashion, footwear, and accessories
              </p>
              <div className="space-x-4">
                <Button 
                  size="lg"
                  className="bg-secondary hover:bg-yellow-600 text-white px-8 py-3"
                  asChild
                >
                  <Link href="/shop">Shop Now</Link>
                </Button>
                <Button 
                  size="lg"
                  variant="outline"
                  className="text-white border-white hover:bg-white hover:text-black px-8 py-3"
                  asChild
                >
                  <a href="/api/login">Sign In to Shop</a>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-secondary rounded-full flex items-center justify-center mx-auto mb-4">
                <Truck className="h-8 w-8 text-white" />
              </div>
              <h3 className="font-semibold mb-2">Free Shipping</h3>
              <p className="text-gray-600 text-sm">On orders over $75</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-secondary rounded-full flex items-center justify-center mx-auto mb-4">
                <Shield className="h-8 w-8 text-white" />
              </div>
              <h3 className="font-semibold mb-2">Secure Payment</h3>
              <p className="text-gray-600 text-sm">100% secure transactions</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-secondary rounded-full flex items-center justify-center mx-auto mb-4">
                <Star className="h-8 w-8 text-white" />
              </div>
              <h3 className="font-semibold mb-2">Quality Products</h3>
              <p className="text-gray-600 text-sm">Premium materials & craftsmanship</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-secondary rounded-full flex items-center justify-center mx-auto mb-4">
                <ShoppingBag className="h-8 w-8 text-white" />
              </div>
              <h3 className="font-semibold mb-2">Easy Returns</h3>
              <p className="text-gray-600 text-sm">30-day return policy</p>
            </div>
          </div>
        </div>
      </section>

      {/* Category Grid */}
      <section className="py-16 bg-gray-50">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12 text-primary">Shop by Category</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {categories.slice(0, 3).map((category: any) => (
              <div key={category.id} className="group cursor-pointer">
                <img 
                  src={category.imageUrl || "https://images.unsplash.com/photo-1441984904996-e0b6ba687e04?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=300"} 
                  alt={category.name}
                  className="w-full h-64 object-cover rounded-lg group-hover:scale-105 transition-transform duration-300"
                />
                <div className="mt-4 text-center">
                  <h3 className="text-xl font-semibold text-primary">{category.name}</h3>
                  <p className="text-gray-600 mt-2">{category.description}</p>
                  <Button className="mt-4" variant="outline" asChild>
                    <Link href={`/shop?category=${category.slug}`}>Browse {category.name}</Link>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Products */}
      {featuredProducts.length > 0 && (
        <section className="py-16 bg-white">
          <div className="container mx-auto px-4">
            <div className="flex items-center justify-between mb-12">
              <h2 className="text-3xl font-bold text-primary">Featured Products</h2>
              <Button variant="outline" asChild>
                <Link href="/shop">View All Products</Link>
              </Button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {featuredProducts.slice(0, 4).map((product: Product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Call to Action */}
      <section className="py-16 bg-primary text-white">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to Start Shopping?</h2>
          <p className="text-xl mb-8 text-gray-200">
            Join thousands of satisfied customers and discover your perfect style
          </p>
          <div className="space-x-4">
            <Button 
              size="lg"
              className="bg-secondary hover:bg-yellow-600 text-white px-8 py-3"
              asChild
            >
              <a href="/api/login">Create Account</a>
            </Button>
            <Button 
              size="lg"
              variant="outline"
              className="text-white border-white hover:bg-white hover:text-primary px-8 py-3"
              asChild
            >
              <Link href="/shop">Browse Products</Link>
            </Button>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
