import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { MapPin, Truck } from "lucide-react";

const USD_TO_BWP = 13.5;

function formatBWP(usd: number) {
  return `P ${(usd * USD_TO_BWP).toLocaleString("en-BW", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function entityLabel(entityType: string) {
  switch (entityType) {
    case "livestock": return "Livestock";
    case "crop":      return "Crops";
    case "poultry":   return "Poultry";
    case "inventory": return "Farm Supplies";
    default:          return "Farm Product";
  }
}

function entityBadgeColor(entityType: string): "default" | "secondary" | "outline" | "destructive" {
  switch (entityType) {
    case "livestock": return "destructive";
    case "crop":      return "default";
    case "poultry":   return "secondary";
    case "inventory": return "outline";
    default:          return "outline";
  }
}

function LivestockDetails({ d }: { d: any }) {
  return (
    <div className="text-xs text-gray-600 space-y-1 mt-2">
      {d.species && <p><span className="font-medium">Species:</span> {d.species}</p>}
      {d.breed && <p><span className="font-medium">Breed:</span> {d.breed}</p>}
      {d.gender && <p><span className="font-medium">Gender:</span> {d.gender}</p>}
      {d.ageMonths != null && <p><span className="font-medium">Age:</span> {d.ageMonths} months</p>}
      {d.weightKg != null && <p><span className="font-medium">Weight:</span> {d.weightKg} kg</p>}
      {d.euStatus && (
        <Badge variant={d.euStatus === "EU" ? "default" : "outline"} className="text-xs">
          {d.euStatus}
        </Badge>
      )}
    </div>
  );
}

function CropDetails({ d }: { d: any }) {
  return (
    <div className="text-xs text-gray-600 space-y-1 mt-2">
      {d.cropType && <p><span className="font-medium">Crop:</span> {d.cropType}</p>}
      {d.variety && <p><span className="font-medium">Variety:</span> {d.variety}</p>}
      {d.qualityGrade && <p><span className="font-medium">Grade:</span> {d.qualityGrade}</p>}
      {d.harvestDate && (
        <p><span className="font-medium">Harvested:</span> {new Date(d.harvestDate).toLocaleDateString()}</p>
      )}
    </div>
  );
}

function PoultryDetails({ d }: { d: any }) {
  return (
    <div className="text-xs text-gray-600 space-y-1 mt-2">
      {d.poultryType && <p><span className="font-medium">Type:</span> {d.poultryType}</p>}
      {d.breed && <p><span className="font-medium">Breed:</span> {d.breed}</p>}
      {d.productType === "live_birds" && d.averageWeightKg != null && (
        <p><span className="font-medium">Avg Weight:</span> {d.averageWeightKg} kg</p>
      )}
      {d.productType === "eggs" && d.eggsPerTray != null && (
        <p><span className="font-medium">Eggs/Tray:</span> {d.eggsPerTray}</p>
      )}
    </div>
  );
}

function InventoryDetails({ d }: { d: any }) {
  return (
    <div className="text-xs text-gray-600 space-y-1 mt-2">
      {d.sku && <p><span className="font-medium">SKU:</span> {d.sku}</p>}
      {d.condition && <p><span className="font-medium">Condition:</span> {d.condition}</p>}
      {d.expiryDate && (
        <p><span className="font-medium">Expires:</span> {new Date(d.expiryDate).toLocaleDateString()}</p>
      )}
    </div>
  );
}

function EntityDetails({ entityType, entityDetails }: { entityType: string; entityDetails: any }) {
  if (!entityDetails) return null;
  switch (entityType) {
    case "livestock": return <LivestockDetails d={entityDetails} />;
    case "crop":      return <CropDetails d={entityDetails} />;
    case "poultry":   return <PoultryDetails d={entityDetails} />;
    case "inventory": return <InventoryDetails d={entityDetails} />;
    default:          return null;
  }
}

interface FarmProductCardProps {
  product: {
    id: number;
    name: string;
    price: string;
    images: string[];
    imageUrls?: string[];
    stock: number | null;
    entityType: string | null;
    entityDetails: any;
    farmName: string | null;
    farmDistrict: string | null;
    farmContact: string | null;
    unit: string | null;
    allowsDelivery: boolean | null;
    depositPercent: number | null;
  };
}

export default function FarmProductCard({ product }: FarmProductCardProps) {
  const {
    id, name, price, images, imageUrls, stock,
    entityType, entityDetails, farmName, farmDistrict,
    unit, allowsDelivery, depositPercent,
  } = product;

  const allImages = (imageUrls && imageUrls.length > 0) ? imageUrls : images;
  const mainImage = allImages[0];
  const priceNum = parseFloat(price);
  const depositAmt = depositPercent && depositPercent > 0
    ? formatBWP(priceNum * depositPercent / 100)
    : null;

  return (
    <Link href={`/farm-product/${id}`}>
      <Card className="group cursor-pointer hover:shadow-lg transition-shadow duration-200 overflow-hidden h-full">
        {/* Image */}
        <div className="relative aspect-[4/3] bg-gray-100 overflow-hidden">
          {mainImage ? (
            <img
              src={mainImage}
              alt={name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-green-50 text-green-400 text-sm font-medium">
              {entityLabel(entityType ?? "")}
            </div>
          )}

          {/* Entity type badge */}
          <div className="absolute top-2 left-2">
            <Badge variant={entityBadgeColor(entityType ?? "")} className="text-xs">
              {entityLabel(entityType ?? "")}
            </Badge>
          </div>

          {/* Stock badge */}
          {(stock ?? 0) <= 0 && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
              <span className="text-white font-semibold text-sm">Out of Stock</span>
            </div>
          )}
        </div>

        <CardContent className="p-4 space-y-3">
          {/* Name */}
          <h3 className="font-semibold text-gray-900 line-clamp-2 group-hover:text-primary transition-colors">
            {name}
          </h3>

          {/* Entity-specific details */}
          <EntityDetails entityType={entityType ?? ""} entityDetails={entityDetails} />

          {/* Farm info */}
          {(farmName || farmDistrict) && (
            <div className="text-xs text-gray-500 space-y-0.5">
              {farmName && <p className="font-medium text-gray-700">{farmName}</p>}
              {farmDistrict && (
                <p className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" /> {farmDistrict}
                </p>
              )}
            </div>
          )}

          {/* Tags */}
          <div className="flex flex-wrap gap-1">
            {allowsDelivery && (
              <span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
                <Truck className="h-3 w-3" /> Delivery available
              </span>
            )}
            {unit && (
              <span className="inline-flex items-center gap-1 text-xs text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full">
                {unit}
              </span>
            )}
          </div>

          {/* Price */}
          <div className="pt-1">
            <p className="text-lg font-bold text-primary">{formatBWP(priceNum)}</p>
            {depositAmt && (
              <p className="text-xs text-amber-700 font-medium">
                Reserve with deposit: {depositAmt}
              </p>
            )}
            {(stock ?? 0) > 0 && (
              <p className="text-xs text-gray-500">{stock} available</p>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
