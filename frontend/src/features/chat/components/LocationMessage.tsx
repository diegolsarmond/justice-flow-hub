import type { LocationPayload } from "../types";
import { MapPin } from "lucide-react";

interface LocationMessageProps {
  location: LocationPayload;
}

export const LocationMessage = ({ location }: LocationMessageProps) => {
  const hasCoordinates =
    typeof location.latitude === "number" && typeof location.longitude === "number";

  return (
    <div className="rounded-2xl border border-white/30 bg-white/10 px-4 py-3 text-sm">
      <div className="mb-2 flex items-center gap-2 font-semibold">
        <MapPin className="h-4 w-4" />
        <span>Localização</span>
      </div>
      {location.name && <p className="text-xs opacity-80">{location.name}</p>}
      {location.address && <p className="text-xs opacity-70">{location.address}</p>}
      {hasCoordinates && (
        <p className="text-xs opacity-70">
          {location.latitude.toFixed(5)}, {location.longitude.toFixed(5)}
        </p>
      )}
    </div>
  );
};
