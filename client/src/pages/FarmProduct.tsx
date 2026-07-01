import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useCart } from "@/context/CartContext";
import {
  MapPin, Phone, Truck, ShieldCheck, ChevronLeft,
  Package, AlertCircle, CheckCircle2,
} from "lucide-react";

const USD_TO_BWP = 13.5;

function formatBWP(usd: number) {
  return `P ${(usd * USD_TO_BWP).toLocaleString("en-BW", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ─── Entity detail sections ───────────────────────────────────────────────────

function LivestockSection({ d }: { d: any }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {[
        ["Species",   d.species],
        ["Breed",     d.breed],
        ["Gender",    d.gender],
        ["Age",       d.ageMonths != null ? `${d.ageMonths} months` : null],
        ["Weight",    d.weightKg != null ? `${d.weightKg} kg` : null],
        ["EU Status", d.euStatus],
        ["Health",    d.healthStatus],
        ["Last Check",d.lastHealthCheck ? new Date(d.lastHealthCheck).toLocaleDateString() : null],
        ["Vaccinations", d.vaccinationsUpToDate != null ? (d.vaccinationsUpToDate ? "Up to date" : "Not up to date") : null],
        ["Holding No.", d.holdingNumber],
        ["Vet Zone",  d.veterinaryZone],
        ["Tag No.",   d.tagNumber],
      ].filter(([, v]) => v != null).map(([label, value]) => (
        <div key={label as string} className="bg-gray-50 rounded-lg p-3">
          <p className="text-xs text-gray-500">{label}</p>
          <p className="text-sm font-medium text-gray-900">{value}</p>
        </div>
      ))}
    </div>
  );
}

function CropSection({ d }: { d: any }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {[
        ["Crop Type",     d.cropType],
        ["Variety",       d.variety],
        ["Quality Grade", d.qualityGrade],
        ["Harvested",     d.harvestDate ? new Date(d.harvestDate).toLocaleDateString() : null],
        ["Unit",          d.unitDescription],
        ["Field District",d.fieldDistrict],
      ].filter(([, v]) => v != null).map(([label, value]) => (
        <div key={label as string} className="bg-gray-50 rounded-lg p-3">
          <p className="text-xs text-gray-500">{label}</p>
          <p className="text-sm font-medium text-gray-900">{value}</p>
        </div>
      ))}
    </div>
  );
}

function PoultrySection({ d }: { d: any }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {[
        ["Type",        d.poultryType],
        ["Breed",       d.breed],
        ["Product",     d.productType === "live_birds" ? "Live Birds" : d.productType === "eggs" ? "Eggs" : d.productType],
        ["Avg Weight",  d.averageWeightKg != null ? `${d.averageWeightKg} kg` : null],
        ["Eggs/Tray",   d.eggsPerTray != null ? String(d.eggsPerTray) : null],
        ["Batch Code",  d.batchCode],
      ].filter(([, v]) => v != null).map(([label, value]) => (
        <div key={label as string} className="bg-gray-50 rounded-lg p-3">
          <p className="text-xs text-gray-500">{label}</p>
          <p className="text-sm font-medium text-gray-900">{value}</p>
        </div>
      ))}
    </div>
  );
}

function InventorySection({ d }: { d: any }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {[
        ["SKU",             d.sku],
        ["Condition",       d.condition],
        ["Expiry Date",     d.expiryDate ? new Date(d.expiryDate).toLocaleDateString() : null],
        ["Storage Location",d.storageLocation],
      ].filter(([, v]) => v != null).map(([label, value]) => (
        <div key={label as string} className="bg-gray-50 rounded-lg p-3">
          <p className="text-xs text-gray-500">{label}</p>
          <p className="text-sm font-medium text-gray-900">{value}</p>
        </div>
      ))}
    </div>
  );
}

function EntitySection({ entityType, entityDetails }: { entityType: string; entityDetails: any }) {
  if (!entityDetails) return null;
  switch (entityType) {
    case "livestock": return <LivestockSection d={entityDetails} />;
    case "crop":      return <CropSection d={entityDetails} />;
    case "poultry":   return <PoultrySection d={entityDetails} />;
    case "inventory": return <InventorySection d={entityDetails} />;
    default:          return null;
  }
}

function sectionTitle(entityType: string) {
  switch (entityType) {
    case "livestock": return "Animal Details";
    case "crop":      return "Crop Details";
    case "poultry":   return "Poultry Details";
    case "inventory": return "Item Details";
    default:          return "Product Details";
  }
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function FarmProduct() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { addToCart } = useCart();
  const [activeImage, setActiveImage] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [fulfillmentType, setFulfillmentType] = useState<"pickup" | "delivery">("pickup");

  const { data: product, isLoading, error } = useQuery<any>({
    queryKey: [`/api/products/${id}`],
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <>
        <Header />
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
        </div>
        <Footer />
      </>
    );
  }

  if (error || !product) {
    return (
      <>
        <Header />
        <div className="min-h-screen flex items-center justify-center text-gray-500">
          <div className="text-center space-y-3">
            <AlertCircle className="h-10 w-10 mx-auto text-red-400" />
            <p>Product not found.</p>
            <Button variant="outline" onClick={() => navigate("/farm-market")}>Back to Farm Market</Button>
          </div>
        </div>
        <Footer />
      </>
    );
  }

  const allImages = (product.imageUrls && product.imageUrls.length > 0)
    ? product.imageUrls
    : (product.images || []);

  const priceNum = parseFloat(product.price);
  const depositPercent: number = product.depositPercent ?? 0;
  const depositAmt = depositPercent > 0 ? priceNum * depositPercent / 100 : 0;
  const remaining = priceNum - depositAmt;
  const isReservation = depositPercent > 0;
  const outOfStock = (product.stock ?? 0) <= 0;

  function handleAddToCart() {
    if (outOfStock) return;
    addToCart(product.id, quantity);
    toast({ title: isReservation ? "Reserved!" : "Added to cart", description: product.name });
  }

  function handleBuyNow() {
    if (outOfStock) return;
    addToCart(product.id, quantity);
    navigate("/checkout");
  }

  return (
    <>
      <Header />
      <main className="min-h-screen bg-gray-50 py-8">
        <div className="container mx-auto max-w-5xl px-4">
          {/* Breadcrumb */}
          <button
            onClick={() => navigate("/farm-market")}
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-primary mb-6"
          >
            <ChevronLeft className="h-4 w-4" /> Back to Farm Market
          </button>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* ── Images ── */}
            <div className="space-y-3">
              <div className="aspect-[4/3] bg-white rounded-xl overflow-hidden border group cursor-zoom-in">
                {allImages.length > 0 ? (
                  <img
                    src={allImages[activeImage]}
                    alt={product.name}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-8xl">
                    {product.entityType === "livestock" ? "🐄"
                      : product.entityType === "crop" ? "🌾"
                      : product.entityType === "poultry" ? "🐔"
                      : "📦"}
                  </div>
                )}
              </div>
              {allImages.length > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {allImages.map((img: string, i: number) => (
                    <button
                      key={i}
                      onClick={() => setActiveImage(i)}
                      className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-colors ${
                        i === activeImage ? "border-primary" : "border-transparent"
                      }`}
                    >
                      <img src={img} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* ── Info ── */}
            <div className="space-y-5">
              {/* Name & badges */}
              <div>
                <div className="flex flex-wrap gap-2 mb-2">
                  <Badge variant="outline" className="capitalize">{product.entityType}</Badge>
                  {product.entityDetails?.euStatus === "EU" && (
                    <Badge className="bg-blue-700 text-white">EU Certified</Badge>
                  )}
                  {outOfStock && <Badge variant="destructive">Out of Stock</Badge>}
                </div>
                <h1 className="text-2xl font-bold text-gray-900">{product.name}</h1>
                {product.description && (
                  <p className="text-gray-600 mt-2 text-sm">{product.description}</p>
                )}
              </div>

              {/* Price */}
              <div className="bg-green-50 rounded-xl p-4 space-y-1">
                <p className="text-2xl font-bold text-green-800">
                  {formatBWP(priceNum)} <span className="text-sm font-normal text-gray-500">/ {product.unit ?? "per piece"}</span>
                </p>
                {isReservation && (
                  <div className="text-sm space-y-0.5">
                    <p className="text-amber-700 font-medium">
                      Reserve with {depositPercent}% deposit: {formatBWP(depositAmt)}
                    </p>
                    <p className="text-gray-500">Remaining on collection: {formatBWP(remaining)}</p>
                  </div>
                )}
                {(product.stock ?? 0) > 0 && (
                  <p className="text-xs text-gray-500">{product.stock} available</p>
                )}
              </div>

              {/* Farm info */}
              {(product.farmName || product.farmDistrict || product.farmContact) && (
                <Card>
                  <CardContent className="p-4 space-y-2">
                    <p className="font-semibold text-sm text-gray-700">Farm Information</p>
                    {product.farmName && <p className="text-sm font-medium">{product.farmName}</p>}
                    {product.farmDistrict && (
                      <p className="text-sm text-gray-600 flex items-center gap-1">
                        <MapPin className="h-4 w-4 text-gray-400" /> {product.farmDistrict}
                      </p>
                    )}
                    {product.farmContact && (
                      <a
                        href={`tel:${product.farmContact}`}
                        className="text-sm text-primary flex items-center gap-1 hover:underline"
                      >
                        <Phone className="h-4 w-4" /> {product.farmContact}
                      </a>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Fulfillment */}
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-700">Collection Method</p>
                <RadioGroup
                  value={fulfillmentType}
                  onValueChange={(v) => setFulfillmentType(v as "pickup" | "delivery")}
                  className="flex gap-4"
                >
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="pickup" id="pickup" />
                    <Label htmlFor="pickup" className="text-sm">Pickup from farm</Label>
                  </div>
                  {product.allowsDelivery && (
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="delivery" id="delivery" />
                      <Label htmlFor="delivery" className="text-sm flex items-center gap-1">
                        <Truck className="h-3.5 w-3.5" /> Delivery
                      </Label>
                    </div>
                  )}
                </RadioGroup>
                {!product.allowsDelivery && (
                  <p className="text-xs text-gray-400 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" /> This farm only offers pickup
                  </p>
                )}
              </div>

              {/* Quantity */}
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-700">Quantity</p>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setQuantity(q => Math.max(1, q - 1))}
                    className="w-8 h-8 rounded-full border flex items-center justify-center text-lg font-medium hover:bg-gray-100"
                  >−</button>
                  <span className="w-8 text-center font-semibold">{quantity}</span>
                  <button
                    onClick={() => setQuantity(q => Math.min(product.stock ?? 99, q + 1))}
                    className="w-8 h-8 rounded-full border flex items-center justify-center text-lg font-medium hover:bg-gray-100"
                  >+</button>
                  <span className="text-xs text-gray-400">{product.unit ?? "per piece"}</span>
                </div>
              </div>

              {/* Actions */}
              {isReservation ? (
                <div className="space-y-2">
                  <Button
                    className="w-full bg-amber-600 hover:bg-amber-700"
                    onClick={handleBuyNow}
                    disabled={outOfStock}
                  >
                    Reserve Now — Pay {formatBWP(depositAmt * quantity)} deposit
                  </Button>
                  <p className="text-xs text-gray-500 text-center">
                    Full amount {formatBWP(priceNum * quantity)} — pay remainder on collection
                  </p>
                </div>
              ) : (
                <div className="flex gap-3">
                  <Button variant="outline" className="flex-1" onClick={handleAddToCart} disabled={outOfStock}>
                    Add to Cart
                  </Button>
                  <Button className="flex-1" onClick={handleBuyNow} disabled={outOfStock}>
                    Buy Now
                  </Button>
                </div>
              )}

              {/* Reservation info */}
              {isReservation && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800 space-y-1">
                  <p className="font-semibold flex items-center gap-1"><ShieldCheck className="h-3.5 w-3.5" /> How reservation works</p>
                  <ol className="list-decimal list-inside space-y-0.5 text-amber-700">
                    <li>Pay {depositPercent}% deposit to reserve</li>
                    <li>Farm confirms availability within 24 hours</li>
                    <li>Arrange pickup{product.allowsDelivery ? " or delivery" : ""} with the farm</li>
                    <li>Pay remaining balance on collection</li>
                  </ol>
                </div>
              )}
            </div>
          </div>

          {/* ── Entity Details Section ── */}
          {product.entityDetails && (
            <div className="mt-10">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                {sectionTitle(product.entityType)}
              </h2>
              <EntitySection entityType={product.entityType} entityDetails={product.entityDetails} />
            </div>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
