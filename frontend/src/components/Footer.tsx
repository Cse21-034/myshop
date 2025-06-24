import { Link } from "wouter";
import { Headphones } from "lucide-react";
import { Facebook, Instagram, Twitter, Youtube } from "lucide-react";

export default function Footer() {
  return (
    <footer className="bg-primary text-white py-12">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand Column */}
          <div>
            <div className="flex items-center space-x-2 mb-4">
              <Headphones className="text-secondary text-2xl" />
              <span className="text-2xl font-bold">sho-Audio</span>
            </div>
            <p className="text-gray-300 mb-4">
              Your premier destination for fashion, footwear, and accessories. Style meets quality.
            </p>
            <div className="flex space-x-4">
              <a href="#" className="text-gray-300 hover:text-secondary transition-colors">
                <Facebook className="h-5 w-5" />
              </a>
              <a href="#" className="text-gray-300 hover:text-secondary transition-colors">
                <Instagram className="h-5 w-5" />
              </a>
              <a href="#" className="text-gray-300 hover:text-secondary transition-colors">
                <Twitter className="h-5 w-5" />
              </a>
              <a href="#" className="text-gray-300 hover:text-secondary transition-colors">
                <Youtube className="h-5 w-5" />
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="font-semibold mb-4">Quick Links</h4>
            <ul className="space-y-2">
              <li><Link href="/" className="text-gray-300 hover:text-secondary transition-colors">Home</Link></li>
              <li><Link href="/shop" className="text-gray-300 hover:text-secondary transition-colors">Shop</Link></li>
              <li><Link href="/about" className="text-gray-300 hover:text-secondary transition-colors">About Us</Link></li>
              <li><Link href="/contact" className="text-gray-300 hover:text-secondary transition-colors">Contact</Link></li>
            </ul>
          </div>

          {/* Categories */}
          <div>
            <h4 className="font-semibold mb-4">Categories</h4>
            <ul className="space-y-2">
              <li><Link href="/shop?category=clothing" className="text-gray-300 hover:text-secondary transition-colors">Clothing</Link></li>
              <li><Link href="/shop?category=footwear" className="text-gray-300 hover:text-secondary transition-colors">Footwear</Link></li>
              <li><Link href="/shop?category=accessories" className="text-gray-300 hover:text-secondary transition-colors">Accessories</Link></li>
              <li><Link href="/shop?featured=true" className="text-gray-300 hover:text-secondary transition-colors">Sale Items</Link></li>
            </ul>
          </div>

          {/* Customer Service */}
          <div>
            <h4 className="font-semibold mb-4">Customer Service</h4>
            <ul className="space-y-2">
              <li><a href="#" className="text-gray-300 hover:text-secondary transition-colors">Shipping Info</a></li>
              <li><a href="#" className="text-gray-300 hover:text-secondary transition-colors">Returns</a></li>
              <li><a href="#" className="text-gray-300 hover:text-secondary transition-colors">Size Guide</a></li>
              <li><a href="#" className="text-gray-300 hover:text-secondary transition-colors">FAQ</a></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-700 mt-8 pt-8 text-center">
          <p className="text-gray-300">
            &copy; 2024 sho-Audio. All rights reserved. | Privacy Policy | Terms of Service
          </p>
        </div>
      </div>
    </footer>
  );
}
