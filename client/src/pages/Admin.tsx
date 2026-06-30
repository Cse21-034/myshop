import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { isUnauthorizedError } from "@/lib/authUtils";
import { BASE_URL } from "@/lib/queryClient";
import {
  Package,
  ShoppingCart,
  Users,
  DollarSign,
  Mail,
  Plus,
  Edit,
  Trash2,
  Eye,
  X,
  Upload,
  Image as ImageIcon,
  Link,
  Palette,
  Ruler,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Tractor,
} from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import type { Product, Order, ContactMessage } from "@shared/schema";

const productSchema = z.object({
  name: z.string().min(1, "Product name is required"),
  slug: z.string().min(1, "Product slug is required"),
  description: z.string().optional(),
  price: z.string().min(1, "Price is required"),
  originalPrice: z.string().optional(),
  categoryId: z.number().optional(),
  images: z.array(z.string()).default([]),
  sizes: z.array(z.string()).default([]),
  colors: z.array(z.string()).default([]),
  stock: z.number().min(0, "Stock must be 0 or greater"),
  featured: z.boolean().default(false),
  active: z.boolean().default(true),
  status: z.enum(["active", "inactive", "sold", "out_of_stock"]).default("active"),
  supplierUrl: z.string().url().optional().or(z.literal("")),
});

const orderStatusSchema = z.object({
  status: z.enum(["awaiting_confirmation", "confirmed", "pending", "processing", "shipped", "delivered", "cancelled"]),
});

const messageStatusSchema = z.object({
  status: z.enum(["unread", "read", "replied"]),
});

type ProductFormData = z.infer<typeof productSchema>;
type OrderStatusFormData = z.infer<typeof orderStatusSchema>;
type MessageStatusFormData = z.infer<typeof messageStatusSchema>;

