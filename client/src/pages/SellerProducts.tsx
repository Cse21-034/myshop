import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation, useRoute } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest, getQueryFn, createQueryKey, BASE_URL } from "@/lib/queryClient";
import CloudinaryUpload from "@/components/CloudinaryUpload";
import SellerLayout from "@/components/SellerLayout";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Plus, Edit, Trash2, ArrowLeft, Package,
  Image as ImageIcon, X, Ruler, Palette, ListChecks,
} from "lucide-react";

const USD_TO_BWP = 13.5;
const fmtBWP = (usd: string) =>
  `P ${(parseFloat(usd) * USD_TO_BWP).toLocaleString("en-BW", { minimumFractionDigits: 2 })}`;

const generateSlug = (name: string) => {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  return `${base}-${Date.now().toString(36)}`;
};

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
  features: z.array(z.string()).default([]),
  featured: z.boolean().default(false),
  active: z.boolean().default(true),
  depositPercent: z.coerce.number().min(0).max(100).default(0),
});

type ProductFormData = z.infer<typeof productSchema>;

const STATUS_BADGE: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-700",
  inactive: "bg-gray-100 text-gray-600",
  sold: "bg-blue-100 text-blue-700",
  out_of_stock: "bg-red-100 text-red-700",
};

// ── Product form ──────────────────────────────────────────────────────────────
function ProductForm({
  product, categories, onSave, onCancel, isPending, serverError,
}: {
  product?: any; categories: any[]; onSave: (d: ProductFormData) => void;
  onCancel: () => void; isPending: boolean; serverError?: string | null;
}) {
  const [newSize, setNewSize] = useState("");
  const [newColor, setNewColor] = useState("");
  const [newFeature, setNewFeature] = useState("");

  const form = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
    defaultValues: product ? {
      name: product.name, slug: product.slug, description: product.description || "",
      price: product.price, originalPrice: product.originalPrice || "",
      categoryId: product.categoryId ?? undefined, supplierUrl: product.supplierUrl || "",
      stock: product.stock ?? 0, status: product.status || "active",
      images: product.images || [], sizes: product.sizes || [], colors: product.colors || [],
      features: product.features || [],
      featured: product.featured ?? false, active: product.active ?? true,
      depositPercent: product.depositPercent ?? 0,
    } : {
      name: "", slug: "", description: "", price: "", originalPrice: "",
      categoryId: undefined, supplierUrl: "", stock: 0, status: "active",
      images: [], sizes: [], colors: [], features: [], featured: false, active: true, depositPercent: 0,
    },
  });

  const watchedImages = form.watch("images");
  const watchedSizes = form.watch("sizes");
  const watchedColors = form.watch("colors");
  const watchedFeatures = form.watch("features");
  const watchedStock = form.watch("stock");
  const watchedStatus = form.watch("status");

  useEffect(() => {
    if (watchedStock === 0 && watchedStatus !== "sold") form.setValue("status", "out_of_stock");
    else if (watchedStock > 0 && watchedStatus === "out_of_stock") form.setValue("status", "active");
  }, [watchedStock, watchedStatus]);

  useEffect(() => {
    const sub = form.watch((value, { name }) => {
      if (name === "name" && value.name && !product) form.setValue("slug", generateSlug(value.name));
    });
    return () => sub.unsubscribe();
  }, [form, product]);

  function addSize() {
    const s = newSize.trim();
    if (!s) return;
    form.setValue("sizes", [...(form.getValues("sizes") || []), s]);
    setNewSize("");
  }

  function addColor() {
    const c = newColor.trim();
    if (!c) return;
    form.setValue("colors", [...(form.getValues("colors") || []), c]);
    setNewColor("");
  }

  function addFeature() {
    const f = newFeature.trim();
    if (!f) return;
    form.setValue("features", [...(form.getValues("features") || []), f]);
    setNewFeature("");
  }

  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="p-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSave)} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem><FormLabel>Product Name *</FormLabel><FormControl><Input placeholder="e.g. Fresh Maize 50kg" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="slug" render={({ field }) => (
                <FormItem><FormLabel>Slug *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
            </div>

            <FormField control={form.control} name="description" render={({ field }) => (
              <FormItem><FormLabel>Description</FormLabel><FormControl><Textarea placeholder="Describe your product..." rows={3} {...field} /></FormControl><FormMessage /></FormItem>
            )} />

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <FormField control={form.control} name="price" render={({ field }) => (
                <FormItem><FormLabel>Price (USD) *</FormLabel><FormControl><Input type="number" step="0.01" placeholder="0.00" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="originalPrice" render={({ field }) => (
                <FormItem><FormLabel>Original Price</FormLabel><FormControl><Input type="number" step="0.01" placeholder="0.00" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="stock" render={({ field }) => (
                <FormItem><FormLabel>Stock</FormLabel><FormControl><Input type="number" min="0" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="depositPercent" render={({ field }) => (
                <FormItem><FormLabel>Deposit %</FormLabel><FormControl><Input type="number" min="0" max="100" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField control={form.control} name="categoryId" render={({ field }) => (
                <FormItem><FormLabel>Category</FormLabel>
                  <Select onValueChange={v => field.onChange(Number(v))} value={field.value?.toString()}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger></FormControl>
                    <SelectContent>{categories.map((c: any) => <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>)}</SelectContent>
                  </Select><FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="status" render={({ field }) => (
                <FormItem><FormLabel>Status</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                      <SelectItem value="sold">Sold</SelectItem>
                      <SelectItem value="out_of_stock">Out of Stock</SelectItem>
                    </SelectContent>
                  </Select><FormMessage />
                </FormItem>
              )} />
            </div>

            <FormField control={form.control} name="supplierUrl" render={({ field }) => (
              <FormItem><FormLabel>Supplier URL</FormLabel><FormControl><Input placeholder="https://supplier-website.com/product" {...field} /></FormControl><FormMessage /></FormItem>
            )} />

            <div className="space-y-2">
              <FormLabel className="flex items-center gap-2"><ImageIcon className="h-4 w-4" />Product Images</FormLabel>
              <CloudinaryUpload images={watchedImages ?? []} onChange={urls => form.setValue("images", urls)} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <FormLabel className="flex items-center gap-2"><Ruler className="h-4 w-4" />Sizes</FormLabel>
                <div className="flex gap-2">
                  <Input placeholder="S, M, L…" value={newSize} onChange={e => setNewSize(e.target.value)} onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addSize())} />
                  <Button type="button" variant="outline" size="sm" onClick={addSize}>Add</Button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {(watchedSizes || []).map((s, i) => (
                    <Badge key={i} variant="secondary" className="gap-1">{s}
                      <button type="button" onClick={() => form.setValue("sizes", (watchedSizes || []).filter((_, j) => j !== i))}><X className="h-3 w-3" /></button>
                    </Badge>
                  ))}
                </div>
              </div>
              <div className="space-y-3">
                <FormLabel className="flex items-center gap-2"><Palette className="h-4 w-4" />Colors</FormLabel>
                <div className="flex gap-2">
                  <Input placeholder="Red, Blue…" value={newColor} onChange={e => setNewColor(e.target.value)} onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addColor())} />
                  <Button type="button" variant="outline" size="sm" onClick={addColor}>Add</Button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {(watchedColors || []).map((c, i) => (
                    <Badge key={i} variant="secondary" className="gap-1">{c}
                      <button type="button" onClick={() => form.setValue("colors", (watchedColors || []).filter((_, j) => j !== i))}><X className="h-3 w-3" /></button>
                    </Badge>
                  ))}
                </div>
              </div>
            </div>

            {/* Product Features */}
            <div className="space-y-3">
              <FormLabel className="flex items-center gap-2"><ListChecks className="h-4 w-4" />Product Features</FormLabel>
              <p className="text-xs text-gray-500">Add specific features customers should know — e.g. "Free delivery", "1-year warranty", "Handmade", "Organic certified".</p>
              <div className="flex gap-2">
                <Input
                  placeholder="e.g. Free delivery on orders over P500"
                  value={newFeature}
                  onChange={e => setNewFeature(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addFeature())}
                />
                <Button type="button" variant="outline" size="sm" onClick={addFeature}>Add</Button>
              </div>
              <div className="flex flex-col gap-1.5">
                {(watchedFeatures || []).map((f, i) => (
                  <div key={i} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2 text-sm">
                    <span className="text-gray-700">{f}</span>
                    <button
                      type="button"
                      onClick={() => form.setValue("features", (watchedFeatures || []).filter((_, j) => j !== i))}
                      className="text-gray-300 hover:text-red-400 ml-2"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
                {(watchedFeatures || []).length === 0 && (
                  <p className="text-xs text-gray-400 italic">No features added yet.</p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-6">
              <FormField control={form.control} name="featured" render={({ field }) => (
                <FormItem className="flex items-center gap-2 space-y-0"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><FormLabel className="font-normal">Featured</FormLabel></FormItem>
              )} />
              <FormField control={form.control} name="active" render={({ field }) => (
                <FormItem className="flex items-center gap-2 space-y-0"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><FormLabel className="font-normal">Active</FormLabel></FormItem>
              )} />
            </div>

            {serverError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{serverError}</div>
            )}

            <div className="flex gap-3 pt-2">
              <Button type="submit" className="flex-1" disabled={isPending}>
                {isPending ? "Saving…" : product ? "Update Product" : "Create Product"}
              </Button>
              <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function SellerProducts() {
  const [, navigate] = useLocation();
  const [isNew] = useRoute("/seller/products/new");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editingProduct, setEditingProduct] = useState<any | null>(null);

  const { data: categories = [] } = useQuery({
    queryKey: ["/api/categories"],
    queryFn: async () => (await fetch(`${BASE_URL}/api/categories`)).json(),
  });

  const { data: products = [], isLoading } = useQuery({
    queryKey: createQueryKey("/api/seller/products"),
    queryFn: getQueryFn({ on401: "returnNull" }),
  });

  const createMutation = useMutation<void, Error, ProductFormData>({
    mutationFn: async (data) => {
      const res = await apiRequest("POST", "/api/seller/products", data);
      if (!res.ok) throw new Error((await res.json()).message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: createQueryKey("/api/seller/products") });
      toast({ title: "Product created!" });
      navigate("/seller/products");
    },
  });

  const updateMutation = useMutation<void, Error, { id: number; data: ProductFormData }>({
    mutationFn: async ({ id, data }) => {
      const res = await apiRequest("PUT", `/api/seller/products/${id}`, data);
      if (!res.ok) throw new Error((await res.json()).message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: createQueryKey("/api/seller/products") });
      toast({ title: "Product updated!" });
      setEditingProduct(null);
    },
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

  if (isNew) {
    return (
      <SellerLayout title="Add Product" action={
        <Button variant="ghost" size="sm" onClick={() => navigate("/seller/products")} className="gap-1">
          <ArrowLeft className="h-4 w-4" /> Products
        </Button>
      }>
        {() => (
          <ProductForm
            categories={categories}
            onSave={d => createMutation.mutate(d)}
            onCancel={() => navigate("/seller/products")}
            isPending={createMutation.isPending}
            serverError={createMutation.error?.message}
          />
        )}
      </SellerLayout>
    );
  }

  return (
    <SellerLayout
      title="My Products"
      action={
        <Button size="sm" onClick={() => navigate("/seller/products/new")} className="gap-2">
          <Plus className="h-4 w-4" /> Add Product
        </Button>
      }
    >
      {() => (
        <div className="space-y-4">
          {/* Inline edit form */}
          {editingProduct && (
            <ProductForm
              product={editingProduct}
              categories={categories}
              onSave={d => updateMutation.mutate({ id: editingProduct.id, data: d })}
              onCancel={() => setEditingProduct(null)}
              isPending={updateMutation.isPending}
              serverError={updateMutation.error?.message}
            />
          )}

          {/* Product list */}
          {isLoading ? (
            <p className="text-center text-gray-400 py-12">Loading products…</p>
          ) : (products as any[]).length === 0 ? (
            <Card className="border-0 shadow-sm">
              <CardContent className="flex flex-col items-center py-16 text-center">
                <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mb-4">
                  <Package className="h-7 w-7 text-gray-400" />
                </div>
                <p className="text-gray-500 mb-4">You haven't listed any products yet.</p>
                <Button onClick={() => navigate("/seller/products/new")}>List your first product</Button>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-0 shadow-sm">
              <CardContent className="p-0">
                <div className="divide-y divide-gray-50">
                  {(products as any[]).map((p) => (
                    <div key={p.id} className="flex items-center gap-4 px-4 py-3 hover:bg-gray-50/50 transition-colors">
                      <img
                        src={p.images?.[0] || "https://placehold.co/56x56/f3f4f6/9ca3af?text=?"}
                        alt={p.name}
                        className="w-14 h-14 object-cover rounded-lg flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm truncate">{p.name}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          Stock: <span className="font-medium text-gray-600">{p.stock ?? 0}</span>
                          {" · "}
                          <span className="font-medium text-gray-700">{fmtBWP(p.price)}</span>
                          {p.originalPrice && <span className="line-through text-gray-400 ml-1">{fmtBWP(p.originalPrice)}</span>}
                        </p>
                        <div className="flex gap-1 mt-1 flex-wrap">
                          {p.featured && <Badge className="text-xs bg-amber-100 text-amber-700">Featured</Badge>}
                          {p.sizes?.length > 0 && <Badge variant="outline" className="text-xs">{p.sizes.length} sizes</Badge>}
                          {p.colors?.length > 0 && <Badge variant="outline" className="text-xs">{p.colors.length} colors</Badge>}
                          {p.depositPercent > 0 && <Badge className="text-xs bg-amber-100 text-amber-700">{p.depositPercent}% deposit</Badge>}
                        </div>
                      </div>
                      <Badge className={`text-xs flex-shrink-0 ${STATUS_BADGE[p.status] ?? "bg-gray-100"}`}>{p.status.replace(/_/g, " ")}</Badge>
                      <div className="flex gap-1 flex-shrink-0">
                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => setEditingProduct(p)}>
                          <Edit className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="sm" variant="ghost" className="h-8 w-8 p-0 text-red-500 hover:text-red-700"
                          onClick={() => confirm("Delete this product?") && deleteMutation.mutate(p.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </SellerLayout>
  );
}
