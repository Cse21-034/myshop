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

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    addToCart(product.id, 1);
  };

  const discountPercentage = product.originalPrice 
    ? Math.round(((parseFloat(product.originalPrice) - parseFloat(product.price)) / parseFloat(product.originalPrice)) * 100)
    : 0;

  return (
    <div className="product-card bg-white rounded-lg shadow-sm overflow-hidden hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
      <Link href={`/product/${product.id}`}>
        <div className="relative">
          <img 
            src={product.images?.[0] || "https://images.unsplash.com/photo-1441986300917-64674bd600d8?ixlib=rb-4.0.3&auto=format&fit=crop&w=300&h=300"} 
            alt={product.name}
            className="w-full h-64 object-cover"
          />
          {product.featured && (
            <Badge className="absolute top-2 left-2 bg-secondary">
              Featured
            </Badge>
          )}
          {discountPercentage > 0 && (
            <Badge variant="destructive" className="absolute top-2 right-2">
              {discountPercentage}% OFF
            </Badge>
          )}
        </div>
        <div className="p-4">
          <h3 className="font-semibold text-gray-800 mb-2 line-clamp-2">{product.name}</h3>
          <p className="text-gray-600 text-sm mb-2">{product.category?.name || 'Uncategorized'}</p>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-2">
              <span className="text-xl font-bold text-secondary">${product.price}</span>
              {product.originalPrice && (
                <span className="text-sm text-gray-500 line-through">${product.originalPrice}</span>
              )}
            </div>
            <Button 
              size="sm"
              onClick={handleAddToCart}
              className="bg-primary hover:bg-gray-800"
            >
              Add to Cart
            </Button>
          </div>
          
          {/* Sizes */}
          {product.sizes && product.sizes.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {product.sizes.slice(0, 4).map((size) => (
                <span key={size} className="text-xs border border-gray-300 px-2 py-1 rounded">
                  {size}
                </span>
              ))}
              {product.sizes.length > 4 && (
                <span className="text-xs text-gray-500">+{product.sizes.length - 4} more</span>
              )}
            </div>
          )}

          {/* Stock status */}
          <div className="mt-3">
            {product.stock > 0 ? (
              <Badge variant="outline" className="text-green-600 border-green-600">
                In Stock ({product.stock})
              </Badge>
            ) : (
              <Badge variant="outline" className="text-red-600 border-red-600">
                Out of Stock
              </Badge>
            )}
          </div>
        </div>
      </Link>
    </div>
  );
}