export default function Admin() {
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isProductDialogOpen, setIsProductDialogOpen] = useState(false);
  const [isOrderDialogOpen, setIsOrderDialogOpen] = useState(false);
  const [isMessageDialogOpen, setIsMessageDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [editingMessage, setEditingMessage] = useState<ContactMessage | null>(null);
  
  // Bulk upload states
  const [bulkImageUrls, setBulkImageUrls] = useState("");
  const [newSize, setNewSize] = useState("");
  const [newColor, setNewColor] = useState("");
  const [supplierUrl, setSupplierUrl] = useState("");

  const productForm = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: "",
      slug: "",
      description: "",
      price: "",
      originalPrice: "",
      categoryId: undefined,
      images: [],
      sizes: [],
      colors: [],
      stock: 0,
      featured: false,
      active: true,
      status: "active",
      supplierUrl: "",
    },
  });

  const orderForm = useForm<OrderStatusFormData>({
    resolver: zodResolver(orderStatusSchema),
    defaultValues: {
      status: "pending",
    },
  });

  const messageForm = useForm<MessageStatusFormData>({
    resolver: zodResolver(messageStatusSchema),
    defaultValues: {
      status: "unread",
    },
  });

  // Watch form values for dynamic updates
  const watchedImages = productForm.watch("images");
  const watchedSizes = productForm.watch("sizes");
  const watchedColors = productForm.watch("colors");
  const watchedStock = productForm.watch("stock");
  const watchedStatus = productForm.watch("status");

  // Auto-update status based on stock
  useEffect(() => {
    if (watchedStock === 0 && watchedStatus !== "sold") {
      productForm.setValue("status", "out_of_stock");
    } else if (watchedStock > 0 && watchedStatus === "out_of_stock") {
      productForm.setValue("status", "active");
    }
  }, [watchedStock, watchedStatus, productForm]);

  // Generate slug from name
  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '');
  };

  // Watch name changes to auto-generate slug
  useEffect(() => {
    const subscription = productForm.watch((value, { name }) => {
      if (name === 'name' && value.name && !editingProduct) {
        productForm.setValue('slug', generateSlug(value.name));
      }
    });
    return () => subscription.unsubscribe();
  }, [productForm, editingProduct]);

  // Redirect to home if not authenticated or not admin
  useEffect(() => {
    if (!authLoading && (!user || !user.isAdmin)) {
      toast({
        title: "Unauthorized",
        description: "You are not authorized to access this page.",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/";
      }, 1000);
    }
  }, [user, authLoading, toast]);

  // Admin stats
  const { data: stats } = useQuery({
    queryKey: ["/api/admin/stats"],
    retry: (failureCount, error) => {
      if (isUnauthorizedError(error as Error)) {
        toast({
          title: "Session expired",
          description: "Please log in again.",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 1000);
        return false;
      }
      return failureCount < 3;
    },
  });

  // Products
  const { data: products = [] } = useQuery({
    queryKey: ["/api/products"],
    queryFn: async () => {
      const response = await fetch(`${BASE_URL}/api/products`);
      if (!response.ok) throw new Error("Failed to fetch products");
      return response.json();
    },
  });

  // Categories
  const { data: categories = [] } = useQuery({
    queryKey: ["/api/categories"],
    queryFn: async () => {
      const response = await fetch(`${BASE_URL}/api/categories`);
      if (!response.ok) throw new Error("Failed to fetch categories");
      return response.json();
    },
  });

  // Orders
  const { data: orders = [] } = useQuery({
    queryKey: ["/api/orders"],
    retry: (failureCount, error) => {
      if (isUnauthorizedError(error as Error)) {
        return false;
      }
      return failureCount < 3;
    },
  });

  // Contact messages
  const { data: messages = [] } = useQuery({
    queryKey: ["/api/contact"],
    retry: (failureCount, error) => {
      if (isUnauthorizedError(error as Error)) {
        return false;
      }
      return failureCount < 3;
    },
  });

  // Create/Update product mutation
  const productMutation = useMutation({
    mutationFn: async (data: ProductFormData) => {
      const url = editingProduct ? `/api/products/${editingProduct.id}` : "/api/products";
      const method = editingProduct ? "PUT" : "POST";
      await apiRequest(method, url, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      setIsProductDialogOpen(false);
      setEditingProduct(null);
      productForm.reset();
      resetDialogStates();
      toast({
        title: editingProduct ? "Product updated" : "Product created",
        description: "Product has been saved successfully.",
      });
    },
    onError: (error) => {
      if (isUnauthorizedError(error as Error)) {
        toast({
          title: "Session expired",
          description: "Please log in again.",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 1000);
        return;
      }
      toast({
        title: "Error",
        description: error.message || "Failed to save product.",
        variant: "destructive",
      });
    },
  });

  // Update order status mutation
  const updateOrderMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      await apiRequest("PUT", `/api/orders/${id}/status`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      setIsOrderDialogOpen(false);
      setEditingOrder(null);
      orderForm.reset();
      toast({
        title: "Order updated",
        description: "Order status has been updated successfully.",
      });
    },
    onError: (error) => {
      if (isUnauthorizedError(error as Error)) {
        toast({
          title: "Session expired",
          description: "Please log in again.",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 1000);
        return;
      }
      toast({
        title: "Error",
        description: error.message || "Failed to update order status.",
        variant: "destructive",
      });
    },
  });

  // Quick confirm / reject for farm reservations
  const confirmReservationMutation = useMutation({
    mutationFn: async ({ id, action }: { id: number; action: "confirmed" | "cancelled" }) => {
      await apiRequest("PUT", `/api/orders/${id}/status`, { status: action });
    },
    onSuccess: (_, { action }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      toast({
        title: action === "confirmed" ? "Reservation confirmed" : "Reservation rejected",
        description: action === "confirmed"
          ? "Customer has been notified via WhatsApp."
          : "Reservation has been cancelled and customer notified.",
      });
    },
    onError: (error) => {
      toast({ title: "Error", description: (error as Error).message, variant: "destructive" });
    },
  });

  // Delete order mutation
  const deleteOrderMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/orders/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      toast({
        title: "Order deleted",
        description: "Order has been deleted successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete order.",
        variant: "destructive",
      });
    },
  });

  // Update message status mutation
  const updateMessageMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      await apiRequest("PUT", `/api/contact/${id}/status`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contact"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      setIsMessageDialogOpen(false);
      setEditingMessage(null);
      messageForm.reset();
      toast({
        title: "Message updated",
        description: "Message status has been updated successfully.",
      });
    },
    onError: (error) => {
      if (isUnauthorizedError(error as Error)) {
        toast({
          title: "Session expired",
          description: "Please log in again.",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 1000);
        return;
      }
      toast({
        title: "Error",
        description: error.message || "Failed to update message status.",
        variant: "destructive",
      });
    },
  });

  // Delete message mutation
  const deleteMessageMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/contact/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contact"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      toast({
        title: "Message deleted",
        description: "Message has been deleted successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete message.",
        variant: "destructive",
      });
    },
  });


    // Delete product mutation
  const deleteProductMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/products/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      toast({
        title: "Product deleted",
        description: "Product has been deleted successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete product.",
        variant: "destructive",
      });
    },
  });

  // ERM marketplace sync
  const { data: ermStatus, refetch: refetchErmStatus } = useQuery({
    queryKey: ["/api/erm/status"],
    queryFn: async () => {
      const res = await fetch(`${BASE_URL}/api/erm/status`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch ERM status");
      return res.json();
    },
    retry: false,
  });

  const [syncResult, setSyncResult] = useState<{ created: number; updated: number; deactivated: number } | null>(null);

  const ermSyncMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/erm/sync");
      return res.json();
    },
    onSuccess: (data) => {
      const s = data.summary ?? data;
      setSyncResult({ created: s.created ?? 0, updated: s.updated ?? 0, deactivated: s.deactivated ?? 0 });
      refetchErmStatus();
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({
        title: "ERM sync complete",
        description: `Created ${s.created ?? 0}, updated ${s.updated ?? 0}, deactivated ${s.deactivated ?? 0} products.`,
      });
    },
    onError: (error) => {
      toast({
        title: "Sync failed",
        description: (error as Error).message || "Could not sync from ERM.",
        variant: "destructive",
      });
    },
  });

  const resetDialogStates = () => {
    setBulkImageUrls("");
    setNewSize("");
    setNewColor("");
    setSupplierUrl("");
  };

  const handleEditProduct = (product: Product) => {
    setEditingProduct(product);
    productForm.reset({
      name: product.name,
      slug: product.slug,
      description: product.description || "",
      price: product.price,
      originalPrice: product.originalPrice || "",
      categoryId: product.categoryId || undefined,
      images: product.images || [],
      sizes: product.sizes || [],
      colors: product.colors || [],
      stock: product.stock || 0,
      featured: product.featured || false,
      active: product.active || true,
      status: (product as any).status || "active",
      supplierUrl: (product as any).supplierUrl || "",
    });
    setSupplierUrl((product as any).supplierUrl || "");
    setIsProductDialogOpen(true);
  };

  const handleEditOrder = (order: Order) => {
    setEditingOrder(order);
    orderForm.reset({
      status: order.status,
    });
    setIsOrderDialogOpen(true);
  };

  const handleEditMessage = (message: ContactMessage) => {
    setEditingMessage(message);
    messageForm.reset({
      status: message.status,
    });
    setIsMessageDialogOpen(true);
  };

  const handleDeleteProduct = (id: number) => {
    if (confirm("Are you sure you want to delete this product?")) {
      deleteProductMutation.mutate(id);
    }
  };

  const handleDeleteOrder = (id: number) => {
    if (confirm("Are you sure you want to delete this order?")) {
      deleteOrderMutation.mutate(id);
    }
  };

  const handleDeleteMessage = (id: number) => {
    if (confirm("Are you sure you want to delete this message?")) {
      deleteMessageMutation.mutate(id);
    }
  };

  // Bulk image upload functions
  const handleBulkImageUpload = () => {
    if (bulkImageUrls.trim()) {
      const urls = bulkImageUrls
        .split('\n')
        .map(url => url.trim())
        .filter(url => url.length > 0 && isValidUrl(url));
      
      if (urls.length > 0) {
        const currentImages = productForm.getValues("images");
        const uniqueUrls = [...new Set([...currentImages, ...urls])];
        productForm.setValue("images", uniqueUrls);
        setBulkImageUrls("");
        toast({
          title: "Images added",
          description: `Added ${urls.length} images successfully.`,
        });
      } else {
        toast({
          title: "Invalid URLs",
          description: "Please enter valid image URLs.",
          variant: "destructive",
        });
      }
    }
  };

  const isValidUrl = (string: string) => {
    try {
      new URL(string);
      return true;
    } catch (_) {
      return false;
    }
  };

  const handleRemoveImage = (index: number) => {
    const currentImages = productForm.getValues("images");
    const updatedImages = currentImages.filter((_, i) => i !== index);
    productForm.setValue("images", updatedImages);
  };

  // Size management functions
  const handleAddSize = () => {
    if (newSize.trim()) {
      const currentSizes = productForm.getValues("sizes");
      if (!currentSizes.includes(newSize.trim())) {
        productForm.setValue("sizes", [...currentSizes, newSize.trim()]);
        setNewSize("");
      }
    }
  };

  const handleRemoveSize = (sizeToRemove: string) => {
    const currentSizes = productForm.getValues("sizes");
    productForm.setValue("sizes", currentSizes.filter(size => size !== sizeToRemove));
  };

  // Color management functions
  const handleAddColor = () => {
    if (newColor.trim()) {
      const currentColors = productForm.getValues("colors");
      if (!currentColors.includes(newColor.trim())) {
        productForm.setValue("colors", [...currentColors, newColor.trim()]);
        setNewColor("");
      }
    }
  };

  const handleRemoveColor = (colorToRemove: string) => {
    const currentColors = productForm.getValues("colors");
    productForm.setValue("colors", currentColors.filter(color => color !== colorToRemove));
  };

  const getStatusBadge = (status: string, stock: number) => {
    if (status === "sold") {
      return <Badge variant="destructive">Sold</Badge>;
    }
    if (status === "out_of_stock" || stock === 0) {
      return <Badge variant="secondary">Out of Stock</Badge>;
    }
    if (status === "inactive") {
      return <Badge variant="outline" className="text-gray-600 border-gray-600">Inactive</Badge>;
    }
    return <Badge variant="outline" className="text-green-600 border-green-600">Active</Badge>;
  };

  const onProductSubmit = (data: ProductFormData) => {
    const submitData = {
      ...data,
      supplierUrl: supplierUrl || undefined
    };
    productMutation.mutate(submitData);
  };

  const onOrderSubmit = (data: OrderStatusFormData) => {
    if (editingOrder) {
      updateOrderMutation.mutate({ id: editingOrder.id, status: data.status });
    }
  };

  const onMessageSubmit = (data: MessageStatusFormData) => {
    if (editingMessage) {
      updateMessageMutation.mutate({ id: editingMessage.id, status: data.status });
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/4 mb-6" />
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-32 bg-gray-200 rounded-lg" />
              ))}
            </div>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  if (!user?.isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-primary mb-8">Admin Dashboard</h1>
        
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Products</p>
                  <p className="text-2xl font-bold">{stats?.totalProducts || 0}</p>
                </div>
                <Package className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Orders</p>
                  <p className="text-2xl font-bold">{stats?.totalOrders || 0}</p>
                </div>
                <ShoppingCart className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Customers</p>
                  <p className="text-2xl font-bold">{stats?.totalCustomers || 0}</p>
                </div>
                <Users className="h-8 w-8 text-yellow-500" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Revenue</p>
                  <p className="text-2xl font-bold">${stats?.revenue?.toFixed(2) || "0.00"}</p>
                </div>
                <DollarSign className="h-8 w-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Admin Tabs */}
        <Tabs defaultValue="products" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="products">Products</TabsTrigger>
            <TabsTrigger value="orders">Orders</TabsTrigger>
            <TabsTrigger value="messages">Messages</TabsTrigger>
            <TabsTrigger value="farm-market">Farm Market</TabsTrigger>
          </TabsList>

          {/* Products Tab */}
          <TabsContent value="products">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Manage Products</CardTitle>
                  <Dialog open={isProductDialogOpen} onOpenChange={setIsProductDialogOpen}>
                    <DialogTrigger asChild>
                      <Button onClick={() => {
                        setEditingProduct(null);
                        productForm.reset();
                        resetDialogStates();
                      }}>
                        <Plus className="h-4 w-4 mr-2" />
                        Add Product
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-6xl max-h-[95vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>
                          {editingProduct ? "Edit Product" : "Add New Product"}
                        </DialogTitle>
                      </DialogHeader>
                      <Form {...productForm}>
                        <form onSubmit={productForm.handleSubmit(onProductSubmit)} className="space-y-6">
                          {/* Basic Information */}
                          <div className="grid grid-cols-2 gap-4">
                            <FormField
                              control={productForm.control}
                              name="name"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Product Name</FormLabel>
                                  <FormControl>
                                    <Input {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={productForm.control}
                              name="slug"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Slug</FormLabel>
                                  <FormControl>
                                    <Input {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>

                          <FormField
                            control={productForm.control}
                            name="description"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Description</FormLabel>
                                <FormControl>
                                  <Textarea {...field} rows={3} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          {/* Pricing and Category */}
                          <div className="grid grid-cols-3 gap-4">
                            <FormField
                              control={productForm.control}
                              name="price"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Price</FormLabel>
                                  <FormControl>
                                    <Input type="number" step="0.01" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={productForm.control}
                              name="originalPrice"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Original Price</FormLabel>
                                  <FormControl>
                                    <Input type="number" step="0.01" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={productForm.control}
                              name="categoryId"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Category</FormLabel>
                                  <Select onValueChange={(value) => field.onChange(Number(value))} value={field.value?.toString()}>
                                    <FormControl>
                                      <SelectTrigger>
                                        <SelectValue placeholder="Select category" />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      {categories.map((category: any) => (
                                        <SelectItem key={category.id} value={category.id.toString()}>
                                          {category.name}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>

                          {/* Supplier URL */}
                          <div className="space-y-2">
                            <label className="text-sm font-medium flex items-center gap-2">
                              <Link className="h-4 w-4" />
                              Supplier URL
                            </label>
                            <Input
                              type="url"
                              placeholder="https://supplier-website.com/product"
                              value={supplierUrl}
                              onChange={(e) => setSupplierUrl(e.target.value)}
                              className="w-full"
                            />
                          </div>

                          {/* Stock and Status */}
                          <div className="grid grid-cols-2 gap-4">
                            <FormField
                              control={productForm.control}
                              name="stock"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Stock</FormLabel>
                                  <FormControl>
                                    <Input type="number" {...field} onChange={(e) => field.onChange(Number(e.target.value))} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={productForm.control}
                              name="status"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Status</FormLabel>
                                  <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl>
                                      <SelectTrigger>
                                        <SelectValue placeholder="Select status" />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      <SelectItem value="active">Active</SelectItem>
                                      <SelectItem value="inactive">Inactive</SelectItem>
                                      <SelectItem value="sold">Sold</SelectItem>
                                      <SelectItem value="out_of_stock">Out of Stock</SelectItem>
                                    </SelectContent>
                                  </Select>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>

                          {/* Bulk Images Section */}
                          <div className="space-y-4">
                            <FormLabel className="flex items-center gap-2">
                              <ImageIcon className="h-4 w-4" />
                              Product Images
                            </FormLabel>
                            
                            {/* Bulk upload textarea */}
                            <div className="space-y-2">
                              <label className="text-sm text-gray-600">Bulk Upload (One URL per line)</label>
                              <Textarea
                                placeholder="https://example.com/image1.jpg&#10;https://example.com/image2.jpg&#10;https://example.com/image3.jpg"
                                value={bulkImageUrls}
                                onChange={(e) => setBulkImageUrls(e.target.value)}
                                rows={4}
                              />
                              <Button type="button" onClick={handleBulkImageUpload} variant="outline" size="sm">
                                <Upload className="h-4 w-4 mr-2" />
                                Add All Images
                              </Button>
                            </div>

                            {/* Display current images */}
                            {watchedImages && watchedImages.length > 0 && (
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                {watchedImages.map((imageUrl, index) => (
                                  <div key={index} className="relative group">
                                    <img
                                      src={imageUrl}
                                      alt={`Product image ${index + 1}`}
                                      className="w-full h-24 object-cover rounded border"
                                    />
                                    <Button
                                      type="button"
                                      variant="destructive"
                                      size="sm"
                                      className="absolute top-1 right-1 h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                      onClick={() => handleRemoveImage(index)}
                                    >
                                      <X className="h-3 w-3" />
                                    </Button>
                                  </div>
                                ))}
                              </div>
                            )}

                            {(!watchedImages || watchedImages.length === 0) && (
                              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                                <ImageIcon className="h-12 w-12 mx-auto text-gray-400 mb-2" />
                                <p className="text-gray-500">No images added yet</p>
                              </div>
                            )}
                          </div>

                          {/* Sizes Section */}
                          <div className="space-y-4">
                            <FormLabel className="flex items-center gap-2">
                              <Ruler className="h-4 w-4" />
                              Available Sizes
                            </FormLabel>
                            
                            <div className="flex gap-2">
                              <Input
                                placeholder="Enter size (e.g., S, M, L, XL)"
                                value={newSize}
                                onChange={(e) => setNewSize(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddSize())}
                                className="flex-1"
                              />
                              <Button type="button" onClick={handleAddSize} variant="outline">
                                <Plus className="h-4 w-4 mr-2" />
                                Add Size
                              </Button>
                            </div>

                            {watchedSizes && watchedSizes.length > 0 && (
                              <div className="flex flex-wrap gap-2">
                                {watchedSizes.map((size, index) => (
                                  <Badge key={index} variant="secondary" className="cursor-pointer hover:bg-red-100">
                                    {size}
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      className="h-4 w-4 p-0 ml-2 hover:bg-transparent"
                                      onClick={() => handleRemoveSize(size)}
                                    >
                                      <X className="h-3 w-3" />
                                    </Button>
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Colors Section */}
                          <div className="space-y-4">
                            <FormLabel className="flex items-center gap-2">
                              <Palette className="h-4 w-4" />
                              Available Colors
                            </FormLabel>
                            
                            <div className="flex gap-2">
                              <Input
                                placeholder="Enter color (e.g., Red, Blue, Black)"
                                value={newColor}
                                onChange={(e) => setNewColor(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddColor())}
                                className="flex-1"
                              />
                              <Button type="button" onClick={handleAddColor} variant="outline">
                                <Plus className="h-4 w-4 mr-2" />
                                Add Color
                              </Button>
                            </div>

                            {watchedColors && watchedColors.length > 0 && (
                              <div className="flex flex-wrap gap-2">
                                {watchedColors.map((color, index) => (
                                  <Badge key={index} variant="secondary" className="cursor-pointer hover:bg-red-100">
                                    {color}
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      className="h-4 w-4 p-0 ml-2 hover:bg-transparent"
                                      onClick={() => handleRemoveColor(color)}
                                    >
                                      <X className="h-3 w-3" />
                                    </Button>
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Checkboxes */}
                          <div className="flex items-center space-x-6">
                            <FormField
                              control={productForm.control}
                              name="featured"
                              render={({ field }) => (
                                <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                  <FormControl>
                                    <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                                  </FormControl>
                                  <FormLabel>Featured Product</FormLabel>
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={productForm.control}
                              name="active"
                              render={({ field }) => (
                                <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                  <FormControl>
                                    <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                                  </FormControl>
                                  <FormLabel>Active</FormLabel>
                                </FormItem>
                              )}
                            />
                          </div>

                          <Button type="submit" className="w-full" disabled={productMutation.isPending}>
                            {productMutation.isPending ? "Saving..." : (editingProduct ? "Update Product" : "Create Product")}
                          </Button>
                        </form>
                      </Form>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Price</TableHead>
                      <TableHead>Stock</TableHead>
                      <TableHead>Variants</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {products.map((product: Product) => (
                      <TableRow key={product.id}>
                        <TableCell>
                          <div className="flex items-center space-x-3">
                            <img 
                              src={product.images?.[0] || "https://images.unsplash.com/photo-1542291026-7eec264c27ff?ixlib=rb-4.0.3&auto=format&fit=crop&w=60&h=60"} 
                              alt={product.name}
                              className="w-10 h-10 rounded object-cover"
                            />
                            <div>
                              <div className="font-medium">{product.name}</div>
                              <div className="text-sm text-gray-500">#{product.id}</div>
                              {product.images && product.images.length > 1 && (
                                <div className="text-xs text-blue-500">
                                  +{product.images.length - 1} more images
                                </div>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {categories.find((c: any) => c.id === product.categoryId)?.name || "Uncategorized"}
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">${product.price}</div>
                            {product.originalPrice && (
                              <div className="text-sm text-gray-500 line-through">
                                ${product.originalPrice}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={product.stock > 0 ? "outline" : "destructive"}>
                            {product.stock > 0 ? `${product.stock} in stock` : "Out of stock"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            {product.sizes && product.sizes.length > 0 && (
                              <div className="text-xs">
                                <span className="font-medium">Sizes:</span> {product.sizes.slice(0, 3).join(", ")}
                                {product.sizes.length > 3 && ` +${product.sizes.length - 3}`}
                              </div>
                            )}
                            {product.colors && product.colors.length > 0 && (
                              <div className="text-xs">
                                <span className="font-medium">Colors:</span> {product.colors.slice(0, 2).join(", ")}
                                {product.colors.length > 2 && ` +${product.colors.length - 2}`}
                              </div>
                            )}
                            {(!product.sizes || product.sizes.length === 0) && (!product.colors || product.colors.length === 0) && (
                              <div className="text-xs text-gray-400">No variants</div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex space-x-1">
                            {product.featured && <Badge className="bg-secondary">Featured</Badge>}
                            {getStatusBadge((product as any).status || "active", product.stock)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex space-x-2">
                            <Button size="sm" variant="outline" onClick={() => handleEditProduct(product)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => handleDeleteProduct(product.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                            {(product as any).supplierUrl && (
                              <Button 
                                size="sm" 
                                variant="outline" 
                                onClick={() => window.open((product as any).supplierUrl, '_blank')}
                              >
                                <Link className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Orders Tab */}
          <TabsContent value="orders">
            <Card>
              <CardHeader>
                <CardTitle>Recent Orders</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Order ID</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orders.map((order: Order) => {
                      const isReservation = order.status === "awaiting_confirmation";
                      return (
                      <TableRow key={order.id} className={isReservation ? "bg-amber-50 border-l-4 border-l-amber-400" : ""}>
                        <TableCell>#{order.id}</TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{order.firstName} {order.lastName}</div>
                            <div className="text-sm text-gray-500">{order.email}</div>
                            {(order as any).phone && <div className="text-xs text-gray-400">{(order as any).phone}</div>}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <div>${order.total}</div>
                            {(order as any).depositAmount && (
                              <div className="text-xs text-amber-600">
                                Deposit: ${(order as any).depositAmount}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              order.status === "pending" ? "secondary"
                              : order.status === "awaiting_confirmation" ? "outline"
                              : "outline"
                            }
                            className={
                              order.status === "awaiting_confirmation" ? "border-amber-500 text-amber-700 bg-amber-50"
                              : order.status === "confirmed" ? "border-green-500 text-green-700"
                              : order.status === "cancelled" ? "border-red-400 text-red-600"
                              : order.status === "delivered" ? "border-blue-500 text-blue-700"
                              : ""
                            }
                          >
                            {order.status === "awaiting_confirmation" ? "⏳ Awaiting Confirmation" : order.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {new Date(order.createdAt!).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {isReservation && (
                              <>
                                <Button
                                  size="sm"
                                  className="bg-green-600 hover:bg-green-700 text-white text-xs px-2"
                                  disabled={confirmReservationMutation.isPending}
                                  onClick={() => confirmReservationMutation.mutate({ id: order.id, action: "confirmed" })}
                                >
                                  Confirm
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  className="text-xs px-2"
                                  disabled={confirmReservationMutation.isPending}
                                  onClick={() => confirmReservationMutation.mutate({ id: order.id, action: "cancelled" })}
                                >
                                  Reject
                                </Button>
                              </>
                            )}
                            <Dialog open={isOrderDialogOpen} onOpenChange={setIsOrderDialogOpen}>
                              <DialogTrigger asChild>
                                <Button size="sm" variant="outline" onClick={() => handleEditOrder(order)}>
                                  <Edit className="h-4 w-4" />
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>Update Order Status</DialogTitle>
                                </DialogHeader>
                                <Form {...orderForm}>
                                  <form onSubmit={orderForm.handleSubmit(onOrderSubmit)} className="space-y-4">
                                    <FormField
                                      control={orderForm.control}
                                      name="status"
                                      render={({ field }) => (
                                        <FormItem>
                                          <FormLabel>Status</FormLabel>
                                          <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl>
                                              <SelectTrigger>
                                                <SelectValue placeholder="Select status" />
                                              </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                              <SelectItem value="awaiting_confirmation">Awaiting Confirmation</SelectItem>
                                              <SelectItem value="confirmed">Confirmed</SelectItem>
                                              <SelectItem value="pending">Pending</SelectItem>
                                              <SelectItem value="processing">Processing</SelectItem>
                                              <SelectItem value="shipped">Shipped</SelectItem>
                                              <SelectItem value="delivered">Delivered</SelectItem>
                                              <SelectItem value="cancelled">Cancelled</SelectItem>
                                            </SelectContent>
                                          </Select>
                                          <FormMessage />
                                        </FormItem>
                                      )}
                                    />
                                    <Button type="submit" className="w-full" disabled={updateOrderMutation.isPending}>
                                      {updateOrderMutation.isPending ? "Updating..." : "Update Status"}
                                    </Button>
                                  </form>
                                </Form>
                              </DialogContent>
                            </Dialog>
                            <Button size="sm" variant="outline" onClick={() => handleDeleteOrder(order.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Messages Tab */}
          <TabsContent value="messages">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Mail className="h-5 w-5 mr-2" />
                  Contact Messages
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Subject</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {messages.map((message: ContactMessage) => (
                      <TableRow key={message.id}>
                        <TableCell className="font-medium">{message.name}</TableCell>
                        <TableCell>{message.email}</TableCell>
                        <TableCell>{message.subject}</TableCell>
                        <TableCell>
                          <Badge variant={message.status === "unread" ? "destructive" : "outline"}>
                            {message.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {new Date(message.createdAt!).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <div className="flex space-x-2">
                            <Button size="sm" variant="outline">
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Dialog open={isMessageDialogOpen} onOpenChange={setIsMessageDialogOpen}>
                              <DialogTrigger asChild>
                                <Button size="sm" variant="outline" onClick={() => handleEditMessage(message)}>
                                  <Edit className="h-4 w-4" />
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>Update Message Status</DialogTitle>
                                </DialogHeader>
                                <Form {...messageForm}>
                                  <form onSubmit={messageForm.handleSubmit(onMessageSubmit)} className="space-y-4">
                                    <FormField
                                      control={messageForm.control}
                                      name="status"
                                      render={({ field }) => (
                                        <FormItem>
                                          <FormLabel>Status</FormLabel>
                                          <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl>
                                              <SelectTrigger>
                                                <SelectValue placeholder="Select status" />
                                              </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                              <SelectItem value="unread">Unread</SelectItem>
                                              <SelectItem value="read">Read</SelectItem>
                                              <SelectItem value="replied">Replied</SelectItem>
                                            </SelectContent>
                                          </Select>
                                          <FormMessage />
                                        </FormItem>
                                      )}
                                    />
                                    <Button type="submit" className="w-full" disabled={updateMessageMutation.isPending}>
                                      {updateMessageMutation.isPending ? "Updating..." : "Update Status"}
                                    </Button>
                                  </form>
                                </Form>
                              </DialogContent>
                            </Dialog>
                            <Button size="sm" variant="outline" onClick={() => handleDeleteMessage(message.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Farm Market Tab */}
          <TabsContent value="farm-market">
            <div className="space-y-6">
              {/* Sync card */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Tractor className="h-5 w-5 text-green-600" />
                    ERM Farm Marketplace Sync
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-gray-600">
                    Pull the latest listings from the ERM farm marketplace into the shop. New products are created, existing ones are updated, and sold-out listings are deactivated.
                  </p>

                  <Button
                    onClick={() => ermSyncMutation.mutate()}
                    disabled={ermSyncMutation.isPending}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <RefreshCw className={`h-4 w-4 mr-2 ${ermSyncMutation.isPending ? "animate-spin" : ""}`} />
                    {ermSyncMutation.isPending ? "Syncing…" : "Sync Now"}
                  </Button>

                  {/* Last sync result */}
                  {syncResult && (
                    <div className="flex items-start gap-2 rounded-lg bg-green-50 border border-green-200 p-4">
                      <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                      <div className="text-sm text-green-800 space-y-1">
                        <p className="font-semibold">Last sync result</p>
                        <div className="flex gap-4">
                          <span><strong>{syncResult.created}</strong> created</span>
                          <span><strong>{syncResult.updated}</strong> updated</span>
                          <span><strong>{syncResult.deactivated}</strong> deactivated</span>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* ERM connection status */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">ERM Connection Status</CardTitle>
                </CardHeader>
                <CardContent>
                  {ermStatus ? (
                    <div className="space-y-3 text-sm">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                        <span className="font-medium text-gray-800">ERM API configured</span>
                      </div>
                      <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-gray-600">
                        <span className="font-medium">API URL</span>
                        <span className="truncate text-xs">{ermStatus.ermApiUrl}</span>
                        <span className="font-medium">Auto-sync</span>
                        <span>{ermStatus.autoSyncEnabled ? `Every ${ermStatus.syncIntervalMinutes} min` : "Disabled"}</span>
                        <span className="font-medium">Order notifications</span>
                        <span>{ermStatus.orderNotifyEnabled ? "Enabled" : "Disabled"}</span>
                      </div>
                      {!ermStatus.autoSyncEnabled && (
                        <div className="flex items-start gap-2 rounded-md bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
                          <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                          <span>Auto-sync is off. Set <strong>ERM_AUTO_SYNC=true</strong> in your Render environment variables to enable it.</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">Loading ERM status…</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <Footer />
    </div>
  );
}
