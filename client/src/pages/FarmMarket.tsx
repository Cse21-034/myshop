import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import FarmProductCard from "@/components/FarmProductCard";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

const ENTITY_TYPES = [
  { value: "",          label: "All" },
  { value: "livestock", label: "🐄 Livestock" },
  { value: "crop",      label: "🌾 Crops" },
  { value: "poultry",   label: "🐔 Poultry" },
  { value: "inventory", label: "📦 Farm Supplies" },
];

export default function FarmMarket() {
  const [activeType, setActiveType] = useState("");
  const [search, setSearch] = useState("");

  const { data: products = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/products", { active: true }],
  });

  const farmProducts = products.filter((p: any) => p.entityType != null);

  const filtered = farmProducts.filter((p: any) => {
    const matchType = activeType === "" || p.entityType === activeType;
    const matchSearch = search === "" ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.farmName && p.farmName.toLowerCase().includes(search.toLowerCase())) ||
      (p.farmDistrict && p.farmDistrict.toLowerCase().includes(search.toLowerCase()));
    return matchType && matchSearch;
  });

  const counts: Record<string, number> = {};
  farmProducts.forEach((p: any) => {
    counts[p.entityType] = (counts[p.entityType] ?? 0) + 1;
  });

  return (
    <>
      <Header />
      <main className="min-h-screen bg-gray-50">
        {/* Hero */}
        <div className="bg-green-800 text-white py-12 px-4">
          <div className="container mx-auto max-w-5xl text-center space-y-3">
            <h1 className="text-3xl md:text-4xl font-bold">Farm Market</h1>
            <p className="text-green-200 text-sm md:text-base max-w-xl mx-auto">
              Buy directly from local farms — livestock, fresh produce, poultry, and farm supplies
            </p>
            {/* Search */}
            <div className="relative max-w-md mx-auto mt-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search products or farms..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 bg-white text-gray-900"
              />
            </div>
          </div>
        </div>

        <div className="container mx-auto max-w-6xl px-4 py-8">
          {/* Filter tabs */}
          <div className="flex flex-wrap gap-2 mb-8">
            {ENTITY_TYPES.map(({ value, label }) => {
              const count = value === "" ? farmProducts.length : (counts[value] ?? 0);
              return (
                <button
                  key={value}
                  onClick={() => setActiveType(value)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                    activeType === value
                      ? "bg-green-700 text-white"
                      : "bg-white text-gray-700 border border-gray-200 hover:border-green-400"
                  }`}
                >
                  {label} {count > 0 && <span className="ml-1 opacity-70">({count})</span>}
                </button>
              );
            })}
          </div>

          {/* Grid */}
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="bg-white rounded-lg h-72 animate-pulse" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-20 text-gray-500">
              <p className="text-4xl mb-4">🌿</p>
              <p className="text-lg font-medium">No farm products found</p>
              <p className="text-sm mt-1">Try a different filter or search term</p>
            </div>
          ) : (
            <>
              <p className="text-sm text-gray-500 mb-4">{filtered.length} product{filtered.length !== 1 ? "s" : ""} found</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {filtered.map((product: any) => (
                  <FarmProductCard key={product.id} product={product} />
                ))}
              </div>
            </>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
