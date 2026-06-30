// client/src/context/CartContext.tsx
import { createContext, useContext, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, createQueryKey } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { getSessionId } from "@/lib/session";

interface CartItem {
  id: number;
  productId: number;
  quantity: number;
  size?: string;
  color?: string;
}

interface CartContextType {
  items: CartItem[];
  itemCount: number;
  isLoading: boolean;
  addToCart: (productId: number, quantity: number, size?: string, color?: string) => void;
  updateQuantity: (id: number, quantity: number) => void;
  removeItem: (id: number) => void;
  clearCart: () => void;
}

const CartContext = createContext<CartContextType>({
  items: [],
  itemCount: 0,
  isLoading: false,
  addToCart: () => {},
  updateQuantity: () => {},
  removeItem: () => {},
  clearCart: () => {},
});

export function CartProvider({ children }: { children: React.ReactNode }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isAuthenticated, user, refetch: refetchAuth } = useAuth();
  const cartQueryKey = createQueryKey("cart");
  const sessionId = getSessionId();

  const { data: items = [], isLoading } = useQuery({
    queryKey: cartQueryKey,
    queryFn: async (): Promise<CartItem[]> => {
      const res = await apiRequest("GET", `/api/cart?sessionId=${sessionId}`);
      return res.json();
    },
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (isAuthenticated && user) {
      console.log("🔄 User authenticated, refetching cart");
      queryClient.invalidateQueries({ queryKey: cartQueryKey });
      refetchAuth();
    }
  }, [isAuthenticated, user, queryClient, refetchAuth]);

  const addToCartMutation = useMutation({
    mutationFn: async (data: { productId: number; quantity: number; size?: string; color?: string }) => {
      await apiRequest("POST", "/api/cart", { ...data, sessionId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cartQueryKey });
      toast({
        title: "Added to cart",
        description: "Item has been added to your cart.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add item to cart.",
        variant: "destructive",
      });
    },
  });

  const updateQuantityMutation = useMutation({
    mutationFn: async ({ id, quantity }: { id: number; quantity: number }) => {
      await apiRequest("PUT", `/api/cart/${id}`, { quantity, sessionId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cartQueryKey });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update cart item.",
        variant: "destructive",
      });
    },
  });

  const removeItemMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/cart/${id}?sessionId=${sessionId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cartQueryKey });
      toast({
        title: "Removed from cart",
        description: "Item has been removed from your cart.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to remove item from cart.",
        variant: "destructive",
      });
    },
  });

  const clearCartMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/cart?sessionId=${sessionId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cartQueryKey });
      toast({
        title: "Cart cleared",
        description: "All items have been removed from your cart.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to clear cart.",
        variant: "destructive",
      });
    },
  });

  const itemCount = items.reduce((total: number, item: CartItem) => total + item.quantity, 0);

  return (
    <CartContext.Provider
      value={{
        items,
        itemCount,
        isLoading,
        addToCart: (productId, quantity, size, color) => {
          addToCartMutation.mutate({ productId, quantity, size, color });
        },
        updateQuantity: (id, quantity) => {
          updateQuantityMutation.mutate({ id, quantity });
        },
        removeItem: (id) => {
          removeItemMutation.mutate(id);
        },
        clearCart: () => {
          clearCartMutation.mutate();
        },
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => useContext(CartContext);
