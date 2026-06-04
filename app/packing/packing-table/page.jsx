"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Grid } from "@/components/clutch-table";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const MOBILE_BREAKPOINT = 900;

/* ─── Sample rows ─── */
const SAMPLE_ROWS = [
  {
    id: 1,
    packType: "container",
    importExport: "Export",
    status: "Scheduled",
    customerId: "ACME Corp",
    exporter: "Outback Grains",
    commodityTypeId: "Grain",
    commodityId: "Wheat",
    jobReference: "JOB-2026-001",
    siteId: "Sydney",
    containersRequired: "4",
    mtTotal: "100",
    destinationCountry: "Japan",
    destinationPort: "Yokohama",
    shippingLineId: "Maersk",
    fumigationRequired: true,
    date: "2026-05-10",
  },
  {
    id: 2,
    packType: "bulk",
    importExport: "Export",
    status: "Pending",
    customerId: "GrainLink",
    exporter: "Murray Farms",
    commodityTypeId: "Pulse",
    commodityId: "Chickpeas",
    jobReference: "JOB-2026-002",
    siteId: "Melbourne",
    containersRequired: "",
    mtTotal: "250",
    destinationCountry: "India",
    destinationPort: "Mumbai",
    shippingLineId: "MSC",
    fumigationRequired: false,
    date: "2026-05-11",
  },
  {
    id: 3,
    packType: "container",
    importExport: "Import",
    status: "In Progress",
    customerId: "Southern Export",
    exporter: "",
    commodityTypeId: "Oilseed",
    commodityId: "Canola",
    jobReference: "JOB-2026-003",
    siteId: "Brisbane",
    containersRequired: "2",
    mtTotal: "52",
    destinationCountry: "China",
    destinationPort: "Shanghai",
    shippingLineId: "Evergreen",
    fumigationRequired: true,
    date: "2026-05-09",
  },
];

/* ─── Column config ─── */
const TABLE_COLUMNS = [
  { key: "jobReference", label: "Job Ref" },
  { key: "status", label: "Status" },
  { key: "packType", label: "Pack Type" },
  { key: "importExport", label: "Imp/Exp" },
  { key: "customerId", label: "Customer" },
  { key: "exporter", label: "Exporter" },
  { key: "commodityTypeId", label: "Commodity Type" },
  { key: "commodityId", label: "Commodity" },
  { key: "siteId", label: "Site" },
  { key: "containersRequired", label: "Containers", numeric: true },
  { key: "mtTotal", label: "MT Total", numeric: true },
  { key: "destinationCountry", label: "Dest. Country" },
  { key: "destinationPort", label: "Dest. Port" },
  { key: "shippingLineId", label: "Shipping Line" },
  { key: "fumigationRequired", label: "Fumigation" },
  { key: "date", label: "Date" },
];

/* ─── Detail sidebar columns (a curated subset) ─── */
const DETAIL_COLUMNS = [
  { key: "jobReference", label: "Job Reference" },
  { key: "status", label: "Status" },
  { key: "packType", label: "Pack Type" },
  { key: "importExport", label: "Import / Export" },
  { key: "customerId", label: "Customer" },
  { key: "exporter", label: "Exporter" },
  { key: "commodityTypeId", label: "Commodity Type" },
  { key: "commodityId", label: "Commodity" },
  { key: "siteId", label: "Site" },
  { key: "containersRequired", label: "Containers Required" },
  { key: "mtTotal", label: "MT Total" },
  { key: "destinationCountry", label: "Destination Country" },
  { key: "destinationPort", label: "Destination Port" },
  { key: "shippingLineId", label: "Shipping Line" },
  { key: "fumigationRequired", label: "Fumigation Required" },
  { key: "date", label: "Date" },
];

/* ─── Grid column definitions ─── */
const gridColumns = TABLE_COLUMNS.map((col) => ({
  key: col.key,
  header: col.label,
  type: "text",
  sortable: true,
  filterable: true,
  resizable: true,
  ...(col.key === "fumigationRequired" && {
    renderCell: (value) => (value === true || value === "true" ? "Yes" : "No"),
  }),
}));

function formatCellValue(key, value) {
  if (key === "fumigationRequired") return value === true || value === "true" ? "Yes" : "No";
  return value ?? "—";
}

