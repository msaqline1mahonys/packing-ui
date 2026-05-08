"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { useNavDock, useSite } from "@/components/erp-navbar";
import { Button } from "@/components/ui/button";
import {
  COMMODITY_MASTER_ROWS,
  CUSTOMER_CONTACT_ROWS,
  DEFAULT_CONTAINER_SIZES,
  PACK_FORM_LOOKUPS,
  PACK_STATUSES,
  PACK_TEMPLATE,
  REFERENCE_COUNTRIES_ROWS,
  SAMPLE_STATUSES,
} from "@/lib/Data";
import { loadPackScheduleRows, nextPackId, savePackScheduleRows } from "@/lib/pack-schedule-store";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

const {
  shippingLines,
  containerParks,
  transporters,
  vesselScheduleCsvRows: vesselSchedule,
} = PACK_FORM_LOOKUPS;
const customerOptions = CUSTOMER_CONTACT_ROWS;
const commodityOptions = COMMODITY_MASTER_ROWS.filter((row) => row.status !== "Inactive");
const countryOptions = REFERENCE_COUNTRIES_ROWS.map((row) => row.countryName);
const SAMPLE_TYPES = ["Pre", "Post", "Supplementary"];
const DAFF_PERMISSION_OPTIONS = ["N/A", "Requested", "Not Requested", "Accepted", "Declined"];

const inputClass =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-brand/15 focus:border-brand/35 focus:ring-2";

const gridClass = "grid gap-4 sm:grid-cols-2 md:grid-cols-3";
const sectionClass = "rounded-xl border border-slate-200/95 bg-white p-5 shadow-sm";

/** Site & import + Sample collapsible strips — quiet tint, barely-there brand */
const accentDetailsClass =
  "group !mt-1.5 !mb-1.5 rounded-lg border border-slate-200/95 bg-gradient-to-br from-slate-50 via-sky-50/50 to-slate-50/90 px-2.5 py-1.5 shadow-sm open:border-slate-300/90 open:shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]";
const accentDetailsRule = "border-t border-slate-200/80";
const accentSummaryClass =
  "flex cursor-pointer list-none items-center justify-between gap-2 rounded px-0.5 py-0 text-[10px] font-semibold uppercase tracking-wide text-slate-600 outline-none hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-brand/25 [&::-webkit-details-marker]:hidden";
const accentChevronClass =
  "size-3 shrink-0 text-slate-400 transition-transform duration-200 ease-out group-open:rotate-180";

const blankPack = (siteId) => ({
  ...PACK_TEMPLATE,
  siteId,
  containerCode: "",
  releaseNumbers: [],
  collectFromIds: [],
  releaseIds: [],
  releaseDetails: [],
  emptyContainerParkIds: [],
  transporterIds: [],
  assignedPackerIds: [],
  importPermitFiles: [],
  additionalDeclarationFiles: [],
  rfpFiles: [],
  sampleLocations: [],
  sampleSentDates: [],
  sampleStatuses: [],
  sampleEntries: [],
  packingInstructionFiles: [],
});

function createSampleEntry() {
  return {
    type: "Pre",
    sampleLocation: "",
    sampleSentDate: "",
    status: SAMPLE_STATUSES[0] ?? "Pending",
    notes: "",
  };
}

function normalizeFileItems(items) {
  if (!Array.isArray(items)) return [];
  return items.map((item, index) => {
    if (typeof item === "string") {
      return {
        id: `legacy-${index}-${item}`,
        name: item,
        size: null,
        type: "",
        file: null,
      };
    }
    return {
      id: item?.id ?? `file-${index}-${item?.name ?? "unknown"}`,
      name: item?.name ?? "file",
      size: Number.isFinite(item?.size) ? item.size : null,
      type: item?.type ?? "",
      file: item?.file instanceof File ? item.file : null,
    };
  });
}

function toFileEntries(fileList) {
  return Array.from(fileList || []).map((file, index) => ({
    id: `${file.name}-${file.lastModified}-${index}`,
    name: file.name,
    size: file.size,
    type: file.type,
    file,
  }));
}

