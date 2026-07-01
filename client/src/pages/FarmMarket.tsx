import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import FarmProductCard from "@/components/FarmProductCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Search, Filter, X, SlidersHorizontal } from "lucide-react";

const USD_TO_BWP = 13.5;

const ENTITY_TYPES = [
  { value: "",          label: "All Categories" },
  { value: "livestock", label: "Livestock" },
  { value: "crop",      label: "Crops" },
  { value: "poultry",   label: "Poultry" },
  { value: "inventory", label: "Farm Supplies" },
];

export default function FarmMarket() {
  const [search, setSearch]               = useState("");
  const [activeType, setActiveType]       = useState("");
  const [sortBy, setSortBy]               = useState("featured");
  const [priceMin, setPriceMin]           = useState("");
  const [priceMax, setPriceMax]           = useState("");
  const [districtFilter, setDistrictFilter] = useState("");
  const [deliveryOnly, setDeliveryOnly]   = useState(false);
  const [inStockOnly, setInStockOnly]     = useState(false);
  const [isFilterOpen, setIsFilterOpen]   = useState(false);

  const { data: allProducts = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/products", { active: true }],
  });

  const farmProducts = allProducts.filter((p: any) => p.entityType != null);

  // Unique districts for the district filter
  const districts = Array.from(
    new Set(farmProducts.map((p: any) => p.farmDistrict).filter(Boolean))
  ).sort() as string[];

  // Apply all filters
  const filtered = farmProducts.filter((p: any) => {
    if (activeType && p.entityType !== activeType) return false;
    if (deliveryOnly && !p.allowsDelivery) return false;
    if (inStockOnly && (p.stock ?? 0) <= 0) return false;
    if (districtFilter && p.farmDistrict !== districtFilter) return false;

    if (priceMin) {
      const minUSD = parseFloat(priceMin) / USD_TO_BWP;
      if (parseFloat(p.price) < minUSD) return false;
    }
    if (priceMax) {
      const maxUSD = parseFloat(priceMax) / USD_TO_BWP;
      if (parseFloat(p.price) > maxUSD) return false;
    }

    if (search) {
      const q = search.toLowerCase();
      const inName     = p.name?.toLowerCase().includes(q);
      const inFarm     = p.farmName?.toLowerCase().includes(q);
      const inDistrict = p.farmDistrict?.toLowerCase().includes(q);
      const inDesc     = p.description?.toLowerCase().includes(q);
      if (!inName && !inFarm && !inDistrict && !inDesc) return false;
    }

    return true;
  });

  // Sort
  const sorted = [...filtered].sort((a, b) => {
    switch (sortBy) {
      case "price-low":  return parseFloat(a.price) - parseFloat(b.price);
      case "price-high": return parseFloat(b.price) - parseFloat(a.price);
      case "newest":     return new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime();
      default:           return (b.featured ? 1 : 0) - (a.featured ? 1 : 0);
    }
  });

  function clearFilters() {
    setSearch("");
    setActiveType("");
    setSortBy("featured");
    setPriceMin("");
    setPriceMax("");
    setDistrictFilter("");
    setDeliveryOnly(false);
    setInStockOnly(false);
    setIsFilterOpen(false);
  }

  const activeFiltersCount = [
    activeType, priceMin, priceMax, districtFilter,
    deliveryOnly && "delivery", inStockOnly && "stock",
  ].filter(Boolean).length;

  const FilterContent = () => (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-primary flex items-center gap-2 text-sm md:text-base">
          <Filter className="h-4 w-4" /> Filters
        </h3>
        {activeFiltersCount > 0 && (
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs">{activeFiltersCount}</Badge>
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <X className="h-3 w-3" />
            </Button>
          </div>
        )}
      </div>

      {/* Category / Entity Type */}
      <div>
        <h4 className="font-medium mb-3 text-sm">Category</h4>
        <div className="space-y-2">
          {ENTITY_TYPES.map(({ value, label }) => (
            <div key={value} className="flex items-center space-x-2">
              <Checkbox
                id={`type-${value}`}
                checked={activeType === value}
                onCheckedChange={() => setActiveType(value)}
              />
              <label htmlFor={`type-${value}`} className="text-xs md:text-sm cursor-pointer">
                {label}
              </label>
            </div>
          ))}
        </div>
      </div>

      <Separator />

      {/* Price Range (in BWP) */}
      <div>
        <h4 className="font-medium mb-3 text-sm">Price Range (BWP)</h4>
        <div className="grid grid-cols-2 gap-2">
          <Input
            type="number"
            placeholder="Min"
            value={priceMin}
            onChange={e => setPriceMin(e.target.value)}
            className="text-xs md:text-sm"
          />
          <Input
            type="number"
            placeholder="Max"
            value={priceMax}
            onChange={e => setPriceMax(e.target.value)}
            className="text-xs md:text-sm"
          />
        </div>
      </div>

      <Separator />

      {/* District */}
      {districts.length > 0 && (
        <>
          <div>
            <h4 className="font-medium mb-3 text-sm">District</h4>
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="district-all"
                  checked={districtFilter === ""}
                  onCheckedChange={() => setDistrictFilter("")}
                />
                <label htmlFor="district-all" className="text-xs md:text-sm cursor-pointer">All Districts</label>
              </div>
              {districts.map(d => (
                <div key={d} className="flex items-center space-x-2">
                  <Checkbox
                    id={`district-${d}`}
                    checked={districtFilter === d}
                    onCheckedChange={() => setDistrictFilter(d)}
                  />
                  <label htmlFor={`district-${d}`} className="text-xs md:text-sm cursor-pointer">{d}</label>
                </div>
              ))}
            </div>
          </div>
          <Separator />
        </>
      )}

      {/* Extra toggles */}
      <div className="space-y-3">
        <div className="flex items-center space-x-2">
          <Checkbox
            id="delivery-only"
            checked={deliveryOnly}
            onCheckedChange={v => setDeliveryOnly(Boolean(v))}
          />
          <label htmlFor="delivery-only" className="text-xs md:text-sm cursor-pointer">Delivery available</label>
        </div>
        <div className="flex items-center space-x-2">
          <Checkbox
            id="in-stock"
            checked={inStockOnly}
            onCheckedChange={v => setInStockOnly(Boolean(v))}
          />
          <label htmlFor="in-stock" className="text-xs md:text-sm cursor-pointer">In stock only</label>
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

      {/* Hero */}
      <div className="bg-green-800 text-white py-10 px-4">
        <div className="container mx-auto max-w-6xl">
          <h1 className="text-2xl md:text-3xl font-bold mb-1">Farm Market</h1>
          <p className="text-green-200 text-sm mb-4">
            Buy directly from local farms — livestock, fresh produce, poultry &amp; supplies
          </p>
          {/* Search */}
          <form
            onSubmit={e => e.preventDefault()}
            className="flex gap-2 max-w-lg"
          >
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search products, farms, districts..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-10 bg-white text-gray-900"
              />
            </div>
            <Button type="submit" className="bg-green-600 hover:bg-green-700 text-white">
              Search
            </Button>
          </form>
        </div>
      </div>

      <div className="container mx-auto max-w-6xl px-2 sm:px-4 py-6">
        {/* Mobile controls row */}
        <div className="flex gap-2 mb-4 md:hidden">
          <Sheet open={isFilterOpen} onOpenChange={setIsFilterOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm" className="flex items-center gap-2 flex-1">
                <SlidersHorizontal className="h-4 w-4" />
                Filters
                {activeFiltersCount > 0 && (
                  <Badge variant="secondary" className="text-xs px-1 py-0">{activeFiltersCount}</Badge>
                )}
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-80">
              <SheetHeader>
                <SheetTitle>Filter Products</SheetTitle>
                <SheetDescription>Refine farm market results</SheetDescription>
              </SheetHeader>
              <div className="mt-6 overflow-y-auto h-[calc(100vh-120px)] pr-1">
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

        {/* Desktop sort row */}
        <div className="hidden md:flex items-center justify-between mb-6">
          <p className="text-sm text-gray-600">
            {isLoading ? "Loading..." : `${sorted.length} product${sorted.length !== 1 ? "s" : ""} found`}
          </p>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="featured">Featured</SelectItem>
              <SelectItem value="price-low">Price: Low to High (BWP)</SelectItem>
              <SelectItem value="price-high">Price: High to Low (BWP)</SelectItem>
              <SelectItem value="newest">Newest</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col lg:flex-row gap-6">
          {/* Desktop sidebar */}
          <div className="hidden lg:block lg:w-64 flex-shrink-0">
            <Card className="sticky top-24">
              <CardContent className="p-5">
                <FilterContent />
              </CardContent>
            </Card>
          </div>

          {/* Product grid */}
          <div className="flex-1 min-w-0">
            {/* Mobile result count */}
            <p className="text-sm text-gray-500 mb-3 md:hidden">
              {isLoading ? "Loading..." : `${sorted.length} product${sorted.length !== 1 ? "s" : ""} found`}
            </p>

            {isLoading ? (
              <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-2 md:gap-6">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="bg-white rounded-lg h-72 animate-pulse" />
                ))}
              </div>
            ) : sorted.length === 0 ? (
              <div className="text-center py-16 text-gray-500">
                <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-4xl">🌿</span>
                </div>
                <p className="text-lg font-semibold text-gray-700">No farm products found</p>
                <p className="text-sm mt-1 mb-4">Try a different filter or search term</p>
                <Button variant="outline" onClick={clearFilters}>Clear Filters</Button>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-2 md:gap-6">
                {sorted.map((product: any) => (
                  <FarmProductCard key={product.id} product={product} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
