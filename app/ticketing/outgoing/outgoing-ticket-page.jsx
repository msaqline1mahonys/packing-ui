"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Grid } from "@/components/clutch-table";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const inputClass =
  "h-7 rounded-md border border-slate-200 bg-white px-2 text-[11px] text-slate-800 outline-none ring-brand/15 focus:border-brand/35 focus:ring-2";

const STATUS_OPTIONS = [
  { key: "booked", label: "Booked" },
  { key: "processing", label: "Processing" },
  { key: "completed", label: "Completed" },
  { key: "cancelled", label: "Cancelled" },
];

const OUT_ROWS = [
  {
    id: 8821,
    customerCmo: "Riverina Co-op / CMO-0138",
    commodityGrade: "Canola · NON-GM",
    truck: "MHY-227",
    status: "booked",
    netT: null,
    date: "2026-05-01",
    notes: "Loader 2 assigned.",
  },
  {
    id: 8814,
    customerCmo: "GrainCorp Trading / CMO-0135",
    commodityGrade: "Feed barley · F1",
    truck: "MHY-104",
    status: "processing",
    netT: 38.2,
    date: "2026-05-01",
    notes: "Seal check complete.",
  },
  {
    id: 8802,
    customerCmo: "Pacific Charter / CMO-0128",
    commodityGrade: "Wheat · ASW1",
    truck: "MHY-088",
    status: "completed",
    netT: 95.0,
    date: "2026-04-29",
    notes: "Dispatched 14:10.",
  },
];

function statusBadgeClass(status) {
  switch (status) {
    case "booked":
      return "bg-brand/12 text-brand-ink ring-1 ring-brand/25";
    case "processing":
      return "bg-amber-50 text-amber-900 ring-1 ring-amber-200";
    case "completed":
      return "bg-emerald-50 text-emerald-900 ring-1 ring-emerald-200";
    case "cancelled":
      return "bg-slate-100 text-slate-700 ring-1 ring-slate-200";
    default:
      return "bg-slate-50 text-slate-700 ring-1 ring-slate-200";
  }
}

function formatNet(v) {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  return Number(v).toFixed(2);
}

