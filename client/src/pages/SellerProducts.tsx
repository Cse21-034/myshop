import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation, useRoute } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest, getQueryFn, createQueryKey } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, Trash2, ArrowLeft, Package } from "lucide-react";

const USD_TO_BWP = 13.5;
const fmtBWP = (usd: string) => `P ${(parseFloat(usd) * USD_TO_BWP).toLocaleString("en-BW", { minimumFractionDigits: 2 })}`;

const productSchema = z.object({
  name: z.string().min(1, "Name is required"),
  slug: z.string().min(1, "Slug is required"),
  description: z.string().optional(),
  price: z.string().min(1, "Price is required"),
  stock: z.coerce.number().min(0),
  status: z.enum(["active", "inactive", "sold", "out_of_stock"]).default("active"),
  supplierUrl: z.string().url().optional().or(z.literal("")),
  depositPercent: z.coerce.number().min(0).max(100).default(0),
});

type ProductFormData = z.infer<typeof productSchema>;

function ProductForm({ product, onSave, onCancel }: { product?: any; onSave: (d: ProductFormData) => void; onCancel: () => void }) {
  const form = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
    defaultValues: product
      ? { ...product, price: product.price, stock: product.stock ?? 0, depositPercent: product.depositPercent ?? 0 }
      : { name: "", slug: "", description: "", price: "", stock: 0, status: "active", supplierUrl: "", depositPercent: 0 },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>{product ? "Edit Product" : "New Product"}</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSave)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Product Name *</FormLabel>
                  <FormControl><Input placeholder="e.g. Fresh Maize 50kg" {...field}
                    onChange={e => {
                      field.onChange(e);
                      if (!product) {
                        form.setValue("slug", e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""));
                      }
                    }}
                  /></FormControl>
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
            <FormField control={form.control} name="description" render={({ field }) => (
              <FormItem>
                <FormLabel>Description</FormLabel>
                <FormControl><Textarea placeholder="Describe your product..." rows={3} {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <div className="grid grid-cols-3 gap-4">
              <FormField control={form.control} name="price" render={({ field }) => (
                <FormItem>
                  <FormLabel>Price (USD) *</FormLabel>
                  <FormControl><Input type="number" step="0.01" placeholder="0.00" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="stock" render={({ field }) => (
                <FormItem>
                  <FormLabel>Stock</FormLabel>
                  <FormControl><Input type="number" min="0" {...field} /></FormControl>
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
            <div className="grid grid-cols-2 gap-4">
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
              <FormField control={form.control} name="supplierUrl" render={({ field }) => (
                <FormItem>
                  <FormLabel>Product Image URL</FormLabel>
                  <FormControl><Input placeholder="https://..." {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            <div className="flex gap-3 pt-2">
              <Button type="submit" className="flex-1">Save Product</Button>
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

  const { data: products = [], isLoading } = useQuery({
    queryKey: createQueryKey("/api/seller/products"),
    queryFn: getQueryFn({ on401: "returnNull" }),
    enabled: seller?.status === "approved",
  });

  const createMutation = useMutation({
    mutationFn: async (data: ProductFormData) => {
      const res = await apiRequest("POST", "/api/seller/products", { ...data, images: [], sizes: [], colors: [] });
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
        <main className="flex-grow container mx-auto px-4 py-8 max-w-2xl">
          <Button variant="ghost" className="mb-4 gap-1" onClick={() => navigate("/seller/products")}>
            <ArrowLeft className="h-4 w-4" /> Back to Products
          </Button>
          <ProductForm
            onSave={d => createMutation.mutate(d)}
            onCancel={() => navigate("/seller/products")}
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
            <Button variant="ghost" size="sm" onClick={() => navigate("/seller/dashboard")}><ArrowLeft className="h-4 w-4" /></Button>
            <h1 className="text-2xl font-bold text-primary">My Products</h1>
          </div>
          <Button onClick={() => navigate("/seller/products/new")} className="gap-2">
            <Plus className="h-4 w-4" /> Add Product
          </Button>
        </div>

        {editingProduct && (
          <div className="mb-6">
            <ProductForm
              product={editingProduct}
              onSave={d => updateMutation.mutate({ id: editingProduct.id, data: d })}
              onCancel={() => setEditingProduct(null)}
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
                    <p className="text-sm text-gray-500">Stock: {p.stock ?? 0} · {fmtBWP(p.price)}</p>
                    {p.depositPercent > 0 && <p className="text-xs text-amber-600">{p.depositPercent}% deposit required</p>}
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