function formatBytes(size) {
  if (!Number.isFinite(size)) return "";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function rowToPack(row, siteId) {
  const matchedCommodity = commodityOptions.find((c) => c.description === row.commodity);
  const legacyReleaseNumbers = Array.isArray(row.releaseNumbers) ? row.releaseNumbers : [];
  const legacyCollectFrom = Array.isArray(row.collectFromIds) ? row.collectFromIds : [];
  const legacyTransporters = Array.isArray(row.transporterIds) ? row.transporterIds : [];
  const maxLegacyRows = Math.max(legacyReleaseNumbers.length, legacyCollectFrom.length, legacyTransporters.length);
  const legacyReleaseDetails =
    maxLegacyRows > 0
      ? Array.from({ length: maxLegacyRows }).map((_, index) => ({
          releaseRef: legacyReleaseNumbers[index] ?? "",
          emptyContainerParkId: legacyCollectFrom[index] ?? null,
          transporterId: legacyTransporters[index] ?? null,
        }))
      : [];
  return {
    ...blankPack(siteId),
    importExport: row.importExport || "Export",
    status: row.status || "Pending",
    customerId: customerOptions.find((c) => c.name === row.customer)?.id ?? "",
    exporter: customerOptions.find((c) => c.name === row.exporter)?.id ?? "",
    commodityId: matchedCommodity?.id ?? "",
    commodityTypeId: matchedCommodity?.commodityTypeId ?? "",
    jobReference: row.jobReference || "",
    containersRequired: row.containersRequired ?? "",
    mtTotal: row.mtTotal ?? "",
    containerCode: row.containerCode || "",
    releaseDetails: Array.isArray(row.releaseDetails) ? row.releaseDetails : legacyReleaseDetails,
    destinationCountry: row.destinationCountry || "",
    vesselDepartureId: null,
    vesselName: row.vessel || "",
    packingStartDate: row.packingStartDate || "",
    packConfirmed: Boolean(row.packConfirmed),
    voyageNumber: row.voyageNumber || "",
    lloydId: row.lloydId || "",
    vesselCutoffDate: row.vesselCutoffDate || "",
    etd: row.etd || "",
    fumigation: row.fumigation || "",
    daffPermission: row.daffPermission || "N/A",
    edn: row.edn || "",
    packWarningRequired: Boolean(row.packWarningRequired),
    packWarning: row.packWarning || "",
    jobNotes: row.jobNotes || "",
    date: row.date || new Date().toISOString().slice(0, 10),
    sampleEntries: Array.isArray(row.sampleEntries)
      ? row.sampleEntries
      : (row.sampleStatuses || []).map((status, index) => ({
          type: "Pre",
          sampleLocation: row.sampleLocations?.[index] || "",
          sampleSentDate: row.sampleSentDates?.[index] || "",
          status: status || SAMPLE_STATUSES[0] || "Pending",
          notes: "",
        })),
    importPermitFiles: normalizeFileItems(row.importPermitFiles),
    additionalDeclarationFiles: normalizeFileItems(row.additionalDeclarationFiles),
    rfpFiles: normalizeFileItems(row.rfpFiles),
    packingInstructionFiles: normalizeFileItems(row.packingInstructionFiles),
  };
}

function packToScheduleRow(pack, existingRow) {
  const customerName = customerOptions.find((c) => c.id === Number(pack.customerId))?.name || existingRow?.customer || "Unknown Customer";
  const commodityName = commodityOptions.find((c) => c.id === Number(pack.commodityId))?.description || existingRow?.commodity || "Unknown Commodity";
  const exporterName = customerOptions.find((c) => c.id === Number(pack.exporter))?.name || existingRow?.exporter || "-";
  const sampleEntries = Array.isArray(pack.sampleEntries) ? pack.sampleEntries : [];
  const releaseDetails = Array.isArray(pack.releaseDetails) ? pack.releaseDetails : [];
  return {
    id: existingRow?.id ?? 0,
    importExport: pack.importExport,
    customer: customerName,
    commodity: commodityName,
    status: pack.status,
    jobReference: pack.jobReference || "",
    containersRequired: pack.containersRequired === "" ? 0 : Number(pack.containersRequired),
    mtTotal: pack.mtTotal === "" || pack.mtTotal == null ? 0 : Number(pack.mtTotal),
    containerCode: pack.containerCode || "",
    releaseDetails,
    releaseNumbers: releaseDetails.map((row) => row.releaseRef).filter(Boolean),
    collectFromIds: releaseDetails.map((row) => row.emptyContainerParkId).filter(Boolean),
    transporterIds: releaseDetails.map((row) => row.transporterId).filter(Boolean),
    exporter: exporterName,
    destinationCountry: pack.destinationCountry || "",
    vessel: pack.vesselName || existingRow?.vessel || "",
    packingStartDate: pack.packingStartDate || "",
    packConfirmed: Boolean(pack.packConfirmed),
    voyageNumber: pack.voyageNumber || "",
    lloydId: pack.lloydId || "",
    vesselCutoffDate: pack.vesselCutoffDate || "",
    etd: pack.etd || "",
    fumigation: pack.fumigation || "",
    daffPermission: pack.daffPermission || "N/A",
    edn: pack.edn || "",
    packWarningRequired: Boolean(pack.packWarningRequired),
    packWarning: pack.packWarning || "",
    jobNotes: pack.jobNotes || "",
    date: pack.date || new Date().toISOString().slice(0, 10),
    sampleEntries,
    sampleLocations: sampleEntries.map((entry) => entry.sampleLocation).filter(Boolean),
    sampleSentDates: sampleEntries.map((entry) => entry.sampleSentDate).filter(Boolean),
    sampleStatuses: sampleEntries.map((entry) => entry.status).filter(Boolean),
      importPermitFiles: normalizeFileItems(pack.importPermitFiles),
      additionalDeclarationFiles: normalizeFileItems(pack.additionalDeclarationFiles),
      rfpFiles: normalizeFileItems(pack.rfpFiles),
      packingInstructionFiles: normalizeFileItems(pack.packingInstructionFiles),
  };
}

function FormRow({ label, labelClassName, children, className = "" }) {
  return (
    <div className={cn("space-y-1", className)}>
      <label className={cn("text-xs font-semibold uppercase tracking-wide text-slate-500", labelClassName)}>{label}</label>
      {children}
    </div>
  );
}

export default function NewPackFormPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { siteId: activeSiteId, site } = useSite();
  const { dock, verticalExpanded } = useNavDock();
  const mode = searchParams.get("mode") === "edit" ? "edit" : "add";
  const editId = Number(searchParams.get("id"));
  const currentSite = Number(activeSiteId) || 1;
  const [vesselDepartures, setVesselDepartures] = useState([]);
  const [pack, setPack] = useState(() => blankPack(currentSite));
  const [editingRow, setEditingRow] = useState(null);
  const [samplePanelOpen, setSamplePanelOpen] = useState(false);
  const userClosedSampleWhileRequiredRef = useRef(false);
  const prevSampleRequiredRef = useRef(undefined);

  const set = (key, val) => setPack((prev) => ({ ...prev, [key]: val }));
  function addFiles(key, files) {
    const nextEntries = toFileEntries(files);
    if (!nextEntries.length) return;
    setPack((prev) => {
      const current = normalizeFileItems(prev[key]);
      return { ...prev, [key]: [...current, ...nextEntries] };
    });
  }

  function removeFile(key, id) {
    setPack((prev) => ({ ...prev, [key]: normalizeFileItems(prev[key]).filter((item) => item.id !== id) }));
  }

  function openFile(item) {
    if (!(item?.file instanceof File)) return;
    const url = URL.createObjectURL(item.file);
    window.open(url, "_blank", "noopener,noreferrer");
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const selectedVessel = useMemo(() => {
    if (!pack.vesselDepartureId) return null;
    return vesselDepartures.find((v) => v.id === Number(pack.vesselDepartureId)) || null;
  }, [pack.vesselDepartureId, vesselDepartures]);
  const releaseRows = Array.isArray(pack.releaseDetails) ? pack.releaseDetails : [];
  const linkedContainersLeft = Math.max(0, Number(pack.containersRequired || 0) - releaseRows.length);

  const computedMtTotal = useMemo(() => {
    if (pack.containersRequired === "" || pack.quantityPerContainer === "") return null;
    const n = Number(pack.containersRequired);
    const q = Number(pack.quantityPerContainer);
    if (!Number.isFinite(n) || !Number.isFinite(q)) return null;
    return n * q;
  }, [pack.containersRequired, pack.quantityPerContainer]);

  const stickySummary = useMemo(() => {
    const customerName = customerOptions.find((c) => c.id === Number(pack.customerId))?.name;
    const commodityName = commodityOptions.find((c) => c.id === Number(pack.commodityId))?.description;
    const releaseLines = releaseRows
      .filter((row) => row.releaseRef || row.emptyContainerParkId || row.transporterId)
      .map((row) => {
        const parts = [];
        if (row.releaseRef) parts.push(row.releaseRef);
        const park = containerParks.find((p) => p.id === Number(row.emptyContainerParkId))?.name;
        if (park) parts.push(park);
        const tr = transporters.find((t) => t.id === Number(row.transporterId))?.name;
        if (tr) parts.push(tr);
        return parts.length ? parts.join(" · ") : null;
      })
      .filter(Boolean);

    return {
      customer: customerName || "—",
      jobRef: String(pack.jobReference || "").trim() || "—",
      commodity: commodityName || "—",
      fumigation: String(pack.fumigation || "").trim() || "—",
      packWarning:
        pack.packWarningRequired && String(pack.packWarning || "").trim()
          ? String(pack.packWarning).trim()
          : "—",
      releases: releaseLines.length ? releaseLines.join(" • ") : "—",
      containers:
        pack.containersRequired === "" || pack.containersRequired == null ? "—" : String(pack.containersRequired),
      containerCode: String(pack.containerCode || "").trim() || "—",
      mtTotal: computedMtTotal != null && Number.isFinite(computedMtTotal) ? String(computedMtTotal) : "—",
      vessel: selectedVessel?.vessel?.trim() || "—",
      etd: String(pack.etd || "").trim() || "—",
      transshipment: String(pack.transshipmentPort || "").trim() || "—",
      rfp: String(pack.rfp || "").trim() || "—",
      edn: String(pack.edn || "").trim() || "—",
    };
  }, [
    pack.customerId,
    pack.jobReference,
    pack.commodityId,
    pack.containersRequired,
    pack.containerCode,
    computedMtTotal,
    pack.fumigation,
    pack.packWarningRequired,
    pack.packWarning,
    pack.etd,
    pack.transshipmentPort,
    pack.rfp,
    pack.edn,
    pack.releaseDetails,
    pack.vesselDepartureId,
    selectedVessel,
  ]);

  useEffect(() => {
    if (mode !== "edit" || Number.isNaN(editId)) return;
    const rows = loadPackScheduleRows();
    const row = rows.find((r) => Number(r.id) === editId);
    if (!row) return;
    setEditingRow(row);
    setPack(rowToPack(row, currentSite));
  }, [mode, editId, currentSite]);

  useEffect(() => {
    if (mode !== "add") return;
    setPack((prev) => ({ ...prev, siteId: currentSite }));
  }, [currentSite, mode]);

  useEffect(() => {
    const prev = prevSampleRequiredRef.current;
    const now = pack.sampleRequired;
    if (prev !== undefined && !now && prev) {
      userClosedSampleWhileRequiredRef.current = false;
      setSamplePanelOpen(false);
    }
    if (now && prev !== true) {
      userClosedSampleWhileRequiredRef.current = false;
      setSamplePanelOpen(true);
    }
    prevSampleRequiredRef.current = now;
  }, [pack.sampleRequired]);

  useEffect(() => {
    if (!selectedVessel) return;
    setPack((prev) => {
      const nextVoyage = selectedVessel.voyageNumber || "";
      const nextCutoff = selectedVessel.vesselCutoffDate || "";
      const nextVesselName = selectedVessel.vessel || "";
      if (prev.voyageNumber === nextVoyage && prev.vesselCutoffDate === nextCutoff && prev.vesselName === nextVesselName) return prev;
      return { ...prev, vesselName: nextVesselName, voyageNumber: nextVoyage, vesselCutoffDate: nextCutoff };
    });
  }, [selectedVessel]);

  const sampleRowCount = (pack.sampleEntries || []).length;
  const handleSampleDetailsToggle = useCallback((e) => {
    const isOpen = e.currentTarget.open;
    setSamplePanelOpen(isOpen);
    if (pack.sampleRequired && !isOpen) {
      userClosedSampleWhileRequiredRef.current = true;
    }
  }, [pack.sampleRequired]);

  const save = () => {
    const normalized = {
      ...pack,
      customerId: pack.customerId ? Number(pack.customerId) : null,
      commodityId: pack.commodityId ? Number(pack.commodityId) : null,
      commodityTypeId: pack.commodityId
        ? commodityOptions.find((c) => c.id === Number(pack.commodityId))?.commodityTypeId ?? null
        : null,
      siteId: Number(pack.siteId || currentSite),
      containersRequired: pack.containersRequired === "" ? null : Number(pack.containersRequired),
      quantityPerContainer: pack.quantityPerContainer === "" ? null : Number(pack.quantityPerContainer),
      maxQtyPerContainer: pack.maxQtyPerContainer === "" ? null : Number(pack.maxQtyPerContainer),
      mtTotal: computedMtTotal != null && Number.isFinite(computedMtTotal) ? Number(computedMtTotal) : null,
      shippingLineId: pack.shippingLineId ? Number(pack.shippingLineId) : null,
      vesselDepartureId: pack.vesselDepartureId ? Number(pack.vesselDepartureId) : null,
      exporter: pack.exporter ? Number(pack.exporter) : null,
      sampleEntries: (pack.sampleEntries || [])
        .map((entry) => ({
          type: entry.type,
          sampleLocation: String(entry.sampleLocation || "").trim(),
          sampleSentDate: String(entry.sampleSentDate || "").trim(),
          status: entry.status,
          notes: String(entry.notes || "").trim(),
        }))
        .filter((entry) => entry.sampleLocation || entry.sampleSentDate || entry.status || entry.notes),
      importPermitFiles: normalizeFileItems(pack.importPermitFiles),
      additionalDeclarationFiles: normalizeFileItems(pack.additionalDeclarationFiles),
      rfpFiles: normalizeFileItems(pack.rfpFiles),
      packingInstructionFiles: normalizeFileItems(pack.packingInstructionFiles),
    };
    const rows = loadPackScheduleRows();
    if (mode === "edit" && editingRow) {
      const updated = packToScheduleRow(normalized, editingRow);
      savePackScheduleRows(rows.map((row) => (row.id === editingRow.id ? updated : row)));
    } else {
      const created = packToScheduleRow(normalized, null);
      created.id = nextPackId(rows);
      savePackScheduleRows([created, ...rows]);
    }
    router.push("/packing-schedule");
  };

  const summaryFields = [
    ["Cust", stickySummary.customer],
    ["Job", stickySummary.jobRef],
    ["Comm", stickySummary.commodity],
    ["Fumi", stickySummary.fumigation],
    ["Warn", stickySummary.packWarning],
    ["Rel", stickySummary.releases],
    ["Cnt", stickySummary.containers],
    ["ISO", stickySummary.containerCode],
    ["MT", stickySummary.mtTotal],
    ["Vsl", stickySummary.vessel],
    ["ETD", stickySummary.etd],
    ["Tship", stickySummary.transshipment],
    ["RFP", stickySummary.rfp],
    ["EDN", stickySummary.edn],
  ];
  const footerInsetClass =
    dock === "vertical-start"
      ? "start-14 end-0 md:start-[4.5rem]"
      : dock === "vertical-end"
        ? "start-0 end-14 md:end-[4.5rem]"
        : "inset-x-0";
  const footerBottomClass = dock === "horizontal-bottom" ? "bottom-11 md:bottom-[4.5rem]" : "bottom-0";

  return (
    <>
      <div className="mx-auto w-full max-w-[min(92rem,calc(100%-2rem))] space-y-3 px-5 pt-2 pb-[7.5rem] sm:px-6 sm:pt-3 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-xl font-semibold text-slate-900">{mode === "edit" ? `Edit Pack #${editingRow?.id ?? ""}` : "Add Pack"}</h1>
        </div>

      <section className={sectionClass} aria-label="Pack basics">
        <div className={gridClass}>
          <FormRow label="Pack type">
            <select className={inputClass} value={pack.packType} onChange={(e) => set("packType", e.target.value)}>
              <option value="container">Container</option>
              <option value="bulk">Bulk</option>
            </select>
          </FormRow>
          <FormRow label="Import / Export">
            <select className={inputClass} value={pack.importExport} onChange={(e) => set("importExport", e.target.value)}>
              <option value="Import">Import</option>
              <option value="Export">Export</option>
            </select>
          </FormRow>
          <FormRow label="Status">
            <select className={inputClass} value={pack.status} onChange={(e) => set("status", e.target.value)}>
              {PACK_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </FormRow>
        </div>
      </section>

      <details className={accentDetailsClass}>
        <summary className={accentSummaryClass}>
          <span>Site &amp; import</span>
          <ChevronDown className={accentChevronClass} aria-hidden />
        </summary>
        <div className={cn("mt-1.5 grid gap-2 pt-2 sm:grid-cols-2 md:grid-cols-3", accentDetailsRule)}>
          <FormRow label="Site">
            <input className={inputClass} value={site?.label || site?.name || `Site ${currentSite}`} readOnly disabled />
          </FormRow>
          {pack.packType === "bulk" ? (
            <FormRow label="Test required">
              <select className={inputClass} value={pack.testRequired ? "yes" : "no"} onChange={(e) => set("testRequired", e.target.value === "yes")}>
                <option value="no">No</option>
                <option value="yes">Yes</option>
              </select>
            </FormRow>
          ) : null}
          <FormRow label="Shrink taken (Import jobs)">
            <select className={inputClass} value={pack.shrinkTaken ? "yes" : "no"} onChange={(e) => set("shrinkTaken", e.target.value === "yes")}>
              <option value="no">No</option>
              <option value="yes">Yes</option>
            </select>
          </FormRow>
        </div>
      </details>

      <section className={cn(sectionClass, "!mt-2")} aria-label="Basic details">
        <div className={gridClass}>
          <FormRow label="Customer">
            <select className={inputClass} value={pack.customerId} onChange={(e) => set("customerId", e.target.value)}>
              <option value="">- Select -</option>
              {customerOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </FormRow>
          <FormRow label="Exporter">
            <select className={inputClass} value={pack.exporter} onChange={(e) => set("exporter", e.target.value)}>
              <option value="">- Select -</option>
              {customerOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </FormRow>
          <FormRow label="Commodity">
            <select
              className={inputClass}
              value={pack.commodityId}
              onChange={(e) => {
                const id = e.target.value;
                const row = id ? commodityOptions.find((c) => String(c.id) === id) : null;
                setPack((prev) => ({
                  ...prev,
                  commodityId: id,
                  commodityTypeId: row?.commodityTypeId != null ? String(row.commodityTypeId) : "",
                }));
              }}
            >
              <option value="">- Select -</option>
              {commodityOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.description}
                </option>
              ))}
            </select>
          </FormRow>
          <FormRow label="Job reference">
            <input className={inputClass} value={pack.jobReference} onChange={(e) => set("jobReference", e.target.value)} placeholder="Job reference" />
          </FormRow>
          <FormRow label="Packing start date">
            <input className={inputClass} type="date" value={pack.packingStartDate || ""} onChange={(e) => set("packingStartDate", e.target.value)} />
          </FormRow>
          <FormRow label="Pack confirmed">
            <select className={inputClass} value={pack.packConfirmed ? "yes" : "no"} onChange={(e) => set("packConfirmed", e.target.value === "yes")}>
              <option value="no">No</option>
              <option value="yes">Yes</option>
            </select>
          </FormRow>
          <FormRow label="Fumigation" className="sm:col-span-2 md:col-span-2">
            <input className={inputClass} value={pack.fumigation} onChange={(e) => set("fumigation", e.target.value)} placeholder="Fumigation details" />
          </FormRow>
          <FormRow label="Daff permission (fumigation)">
            <select className={inputClass} value={pack.daffPermission || "N/A"} onChange={(e) => set("daffPermission", e.target.value)}>
              {DAFF_PERMISSION_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </FormRow>
          <FormRow label="Pack warning" className="sm:col-span-2 md:col-span-3">
            <div className="flex flex-wrap items-center gap-4">
              <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                <input
                  type="radio"
                  name="pack-warning-required"
                  className="size-4 border-slate-300 text-brand accent-brand focus:ring-brand/30"
                  checked={!pack.packWarningRequired}
                  onChange={() =>
                    setPack((prev) => ({
                      ...prev,
                      packWarningRequired: false,
                      packWarning: "",
                    }))
                  }
                />
                No
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                <input
                  type="radio"
                  name="pack-warning-required"
                  className="size-4 border-slate-300 text-brand accent-brand focus:ring-brand/30"
                  checked={pack.packWarningRequired}
                  onChange={() => set("packWarningRequired", true)}
                />
                Yes
              </label>
            </div>
          </FormRow>
          {pack.packWarningRequired ? (
            <FormRow label="Pack warning details" className="sm:col-span-2 md:col-span-3">
              <textarea
                className={`${inputClass} min-h-[88px] resize-y`}
                value={pack.packWarning || ""}
                onChange={(e) => set("packWarning", e.target.value)}
                placeholder="Enter pack warning…"
              />
            </FormRow>
          ) : null}
        </div>
      </section>

      <details className={accentDetailsClass} open={samplePanelOpen} onToggle={handleSampleDetailsToggle}>
        <summary className={accentSummaryClass}>
          <span className="flex min-w-0 items-center gap-1.5">
            <span>Sample</span>
            {!samplePanelOpen && sampleRowCount > 0 ? (
              <span className="rounded-full bg-slate-200/90 px-1.5 py-0 text-[9px] font-semibold tabular-nums leading-none text-slate-700">
                {sampleRowCount}
              </span>
            ) : null}
          </span>
          <ChevronDown className={accentChevronClass} aria-hidden />
        </summary>
        <div className={cn("mt-1.5 space-y-3 pt-2", accentDetailsRule)}>
          <FormRow label="Sample required" labelClassName="normal-case tracking-normal text-[11px] font-semibold text-slate-700">
            <select
              className={inputClass}
              value={pack.sampleRequired ? "yes" : "no"}
              onChange={(e) => {
                const enabled = e.target.value === "yes";
                setPack((prev) => {
                  const nextEntries = Array.isArray(prev.sampleEntries) ? prev.sampleEntries : [];
                  return {
                    ...prev,
                    sampleRequired: enabled,
                    sampleEntries: enabled && nextEntries.length === 0 ? [createSampleEntry()] : nextEntries,
                  };
                });
              }}
            >
              <option value="no">No</option>
              <option value="yes">Yes</option>
            </select>
          </FormRow>
          {pack.sampleRequired ? (
            <div className="space-y-3">
              {(pack.sampleEntries || []).map((entry, index) => (
                <div
                  key={`sample-${index}`}
                  className="grid gap-2 md:grid-cols-[minmax(7rem,140px)_minmax(0,1fr)_minmax(8rem,170px)_minmax(8rem,170px)_minmax(0,1fr)_auto] md:items-end"
                >
                  <select
                    className={inputClass}
                    value={entry.type}
                    onChange={(e) => {
                      const next = [...(pack.sampleEntries || [])];
                      next[index] = { ...next[index], type: e.target.value };
                      set("sampleEntries", next);
                    }}
                  >
                    {SAMPLE_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                  <input
                    className={inputClass}
                    value={entry.sampleLocation}
                    onChange={(e) => {
                      const next = [...(pack.sampleEntries || [])];
                      next[index] = { ...next[index], sampleLocation: e.target.value };
                      set("sampleEntries", next);
                    }}
                    placeholder="Sample location"
                  />
                  <input
                    className={inputClass}
                    type="date"
                    value={entry.sampleSentDate}
                    onChange={(e) => {
                      const next = [...(pack.sampleEntries || [])];
                      next[index] = { ...next[index], sampleSentDate: e.target.value };
                      set("sampleEntries", next);
                    }}
                  />
                  <select
                    className={inputClass}
                    value={entry.status}
                    onChange={(e) => {
                      const next = [...(pack.sampleEntries || [])];
                      next[index] = { ...next[index], status: e.target.value };
                      set("sampleEntries", next);
                    }}
                  >
                    {SAMPLE_STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                  <input
                    className={inputClass}
                    value={entry.notes || ""}
                    onChange={(e) => {
                      const next = [...(pack.sampleEntries || [])];
                      next[index] = { ...next[index], notes: e.target.value };
                      set("sampleEntries", next);
                    }}
                    placeholder="Notes"
                  />
                  <Button
                    variant="destructive"
                    size="sm"
                    type="button"
                    onClick={() => {
                      const next = (pack.sampleEntries || []).filter((_, idx) => idx !== index);
                      set("sampleEntries", next);
                    }}
                  >
                    Remove
                  </Button>
                </div>
              ))}
              <Button
                variant="secondary"
                size="sm"
                type="button"
                onClick={() => {
                  const next = [...(pack.sampleEntries || []), createSampleEntry()];
                  set("sampleEntries", next);
                }}
              >
                + Add sample
              </Button>
            </div>
          ) : null}
        </div>
      </details>

      <section className={sectionClass}>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-700">Containers & quantity</h2>
        <div className="space-y-4 rounded-lg border border-slate-200 bg-slate-50/40 p-4">
          <div className="grid gap-3 md:grid-cols-[200px_180px_minmax(0,1fr)]">
            <FormRow label="Containers Required">
              <input className={inputClass} type="number" value={pack.containersRequired} onChange={(e) => set("containersRequired", e.target.value)} placeholder="0" />
            </FormRow>
            <FormRow label="Containers Left To Pack">
              <input className={inputClass} value={String(linkedContainersLeft)} readOnly disabled />
            </FormRow>
            <FormRow label="Container Code">
              <select className={inputClass} value={pack.containerCode || ""} onChange={(e) => set("containerCode", e.target.value)}>
                <option value="">Find items</option>
                {DEFAULT_CONTAINER_SIZES.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </FormRow>
          </div>

          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(5.75rem,7.25rem)] md:items-end">
            <FormRow
              label="Required tonnes per container"
              labelClassName="normal-case tracking-normal text-[11px] font-semibold leading-snug text-slate-600"
            >
              <input
                className={inputClass}
                type="number"
                value={pack.quantityPerContainer}
                onChange={(e) => set("quantityPerContainer", e.target.value)}
                placeholder="0"
              />
            </FormRow>
            <FormRow label="Max MT per container">
              <input
                className={inputClass}
                type="number"
                value={pack.maxQtyPerContainer}
                onChange={(e) => set("maxQtyPerContainer", e.target.value)}
                placeholder="0"
              />
            </FormRow>
            <FormRow label="MT total" className="md:max-w-[7.25rem]">
              <input
                className={`${inputClass} cursor-default bg-slate-50 text-slate-800 tabular-nums`}
                readOnly
                value={computedMtTotal != null && Number.isFinite(computedMtTotal) ? String(computedMtTotal) : ""}
                placeholder="—"
                title="Containers required × required tonnes per container"
              />
            </FormRow>
          </div>

          <div className="space-y-3 pt-1">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Release number <span className="font-normal normal-case text-slate-400">· Linked containers: {releaseRows.length}</span>
            </p>
            {(releaseRows.length ? releaseRows : [{ releaseRef: "", emptyContainerParkId: "", transporterId: "" }]).map((entry, index) => (
              <div key={`release-row-${index}`} className="grid gap-2 md:grid-cols-[1fr_1fr_1fr_auto]">
                <input
                  className={inputClass}
                  value={entry.releaseRef || ""}
                  onChange={(e) => {
                    const next = [...(releaseRows.length ? releaseRows : [{ releaseRef: "", emptyContainerParkId: "", transporterId: "" }])];
                    next[index] = { ...next[index], releaseRef: e.target.value };
                    set("releaseDetails", next);
                  }}
                  placeholder="Enter Release Number"
                />
                <select
                  className={inputClass}
                  value={entry.emptyContainerParkId ?? ""}
                  onChange={(e) => {
                    const next = [...(releaseRows.length ? releaseRows : [{ releaseRef: "", emptyContainerParkId: "", transporterId: "" }])];
                    next[index] = { ...next[index], emptyContainerParkId: e.target.value ? Number(e.target.value) : "" };
                    set("releaseDetails", next);
                  }}
                >
                  <option value="">Empty Container Park</option>
                  {containerParks.map((park) => (
                    <option key={park.id} value={park.id}>
                      {park.name}
                    </option>
                  ))}
                </select>
                <select
                  className={inputClass}
                  value={entry.transporterId ?? ""}
                  onChange={(e) => {
                    const next = [...(releaseRows.length ? releaseRows : [{ releaseRef: "", emptyContainerParkId: "", transporterId: "" }])];
                    next[index] = { ...next[index], transporterId: e.target.value ? Number(e.target.value) : "" };
                    set("releaseDetails", next);
                  }}
                >
                  <option value="">Select Transporter</option>
                  {transporters.map((transporter) => (
                    <option key={transporter.id} value={transporter.id}>
                      {transporter.name}
                    </option>
                  ))}
                </select>
                <Button
                  variant="destructive"
                  type="button"
                  onClick={() => {
                    const next = (releaseRows.length ? releaseRows : []).filter((_, idx) => idx !== index);
                    set("releaseDetails", next);
                  }}
                >
                  Remove
                </Button>
              </div>
            ))}

            <Button
              variant="secondary"
              size="sm"
              type="button"
              onClick={() =>
                set("releaseDetails", [
                  ...(releaseRows.length ? releaseRows : [{ releaseRef: "", emptyContainerParkId: "", transporterId: "" }]),
                  { releaseRef: "", emptyContainerParkId: "", transporterId: "" },
                ])
              }
            >
              Add Release
            </Button>
          </div>
        </div>
      </section>

      <section className={sectionClass}>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-700">Destination & shipping</h2>
        <div className={gridClass}>
          <FormRow label="Destination country">
            <select className={inputClass} value={pack.destinationCountry} onChange={(e) => set("destinationCountry", e.target.value)}>
              <option value="">- Select country -</option>
              {countryOptions.map((country) => (
                <option key={country} value={country}>
                  {country}
                </option>
              ))}
            </select>
          </FormRow>
          <FormRow label="Destination port">
            <input className={inputClass} value={pack.destinationPort} onChange={(e) => set("destinationPort", e.target.value)} placeholder="Port" />
          </FormRow>
          <FormRow label="Transshipment port">
            <input className={inputClass} value={pack.transshipmentPort} onChange={(e) => set("transshipmentPort", e.target.value)} placeholder="Port" />
          </FormRow>
          <FormRow label="Transshipment port code">
            <input className={inputClass} value={pack.transshipmentPortCode} onChange={(e) => set("transshipmentPortCode", e.target.value)} placeholder="Code" />
          </FormRow>
          <FormRow label="Shipping line">
            <select className={inputClass} value={pack.shippingLineId} onChange={(e) => set("shippingLineId", e.target.value)}>
              <option value="">- Select -</option>
              {shippingLines.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name} ({l.code})
                </option>
              ))}
            </select>
          </FormRow>
          <FormRow label="Vessel departure">
            <select
              className={inputClass}
              value={pack.vesselDepartureId ?? ""}
              onChange={(e) => {
                const nextId = e.target.value ? Number(e.target.value) : null;
                const nextVessel = nextId ? vesselDepartures.find((vd) => vd.id === nextId) : null;
                setPack((prev) => ({
                  ...prev,
                  vesselDepartureId: nextId,
                  vesselName: nextVessel?.vessel || "",
                  voyageNumber: nextVessel?.voyageNumber || "",
                  vesselCutoffDate: nextVessel?.vesselCutoffDate || "",
                }));
              }}
            >
              <option value="">- Select vessel -</option>
              {vesselDepartures.map((vd) => (
                <option key={vd.id} value={vd.id}>
                  {vd.vessel} {vd.voyageNumber ? `(${vd.voyageNumber})` : ""}
                  {vd.vesselCutoffDate ? ` - Cut-off ${vd.vesselCutoffDate}` : ""}
                </option>
              ))}
            </select>
          </FormRow>
          <FormRow label="Voyage number">
            <input className={inputClass} value={pack.voyageNumber || ""} onChange={(e) => set("voyageNumber", e.target.value)} placeholder="Voyage number" />
          </FormRow>
          <FormRow label="Lloyd ID">
            <input className={inputClass} value={pack.lloydId || ""} onChange={(e) => set("lloydId", e.target.value)} placeholder="Lloyd ID" />
          </FormRow>
          <FormRow label="Add from CSV schedule">
            <select
              className={inputClass}
              value=""
              onChange={(e) => {
                const idx = e.target.value;
                if (idx === "") return;
                const row = vesselSchedule[Number(idx)];
                if (!row) return;
                const key = `${(row.shipName || "").trim()}|${(row.voyageOut || "").trim()}`;
                const existing = vesselDepartures.find((v) => `${v.vessel}|${v.voyageNumber}` === key);
                if (existing) {
                  set("vesselDepartureId", existing.id);
                } else {
                  const id = Date.now();
                  const newDeparture = {
                    id,
                    vessel: row.shipName?.trim() || "",
                    voyageNumber: row.voyageOut || "",
                    vesselCutoffDate: row.cargoCutoffDate || "",
                  };
                  setVesselDepartures((prev) => [...prev, newDeparture]);
                  set("vesselDepartureId", id);
                }
                e.target.value = "";
              }}
            >
              <option value="">- Import from uploaded CSV -</option>
              {vesselSchedule.map((row, idx) => (
                <option key={idx} value={idx}>
                  {row.shipName} {row.voyageOut ? `(${row.voyageOut})` : ""} - Cut-off {row.cargoCutoffDate || "-"}
                </option>
              ))}
            </select>
          </FormRow>
          <FormRow label="Cut-off">
            <input className={inputClass} type="date" value={pack.vesselCutoffDate || ""} onChange={(e) => set("vesselCutoffDate", e.target.value)} />
          </FormRow>
          <FormRow label="ETD">
            <input className={inputClass} type="date" value={pack.etd || ""} onChange={(e) => set("etd", e.target.value)} />
          </FormRow>
          {selectedVessel ? (
            <div className="rounded-md bg-slate-50 p-3 text-sm text-slate-600 sm:col-span-2 md:col-span-3">
              <span className="font-semibold text-slate-800">Vessel schedule: </span>
              {selectedVessel.vessel} {selectedVessel.voyageNumber ? `(${selectedVessel.voyageNumber})` : ""}
              {selectedVessel.vesselCutoffDate ? ` · Cut-off: ${selectedVessel.vesselCutoffDate}` : ""}
            </div>
          ) : null}
        </div>
      </section>

      <section className={sectionClass}>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-700">Import permit</h2>
        <div className={gridClass}>
          <FormRow label="Import permit required">
            <select
              className={inputClass}
              value={pack.importPermitRequired ? "yes" : "no"}
              onChange={(e) => set("importPermitRequired", e.target.value === "yes")}
            >
              <option value="no">No</option>
              <option value="yes">Yes</option>
            </select>
          </FormRow>
          <FormRow label="Import permit number">
            <input className={inputClass} value={pack.importPermitNumber} onChange={(e) => set("importPermitNumber", e.target.value)} placeholder="Number" />
          </FormRow>
          <FormRow label="Import permit date">
            <input className={inputClass} type="date" value={pack.importPermitDate} onChange={(e) => set("importPermitDate", e.target.value)} />
          </FormRow>
        </div>
        <FormRow label="Import permit file(s)" className="mt-4">
          <input
            className={inputClass}
            type="file"
            multiple
            onChange={(e) => {
              addFiles("importPermitFiles", e.target.files);
              e.target.value = "";
            }}
          />
          <FileList items={normalizeFileItems(pack.importPermitFiles)} onOpen={openFile} onRemove={(id) => removeFile("importPermitFiles", id)} />
        </FormRow>
      </section>

      <section className={sectionClass}>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-700">RFP</h2>
        <div className={gridClass}>
          <FormRow label="RFP">
            <input className={inputClass} value={pack.rfp} onChange={(e) => set("rfp", e.target.value)} placeholder="RFP reference" />
          </FormRow>
          <FormRow label="EDN">
            <input className={inputClass} value={pack.edn || ""} onChange={(e) => set("edn", e.target.value)} placeholder="EDN reference" />
          </FormRow>
          <FormRow label="RFP additional declaration required">
            <select
              className={inputClass}
              value={pack.rfpAdditionalDeclarationRequired ? "yes" : "no"}
              onChange={(e) => set("rfpAdditionalDeclarationRequired", e.target.value === "yes")}
            >
              <option value="no">No</option>
              <option value="yes">Yes</option>
            </select>
          </FormRow>
          <FormRow label="RFP comment">
            <input className={inputClass} value={pack.rfpComment} onChange={(e) => set("rfpComment", e.target.value)} placeholder="Comment" />
          </FormRow>
          <FormRow label="RFP expiry">
            <input className={inputClass} type="date" value={pack.rfpExpiry} onChange={(e) => set("rfpExpiry", e.target.value)} />
          </FormRow>
          <FormRow label="RFP commodity code">
            <input className={inputClass} value={pack.rfpCommodityCode} onChange={(e) => set("rfpCommodityCode", e.target.value)} placeholder="Code" />
          </FormRow>
        </div>
        <FormRow label="RFP file(s)" className="mt-4">
          <input
            className={inputClass}
            type="file"
            multiple
            onChange={(e) => {
              addFiles("rfpFiles", e.target.files);
              e.target.value = "";
            }}
          />
          <FileList items={normalizeFileItems(pack.rfpFiles)} onOpen={openFile} onRemove={(id) => removeFile("rfpFiles", id)} />
        </FormRow>
        <FormRow label="Additional declaration file(s)" className="mt-4">
          <input
            className={inputClass}
            type="file"
            multiple
            onChange={(e) => {
              addFiles("additionalDeclarationFiles", e.target.files);
              e.target.value = "";
            }}
          />
          <FileList
            items={normalizeFileItems(pack.additionalDeclarationFiles)}
            onOpen={openFile}
            onRemove={(id) => removeFile("additionalDeclarationFiles", id)}
          />
        </FormRow>
      </section>

      <section className={sectionClass}>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-700">Packing & notes</h2>
        <FormRow label="Packing instruction file(s)">
          <input
            className={inputClass}
            type="file"
            multiple
            onChange={(e) => {
              addFiles("packingInstructionFiles", e.target.files);
              e.target.value = "";
            }}
          />
          <FileList
            items={normalizeFileItems(pack.packingInstructionFiles)}
            onOpen={openFile}
            onRemove={(id) => removeFile("packingInstructionFiles", id)}
          />
        </FormRow>
        <FormRow label="Job notes" className="mt-4">
          <textarea className={`${inputClass} min-h-[92px] resize-y`} value={pack.jobNotes} onChange={(e) => set("jobNotes", e.target.value)} placeholder="Notes..." />
        </FormRow>
      </section>
      </div>

      <footer
        className={`fixed z-40 border-t-2 border-slate-300/90 bg-slate-100/95 shadow-[0_-10px_26px_rgba(15,23,42,0.12)] backdrop-blur-md supports-[backdrop-filter]:bg-slate-100/85 ${footerInsetClass} ${footerBottomClass}`}
      >
        <div className="flex w-full flex-col gap-2.5 px-5 py-2.5 sm:flex-row sm:items-end sm:justify-between sm:gap-4 sm:px-6 sm:py-3">
          <div className="min-w-0 flex-1">
            <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-slate-400">Pack summary</p>
            <dl className="flex flex-nowrap gap-x-3 overflow-x-auto whitespace-nowrap text-[11px] leading-snug text-slate-600 sm:text-xs">
              {summaryFields.map(([label, value]) => (
                <div key={label} className="flex max-w-full shrink-0 items-baseline gap-1 border-l border-slate-200/90 pl-2 first:border-l-0 first:pl-0">
                  <dt className="shrink-0 font-medium text-slate-400">{label}</dt>
                  <dd className="min-w-0 truncate sm:max-w-[11rem]" title={value}>
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="flex shrink-0 items-center justify-end gap-2 border-t border-slate-100 pt-2 sm:border-t-0 sm:pt-0">
            <Button variant="outline" size="sm" type="button" onClick={() => router.push("/packing-schedule")}>
              Cancel
            </Button>
            <Button size="sm" type="button" onClick={save}>
              {mode === "edit" ? "Save changes" : "Create pack"}
            </Button>
          </div>
        </div>
      </footer>
    </>
  );
}

function FileList({ items, onOpen, onRemove }) {
  if (!items.length) return <p className="mt-2 text-xs text-slate-400">No files added.</p>;
  return (
    <div className="mt-2 space-y-1.5">
      {items.map((item) => (
        <div key={item.id} className="flex flex-wrap items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs">
          <span className="font-medium text-slate-700">{item.name}</span>
          <span className="text-slate-500">{formatBytes(item.size)}</span>
          {item.file ? (
            <button type="button" className="text-blue-600 hover:text-blue-700" onClick={() => onOpen(item)}>
              Open
            </button>
          ) : (
            <span className="text-slate-400">Stored name only</span>
          )}
          <button type="button" className="text-rose-600 hover:text-rose-700" onClick={() => onRemove(item.id)}>
            Remove
          </button>
        </div>
      ))}
    </div>
  );
}
