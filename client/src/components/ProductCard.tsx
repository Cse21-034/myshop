import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { useCart } from "@/context/CartContext";
import type { Product } from "@shared/schema";

interface ProductCardProps {
  product: Product & {
    category?: { name: string };
  };
}

export default function ProductCard({ product }: ProductCardProps) {
  const { addToCart } = useCart();

  // Botswana Pula conversion rate (update this as needed)
  const USD_TO_BWP = 13.5;

  // Convert price strings (USD) to numbers and then multiply by rate
  const convertToBWP = (usdPrice: string | undefined) => {
    if (!usdPrice) return "-";
    const numberPrice = parseFloat(usdPrice);
    if (isNaN(numberPrice)) return "-";
    // Format with 2 decimal places and thousands separator, e.g. 1,234.56
    return (numberPrice * USD_TO_BWP).toLocaleString("en-BW", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    addToCart(product.id, 1);
  };

  // Prevent image context menu and drag
  const handleImageInteraction = (e: React.MouseEvent) => {
    e.preventDefault();
  };

  const discountPercentage = product.originalPrice
    ? Math.round(
        ((parseFloat(product.originalPrice) - parseFloat(product.price)) /
          parseFloat(product.originalPrice)) *
          100
      )
    : 0;

  return (
    <div className="product-card bg-white rounded-lg shadow-sm overflow-hidden hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
      <Link href={`/product/${product.id}`}>
        <div className="relative">
          <img
            src={
              product.images?.[0] ||
              "https://images.unsplash.com/photo-1441986300917-64674bd600d8?ixlib=rb-4.0.3&auto=format&fit=crop&w=300&h=300"
            }
            alt={product.name}
            className="w-full h-32 sm:h-48 md:h-64 object-cover select-none pointer-events-none"
            onContextMenu={handleImageInteraction}
            onDragStart={handleImageInteraction}
            style={{ 
              userSelect: 'none',
              WebkitUserSelect: 'none',
              MozUserSelect: 'none',
              msUserSelect: 'none'
            }}
          />
          {product.featured && (
            <Badge className="absolute top-1 left-1 sm:top-2 sm:left-2 bg-secondary text-xs px-1 py-0.5 sm:px-2 sm:py-1">
              Featured
            </Badge>
          )}
          {discountPercentage > 0 && (
            <Badge
              variant="destructive"
              className="absolute top-1 right-1 sm:top-2 sm:right-2 text-xs px-1 py-0.5 sm:px-2 sm:py-1"
            >
              {discountPercentage}% OFF
            </Badge>
          )}
        </div>

        <div className="p-2 sm:p-4">
          {/* Product Name */}
          <h3 className="font-semibold text-gray-800 mb-1 sm:mb-2 line-clamp-2 text-xs sm:text-base leading-tight">
            {product.name}
          </h3>

          {/* Category */}
          <p className="text-gray-600 text-xs sm:text-sm mb-1 sm:mb-2">
            {product.category?.name || "Uncategorized"}
          </p>

          {/* Price and Add to Cart */}
          <div className="flex items-center justify-between mb-2 sm:mb-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-2">
              <span className="text-sm sm:text-xl font-bold text-secondary">
                {/* Show price in BWP with prefix P (Botswana Pula) */}
                P {convertToBWP(product.price)}
              </span>
              {product.originalPrice && (
                <span className="text-xs sm:text-sm text-gray-500 line-through">
                  P {convertToBWP(product.originalPrice)}
                </span>
              )}
            </div>
            <Button
              size="sm"
              onClick={handleAddToCart}
              className="bg-primary hover:bg-gray-800 text-xs sm:text-sm px-2 py-1 sm:px-3 sm:py-2 h-6 sm:h-8"
            >
              <span className="hidden sm:inline">Add to Cart</span>
              <span className="sm:hidden">Add</span>
            </Button>
          </div>

          {/* Sizes */}
          {product.sizes && product.sizes.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              {product.sizes.slice(0, 3).map((size) => (
                <span
                  key={size}
                  className="text-xs border border-gray-300 px-1 py-0.5 sm:px-2 sm:py-1 rounded"
                >
                  {size}
                </span>
              ))}
              {product.sizes.length > 3 && (
                <span className="text-xs text-gray-500">
                  +{product.sizes.length - 3}
                </span>
              )}
            </div>
          )}

          {/* Stock status */}
          <div className="mt-2 sm:mt-3">
            {product.stock > 0 ? (
              <Badge
                variant="outline"
                className="text-green-600 border-green-600 text-xs px-1 py-0.5 sm:px-2 sm:py-1"
              >
                <span className="hidden sm:inline">
                  In Stock ({product.stock})
                </span>
                <span className="sm:hidden">Stock: {product.stock}</span>
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className="text-red-600 border-red-600 text-xs px-1 py-0.5 sm:px-2 sm:py-1"
              >
                <span className="hidden sm:inline">Out of Stock</span>
                <span className="sm:hidden">No Stock</span>
              </Badge>
            )}
          </div>
        </div>
      </Link>
    </div>
  );
}
