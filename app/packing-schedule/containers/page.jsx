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
import { updateContainer } from "@/lib/api/packing";
import { getCompletionMissingChecks } from "@/lib/packers-container-validation";
import { canToggleOnSite, containerStage } from "@/lib/packers-work-store";
import {
  ACTIVE_PACK_STATUSES,
  CONTAINER_STAGE_OPTIONS,
  PACKERS_SCHEDULE_STATUSES,
  stageBadgeClass,
} from "@/lib/packing-container-ui";
import {
  buildContainerGridColumns,
  displayContainerStage,
  formatContainerWeight,
  formatCutoffOrEtdDisplay,
} from "@/lib/packing-containers-grid";
import { usePolling } from "@/lib/use-polling";
import { cn } from "@/lib/utils";

const inputClass =
  "h-7 rounded-md border border-slate-200 bg-white px-2 text-[11px] text-slate-800 outline-none ring-brand/15 focus:border-brand/35 focus:ring-2";

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
  const [savingOnSiteId, setSavingOnSiteId] = useState(null);
  const tableRef = useRef(null);
  const detailsRef = useRef(null);

  const toggleOnSite = useCallback(async (row) => {
    if (!row?.id || !row?.packId || savingOnSiteId) return;
    const stage = displayContainerStage(row);
    if (!canToggleOnSite(stage)) return;
    const next = !Boolean(row.onSite ?? row.on_site);
    setSavingOnSiteId(row.id);
    setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, onSite: next } : r)));
    try {
      await updateContainer(row.packId, row.id, { onSite: next });
    } catch (err) {
      setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, onSite: !next } : r)));
      window.alert(err?.message || "Failed to update on-site status.");
    } finally {
      setSavingOnSiteId(null);
    }
  }, [savingOnSiteId]);

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
      .filter((row) => {
        const isImport = String(row.importExport ?? "").toLowerCase() === "import";
        return containerStage(row, isImport) !== "Completed";
      })
      .filter((row) => {
        if (!selectedPackStatuses.length) return ACTIVE_PACK_STATUSES.includes(row.packStatus);
        return selectedPackStatuses.includes(row.packStatus);
      })
      .filter((row) => (importExportFilter === "all" ? true : row.importExport === importExportFilter))
      .filter((row) => {
        if (!selectedStages.length) return true;
        return selectedStages.includes(displayContainerStage(row));
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
    const counts = Object.fromEntries(CONTAINER_STAGE_OPTIONS.map((stage) => [stage, 0]));
    counts.total = filtered.length;
    for (const row of filtered) {
      const stage = displayContainerStage(row);
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
    return buildContainerGridColumns({
      onToggleOnSite: toggleOnSite,
      savingOnSiteId,
    });
  }, [toggleOnSite, savingOnSiteId]);

  const missingChecks = useMemo(
    () => (selected ? getCompletionMissingChecks(selected) : []),
    [selected],
  );

  return (
    <div className="w-full min-w-0 max-w-none space-y-3">
      <section className="rounded-xl border border-slate-200/90 bg-white px-4 py-3 shadow-sm">
        <p className="text-[11px] text-slate-600">
          <span className="font-semibold text-slate-800">Total: {summary.total}</span>
          {" · "}
          Pending: {summary.Pending}
          {" · "}
          Matched: {summary.Matched}
          {" · "}
          Available to pack: {summary["Available to Pack"]}
          {" · "}
          ECI failed: {summary["ECI Failed"]}
          {" · "}
          PRA: {summary["PRA Submitted"] + summary["PRA Passed"] + summary["PRA Failed"]}
          {" · "}
          Completed containers excluded
        </p>
      </section>

      <section className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Filters</p>
          <ClutchSelect
            compact
            className="w-[128px] shrink-0"
            isClearable={false}
            options={IE_FILTER_OPTIONS}
            value={IE_FILTER_OPTIONS.find((o) => String(o.value) === String(importExportFilter)) ?? null}
            onChange={(option) => setImportExportFilter(option ? option.value : "all")}
          />
          <div className="ms-auto flex min-w-0 flex-wrap items-center gap-2">
            <div className="inline-flex shrink-0 items-center gap-0.5 rounded-md border border-slate-200 bg-slate-50 p-0.5">
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
                      "inline-flex h-7 items-center rounded px-2 text-[11px] font-medium transition-colors",
                      dateFilterMode === mode ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200" : "text-slate-500 hover:text-slate-700",
                    )}
                  >
                    {mode === "all" ? "All Dates" : mode === "specific" ? "By Date" : "Date Range"}
                  </span>
                </label>
              ))}
            </div>
            {dateFilterMode === "specific" || dateFilterMode === "range" ? (
              <>
                <ClutchSelect
                  compact
                  className="w-[128px] shrink-0"
                  isClearable={false}
                  options={DATE_FIELD_OPTIONS}
                  value={DATE_FIELD_OPTIONS.find((o) => String(o.value) === String(dateFilterField)) ?? null}
                  onChange={(option) => setDateFilterField(option ? option.value : "packingStartDate")}
                  aria-label="Select date filter field"
                />
                {dateFilterMode === "specific" ? (
                  <input
                    suppressHydrationWarning
                    className={`${inputClass} w-[128px] shrink-0`}
                    type="date"
                    value={specificDate}
                    onChange={(e) => setSpecificDate(e.target.value)}
                    aria-label="Specific date"
                  />
                ) : (
                  <div className="w-[11rem] shrink-0">
                    <CustomDateRangePicker compact value={dateRangeValue} onChange={handleDateRangeChange} />
                  </div>
                )}
              </>
            ) : null}
          </div>
        </div>
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
                <span className={cn("ms-auto rounded-full px-2 py-0.5 text-[10px] font-semibold", stageBadgeClass(displayContainerStage(selected)))}>
                  {displayContainerStage(selected)}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                <Link
                  href={`/packing-schedule/new-pack-form?mode=edit&id=${selected.packId}`}
                  className="inline-flex h-7 items-center rounded-lg bg-secondary px-2.5 text-[11px] font-medium text-secondary-foreground hover:bg-secondary/80"
                >
                  Open pack
                </Link>
                {PACKERS_SCHEDULE_STATUSES.includes(selected.packStatus) ? (
                  <Link
                    href={`/packers-schedule/${selected.packId}`}
                    className="inline-flex h-7 items-center rounded-lg bg-secondary px-2.5 text-[11px] font-medium text-secondary-foreground hover:bg-secondary/80"
                  >
                    Open in Packers
                  </Link>
                ) : (
                  <span
                    title="Packers schedule only shows Pending, On Hold, and Inprogress packs"
                    className="inline-flex h-7 cursor-not-allowed items-center rounded-lg bg-secondary px-2.5 text-[11px] font-medium text-secondary-foreground opacity-50"
                  >
                    Open in Packers
                  </span>
                )}
              </div>
            </div>
            <div className="max-h-[calc(100vh-12rem)] space-y-4 overflow-auto p-3 text-xs">
              <SidebarSection title="Container">
                <Field label="Container #" value={selected.containerNumber || "Draft container"} />
                <Field label="Order" value={String(selected.order ?? "")} />
                <Field label="ISO Code" value={selected.containerIsoCode || selected.isoCode || ""} />
                <Field label="Seal" value={selected.sealNumber || ""} />
                {(() => {
                  const stage = displayContainerStage(selected);
                  const canToggle = canToggleOnSite(stage);
                  if (!canToggle) {
                    return <Field label="Stage" value={stage} />;
                  }
                  const onSite = Boolean(selected.onSite ?? selected.on_site);
                  return (
                    <div className="space-y-0.5">
                      <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Stage</div>
                      <button
                        type="button"
                        onClick={() => toggleOnSite(selected)}
                        disabled={savingOnSiteId === selected.id}
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors disabled:opacity-60",
                          stageBadgeClass(stage),
                        )}
                      >
                        {stage}
                        {" · "}
                        {onSite ? "On site — click to mark off site" : "Off site — click to mark on site"}
                      </button>
                    </div>
                  );
                })()}
              </SidebarSection>

              <SidebarSection title="Pack">
                <Field label="Pack No." value={selected.packNumber || ""} />
                <Field label="Job Ref" value={selected.jobReference || ""} />
                <Field label="Pack ID" value={String(selected.packId ?? "")} />
                <Field label="Pack Status" value={selected.packStatus || ""} />
                <Field label="Customer" value={selected.customerName || ""} />
                <Field label="Commodity Grade" value={selected.commodityName || ""} />
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
                <Field label="Tare MT" value={formatContainerWeight(selected.tare)} />
                <Field label="Gross MT" value={formatContainerWeight(selected.grossWeight)} />
                <Field label="Nett MT" value={formatContainerWeight(selected.nettWeight)} />
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
