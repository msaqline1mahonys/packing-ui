"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Grid } from "@/components/clutch-table";
import { StatusFilterBar } from "@/components/packing-schedule/status-filter-bar";
import { Button } from "@/components/ui/button";
import { PACK_STATUSES } from "@/lib/Data";
import { fetchPackRows, removePack } from "@/lib/pack-schedule-store";
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
  // Pack basics
  { key: "packType", label: "Pack Type", hidden: true },
  { key: "packConfirmed", label: "Pack Confirmed", hidden: true },
  // Site & import
  { key: "testRequired", label: "Test Required", hidden: true },
  { key: "shrinkTaken", label: "Shrink Taken", hidden: true },
  // Sample
  { key: "sampleRequired", label: "Sample Required", hidden: true },
  // Basic details
  { key: "exporter", label: "Exporter", hidden: true },
  { key: "packingStartDate", label: "Packing Start Date", date: true, hidden: true },
  { key: "assignedPackers", label: "Assigned Packers", hidden: true },
  { key: "fumigationRequired", label: "Fumigation Required", hidden: true },
  { key: "fumigation", label: "Fumigant", hidden: true },
  { key: "daffPermission", label: "DAFF Permission", hidden: true },
  { key: "packWarningRequired", label: "Pack Warning", hidden: true },
  { key: "packWarning", label: "Pack Warning Details", hidden: true },
  // Containers & quantity
  { key: "containerCode", label: "Container Code", hidden: true },
  { key: "quantityPerContainer", label: "Req Tonnes/Ctr", numeric: true, hidden: true },
  { key: "maxQtyPerContainer", label: "Max MT/Ctr", numeric: true, hidden: true },
  // Destination & shipping
  { key: "destinationCountry", label: "Destination Country", hidden: true },
  { key: "destinationPort", label: "Destination Port", hidden: true },
  { key: "shippingLine", label: "Shipping Line", hidden: true },
  { key: "terminal", label: "Terminal", hidden: true },
  { key: "transshipmentPort", label: "Transshipment Port", hidden: true },
  { key: "transshipmentPortCode", label: "Transship. Port Code", hidden: true },
  { key: "voyageNumber", label: "Voyage Number", hidden: true },
  { key: "lloydId", label: "Lloyd ID", hidden: true },
  // Import permit
  { key: "importPermitRequired", label: "Import Permit Req.", hidden: true },
  { key: "importPermitNumber", label: "Import Permit No.", hidden: true },
  { key: "importPermitDate", label: "Import Permit Date", date: true, hidden: true },
  // RFP
  { key: "rfp", label: "RFP", hidden: true },
  { key: "edn", label: "EDN", hidden: true },
  { key: "rfpAdditionalDeclarationRequired", label: "RFP Add. Decl.", hidden: true },
  { key: "rfpComment", label: "RFP Comment", hidden: true },
  { key: "rfpExpiry", label: "RFP Expiry", date: true, hidden: true },
  { key: "rfpCommodityCode", label: "RFP Commodity Code", hidden: true },
  { key: "rfpPackType", label: "RFP Pack Type", hidden: true },
  { key: "rfpTotalQuantity", label: "RFP Total Qty", numeric: true, hidden: true },
  { key: "rfpQuantityUnit", label: "RFP Qty Unit", hidden: true },
  { key: "rfpFlowPath", label: "RFP Flow Path", hidden: true },
  { key: "originalRfpNumber", label: "Original RFP No.", hidden: true },
  // Packing & notes
  { key: "jobNotes", label: "Job Notes", hidden: true },
];

const BOOL_COLUMN_KEYS = new Set([
  "packConfirmed", "testRequired", "shrinkTaken", "sampleRequired",
  "fumigationRequired", "packWarningRequired", "importPermitRequired",
  "rfpAdditionalDeclarationRequired",
]);

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
  if (value == null || String(value).trim() === "") return "";
  const str = String(value).trim();
  if (str.includes("T")) {
    const [d, t] = str.split("T");
    const hm = (t || "").slice(0, 5);
    return hm ? `${d} ${hm}` : d;
  }
  return str;
}

