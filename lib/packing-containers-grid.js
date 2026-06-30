import { canToggleOnSite, containerStage } from "@/lib/packers-work-store";
import { displayContainerStage as displayStoredContainerStage } from "@/lib/container-status";
import { stageBadgeClass } from "@/lib/packing-container-ui";
import { cn } from "@/lib/utils";

export const CONTAINER_TABLE_COLUMNS = [
  { key: "containerNumber", label: "Container #" },
  { key: "stage", label: "Stage" },
  { key: "replacesContainer", label: "Replaces" },
  { key: "packNumber", label: "Pack No." },
  { key: "jobReference", label: "Job Ref" },
  { key: "packId", label: "Pack ID" },
  { key: "customerName", label: "Customer" },
  { key: "commodityName", label: "Commodity Grade" },
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

export function formatCutoffOrEtdDisplay(value) {
  if (value == null || String(value).trim() === "") return "";
  const str = String(value).trim();
  if (str.includes("T")) {
    const [d, t] = str.split("T");
    const hm = (t || "").slice(0, 5);
    return hm ? `${d} ${hm}` : d;
  }
  return str;
}

export function displayContainerStage(row) {
  const isImport = String(row.importExport ?? row.import_export ?? "").toLowerCase() === "import";
  return displayStoredContainerStage(row, isImport, containerStage);
}

export function locationDisplay(row) {
  const grain = String(row.grainLocation || "").trim();
  const bay = String(row.stockBayId || "").trim();
  if (grain && bay) {
    if (grain === bay) return grain;
    return `${grain} · ${bay}`;
  }
  return grain || bay;
}

export function pemsDisplay(row) {
  const ecr = row.ecrSubmitted ? "ECR" : "No ECR";
  const gppir = row.gppirSubmitted ? "GPPIR" : "No GPPIR";
  return `${ecr} / ${gppir}`;
}

export function formatContainerWeight(value) {
  if (value == null || value === "") return "";
  const n = Number(value);
  return Number.isFinite(n) ? n.toFixed(3) : String(value);
}

export function hasCollectedContainerRow(container) {
  const number = String(container.containerNumber ?? container.containerNo ?? "").trim();
  if (number) return true;
  const release = String(container.releaseNumber ?? "").trim();
  const parkId = container.emptyContainerParkId ?? container.empty_container_park_id;
  const transporterId = container.transporterId ?? container.transporter_id;
  return Boolean(release && parkId && transporterId);
}

export function decoratePackScopedContainerRow(container, {
  pack = {},
  containerParkOptions = [],
  transporterOptions = [],
} = {}) {
  const parkId = container.emptyContainerParkId ?? container.empty_container_park_id;
  const transporterId = container.transporterId ?? container.transporter_id;
  const emptyContainerParkName =
    container.emptyContainerPark?.name ??
    (String(container.releasePark ?? container.emptyContainerParkName ?? "").trim() ||
      containerParkOptions.find((p) => String(p.id) === String(parkId))?.name ||
      "");
  const transporterName =
    container.transporterRecord?.name ??
    (String(container.transporter ?? container.transporterName ?? "").trim() ||
      transporterOptions.find((t) => String(t.id) === String(transporterId))?.name ||
      "");

  const actualContainerNumber = String(container.containerNumber ?? container.containerNo ?? "").trim();

  return {
    ...container,
    containerNumber: actualContainerNumber,
    containerNumberLabel:
      actualContainerNumber || (Number(container.order) > 0 ? `#${container.order}` : ""),
    emptyContainerParkName,
    transporterName,
    packId: pack.id ?? container.packId ?? null,
    packNumber: pack.packNumber ?? pack.pack_number ?? "",
    jobReference: pack.jobReference ?? pack.job_reference ?? "",
    packStatus: pack.status ?? pack.packStatus ?? "",
    customerName: pack.customerName ?? pack.customer?.name ?? "",
    commodityName: pack.commodityDescription ?? pack.commodityName ?? pack.commodity?.description ?? "",
    importExport: pack.importExport ?? pack.import_export ?? "",
    vessel: pack.vessel ?? "",
    etd: pack.etd ?? "",
    vesselCutoffDate: pack.vesselCutoffDate ?? pack.vessel_cutoff_date ?? "",
    packingStartDate: pack.packingStartDate ?? pack.packing_start_date ?? "",
  };
}

/**
 * Build Clutch Table column definitions for packing schedule containers.
 * @param {{ onToggleOnSite?: (row: object) => void, savingOnSiteId?: string|null }} options
 */
export function buildContainerGridColumns({
  onToggleOnSite = null,
  savingOnSiteId = null,
} = {}) {
  return CONTAINER_TABLE_COLUMNS.map((column) => {
    const base = {
      key: column.key,
      header: column.label,
      type: column.numeric ? "number" : column.date ? "date" : "text",
      sortable: true,
      filterable: true,
      resizable: true,
      hidden: column.hidden ?? false,
    };

    if (column.key === "replacesContainer") {
      return {
        ...base,
        valueGetter: (row) => row.replacesContainerNumber ?? "",
        renderCell: ({ row }) => {
          const num = String(row.replacesContainerNumber ?? "").trim();
          if (!num) return "";
          return <span className="text-[10px] text-slate-600">Replaces {num}</span>;
        },
      };
    }
    if (column.key === "stage") {
      return {
        ...base,
        sortable: true,
        valueGetter: (row) => displayContainerStage(row),
        renderCell: ({ row, formattedValue }) => {
          const stage = formattedValue || displayContainerStage(row);
          const toggleable = onToggleOnSite && canToggleOnSite(stage);
          if (!stage) return "";

          if (toggleable) {
            const onSite = Boolean(row.onSite ?? row.on_site);
            return (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleOnSite(row);
                }}
                disabled={savingOnSiteId === row.id}
                className={cn(
                  "inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold transition-colors disabled:opacity-60",
                  stageBadgeClass(stage),
                  "hover:opacity-80",
                )}
                title={onSite ? "On site — click to mark off site" : "Off site — click to mark on site"}
              >
                {stage}
              </button>
            );
          }

          return (
            <span
              className={cn(
                "inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold",
                stageBadgeClass(stage),
              )}
            >
              {stage}
            </span>
          );
        },
      };
    }
    if (column.key === "containerNumber") {
      return {
        ...base,
        valueGetter: (row) =>
          row.containerNumberLabel ?? row.containerNumber ?? row.containerNo ?? "",
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
        format: (v) => (v != null ? formatContainerWeight(v) : ""),
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
}
