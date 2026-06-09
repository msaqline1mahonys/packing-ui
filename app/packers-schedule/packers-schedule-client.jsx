"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Grid } from "@/components/clutch-table";
import { Button } from "@/components/ui/button";
import { PACK_FORM_LOOKUPS } from "@/lib/Data";
import { getPackProgress, loadWorkDrafts, syncWorkDrafts } from "@/lib/packers-work-store";
import { loadPackScheduleRows } from "@/lib/pack-schedule-store";
import { cn } from "@/lib/utils";

const inputClass =
  "h-7 rounded-md border border-slate-200 bg-white px-2 text-[11px] text-slate-800 outline-none ring-brand/15 focus:border-brand/35 focus:ring-2";

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
  return s || "";
}

export default function PackersScheduleClient() {
  const router = useRouter();
  const [rows, setRows] = useState(() => loadPackScheduleRows().filter((row) => row.status === "Inprogress"));
  const [importExportFilter, setImportExportFilter] = useState("all");
  const [searchByDate, setSearchByDate] = useState(false);
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [selectedId, setSelectedId] = useState(null);

  useEffect(() => {
    setRows(loadPackScheduleRows().filter((row) => row.status === "Inprogress"));
  }, []);

  const filtered = useMemo(() => {
    return rows
      .filter((row) => (importExportFilter === "all" ? true : row.importExport === importExportFilter))
      .filter((row) => (searchByDate ? row.date === selectedDate : true));
  }, [rows, importExportFilter, searchByDate, selectedDate]);

  const selected = useMemo(() => filtered.find((row) => row.id === selectedId) || null, [filtered, selectedId]);

  useEffect(() => {
    if (selectedId && !filtered.some((row) => row.id === selectedId)) setSelectedId(null);
  }, [filtered, selectedId]);

  const parkIdToName = useMemo(() => {
    const m = new Map();
    for (const p of PACK_FORM_LOOKUPS.containerParks) {
      m.set(p.id, p.name);
    }
    return m;
  }, []);

  const workByPack = useMemo(() => syncWorkDrafts(rows, loadWorkDrafts()), [rows]);

  const rowsWithProgress = useMemo(
    () =>
      filtered.map((row) => ({
        ...row,
        progress: getPackProgress(row, workByPack).label,
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
      if (column.key === "emptyPark") {
        return {
          ...base,
          valueGetter: emptyParkGetter,
          format: (v) => (v ? String(v) : ""),
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

  function openPack() {
    if (!selected) return;
    router.push(`/packers-schedule/${selected.id}`);
  }

  function refreshRows() {
    setRows(loadPackScheduleRows().filter((row) => row.status === "Inprogress"));
  }

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Status Filters</p>
          <select suppressHydrationWarning className={`${inputClass} w-[160px]`} value={importExportFilter} onChange={(event) => setImportExportFilter(event.target.value)}>
            <option value="all">All (Import/Export)</option>
            <option value="Import">Import</option>
            <option value="Export">Export</option>
          </select>
          <div className="ms-auto flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 p-1">
              <label className="cursor-pointer">
                <input suppressHydrationWarning type="radio" name="date-filter-mode-packers" checked={!searchByDate} onChange={() => setSearchByDate(false)} className="sr-only" />
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
                <input suppressHydrationWarning type="radio" name="date-filter-mode-packers" checked={searchByDate} onChange={() => setSearchByDate(true)} className="sr-only" />
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
            {searchByDate ? <input suppressHydrationWarning className={`${inputClass} w-[140px]`} type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} /> : null}
          </div>
        </div>
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
              <Field label="Customer" value={selected.customer} />
              <Field label="Commodity" value={selected.commodity} />
              <Field label="Job Ref" value={selected.jobReference} />
              <Field label="Vessel" value={selected.vessel} />
              <Field label="ETD" value={formatCutoffOrEtdDisplay(selected.etd)} />
              <Field label="Cut-off" value={formatCutoffOrEtdDisplay(selected.vesselCutoffDate)} />
              <Field label="Empty park" value={emptyParkDisplay(selected, parkIdToName)} />
              <Field label="Count" value={String(selected.containersRequired)} />
              <Field label="PRA progress" value={getPackProgress(selected, workByPack).label} />
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