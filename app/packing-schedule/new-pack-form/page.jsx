"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { useNavDock, useSite } from "@/components/erp-navbar";
import { createPraActionHandlers } from "@/components/pems/container-form-actions";
import ContainerFormSections from "@/components/pems/container-form-sections";
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
import {
  loadCertificateTemplates,
  loadFumigants,
  loadMethodologies,
  loadRecordTemplates,
} from "@/lib/fumigation-store";
import { loadContactUsers } from "@/lib/contact-users-store";
import { loadPackScheduleRows, nextPackId, savePackScheduleRows } from "@/lib/pack-schedule-store";
import { resolvePackRfpRef } from "@/lib/pems-rfp-display";
import { attachPemsSubmissionSnapshot, openPemsSubmissionDocument } from "@/lib/pems-staging-snapshot";
import {
  CONTAINER_INSPECTION_REMARK_FIELD,
  containerInspectionRemarkPatch,
  getContainerInspectionRemark,
} from "@/lib/pems-container-fields";
import { readSiteRows } from "@/lib/site-data";
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
const PACK_FUMIGATION_APPLICATION_METHOD = ["in-container", "bulk"];
const PACK_FUMIGATION_APPLICATION_LABELS = {
  "in-container": "In-container",
  bulk: "Bulk",
};
const PACK_FUMIGATION_DOSAGE_UNITS = ["ppm", "g/m3", "mg/L", "%"];
const PACK_FUMIGATION_MASS_UNITS = ["g", "kg"];
const FUMIGATION_MIN_EXPOSURE_UNITS = ["hours", "days"];
const ISO_BY_CONTAINER_CODE = {
  "20FT": "22G1",
  "40FT": "42G1",
  HC40: "45G1",
};
const PEMS_RECORD_OPTIONS = ["Empty Container Inspection Record", "Grain and Plant Product Inspection Record"];
const ECR_RECORD_TYPE = "Empty Container Inspection Record";
const GPPIR_RECORD_TYPE = "Grain and Plant Product Inspection Record";
const INSPECTION_OPTIONS = ["Pending", "Passed", "Failed"];
const YES_NO_OPTIONS = ["No", "Yes"];
const PRA_STATUS_OPTIONS = ["Pending", "Accepted", "Rejected", "Error"];
const PRA_TEMPLATE_OPTIONS = ["Original", "Resubmit", "Correction"];

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

function safeValue(value) {
  if (value == null || String(value).trim() === "") return "—";
  return String(value);
}

function formatDateTimeValue(value) {
  if (value == null || String(value).trim() === "") return "—";
  const str = String(value).trim();
  if (!str.includes("T")) return str;
  const [datePart, timePart] = str.split("T");
  const hhmm = (timePart || "").slice(0, 5);
  return hhmm ? `${datePart} ${hhmm}` : datePart;
}

