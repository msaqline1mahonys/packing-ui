"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import dayjs from "dayjs";

import { Grid } from "@/components/clutch-table";
import { StatusFilterBar } from "@/components/packing-schedule/status-filter-bar";
import { Button } from "@/components/ui/button";
import CustomDateRangePicker from "@/components/ui/custom-date-range-picker";
import ClutchSelect from "@/components/custom/ClutchSelect";
import { PACK_STATUSES } from "@/lib/Data";
import { fetchContainerRows } from "@/lib/pack-schedule-store";
import { getCompletionMissingChecks } from "@/lib/packers-container-validation";
import { containerStage } from "@/lib/packers-work-store";
import {
  ACTIVE_PACK_STATUSES,
  CONTAINER_STAGE_OPTIONS,
  stageBadgeClass,
} from "@/lib/packing-container-ui";
import { usePolling } from "@/lib/use-polling";
import { cn } from "@/lib/utils";

const inputClass =
  "h-7 rounded-md border border-slate-200 bg-white px-2 text-[11px] text-slate-800 outline-none ring-brand/15 focus:border-brand/35 focus:ring-2";

const config = {
  title: "Containers",
  subtitle: "Cross-pack visibility for containers currently in the packing pipeline.",
};

const TABLE_COLUMNS = [
  { key: "containerNumber", label: "Container #" },
  { key: "stage", label: "Stage" },
  { key: "packNumber", label: "Pack No." },
  { key: "jobReference", label: "Job Ref" },
  { key: "packId", label: "Pack ID" },
  { key: "customerName", label: "Customer" },
  { key: "commodityName", label: "Commodity" },
  { key: "importExport", label: "I/E" },
  { key: "order", label: "Order", numeric: true },
  { key: "releaseNumber", label: "Release" },
  { key: "emptyPark", label: "Empty park" },
  { key: "transporterName", label: "Transporter" },
  { key: "location", label: "Location" },
  { key: "packer", label: "Packer" },
  { key: "emptyInspection", label: "Empty insp." },
  { key: "grainInspection", label: "Grain insp." },
  { key: "praLastStatus", label: "PRA" },
  { key: "pems", label: "ECR / GPPIR" },
  { key: "outLoaded", label: "Out loaded" },
  { key: "nettWeight", label: "Nett MT", numeric: true },
  { key: "startDate", label: "Start date", date: true },
  { key: "sealNumber", label: "Seal", hidden: true },
  { key: "containerIsoCode", label: "ISO Code", hidden: true },
  { key: "packStatus", label: "Pack status", hidden: true },
  { key: "vessel", label: "Vessel", hidden: true },
  { key: "etd", label: "ETD", date: true, hidden: true },
  { key: "vesselCutoffDate", label: "Cut-off", hidden: true },
  { key: "packerSignoff", label: "Packer signoff", hidden: true },
  { key: "aoSignoff", label: "AO signoff", hidden: true },
  { key: "praLastError", label: "PRA error", hidden: true },
  { key: "packerNotes", label: "Packer notes", hidden: true },
];

const DATE_FILTER_OPTIONS = [
  { key: "packingStartDate", label: "Packing Start Date", apiField: "packing_start_date" },
  { key: "etd", label: "ETD", apiField: "etd" },
  { key: "vesselCutoffDate", label: "Cut-off", apiField: "vessel_cutoff_date" },
];

const DATE_FIELD_OPTIONS = DATE_FILTER_OPTIONS.map((opt) => ({ value: opt.key, label: opt.label }));

