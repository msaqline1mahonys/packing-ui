"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import dayjs from "dayjs";

import { Grid } from "@/components/clutch-table";
import { StatusFilterBar } from "@/components/packing-schedule/status-filter-bar";
import { HistoryDrawer } from "@/components/audit/history-drawer";
import { Button } from "@/components/ui/button";
import CustomDateRangePicker from "@/components/ui/custom-date-range-picker";
import ClutchSelect from "@/components/custom/ClutchSelect";
import { PACK_STATUSES } from "@/lib/Data";
import { fetchPackRows } from "@/lib/pack-schedule-store";
import { acknowledgeVesselScheduleUpdate } from "@/lib/api/packing";
import { hasPendingVesselScheduleUpdate } from "@/lib/pack-vessel-sync";
import { usePolling } from "@/lib/use-polling";
import { totalNettWeight, countPackedContainers } from "@/lib/packers-container-validation";
import { countOnSiteContainers } from "@/lib/packers-work-store";
import { cn } from "@/lib/utils";

const inputClass =
  "h-7 rounded-md border border-slate-200 bg-white px-2 text-[11px] text-slate-800 outline-none ring-brand/15 focus:border-brand/35 focus:ring-2";
const TABLE_COLUMNS = [
  { key: "customer", label: "Customer" },
  { key: "commodity", label: "Commodity Grade" },
  { key: "blend", label: "Blend" },
  { key: "status", label: "Status" },
  { key: "vesselScheduleUpdate", label: "Sched." },
  { key: "packNumber", label: "Pack No." },
  { key: "jobReference", label: "Job Ref" },
  { key: "vessel", label: "Vessel" },
  { key: "etd", label: "ETD", date: true },
  { key: "vesselCutoffDate", label: "Cut-off" },
  { key: "emptyPark", label: "Empty park" },
  { key: "containersRequired", label: "Cnt", numeric: true },
  { key: "onSiteContainers", label: "On site", numeric: true },
  { key: "releaseContainers", label: "Rel. ctrs" },
  { key: "mtTotal", label: "MT", numeric: true },
  { key: "actualPacked", label: "Actual MT", numeric: true },
  { key: "containersPacked", label: "Packed", numeric: true },
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
  { key: "rfpCommodityCode", label: "RFP Commodity Grade Code", hidden: true },
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

const IE_FILTER_OPTIONS = [
  { value: "all", label: "All (Import/Export)" },
  { value: "Import", label: "Import" },
  { value: "Export", label: "Export" },
];

const DATE_FIELD_OPTIONS = DATE_FILTER_OPTIONS.map((opt) => ({ value: opt.key, label: opt.label }));

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

function formatMtDisplay(value) {
  if (value == null || value === "") return "";
  const n = Number(value);
  return Number.isFinite(n) ? n.toFixed(1) : String(value);
}

function parksFromRowReleases(row) {
  const items = [];
  const seenIds = new Set();
  for (const r of rowReleases(row)) {
    const nested = r.release ?? null;
    const parks = Array.isArray(r.parks)
      ? r.parks
      : Array.isArray(nested?.parks)
        ? nested.parks
        : [];
    if (parks.length) {
      for (const park of parks) {
        const id = String(
          park.container_park_id ??
            park.containerParkId ??
            park.container_park?.id ??
            park.containerPark?.id ??
            ""
        ).trim();
        const name =
          park.containerParkName ??
          park.container_park?.name ??
          park.containerPark?.name ??
          "";
        if (id && !seenIds.has(id)) {
          seenIds.add(id);
          items.push({ id, name: name || id });
        }
      }
      continue;
    }
    const legacyPark = r.empty_container_park ?? r.emptyContainerPark;
    const id = String(
      r.empty_container_park_id ?? r.emptyContainerParkId ?? legacyPark?.id ?? ""
    ).trim();
    const name = legacyPark?.name ?? "";
    if (id && !seenIds.has(id)) {
      seenIds.add(id);
      items.push({ id, name: name || id });
    } else if (name && !items.some((p) => p.name === name)) {
      items.push({ id: "", name });
    }
  }
  return items;
}

function containerCountsByPark(row) {
  const counts = new Map();
  for (const c of rowContainers(row)) {
    const num = String(c.container_number ?? c.containerNumber ?? "").trim();
    if (!num) continue;
    const parkId = String(c.empty_container_park_id ?? c.emptyContainerParkId ?? "").trim();
    if (!parkId) continue;
    counts.set(parkId, (counts.get(parkId) || 0) + 1);
  }
  return counts;
}

// Per empty-park container breakdown: [{ name, count }] for this pack.
function emptyParkBreakdown(row) {
  const counts = containerCountsByPark(row);
  const items = [];
  const seen = new Set();

  for (const park of parksFromRowReleases(row)) {
    if (park.id) {
      seen.add(park.id);
      items.push({ name: park.name, count: counts.get(park.id) || 0 });
    } else if (park.name) {
      items.push({ name: park.name, count: 0 });
    }
  }

  for (const c of rowContainers(row)) {
    const num = String(c.container_number ?? c.containerNumber ?? "").trim();
    if (!num) continue;
    const parkId = String(c.empty_container_park_id ?? c.emptyContainerParkId ?? "").trim();
    if (!parkId || seen.has(parkId)) continue;
    seen.add(parkId);
    const nested = c.empty_container_park ?? c.emptyContainerPark;
    const name =
      nested?.name ??
      c.emptyContainerParkName ??
      c.releasePark ??
      parkId;
    items.push({ name, count: counts.get(parkId) || 0 });
  }

  return items;
}

function emptyParkRaw(row) {
  const items = emptyParkBreakdown(row);
  if (items.length) {
    return items.map((item) => `${item.name} (${item.count})`).join(", ");
  }
  return parksFromRowReleases(row)
    .map((park) => park.name)
    .filter(Boolean)
    .join(", ");
}

function emptyParkDisplay(row) {
  return emptyParkRaw(row) || "";
}

function rowReleases(row) {
  return Array.isArray(row.releases) ? row.releases
    : Array.isArray(row.release_details) ? row.release_details
    : Array.isArray(row.releaseDetails) ? row.releaseDetails
    : [];
}

function rowContainers(row) {
  return Array.isArray(row.containers) ? row.containers : [];
}

// Blend status for the schedule: "" (not a blend), "Pending" (blend not yet
// performed), or "Done" (blend transfer posted).
function blendStatus(row) {
  if (!(row.is_blend ?? row.isBlend)) return "";
  return (row.blend_performed_at ?? row.blendPerformedAt) ? "Done" : "Pending";
}

// Count of filled containers (those with a container number) assigned to each release ref on
// the pack, keyed by upper-cased ref.
function containerCountsByRelease(row) {
  const counts = new Map();
  for (const c of rowContainers(row)) {
    const num = String(c.container_number ?? c.containerNumber ?? "").trim();
    if (!num) continue;
    const ref = String(c.release_number ?? c.releaseNumber ?? "").trim().toUpperCase();
    if (!ref) continue;
    counts.set(ref, (counts.get(ref) || 0) + 1);
  }
  return counts;
}

// Per-release container breakdown: [{ ref, count }] in release-line order (deduped by ref).
function releaseContainerBreakdown(row) {
  const counts = containerCountsByRelease(row);
  const seen = new Set();
  const items = [];
  for (const r of rowReleases(row)) {
    const ref = String(r.release_ref ?? r.releaseRef ?? r.release_number ?? r.releaseNumber ?? "").trim();
    if (!ref) continue;
    const key = ref.toUpperCase();
    if (seen.has(key)) continue;
    seen.add(key);
    items.push({ ref, count: counts.get(key) || 0 });
  }
  return items;
}

function releaseContainerTotal(row) {
  return releaseContainerBreakdown(row).reduce((sum, item) => sum + item.count, 0);
}

// How many containers are in the On Site stage (derived from on_site until packing starts).
function onSiteContainerCount(row) {
  const containers = rowContainers(row);
  const isImport = String(row.importExport ?? row.import_export ?? "").toLowerCase() === "import";
  return countOnSiteContainers(containers, isImport);
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
  const [historyOpen, setHistoryOpen] = useState(false);
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
      const params = {
        status: selectedStatuses.length > 0 ? selectedStatuses : PACK_STATUSES,
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

  // Live refresh: poll every 60s (paused when the tab is hidden or the history
  // drawer is open, so the underlying list doesn't churn while it's being read).
  usePolling(loadRows, { intervalMs: 60000, isBusy: () => historyOpen });

  const filtered = useMemo(() => {
    return rows.filter((p) => selectedStatuses.length === 0 || selectedStatuses.includes(p.status))
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
  const pendingVesselUpdateCount = useMemo(
    () => filtered.filter((row) => hasPendingVesselScheduleUpdate(row)).length,
    [filtered],
  );

  const acknowledgeSelectedVesselUpdate = useCallback(async () => {
    if (!selected || !hasPendingVesselScheduleUpdate(selected)) return;
    try {
      const result = await acknowledgeVesselScheduleUpdate(selected.id);
      setRows((prev) =>
        prev.map((row) =>
          row.id === selected.id
            ? {
                ...row,
                vessel_schedule_updated_at: result.vesselScheduleUpdatedAt,
                vesselScheduleUpdatedAt: result.vesselScheduleUpdatedAt,
                vessel_schedule_acknowledged_at: result.vesselScheduleAcknowledgedAt,
                vesselScheduleAcknowledgedAt: result.vesselScheduleAcknowledgedAt,
              }
            : row,
        ),
      );
    } catch (err) {
      window.alert(err?.message || "Failed to acknowledge vessel schedule update.");
    }
  }, [selected]);

  const dateRangeValue = useMemo(
    () => [dateFrom ? dayjs(dateFrom) : null, dateTo ? dayjs(dateTo) : null],
    [dateFrom, dateTo]
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
      if (column.key === "customer") {
        return { ...base, valueGetter: (row) => row.customer?.name ?? row.customer_name ?? row.customer ?? "" };
      }
      if (column.key === "commodity") {
        return { ...base, valueGetter: (row) => row.commodity?.description ?? row.commodity_description ?? row.commodity ?? "" };
      }
      if (column.key === "blend") {
        return {
          ...base,
          type: "text",
          width: 90,
          valueGetter: (row) => blendStatus(row),
          renderCell: ({ row }) => {
            const status = blendStatus(row);
            if (!status) return "";
            return status === "Pending" ? (
              <span
                title="Blend pack — blend transfer not yet performed"
                className="inline-flex items-center rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800"
              >
                Pending
              </span>
            ) : (
              <span
                title="Blend completed — commodity grade transfer posted"
                className="inline-flex items-center rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800"
              >
                Blended
              </span>
            );
          },
        };
      }
      if (column.key === "packNumber") {
        return { ...base, valueGetter: (row) => row.pack_number ?? row.packNumber ?? "" };
      }
      if (column.key === "jobReference") {
        return { ...base, valueGetter: (row) => row.job_reference ?? row.jobReference ?? "" };
      }
      if (column.key === "actualPacked") {
        return {
          ...base,
          type: "number",
          valueGetter: (row) => totalNettWeight(row.containers),
          renderCell: ({ row }) => {
            const v = totalNettWeight(row.containers);
            return v > 0 ? (
              <span className="tabular-nums" title="Total nett weight of all containers">
                {v.toLocaleString(undefined, { maximumFractionDigits: 1 })}
              </span>
            ) : (
              ""
            );
          },
        };
      }
      if (column.key === "containersPacked") {
        return {
          ...base,
          type: "number",
          valueGetter: (row) => countPackedContainers(row.containers),
          renderCell: ({ row }) => {
            const packed = countPackedContainers(row.containers);
            const required = Number(row.containers_required ?? row.containersRequired ?? 0) || 0;
            return (
              <span
                className="tabular-nums"
                title={`${packed} container${packed === 1 ? "" : "s"} completed with passed inspections${required ? ` of ${required} required` : ""}`}
              >
                {required ? `${packed}/${required}` : String(packed)}
              </span>
            );
          },
        };
      }
      if (column.key === "vesselScheduleUpdate") {
        return {
          ...base,
          type: "text",
          sortable: false,
          filterable: false,
          width: 56,
          valueGetter: (row) => (hasPendingVesselScheduleUpdate(row) ? "Updated" : ""),
          renderCell: ({ row, formattedValue }) =>
            formattedValue ? (
              <span
                title="Vessel schedule updated — ETD, cut-off, or terminal refreshed from latest schedule"
                className="inline-flex items-center rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800"
              >
                Updated
              </span>
            ) : (
              ""
            ),
        };
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
          renderCell: ({ row }) => {
            const items = emptyParkBreakdown(row);
            if (!items.length) return "";
            const full = items.map((item) => `${item.name}: ${item.count}`).join(" · ");
            return (
              <span className="inline-flex flex-wrap gap-1" title={full}>
                {items.map((item) => (
                  <span
                    key={item.name}
                    className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-slate-600"
                  >
                    {item.name}: {item.count}
                  </span>
                ))}
              </span>
            );
          },
        };
      }
      if (column.key === "onSiteContainers") {
        return {
          ...base,
          type: "number",
          valueGetter: (row) => onSiteContainerCount(row),
          renderCell: ({ row }) => {
            const required = Number(row.containers_required ?? row.containersRequired ?? 0) || 0;
            const onSite = onSiteContainerCount(row);
            return (
              <span
                className="tabular-nums"
                title={`${onSite} container${onSite === 1 ? "" : "s"} on site${required ? ` of ${required} required` : ""}`}
              >
                {required ? `${onSite}/${required}` : String(onSite)}
              </span>
            );
          },
        };
      }
      if (column.key === "releaseContainers") {
        return {
          ...base,
          type: "number",
          sortable: true,
          valueGetter: (row) => releaseContainerTotal(row),
          renderCell: ({ row }) => {
            const items = releaseContainerBreakdown(row);
            if (!items.length) return "";
            const full = items.map((i) => `${i.ref}: ${i.count}`).join(" · ");
            return (
              <span className="inline-flex flex-wrap gap-1" title={full}>
                {items.map((i) => (
                  <span
                    key={i.ref}
                    className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-slate-600"
                  >
                    {i.ref}: {i.count}
                  </span>
                ))}
              </span>
            );
          },
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

  const openEditForRow = useCallback((row) => {
    if (!row) return;
    if (hasPendingVesselScheduleUpdate(row)) {
      acknowledgeVesselScheduleUpdate(row.id)
        .then((result) => {
          setRows((prev) =>
            prev.map((r) =>
              r.id === row.id
                ? {
                    ...r,
                    vessel_schedule_updated_at: result.vesselScheduleUpdatedAt,
                    vesselScheduleUpdatedAt: result.vesselScheduleUpdatedAt,
                    vessel_schedule_acknowledged_at: result.vesselScheduleAcknowledgedAt,
                    vesselScheduleAcknowledgedAt: result.vesselScheduleAcknowledgedAt,
                  }
                : r,
            ),
          );
        })
        .catch(() => {});
    }
    router.push(`/packing-schedule/new-pack-form?mode=edit&id=${row.id}`);
  }, [router]);

  function openEditPage() {
    openEditForRow(selected);
  }

  return (
    <div className="space-y-4">
      <section className="w-full min-w-0 rounded-xl border border-slate-200/90 bg-white px-3 py-2.5 shadow-sm xl:min-w-[32rem]">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <h1 className="shrink-0 text-base font-semibold tracking-tight text-slate-900">Packing Schedule</h1>
          <div className="h-6 w-px shrink-0 bg-slate-200" aria-hidden="true" />
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
                    "inline-flex h-7 items-center rounded px-2 text-[11px] font-medium transition-colors",
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
                    "inline-flex h-7 items-center rounded px-2 text-[11px] font-medium transition-colors",
                    dateFilterMode === "specific" ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200" : "text-slate-500 hover:text-slate-700"
                  )}
                >
                  By Date
                </span>
              </label>
              <label className="cursor-pointer">
                <input
                  suppressHydrationWarning
                  type="radio"
                  name="date-filter-mode"
                  checked={dateFilterMode === "range"}
                  onChange={() => setDateFilterMode("range")}
                  className="sr-only"
                />
                <span
                  className={cn(
                    "inline-flex h-7 items-center rounded px-2 text-[11px] font-medium transition-colors",
                    dateFilterMode === "range" ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200" : "text-slate-500 hover:text-slate-700"
                  )}
                >
                  Date Range
                </span>
              </label>
            </div>
            {dateFilterMode === "specific" || dateFilterMode === "range" ? (
              <>
                <ClutchSelect
                  compact
                  className="w-[128px] shrink-0"
                  isClearable={false}
                  options={DATE_FIELD_OPTIONS}
                  value={DATE_FIELD_OPTIONS.find((o) => String(o.value) === String(dateFilterField)) ?? null}
                  onChange={(option) => setDateFilterField(option ? option.value : "vesselCutoffDate")}
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
          compact
          label="Filter by Status"
          statuses={PACK_STATUSES}
          selectedStatuses={selectedStatuses}
          onSelectedStatusesChange={setSelectedStatuses}
        />
      </section>

      <div className={cn("grid gap-6 xl:items-start", selected ? "xl:grid-cols-[minmax(0,1fr)_minmax(240px,320px)]" : "xl:grid-cols-1")}>
        <div ref={tableRef} className="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-sm">
          <Grid
            columns={gridColumns}
            rows={filtered}
            getRowId={(row) => row.id}
            theme="light"
            density="compact"
            fileName="Packing Schedule"
            visibleRows={17}
            onRowClick={(row) => setSelectedId((prev) => (prev === row.id ? null : row.id))}
            onRowDoubleClick={openEditForRow}
            onPersistedRowActivate={(row) => setSelectedId(row.id)}
            getRowClassName={({ row }) => {
              const ie = row.import_export ?? row.importExport;
              const rowClasses = [];
              if (ie === "Import") rowClasses.push("clutch-row-import");
              if (hasPendingVesselScheduleUpdate(row)) rowClasses.push("clutch-row-vessel-updated");
              if (row.id === selectedId) rowClasses.push("clutch-row-selected");
              return rowClasses.join(" ") || undefined;
            }}
            getRowStyle={({ row }) => {
              const ie = row.import_export ?? row.importExport;
              if (row.id === selectedId) return { backgroundColor: "#dbeafe" };
              if (hasPendingVesselScheduleUpdate(row)) return { backgroundColor: "#fffbeb" };
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
                <Button type="button" size="sm" variant="secondary" disabled={!selected} className="h-7 px-2.5 text-[11px]" onClick={() => setHistoryOpen(true)}>
                  History
                </Button>
                <span className="ms-auto text-[11px] text-slate-500">
                  {loading ? "Loading…" : pendingVesselUpdateCount > 0 ? `${pendingVesselUpdateCount} vessel update${pendingVesselUpdateCount === 1 ? "" : "s"} pending` : "View: All Orders"}
                </span>
              </div>
            }
          />
          {!loading && !filtered.length ? (
            <p className="border-t border-slate-100 px-3 py-8 text-center text-xs text-slate-400">No packs match the current filters.</p>
          ) : null}
        </div>

        {selected ? (
          <div ref={detailsRef} className="rounded-xl border border-slate-200/90 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-3 py-3">
              <h3 className="text-sm font-semibold text-slate-900">Pack Details</h3>
            </div>
            <div className="space-y-3 p-3 text-xs">
              {hasPendingVesselScheduleUpdate(selected) ? (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900">
                  <p className="text-[11px] leading-snug">
                    Vessel schedule updated. ETD, cut-off, and terminal on this pack were refreshed from the latest voyage schedule.
                  </p>
                  <Button type="button" size="sm" variant="secondary" className="h-7 px-2.5 text-[11px]" onClick={acknowledgeSelectedVesselUpdate}>
                    Dismiss
                  </Button>
                </div>
              ) : null}
              <Field label="Pack No." value={selected.pack_number ?? selected.packNumber ?? ""} />
              <Field label="Pack ID" value={String(selected.id)} />
              <Field label="Status" value={selected.status} />
              <Field label="Customer" value={selected.customer?.name ?? selected.customer_name ?? selected.customer ?? ""} />
              <Field label="Commodity Grade" value={selected.commodity?.description ?? selected.commodity_description ?? selected.commodity ?? ""} />
              <Field label="Import/Export" value={selected.import_export ?? selected.importExport ?? ""} />
              <Field label="Job Ref" value={selected.job_reference ?? selected.jobReference ?? ""} />
              <Field label="Vessel" value={selected.vessel_voyage?.vessel?.vessel_name ?? selected.vesselVoyage?.vessel?.vesselName ?? selected.vessel ?? ""} />
              <Field label="ETD" value={formatCutoffOrEtdDisplay(selected.etd ?? selected.vessel_voyage?.vessel_etd ?? "")} />
              <Field label="Cut-off" value={formatCutoffOrEtdDisplay(selected.vessel_cutoff_date ?? selected.vesselCutoffDate ?? selected.vessel_voyage?.vessel_cutoff_date ?? "")} />
              <Field label="Packing Start Date" value={formatCutoffOrEtdDisplay(selected.packing_start_date ?? selected.packingStartDate ?? "")} />
              <Field label="Empty park" value={emptyParkDisplay(selected)} />
              {emptyParkBreakdown(selected).length ? (
                <div className="space-y-0.5">
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                    Containers per empty park
                  </div>
                  <div className="space-y-1 rounded border border-slate-200 bg-slate-50 px-2 py-1.5">
                    {emptyParkBreakdown(selected).map((item) => (
                      <div key={item.name} className="flex items-center justify-between text-[11px] text-slate-700">
                        <span className="truncate pr-2">{item.name}</span>
                        <span className="shrink-0 tabular-nums font-medium">{item.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
              <Field label="Count" value={String(selected.containers_required ?? selected.containersRequired ?? "")} />
              <Field
                label="On site to pack"
                value={`${onSiteContainerCount(selected)}${
                  selected.containers_required ?? selected.containersRequired
                    ? ` / ${selected.containers_required ?? selected.containersRequired}`
                    : ""
                }`}
              />
              {releaseContainerBreakdown(selected).length ? (
                <div className="space-y-0.5">
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                    Containers per release
                  </div>
                  <div className="space-y-1 rounded border border-slate-200 bg-slate-50 px-2 py-1.5">
                    {releaseContainerBreakdown(selected).map((item) => (
                      <div key={item.ref} className="flex items-center justify-between text-[11px] text-slate-700">
                        <span className="truncate pr-2">{item.ref}</span>
                        <span className="shrink-0 tabular-nums font-medium">{item.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
              <Field label="MT" value={formatMtDisplay(selected.mt_total ?? selected.mtTotal)} />
              <Field
                label="Actual amount packed (MT)"
                value={(() => {
                  const v = totalNettWeight(selected.containers);
                  return v > 0 ? v.toLocaleString(undefined, { maximumFractionDigits: 1 }) : "";
                })()}
              />
              <Field
                label="Containers packed"
                value={(() => {
                  const packed = countPackedContainers(selected.containers);
                  const required = Number(selected.containers_required ?? selected.containersRequired ?? 0) || 0;
                  return required ? `${packed} / ${required}` : String(packed);
                })()}
              />
              {blendStatus(selected) ? (
                <Field
                  label="Blend"
                  value={blendStatus(selected) === "Pending" ? "Pending — blend not performed" : "Blended"}
                />
              ) : null}
            </div>
          </div>
        ) : null}
      </div>

      <HistoryDrawer
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        subjectType="pack"
        subjectId={selected?.id}
        title={selected ? `Pack ${selected.pack_number ?? selected.packNumber ?? selected.job_reference ?? selected.jobReference ?? selected.id}` : "History"}
      />
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
