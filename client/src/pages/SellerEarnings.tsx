import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { getQueryFn, createQueryKey, apiRequest } from "@/lib/queryClient";
import SellerLayout from "@/components/SellerLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { DollarSign, TrendingUp, Wallet, ArrowDownCircle } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ChartTooltip,
  ResponsiveContainer, Legend,
} from "recharts";

const USD_TO_BWP = 13.5;
const fmtBWP = (usd: string | number) => {
  const n = typeof usd === "string" ? parseFloat(usd) : usd;
  return `P ${(n * USD_TO_BWP).toLocaleString("en-BW", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

function StatCard({ label, value, sub, icon: Icon, color }: { label: string; value: string; sub?: string; icon: React.ElementType; color: string }) {
  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
            {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
          </div>
          <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${color}`}>
            <Icon className="h-5 w-5 text-white" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

const PAYOUT_BADGE: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  approved: "bg-blue-100 text-blue-700",
  paid: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
};

export default function SellerEarnings() {
  const { toast } = useToast();
  const [payoutAmount, setPayoutAmount] = useState("");
  const [payoutNote, setPayoutNote] = useState("");

  const { data: earnings, isLoading, refetch } = useQuery({
    queryKey: createQueryKey("/api/seller/earnings"),
    queryFn: getQueryFn({ on401: "returnNull" }),
  });

  const payoutMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/seller/payout-request", { amount: (parseFloat(payoutAmount) / USD_TO_BWP).toFixed(2), note: payoutNote }),
    onSuccess: () => {
      toast({ title: "Payout request submitted! Admin will review shortly." });
      setPayoutAmount(""); setPayoutNote(""); refetch();
    },
    onError: () => toast({ title: "Failed to submit payout request", variant: "destructive" }),
  });

  if (isLoading) return (
    <SellerLayout title="Earnings" >
      {() => <div className="text-center py-20 text-gray-400">Loading earnings…</div>}
    </SellerLayout>
  );

  const e = earnings as any;
  const gross = parseFloat(e?.grossRevenue ?? "0");
  const net = parseFloat(e?.netEarnings ?? "0");
  const commission = parseFloat(e?.commission ?? "0");
  const balance = parseFloat(e?.balance ?? "0");
  const commissionPct = e?.commissionPct ?? 10;

  return (
    <SellerLayout title="Earnings & Payouts">
      {() => (
        <div className="space-y-6">
          {/* Stat cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Gross Revenue" value={fmtBWP(gross)} sub="before commission" icon={DollarSign} color="bg-blue-500" />
            <StatCard label={`Commission (${commissionPct}%)`} value={fmtBWP(commission)} sub="Fountstream fee" icon={TrendingUp} color="bg-amber-500" />
            <StatCard label="Net Earnings" value={fmtBWP(net)} sub="after commission" icon={Wallet} color="bg-emerald-500" />
            <StatCard label="Available Balance" value={fmtBWP(balance)} sub="ready to withdraw" icon={ArrowDownCircle} color={balance > 0 ? "bg-violet-500" : "bg-gray-400"} />
          </div>

          {/* Revenue chart */}
          {e?.monthly?.length > 0 && (
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold text-gray-700">Revenue — Last 6 Months (BWP)</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={e.monthly.map((m: any) => ({ ...m, gross: parseFloat((m.revenue * USD_TO_BWP).toFixed(2)), net: parseFloat((m.net * USD_TO_BWP).toFixed(2)) }))} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} tickFormatter={(v) => `P${v}`} />
                    <ChartTooltip formatter={(v: number, name: string) => [`P ${v.toFixed(2)}`, name === "gross" ? "Gross" : "Net"]} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                    <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="gross" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Gross" />
                    <Bar dataKey="net" fill="#10b981" radius={[4, 4, 0, 0]} name="Net" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Request payout */}
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold text-gray-700">Request a Payout</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-gray-500">Available balance: <span className="font-semibold text-emerald-600">{fmtBWP(balance)}</span></p>
                <div>
                  <label className="text-xs font-medium text-gray-600">Amount (BWP)</label>
                  <Input type="number" className="mt-1" placeholder="e.g. 500" value={payoutAmount} onChange={(e) => setPayoutAmount(e.target.value)} max={balance * USD_TO_BWP} />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Note (optional)</label>
                  <Input className="mt-1" placeholder="Bank account / mobile money details…" value={payoutNote} onChange={(e) => setPayoutNote(e.target.value)} />
                </div>
                <Button className="w-full" disabled={!payoutAmount || parseFloat(payoutAmount) <= 0 || parseFloat(payoutAmount) > balance * USD_TO_BWP || payoutMutation.isPending} onClick={() => payoutMutation.mutate()}>
                  {payoutMutation.isPending ? "Submitting…" : "Request Payout"}
                </Button>
              </CardContent>
            </Card>

            {/* Payout history */}
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold text-gray-700">Payout History</CardTitle></CardHeader>
              <CardContent>
                {!e?.payouts?.length ? (
                  <p className="text-sm text-gray-400 text-center py-4">No payout requests yet</p>
                ) : (
                  <div className="space-y-2">
                    {e.payouts.map((p: any) => (
                      <div key={p.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                        <div>
                          <p className="text-sm font-semibold">{fmtBWP(p.amount)}</p>
                          <p className="text-xs text-gray-400">{new Date(p.createdAt).toLocaleDateString("en-BW")}</p>
                          {p.note && <p className="text-xs text-gray-500 mt-0.5">{p.note}</p>}
                        </div>
                        <Badge className={PAYOUT_BADGE[p.status] ?? "bg-gray-100 text-gray-600"}>{p.status}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Recent sales items */}
          {e?.recentItems?.length > 0 && (
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold text-gray-700">Recent Sales</CardTitle></CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b border-gray-100 text-xs text-gray-500"><th className="text-left pb-2">Product</th><th className="text-left pb-2">Customer</th><th className="text-right pb-2">Qty</th><th className="text-right pb-2">Gross (BWP)</th><th className="text-right pb-2">Net (BWP)</th></tr></thead>
                    <tbody>
                      {e.recentItems.map((i: any, idx: number) => {
                        const gross = parseFloat(i.product_price) * i.quantity * USD_TO_BWP;
                        const net = gross * (1 - commissionPct / 100);
                        return (
                          <tr key={idx} className="border-b border-gray-50 hover:bg-gray-50/50">
                            <td className="py-2 font-medium">{i.product_name}</td>
                            <td className="py-2 text-gray-500 text-xs">{i.customer_email}</td>
                            <td className="py-2 text-right">{i.quantity}</td>
                            <td className="py-2 text-right font-medium">P {gross.toFixed(2)}</td>
                            <td className="py-2 text-right text-emerald-600 font-semibold">P {net.toFixed(2)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </SellerLayout>
  );
}
