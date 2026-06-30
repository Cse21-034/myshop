import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Search, Filter, X, SlidersHorizontal } from "lucide-react";
import ProductCard from "@/components/ProductCard";
import ProductModal from "@/components/ProductModal";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import type { Product } from "@shared/schema";

const backendURL = (import.meta.env.VITE_API_BASE_URL || "https://myshop-test-backend.onrender.com").replace(/\/$/, "");

export default function Shop() {
  const [location] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [priceRange, setPriceRange] = useState({ min: "", max: "" });
  const [sortBy, setSortBy] = useState("featured");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setSearchQuery(params.get("search") || "");
    setSelectedCategory(params.get("category") || "");
  }, [location]);

  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const res = await fetch(`${backendURL}/api/categories`);
      if (!res.ok) throw new Error("Failed to fetch categories");
      return res.json();
    },
  });

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["products", { searchQuery, selectedCategory, priceRange }],
    enabled: categories.length > 0,
    queryFn: async () => {
      const params = new URLSearchParams();
      // Always filter for active products in the shop
      params.append("active", "true");
      params.append("status", "active");

      if (searchQuery) params.append("search", searchQuery);
      if (selectedCategory) {
        const category = categories.find((c: any) => c.slug === selectedCategory);
        if (category) params.append("categoryId", category.id.toString());
      }
      if (priceRange.min) params.append("minPrice", priceRange.min);
      if (priceRange.max) params.append("maxPrice", priceRange.max);
      params.append("active", "true");

      const response = await fetch(`${backendURL}/api/products?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch products");
      return response.json();
    },
  });

  const sortedProducts = [...products].sort((a, b) => {
    switch (sortBy) {
      case "price-low":
        return parseFloat(a.price) - parseFloat(b.price);
      case "price-high":
        return parseFloat(b.price) - parseFloat(a.price);
      case "newest":
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      default:
        return b.featured ? 1 : -1;
    }
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    updateURL();
  };

  const updateURL = () => {
    const params = new URLSearchParams();
    if (searchQuery) params.append("search", searchQuery);
    if (selectedCategory) params.append("category", selectedCategory);
    if (priceRange.min) params.append("minPrice", priceRange.min);
    if (priceRange.max) params.append("maxPrice", priceRange.max);

    const newURL = `/shop${params.toString() ? `?${params.toString()}` : ""}`;
    window.history.pushState({}, "", newURL);
  };

  const clearFilters = () => {
    setSearchQuery("");
    setSelectedCategory("");
    setPriceRange({ min: "", max: "" });
    setSortBy("featured");
    window.history.pushState({}, "", "/shop");
    setIsFilterOpen(false);
  };

  const openProductModal = (product: Product) => {
    setSelectedProduct(product);
    setIsModalOpen(true);
  };

  // Prevent image context menu and drag for all images
  const handleImageInteraction = (e: React.MouseEvent) => {
    e.preventDefault();
  };

  const activeFiltersCount = [searchQuery, selectedCategory, priceRange.min, priceRange.max].filter(Boolean).length;

  // Filter component that can be used both in sidebar and mobile sheet
  const FilterContent = () => (
    <div className="space-y-4 md:space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-primary flex items-center text-sm md:text-base">
          <Filter className="h-4 w-4 mr-2" />
          Filters
        </h3>
        {activeFiltersCount > 0 && (
          <div className="flex items-center space-x-2">
            <Badge variant="secondary" className="text-xs">{activeFiltersCount}</Badge>
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <X className="h-3 w-3" />
            </Button>
          </div>
        )}
      </div>

      {/* Category Filter */}
      <div>
        <h4 className="font-medium mb-2 md:mb-3 text-sm md:text-base">Category</h4>
        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <Checkbox 
              checked={selectedCategory === ""}
              onCheckedChange={() => setSelectedCategory("")}
            />
            <label className="text-xs md:text-sm">All Categories</label>
          </div>
          {categories.map((category: any) => (
            <div key={category.id} className="flex items-center space-x-2">
              <Checkbox 
                checked={selectedCategory === category.slug}
                onCheckedChange={() => setSelectedCategory(category.slug)}
              />
              <label className="text-xs md:text-sm">{category.name}</label>
            </div>
          ))}
        </div>
      </div>

      <Separator />

      {/* Price Filter */}
      <div>
        <h4 className="font-medium mb-2 md:mb-3 text-sm md:text-base">Price Range</h4>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <Input
              type="number"
              placeholder="Min"
              value={priceRange.min}
              onChange={(e) => setPriceRange(prev => ({ ...prev, min: e.target.value }))}
              className="text-xs md:text-sm"
            />
            <Input
              type="number"
              placeholder="Max"
              value={priceRange.max}
              onChange={(e) => setPriceRange(prev => ({ ...prev, max: e.target.value }))}
              className="text-xs md:text-sm"
            />
          </div>
          <Button variant="outline" size="sm" onClick={updateURL} className="w-full text-xs md:text-sm">
            Apply Price Filter
          </Button>
        </div>
      </div>

      <Separator />

      <Button variant="destructive" onClick={clearFilters} className="w-full text-xs md:text-sm">
        Clear All Filters
      </Button>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <div className="container mx-auto px-4 py-4 md:py-8">
        {/* Page Header */}
        <div className="mb-4 md:mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-primary mb-3 md:mb-4">Shop All Products</h1>
          
          {/* Mobile Search and Controls */}
          <div className="flex flex-col space-y-3 md:hidden">
            <form onSubmit={handleSearch} className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  type="text"
                  placeholder="Search products..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 text-sm h-9"
                />
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-3 w-3" />
              </div>
              <Button type="submit" size="sm" className="px-3">
                <Search className="h-4 w-4" />
              </Button>
            </form>
            
            <div className="flex gap-2">
              <Sheet open={isFilterOpen} onOpenChange={setIsFilterOpen}>
                <SheetTrigger asChild>
                  <Button variant="outline" size="sm" className="flex items-center gap-2 flex-1">
                    <SlidersHorizontal className="h-4 w-4" />
                    Filters
                    {activeFiltersCount > 0 && (
                      <Badge variant="secondary" className="text-xs px-1 py-0">
                        {activeFiltersCount}
                      </Badge>
                    )}
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-80">
                  <SheetHeader>
                    <SheetTitle>Filter Products</SheetTitle>
                    <SheetDescription>
                      Refine your search results
                    </SheetDescription>
                  </SheetHeader>
                  <div className="mt-6">
                    <FilterContent />
                  </div>
                </SheetContent>
              </Sheet>
              
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="flex-1 h-9 text-sm">
                  <SelectValue placeholder="Sort" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="featured">Featured</SelectItem>
                  <SelectItem value="price-low">Price: Low to High</SelectItem>
                  <SelectItem value="price-high">Price: High to Low</SelectItem>
                  <SelectItem value="newest">Newest</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Desktop Search and Controls */}
          <div className="hidden md:flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
            <form onSubmit={handleSearch} className="flex gap-2 flex-1 max-w-md">
              <div className="relative flex-1">
                <Input
                  type="text"
                  placeholder="Search products..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              </div>
              <Button type="submit">Search</Button>
            </form>

            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="featured">Featured</SelectItem>
                <SelectItem value="price-low">Price: Low to High</SelectItem>
                <SelectItem value="price-high">Price: High to Low</SelectItem>
                <SelectItem value="newest">Newest</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-4 md:gap-8">
          {/* Desktop Filters Sidebar */}
          <div className="hidden lg:block lg:w-1/4">
            <Card>
              <CardContent className="p-6">
                <FilterContent />
              </CardContent>
            </Card>
          </div>

          {/* Products Grid */}
          <div className="lg:w-3/4">
            {isLoading ? (
              <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-6">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="bg-white rounded-lg shadow-sm animate-pulse">
                    <div className="h-40 md:h-64 bg-gray-200 rounded-t-lg" />
                    <div className="p-3 md:p-4 space-y-2 md:space-y-3">
                      <div className="h-3 md:h-4 bg-gray-200 rounded" />
                      <div className="h-3 md:h-4 bg-gray-200 rounded w-2/3" />
                      <div className="h-3 md:h-4 bg-gray-200 rounded w-1/3" />
                    </div>
                  </div>
                ))}
              </div>
            ) : sortedProducts.length === 0 ? (
              <div className="text-center py-8 md:py-12">
                <div className="max-w-md mx-auto px-4">
                  <div className="w-16 h-16 md:w-24 md:h-24 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4 md:mb-6">
                    <Search className="h-6 w-6 md:h-8 md:w-8 text-gray-400" />
                  </div>
                  <h3 className="text-lg md:text-xl font-semibold text-gray-900 mb-2">No products found</h3>
                  <p className="text-sm md:text-base text-gray-600 mb-4 md:mb-6">
                    Try adjusting your search or filter criteria to find what you're looking for.
                  </p>
                  <Button onClick={clearFilters} size="sm">Clear Filters</Button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-4 md:mb-6">
                  <p className="text-sm md:text-base text-gray-600">
                    Showing {sortedProducts.length} product{sortedProducts.length !== 1 ? 's' : ''}
                  </p>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-6">
                  {sortedProducts.map((product: Product) => (
                    <div key={product.id} onClick={() => openProductModal(product)}>
                      <ProductCard product={product} />
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <ProductModal 
        product={selectedProduct}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />

      <Footer />
    </div>
  );
}