function emptyParkRaw(row) {
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
    }
  }
  return names.join(", ");
}

function emptyParkDisplay(row) {
  return emptyParkRaw(row) || "";
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
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [importExportFilter, setImportExportFilter] = useState("all");
  const [dateFilterField, setDateFilterField] = useState("vesselCutoffDate");
  const [dateFilterMode, setDateFilterMode] = useState("all");
  const [specificDate, setSpecificDate] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedStatuses, setSelectedStatuses] = useState(() => [...PACK_STATUSES]);
  const [selectedId, setSelectedId] = useState(null);

  const loadRows = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        status: selectedStatuses,
        importExport: importExportFilter,
        ...(dateFilterMode === "specific" && specificDate ? { dateField: dateFilterField, on: specificDate } : {}),
        ...(dateFilterMode === "range" ? { dateField: dateFilterField, from: dateFrom, to: dateTo } : {}),
        perPage: 500,
      };
      const { rows: fetched } = await fetchPackRows(params);
      setRows(fetched);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [selectedStatuses, importExportFilter, dateFilterMode, dateFilterField, specificDate, dateFrom, dateTo]);

  useEffect(() => {
    loadRows();
    // eslint-disable-next-line react-hooks/set-state-in-effect
  }, [loadRows]);

  const filtered = useMemo(() => {
    return rows.filter((p) => selectedStatuses.length > 0 && selectedStatuses.includes(p.status))
      .filter((p) => importExportFilter === "all" || (p.import_export ?? p.importExport) === importExportFilter)
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

  const gridColumns = useMemo(() => {
    return TABLE_COLUMNS.map((column) => {
      const base = {
        key: column.key,
        header: column.label,
        type: column.numeric ? "number" : column.date ? "date" : "text",
        sortable: true,
        filterable: true,
        resizable: true,
        hidden: column.hidden ?? false,
      };
      if (column.key === "customer") {
        return { ...base, valueGetter: (row) => row.customer?.name ?? row.customer_name ?? row.customer ?? "" };
      }
      if (column.key === "commodity") {
        return { ...base, valueGetter: (row) => row.commodity?.description ?? row.commodity_description ?? row.commodity ?? "" };
      }
      if (column.key === "vessel") {
        return {
          ...base,
          valueGetter: (row) =>
            row.vessel_voyage?.vessel?.vessel_name ??
            row.vesselVoyage?.vessel?.vesselName ??
            row.vessel ??
            "",
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
      if (column.key === "vesselCutoffDate") {
        return {
          ...base,
          type: "text",
          valueGetter: (row) => row.vessel_cutoff_date ?? row.vesselCutoffDate ?? row.vessel_voyage?.vessel_cutoff_date ?? "",
          format: formatCutoffOrEtdDisplay,
        };
      }
      if (column.key === "importExport") {
        return { ...base, valueGetter: (row) => row.import_export ?? row.importExport ?? "" };
      }
      if (column.key === "emptyPark") {
        return {
          ...base,
          type: "text",
          valueGetter: (row) => emptyParkRaw(row),
          format: (v) => (v ? String(v) : ""),
        };
      }
      if (BOOL_COLUMN_KEYS.has(column.key)) {
        const snakeKey = column.key.replace(/([A-Z])/g, (m) => `_${m.toLowerCase()}`);
        return {
          ...base,
          valueGetter: (row) => ((row[column.key] ?? row[snakeKey]) ? "Yes" : "No"),
        };
      }
      if (column.key === "exporter") {
        return {
          ...base,
          valueGetter: (row) =>
            row.exporter?.name ??
            row.exporter_details?.name ??
            row.exporterDetails?.name ??
            row.exporter_name ??
            (typeof row.exporter === "string" ? row.exporter : "") ??
            "",
        };
      }
      if (column.key === "assignedPackers") {
        return {
          ...base,
          valueGetter: (row) => {
            const assignments = row.packer_assignments ?? row.packerAssignments ?? [];
            if (Array.isArray(assignments) && assignments.length > 0) {
              return assignments.map((a) => a.packer?.name ?? "").filter(Boolean).join(", ");
            }
            const ids = row.assignedPackerIds ?? row.assigned_packer_ids ?? [];
            return Array.isArray(ids) ? ids.join(", ") : String(ids || "");
          },
        };
      }
      if (column.key === "fumigation") {
        return {
          ...base,
          valueGetter: (row) =>
            row.fumigation ??
            row.fumigation_detail?.fumigationNotes ??
            row.fumigationDetail?.fumigationNotes ??
            "",
        };
      }
      if (column.key === "daffPermission") {
        return { ...base, valueGetter: (row) => row.daffPermission ?? row.daff_permission ?? "" };
      }
      if (column.key === "packWarning") {
        return { ...base, valueGetter: (row) => row.packWarning ?? row.pack_warning ?? "" };
      }
      if (column.key === "shippingLine") {
        return {
          ...base,
          valueGetter: (row) =>
            row.shipping_line?.shipping_line_name ??
            row.shipping_line?.name ??
            row.shippingLine?.shipping_line_name ??
            row.shippingLine?.name ??
            row.shipping_line_name ??
            "",
        };
      }
      if (column.key === "terminal") {
        return {
          ...base,
          valueGetter: (row) =>
            row.terminal?.terminal_name ?? row.terminal?.terminalName ?? row.terminal?.name ?? row.terminal_name ?? "",
        };
      }
      if (column.key === "packingStartDate") {
        return {
          ...base,
          type: "date",
          valueGetter: (row) => row.packingStartDate ?? row.packing_start_date ?? "",
          format: formatCutoffOrEtdDisplay,
        };
      }
      if (column.key === "importPermitDate") {
        return {
          ...base,
          type: "date",
          valueGetter: (row) => row.importPermitDate ?? row.import_permit_date ?? "",
          format: formatCutoffOrEtdDisplay,
        };
      }
      if (column.key === "rfpExpiry") {
        return {
          ...base,
          type: "date",
          valueGetter: (row) => row.rfpExpiry ?? row.rfp_expiry ?? "",
          format: formatCutoffOrEtdDisplay,
        };
      }
      if (column.key === "containerCode") {
        return {
          ...base,
          valueGetter: (row) =>
            row.container_code?.iso_code ??
            row.containerCode?.iso_code ??
            (typeof row.container_code === "string" ? row.container_code : null) ??
            (typeof row.containerCode === "string" ? row.containerCode : null) ??
            "",
        };
      }
      // Auto snake_case fallback for any remaining camelCase column key
      const snakeKey = column.key.replace(/([A-Z])/g, (m) => `_${m.toLowerCase()}`);
      if (snakeKey !== column.key) {
        return {
          ...base,
          valueGetter: (row) => {
            const val = row[column.key] ?? row[snakeKey];
            if (column.numeric) return val != null && val !== "" ? Number(val) : null;
            return val ?? "";
          },
        };
      }
      return base;
    });
  }, []);

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
                <input
                  suppressHydrationWarning
                  type="radio"
                  name="date-filter-mode"
                  checked={dateFilterMode === "all"}
                  onChange={() => setDateFilterMode("all")}
                  className="sr-only"
                />
                <span
                  className={cn(
                    "inline-flex h-5 items-center rounded px-2 text-[11px] font-medium transition-colors",
                    dateFilterMode === "all" ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200" : "text-slate-500 hover:text-slate-700"
                  )}
                >
                  All Dates
                </span>
              </label>
              <label className="cursor-pointer">
                <input
                  suppressHydrationWarning
                  type="radio"
                  name="date-filter-mode"
                  checked={dateFilterMode === "specific"}
                  onChange={() => setDateFilterMode("specific")}
                  className="sr-only"
                />
                <span
                  className={cn(
                    "inline-flex h-5 items-center rounded px-2 text-[11px] font-medium transition-colors",
                    dateFilterMode === "specific" ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200" : "text-slate-500 hover:text-slate-700"
                  )}
                >
                  By Date
                </span>
              </label>
            </div>
            {dateFilterMode === "specific" ? (
              <>
                <select
                  suppressHydrationWarning
                  className={`${inputClass} w-[120px]`}
                  value={dateFilterField}
                  onChange={(e) => setDateFilterField(e.target.value)}
                  aria-label="Select date filter field"
                >
                  {DATE_FILTER_OPTIONS.map((opt) => (
                    <option key={opt.key} value={opt.key}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <input
                  suppressHydrationWarning
                  className={`${inputClass} w-[140px]`}
                  type="date"
                  value={specificDate}
                  onChange={(e) => setSpecificDate(e.target.value)}
                  aria-label="Specific date"
                />
              </>
            ) : null}
          </div>
        </div>
        <StatusFilterBar
          label="Filter by Status"
          statuses={PACK_STATUSES}
          selectedStatuses={selectedStatuses}
          onSelectedStatusesChange={setSelectedStatuses}
        />
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
            onPersistedRowActivate={(row) => setSelectedId(row.id)}
            getRowClassName={({ row }) => {
              const ie = row.import_export ?? row.importExport;
              const rowClasses = [];
              if (ie === "Import") rowClasses.push("clutch-row-import");
              if (row.id === selectedId) rowClasses.push("clutch-row-selected");
              return rowClasses.join(" ") || undefined;
            }}
            getRowStyle={({ row }) => {
              const ie = row.import_export ?? row.importExport;
              if (row.id === selectedId) return { backgroundColor: "#dbeafe" };
              if (ie === "Import") return { backgroundColor: "#eff6ff" };
              return undefined;
            }}
            toolbarActions={
              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" size="sm" variant="secondary" disabled title="Calendar view coming soon" className="h-7 px-2.5 text-[11px]">
                  Schedule
                </Button>
                <Button type="button" size="sm" onClick={openAddPage} className="h-7 px-2.5 text-[11px]">
                  + Add Pack
                </Button>
                <Button type="button" size="sm" variant="secondary" disabled={!selected} className="h-7 px-2.5 text-[11px]" onClick={openEditPage}>
                  Edit
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  disabled={!selected}
                  className="h-7 px-2.5 text-[11px]"
                  onClick={async () => {
                    if (!selected) return;
                    if (!window.confirm(`Delete pack #${selected.id}? This cannot be undone.`)) return;
                    try {
                      await removePack(selected.id);
                      setSelectedId(null);
                      loadRows();
                    } catch (err) {
                      window.alert(err?.message || "Failed to delete pack.");
                    }
                  }}
                >
                  Delete
                </Button>
                <span className="ms-auto text-[11px] text-slate-500">
                  {loading ? "Loading…" : "View: All Orders"}
                </span>
              </div>
            }
          />
          {!loading && !filtered.length ? (
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
              <Field label="Customer" value={selected.customer?.name ?? selected.customer_name ?? selected.customer ?? ""} />
              <Field label="Commodity" value={selected.commodity?.description ?? selected.commodity_description ?? selected.commodity ?? ""} />
              <Field label="Import/Export" value={selected.import_export ?? selected.importExport ?? ""} />
              <Field label="Job Ref" value={selected.job_reference ?? selected.jobReference ?? ""} />
              <Field label="Vessel" value={selected.vessel_voyage?.vessel?.vessel_name ?? selected.vesselVoyage?.vessel?.vesselName ?? selected.vessel ?? ""} />
              <Field label="ETD" value={formatCutoffOrEtdDisplay(selected.etd ?? selected.vessel_voyage?.vessel_etd ?? "")} />
              <Field label="Cut-off" value={formatCutoffOrEtdDisplay(selected.vessel_cutoff_date ?? selected.vesselCutoffDate ?? selected.vessel_voyage?.vessel_cutoff_date ?? "")} />
              <Field label="Packing Start Date" value={formatCutoffOrEtdDisplay(selected.packing_start_date ?? selected.packingStartDate ?? "")} />
              <Field label="Empty park" value={emptyParkDisplay(selected)} />
              <Field label="Count" value={String(selected.containers_required ?? selected.containersRequired ?? "")} />
              <Field label="MT" value={selected.mt_total != null ? Number(selected.mt_total).toFixed(1) : selected.mtTotal?.toFixed(1)} />
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
      <div className="rounded border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] text-slate-700">{value ?? ""}</div>
    </div>
  );
}
