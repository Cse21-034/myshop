import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Search, Menu, User, ShoppingCart, Headphones } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useCart } from "@/context/CartContext";
import CartDrawer from "./CartDrawer";

export default function Header() {
  const [location] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [isCartOpen, setIsCartOpen] = useState(false);
  const { user, isAuthenticated } = useAuth();
  const { itemCount } = useCart();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      window.location.href = `/shop?search=${encodeURIComponent(searchQuery)}`;
    }
  };

  return (
    <>
      <div className="bg-primary text-white text-center py-2 text-sm">
        Free shipping on orders over $75 | Use code: FREESHIP
      </div>
      
      <header className="bg-white shadow-sm sticky top-0 z-50">
        <nav className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <Link href="/" className="flex items-center space-x-2">
              <Headphones className="text-secondary text-2xl" />
              <span className="text-2xl font-bold text-primary">sho-Audio</span>
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center space-x-8">
              <Link href="/" className={`text-gray-700 hover:text-primary transition-colors ${location === '/' ? 'text-primary font-semibold' : ''}`}>
                Home
              </Link>
              <Link href="/shop" className={`text-gray-700 hover:text-primary transition-colors ${location === '/shop' ? 'text-primary font-semibold' : ''}`}>
                Shop
              </Link>
              <DropdownMenu>
                <DropdownMenuTrigger className="text-gray-700 hover:text-primary transition-colors flex items-center">
                  Categories
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem>
                    <Link href="/shop?category=clothing">Clothing</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <Link href="/shop?category=footwear">Footwear</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <Link href="/shop?category=accessories">Accessories</Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Link href="/about" className={`text-gray-700 hover:text-primary transition-colors ${location === '/about' ? 'text-primary font-semibold' : ''}`}>
                About
              </Link>
              <Link href="/contact" className={`text-gray-700 hover:text-primary transition-colors ${location === '/contact' ? 'text-primary font-semibold' : ''}`}>
                Contact
              </Link>
            </div>

            {/* Search & Actions */}
            <div className="flex items-center space-x-4">
              {/* Search */}
              <form onSubmit={handleSearch} className="hidden lg:flex relative">
                <Input
                  type="text"
                  placeholder="Search products..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 pr-4 py-2"
                />
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              </form>

              {/* User Account */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm">
                    <User className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {isAuthenticated ? (
                    <>
                      <DropdownMenuItem>
                        <Link href="/profile">My Profile</Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <Link href="/orders">My Orders</Link>
                      </DropdownMenuItem>
                      {user?.isAdmin && (
                        <DropdownMenuItem>
                          <Link href="/admin">Admin Dashboard</Link>
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem>
                        <a href="/auth/logout">Logout</a>
                      </DropdownMenuItem>
                    </>
                  ) : (
                    <>
                      <DropdownMenuItem>
                        <a href="/auth/google">Login with Google</a>
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <a href="/auth/google">Login with Google</a>
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Shopping Cart */}
              <Button
                variant="ghost"
                size="sm"
                className="relative"
                onClick={() => setIsCartOpen(true)}
              >
                <ShoppingCart className="h-5 w-5" />
                {itemCount > 0 && (
                  <Badge variant="destructive" className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center p-0 text-xs">
                    {itemCount}
                  </Badge>
                )}
              </Button>

              {/* Mobile Menu Toggle */}
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="sm" className="md:hidden">
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left">
                  <div className="flex flex-col space-y-4 mt-8">
                    <Link href="/" className="text-lg">Home</Link>
                    <Link href="/shop" className="text-lg">Shop</Link>
                    <Link href="/about" className="text-lg">About</Link>
                    <Link href="/contact" className="text-lg">Contact</Link>
                    {isAuthenticated ? (
                      <>
                        <Link href="/profile" className="text-lg">My Profile</Link>
                        <Link href="/orders" className="text-lg">My Orders</Link>
                        {user?.isAdmin && (
                          <Link href="/admin" className="text-lg">Admin</Link>
                        )}
                        <a href="/auth/logout" className="text-lg">Logout</a>
                      </>
                    ) : (
                      <>
                        <a href="/auth/google" className="text-lg">Login with Google</a>
                        <a href="/auth/google" className="text-lg">Login with Google</a>
                      </>
                    )}
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </nav>
      </header>

      <CartDrawer isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />
    </>
  );
}
