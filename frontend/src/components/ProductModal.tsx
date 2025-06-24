import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useCart } from "@/context/CartContext";
import { Star, Check } from "lucide-react";
import type { Product } from "@shared/schema";

interface ProductModalProps {
  product: Product | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function ProductModal({ product, isOpen, onClose }: ProductModalProps) {
  const [selectedSize, setSelectedSize] = useState<string>("");
  const [selectedColor, setSelectedColor] = useState<string>("");
  const [quantity, setQuantity] = useState(1);
  const [mainImage, setMainImage] = useState(0);
  const { addToCart } = useCart();

  if (!product) return null;

  const handleAddToCart = () => {
    addToCart(product.id, quantity, selectedSize, selectedColor);
    onClose();
  };

  const discountPercentage = product.originalPrice 
    ? Math.round(((parseFloat(product.originalPrice) - parseFloat(product.price)) / parseFloat(product.originalPrice)) * 100)
    : 0;

  const images = product.images && product.images.length > 0 
    ? product.images 
    : ["https://images.unsplash.com/photo-1542291026-7eec264c27ff?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&h=500"];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Product Images */}
          <div>
            <div className="mb-4">
              <img 
                src={images[mainImage]} 
                alt={product.name}
                className="w-full h-96 object-cover rounded-lg"
              />
            </div>
            <div className="grid grid-cols-4 gap-2">
              {images.map((image, index) => (
                <img 
                  key={index}
                  src={image} 
                  alt={`${product.name} view ${index + 1}`}
                  className={`w-full h-20 object-cover rounded cursor-pointer border-2 transition-colors ${
                    mainImage === index ? 'border-secondary' : 'border-transparent hover:border-secondary'
                  }`}
                  onClick={() => setMainImage(index)}
                />
              ))}
            </div>
          </div>

          {/* Product Details */}
          <div>
            <DialogHeader>
              <DialogTitle className="text-3xl font-bold text-primary mb-4">
                {product.name}
              </DialogTitle>
            </DialogHeader>
            
            <div className="flex items-center mb-4">
              <div className="flex text-yellow-400 mr-2">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="h-4 w-4 fill-current" />
                ))}
              </div>
              <span className="text-gray-600 text-sm">(128 reviews)</span>
            </div>
            
            <div className="mb-6">
              <div className="flex items-center space-x-2 mb-2">
                <span className="text-3xl font-bold text-secondary">${product.price}</span>
                {product.originalPrice && (
                  <span className="text-lg text-gray-500 line-through">${product.originalPrice}</span>
                )}
                {discountPercentage > 0 && (
                  <Badge variant="destructive">{discountPercentage}% OFF</Badge>
                )}
              </div>
            </div>

            <div className="mb-6">
              <p className="text-gray-700 leading-relaxed">
                {product.description || "Experience ultimate comfort and style with this premium product. Perfect for both casual and formal occasions."}
              </p>
            </div>

            {/* Size Selection */}
            {product.sizes && product.sizes.length > 0 && (
              <div className="mb-6">
                <h3 className="font-semibold mb-3">Size</h3>
                <div className="grid grid-cols-5 gap-2">
                  {product.sizes.map((size) => (
                    <button
                      key={size}
                      className={`border px-3 py-2 rounded transition-colors ${
                        selectedSize === size 
                          ? 'border-secondary text-secondary' 
                          : 'border-gray-300 hover:border-secondary hover:text-secondary'
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
              <div className="mb-6">
                <h3 className="font-semibold mb-3">Color</h3>
                <div className="flex space-x-3">
                  {product.colors.map((color) => (
                    <button
                      key={color}
                      className={`w-8 h-8 rounded-full border-2 transition-colors ${
                        selectedColor === color 
                          ? 'border-secondary' 
                          : 'border-transparent hover:border-secondary'
                      }`}
                      style={{ backgroundColor: color.toLowerCase() }}
                      onClick={() => setSelectedColor(color)}
                      title={color}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Quantity Selection */}
            <div className="mb-6">
              <h3 className="font-semibold mb-3">Quantity</h3>
              <div className="flex items-center space-x-3">
                <button 
                  className="w-10 h-10 flex items-center justify-center border border-gray-300 rounded hover:bg-gray-100"
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                >
                  -
                </button>
                <span className="text-lg font-semibold w-12 text-center">{quantity}</span>
                <button 
                  className="w-10 h-10 flex items-center justify-center border border-gray-300 rounded hover:bg-gray-100"
                  onClick={() => setQuantity(quantity + 1)}
                >
                  +
                </button>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-3">
              <Button 
                className="w-full bg-primary hover:bg-gray-800"
                onClick={handleAddToCart}
              >
                Add to Cart
              </Button>
              <Button variant="outline" className="w-full">
                Buy Now
              </Button>
            </div>

            {/* Product Features */}
            <div className="mt-6 pt-6 border-t border-gray-200">
              <h3 className="font-semibold mb-3">Features</h3>
              <ul className="space-y-2 text-sm text-gray-700">
                <li className="flex items-center">
                  <Check className="h-4 w-4 text-green-500 mr-2" />
                  Free shipping on orders over $75
                </li>
                <li className="flex items-center">
                  <Check className="h-4 w-4 text-green-500 mr-2" />
                  30-day return policy
                </li>
                <li className="flex items-center">
                  <Check className="h-4 w-4 text-green-500 mr-2" />
                  Premium materials
                </li>
                <li className="flex items-center">
                  <Check className="h-4 w-4 text-green-500 mr-2" />
                  1-year warranty
                </li>
              </ul>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