function formatDateTimeInput(value) {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  const hours = String(parsed.getHours()).padStart(2, "0");
  const minutes = String(parsed.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function formatDateDisplay(value) {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  const day = String(parsed.getDate()).padStart(2, "0");
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const year = parsed.getFullYear();
  return `${day}/${month}/${year}`;
}

function addDaysToDate(value, days) {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  parsed.setDate(parsed.getDate() + days);
  return parsed.toISOString();
}

function defaultPemsDraft() {
  return {
    recordType: ECR_RECORD_TYPE,
    inspectionStart: "",
    inspectionEnd: "",
    aoSignoff: "",
    aoNumber: "",
    ecrComments: "N/A",
    stagedContainerIds: [],
  };
}

function toRoundedNumber(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

function blankFumigationDetail() {
  return {
    applicationMethod: "in-container",
    enclosureDescription: "",
    volumeM3: "",
    actualTonnage: "",
    minForecastedTemperature: "",
    minAmbientTemperature: "",
    actualTemperature: "",
    dosageValue: "",
    dosageUnit: "ppm",
    calculatedDosageValue: "",
    calculatedDosageUnit: "g",
    specificDosageRateValue: "",
    specificDosageRateUnit: "ppm",
    actualDosageAppliedValue: "",
    actualDosageAppliedUnit: "g",
    exposureTimeValue: "",
    exposureTimeUnit: "hours",
    dosingFinishAt: "",
    fumigationStartAt: "",
    fumigationEndAt: "",
    clearanceValue: "",
    fumigatorName: "",
    fumigationNotes: "",
  };
}

function defaultIsoForContainerCode(containerCode) {
  return ISO_BY_CONTAINER_CODE[String(containerCode || "").toUpperCase()] || "";
}

function createDraftContainer(pack, index, existing = {}) {
  const order = index + 1;
  return {
    id: existing.id || `container-${order}`,
    packId: existing.packId ?? pack.id ?? null,
    order,
    containerNumber: existing.containerNumber ?? existing.containerNo ?? "",
    containerCode: existing.containerCode ?? pack.containerCode ?? "",
    containerIsoCode:
      existing.containerIsoCode ??
      existing.isoCode ??
      defaultIsoForContainerCode(existing.containerCode ?? pack.containerCode),
    sealNumber: existing.sealNumber ?? existing.sealNo ?? "",
    releaseNumber: existing.releaseNumber ?? "",
    releasePark: existing.releasePark ?? "",
    transporter: existing.transporter ?? "",
    emptyContainerParkId: existing.emptyContainerParkId ?? "",
    transporterId: existing.transporterId ?? "",
    startDate: existing.startDate ?? pack.packingStartDate ?? "",
    startHour: existing.startHour ?? "",
    startMinute: existing.startMinute ?? "",
    grainLocation: existing.grainLocation ?? "",
    stockBayId: existing.stockBayId ?? "",
    tare: existing.tare ?? "",
    grossWeight: existing.grossWeight ?? "",
    nettWeight: existing.nettWeight ?? "",
    containerTareWeight: existing.containerTareWeight ?? "",
    emptyInspection: existing.emptyInspection ?? "Pending",
    grainInspection: existing.grainInspection ?? "Pending",
    packerSignoff: existing.packerSignoff ?? "",
    outLoaded: existing.outLoaded ?? "No",
    praSignoff: existing.praSignoff ?? "",
    praTemplate: existing.praTemplate ?? PRA_TEMPLATE_OPTIONS[0],
    praSubmitted: Boolean(existing.praSubmitted),
    praLastStatus: existing.praLastStatus ?? "Pending",
    praLastSubmittedTime: existing.praLastSubmittedTime ?? "",
    praLastError: existing.praLastError ?? "",
    aoSignoff: existing.aoSignoff ?? "",
    [CONTAINER_INSPECTION_REMARK_FIELD]: existing[CONTAINER_INSPECTION_REMARK_FIELD] ?? existing.aoInspectionRemark ?? "",
    ecrSubmitted: Boolean(existing.ecrSubmitted),
    ecrLastSubmittedAt: existing.ecrLastSubmittedAt ?? "",
    ecrLastBatchId: existing.ecrLastBatchId ?? "",
    gppirSubmitted: Boolean(existing.gppirSubmitted),
    gppirLastSubmittedAt: existing.gppirLastSubmittedAt ?? "",
    gppirLastBatchId: existing.gppirLastBatchId ?? "",
    status: existing.status || "Draft",
  };
}

function buildPackContainers(pack, existingRow) {
  const requiredCount = Math.max(Number(pack.containersRequired || 0), 0);
  const existingContainers = Array.isArray(pack.containers)
    ? pack.containers
    : Array.isArray(existingRow?.containers)
      ? existingRow.containers
      : [];
  return Array.from({ length: requiredCount }, (_, index) =>
    createDraftContainer(pack, index, existingContainers[index] || {})
  );
}

const blankPack = (siteId) => ({
  ...PACK_TEMPLATE,
  siteId,
  certificateTemplateId: null,
  recordTemplateId: null,
  containers: [],
  fumigationDetail: {
    ...blankFumigationDetail(),
    ...(PACK_TEMPLATE.fumigationDetail || {}),
  },
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
  pemsDraft: defaultPemsDraft(),
  pemsSubmissions: [],
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
      url: typeof item?.url === "string" ? item.url : undefined,
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
  const detail =
    row.fumigationDetail && typeof row.fumigationDetail === "object"
      ? { ...blankFumigationDetail(), ...row.fumigationDetail }
      : blankFumigationDetail();
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
    fumigationRequired: Boolean(row.fumigationRequired),
    fumigantId: row.fumigantId ?? null,
    methodologyId: row.methodologyId ?? null,
    certificateTemplateId: row.certificateTemplateId ?? null,
    recordTemplateId: row.recordTemplateId ?? null,
    containers: buildPackContainers(row, row),
    fumigationDetail: detail,
    daffPermission: row.daffPermission || "N/A",
    edn: row.edn || "",
    importPermitRequired: Boolean(row.importPermitRequired),
    importPermitNumber: row.importPermitNumber || "",
    importPermitDate: row.importPermitDate || "",
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
    rfp: row.rfp || "",
    rfpFiles: normalizeFileItems(row.rfpFiles),
    rfpAdditionalDeclarationRequired: Boolean(row.rfpAdditionalDeclarationRequired),
    packingInstructionFiles: normalizeFileItems(row.packingInstructionFiles),
    pemsDraft: { ...defaultPemsDraft(), ...(row.pemsDraft || {}) },
    pemsSubmissions: Array.isArray(row.pemsSubmissions) ? row.pemsSubmissions : [],
  };
}

function packToScheduleRow(pack, existingRow) {
  const customerName = customerOptions.find((c) => c.id === Number(pack.customerId))?.name || existingRow?.customer || "Unknown Customer";
  const commodityName = commodityOptions.find((c) => c.id === Number(pack.commodityId))?.description || existingRow?.commodity || "Unknown Commodity";
  const exporterName = customerOptions.find((c) => c.id === Number(pack.exporter))?.name || existingRow?.exporter || "-";
  const sampleEntries = Array.isArray(pack.sampleEntries) ? pack.sampleEntries : [];
  const releaseDetails = Array.isArray(pack.releaseDetails) ? pack.releaseDetails : [];
  const containers = buildPackContainers(pack, existingRow);
  const detail =
    pack.fumigationDetail && typeof pack.fumigationDetail === "object"
      ? { ...blankFumigationDetail(), ...pack.fumigationDetail }
      : blankFumigationDetail();
  const fumigationSummary = String(detail.fumigationNotes || pack.fumigation || "").trim();
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
    containers,
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
    fumigation: fumigationSummary,
    fumigationRequired: Boolean(pack.fumigationRequired),
    fumigantId: pack.fumigantId ? Number(pack.fumigantId) : null,
    methodologyId: pack.methodologyId ? Number(pack.methodologyId) : null,
    certificateTemplateId: pack.certificateTemplateId ? Number(pack.certificateTemplateId) : null,
    recordTemplateId: pack.recordTemplateId ? Number(pack.recordTemplateId) : null,
    fumigationDetail: detail,
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
    importPermitRequired: Boolean(pack.importPermitRequired),
    importPermitNumber: pack.importPermitNumber || "",
    importPermitDate: pack.importPermitDate || "",
    importPermitFiles: normalizeFileItems(pack.importPermitFiles),
    additionalDeclarationFiles: normalizeFileItems(pack.additionalDeclarationFiles),
    rfp: pack.rfp || "",
    rfpAdditionalDeclarationRequired: Boolean(pack.rfpAdditionalDeclarationRequired),
    rfpFiles: normalizeFileItems(pack.rfpFiles),
    packingInstructionFiles: normalizeFileItems(pack.packingInstructionFiles),
    pemsDraft: { ...defaultPemsDraft(), ...(pack.pemsDraft || {}) },
    pemsSubmissions: Array.isArray(pack.pemsSubmissions) ? pack.pemsSubmissions : [],
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

/** Read-only field — matches packers schedule PEMs staging `Field` layout. */
function PemsStagingField({ label, value, labelClassName = "", valueClassName = "" }) {
  return (
    <div className="space-y-1">
      <div className={cn("text-[11px] font-semibold uppercase tracking-wide text-slate-500", labelClassName)}>{label}</div>
      <div className={cn("rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[13px] text-slate-700", valueClassName)}>{value}</div>
    </div>
  );
}

/** Editable staging field — same label layout as `PemsStagingField`, General-form controls inside. */
function PemsStagingFormField({ label, children, labelClassName = "" }) {
  return (
    <div className="min-w-0 space-y-1">
      <div className={cn("text-[11px] font-semibold uppercase tracking-wide text-slate-500", labelClassName)}>{label}</div>
      <div className="w-full min-w-0">{children}</div>
    </div>
  );
}

const stagingInputClass = cn(inputClass, "min-w-0");
const stagingGridClass = "grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4";
const stagingFooterGridClass = "grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5";

export default function NewPackFormPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { siteId: activeSiteId, site } = useSite();
  const { dock, verticalExpanded } = useNavDock();
  const mode = searchParams.get("mode") === "edit" ? "edit" : "add";
  const editId = Number(searchParams.get("id"));
  const requestedTab = searchParams.get("tab");
  const currentSite = Number(activeSiteId) || 1;
  const [vesselDepartures, setVesselDepartures] = useState([]);
  const [fumigants] = useState(() => loadFumigants());
  const [methodologies] = useState(() => loadMethodologies());
  const [certificateTemplates] = useState(() => loadCertificateTemplates());
  const [recordTemplates] = useState(() => loadRecordTemplates());
  const packerNames = useMemo(
    () => (PACK_FORM_LOOKUPS.packers || []).filter((row) => String(row.status).toLowerCase() === "active").map((row) => row.name),
    []
  );
  const [pack, setPack] = useState(() => blankPack(currentSite));
  const [editingRow, setEditingRow] = useState(null);
  const [samplePanelOpen, setSamplePanelOpen] = useState(false);
  const [activeTab, setActiveTab] = useState(() =>
    ["general", "fumigation", "accounting", "pems"].includes(requestedTab || "") ? requestedTab : "general"
  );
  const [editingContainerId, setEditingContainerId] = useState(null);
  const [pemsSubmitError, setPemsSubmitError] = useState("");
  const [pemsContainerSearch, setPemsContainerSearch] = useState("");
  const userClosedSampleWhileRequiredRef = useRef(false);
  const prevSampleRequiredRef = useRef(undefined);

  const set = (key, val) => setPack((prev) => ({ ...prev, [key]: val }));

  useEffect(() => {
    if (!["general", "fumigation", "accounting", "pems"].includes(requestedTab || "")) return;
    setActiveTab(requestedTab);
  }, [requestedTab]);
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

  const fd =
    pack.fumigationDetail && typeof pack.fumigationDetail === "object"
      ? pack.fumigationDetail
      : blankFumigationDetail();
  const fumigationMethodologyOptions = useMemo(() => {
    const fumigantId = pack.fumigantId ? Number(pack.fumigantId) : null;
    if (!fumigantId) return [];
    return methodologies.filter((item) => Number(item.fumigantId) === fumigantId);
  }, [pack.fumigantId, methodologies]);
  const selectedFumigationMethodology = useMemo(() => {
    const methodologyId = pack.methodologyId ? Number(pack.methodologyId) : null;
    if (!methodologyId) return null;
    return methodologies.find((item) => Number(item.id) === methodologyId) || null;
  }, [pack.methodologyId, methodologies]);

  function updateFumigationDetail(patch) {
    setPack((prev) => {
      const previousDetail =
        prev.fumigationDetail && typeof prev.fumigationDetail === "object"
          ? prev.fumigationDetail
          : blankFumigationDetail();
      const nextDetail = { ...previousDetail, ...patch };
      return {
        ...prev,
        fumigationDetail: nextDetail,
        fumigation:
          nextDetail.fumigationNotes != null
            ? String(nextDetail.fumigationNotes)
            : prev.fumigation,
      };
    });
  }

  function updatePackContainer(containerId, patch) {
    setPack((prev) => {
      const existing = buildPackContainers(prev, editingRow);
      const next = existing.map((container) => {
        if (container.id !== containerId) return container;
        const patchValue = typeof patch === "function" ? patch(container) : patch;
        const draft = { ...container, ...patchValue };
        const tare = toRoundedNumber(draft.tare);
        const grossWeight = toRoundedNumber(draft.grossWeight);
        return {
          ...draft,
          tare,
          grossWeight,
          nettWeight: toRoundedNumber(Math.max(grossWeight - tare, 0)),
        };
      });
      return { ...prev, containers: next };
    });
  }

  function updatePemsDraft(patch) {
    setPack((prev) => {
      const current = { ...defaultPemsDraft(), ...(prev.pemsDraft || {}) };
      const nextPatch = typeof patch === "function" ? patch(current) : patch;
      return { ...prev, pemsDraft: { ...current, ...nextPatch } };
    });
  }

  function togglePemsContainer(containerId) {
    updatePemsDraft((current) => {
      const exists = current.stagedContainerIds.includes(containerId);
      return {
        ...current,
        stagedContainerIds: exists ? current.stagedContainerIds.filter((id) => id !== containerId) : [...current.stagedContainerIds, containerId],
      };
    });
  }

  function submitPemsFromForm() {
    const isGppir = pemsDraft.recordType === GPPIR_RECORD_TYPE;
    const stagedIds = pemsDraft.stagedContainerIds || [];
    const containers = packContainers.filter((container) => stagedIds.includes(container.id));
    if (!containers.length || !pemsDraft.inspectionStart || !pemsDraft.inspectionEnd || !pemsDraft.aoSignoff) {
      setPemsSubmitError("Select staged containers and complete inspection start/end and AO signoff.");
      return;
    }
    if (isGppir) {
      const missingEcr = containers.filter((container) => !container.ecrSubmitted);
      if (missingEcr.length) {
        setPemsSubmitError("ECR must be submitted before GPPIR for all staged containers.");
        return;
      }
    } else if (!String(pemsDraft.ecrComments ?? "").trim()) {
      setPemsSubmitError("Enter comments before submitting the empty container inspection record.");
      return;
    }
    const submittedAt = new Date().toISOString();
    const batchId = `PEMS-${Date.now()}`;
    setPemsSubmitError("");
    const submission = attachPemsSubmissionSnapshot({
      batchId,
      submittedAt,
      status: "Accepted",
      recordType: pemsDraft.recordType,
      packId: pack.id || editingRow?.id || "draft",
      jobReference: pack.jobReference || "",
      rfp: pack.rfp || "",
      exporter: customerOptions.find((c) => c.id === Number(pack.exporter))?.name || "",
      destinationCountry: pack.destinationCountry || "",
      importPermitRequired: Boolean(pack.importPermitRequired),
      importPermitNumber: pack.importPermitNumber || "",
      rfpAdditionalDeclarationRequired: Boolean(pack.rfpAdditionalDeclarationRequired),
      establishmentName: selectedPackSite?.name || site?.label || site?.name || "",
      establishmentNumber: String(selectedPackSite?.yardNo || ""),
      commodity: commodityOptions.find((row) => Number(row.id) === Number(pack.commodityId))?.description || "",
      aoSignoff: pemsDraft.aoSignoff,
      aoNumber: selectedAoNumber,
      inspectionStart: pemsDraft.inspectionStart,
      inspectionEnd: pemsDraft.inspectionEnd,
      ecrComments: pemsDraft.ecrComments || "N/A",
      yardId: String(selectedPackSite?.yardNo || ""),
      placeOfInspection: selectedPackSite?.name || site?.label || site?.name || `Site ${pack.siteId || ""}`,
      containerIds: containers.map((container) => container.id),
      containers: containers.map((container) => ({
        ...container,
        containerNo: container.containerNumber,
        sealNo: container.sealNumber,
      })),
    });
    setPack((prev) => {
      const currentDraft = { ...defaultPemsDraft(), ...(prev.pemsDraft || {}) };
      const previousSubs = Array.isArray(prev.pemsSubmissions) ? prev.pemsSubmissions : [];
      const stagedSet = new Set(stagedIds);
      return {
        ...prev,
        pemsDraft: { ...currentDraft, stagedContainerIds: [] },
        pemsSubmissions: [submission, ...previousSubs],
        containers: (Array.isArray(prev.containers) ? prev.containers : []).map((container) => {
          if (!stagedSet.has(container.id)) return container;
          return isGppir
            ? { ...container, gppirSubmitted: true, gppirLastSubmittedAt: submittedAt, gppirLastBatchId: batchId }
            : { ...container, ecrSubmitted: true, ecrLastSubmittedAt: submittedAt, ecrLastBatchId: batchId };
        }),
      };
    });
    openPemsSubmissionDocument(submission, { autoPrint: true });
  }

  const selectedVessel = useMemo(() => {
    if (!pack.vesselDepartureId) return null;
    return vesselDepartures.find((v) => v.id === Number(pack.vesselDepartureId)) || null;
  }, [pack.vesselDepartureId, vesselDepartures]);
  const releaseRows = Array.isArray(pack.releaseDetails) ? pack.releaseDetails : [];
  const packContainers = useMemo(() => buildPackContainers(pack, editingRow), [pack, editingRow]);
  const filteredPemsPackContainers = useMemo(() => {
    const q = pemsContainerSearch.trim().toLowerCase();
    if (!q) return packContainers;
    return packContainers.filter((c) =>
      [c.order, c.containerNumber, c.sealNumber, c.releaseNumber, c.id, c.stockBayId, c.grainLocation].some((v) =>
        String(v ?? "")
          .toLowerCase()
          .includes(q)
      )
    );
  }, [packContainers, pemsContainerSearch]);
  const pemsDraft = useMemo(() => ({ ...defaultPemsDraft(), ...(pack.pemsDraft || {}) }), [pack.pemsDraft]);
  const pemsSubmissions = Array.isArray(pack.pemsSubmissions) ? pack.pemsSubmissions : [];
  const siteRows = useMemo(() => readSiteRows(), []);
  const selectedPackSite = useMemo(() => {
    const byId = siteRows.find((row) => Number(row.id) === Number(pack.siteId));
    return byId || siteRows[0] || null;
  }, [siteRows, pack.siteId]);
  const aoNumberByName = useMemo(() => {
    const map = new Map();
    loadContactUsers().forEach((row) => {
      if (!row?.aoActive) return;
      const name = String(row.name || "").trim();
      if (!name) return;
      map.set(name, String(row.aoNumber || ""));
    });
    return map;
  }, []);
  const selectedAoNumber = useMemo(() => aoNumberByName.get(String(pemsDraft.aoSignoff || "").trim()) || "", [aoNumberByName, pemsDraft.aoSignoff]);
  const selectedEditContainer = packContainers.find((container) => container.id === editingContainerId) || null;
  const selectedEditContainerActions = useMemo(() => {
    if (!selectedEditContainer) return null;
    return createPraActionHandlers({
      container: selectedEditContainer,
      applyPatch: (patch) => updatePackContainer(selectedEditContainer.id, patch),
      fallbackPacker: packerNames[0] || "",
    });
  }, [selectedEditContainer, packerNames]);
  const stagedPemsContainers = packContainers.filter((container) => (pemsDraft.stagedContainerIds || []).includes(container.id));
  const pemsEligibleContainerIds = useMemo(
    () =>
      packContainers
        .filter((container) => pemsDraft.recordType !== GPPIR_RECORD_TYPE || container.ecrSubmitted)
        .map((container) => container.id),
    [packContainers, pemsDraft.recordType]
  );
  const stagedPemsIds = pemsDraft.stagedContainerIds || [];
  const allPemsEligibleStaged =
    pemsEligibleContainerIds.length > 0 && pemsEligibleContainerIds.every((id) => stagedPemsIds.includes(id));
  const stagingRfpSummary = useMemo(() => {
    const refs = (Array.isArray(pack.releaseDetails) ? pack.releaseDetails : []).map((r) => r?.releaseRef).filter(Boolean);
    return resolvePackRfpRef({
      packRfp: pack.rfp,
      stagedContainers: stagedPemsContainers,
      allContainers: packContainers,
      releaseRefs: refs,
    });
  }, [pack.rfp, pack.releaseDetails, stagedPemsContainers, packContainers]);
  const isGppirPems = pemsDraft.recordType === GPPIR_RECORD_TYPE;
  const stagingExpiryDate = useMemo(() => {
    const anchor = pemsDraft.inspectionEnd || pemsDraft.inspectionStart;
    return formatDateDisplay(addDaysToDate(anchor, isGppirPems ? 28 : 90));
  }, [pemsDraft.inspectionEnd, pemsDraft.inspectionStart, isGppirPems]);
  const gppirStagingTotalWeight = useMemo(
    () =>
      toRoundedNumber(
        stagedPemsContainers.reduce(
          (sum, container) => sum + (Number.isFinite(Number(container.nettWeight)) ? Number(container.nettWeight) : 0),
          0
        )
      ),
    [stagedPemsContainers]
  );
  const gppirStagingPassedWeight = useMemo(
    () =>
      toRoundedNumber(
        stagedPemsContainers.reduce((sum, container) => {
          const weight = Number(container.nettWeight);
          if (container.grainInspection !== "Passed" || !Number.isFinite(weight)) return sum;
          return sum + weight;
        }, 0)
      ),
    [stagedPemsContainers]
  );
  const gppirStagingFailedWeight = useMemo(
    () =>
      toRoundedNumber(
        stagedPemsContainers.reduce((sum, container) => {
          const weight = Number(container.nettWeight);
          if (container.grainInspection !== "Failed" || !Number.isFinite(weight)) return sum;
          return sum + weight;
        }, 0)
      ),
    [stagedPemsContainers]
  );
  const gppirStagingFlowResult =
    stagedPemsContainers.length && stagedPemsContainers.every((container) => container.grainInspection === "Passed")
      ? "Passed"
      : "Pending";
  const packRfpText = String(pack.rfp || "").trim();
  const packPemsCommodityLabel = useMemo(
    () => safeValue(commodityOptions.find((row) => Number(row.id) === Number(pack.commodityId))?.description),
    [pack.commodityId]
  );
  const packDisplayId = String(pack.id || editingRow?.id || "").trim() || "—";
  const containersLeftToPack = packContainers.filter((container) => {
    const status = String(container.status || "").toLowerCase();
    return status !== "complete" && status !== "completed";
  }).length;
  const containersLeftToPackDisplay =
    pack.containersRequired === "" || pack.containersRequired == null ? "" : String(containersLeftToPack);

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
      fumigation: String(pack.fumigationDetail?.fumigationNotes || pack.fumigation || "").trim() || "—",
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
    pack.fumigationDetail,
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
    if (!pack.fumigationRequired && activeTab === "fumigation") {
      setActiveTab("general");
    }
  }, [pack.fumigationRequired, activeTab]);

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
      fumigationRequired: Boolean(pack.fumigationRequired),
      fumigantId:
        pack.fumigantId !== null && pack.fumigantId !== undefined && pack.fumigantId !== ""
          ? Number(pack.fumigantId)
          : null,
      methodologyId:
        pack.methodologyId !== null && pack.methodologyId !== undefined && pack.methodologyId !== ""
          ? Number(pack.methodologyId)
          : null,
      certificateTemplateId:
        pack.certificateTemplateId !== null &&
        pack.certificateTemplateId !== undefined &&
        pack.certificateTemplateId !== ""
          ? Number(pack.certificateTemplateId)
          : null,
      recordTemplateId:
        pack.recordTemplateId !== null &&
        pack.recordTemplateId !== undefined &&
        pack.recordTemplateId !== ""
          ? Number(pack.recordTemplateId)
          : null,
      fumigationDetail:
        pack.fumigationDetail && typeof pack.fumigationDetail === "object"
          ? { ...blankFumigationDetail(), ...pack.fumigationDetail }
          : blankFumigationDetail(),
      fumigation: String(pack.fumigationDetail?.fumigationNotes || pack.fumigation || "").trim(),
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
      created.containers = buildPackContainers({ ...normalized, id: created.id }, created);
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
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("general")}
            className={cn(
              "rounded-md border px-3 py-1.5 text-xs font-semibold",
              activeTab === "general"
                ? "border-brand/45 bg-brand/15 text-brand-ink"
                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            )}
          >
            General
          </button>
          {pack.fumigationRequired ? (
            <button
              type="button"
              onClick={() => setActiveTab("fumigation")}
              className={cn(
                "rounded-md border px-3 py-1.5 text-xs font-semibold",
                activeTab === "fumigation"
                  ? "border-brand/45 bg-brand/15 text-brand-ink"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              )}
            >
              Fumigation
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => setActiveTab("accounting")}
            className={cn(
              "rounded-md border px-3 py-1.5 text-xs font-semibold",
              activeTab === "accounting"
                ? "border-brand/45 bg-brand/15 text-brand-ink"
                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            )}
          >
            Accounting
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("pems")}
            className={cn(
              "rounded-md border px-3 py-1.5 text-xs font-semibold",
              activeTab === "pems"
                ? "border-brand/45 bg-brand/15 text-brand-ink"
                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            )}
          >
            PEMs
          </button>
        </div>

      {activeTab === "general" ? (
      <>
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
          <div className="sm:col-span-2 md:col-span-3">
            <div className={cn("grid gap-4", pack.fumigationRequired ? "sm:grid-cols-3" : "sm:grid-cols-1")}>
              <FormRow label="Fumigation required">
                <select
                  className={inputClass}
                  value={pack.fumigationRequired ? "yes" : "no"}
                  onChange={(e) => {
                    const enabled = e.target.value === "yes";
                    setPack((prev) => ({
                      ...prev,
                      fumigationRequired: enabled,
                      fumigantId: enabled ? prev.fumigantId : null,
                      methodologyId: enabled ? prev.methodologyId : null,
                      certificateTemplateId: enabled ? prev.certificateTemplateId : null,
                      recordTemplateId: enabled ? prev.recordTemplateId : null,
                    }));
                  }}
                >
                  <option value="no">No</option>
                  <option value="yes">Yes</option>
                </select>
              </FormRow>
              {pack.fumigationRequired ? (
                <FormRow label="Fumigant selector">
                  <select
                    className={inputClass}
                    value={pack.fumigationDetail?.fumigationNotes || pack.fumigation || ""}
                    onChange={(e) => {
                      const value = e.target.value;
                      const matched = fumigants.find((item) => `${item.code} - ${item.name}` === value);
                      setPack((prev) => ({
                        ...prev,
                        fumigantId: matched ? Number(matched.id) : prev.fumigantId,
                        fumigation: value,
                        fumigationDetail: {
                          ...(prev.fumigationDetail || blankFumigationDetail()),
                          fumigationNotes: value,
                        },
                      }));
                    }}
                  >
                    <option value="">- Select fumigant -</option>
                    {fumigants.map((item) => {
                      const label = `${item.code} - ${item.name}`;
                      return (
                        <option key={item.id} value={label}>
                          {label}
                        </option>
                      );
                    })}
                  </select>
                </FormRow>
              ) : null}
              {pack.fumigationRequired ? (
                <FormRow label="DAFF Permission">
                  <select className={inputClass} value={pack.daffPermission || "N/A"} onChange={(e) => set("daffPermission", e.target.value)}>
                    {DAFF_PERMISSION_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </FormRow>
              ) : null}
            </div>
          </div>
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
              <input className={inputClass} value={containersLeftToPackDisplay} readOnly disabled placeholder="0" />
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
            <p className="text-[11px] text-slate-500">
              Releases are pickup references only. Container counts are controlled by the pack and its draft containers.
            </p>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Release number <span className="font-normal normal-case text-slate-400">· Release lines: {releaseRows.length}</span>
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
      </>
      ) : null}

      {activeTab === "pems" ? (
      <div className="space-y-3">
        <section className="rounded-lg border border-slate-200/90 bg-white px-2.5 py-2.5 shadow-none">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Submitted PEM</p>
            {pemsSubmissions.length ? (
              <span className="tabular-nums text-[10px] text-slate-400">{pemsSubmissions.length}</span>
            ) : null}
          </div>
          {!pemsSubmissions.length ? (
            <p className="mt-2 text-[11px] text-slate-500">None yet.</p>
          ) : (
            <div className="mt-2 divide-y divide-slate-100 border-t border-slate-100">
              {pemsSubmissions.map((row) => (
                <div
                  key={row.batchId}
                  className="flex flex-col gap-2 py-2.5 text-[11px] leading-snug sm:flex-row sm:items-start sm:gap-4"
                >
                  <div className="flex shrink-0 flex-wrap items-center gap-2 sm:w-[10.5rem] sm:flex-col sm:items-start sm:gap-1">
                    <span className="font-semibold text-slate-800">{row.batchId}</span>
                    <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-emerald-800">
                      {safeValue(row.status)}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1 break-words">
                    <p className="text-[10px] text-slate-700">{safeValue(row.recordType)}</p>
                    <p className="mt-0.5 text-[10px] text-slate-500">
                      {Array.isArray(row.containerIds) ? row.containerIds.length : 0} containers
                    </p>
                  </div>
                  <div className="shrink-0 text-[10px] whitespace-nowrap text-slate-400 sm:pt-0.5">
                    {formatDateTimeValue(row.submittedAt)}
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 sm:flex-col sm:items-end sm:gap-1.5">
                    <button
                      type="button"
                      className="text-[10px] font-medium text-brand-600 hover:underline"
                      onClick={() => openPemsSubmissionDocument(row, { autoPrint: false })}
                    >
                      View
                    </button>
                    <button
                      type="button"
                      className="text-[10px] font-medium text-brand-600 hover:underline"
                      onClick={() => openPemsSubmissionDocument(row, { autoPrint: true })}
                    >
                      PDF
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className={sectionClass}>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-700">PEMs submission setup</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <FormRow label="Record type">
              <select
                className={inputClass}
                value={pemsDraft.recordType}
                onChange={(e) =>
                  updatePemsDraft((current) => ({
                    ...current,
                    recordType: e.target.value,
                    stagedContainerIds:
                      e.target.value === GPPIR_RECORD_TYPE
                        ? current.stagedContainerIds.filter((id) => {
                            const target = packContainers.find((container) => container.id === id);
                            return Boolean(target?.ecrSubmitted);
                          })
                        : current.stagedContainerIds,
                  }))
                }
              >
                {PEMS_RECORD_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </FormRow>
            <FormRow label="Inspection start">
              <input
                className={inputClass}
                type="datetime-local"
                value={formatDateTimeInput(pemsDraft.inspectionStart)}
                onChange={(e) => updatePemsDraft({ inspectionStart: e.target.value })}
              />
            </FormRow>
            <FormRow label="Inspection end">
              <input
                className={inputClass}
                type="datetime-local"
                value={formatDateTimeInput(pemsDraft.inspectionEnd)}
                onChange={(e) => updatePemsDraft({ inspectionEnd: e.target.value })}
              />
            </FormRow>
            <FormRow label="AO signoff">
              <input className={inputClass} value={pemsDraft.aoSignoff} onChange={(e) => updatePemsDraft({ aoSignoff: e.target.value })} placeholder="AO name" />
            </FormRow>
          </div>
          <div className="mt-2 flex flex-row flex-wrap items-start gap-2 sm:gap-3">
            <div className="min-w-0 flex-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">PEMs checker</p>
              <div className="mt-1 grid auto-rows-auto grid-cols-1 items-start divide-y divide-slate-200 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
                {[
                  {
                    title: "Yard number",
                    ...(!selectedPackSite?.yardNo
                      ? { ok: false, label: "Missing yard number in selected site record." }
                      : { ok: true, label: `Yard number resolved (${selectedPackSite.yardNo})` }),
                  },
                  {
                    title: "Place of inspection",
                    ...(!selectedPackSite?.name
                      ? { ok: false, label: "Missing site name for place of inspection." }
                      : { ok: true, label: `Place of inspection resolved (${selectedPackSite.name})` }),
                  },
                  {
                    title: "AO signoff",
                    ...(pemsDraft.aoSignoff
                      ? selectedAoNumber
                        ? { ok: true, label: `AO number resolved for ${pemsDraft.aoSignoff} (${selectedAoNumber})` }
                        : { ok: false, label: `AO number missing for selected AO (${pemsDraft.aoSignoff}). Update Users table.` }
                      : { ok: false, label: "Select AO signoff to resolve AO number." }),
                  },
                ].map((section) => (
                  <div key={section.title} className="py-1 first:pt-0 last:pb-0 sm:px-2 sm:py-1.5 sm:first:pl-0 sm:last:pr-0">
                    <div className="space-y-1">
                      <p className="text-[11px] leading-snug break-words">
                        <span className="text-slate-400">{section.title}: </span>
                        <span className={cn(section.ok ? "text-emerald-700" : "text-amber-700")}>
                          {section.ok ? "OK — " : "Needs attention — "}
                          {section.label}
                        </span>
                      </p>
                      {section.lines?.length
                        ? section.lines.map((line, i) => (
                            <p key={i} className="text-[11px] leading-snug break-words text-slate-600">
                              {line}
                            </p>
                          ))
                        : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <Button
              type="button"
              className="h-10 shrink-0 self-center sm:min-w-[160px]"
              onClick={submitPemsFromForm}
              disabled={!stagedPemsContainers.length}
            >
              Submit {stagedPemsContainers.length}
            </Button>
          </div>
          {pemsSubmitError ? (
            <p className="mt-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{pemsSubmitError}</p>
          ) : null}
        </section>

        <div className="grid gap-2 lg:grid-cols-[minmax(220px,260px)_minmax(0,1fr)] lg:gap-3">
          <aside className="space-y-4">
            <section className="rounded-xl border border-slate-200/90 bg-white">
              <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-2 py-2">
                <h3 className="text-xs font-semibold tracking-wide text-slate-600">Containers</h3>
                <span className="tabular-nums text-[10px] text-slate-400" aria-live="polite">
                  {stagedPemsContainers.length}/{packContainers.length}
                </span>
              </div>
              <div className="border-b border-slate-100 px-2 py-1.5">
                <input
                  type="search"
                  className={cn(inputClass, "h-9 w-full text-xs")}
                  value={pemsContainerSearch}
                  onChange={(e) => setPemsContainerSearch(e.target.value)}
                  placeholder="Search containers…"
                  aria-label="Search containers"
                />
                <p className="mt-0.5 text-[10px] text-slate-500">
                  Showing {filteredPemsPackContainers.length} of {packContainers.length}
                </p>
              </div>
              <div className="border-b border-slate-100 px-2 py-1.5">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="h-7 px-2.5 text-[11px]"
                  disabled={!pemsEligibleContainerIds.length}
                  onClick={() => {
                    if (allPemsEligibleStaged) updatePemsDraft({ stagedContainerIds: [] });
                    else
                      updatePemsDraft({
                        stagedContainerIds:
                          pemsDraft.recordType === GPPIR_RECORD_TYPE
                            ? packContainers.filter((container) => container.ecrSubmitted).map((container) => container.id)
                            : packContainers.map((container) => container.id),
                      });
                  }}
                >
                  {allPemsEligibleStaged ? "Unselect all" : "Select all"}
                </Button>
              </div>
              <div className="max-h-[18rem] space-y-1 overflow-auto px-1.5 pb-1.5 pt-1">
                {!filteredPemsPackContainers.length ? (
                  <div className="rounded-md border border-dashed border-slate-200 bg-slate-50/80 px-2 py-4 text-center text-[11px] text-slate-500">
                    No containers match this search.
                  </div>
                ) : null}
                {filteredPemsPackContainers.map((container) => {
                  const checked = pemsDraft.stagedContainerIds.includes(container.id);
                  const canStage = pemsDraft.recordType !== GPPIR_RECORD_TYPE || container.ecrSubmitted;
                  const statusLabel = container.gppirSubmitted ? "GPPIR" : container.ecrSubmitted ? "ECR" : "No ECR";
                  const statusTitle = container.gppirSubmitted
                    ? "GPPIR submitted"
                    : container.ecrSubmitted
                      ? "ECR submitted"
                      : "Awaiting ECR";
                  const isHighlighted = editingContainerId === container.id;
                  return (
                    <div
                      key={container.id}
                      className={cn(
                        "rounded-md border px-2 py-1.5 text-[11px] leading-snug",
                        isHighlighted ? "border-brand/40 bg-brand/5" : "border-slate-200 bg-white"
                      )}
                    >
                      <div className="flex items-center gap-1.5">
                        <input
                          type="checkbox"
                          className="h-4 w-4 shrink-0 rounded border-slate-300"
                          checked={checked}
                          disabled={!canStage}
                          onChange={() => {
                            if (!canStage) return;
                            togglePemsContainer(container.id);
                          }}
                        />
                        <span className="min-w-0 flex-1 truncate font-semibold text-slate-800">
                          #{container.order} {container.containerNumber || "Draft"}
                        </span>
                        <span
                          title={statusTitle}
                          className={cn(
                            "shrink-0 rounded px-1.5 py-0.5 text-[9px] font-semibold leading-none",
                            container.gppirSubmitted
                              ? "bg-emerald-100 text-emerald-800"
                              : container.ecrSubmitted
                                ? "bg-blue-100 text-blue-800"
                                : "bg-slate-100 text-slate-600"
                          )}
                        >
                          {statusLabel}
                        </span>
                      </div>
                      <div className="mt-1 flex min-h-[1.125rem] items-center justify-between gap-1.5 text-[10px] text-slate-500">
                        <span className="min-w-0 truncate">
                          {safeValue(container.sealNumber)} · {safeValue(container.releaseNumber)}
                        </span>
                        <button
                          type="button"
                          className="shrink-0 font-medium text-brand-600 hover:text-brand-700 hover:underline"
                          onClick={() => setEditingContainerId(container.id)}
                        >
                          Edit
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </aside>

          <section className="space-y-4 min-w-0">
            <div className="rounded-xl border border-slate-200/90 bg-white p-3">
              <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                <h3 className="text-sm font-semibold leading-snug text-slate-900 sm:text-base">
                  {isGppirPems ? `${GPPIR_RECORD_TYPE} (staging)` : `${ECR_RECORD_TYPE} (staging)`}
                </h3>
                <span className="ms-auto shrink-0 text-xs text-slate-500 tabular-nums">Pack #{packDisplayId}</span>
              </div>
              {!stagedPemsContainers.length ? (
                <div className="rounded-lg border border-dashed border-slate-300 px-3 py-6 text-center text-sm text-slate-500">
                  Stage one or more containers to populate this record.
                </div>
              ) : isGppirPems ? (
                <div className="space-y-4 rounded-lg border border-slate-200 bg-slate-50/50 p-3 text-sm">
                  <div className={stagingGridClass}>
                    <PemsStagingFormField label="RFP">
                      <input
                        className={stagingInputClass}
                        value={pack.rfp}
                        onChange={(e) => set("rfp", e.target.value)}
                        placeholder="RFP reference"
                      />
                    </PemsStagingFormField>
                    <PemsStagingField label="Establishment Name" value={safeValue(selectedPackSite?.name)} />
                    <PemsStagingField label="Establishment Number" value={safeValue(selectedPackSite?.yardNo)} />
                    <PemsStagingFormField label="Exporter">
                      <select className={stagingInputClass} value={pack.exporter} onChange={(e) => set("exporter", e.target.value)}>
                        <option value="">- Select -</option>
                        {customerOptions.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </PemsStagingFormField>
                  </div>
                  <div className={stagingGridClass}>
                    <PemsStagingField label="Total Quantity" value={`${gppirStagingTotalWeight.toFixed(4)} M/TONS`} />
                    <PemsStagingField label="Estimated Net Metric Weight and Unit" value={`${gppirStagingTotalWeight.toFixed(2)} TONS`} />
                    <PemsStagingField label="Inspection Start Date and Time" value={formatDateTimeValue(pemsDraft.inspectionStart)} />
                    <PemsStagingField label="Inspection End Date and Time" value={formatDateTimeValue(pemsDraft.inspectionEnd)} />
                  </div>
                  <div className={stagingGridClass}>
                    <PemsStagingFormField label="Destination country">
                      <select
                        className={stagingInputClass}
                        value={pack.destinationCountry}
                        onChange={(e) => set("destinationCountry", e.target.value)}
                      >
                        <option value="">- Select country -</option>
                        {countryOptions.map((country) => (
                          <option key={country} value={country}>
                            {country}
                          </option>
                        ))}
                      </select>
                    </PemsStagingFormField>
                    <PemsStagingFormField label="Import Permit No.">
                      {!pack.importPermitRequired ? (
                        <div className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[13px] text-slate-700">N/A</div>
                      ) : (
                        <input
                          className={stagingInputClass}
                          value={pack.importPermitNumber}
                          onChange={(e) => set("importPermitNumber", e.target.value)}
                          placeholder="Number"
                        />
                      )}
                    </PemsStagingFormField>
                    <PemsStagingField label="Flow Path Result" value={gppirStagingFlowResult} />
                    <PemsStagingField label="Flow path Date and Time" value={formatDateTimeValue(pemsDraft.inspectionStart)} />
                    <PemsStagingField label="Expiry Date" value={stagingExpiryDate} />
                  </div>
                  <div className="overflow-x-auto rounded-md border border-slate-200 bg-white">
                    <table className="w-full min-w-[1080px] text-left text-xs">
                      <thead className="bg-slate-100 text-slate-700">
                        <tr>
                          <th className="px-2 py-2 font-semibold">RFP Line No</th>
                          <th className="px-2 py-2 font-semibold">Container Number</th>
                          <th className="px-2 py-2 font-semibold">Source</th>
                          <th className="px-2 py-2 font-semibold">Commodity</th>
                          <th className="px-2 py-2 font-semibold">Package Number</th>
                          <th className="px-2 py-2 font-semibold">Type</th>
                          <th className="px-2 py-2 font-semibold">Weight</th>
                          <th className="px-2 py-2 font-semibold">Unit</th>
                          <th className="px-2 py-2 font-semibold">Sampled</th>
                          <th className="px-2 py-2 font-semibold">Result</th>
                          <th className="px-2 py-2 font-semibold">Inspection AO Name</th>
                          <th className="px-2 py-2 font-semibold">Remarks</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stagedPemsContainers.map((container) => (
                          <tr key={container.id} className="border-t border-slate-100 text-slate-700">
                            <td className="px-2 py-2">1</td>
                            <td className="px-2 py-2 font-medium">{safeValue(container.containerNumber)}</td>
                            <td className="px-2 py-2">{safeValue(container.grainLocation || container.stockBayId)}</td>
                            <td className="px-2 py-2">{packPemsCommodityLabel}</td>
                            <td className="px-2 py-2">1</td>
                            <td className="px-2 py-2">CONTAINER</td>
                            <td className="px-2 py-2">{toRoundedNumber(container.nettWeight).toFixed(4)}</td>
                            <td className="px-2 py-2">M/TONS</td>
                            <td className="px-2 py-2">N/A</td>
                            <td className="px-2 py-2">
                              {container.grainInspection === "Passed"
                                ? "Passed"
                                : container.grainInspection === "Failed"
                                  ? "Failed"
                                  : "Pending"}
                            </td>
                            <td className="px-2 py-2">{safeValue(pemsDraft.aoSignoff)}</td>
                            <td className="px-2 py-2 align-top">
                              <textarea
                                className={cn(stagingInputClass, "min-h-[2.5rem] resize-y")}
                                value={getContainerInspectionRemark(container)}
                                onChange={(e) =>
                                  updatePackContainer(container.id, containerInspectionRemarkPatch(e.target.value))
                                }
                                placeholder="Remarks"
                                rows={2}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className={stagingFooterGridClass}>
                    <PemsStagingField label="Submitted AO Name" value={safeValue(pemsDraft.aoSignoff)} />
                    <PemsStagingField label="Submitted AO Number" value={safeValue(selectedAoNumber)} />
                    <PemsStagingFormField label="Additional Declaration">
                      <select
                        className={stagingInputClass}
                        value={pack.rfpAdditionalDeclarationRequired ? "yes" : "no"}
                        onChange={(e) => set("rfpAdditionalDeclarationRequired", e.target.value === "yes")}
                      >
                        <option value="no">No</option>
                        <option value="yes">Yes</option>
                      </select>
                    </PemsStagingFormField>
                    <PemsStagingField label="Total Passed" value={`${gppirStagingPassedWeight.toFixed(4)} M/TONS`} />
                    <PemsStagingField label="Total Failed" value={`${gppirStagingFailedWeight.toFixed(4)} M/TONS`} />
                  </div>
                </div>
              ) : (
                <div className="space-y-4 rounded-lg border border-slate-200 bg-slate-50/50 p-3 text-sm">
                  <div className={stagingGridClass}>
                    <PemsStagingField label="Container Yard Id" value={safeValue(selectedPackSite?.yardNo)} />
                    <PemsStagingField label="Place of Inspection" value={safeValue(selectedPackSite?.name)} />
                    <PemsStagingField label="Inspection Start Date and Time" value={formatDateTimeValue(pemsDraft.inspectionStart)} />
                    <PemsStagingField label="Inspection End Date and Time" value={formatDateTimeValue(pemsDraft.inspectionEnd)} />
                  </div>
                  <div className="overflow-x-auto rounded-md border border-slate-200 bg-white">
                    <table className="w-full min-w-[880px] text-left text-xs">
                      <thead className="bg-slate-100 text-slate-700">
                        <tr>
                          <th className="px-2 py-2 font-semibold">Container Number</th>
                          <th className="px-2 py-2 font-semibold">Inspection Level</th>
                          <th className="px-2 py-2 font-semibold">RFP Number</th>
                          <th className="px-2 py-2 font-semibold">Result</th>
                          <th className="px-2 py-2 font-semibold">Seal Number</th>
                          <th className="px-2 py-2 font-semibold">Expiry Date</th>
                          <th className="px-2 py-2 font-semibold">Inspection AO Name</th>
                          <th className="px-2 py-2 font-semibold">Remarks</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stagedPemsContainers.map((container) => (
                          <tr key={container.id} className="border-t border-slate-100 text-slate-700">
                            <td className="px-2 py-2 font-medium">{safeValue(container.containerNumber)}</td>
                            <td className="px-2 py-2">Consumable</td>
                            <td className="px-2 py-2">{safeValue(packRfpText || container.releaseNumber)}</td>
                            <td className="px-2 py-2">
                              {container.emptyInspection === "Passed"
                                ? "Pass"
                                : container.emptyInspection === "Failed"
                                  ? "Fail"
                                  : "Pending"}
                            </td>
                            <td className="px-2 py-2">{safeValue(container.sealNumber)}</td>
                            <td className="px-2 py-2">{stagingExpiryDate}</td>
                            <td className="px-2 py-2">{safeValue(pemsDraft.aoSignoff)}</td>
                            <td className="px-2 py-2 align-top">
                              <textarea
                                className={cn(stagingInputClass, "min-h-[2.5rem] resize-y")}
                                value={getContainerInspectionRemark(container)}
                                onChange={(e) =>
                                  updatePackContainer(container.id, containerInspectionRemarkPatch(e.target.value))
                                }
                                placeholder="Remarks"
                                rows={2}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <PemsStagingField label="Submitted AO Name" value={safeValue(pemsDraft.aoSignoff)} />
                    <PemsStagingField label="Submitted AO Number" value={safeValue(selectedAoNumber)} />
                  </div>
                  <PemsStagingFormField label="Comments">
                    <input
                      className={stagingInputClass}
                      value={pemsDraft.ecrComments ?? ""}
                      onChange={(e) => updatePemsDraft({ ecrComments: e.target.value })}
                      placeholder="N/A"
                      required
                    />
                  </PemsStagingFormField>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
      ) : null}

      {activeTab === "accounting" ? (
      <div className="space-y-4">
        <section className={sectionClass}>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-700">Revenue</h2>
          <p className="text-sm text-slate-500">
            Revenue calculations will appear once commodity pricing and container data are connected.
          </p>
        </section>
        <section className={sectionClass}>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-700">Expense</h2>
          <p className="text-sm text-slate-500">Cost-side lines will be added in a future release.</p>
        </section>
      </div>
      ) : null}

      {activeTab === "fumigation" && pack.fumigationRequired ? (
      <section className={sectionClass}>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-700">Fumigation</h2>
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <FormRow label="Fumigant">
              <select
                className={inputClass}
                value={pack.fumigantId ?? ""}
                onChange={(e) => {
                  const fumigantId = e.target.value ? Number(e.target.value) : null;
                  setPack((prev) => {
                    const nextMethodology =
                      prev.methodologyId && Number(prev.methodologyId)
                        ? methodologies.find((item) => Number(item.id) === Number(prev.methodologyId))
                        : null;
                    return {
                      ...prev,
                      fumigantId,
                      methodologyId:
                        nextMethodology && fumigantId && Number(nextMethodology.fumigantId) === Number(fumigantId)
                          ? prev.methodologyId
                          : null,
                    };
                  });
                }}
              >
                <option value="">- Select -</option>
                {fumigants.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.code} - {item.name}
                  </option>
                ))}
              </select>
            </FormRow>
            <FormRow label="Methodology">
              <select
                className={inputClass}
                value={pack.methodologyId ?? ""}
                onChange={(e) => set("methodologyId", e.target.value ? Number(e.target.value) : null)}
                disabled={!pack.fumigantId}
              >
                <option value="">- Select -</option>
                {fumigationMethodologyOptions.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                    {item.version ? ` (${item.version})` : ""}
                  </option>
                ))}
              </select>
            </FormRow>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <FormRow label="Certificate template">
              <select
                className={inputClass}
                value={pack.certificateTemplateId ?? ""}
                onChange={(e) =>
                  set("certificateTemplateId", e.target.value ? Number(e.target.value) : null)
                }
              >
                <option value="">- Select -</option>
                {certificateTemplates.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </FormRow>
            <FormRow label="Record template">
              <select
                className={inputClass}
                value={pack.recordTemplateId ?? ""}
                onChange={(e) =>
                  set("recordTemplateId", e.target.value ? Number(e.target.value) : null)
                }
              >
                <option value="">- Select -</option>
                {recordTemplates.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </FormRow>
          </div>

          {selectedFumigationMethodology ? (
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
              <p className="font-semibold text-slate-800">
                {selectedFumigationMethodology.name}
                {selectedFumigationMethodology.version ? ` ${selectedFumigationMethodology.version}` : ""}
              </p>
              <p className="mt-1">Dosage guide: {selectedFumigationMethodology.dosageGuide || "—"}</p>
              <p className="mt-1">Safety notes: {selectedFumigationMethodology.safetyNotes || "—"}</p>
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <FormRow label="Application method">
              <select
                className={inputClass}
                value={fd.applicationMethod || "in-container"}
                onChange={(e) => updateFumigationDetail({ applicationMethod: e.target.value })}
              >
                {PACK_FUMIGATION_APPLICATION_METHOD.map((method) => (
                  <option key={method} value={method}>
                    {PACK_FUMIGATION_APPLICATION_LABELS[method] || method}
                  </option>
                ))}
              </select>
            </FormRow>
            <FormRow label="Fumigator">
              <input
                className={inputClass}
                value={fd.fumigatorName || ""}
                onChange={(e) => updateFumigationDetail({ fumigatorName: e.target.value })}
                placeholder="Fumigator name"
              />
            </FormRow>
            <FormRow label="Volume (m3)">
              <input
                className={inputClass}
                type="number"
                step="any"
                value={fd.volumeM3 ?? ""}
                onChange={(e) => updateFumigationDetail({ volumeM3: e.target.value })}
              />
            </FormRow>
            <FormRow label="Actual tonnage (MT)">
              <input
                className={inputClass}
                type="number"
                step="any"
                value={fd.actualTonnage ?? ""}
                onChange={(e) => updateFumigationDetail({ actualTonnage: e.target.value })}
              />
            </FormRow>
            <FormRow label="Dosage value">
              <input
                className={inputClass}
                type="number"
                step="any"
                value={fd.dosageValue ?? ""}
                onChange={(e) => updateFumigationDetail({ dosageValue: e.target.value })}
              />
            </FormRow>
            <FormRow label="Dosage unit">
              <select
                className={inputClass}
                value={fd.dosageUnit || "ppm"}
                onChange={(e) => updateFumigationDetail({ dosageUnit: e.target.value })}
              >
                {PACK_FUMIGATION_DOSAGE_UNITS.map((unit) => (
                  <option key={unit} value={unit}>
                    {unit}
                  </option>
                ))}
              </select>
            </FormRow>
            <FormRow label="Exposure time value">
              <input
                className={inputClass}
                type="number"
                step="any"
                value={fd.exposureTimeValue ?? ""}
                onChange={(e) => updateFumigationDetail({ exposureTimeValue: e.target.value })}
              />
            </FormRow>
            <FormRow label="Exposure time unit">
              <select
                className={inputClass}
                value={fd.exposureTimeUnit || "hours"}
                onChange={(e) => updateFumigationDetail({ exposureTimeUnit: e.target.value })}
              >
                {FUMIGATION_MIN_EXPOSURE_UNITS.map((unit) => (
                  <option key={unit} value={unit}>
                    {unit}
                  </option>
                ))}
              </select>
            </FormRow>
            <FormRow label="Calculated dosage (value)">
              <input
                className={inputClass}
                type="number"
                step="any"
                value={fd.calculatedDosageValue ?? ""}
                onChange={(e) => updateFumigationDetail({ calculatedDosageValue: e.target.value })}
              />
            </FormRow>
            <FormRow label="Calculated dosage (unit)">
              <select
                className={inputClass}
                value={fd.calculatedDosageUnit || "g"}
                onChange={(e) => updateFumigationDetail({ calculatedDosageUnit: e.target.value })}
              >
                {PACK_FUMIGATION_MASS_UNITS.map((unit) => (
                  <option key={unit} value={unit}>
                    {unit}
                  </option>
                ))}
              </select>
            </FormRow>
          </div>

          <FormRow label="Enclosure description">
            <input
              className={inputClass}
              value={fd.enclosureDescription || ""}
              onChange={(e) => updateFumigationDetail({ enclosureDescription: e.target.value })}
              placeholder="Container, chamber, sheeted stack..."
            />
          </FormRow>
          <FormRow label="Clearance">
            <input
              className={inputClass}
              value={fd.clearanceValue ?? ""}
              onChange={(e) => updateFumigationDetail({ clearanceValue: e.target.value })}
              placeholder="Clearance period/value"
            />
          </FormRow>
        </div>
      </section>
      ) : null}

      {editingContainerId && selectedEditContainer ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Close container editor"
            className="absolute inset-0 bg-slate-900/45"
            onClick={() => setEditingContainerId(null)}
          />
          <div className="relative z-10 max-h-[90vh] w-full max-w-5xl overflow-auto rounded-xl border border-slate-200 bg-white p-4 shadow-xl">
            <div className="mb-3 flex items-center gap-2">
              <h3 className="text-sm font-semibold text-slate-900">Container #{selectedEditContainer.order}</h3>
              <span className="ms-auto text-xs text-slate-500">{selectedEditContainer.containerNumber || "Draft container"}</span>
            </div>

            <ContainerFormSections
              container={selectedEditContainer}
              onChange={(patch) => updatePackContainer(selectedEditContainer.id, patch)}
              packerNames={packerNames}
              yesNoOptions={YES_NO_OPTIONS}
              inspectionOptions={INSPECTION_OPTIONS}
              praTemplateOptions={PRA_TEMPLATE_OPTIONS}
              praStatusOptions={PRA_STATUS_OPTIONS}
              isoOptions={["22G1", "42G1", "45G1", "L5G1"]}
              stockBayOptions={["Silo 1", "Silo 2", "Silo 3", "Bay 12", "Shed C"]}
              inputClass={inputClass}
              sectionCardClass="mt-3 rounded-lg border border-slate-200/90 bg-slate-50/30"
              sectionHeaderClass="border-b border-slate-200 bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-800"
              fieldNames={{
                containerNo: "containerNumber",
                sealNo: "sealNumber",
                isoCode: "containerIsoCode",
              }}
              onResetContainer={selectedEditContainerActions?.onResetContainer}
              onMarkPacked={selectedEditContainerActions?.onMarkPacked}
              onSubmitPra={selectedEditContainerActions?.onSubmitPra}
            />

            <div className="mt-3 flex justify-end gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setEditingContainerId(null)}>
                Cancel
              </Button>
              <Button type="button" size="sm" onClick={() => setEditingContainerId(null)}>
                Save
              </Button>
            </div>
          </div>
        </div>
      ) : null}
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
