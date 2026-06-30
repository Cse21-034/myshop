import { useState } from "react";
import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Star, Check, ArrowLeft, Heart } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { useToast } from "@/hooks/use-toast";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ProductCard from "@/components/ProductCard";
import type { Product } from "@shared/schema";

// ✅ Ensure correct backend URL
const backendURL = (import.meta.env.VITE_API_BASE_URL || "https://myshop-test-backend.onrender.com").replace(/\/$/, "");

export default function Product() {
  const { id } = useParams();
  const [selectedSize, setSelectedSize] = useState<string>("");
  const [selectedColor, setSelectedColor] = useState<string>("");
  const [quantity, setQuantity] = useState(1);
  const [mainImage, setMainImage] = useState(0);
  const [isZoomed, setIsZoomed] = useState(false);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const { addToCart } = useCart();
  const { toast } = useToast();

  // Exchange rate USD to BWP
  const USD_TO_BWP = 13.5;

  // Convert price string (USD) to number (BWP)
  const convertToBWP = (usdPrice: string | undefined) => {
    if (!usdPrice) return 0;
    const numberPrice = parseFloat(usdPrice);
    return isNaN(numberPrice) ? 0 : numberPrice * USD_TO_BWP;
  };

  // Format BWP number to string with "P " prefix and commas
  const formatBWP = (amount: number) =>
    `P ${amount.toLocaleString("en-BW", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  // Prevent image context menu and drag
  const handleImageInteraction = (e: React.MouseEvent) => {
    e.preventDefault();
  };

  // Handle mouse move for zoom effect
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setMousePosition({ x, y });
  };

  // Fetch product from backend
  const { data: product, isLoading } = useQuery({
    queryKey: ["product", id],
    queryFn: async () => {
      const response = await fetch(`${backendURL}/api/products/${id}`);
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error("Product not found");
        }
        throw new Error("Failed to fetch product");
      }
      return response.json();
    },
    enabled: !!id,
  });

  // Fetch related products
  const { data: relatedProducts = [] } = useQuery({
    queryKey: ["related-products", product?.categoryId],
    queryFn: async () => {
      if (!product?.categoryId) return [];
      const response = await fetch(`${backendURL}/api/products?categoryId=${product.categoryId}&active=true`);
      if (!response.ok) return [];
      const products = await response.json();
      return products.filter((p: Product) => p.id !== product.id).slice(0, 4);
    },
    enabled: !!product?.categoryId,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <div className="animate-pulse">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div>
                <div className="h-96 bg-gray-200 rounded-lg mb-4" />
                <div className="grid grid-cols-4 gap-2">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="h-20 bg-gray-200 rounded" />
                  ))}
                </div>
              </div>
              <div className="space-y-4">
                <div className="h-8 bg-gray-200 rounded" />
                <div className="h-4 bg-gray-200 rounded w-2/3" />
                <div className="h-6 bg-gray-200 rounded w-1/3" />
                <div className="h-20 bg-gray-200 rounded" />
              </div>
            </div>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Product Not Found</h1>
            <p className="text-gray-600 mb-6">The product you're looking for doesn't exist.</p>
            <Button asChild>
              <Link href="/shop">Back to Shop</Link>
            </Button>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  const handleAddToCart = () => {
    if (product.sizes && product.sizes.length > 0 && !selectedSize) {
      toast({
        title: "Please select a size",
        description: "You need to select a size before adding to cart.",
        variant: "destructive",
      });
      return;
    }

    if (product.colors && product.colors.length > 0 && !selectedColor) {
      toast({
        title: "Please select a color",
        description: "You need to select a color before adding to cart.",
        variant: "destructive",
      });
      return;
    }

    addToCart(product.id, quantity, selectedSize, selectedColor);
    toast({
      title: "Added to cart",
      description: `${product.name} has been added to your cart.`,
    });
  };

  const discountPercentage = product.originalPrice
    ? Math.round(
        ((parseFloat(product.originalPrice) - parseFloat(product.price)) / parseFloat(product.originalPrice)) * 100,
      )
    : 0;

  const images =
    product.images && product.images.length > 0
      ? product.images
      : [
          "https://images.unsplash.com/photo-1542291026-7eec264c27ff?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&h=500",
        ];

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <div className="container mx-auto px-4 py-4 sm:py-8">
        {/* Breadcrumb */}
        <div className="flex items-center space-x-2 text-xs sm:text-sm text-gray-600 mb-4 sm:mb-6">
          <Link href="/" className="hover:text-primary">
            Home
          </Link>
          <span>/</span>
          <Link href="/shop" className="hover:text-primary">
            Shop
          </Link>
          <span>/</span>
          <span className="text-primary truncate">{product.name}</span>
        </div>

        {/* Back Button */}
        <Button variant="outline" className="mb-4 sm:mb-6 text-xs sm:text-sm h-8 sm:h-10" asChild>
          <Link href="/shop">
            <ArrowLeft className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
            <span className="hidden sm:inline">Back to Shop</span>
            <span className="sm:hidden">Back</span>
          </Link>
        </Button>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-12">
          {/* Product Images */}
          <div>
            <div className="mb-3 sm:mb-4">
              <div
                className="relative w-full h-64 sm:h-96 md:h-[500px] rounded-lg overflow-hidden cursor-crosshair"
                onMouseMove={handleMouseMove}
                onMouseEnter={() => setIsZoomed(true)}
                onMouseLeave={() => setIsZoomed(false)}
              >
                <img
                  src={images[mainImage]}
                  alt={product.name}
                  className={`w-full h-full object-cover select-none transition-transform duration-200 ${
                    isZoomed ? 'scale-150' : 'scale-100'
                  }`}
                  style={{
                    transformOrigin: `${mousePosition.x}% ${mousePosition.y}%`,
                    userSelect: 'none',
                    WebkitUserSelect: 'none',
                    MozUserSelect: 'none',
                    msUserSelect: 'none',
                    pointerEvents: 'none'
                  }}
                  onContextMenu={handleImageInteraction}
                  onDragStart={handleImageInteraction}
                />
                {/* Zoom indicator */}
                {!isZoomed && (
                  <div className="absolute top-2 right-2 bg-black bg-opacity-50 text-white text-xs px-2 py-1 rounded">
                    Hover to zoom
                  </div>
                )}
              </div>
            </div>
            <div className="grid grid-cols-4 gap-1 sm:gap-2">
              {images.map((image, index) => (
                <img
                  key={index}
                  src={image}
                  alt={`${product.name} view ${index + 1}`}
                  className={`w-full h-16 sm:h-20 object-cover rounded cursor-pointer border-2 transition-colors select-none ${
                    mainImage === index ? "border-secondary" : "border-transparent hover:border-secondary"
                  }`}
                  onClick={() => setMainImage(index)}
                  onContextMenu={handleImageInteraction}
                  onDragStart={handleImageInteraction}
                  style={{ 
                    userSelect: 'none',
                    WebkitUserSelect: 'none',
                    MozUserSelect: 'none',
                    msUserSelect: 'none'
                  }}
                />
              ))}
            </div>
          </div>

          {/* Product Details */}
          <div>
            <div className="flex items-start justify-between mb-3 sm:mb-4">
              <div>
                <h1 className="text-xl sm:text-3xl font-bold text-primary mb-2 leading-tight">{product.name}</h1>
                {product.featured && (
                  <Badge className="bg-secondary mb-2 sm:mb-4 text-xs px-2 py-1">Featured Product</Badge>
                )}
              </div>
              <Button variant="outline" size="icon" className="h-8 w-8 sm:h-10 sm:w-10">
                <Heart className="h-3 w-3 sm:h-4 sm:w-4" />
              </Button>
            </div>

            <div className="flex items-center mb-3 sm:mb-4">
              <div className="flex text-yellow-400 mr-2">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="h-3 w-3 sm:h-4 sm:w-4 fill-current" />
                ))}
              </div>
              <span className="text-gray-600 text-xs sm:text-sm">(128 reviews)</span>
            </div>

            <div className="mb-4 sm:mb-6">
              <div className="flex items-center space-x-2 mb-1 sm:mb-2">
                <span className="text-2xl sm:text-3xl font-bold text-secondary">
                  {/* Display price converted to BWP and formatted */}
                  {formatBWP(convertToBWP(product.price))}
                </span>
                {product.originalPrice && (
                  <span className="text-sm sm:text-lg text-gray-500 line-through">{formatBWP(convertToBWP(product.originalPrice))}</span>
                )}
                {discountPercentage > 0 && (
                  <Badge variant="destructive" className="text-xs px-1 py-0.5 sm:px-2 sm:py-1">
                    {discountPercentage}% OFF
                  </Badge>
                )}
              </div>
              <p className="text-xs sm:text-sm text-gray-600">
                {product.stock > 0 ? `${product.stock} in stock` : "Out of stock"}
              </p>
            </div>

            <div className="mb-4 sm:mb-6">
              <p className="text-sm sm:text-base text-gray-700 leading-relaxed">
                {product.description ||
                  "Experience ultimate comfort and style with this premium product. Perfect for both casual and formal occasions."}
              </p>
            </div>

            {/* Size Selection */}
            {product.sizes && product.sizes.length > 0 && (
              <div className="mb-4 sm:mb-6">
                <h3 className="font-semibold mb-2 sm:mb-3 text-sm sm:text-base">Size</h3>
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                  {product.sizes.map((size) => (
                    <button
                      key={size}
                      className={`border px-2 py-1 sm:px-3 sm:py-2 rounded text-center transition-colors text-xs sm:text-sm ${
                        selectedSize === size
                          ? "border-secondary bg-secondary text-white"
                          : "border-gray-300 hover:border-secondary hover:text-secondary"
                      }`}
                      onClick={() => setSelectedSize(size)}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Color Selection */}
            {product.colors && product.colors.length > 0 && (
              <div className="mb-4 sm:mb-6">
                <h3 className="font-semibold mb-2 sm:mb-3 text-sm sm:text-base">Color</h3>
                <div className="flex space-x-2 sm:space-x-3">
                  {product.colors.map((color) => (
                    <button
                      key={color}
                      className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full border-4 transition-colors ${
                        selectedColor === color ? "border-secondary" : "border-transparent hover:border-gray-300"
                      }`}
                      style={{ backgroundColor: color.toLowerCase() }}
                      onClick={() => setSelectedColor(color)}
                      title={color}
                    >
                      {selectedColor === color && <Check className="h-3 w-3 sm:h-4 sm:w-4 text-white mx-auto" />}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Quantity Selection */}
            <div className="mb-4 sm:mb-6">
              <h3 className="font-semibold mb-2 sm:mb-3 text-sm sm:text-base">Quantity</h3>
              <div className="flex items-center space-x-3">
                <button
                  className="w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center border border-gray-300 rounded hover:bg-gray-100 text-sm sm:text-base"
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  aria-label="Decrease quantity"
                >
                  -
                </button>
                <span className="text-base sm:text-lg font-semibold w-8 sm:w-12 text-center">{quantity}</span>
                <button
                  className="w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center border border-gray-300 rounded hover:bg-gray-100 text-sm sm:text-base"
                  onClick={() => setQuantity(quantity + 1)}
                  aria-label="Increase quantity"
                >
                  +
                </button>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2 sm:space-y-3 mb-6 sm:mb-8">
              <Button
                className="w-full bg-primary hover:bg-gray-800 h-10 sm:h-12 text-sm sm:text-base"
                onClick={handleAddToCart}
                disabled={product.stock <= 0}
              >
                {product.stock <= 0 ? "Out of Stock" : "Add to Cart"}
              </Button>
              <Button variant="outline" className="w-full h-10 sm:h-12 text-sm sm:text-base">
                Buy Now
              </Button>
            </div>

            <Separator className="mb-4 sm:mb-6" />

            {/* Product Features */}
            <div>
              <h3 className="font-semibold mb-2 sm:mb-3 text-sm sm:text-base">Features</h3>
              <ul className="space-y-1 sm:space-y-2 text-xs sm:text-sm text-gray-700">
                <li className="flex items-center">
                  <Check className="h-3 w-3 sm:h-4 sm:w-4 text-green-500 mr-2 flex-shrink-0" />
                  {/* Format free shipping threshold in BWP */}
                  Free shipping on orders over {formatBWP(75 * USD_TO_BWP)}
                </li>
                <li className="flex items-center">
                  <Check className="h-3 w-3 sm:h-4 sm:w-4 text-green-500 mr-2 flex-shrink-0" />
                  30-day return policy
                </li>
                <li className="flex items-center">
                  <Check className="h-3 w-3 sm:h-4 sm:w-4 text-green-500 mr-2 flex-shrink-0" />
                  Premium materials
                </li>
                <li className="flex items-center">
                  <Check className="h-3 w-3 sm:h-4 sm:w-4 text-green-500 mr-2 flex-shrink-0" />
                  1-year warranty
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Related Products */}
        {relatedProducts.length > 0 && (
          <div className="mt-12 sm:mt-16">
            <h2 className="text-xl sm:text-2xl font-bold text-primary mb-6 sm:mb-8">Related Products</h2>
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
              {relatedProducts.map((relatedProduct: Product) => (
                <ProductCard key={relatedProduct.id} product={relatedProduct} />
              ))}
            </div>
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
}
