import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import ProductCard from "@/components/ProductCard";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { useAuth } from "@/hooks/useAuth";
import type { Product } from "@shared/schema";

export default function Home() {
  const { user } = useAuth();

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
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      {/* Welcome Section */}
      <section className="bg-gradient-to-r from-primary to-gray-800 text-white py-8 sm:py-12">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold mb-3 sm:mb-4 leading-tight">
              Welcome back, {user?.firstName || 'Fashion Lover'}!
            </h1>
            <p className="text-base sm:text-lg md:text-xl text-gray-200 mb-6 sm:mb-8">
              Discover new arrivals and exclusive deals just for you
            </p>
            <div className="flex flex-row justify-center gap-3">
              <Button size="lg" className="bg-secondary hover:bg-yellow-600 h-9 px-5 text-sm sm:h-12 sm:px-8 sm:text-base" asChild>
                <Link href="/shop">
                  <span className="hidden sm:inline">Shop New Arrivals</span>
                  <span className="sm:hidden">Shop Now</span>
                </Link>
              </Button>
              <Button size="lg" variant="outline" className="text-white border-white hover:bg-white hover:text-primary h-9 px-5 text-sm sm:h-12 sm:px-8 sm:text-base" asChild>
                <Link href="/shop?featured=true">View Deals</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Hero Slider */}
      <section className="relative overflow-hidden">
        <div className="relative h-64 sm:h-80 md:h-96 lg:h-[400px]">
          <img 
            src="https://images.unsplash.com/photo-1441986300917-64674bd600d8?ixlib=rb-4.0.3&auto=format&fit=crop&w=1920&h=400" 
            alt="Fashion collection"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-black bg-opacity-30 flex items-center justify-center">
            <div className="text-center text-white px-4">
              <Badge className="bg-secondary text-white mb-3 sm:mb-4 text-sm sm:text-lg px-3 py-1 sm:px-4 sm:py-2">
                New Collection
              </Badge>
              <h2 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold mb-3 sm:mb-4 leading-tight">
                Spring/Summer 2024
              </h2>
              <p className="text-sm sm:text-base md:text-lg mb-4 sm:mb-6">
                Fresh styles, vibrant colors, perfect fits
              </p>
              <Button size="lg" className="bg-white text-primary hover:bg-gray-100 h-10 sm:h-12 text-sm sm:text-base" asChild>
                <Link href="/shop">
                  <span className="hidden sm:inline">Explore Collection</span>
                  <span className="sm:hidden">Explore</span>
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Category Grid */}
      <section className="py-12 sm:py-16 bg-white">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl sm:text-3xl font-bold text-center mb-8 sm:mb-12 text-primary">
            Shop by Category
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6 md:gap-8">
            {categories.slice(0, 3).map((category: any) => (
              <Link key={category.id} href={`/shop?category=${category.slug}`}>
                <div className="group cursor-pointer">
                  <div className="relative overflow-hidden rounded-lg">
                    <img 
                      src={category.imageUrl || "https://images.unsplash.com/photo-1441984904996-e0b6ba687e04?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=300"} 
                      alt={category.name}
                      className="w-full h-48 sm:h-56 md:h-64 object-cover group-hover:scale-110 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-black bg-opacity-20 group-hover:bg-opacity-40 transition-colors duration-300" />
                    <div className="absolute bottom-3 sm:bottom-4 left-3 sm:left-4 right-3 sm:right-4 text-white">
                      <h3 className="text-lg sm:text-xl font-semibold mb-1 sm:mb-2">{category.name}</h3>
                      <p className="text-xs sm:text-sm opacity-90 line-clamp-2">{category.description}</p>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Products */}
      <section className="py-12 sm:py-16 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 sm:mb-12 space-y-4 sm:space-y-0">
            <h2 className="text-2xl sm:text-3xl font-bold text-primary">Featured Products</h2>
            <Button variant="outline" className="self-start sm:self-auto text-sm sm:text-base h-9 sm:h-10" asChild>
              <Link href="/shop">
                <span className="hidden sm:inline">View All Products</span>
                <span className="sm:hidden">View All</span>
              </Link>
            </Button>
          </div>
          
          {featuredProducts.length === 0 ? (
            <div className="text-center py-8 sm:py-12">
              <p className="text-gray-500 text-base sm:text-lg mb-4">
                No featured products available at the moment.
              </p>
              <Button className="text-sm sm:text-base h-9 sm:h-10" asChild>
                <Link href="/shop">Browse All Products</Link>
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
              {featuredProducts.slice(0, 8).map((product: Product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Special Offers */}
      <section className="py-12 sm:py-16 bg-white">
        <div className="container mx-auto px-4">
          <div className="bg-gradient-to-r from-secondary to-yellow-600 rounded-2xl p-6 sm:p-8 md:p-12 text-white text-center">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-3 sm:mb-4 leading-tight">
              Special Offer
            </h2>
            <p className="text-base sm:text-lg md:text-xl mb-4 sm:mb-6">
              Get 20% off your first order with code WELCOME20
            </p>
            <div className="flex flex-row justify-center gap-3">
              <Button size="lg" className="bg-white text-secondary hover:bg-gray-100 h-9 px-5 text-sm sm:h-12 sm:px-8 sm:text-base" asChild>
                <Link href="/shop">Shop Now</Link>
              </Button>
              <Button size="lg" variant="outline" className="text-white border-white hover:bg-white hover:text-secondary h-9 px-5 text-sm sm:h-12 sm:px-8 sm:text-base">
                Learn More
              </Button>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
