"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Grid } from "@/components/clutch-table";
import { Button } from "@/components/ui/button";
import { PACK_FORM_LOOKUPS, PACK_STATUSES } from "@/lib/Data";
import { loadPackScheduleRows, savePackScheduleRows } from "@/lib/pack-schedule-store";
import { cn } from "@/lib/utils";

const inputClass =
  "h-7 rounded-md border border-slate-200 bg-white px-2 text-[11px] text-slate-800 outline-none ring-brand/15 focus:border-brand/35 focus:ring-2";
const config = {
  title: "Packing Schedule",
  subtitle: "Manage pack queues, status workflows, and daily planning.",
};

const TABLE_COLUMNS = [
  { key: "customer", label: "Customer" },
  { key: "commodity", label: "Commodity" },
  { key: "status", label: "Status" },
  { key: "jobReference", label: "Job Ref" },
  { key: "vessel", label: "Vessel" },
  { key: "etd", label: "ETD", date: true },
  { key: "vesselCutoffDate", label: "Cut-off" },
  { key: "emptyPark", label: "Empty park" },
  { key: "containersRequired", label: "Cnt", numeric: true },
  { key: "mtTotal", label: "MT", numeric: true },
  { key: "id", label: "ID", numeric: true },
  { key: "importExport", label: "I/E" },
];

const DATE_FILTER_OPTIONS = [
  { key: "vesselCutoffDate", label: "Cut-off" },
  { key: "etd", label: "ETD" },
  { key: "packingStartDate", label: "Packing Start Date" },
];

const DATE_FILTER_MODES = [
  { key: "all", label: "Any Date" },
  { key: "specific", label: "Specific Date" },
  { key: "range", label: "Date Range" },
];

function formatCutoffOrEtdDisplay(value) {
  if (value == null || String(value).trim() === "") return "â€”";
  const str = String(value).trim();
  if (str.includes("T")) {
    const [d, t] = str.split("T");
    const hm = (t || "").slice(0, 5);
    return hm ? `${d} ${hm}` : d;
  }
  return str;
}

function emptyParkRaw(row, parkIdToName) {
  const details = Array.isArray(row.releaseDetails) ? row.releaseDetails : [];
  const names = [];
  const seen = new Set();
  for (const r of details) {
    const id = r.emptyContainerParkId;
    if (!id) continue;
    const name = parkIdToName.get(Number(id));
    if (name && !seen.has(name)) {
      seen.add(name);
      names.push(name);
    }
  }
  return names.join(", ");
}

function emptyParkDisplay(row, parkIdToName) {
  const s = emptyParkRaw(row, parkIdToName);
  return s || "â€”";
}

function getDateOnlyValue(rawValue) {
  if (rawValue == null) return "";
  const value = String(rawValue).trim();
  if (!value) return "";
  const isoMatch = value.match(/^(\d{4}-\d{2}-\d{2})/);
  if (isoMatch) return isoMatch[1];
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toISOString().slice(0, 10);
}