export default function OutgoingTicketPage() {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState(() => new Set(STATUS_OPTIONS.map((s) => s.key)));
  const [searchByDate, setSearchByDate] = useState(false);
  const [filterDate, setFilterDate] = useState("");
  const [selectedId, setSelectedId] = useState(null);

  const toggleStatus = (key) => {
    setStatusFilter((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const filteredRows = useMemo(() => {
    return OUT_ROWS.filter((row) => {
      if (statusFilter.size === 0) return false;
      if (!statusFilter.has(row.status)) return false;
      if (searchByDate && filterDate && row.date !== filterDate) return false;
      return true;
    });
  }, [statusFilter, searchByDate, filterDate]);

  useEffect(() => {
    if (selectedId != null && !filteredRows.some((r) => r.id === selectedId)) {
      setSelectedId(null);
    }
  }, [filteredRows, selectedId]);

  const selected = selectedId != null ? filteredRows.find((r) => r.id === selectedId) ?? null : null;

  const gridColumns = useMemo(
    () => [
      {
        key: "id",
        header: "ID",
        type: "number",
        align: "left",
        sortable: true,
        filterable: true,
        resizable: true,
      },
      { key: "customerCmo", header: "Customer / CMO", type: "text", sortable: true, filterable: true, resizable: true },
      { key: "commodityGrade", header: "Commodity & grade", type: "text", sortable: true, filterable: true, resizable: true },
      { key: "truck", header: "Truck", type: "text", sortable: true, filterable: true, resizable: true },
      {
        key: "status",
        header: "Status",
        type: "text",
        sortable: true,
        filterable: true,
        resizable: true,
        renderCell: ({ value }) => (
          <span className={cn("inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize", statusBadgeClass(value))}>
            {value ?? ""}
          </span>
        ),
      },
      { key: "netT", header: "Net (T)", type: "number", sortable: true, filterable: true, resizable: true, format: (v) => formatNet(v) },
    ],
    []
  );

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs text-slate-500">Operations / Outgoing</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 md:text-[1.65rem]">Outgoing Tickets</h1>
        <p className="mt-1 text-xs text-slate-500">Review and manage outgoing dispatch tickets.</p>
      </div>

      <section className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Status filters</p>
          <div className="flex flex-1 flex-wrap items-center gap-2">
            {STATUS_OPTIONS.map(({ key, label }) => {
              const on = statusFilter.has(key);
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => toggleStatus(key)}
                  className={cn(
                    "inline-flex h-7 items-center rounded-md border px-2.5 text-[11px] font-medium transition-colors",
                    on
                      ? "border-brand/30 bg-brand/15 text-brand-ink shadow-sm"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-800"
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>
          <div className="ms-auto flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 p-1">
              <label className="cursor-pointer">
                <input type="radio" name="date-filter-outgoing" checked={!searchByDate} onChange={() => setSearchByDate(false)} className="sr-only" />
                <span className={cn("inline-flex h-5 items-center rounded px-2 text-[11px] font-medium transition-colors", !searchByDate ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200" : "text-slate-500 hover:text-slate-700")}>
                  All dates
                </span>
              </label>
              <label className="cursor-pointer">
                <input type="radio" name="date-filter-outgoing" checked={searchByDate} onChange={() => setSearchByDate(true)} className="sr-only" />
                <span className={cn("inline-flex h-5 items-center rounded px-2 text-[11px] font-medium transition-colors", searchByDate ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200" : "text-slate-500 hover:text-slate-700")}>
                  By date
                </span>
              </label>
            </div>
            {searchByDate ? <input className={`${inputClass} w-[140px]`} type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} /> : null}
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(240px,320px)] xl:items-start">
        <div className="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-sm">
          <Grid
            columns={gridColumns}
            rows={filteredRows}
            getRowId={(row) => row.id}
            theme="light"
            density="standard"
            fileName="Outgoing Tickets"
            persistKey="ticket-queue-outgoing"
            visibleRows={14}
            enableSelection={false}
            onRowClick={(row) => setSelectedId(row.id)}
            getRowClassName={({ row }) => (row.id === selectedId ? "clutch-row-selected" : undefined)}
            getRowStyle={({ row }) => (row.id === selectedId ? { backgroundColor: "#dbeafe" } : undefined)}
            emptyMessage="No tickets match the current filters."
            toolbarActions={
              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" size="sm" onClick={() => router.push("/ticketing/outgoing/new")} className="h-7 px-2.5 text-[11px]">
                  + Create
                </Button>
                <Button type="button" size="sm" variant="secondary" disabled={!selected} className="h-7 px-2.5 text-[11px]" onClick={() => selected && router.push(`/ticketing/outgoing/${selected.id}`)}>
                  Edit
                </Button>
                <Button type="button" size="sm" variant="destructive" disabled={!selected} className="h-7 px-2.5 text-[11px]">
                  Delete
                </Button>
                <span className="ms-auto text-[11px] text-slate-500">Outgoing queue</span>
              </div>
            }
          />
        </div>

        <div className="rounded-xl border border-slate-200/90 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-3 py-3">
            <h3 className="text-sm font-semibold text-slate-900">Ticket details</h3>
          </div>
          {!selected ? (
            <div className="p-6 text-center text-xs text-slate-400">Select a ticket to view details</div>
          ) : (
            <div className="space-y-3 p-3 text-xs">
              <Field label="ID" value={String(selected.id)} />
              <Field label="Customer / CMO" value={selected.customerCmo} />
              <Field label="Commodity & grade" value={selected.commodityGrade} />
              <Field label="Truck" value={<span className="font-mono">{selected.truck}</span>} />
              <Field label="Status" value={<span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize", statusBadgeClass(selected.status))}>{selected.status}</span>} />
              <Field label="Net (T)" value={formatNet(selected.netT)} />
              <Field label="Date" value={selected.date} />
              <Field label="Notes" value={selected.notes || "—"} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }) {
  return (
    <div className="space-y-0.5">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="rounded border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] text-slate-700">{value ?? "—"}</div>
    </div>
  );
}
