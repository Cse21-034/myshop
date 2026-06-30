import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { BASE_URL } from "@/lib/queryClient";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Eye } from "lucide-react";
import { Link } from "wouter";

type Order = {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  total: string; // stored in USD as string
  status: string;
  createdAt: string;
};

const USD_TO_BWP = 13.5; // Update this based on current exchange rate

function convertUsdToBwp(usdAmount: string | number): string {
  const usd = typeof usdAmount === "string" ? parseFloat(usdAmount) : usdAmount;
  if (isNaN(usd)) return "P 0.00";
  const bwp = usd * USD_TO_BWP;
  return `P ${bwp.toLocaleString("en-BW", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function Orders() {
  const { user } = useAuth();

  const {
    data: orders,
    isLoading,
    error,
  } = useQuery<Order[], Error>({
    queryKey: ["/api/orders"],
    enabled: !!user,
    queryFn: async () => {
      const res = await fetch(`${BASE_URL}/api/orders`, { credentials: "include" });
      if (!res.ok) {
        throw new Error("Failed to load orders");
      }
      return res.json();
    },
  });

  if (!user) return <p className="text-center py-20">Please login to view orders.</p>;
  if (isLoading) return <p className="text-center py-20">Loading orders...</p>;
  if (error) return <p className="text-center py-20 text-red-600">Failed to load orders: {error.message}</p>;

  if (!orders || orders.length === 0)
    return (
      <>
        <Header />
        <main className="container max-w-5xl mx-auto p-4 sm:p-8 my-8 bg-white rounded shadow-md min-h-screen">
          <h1 className="text-2xl font-semibold mb-6">My Orders</h1>
          <p>No orders found.</p>
        </main>
        <Footer />
      </>
    );

  return (
    <>
      <Header />
      <main className="container max-w-5xl mx-auto p-4 sm:p-8 my-8 bg-white rounded shadow-md min-h-screen">
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
                  <div>
                    {order.firstName} {order.lastName}
                  </div>
                  <small className="text-gray-500">{order.email}</small>
                </TableCell>
                <TableCell>{convertUsdToBwp(order.total)}</TableCell>
                <TableCell>
                  <Badge variant={order.status === "pending" ? "secondary" : "outline"}>
                    {order.status}
                  </Badge>
                </TableCell>
                <TableCell>{new Date(order.createdAt).toLocaleDateString()}</TableCell>
                <TableCell>
                  <Link href={`/order-confirmation?orderId=${order.id}`} className="flex items-center space-x-1 text-blue-600 hover:underline">
                    <Eye className="h-5 w-5" />
                    <span>View</span>
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </main>
      <Footer />
    </>
  );
}