export default function PackingSchedulePage() {
  const router = useRouter();
  const [rows, setRows] = useState(() => loadPackScheduleRows());
  const [importExportFilter, setImportExportFilter] = useState("all");
  const [dateFilterField, setDateFilterField] = useState("vesselCutoffDate");
  const [dateFilterMode, setDateFilterMode] = useState("all");
  const [specificDate, setSpecificDate] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedStatuses, setSelectedStatuses] = useState(() => [...PACK_STATUSES]);
  const [selectedId, setSelectedId] = useState(null);
  useEffect(() => {
    setRows(loadPackScheduleRows());
  }, []);

  useEffect(() => {
    savePackScheduleRows(rows);
  }, [rows]);

  const toggleStatus = (s) => {
    setSelectedStatuses((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));
  };

  const filtered = useMemo(() => {
    return rows.filter((p) => selectedStatuses.includes(p.status))
      .filter((p) => importExportFilter === "all" || p.importExport === importExportFilter)
      .filter((p) => {
        if (dateFilterMode === "all") return true;
        const rowDate = getDateOnlyValue(p[dateFilterField]);
        if (!rowDate) return false;
        if (dateFilterMode === "specific") {
          if (!specificDate) return true;
          return rowDate === specificDate;
        }
        if (!dateFrom && !dateTo) return true;
        if (dateFrom && !dateTo) return rowDate >= dateFrom;
        if (!dateFrom && dateTo) return rowDate <= dateTo;
        if (dateFrom && rowDate < dateFrom) return false;
        if (dateTo && rowDate > dateTo) return false;
        return true;
      });
  }, [rows, importExportFilter, selectedStatuses, dateFilterMode, dateFilterField, specificDate, dateFrom, dateTo]);

  const selected = useMemo(() => rows.find((p) => p.id === selectedId) || null, [rows, selectedId]);

  const parkIdToName = useMemo(() => {
    const m = new Map();
    for (const p of PACK_FORM_LOOKUPS.containerParks) {
      m.set(p.id, p.name);
    }
    return m;
  }, []);

  const gridColumns = useMemo(() => {
    const emptyParkGetter = (row) => emptyParkRaw(row, parkIdToName);
    return TABLE_COLUMNS.map((column) => {
      const base = {
        key: column.key,
        header: column.label,
        type: column.numeric ? "number" : column.date ? "date" : "text",
        sortable: true,
        filterable: true,
        resizable: true,
      };
      if (column.key === "emptyPark") {
        return {
          ...base,
          type: "text",
          valueGetter: emptyParkGetter,
          format: (v) => (v ? String(v) : "â€”"),
        };
      }
      if (column.key === "vesselCutoffDate") {
        return { ...base, type: "text", format: formatCutoffOrEtdDisplay };
      }
      if (column.key === "etd") {
        return { ...base, type: "date", format: formatCutoffOrEtdDisplay };
      }
      return base;
    });
  }, [parkIdToName]);

  function openAddPage() {
    router.push("/packing-schedule/new-pack-form");
  }

  function openEditPage() {
    if (!selected) return;
    router.push(`/packing-schedule/new-pack-form?mode=edit&id=${selected.id}`);
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs text-slate-500">Operations / {config.title}</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 md:text-[1.65rem]">{config.title}</h1>
        <p className="mt-1 text-xs text-slate-500">{config.subtitle}</p>
      </div>

      <section className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Status Filters</p>
          <select suppressHydrationWarning className={`${inputClass} w-[160px]`} value={importExportFilter} onChange={(e) => setImportExportFilter(e.target.value)}>
            <option value="all">All (Import/Export)</option>
            <option value="Import">Import</option>
            <option value="Export">Export</option>
          </select>
          <div className="ms-auto flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 p-1">
              <label className="cursor-pointer">
                <input suppressHydrationWarning type="radio" name="date-filter-mode" checked={!searchByDate} onChange={() => setSearchByDate(false)} className="sr-only" />
                <span
                  className={cn(
                    "inline-flex h-5 items-center rounded px-2 text-[11px] font-medium transition-colors",
                    !searchByDate ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200" : "text-slate-500 hover:text-slate-700"
                  )}
                >
                  All Dates
                </span>
              </label>
              <label className="cursor-pointer">
                <input suppressHydrationWarning type="radio" name="date-filter-mode" checked={searchByDate} onChange={() => setSearchByDate(true)} className="sr-only" />
                <span
                  className={cn(
                    "inline-flex h-5 items-center rounded px-2 text-[11px] font-medium transition-colors",
                    searchByDate ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200" : "text-slate-500 hover:text-slate-700"
                  )}
                >
                  By Date
                </span>
              </label>
            </div>
            {searchByDate ? <input suppressHydrationWarning className={`${inputClass} w-[140px]`} type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} /> : null}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-200 pt-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Status Filters</p>
          <div className="flex flex-1 flex-wrap items-center gap-2">
            {PACK_STATUSES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => toggleStatus(s)}
                className={cn(
                  "inline-flex h-7 items-center rounded-md border px-2.5 text-[11px] font-medium transition-colors",
                  selectedStatuses.includes(s)
                    ? "border-brand/30 bg-brand/15 text-brand-ink shadow-sm"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-800"
                )}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </section>

      <div className={cn("grid gap-6 xl:items-start", selected ? "xl:grid-cols-[minmax(0,1fr)_minmax(240px,320px)]" : "xl:grid-cols-1")}>
        <div className="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-sm">
          <Grid
            columns={gridColumns}
            rows={filtered}
            getRowId={(row) => row.id}
            theme="light"
            density="standard"
            fileName="Packing Schedule"
            visibleRows={14}
            onRowClick={(row) => setSelectedId(row.id)}
            getRowClassName={({ row }) => {
              const rowClasses = [];
              if (row.importExport === "Import") rowClasses.push("clutch-row-import");
              if (row.id === selectedId) rowClasses.push("clutch-row-selected");
              return rowClasses.join(" ") || undefined;
            }}
            getRowStyle={({ row }) => {
              if (row.id === selectedId) return { backgroundColor: "#dbeafe" };
              if (row.importExport === "Import") return { backgroundColor: "#eff6ff" };
              return undefined;
            }}
            toolbarActions={
              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" size="sm" variant="secondary" className="h-7 px-2.5 text-[11px]">
                  Schedule
                </Button>
                <Button type="button" size="sm" onClick={openAddPage} className="h-7 px-2.5 text-[11px]">
                  + Add Pack
                </Button>
                <Button type="button" size="sm" variant="secondary" disabled={!selected} className="h-7 px-2.5 text-[11px]" onClick={openEditPage}>
                  Edit
                </Button>
                <Button type="button" size="sm" variant="destructive" disabled={!selected} className="h-7 px-2.5 text-[11px]">
                  Delete
                </Button>
                <span className="ms-auto text-[11px] text-slate-500">View: All Orders</span>
              </div>
            }
          />
          {!filtered.length ? (
            <p className="border-t border-slate-100 px-3 py-8 text-center text-xs text-slate-400">No packs match the current filters.</p>
          ) : null}
        </div>

        {selected ? (
          <div className="rounded-xl border border-slate-200/90 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-3 py-3">
              <h3 className="text-sm font-semibold text-slate-900">Pack Details</h3>
            </div>
            <div className="space-y-3 p-3 text-xs">
              <Field label="Pack ID" value={String(selected.id)} />
              <Field label="Status" value={selected.status} />
              <Field label="Customer" value={selected.customer} />
              <Field label="Commodity" value={selected.commodity} />
              <Field label="Import/Export" value={selected.importExport} />
              <Field label="Job Ref" value={selected.jobReference} />
              <Field label="Vessel" value={selected.vessel} />
              <Field label="ETD" value={formatCutoffOrEtdDisplay(selected.etd)} />
              <Field label="Cut-off" value={formatCutoffOrEtdDisplay(selected.vesselCutoffDate)} />
              <Field label="Packing Start Date" value={formatCutoffOrEtdDisplay(selected.packingStartDate)} />
              <Field label="Empty park" value={emptyParkDisplay(selected, parkIdToName)} />
              <Field label="Count" value={String(selected.containersRequired)} />
              <Field label="MT" value={selected.mtTotal?.toFixed(1)} />
            </div>
          </div>
        ) : null}
      </div>

    </div>
  );
}

function Field({ label, value }) {
  return (
    <div className="space-y-0.5">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="rounded border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] text-slate-700">{value ?? "â€”"}</div>
    </div>
  );
}