export default function PackingTablePage() {
  const router = useRouter();
  const [rows, setRows] = useState(() => {
    // Merge localStorage rows with sample data
    if (typeof window !== "undefined") {
      try {
        const stored = JSON.parse(localStorage.getItem("packing_rows") || "[]");
        if (stored.length > 0) return stored;
      } catch {
        // ignore
      }
    }
    return [...SAMPLE_ROWS];
  });
  const [selectedId, setSelectedId] = useState(null);
  const [isMobile, setIsMobile] = useState(false);
  const [showGoToTop, setShowGoToTop] = useState(false);

  // Sync rows to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem("packing_rows", JSON.stringify(rows));
  }, [rows]);

  useEffect(() => {
    const query = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const handleMedia = () => setIsMobile(query.matches);
    handleMedia();
    query.addEventListener("change", handleMedia);
    return () => query.removeEventListener("change", handleMedia);
  }, []);

  useEffect(() => {
    if (!isMobile) return;
    const onScroll = () => setShowGoToTop(window.scrollY > 400);
    onScroll();
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, [isMobile]);

  const selected = selectedId != null ? rows.find((row) => row.id === selectedId) ?? null : null;

  function openCreateForm() {
    router.push("/packing-schedule/new-pack-form?mode=add");
  }

  function openEditForm() {
    if (!selected) return;
    router.push(`/packing-schedule/new-pack-form?mode=edit&id=${selected.id}`);
  }

  function removeSelected() {
    if (!selected) return;
    setRows((prev) => {
      const next = prev.filter((row) => row.id !== selected.id);
      localStorage.setItem("packing_rows", JSON.stringify(next));
      return next;
    });
    setSelectedId(null);
  }

  // Prepare rows for Grid — convert boolean fumigationRequired to string for display
  const displayRows = rows.map((row) => ({
    ...row,
    fumigationRequired: row.fumigationRequired === true || row.fumigationRequired === "true" ? "Yes" : "No",
  }));

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs text-slate-500">Packing / Packing Table</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 md:text-[1.65rem]">Packing Table</h1>
        {!isMobile ? <p className="mt-1 text-xs text-slate-500">Manage all packing jobs — create, edit, and track pack status.</p> : null}
      </div>

      <div className={cn("grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(240px,320px)] xl:items-start", isMobile && "grid-cols-1")}>
        <div className="overflow-hidden rounded-xl bg-white shadow-sm">
          {isMobile ? (
            <MobileList
              rows={rows}
              selectedId={selectedId}
              onSelect={setSelectedId}
              title="Packing"
              primaryKey="jobReference"
              secondaryKey="customerId"
              summaryKeys={["status", "commodityId", "mtTotal"]}
            />
          ) : (
            <Grid
              columns={gridColumns}
              rows={displayRows}
              getRowId={(row) => row.id}
              theme="light"
              density="standard"
              fileName="Packing Table"
              visibleRows={12}
              onRowClick={(row) => setSelectedId((prev) => (prev === row.id ? null : row.id))}
              onPersistedRowActivate={(row) => setSelectedId(row.id)}
              toolbarActions={
                <div className="flex flex-wrap gap-2">
                  <Button type="button" size="sm" onClick={openCreateForm}>+ New Pack</Button>
                  <Button type="button" variant="outline" size="sm" disabled={!selected} onClick={openEditForm}>Edit</Button>
                  <Button type="button" variant="destructive" size="sm" disabled={!selected} onClick={removeSelected}>Delete</Button>
                </div>
              }
            />
          )}
        </div>

        {!isMobile ? (
          <aside className="rounded-xl border border-slate-200/90 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900">Pack Details</h2>
            {!selected ? (
              <p className="mt-4 text-sm leading-relaxed text-slate-500">Select a row to view details.</p>
            ) : (
              <dl className="mt-4 space-y-3 text-sm">
                {DETAIL_COLUMNS.map((col) => (
                  <DetailItem key={col.key} label={col.label} value={formatCellValue(col.key, selected[col.key])} highlight={col.key === "jobReference"} />
                ))}
              </dl>
            )}
          </aside>
        ) : null}
      </div>

      {isMobile && showGoToTop ? (
        <button
          type="button"
          aria-label="Go to top"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="fixed bottom-5 right-5 z-50 flex size-12 items-center justify-center rounded-full bg-gradient-to-br from-brand to-blue-500 text-xl text-white shadow-lg shadow-blue-500/30"
        >
          ↑
        </button>
      ) : null}
    </div>
  );
}

/* ─── Sub components ─── */

function DetailItem({ label, value, highlight }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className={cn("mt-0.5 text-slate-800", highlight && "font-semibold text-brand")}>{value || "—"}</dd>
    </div>
  );
}

function MobileList({ rows, selectedId, onSelect, title, primaryKey, secondaryKey, summaryKeys }) {
  const emptyMessage = `No ${title.toLowerCase()} found. Create your first pack!`;
  return (
    <div className="space-y-2 p-3">
      <div className="px-0.5 text-xs font-semibold text-slate-600">{title} ({rows.length})</div>
      {rows.length === 0 ? (
        <div className="py-8 text-center text-sm text-slate-400">{emptyMessage}</div>
      ) : (
        rows.map((row) => {
          const isSelected = row.id === selectedId;
          const summary = summaryKeys.map((key) => formatCellValue(key, row[key])).filter(Boolean).join(" · ");
          return (
            <button
              key={row.id}
              type="button"
              onClick={() => onSelect(isSelected ? null : row.id)}
              className={cn("w-full rounded-xl border-2 px-3 py-3 text-left transition-colors", isSelected ? "border-blue-500 bg-blue-50" : "border-slate-200 bg-white")}
            >
              <p className="text-xs font-bold text-blue-600">{row[primaryKey] || "—"}</p>
              <p className="mt-1 text-sm font-semibold text-slate-800">{row[secondaryKey] || "—"}</p>
              <p className="mt-1 text-[11px] text-slate-500">{summary || "—"}</p>
            </button>
          );
        })
      )}
    </div>
  );
}
