import { useState } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Store, CheckCircle, Clock } from "lucide-react";

const applySchema = z.object({
  storeName: z.string().min(2, "Store name must be at least 2 characters"),
  description: z.string().min(10, "Please describe your store (at least 10 characters)"),
  phone: z.string().min(7, "Please enter a valid phone number"),
  address: z.string().min(5, "Please enter your business address"),
  logoUrl: z.string().url("Please enter a valid URL").optional().or(z.literal("")),
});

type ApplyFormData = z.infer<typeof applySchema>;

export default function SellerApply() {
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const { data: existing, isLoading } = useQuery({
    queryKey: ["/api/seller/me"],
    retry: false,
    // 404 means no application yet — that's fine
  });

  const form = useForm<ApplyFormData>({
    resolver: zodResolver(applySchema),
    defaultValues: { storeName: "", description: "", phone: "", address: "", logoUrl: "" },
  });

  const applyMutation = useMutation({
    mutationFn: async (data: ApplyFormData) => {
      const res = await apiRequest("POST", "/api/seller/apply", data);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message);
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Application submitted!", description: "We'll review your application and notify you within 24 hours." });
      navigate("/seller/dashboard");
    },
    onError: (err: Error) => {
      toast({ title: "Failed to submit", description: err.message, variant: "destructive" });
    },
  });

  if (isLoading) return null;

  // Already applied
  if (existing) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-grow container mx-auto px-[10px] sm:px-4 py-16 max-w-lg text-center">
          {existing.status === "approved" ? (
            <>
              <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
              <h1 className="text-2xl font-bold mb-2">You're an approved seller!</h1>
              <p className="text-gray-600 mb-6">Head to your dashboard to manage products and orders.</p>
              <Button onClick={() => navigate("/seller/dashboard")}>Go to Dashboard</Button>
            </>
          ) : existing.status === "rejected" ? (
            <>
              <div className="text-4xl mb-4">❌</div>
              <h1 className="text-2xl font-bold mb-2">Application not approved</h1>
              <p className="text-gray-600 mb-6">Your application was reviewed but not approved. Please contact support for more information.</p>
            </>
          ) : (
            <>
              <Clock className="h-16 w-16 text-amber-500 mx-auto mb-4" />
              <h1 className="text-2xl font-bold mb-2">Application under review</h1>
              <p className="text-gray-600">Your seller application is being reviewed. We'll notify you within 24 hours.</p>
            </>
          )}
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-grow container mx-auto px-[10px] sm:px-4 py-12 max-w-2xl">
        <div className="flex items-center gap-3 mb-8">
          <Store className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold text-primary">Become a Seller</h1>
            <p className="text-gray-600">Set up your store and start selling on Fountstream</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-8">
          {[
            { step: "1", title: "Apply", desc: "Fill in your store details" },
            { step: "2", title: "Get approved", desc: "We review within 24h" },
            { step: "3", title: "Start selling", desc: "Upload products & earn" },
          ].map(s => (
            <Card key={s.step} className="text-center p-4">
              <div className="w-8 h-8 bg-primary text-white rounded-full flex items-center justify-center mx-auto mb-2 text-sm font-bold">{s.step}</div>
              <p className="font-semibold text-sm">{s.title}</p>
              <p className="text-xs text-gray-500">{s.desc}</p>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Store Information</CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(d => applyMutation.mutate(d))} className="space-y-4">
                <FormField control={form.control} name="storeName" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Store Name *</FormLabel>
                    <FormControl><Input placeholder="e.g. Thabo's Fresh Farm" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="description" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Store Description *</FormLabel>
                    <FormControl><Textarea placeholder="Tell customers what you sell..." rows={3} {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="phone" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone Number *</FormLabel>
                      <FormControl><Input placeholder="+267 7X XXX XXX" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="logoUrl" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Logo URL (optional)</FormLabel>
                      <FormControl><Input placeholder="https://..." {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <FormField control={form.control} name="address" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Business Address *</FormLabel>
                    <FormControl><Input placeholder="Plot 1234, Gaborone" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <Button type="submit" className="w-full" disabled={applyMutation.isPending}>
                  {applyMutation.isPending ? "Submitting..." : "Submit Application"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  );
}
