import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { BASE_URL, apiRequest } from "@/lib/queryClient";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Eye, RotateCcw } from "lucide-react";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";

type Order = {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  total: string;
  status: string;
  createdAt: string;
};

const USD_TO_BWP = 13.5;
function convertUsdToBwp(usdAmount: string | number): string {
  const usd = typeof usdAmount === "string" ? parseFloat(usdAmount) : usdAmount;
  if (isNaN(usd)) return "P 0.00";
  return `P ${(usd * USD_TO_BWP).toLocaleString("en-BW", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function statusClass(s: string) {
  if (s === "delivered") return "bg-green-100 text-green-800 border-green-200";
  if (s === "shipped") return "bg-purple-100 text-purple-800 border-purple-200";
  if (s === "processing" || s === "confirmed") return "bg-blue-100 text-blue-800 border-blue-200";
  if (s === "cancelled") return "bg-red-100 text-red-800 border-red-200";
  if (s === "awaiting_confirmation") return "bg-amber-100 text-amber-800 border-amber-200";
  return "bg-gray-100 text-gray-700 border-gray-200";
}

export default function Orders() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [returnOrderId, setReturnOrderId] = useState<number | null>(null);
  const [returnReason, setReturnReason] = useState("");

  const { data: orders, isLoading, error } = useQuery<Order[]>({
    queryKey: ["/api/orders"],
    enabled: !!user,
    queryFn: async () => {
      const res = await fetch(`${BASE_URL}/api/orders`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load orders");
      return res.json();
    },
  });

  // Fetch return status for a specific order (only when dialog opens)
  const { data: existingReturn } = useQuery({
    queryKey: ["return", returnOrderId],
    enabled: returnOrderId !== null,
    queryFn: async () => {
      const r = await fetch(`${BASE_URL}/api/orders/${returnOrderId}/return`, { credentials: "include" });
      if (!r.ok) return null;
      return r.json();
    },
  });

  const returnMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/orders/${returnOrderId}/return`, { reason: returnReason }),
    onSuccess: () => {
      toast({ title: "Return request submitted" });
      queryClient.invalidateQueries({ queryKey: ["return", returnOrderId] });
      setReturnReason("");
      setReturnOrderId(null);
    },
    onError: (e: any) => toast({ title: e.message || "Failed to submit", variant: "destructive" }),
  });

  if (!user) return <p className="text-center py-20">Please login to view orders.</p>;
  if (isLoading) return <p className="text-center py-20">Loading orders...</p>;
  if (error) return <p className="text-center py-20 text-red-600">Failed to load orders.</p>;

  if (!orders || orders.length === 0) return (
    <>
      <Header />
      <main className="container max-w-5xl mx-auto px-[5px] py-4 sm:px-8 sm:py-8 my-8 bg-white rounded shadow-md min-h-screen">
        <h1 className="text-2xl font-semibold mb-6">My Orders</h1>
        <p>No orders found.</p>
      </main>
      <Footer />
    </>
  );

  return (
    <>
      <Header />
      <main className="container max-w-5xl mx-auto px-[5px] py-4 sm:px-8 sm:py-8 my-8 bg-white rounded shadow-md min-h-screen">
        <h1 className="text-2xl font-semibold mb-6">My Orders</h1>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Order ID</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Total (BWP)</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.map((order) => (
              <TableRow key={order.id}>
                <TableCell>#{order.id}</TableCell>
                <TableCell>
                  <div>{order.firstName} {order.lastName}</div>
                  <small className="text-gray-500">{order.email}</small>
                </TableCell>
                <TableCell>{convertUsdToBwp(order.total)}</TableCell>
                <TableCell>
                  <Badge className={statusClass(order.status)}>{order.status.replace(/_/g, " ")}</Badge>
                </TableCell>
                <TableCell>{new Date(order.createdAt).toLocaleDateString()}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Link href={`/order-confirmation?orderId=${order.id}`} className="flex items-center gap-1 text-blue-600 hover:underline text-sm">
                      <Eye className="h-4 w-4" /><span>View</span>
                    </Link>
                    {order.status === "delivered" && (
                      <button onClick={() => { setReturnOrderId(order.id); setReturnReason(""); }}
                        className="flex items-center gap-1 text-amber-600 hover:underline text-sm">
                        <RotateCcw className="h-4 w-4" /><span>Return</span>
                      </button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </main>

      {/* Return request dialog */}
      <Dialog open={returnOrderId !== null} onOpenChange={(open) => !open && setReturnOrderId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Request a Return — Order #{returnOrderId}</DialogTitle></DialogHeader>
          {existingReturn ? (
            <div className="space-y-3">
              <p className="text-sm text-gray-600">You already submitted a return request for this order.</p>
              <div className="bg-gray-50 rounded p-3 text-sm">
                <p><span className="font-medium">Status:</span> <Badge className={statusClass(existingReturn.status)}>{existingReturn.status}</Badge></p>
                <p className="mt-1"><span className="font-medium">Reason:</span> {existingReturn.reason}</p>
                {existingReturn.adminNote && <p className="mt-1 text-blue-700"><span className="font-medium">Admin note:</span> {existingReturn.adminNote}</p>}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">Tell us why you'd like to return this order. We'll review your request within 2 business days.</p>
              <Textarea placeholder="Describe the issue (e.g. wrong item, damaged, changed mind)..." rows={4} value={returnReason} onChange={(e) => setReturnReason(e.target.value)} />
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setReturnOrderId(null)}>Cancel</Button>
                <Button disabled={!returnReason.trim() || returnMutation.isPending} onClick={() => returnMutation.mutate()}>
                  {returnMutation.isPending ? "Submitting…" : "Submit Return Request"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Footer />
    </>
  );
}
