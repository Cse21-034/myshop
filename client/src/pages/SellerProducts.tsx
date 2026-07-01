import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation, useRoute } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest, getQueryFn, createQueryKey, BASE_URL } from "@/lib/queryClient";
import CloudinaryUpload from "@/components/CloudinaryUpload";
import { useToast } from "@/hooks/use-toast";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Plus, Edit, Trash2, ArrowLeft, Package,
  Image as ImageIcon, X, Ruler, Palette,
} from "lucide-react";

const USD_TO_BWP = 13.5;
const fmtBWP = (usd: string) =>
  `P ${(parseFloat(usd) * USD_TO_BWP).toLocaleString("en-BW", { minimumFractionDigits: 2 })}`;

const generateSlug = (name: string) =>
  name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

const productSchema = z.object({
  name: z.string().min(1, "Name is required"),
  slug: z.string().min(1, "Slug is required"),
  description: z.string().optional(),
  price: z.string().min(1, "Price is required"),
  originalPrice: z.string().optional(),
  categoryId: z.coerce.number().optional(),
  supplierUrl: z.string().url("Enter a valid URL").optional().or(z.literal("")),
  stock: z.coerce.number().min(0),
  status: z.enum(["active", "inactive", "sold", "out_of_stock"]).default("active"),
  images: z.array(z.string()).default([]),
  sizes: z.array(z.string()).default([]),
  colors: z.array(z.string()).default([]),
  featured: z.boolean().default(false),
  active: z.boolean().default(true),
  depositPercent: z.coerce.number().min(0).max(100).default(0),
});

type ProductFormData = z.infer<typeof productSchema>;

