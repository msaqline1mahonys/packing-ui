"use client";

import { cn } from "@/lib/utils";
import { qtyColor } from "./form-primitives";

export default function StockLocationChips({
  locationStock,
  loading,
  selectedLocationId,
  onSelectLocation,
  emptyMessage = "No stock on hand at any location for this selection.",
}) {
  if (loading) {
    return <p className="text-[10px] text-slate-400">Loading stock by location…</p>;
  }

  if (!locationStock.length) {
    return <p className="text-[10px] text-slate-400">{emptyMessage}</p>;
  }

  return (
    <div className="space-y-1">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Stock by location</p>
      <div className="flex flex-wrap gap-1">
        {locationStock.map((loc) => {
          const selected = String(loc.locationId) === String(selectedLocationId ?? "");
          return (
            <button
              key={String(loc.locationId)}
              type="button"
              onClick={() => onSelectLocation?.(loc)}
              className={cn(
                "rounded border px-1.5 py-0.5 text-[10px] font-medium transition-colors",
                selected
                  ? "border-brand/40 bg-brand/10 text-brand-ink"
                  : "border-slate-200 bg-white text-slate-600 hover:border-brand/30 hover:bg-brand/5"
              )}
            >
              {loc.locationName}:{" "}
              <span className={qtyColor(Number(loc.quantity))}>
                {Number(loc.quantity).toLocaleString(undefined, { maximumFractionDigits: 2 })} t
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
