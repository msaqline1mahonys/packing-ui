"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import dayjs from "dayjs";

import { Grid } from "@/components/clutch-table";
import { Button } from "@/components/ui/button";
import CustomDateRangePicker from "@/components/ui/custom-date-range-picker";
import { getPackPraProgress, getPackProgress, loadWorkDrafts, syncWorkDrafts } from "@/lib/packers-work-store";
import { fetchPackRows } from "@/lib/pack-schedule-store";
import { useAllPackLookups } from "@/lib/hooks/use-pack-form-data";
import { cn } from "@/lib/utils";
import ClutchSelect from "@/components/custom/ClutchSelect";

const inputClass =
  "h-7 rounded-md border border-slate-200 bg-white px-2 text-[11px] text-slate-800 outline-none ring-brand/15 focus:border-brand/35 focus:ring-2";

const IMPORT_EXPORT_OPTIONS = [
  { value: "all", label: "All (Import/Export)" },
  { value: "Import", label: "Import" },
  { value: "Export", label: "Export" },
];

const TABLE_COLUMNS = [
  { key: "customer", label: "Customer" },
  { key: "commodity", label: "Commodity" },
  { key: "status", label: "Status" },
  { key: "packNumber", label: "Pack No." },
  { key: "jobReference", label: "Job Ref" },
  { key: "vessel", label: "Vessel" },
  { key: "etd", label: "ETD", date: true },
  { key: "vesselCutoffDate", label: "Cut-off" },
  { key: "emptyPark", label: "Empty park" },
  { key: "containersRequired", label: "Cnt", numeric: true },
  { key: "mtTotal", label: "MT", numeric: true },
  { key: "progress", label: "PRA", text: true },
  { key: "id", label: "ID", numeric: true },
  { key: "importExport", label: "I/E" },
];

function formatCutoffOrEtdDisplay(value) {
  if (value == null || String(value).trim() === "") return "";
  const str = String(value).trim();
  if (str.includes("T")) {
    const [d, t] = str.split("T");
    const hm = (t || "").slice(0, 5);
    return hm ? `${d} ${hm}` : d;
  }
  return str;
}

function emptyParkRaw(row, parkIdToName) {
  const releases = Array.isArray(row.releases) ? row.releases
    : Array.isArray(row.release_details) ? row.release_details
    : Array.isArray(row.releaseDetails) ? row.releaseDetails
    : [];
  const names = [];
  const seen = new Set();
  for (const r of releases) {
    const name = r.empty_container_park?.name ?? r.emptyContainerPark?.name ?? null;
    if (name && !seen.has(name)) {
      seen.add(name);
      names.push(name);
      continue;
    }
    const id = r.empty_container_park_id ?? r.emptyContainerParkId;
    if (!id || !parkIdToName) continue;
    const fallbackName = parkIdToName.get(String(id));
    if (fallbackName && !seen.has(fallbackName)) {
      seen.add(fallbackName);
      names.push(fallbackName);
    }
  }
  return names.join(", ");
}

function emptyParkDisplay(row, parkIdToName) {
  const s = emptyParkRaw(row, parkIdToName);
  return s || "";
}