function ProductForm({
  product,
  categories,
  onSave,
  onCancel,
  isPending,
}: {
  product?: any;
  categories: any[];
  onSave: (d: ProductFormData) => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const [newSize, setNewSize] = useState("");
  const [newColor, setNewColor] = useState("");

  const form = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
    defaultValues: product
      ? {
          name: product.name,
          slug: product.slug,
          description: product.description || "",
          price: product.price,
          originalPrice: product.originalPrice || "",
          categoryId: product.categoryId ?? undefined,
          supplierUrl: product.supplierUrl || "",
          stock: product.stock ?? 0,
          status: product.status || "active",
          images: product.images || [],
          sizes: product.sizes || [],
          colors: product.colors || [],
          featured: product.featured ?? false,
          active: product.active ?? true,
          depositPercent: product.depositPercent ?? 0,
        }
      : {
          name: "", slug: "", description: "", price: "", originalPrice: "",
          categoryId: undefined, supplierUrl: "", stock: 0, status: "active",
          images: [], sizes: [], colors: [], featured: false, active: true, depositPercent: 0,
        },
  });

  const watchedImages = form.watch("images");
  const watchedSizes = form.watch("sizes");
  const watchedColors = form.watch("colors");
  const watchedStock = form.watch("stock");
  const watchedStatus = form.watch("status");

  // Auto-sync status with stock
  useEffect(() => {
    if (watchedStock === 0 && watchedStatus !== "sold") {
      form.setValue("status", "out_of_stock");
    } else if (watchedStock > 0 && watchedStatus === "out_of_stock") {
      form.setValue("status", "active");
    }
  }, [watchedStock, watchedStatus, form]);

  // Auto-generate slug from name (new products only)
  useEffect(() => {
    const sub = form.watch((value, { name }) => {
      if (name === "name" && value.name && !product) {
        form.setValue("slug", generateSlug(value.name));
      }
    });
    return () => sub.unsubscribe();
  }, [form, product]);

  function handleAddSize() {
    const s = newSize.trim();
    if (!s) return;
    form.setValue("sizes", [...(form.getValues("sizes") || []), s]);
    setNewSize("");
  }

  function handleRemoveSize(size: string) {
    form.setValue("sizes", (form.getValues("sizes") || []).filter(s => s !== size));
  }

  function handleAddColor() {
    const c = newColor.trim();
    if (!c) return;
    form.setValue("colors", [...(form.getValues("colors") || []), c]);
    setNewColor("");
  }

  function handleRemoveColor(color: string) {
    form.setValue("colors", (form.getValues("colors") || []).filter(c => c !== color));
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{product ? "Edit Product" : "New Product"}</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSave)} className="space-y-6">

            {/* Name + Slug */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Product Name *</FormLabel>
                  <FormControl><Input placeholder="e.g. Fresh Maize 50kg" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="slug" render={({ field }) => (
                <FormItem>
                  <FormLabel>Slug *</FormLabel>
                  <FormControl><Input placeholder="fresh-maize-50kg" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            {/* Description */}
            <FormField control={form.control} name="description" render={({ field }) => (
              <FormItem>
                <FormLabel>Description</FormLabel>
                <FormControl><Textarea placeholder="Describe your product..." rows={3} {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            {/* Price + Original Price */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField control={form.control} name="price" render={({ field }) => (
                <FormItem>
                  <FormLabel>Price (USD) *</FormLabel>
                  <FormControl><Input type="number" step="0.01" placeholder="0.00" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="originalPrice" render={({ field }) => (
                <FormItem>
                  <FormLabel>Original Price (USD)</FormLabel>
                  <FormControl><Input type="number" step="0.01" placeholder="0.00" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            {/* Category */}
            <FormField control={form.control} name="categoryId" render={({ field }) => (
              <FormItem>
                <FormLabel>Category</FormLabel>
                <Select
                  onValueChange={v => field.onChange(Number(v))}
                  value={field.value?.toString()}
                >
                  <FormControl>
                    <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {categories.map((c: any) => (
                      <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />

            {/* Supplier URL */}
            <FormField control={form.control} name="supplierUrl" render={({ field }) => (
              <FormItem>
                <FormLabel>Supplier URL</FormLabel>
                <FormControl>
                  <Input placeholder="https://supplier-website.com/product" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            {/* Stock + Status + Deposit */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField control={form.control} name="stock" render={({ field }) => (
                <FormItem>
                  <FormLabel>Stock</FormLabel>
                  <FormControl><Input type="number" min="0" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="status" render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                      <SelectItem value="sold">Sold</SelectItem>
                      <SelectItem value="out_of_stock">Out of Stock</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="depositPercent" render={({ field }) => (
                <FormItem>
                  <FormLabel>Deposit % (0 = no deposit)</FormLabel>
                  <FormControl><Input type="number" min="0" max="100" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            {/* Product Images */}
            <div className="space-y-2">
              <FormLabel className="flex items-center gap-2">
                <ImageIcon className="h-4 w-4" />
                Product Images
              </FormLabel>
              <CloudinaryUpload
                images={watchedImages ?? []}
                onChange={urls => form.setValue("images", urls)}
              />
            </div>

            {/* Available Sizes */}
            <div className="space-y-4">
              <FormLabel className="flex items-center gap-2">
                <Ruler className="h-4 w-4" />
                Available Sizes
              </FormLabel>
              <div className="flex gap-2">
                <Input
                  placeholder="Enter size (e.g., S, M, L, XL)"
                  value={newSize}
                  onChange={e => setNewSize(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && (e.preventDefault(), handleAddSize())}
                  className="flex-1"
                />
                <Button type="button" onClick={handleAddSize} variant="outline">
                  <Plus className="h-4 w-4 mr-2" /> Add Size
                </Button>
              </div>
              {watchedSizes && watchedSizes.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {watchedSizes.map((size, i) => (
                    <Badge key={i} variant="secondary" className="cursor-pointer hover:bg-red-100">
                      {size}
                      <button type="button" className="ml-2" onClick={() => handleRemoveSize(size)}>
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {/* Available Colors */}
            <div className="space-y-4">
              <FormLabel className="flex items-center gap-2">
                <Palette className="h-4 w-4" />
                Available Colors
              </FormLabel>
              <div className="flex gap-2">
                <Input
                  placeholder="Enter color (e.g., Red, Blue, Black)"
                  value={newColor}
                  onChange={e => setNewColor(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && (e.preventDefault(), handleAddColor())}
                  className="flex-1"
                />
                <Button type="button" onClick={handleAddColor} variant="outline">
                  <Plus className="h-4 w-4 mr-2" /> Add Color
                </Button>
              </div>
              {watchedColors && watchedColors.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {watchedColors.map((color, i) => (
                    <Badge key={i} variant="secondary" className="cursor-pointer hover:bg-red-100">
                      {color}
                      <button type="button" className="ml-2" onClick={() => handleRemoveColor(color)}>
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {/* Featured + Active */}
            <div className="flex items-center space-x-6">
              <FormField control={form.control} name="featured" render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                  <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                  <FormLabel>Featured Product</FormLabel>
                </FormItem>
              )} />
              <FormField control={form.control} name="active" render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                  <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                  <FormLabel>Active</FormLabel>
                </FormItem>
              )} />
            </div>

            <div className="flex gap-3 pt-2">
              <Button type="submit" className="flex-1" disabled={isPending}>
                {isPending ? "Saving..." : product ? "Update Product" : "Create Product"}
              </Button>
              <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

export default function SellerProducts() {
  const [, navigate] = useLocation();
  const [isNew] = useRoute("/seller/products/new");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editingProduct, setEditingProduct] = useState<any | null>(null);

  const { data: seller } = useQuery({
    queryKey: createQueryKey("/api/seller/me"),
    queryFn: getQueryFn({ on401: "returnNull" }),
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["/api/categories"],
    queryFn: async () => {
      const res = await fetch(`${BASE_URL}/api/categories`);
      return res.json();
    },
  });

  const { data: products = [], isLoading } = useQuery({
    queryKey: createQueryKey("/api/seller/products"),
    queryFn: getQueryFn({ on401: "returnNull" }),
    enabled: seller?.status === "approved",
  });

  const createMutation = useMutation({
    mutationFn: async (data: ProductFormData) => {
      const res = await apiRequest("POST", "/api/seller/products", data);
      if (!res.ok) throw new Error((await res.json()).message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: createQueryKey("/api/seller/products") });
      toast({ title: "Product created!" });
      navigate("/seller/products");
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: ProductFormData }) => {
      const res = await apiRequest("PUT", `/api/seller/products/${id}`, data);
      if (!res.ok) throw new Error((await res.json()).message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: createQueryKey("/api/seller/products") });
      toast({ title: "Product updated!" });
      setEditingProduct(null);
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/seller/products/${id}`, undefined);
      if (!res.ok) throw new Error((await res.json()).message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: createQueryKey("/api/seller/products") });
      toast({ title: "Product deleted." });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const statusBadge: Record<string, string> = {
    active: "bg-green-100 text-green-700",
    inactive: "bg-gray-100 text-gray-600",
    sold: "bg-blue-100 text-blue-700",
    out_of_stock: "bg-red-100 text-red-700",
  };

  if (isNew) {
    return (
      <div className="min-h-screen flex flex-col bg-gray-50">
        <Header />
        <main className="flex-grow container mx-auto px-4 py-8 max-w-3xl">
          <Button variant="ghost" className="mb-4 gap-1" onClick={() => navigate("/seller/products")}>
            <ArrowLeft className="h-4 w-4" /> Back to Products
          </Button>
          <ProductForm
            categories={categories}
            onSave={d => createMutation.mutate(d)}
            onCancel={() => navigate("/seller/products")}
            isPending={createMutation.isPending}
          />
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header />
      <main className="flex-grow container mx-auto px-4 py-8 max-w-5xl">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate("/seller/dashboard")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-2xl font-bold text-primary">My Products</h1>
          </div>
          <Button onClick={() => navigate("/seller/products/new")} className="gap-2">
            <Plus className="h-4 w-4" /> Add Product
          </Button>
        </div>

        {editingProduct && (
          <div className="mb-8">
            <ProductForm
              product={editingProduct}
              categories={categories}
              onSave={d => updateMutation.mutate({ id: editingProduct.id, data: d })}
              onCancel={() => setEditingProduct(null)}
              isPending={updateMutation.isPending}
            />
          </div>
        )}

        {isLoading ? (
          <p className="text-center text-gray-500 py-12">Loading products...</p>
        ) : products.length === 0 ? (
          <Card className="text-center py-16">
            <CardContent>
              <Package className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 mb-4">You haven't listed any products yet.</p>
              <Button onClick={() => navigate("/seller/products/new")}>List your first product</Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {products.map((p: any) => (
              <Card key={p.id}>
                <CardContent className="pt-4 flex items-center gap-4">
                  <img
                    src={p.images?.[0] || p.supplierUrl || "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=80&h=80&fit=crop"}
                    alt={p.name}
                    className="w-16 h-16 object-cover rounded"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate">{p.name}</p>
                    <p className="text-sm text-gray-500">
                      Stock: {p.stock ?? 0} · {fmtBWP(p.price)}
                      {p.originalPrice && <span className="line-through text-gray-400 ml-2">{fmtBWP(p.originalPrice)}</span>}
                    </p>
                    <div className="flex gap-1 mt-1 flex-wrap">
                      {p.featured && <Badge className="text-xs bg-yellow-100 text-yellow-700">Featured</Badge>}
                      {p.sizes?.length > 0 && <Badge variant="outline" className="text-xs">{p.sizes.length} sizes</Badge>}
                      {p.colors?.length > 0 && <Badge variant="outline" className="text-xs">{p.colors.length} colors</Badge>}
                      {p.depositPercent > 0 && <Badge className="text-xs bg-amber-100 text-amber-700">{p.depositPercent}% deposit</Badge>}
                    </div>
                  </div>
                  <Badge className={`text-xs ${statusBadge[p.status] ?? "bg-gray-100"}`}>{p.status}</Badge>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => setEditingProduct(p)}>
                      <Edit className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => {
                      if (confirm("Delete this product?")) deleteMutation.mutate(p.id);
                    }}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
