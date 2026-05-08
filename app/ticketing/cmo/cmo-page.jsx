"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Grid } from "@/components/clutch-table";
import { Button } from "@/components/ui/button";
import { loadCmoRows, saveCmoRows } from "@/lib/cmo-store";
import { cn } from "@/lib/utils";

const DIRECTION_OPTIONS = [
  { key: "all", label: "All CMOs" },
  { key: "incoming", label: "Incoming" },
  { key: "outgoing", label: "Outgoing" },
];

function statusBadgeClass(status) {
  switch ((status || "").toLowerCase()) {
    case "completed":
      return "bg-emerald-50 text-emerald-900 ring-1 ring-emerald-200";
    case "in progress":
      return "bg-amber-50 text-amber-900 ring-1 ring-amber-200";
    case "cancelled":
      return "bg-slate-100 text-slate-700 ring-1 ring-slate-200";
    default:
      return "bg-brand/12 text-brand-ink ring-1 ring-brand/25";
  }
}

export default function CmoPage() {
  const router = useRouter();
  const [rows, setRows] = useState(() => loadCmoRows());
  const [activeDirection, setActiveDirection] = useState("all");
  const [selectedId, setSelectedId] = useState(null);

  useEffect(() => {
    setRows(loadCmoRows());
  }, []);

  useEffect(() => {
    saveCmoRows(rows);
  }, [rows]);

  const filtered = useMemo(
    () => rows.filter((row) => activeDirection === "all" || row.direction === activeDirection),
    [rows, activeDirection]
  );

  useEffect(() => {
    if (selectedId != null && !filtered.some((row) => row.id === selectedId)) setSelectedId(null);
  }, [filtered, selectedId]);

  const selected = useMemo(() => filtered.find((row) => row.id === selectedId) || null, [filtered, selectedId]);

  const columns = useMemo(
    () => [
      { key: "cmoReference", header: "CMO Ref", type: "text", sortable: true, filterable: true, resizable: true },
      { key: "id", header: "ID", type: "number", sortable: true, filterable: true, resizable: true },
      { key: "customer", header: "Customer", type: "text", sortable: true, filterable: true, resizable: true },
      { key: "commodityType", header: "Commodity Type", type: "text", sortable: true, filterable: true, resizable: true },
      { key: "commodity", header: "Commodity", type: "text", sortable: true, filterable: true, resizable: true },
      {
        key: "status",
        header: "Status",
        type: "text",
        sortable: true,
        filterable: true,
        resizable: true,
        renderCell: ({ value }) => (
          <span className={cn("inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize", statusBadgeClass(value))}>
            {value || "—"}
          </span>
        ),
      },
      { key: "bookings", header: "Bookings", type: "number", sortable: true, filterable: true, resizable: true },
    ],
    []
  );

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs text-slate-500">Operations / CMO Management</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 md:text-[1.65rem]">CMO Management</h1>
        <p className="mt-1 text-xs text-slate-500">Manage CMO records and direction-specific workflows.</p>
      </div>

      <section className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Direction filters</p>
          <div className="flex flex-1 flex-wrap items-center gap-2">
            {DIRECTION_OPTIONS.map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => setActiveDirection(option.key)}
                className={cn(
                  "inline-flex h-7 items-center rounded-md border px-2.5 text-[11px] font-medium transition-colors",
                  activeDirection === option.key
                    ? "border-brand/30 bg-brand/15 text-brand-ink shadow-sm"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-800"
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(240px,320px)] xl:items-start">
        <div className="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-sm">
          <Grid
            columns={columns}
            rows={filtered}
            getRowId={(row) => row.id}
            theme="light"
            density="standard"
            fileName="CMO Management"
            persistKey="ticketing-cmo-grid"
            visibleRows={14}
            enableSelection={false}
            onRowClick={(row) => setSelectedId(row.id)}
            getRowClassName={({ row }) => (row.id === selectedId ? "clutch-row-selected" : undefined)}
            getRowStyle={({ row }) => (row.id === selectedId ? { backgroundColor: "#dbeafe" } : undefined)}
            emptyMessage="No CMOs found."
            toolbarActions={
              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" size="sm" onClick={() => router.push("/ticketing/cmo/new")} className="h-7 px-2.5 text-[11px]">
                  + New CMO
                </Button>
                <Button type="button" size="sm" variant="secondary" disabled={!selected} className="h-7 px-2.5 text-[11px]">
                  Edit
                </Button>
                <Button type="button" size="sm" variant="destructive" disabled={!selected} className="h-7 px-2.5 text-[11px]">
                  Delete
                </Button>
                <span className="ms-auto text-[11px] text-slate-500">CMO queue</span>
              </div>
            }
          />
        </div>

        <aside className="rounded-xl border border-slate-200/90 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-3 py-3">
            <h2 className="text-sm font-semibold text-slate-900">CMO Details</h2>
          </div>
          {selected ? (
            <div className="space-y-3 p-3 text-xs">
              <DetailRow label="CMO Ref" value={selected.cmoReference} />
              <DetailRow label="Direction" value={selected.direction} />
              <DetailRow label="Customer" value={selected.customer} />
              <DetailRow label="Commodity Type" value={selected.commodityType} />
              <DetailRow label="Commodity" value={selected.commodity} />
              <DetailRow label="Status" value={selected.status} />
              <DetailRow label="Estimated (T)" value={selected.estimatedAmount} />
              <DetailRow label="Actual Delivered (T)" value={selected.actualAmountDelivered} />
              <DetailRow label="Additional References" value={selected.additionalReferences?.join(", ") || "—"} />
              <DetailRow label="Attached Files" value={selected.attachments?.join(", ") || "—"} />
              <DetailRow label="Note" value={selected.note || "—"} />
            </div>
          ) : (
            <div className="p-6 text-center text-xs text-slate-400">Select a CMO to view details</div>
          )}
        </aside>
      </div>
    </div>
  );
}

function DetailRow({ label, value }) {
  return (
    <div className="space-y-0.5">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="rounded border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] text-slate-700">{value || "—"}</div>
    </div>
  );
}