const IE_FILTER_OPTIONS = [
  { value: "all", label: "All (Import/Export)" },
  { value: "Import", label: "Import" },
  { value: "Export", label: "Export" },
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

function displayStage(row) {
  const stage = containerStage(row);
  if (stage === "Packing" && String(row.status || "").toLowerCase() === "draft") return "Draft";
  return stage;
}

function locationDisplay(row) {
  const grain = String(row.grainLocation || "").trim();
  const bay = String(row.stockBayId || "").trim();
  if (grain && bay) {
    if (grain === bay) return grain;
    return `${grain} · ${bay}`;
  }
  return grain || bay;
}

function pemsDisplay(row) {
  const ecr = row.ecrSubmitted ? "ECR" : "No ECR";
  const gppir = row.gppirSubmitted ? "GPPIR" : "No GPPIR";
  return `${ecr} / ${gppir}`;
}

function formatWeight(value) {
  if (value == null || value === "") return "";
  const n = Number(value);
  return Number.isFinite(n) ? n.toFixed(3) : String(value);
}

export default function PackingScheduleContainersPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [importExportFilter, setImportExportFilter] = useState("all");
  const [dateFilterField, setDateFilterField] = useState("packingStartDate");
  const [dateFilterMode, setDateFilterMode] = useState("all");
  const [specificDate, setSpecificDate] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedPackStatuses, setSelectedPackStatuses] = useState(() => [...ACTIVE_PACK_STATUSES]);
  const [selectedStages, setSelectedStages] = useState(() => [...CONTAINER_STAGE_OPTIONS]);
  const [selectedId, setSelectedId] = useState(null);
  const tableRef = useRef(null);
  const detailsRef = useRef(null);

  useEffect(() => {
    if (selectedId == null) return;

    function onPointerDown(event) {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (tableRef.current?.contains(target)) return;
      if (detailsRef.current?.contains(target)) return;
      if (
        target instanceof Element &&
        target.closest(".MuiPopover-root, .MuiModal-root, .MuiMenu-root, .MuiPopper-root, .MuiDialog-root")
      ) {
        return;
      }
      setSelectedId(null);
    }

    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [selectedId]);

  const loadRows = useCallback(async () => {
    setLoading(true);
    try {
      const dateApiField =
        DATE_FILTER_OPTIONS.find((opt) => opt.key === dateFilterField)?.apiField ?? "packing_start_date";
      const params = {
        packStatus: selectedPackStatuses.length ? selectedPackStatuses : ACTIVE_PACK_STATUSES,
        importExport: importExportFilter,
        ...(dateFilterMode === "specific" && specificDate ? { dateField: dateApiField, on: specificDate } : {}),
        ...(dateFilterMode === "range" ? { dateField: dateApiField, from: dateFrom, to: dateTo } : {}),
        perPage: 500,
      };
      const { rows: fetched } = await fetchContainerRows(params);
      setRows(Array.isArray(fetched) ? fetched : []);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [selectedPackStatuses, importExportFilter, dateFilterMode, dateFilterField, specificDate, dateFrom, dateTo]);

  useEffect(() => {
    loadRows();
  }, [loadRows]);

  usePolling(loadRows, { intervalMs: 60000 });

  const filtered = useMemo(() => {
    return rows
      .filter((row) => containerStage(row) !== "Complete")
      .filter((row) => {
        if (!selectedPackStatuses.length) return ACTIVE_PACK_STATUSES.includes(row.packStatus);
        return selectedPackStatuses.includes(row.packStatus);
      })
      .filter((row) => (importExportFilter === "all" ? true : row.importExport === importExportFilter))
      .filter((row) => {
        if (!selectedStages.length) return true;
        return selectedStages.includes(displayStage(row));
      })
      .filter((row) => {
        if (dateFilterMode === "all") return true;
        const fieldMap = {
          packingStartDate: row.packingStartDate,
          etd: row.etd,
          vesselCutoffDate: row.vesselCutoffDate,
        };
        const rowDate = getDateOnlyValue(fieldMap[dateFilterField]);
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
  }, [
    rows,
    importExportFilter,
    selectedPackStatuses,
    selectedStages,
    dateFilterMode,
    dateFilterField,
    specificDate,
    dateFrom,
    dateTo,
  ]);

  const selected = useMemo(
    () => filtered.find((row) => row.id === selectedId) || null,
    [filtered, selectedId],
  );

  const summary = useMemo(() => {
    const counts = { total: filtered.length, Draft: 0, Packing: 0, "PRA Submitted": 0, "PRA Passed": 0, "PRA Failed": 0 };
    for (const row of filtered) {
      const stage = displayStage(row);
      if (counts[stage] != null) counts[stage] += 1;
    }
    return counts;
  }, [filtered]);

  const dateRangeValue = useMemo(
    () => [dateFrom ? dayjs(dateFrom) : null, dateTo ? dayjs(dateTo) : null],
    [dateFrom, dateTo],
  );

  const handleDateRangeChange = useCallback(([start, end]) => {
    setDateFrom(start && start.isValid() ? start.format("YYYY-MM-DD") : "");
    setDateTo(end && end.isValid() ? end.format("YYYY-MM-DD") : "");
  }, []);

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

      if (column.key === "stage") {
        return {
          ...base,
          sortable: true,
          valueGetter: (row) => displayStage(row),
          renderCell: ({ formattedValue }) =>
            formattedValue ? (
              <span className={cn("inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold", stageBadgeClass(formattedValue))}>
                {formattedValue}
              </span>
            ) : (
              ""
            ),
        };
      }
      if (column.key === "containerNumber") {
        return {
          ...base,
          valueGetter: (row) => row.containerNumber || row.containerNo || "",
        };
      }
      if (column.key === "emptyPark") {
        return { ...base, valueGetter: (row) => row.emptyContainerParkName || row.releasePark || "" };
      }
      if (column.key === "location") {
        return { ...base, valueGetter: (row) => locationDisplay(row) };
      }
      if (column.key === "pems") {
        return {
          ...base,
          valueGetter: (row) => pemsDisplay(row),
          renderCell: ({ row }) => (
            <span className="text-[10px] text-slate-600">
              <span className={row.ecrSubmitted ? "font-semibold text-emerald-700" : "text-slate-400"}>
                {row.ecrSubmitted ? "ECR" : "No ECR"}
              </span>
              {" · "}
              <span className={row.gppirSubmitted ? "font-semibold text-emerald-700" : "text-slate-400"}>
                {row.gppirSubmitted ? "GPPIR" : "No GPPIR"}
              </span>
            </span>
          ),
        };
      }
      if (column.key === "startDate") {
        return {
          ...base,
          type: "date",
          valueGetter: (row) => row.startDate ?? "",
          format: formatCutoffOrEtdDisplay,
        };
      }
      if (column.key === "etd") {
        return {
          ...base,
          type: "date",
          valueGetter: (row) => row.etd ?? "",
          format: formatCutoffOrEtdDisplay,
        };
      }
      if (column.key === "vesselCutoffDate") {
        return {
          ...base,
          valueGetter: (row) => row.vesselCutoffDate ?? "",
          format: formatCutoffOrEtdDisplay,
        };
      }
      if (column.key === "nettWeight") {
        return {
          ...base,
          valueGetter: (row) => (row.nettWeight != null ? Number(row.nettWeight) : null),
          format: (v) => (v != null ? formatWeight(v) : ""),
        };
      }

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

  const missingChecks = useMemo(
    () => (selected ? getCompletionMissingChecks(selected) : []),
    [selected],
  );

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs text-slate-500">Operations / Packing Schedule / {config.title}</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 md:text-[1.65rem]">{config.title}</h1>
        <p className="mt-1 text-xs text-slate-500">{config.subtitle}</p>
      </div>

      <section className="rounded-xl border border-slate-200/90 bg-white px-4 py-3 shadow-sm">
        <p className="text-[11px] text-slate-600">
          <span className="font-semibold text-slate-800">Total: {summary.total}</span>
          {" · "}
          Draft: {summary.Draft}
          {" · "}
          Packing: {summary.Packing}
          {" · "}
          PRA: {summary["PRA Submitted"] + summary["PRA Passed"] + summary["PRA Failed"]}
          {" · "}
          Complete containers excluded
        </p>
      </section>

      <section className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Filters</p>
          <ClutchSelect
            className="w-[160px]"
            isClearable={false}
            options={IE_FILTER_OPTIONS}
            value={IE_FILTER_OPTIONS.find((o) => String(o.value) === String(importExportFilter)) ?? null}
            onChange={(option) => setImportExportFilter(option ? option.value : "all")}
          />
          <div className="ms-auto flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 p-1">
              {["all", "specific", "range"].map((mode) => (
                <label key={mode} className="cursor-pointer">
                  <input
                    suppressHydrationWarning
                    type="radio"
                    name="date-filter-mode"
                    checked={dateFilterMode === mode}
                    onChange={() => setDateFilterMode(mode)}
                    className="sr-only"
                  />
                  <span
                    className={cn(
                      "inline-flex h-5 items-center rounded px-2 text-[11px] font-medium transition-colors",
                      dateFilterMode === mode ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200" : "text-slate-500 hover:text-slate-700",
                    )}
                  >
                    {mode === "all" ? "All Dates" : mode === "specific" ? "By Date" : "Date Range"}
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>
        {dateFilterMode === "specific" || dateFilterMode === "range" ? (
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              {dateFilterMode === "range" ? "Filter by Date Range" : "Filter by Date"}
            </span>
            <ClutchSelect
              className="w-[150px]"
              isClearable={false}
              options={DATE_FIELD_OPTIONS}
              value={DATE_FIELD_OPTIONS.find((o) => String(o.value) === String(dateFilterField)) ?? null}
              onChange={(option) => setDateFilterField(option ? option.value : "packingStartDate")}
              aria-label="Select date filter field"
            />
            {dateFilterMode === "specific" ? (
              <input
                suppressHydrationWarning
                className={`${inputClass} w-[160px]`}
                type="date"
                value={specificDate}
                onChange={(e) => setSpecificDate(e.target.value)}
                aria-label="Specific date"
              />
            ) : (
              <div className="w-72">
                <CustomDateRangePicker value={dateRangeValue} onChange={handleDateRangeChange} />
              </div>
            )}
          </div>
        ) : null}
        <StatusFilterBar
          label="Filter by Pack Status"
          statuses={PACK_STATUSES.filter((s) => ACTIVE_PACK_STATUSES.includes(s) || s === "Completed" || s === "Invoiced")}
          selectedStatuses={selectedPackStatuses}
          onSelectedStatusesChange={setSelectedPackStatuses}
        />
        <StatusFilterBar
          label="Filter by Container Stage"
          statuses={CONTAINER_STAGE_OPTIONS}
          selectedStatuses={selectedStages}
          onSelectedStatusesChange={setSelectedStages}
        />
      </section>

      <div className={cn("grid gap-6 xl:items-start", selected ? "xl:grid-cols-[minmax(0,1fr)_minmax(260px,340px)]" : "xl:grid-cols-1")}>
        <div ref={tableRef} className="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-sm">
          <Grid
            columns={gridColumns}
            rows={filtered}
            getRowId={(row) => row.id}
            theme="light"
            density="standard"
            fileName="Packing Schedule Containers"
            visibleRows={14}
            onRowClick={(row) => setSelectedId((prev) => (prev === row.id ? null : row.id))}
            onPersistedRowActivate={(row) => setSelectedId(row.id)}
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
                <Button type="button" size="sm" variant="secondary" className="h-7 px-2.5 text-[11px]" onClick={loadRows}>
                  Refresh
                </Button>
                <span className="ms-auto text-[11px] text-slate-500">
                  {loading ? "Loading…" : `${filtered.length} container${filtered.length === 1 ? "" : "s"}`}
                </span>
              </div>
            }
          />
          {!loading && !filtered.length ? (
            <p className="border-t border-slate-100 px-3 py-8 text-center text-xs text-slate-400">No containers match the current filters.</p>
          ) : null}
        </div>

        {selected ? (
          <div ref={detailsRef} className="rounded-xl border border-slate-200/90 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-3 py-3">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-slate-900">Container Details</h3>
                <span className={cn("ms-auto rounded-full px-2 py-0.5 text-[10px] font-semibold", stageBadgeClass(displayStage(selected)))}>
                  {displayStage(selected)}
                </span>
              </div>
            </div>
            <div className="max-h-[calc(100vh-12rem)] space-y-4 overflow-auto p-3 text-xs">
              <SidebarSection title="Container">
                <Field label="Container #" value={selected.containerNumber || "Draft container"} />
                <Field label="Order" value={String(selected.order ?? "")} />
                <Field label="ISO Code" value={selected.containerIsoCode || selected.isoCode || ""} />
                <Field label="Seal" value={selected.sealNumber || ""} />
              </SidebarSection>

              <SidebarSection title="Pack">
                <Field label="Pack No." value={selected.packNumber || ""} />
                <Field label="Job Ref" value={selected.jobReference || ""} />
                <Field label="Pack ID" value={String(selected.packId ?? "")} />
                <Field label="Pack Status" value={selected.packStatus || ""} />
                <Field label="Customer" value={selected.customerName || ""} />
                <Field label="Commodity" value={selected.commodityName || ""} />
                <Field label="Import/Export" value={selected.importExport || ""} />
                <Field label="Vessel" value={selected.vessel || ""} />
                <Field label="ETD" value={formatCutoffOrEtdDisplay(selected.etd)} />
                <Field label="Cut-off" value={formatCutoffOrEtdDisplay(selected.vesselCutoffDate)} />
              </SidebarSection>

              <SidebarSection title="Release & Pickup">
                <Field label="Release" value={selected.releaseNumber || ""} />
                <Field label="Empty park" value={selected.emptyContainerParkName || selected.releasePark || ""} />
                <Field label="Transporter" value={selected.transporterName || selected.transporter || ""} />
              </SidebarSection>

              <SidebarSection title="Packing Location">
                <Field label="Grain location" value={selected.grainLocation || ""} />
                <Field label="Stock / Bay" value={selected.stockBayId || ""} />
                <Field label="Packer" value={selected.packer || ""} />
                <Field
                  label="Start"
                  value={[formatCutoffOrEtdDisplay(selected.startDate), selected.startHour, selected.startMinute].filter(Boolean).join(" ")}
                />
              </SidebarSection>

              <SidebarSection title="Weights">
                <Field label="Tare MT" value={formatWeight(selected.tare)} />
                <Field label="Gross MT" value={formatWeight(selected.grossWeight)} />
                <Field label="Nett MT" value={formatWeight(selected.nettWeight)} />
              </SidebarSection>

              <SidebarSection title="Checks">
                <Field label="Empty inspection" value={selected.emptyInspection || ""} />
                <Field label="Grain inspection" value={selected.grainInspection || ""} />
                <Field label="AO signoff" value={selected.aoSignoff || ""} />
                <Field label="Out loaded" value={selected.outLoaded || ""} />
                <Field label="Packer signoff" value={selected.packerSignoff || ""} />
                {missingChecks.length ? (
                  <p className="rounded border border-amber-200 bg-amber-50 px-2 py-1.5 text-[11px] text-amber-900">
                    Missing for complete: {missingChecks.join(", ")}
                  </p>
                ) : null}
              </SidebarSection>

              <SidebarSection title="PRA / PEMs">
                <Field label="PRA status" value={selected.praLastStatus || ""} />
                <Field label="PRA last error" value={selected.praLastError || ""} />
                <Field label="ECR submitted" value={selected.ecrSubmitted ? "Yes" : "No"} />
                <Field label="ECR submitted at" value={formatCutoffOrEtdDisplay(selected.ecrLastSubmittedAt)} />
                <Field label="GPPIR submitted" value={selected.gppirSubmitted ? "Yes" : "No"} />
                <Field label="GPPIR submitted at" value={formatCutoffOrEtdDisplay(selected.gppirLastSubmittedAt)} />
              </SidebarSection>

              <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                <Link
                  href={`/packing-schedule/new-pack-form?mode=edit&id=${selected.packId}`}
                  className="inline-flex h-7 items-center rounded-lg bg-secondary px-2.5 text-[11px] font-medium text-secondary-foreground hover:bg-secondary/80"
                >
                  Open pack
                </Link>
                {selected.packStatus === "Inprogress" ? (
                  <Link
                    href={`/packers-schedule/${selected.packId}`}
                    className="inline-flex h-7 items-center rounded-lg bg-secondary px-2.5 text-[11px] font-medium text-secondary-foreground hover:bg-secondary/80"
                  >
                    Open in Packers
                  </Link>
                ) : (
                  <span
                    title="Packers schedule only shows Inprogress packs"
                    className="inline-flex h-7 cursor-not-allowed items-center rounded-lg bg-secondary px-2.5 text-[11px] font-medium text-secondary-foreground opacity-50"
                  >
                    Open in Packers
                  </span>
                )}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function SidebarSection({ title, children }) {
  return (
    <div className="space-y-2">
      <h4 className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{title}</h4>
      <div className="space-y-2">{children}</div>
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