export default function PackersScheduleClient() {
  const router = useRouter();
  const lookups = useAllPackLookups();
  const [rows, setRows] = useState([]);
  const [importExportFilter, setImportExportFilter] = useState("all");
  const [dateFilterMode, setDateFilterMode] = useState("all");
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [dateRange, setDateRange] = useState([null, null]);
  const [selectedId, setSelectedId] = useState(null);

  useEffect(() => {
    fetchPackRows({ status: "Inprogress" }).then(({ rows: data }) => {
      setRows(Array.isArray(data) ? data.filter((row) => row.status === "Inprogress") : []);
    }).catch(() => setRows([]));
  }, []);

  const filtered = useMemo(() => {
    return rows
      .filter((row) => (importExportFilter === "all" ? true : (row.import_export ?? row.importExport) === importExportFilter))
      .filter((row) => {
        if (dateFilterMode === "all") return true;
        if (dateFilterMode === "specific") return row.date === selectedDate;
        const [fromDate, toDate] = dateRange;
        if (!fromDate && !toDate) return true;
        if (!row.date) return false;
        const d = dayjs(row.date);
        if (!d.isValid()) return false;
        if (fromDate && d.isBefore(fromDate, "day")) return false;
        if (toDate && d.isAfter(toDate, "day")) return false;
        return true;
      });
  }, [rows, importExportFilter, dateFilterMode, selectedDate, dateRange]);

  const selected = useMemo(() => filtered.find((row) => row.id === selectedId) || null, [filtered, selectedId]);

  useEffect(() => {
    if (selectedId && !filtered.some((row) => row.id === selectedId)) setSelectedId(null);
  }, [filtered, selectedId]);

  const parkIdToName = useMemo(() => {
    const m = new Map();
    for (const p of lookups.containerParks || []) {
      if (p?.id == null) continue;
      m.set(String(p.id), p.name);
    }
    return m;
  }, [lookups.containerParks]);

  const workByPack = useMemo(() => syncWorkDrafts(rows, loadWorkDrafts(), lookups), [rows, lookups]);

  const rowsWithProgress = useMemo(
    () =>
      filtered.map((row) => ({
        ...row,
        progress: getPackPraProgress(row, workByPack).label,
      })),
    [filtered, workByPack]
  );

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
      if (column.key === "customer") {
        return { ...base, valueGetter: (row) => row.customer?.name ?? row.customer_name ?? (typeof row.customer === "string" ? row.customer : "") };
      }
      if (column.key === "commodity") {
        return {
          ...base,
          valueGetter: (row) => row.commodity?.description ?? row.commodity_description ?? (typeof row.commodity === "string" ? row.commodity : ""),
        };
      }
      if (column.key === "vessel") {
        return {
          ...base,
          valueGetter: (row) =>
            row.vessel_voyage?.vessel?.vessel_name ??
            row.vesselVoyage?.vessel?.vesselName ??
            (typeof row.vessel === "string" ? row.vessel : "") ??
            "",
        };
      }
      if (column.key === "emptyPark") {
        return {
          ...base,
          valueGetter: emptyParkGetter,
          format: (v) => (v ? String(v) : ""),
        };
      }
      if (column.key === "vesselCutoffDate") {
        return {
          ...base,
          type: "text",
          valueGetter: (row) => row.vessel_cutoff_date ?? row.vesselCutoffDate ?? row.vessel_voyage?.vessel_cutoff_date ?? "",
          format: formatCutoffOrEtdDisplay,
        };
      }
      if (column.key === "etd") {
        return {
          ...base,
          type: "date",
          valueGetter: (row) => row.etd ?? row.vessel_voyage?.vessel_etd ?? "",
          format: formatCutoffOrEtdDisplay,
        };
      }
      if (column.key === "importExport") {
        return { ...base, valueGetter: (row) => row.import_export ?? row.importExport ?? "" };
      }
      if (column.key === "containersRequired") {
        return { ...base, valueGetter: (row) => row.containers_required ?? row.containersRequired ?? null };
      }
      if (column.key === "mtTotal") {
        return { ...base, valueGetter: (row) => row.mt_total ?? row.mtTotal ?? null };
      }
      if (column.key === "jobReference") {
        return { ...base, valueGetter: (row) => row.job_reference ?? row.jobReference ?? "" };
      }
      if (column.key === "packNumber") {
        return { ...base, valueGetter: (row) => row.pack_number ?? row.packNumber ?? "" };
      }
      return base;
    });
  }, [parkIdToName]);

  function openPack() {
    if (!selected) return;
    router.push(`/packers-schedule/${selected.id}`);
  }

  function refreshRows() {
    fetchPackRows({ status: "Inprogress" }).then(({ rows: data }) => {
      setRows(Array.isArray(data) ? data.filter((row) => row.status === "Inprogress") : []);
    }).catch(() => {});
  }

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Status Filters</p>
          <ClutchSelect
            options={IMPORT_EXPORT_OPTIONS}
            value={IMPORT_EXPORT_OPTIONS.find((o) => o.value === importExportFilter) ?? null}
            onChange={(option) => setImportExportFilter(option ? option.value : "all")}
            isClearable={false}
            className="w-[160px]"
          />
          <div className="ms-auto flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 p-1">
              <label className="cursor-pointer">
                <input suppressHydrationWarning type="radio" name="date-filter-mode-packers" checked={dateFilterMode === "all"} onChange={() => setDateFilterMode("all")} className="sr-only" />
                <span
                  className={cn(
                    "inline-flex h-5 items-center rounded px-2 text-[11px] font-medium transition-colors",
                    dateFilterMode === "all" ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200" : "text-slate-500 hover:text-slate-700"
                  )}
                >
                  All Dates
                </span>
              </label>
              {/* <label className="cursor-pointer">
                <input suppressHydrationWarning type="radio" name="date-filter-mode-packers" checked={dateFilterMode === "specific"} onChange={() => setDateFilterMode("specific")} className="sr-only" />
                <span
                  className={cn(
                    "inline-flex h-5 items-center rounded px-2 text-[11px] font-medium transition-colors",
                    dateFilterMode === "specific" ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200" : "text-slate-500 hover:text-slate-700"
                  )}
                >
                  By Date
                </span>
              </label> */}
              <label className="cursor-pointer">
                <input suppressHydrationWarning type="radio" name="date-filter-mode-packers" checked={dateFilterMode === "range"} onChange={() => setDateFilterMode("range")} className="sr-only" />
                <span
                  className={cn(
                    "inline-flex h-5 items-center rounded px-2 text-[11px] font-medium transition-colors",
                    dateFilterMode === "range" ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200" : "text-slate-500 hover:text-slate-700"
                  )}
                >
                  Date Range
                </span>
              </label>
            </div>
          </div>
        </div>
        {dateFilterMode === "specific" || dateFilterMode === "range" ? (
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              {dateFilterMode === "range" ? "Filter by Date Range" : "Filter by Date"}
            </span>
            {dateFilterMode === "specific" ? (
              <input suppressHydrationWarning className={`${inputClass} w-[160px]`} type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} aria-label="Specific date" />
            ) : (
              <div className="w-72">
                <CustomDateRangePicker value={dateRange} onChange={setDateRange} />
              </div>
            )}
          </div>
        ) : null}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="inline-flex h-7 items-center rounded-md border border-brand/30 bg-brand/15 px-2.5 text-[11px] font-medium text-brand-ink shadow-sm">
            Inprogress only
          </span>
          <span className="text-[11px] text-slate-500">Packers queue uses in-progress packs from Packing Schedule.</span>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(240px,320px)] xl:items-start">
        <div className="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-sm">
          <Grid
            columns={gridColumns}
            rows={rowsWithProgress}
            getRowId={(row) => row.id}
            theme="light"
            density="standard"
            fileName="Packers Schedule"
            visibleRows={14}
            onRowClick={(row) => setSelectedId(row.id)}
            onPersistedRowActivate={(row) => setSelectedId(row.id)}
            getRowClassName={({ row }) => (row.id === selectedId ? "clutch-row-selected" : undefined)}
            getRowStyle={({ row }) => (row.id === selectedId ? { backgroundColor: "#dbeafe" } : undefined)}
            toolbarActions={
              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" size="sm" variant="secondary" className="h-7 px-2.5 text-[11px]">
                  Schedule
                </Button>
                <Button type="button" size="sm" className="h-7 px-2.5 text-[11px]" disabled={!selected} onClick={openPack}>
                  Open Pack
                </Button>
                <Button type="button" size="sm" variant="secondary" className="h-7 px-2.5 text-[11px]" onClick={refreshRows}>
                  Refresh
                </Button>
                <span className="ms-auto text-[11px] text-slate-500">View: Inprogress queue</span>
              </div>
            }
          />
          {!rowsWithProgress.length ? (
            <p className="border-t border-slate-100 px-3 py-8 text-center text-xs text-slate-400">No in-progress packs match the current filters.</p>
          ) : null}
        </div>

        <div className="rounded-xl border border-slate-200/90 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-3 py-3">
            <h3 className="text-sm font-semibold text-slate-900">Pack Details</h3>
          </div>
          {selected ? (
            <div className="space-y-3 p-3 text-xs">
              <Field label="Pack ID" value={String(selected.id)} />
              <Field label="Status" value={selected.status} />
              <Field label="Customer" value={selected.customer?.name ?? selected.customer_name ?? (typeof selected.customer === "string" ? selected.customer : "")} />
              <Field label="Commodity" value={selected.commodity?.description ?? selected.commodity_description ?? (typeof selected.commodity === "string" ? selected.commodity : "")} />
              <Field label="Pack No." value={selected.pack_number ?? selected.packNumber ?? ""} />
              <Field label="Job Ref" value={selected.job_reference ?? selected.jobReference ?? ""} />
              <Field label="Vessel" value={selected.vessel_voyage?.vessel?.vessel_name ?? selected.vesselVoyage?.vessel?.vesselName ?? (typeof selected.vessel === "string" ? selected.vessel : "") ?? ""} />
              <Field label="ETD" value={formatCutoffOrEtdDisplay(selected.etd ?? selected.vessel_voyage?.vessel_etd ?? "")} />
              <Field label="Cut-off" value={formatCutoffOrEtdDisplay(selected.vessel_cutoff_date ?? selected.vesselCutoffDate ?? selected.vessel_voyage?.vessel_cutoff_date ?? "")} />
              <Field label="Empty park" value={emptyParkDisplay(selected, parkIdToName)} />
              <Field label="Count" value={String(selected.containers_required ?? selected.containersRequired ?? "")} />
              <Field label="PRA progress" value={getPackPraProgress(selected, workByPack).label} />
              <div className="pt-1">
                <Button type="button" size="sm" className="w-full text-[12px]" onClick={openPack}>
                  Open Container Details
                </Button>
              </div>
            </div>
          ) : (
            <div className="p-6 text-center text-xs text-slate-400">Select a pack to open container details</div>
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
      <div className="rounded border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] text-slate-700">{value ?? ""}</div>
    </div>
  );
}