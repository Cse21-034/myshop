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
      <section className="bg-gradient-to-r from-primary to-gray-800 text-white py-12">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              Welcome back, {user?.firstName || 'Fashion Lover'}!
            </h1>
            <p className="text-xl text-gray-200 mb-8">
              Discover new arrivals and exclusive deals just for you
            </p>
            <div className="flex justify-center space-x-4">
              <Button size="lg" className="bg-secondary hover:bg-yellow-600" asChild>
                <Link href="/shop">Shop New Arrivals</Link>
              </Button>
              <Button size="lg" variant="outline" className="text-white border-white hover:bg-white hover:text-primary" asChild>
                <Link href="/shop?featured=true">View Deals</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Hero Slider */}
      <section className="relative overflow-hidden">
        <div className="relative h-96 md:h-[400px]">
          <img 
            src="https://images.unsplash.com/photo-1441986300917-64674bd600d8?ixlib=rb-4.0.3&auto=format&fit=crop&w=1920&h=400" 
            alt="Fashion collection"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-black bg-opacity-30 flex items-center justify-center">
            <div className="text-center text-white px-4">
              <Badge className="bg-secondary text-white mb-4 text-lg px-4 py-2">
                New Collection
              </Badge>
              <h2 className="text-3xl md:text-4xl font-bold mb-4">Spring/Summer 2024</h2>
              <p className="text-lg mb-6">Fresh styles, vibrant colors, perfect fits</p>
              <Button size="lg" className="bg-white text-primary hover:bg-gray-100" asChild>
                <Link href="/shop">Explore Collection</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Category Grid */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12 text-primary">Shop by Category</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {categories.slice(0, 3).map((category: any) => (
              <Link key={category.id} href={`/shop?category=${category.slug}`}>
                <div className="group cursor-pointer">
                  <div className="relative overflow-hidden rounded-lg">
                    <img 
                      src={category.imageUrl || "https://images.unsplash.com/photo-1441984904996-e0b6ba687e04?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=300"} 
                      alt={category.name}
                      className="w-full h-64 object-cover group-hover:scale-110 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-black bg-opacity-20 group-hover:bg-opacity-40 transition-colors duration-300" />
                    <div className="absolute bottom-4 left-4 right-4 text-white">
                      <h3 className="text-xl font-semibold mb-2">{category.name}</h3>
                      <p className="text-sm opacity-90">{category.description}</p>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Products */}
      <section className="py-16 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between mb-12">
            <h2 className="text-3xl font-bold text-primary">Featured Products</h2>
            <Button variant="outline" asChild>
              <Link href="/shop">View All Products</Link>
            </Button>
          </div>
          
          {featuredProducts.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 text-lg">No featured products available at the moment.</p>
              <Button className="mt-4" asChild>
                <Link href="/shop">Browse All Products</Link>
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {featuredProducts.slice(0, 8).map((product: Product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Special Offers */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <div className="bg-gradient-to-r from-secondary to-yellow-600 rounded-2xl p-8 md:p-12 text-white text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Special Offer</h2>
            <p className="text-xl mb-6">Get 20% off your first order with code WELCOME20</p>
            <div className="flex justify-center space-x-4">
              <Button size="lg" className="bg-white text-secondary hover:bg-gray-100" asChild>
                <Link href="/shop">Shop Now</Link>
              </Button>
              <Button size="lg" variant="outline" className="text-white border-white hover:bg-white hover:text-secondary">
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
