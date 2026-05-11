"use client";

import { useMemo, useState } from "react";

import { Grid } from "@/components/clutch-table";
import { cn } from "@/lib/utils";

const PACKS_REQUIRING_FUMIGATION = [
  {
    id: "PACK-24117",
    scheduleDate: "2026-05-12",
    destination: "Auckland",
    packhouse: "Yard 2",
    customer: "Pacific Feeds",
    commodity: "Canola meal",
    containerCount: 6,
    fumigant: "Phosphine",
    exposureTime: "24h",
    etd: "2026-05-15 23:00",
    cutoff: "2026-05-13 16:00",
    status: "Pending fumigation",
  },
  {
    id: "PACK-24125",
    scheduleDate: "2026-05-12",
    destination: "Yokohama",
    packhouse: "Yard 1",
    customer: "Nippon Grain",
    commodity: "Feed barley",
    containerCount: 4,
    fumigant: "Methyl Bromide",
    exposureTime: "16h",
    etd: "2026-05-14 08:30",
    cutoff: "2026-05-13 10:00",
    status: "Pending fumigation",
  },
  {
    id: "PACK-24131",
    scheduleDate: "2026-05-13",
    destination: "Manila",
    packhouse: "Yard 3",
    customer: "Luzon Mills",
    commodity: "Wheat flour",
    containerCount: 9,
    fumigant: "Sulfuryl Fluoride",
    exposureTime: "20h",
    etd: "2026-05-16 05:45",
    cutoff: "2026-05-14 18:00",
    status: "Pending fumigation",
  },
];

export default function FumigationClient() {
  const [selectedPackId, setSelectedPackId] = useState(PACKS_REQUIRING_FUMIGATION[0]?.id ?? null);
  const selectedPack = PACKS_REQUIRING_FUMIGATION.find((pack) => pack.id === selectedPackId) ?? null;
  const gridColumns = useMemo(
    () => [
      { key: "id", header: "Pack #", type: "text", sortable: true, filterable: true, resizable: true },
      { key: "scheduleDate", header: "Schedule", type: "date", sortable: true, filterable: true, resizable: true },
      { key: "destination", header: "Destination", type: "text", sortable: true, filterable: true, resizable: true },
      { key: "commodity", header: "Commodity", type: "text", sortable: true, filterable: true, resizable: true },
      { key: "status", header: "Status", type: "text", sortable: true, filterable: true, resizable: true },
    ],
    []
  );

  return (
    <div className="space-y-5">
      <p className="max-w-2xl text-sm text-slate-600">
        Overview of packing schedule rows that require fumigation. Select a pack to view
        fumigant, ETD, cutoff, and key shipment details.
      </p>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-start">
        <div className="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-sm">
          <Grid
            columns={gridColumns}
            rows={PACKS_REQUIRING_FUMIGATION}
            getRowId={(row) => row.id}
            theme="light"
            density="standard"
            fileName="Packs Requiring Fumigation"
            visibleRows={12}
            onRowClick={(row) => setSelectedPackId(row.id)}
            getRowClassName={({ row }) => (row.id === selectedPackId ? "clutch-row-selected" : undefined)}
            getRowStyle={({ row }) => (row.id === selectedPackId ? { backgroundColor: "#dbeafe" } : undefined)}
          />
        </div>

        <aside className="rounded-xl border border-slate-200/90 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">Pack Details</h2>
          {!selectedPack ? (
            <p className="mt-4 text-sm text-slate-500">Select a pack to view details.</p>
          ) : (
            <dl className="mt-4 space-y-3 text-sm">
              <DetailItem label="Pack #" value={selectedPack.id} highlight />
              <DetailItem label="Fumigant" value={selectedPack.fumigant} />
              <DetailItem label="Containers" value={String(selectedPack.containerCount)} />
              <DetailItem label="Exposure Time" value={selectedPack.exposureTime} />
              <DetailItem label="ETD" value={selectedPack.etd} />
              <DetailItem label="Cutoff" value={selectedPack.cutoff} />
              <DetailItem label="Customer" value={selectedPack.customer} />
              <DetailItem label="Packhouse" value={selectedPack.packhouse} />
              <DetailItem label="Destination" value={selectedPack.destination} />
            </dl>
          )}
        </aside>
      </div>
    </div>
  );
}

function DetailItem({ label, value, highlight = false }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className={cn("mt-0.5 text-slate-800", highlight && "font-semibold text-brand")}>{value || "—"}</dd>
    </div>
  );
}
