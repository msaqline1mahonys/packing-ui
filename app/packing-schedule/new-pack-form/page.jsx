"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { useNavDock, useSite } from "@/components/erp-navbar";
import { createPraActionHandlers } from "@/components/pems/container-form-actions";
import ContainerFormSections from "@/components/pems/container-form-sections";
import PackFileList from "@/components/pack-file-list";
import { Button } from "@/components/ui/button";
import { hasPermission } from "@/lib/use-user-permissions";
import {
  PACK_STATUSES,
  PACK_TEMPLATE,
  REFERENCE_CONTAINER_CODE_ROWS,
  SAMPLE_STATUSES,
} from "@/lib/Data";
import BulkContainerImportPanel from "@/components/packing-schedule/bulk-container-import-dialog";
import { ensureReleaseLineOnPack } from "@/lib/container-bulk-import";
import QuickAddVesselModal from "@/components/packing-schedule/quick-add-vessel-modal";
import {
  loadCertificateTemplates,
  loadFumigants,
  loadMethodologies,
  loadRecordTemplates,
} from "@/lib/fumigation-store";
import { ENCLOSURE_TYPES, FUMIGATION_TARGETS } from "@/lib/fumigation-fields";
import { loadContactUsers } from "@/lib/contact-users-store";
import { filterAuthorisedOfficers } from "@/lib/user-classifications";
import {
  buildPemsInspectionPayload,
  isPemsRfpRefreshError,
  pemsRfpRefreshUserMessage,
  submitPemsInspectionFlow,
  validatePemsSubmission,
} from "@/lib/pems";
import { defaultPemsDraftFields } from "@/lib/pems/constants";
import PemsTab from "@/components/pems/pems-tab";
import PackAccountingTab from "@/components/accounting/pack-accounting-tab";
import { savePack } from "@/lib/pack-schedule-store";
import { packAssignedPackerOptions, performBlend } from "@/lib/api/packing";
import { fetchStockByLocationForAccount } from "@/lib/stock-transfers-api";
import { totalNettWeight, countPackedContainers } from "@/lib/packers-container-validation";
import { useAllPackLookups } from "@/lib/hooks/use-pack-form-data";
import { useTestsCatalog } from "@/lib/hooks/use-tests-catalog";
import TestResultsSection from "@/components/quality-tests/TestResultsSection";
import { useInvalidateReferenceData, usePemsInspectionRemarksQuery } from "@/lib/hooks/use-reference-data-queries";
import {
  RELEASE_STATUSES,
  blankRelease,
  computeReleaseExpiry,
} from "@/lib/releases-store";
import { saveRelease } from "@/lib/releases-api";
import { resolvePackRfpRef } from "@/lib/pems-rfp-display";
import { attachPemsSubmissionSnapshot } from "@/lib/pems-staging-snapshot";
import { CONTAINER_INSPECTION_REMARK_FIELD } from "@/lib/pems-container-fields";
import { normalizePackAttachmentFiles } from "@/lib/pack-attachments";
import { readSiteRows } from "@/lib/site-data";
import { AlertCircle, Pencil, Plus, Trash2, X } from "lucide-react";

import { cn } from "@/lib/utils";
import ClutchSelect from "@/components/custom/ClutchSelect";

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
const YES_NO_STRINGS = ["No", "Yes"];
const YES_NO_OPTIONS = [{ value: "no", label: "No" }, { value: "yes", label: "Yes" }];
const PACK_TYPE_OPTIONS = [{ value: "container", label: "Container" }, { value: "bulk", label: "Bulk" }];
const IMPORT_EXPORT_OPTIONS = [{ value: "Import", label: "Import" }, { value: "Export", label: "Export" }];
const PACK_STATUS_OPTIONS = PACK_STATUSES.map((s) => ({ value: s, label: s }));
const DAFF_PERMISSION_SELECT_OPTIONS = DAFF_PERMISSION_OPTIONS.map((o) => ({ value: o, label: o }));
const FUMIGATION_TIMING_OPTIONS = [{ value: "pre-pack", label: "Pre-Pack" }, { value: "post-pack", label: "Post-Pack" }];
const FUMIGATION_RESULT_OPTIONS = [{ value: "pass", label: "Pass" }, { value: "fail", label: "Fail" }];
const APPLICATION_METHOD_OPTIONS = PACK_FUMIGATION_APPLICATION_METHOD.map((m) => ({ value: m, label: PACK_FUMIGATION_APPLICATION_LABELS[m] || m }));
const DOSAGE_UNIT_OPTIONS = PACK_FUMIGATION_DOSAGE_UNITS.map((u) => ({ value: u, label: u }));
const MASS_UNIT_OPTIONS = PACK_FUMIGATION_MASS_UNITS.map((u) => ({ value: u, label: u }));
const EXPOSURE_UNIT_OPTIONS = FUMIGATION_MIN_EXPOSURE_UNITS.map((u) => ({ value: u, label: u }));
const PEMS_RECORD_SELECT_OPTIONS = PEMS_RECORD_OPTIONS.map((o) => ({ value: o, label: o }));
const SAMPLE_TYPE_OPTIONS = SAMPLE_TYPES.map((t) => ({ value: t, label: t }));
const SAMPLE_STATUS_OPTIONS = SAMPLE_STATUSES.map((s) => ({ value: s, label: s }));
const RELEASE_STATUS_SELECT_OPTIONS = RELEASE_STATUSES.map((s) => ({ value: s, label: s }));
const PRA_STATUS_OPTIONS = ["Pending", "Accepted", "Rejected", "Error"];
const PRA_TEMPLATE_OPTIONS = ["Original", "Resubmit", "Correction"];

const inputClass =
  "w-full min-w-0 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-900 outline-none ring-brand/15 focus:border-brand/35 focus:ring-2";

const gridClass = "grid gap-x-2.5 gap-y-1.5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5";
const gridClassDense = "grid gap-x-2 gap-y-1.5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4";
const sectionClass = "min-w-0 rounded-lg border border-slate-200/95 bg-white p-2 shadow-sm";
const sectionRowClass = "grid items-stretch gap-1.5";
const flushSectionClass = cn(sectionClass, "flex h-full min-h-0 flex-col");
const flushSectionBodyClass = "flex min-h-0 flex-1 flex-col";
const sectionColumnsClass = cn(sectionRowClass, "xl:grid-cols-2 2xl:grid-cols-3");
const containersShippingRowClass = cn(sectionRowClass, "xl:grid-cols-2");
const shippingGridClass = "grid min-h-0 flex-1 grid-cols-3 grid-rows-4 items-start gap-x-2 gap-y-2";
const topRowSectionsClass = cn(sectionRowClass, "lg:grid-cols-3");
const sectionStackClass = "grid grid-cols-1 gap-y-1.5";
const spanFullClass = "col-span-full";
const importPermitRfpRowClass = cn(sectionRowClass, "xl:grid-cols-[minmax(13rem,20rem)_minmax(0,1fr)]");
const rfpGridClass = "grid grid-cols-2 gap-x-2 gap-y-1.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6";
const rfpFilesRowClass = "mt-1.5 grid gap-2 sm:grid-cols-2";
const innerPanelClass = "space-y-2 rounded-md border border-slate-200 bg-slate-50/40 p-2.5";

function safeValue(value) {
  if (value == null || String(value).trim() === "") return "";
  return String(value);
}

function formatDateTimeValue(value) {
  if (value == null || String(value).trim() === "") return "";
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

/** Normalize a release (DB or localStorage shape) into a uniform dropdown option. */
function normalizeReleaseOption(r) {
  const parks = (Array.isArray(r.parks) ? r.parks : []).map((p) => ({
    containerParkId: p.container_park_id ?? p.containerParkId ?? "",
    transporterIds: Array.isArray(p.transporters)
      ? p.transporters.map((t) => t?.id ?? t).filter(Boolean)
      : (p.transporterIds ?? p.transporter_ids ?? []).filter(Boolean),
  }));
  return {
    id: r.id,
    releaseNumber: r.release_number ?? r.releaseNumber ?? "",
    status: r.status ?? "",
    parks,
  };
}

function vesselDisplayName(voyage) {
  if (!voyage) return "";
  const vessel = voyage.vessel;
  if (vessel && typeof vessel === "object") return vessel.vessel_name ?? vessel.vesselName ?? "";
  if (typeof vessel === "string") return vessel;
  return voyage.vesselName ?? voyage.vessel_name ?? "";
}

function vesselImportScheduleFields(voyage) {
  if (!voyage) return {};
  return {
    vesselEta: voyage.vessel_eta ?? voyage.vesselEta ?? "",
    firstFreeImportDate: voyage.first_free_import_date ?? voyage.firstFreeImportDate ?? "",
    importStorageStartDate: voyage.import_storage_start_date ?? voyage.importStorageStartDate ?? "",
    vesselFreeDays: voyage.vessel_free_days ?? voyage.vesselFreeDays ?? null,
  };
}

function resolveTerminalFromVoyage(voyage, terminalOptions) {
  if (!voyage) return { terminalId: "", portOfLoading: "" };
  const terminalId = voyage.terminal_id ?? voyage.terminalId ?? "";
  let portOfLoading = "";
  if (terminalId && Array.isArray(terminalOptions)) {
    const matched = terminalOptions.find((t) => String(t.id) === String(terminalId));
    portOfLoading = matched?.port_of_loading ?? matched?.portOfLoading ?? "";
  }
  if (!portOfLoading) {
    portOfLoading =
      voyage.loadPort?.name ??
      voyage.load_port?.name ??
      (typeof voyage.loadPort === "string" ? voyage.loadPort : "") ??
      "";
  }
  return {
    terminalId: terminalId ? String(terminalId) : "",
    portOfLoading: String(portOfLoading || "").trim(),
  };
}

function applySelectedVoyageToPack(prev, voyage, isImportJob, terminalOptions) {
  if (!voyage) {
    return {
      ...prev,
      vesselDepartureId: null,
      vesselName: "",
    };
  }
  const { terminalId: resolvedTerminalId, portOfLoading: resolvedPortOfLoading } = resolveTerminalFromVoyage(
    voyage,
    terminalOptions,
  );
  const terminalId =
    resolvedTerminalId ||
    (voyage.terminal_id ?? voyage.terminalId ?? prev.terminalId ?? "");
  const shippingLineId =
    voyage.shipping_line_id ??
    voyage.shippingLineId ??
    voyage.vessel?.shipping_line_id ??
    voyage.vessel?.shippingLineId ??
    prev.shippingLineId ??
    "";
  const importFields = vesselImportScheduleFields(voyage);
  const nextFreeDays =
    isImportJob && importFields.vesselFreeDays != null && importFields.vesselFreeDays !== ""
      ? importFields.vesselFreeDays
      : prev.freeDays;
  const nextPortOfLoading =
    resolvedPortOfLoading && !String(prev.portOfLoading ?? "").trim()
      ? resolvedPortOfLoading
      : prev.portOfLoading;

  return {
    ...prev,
    vesselDepartureId: voyage.id ?? prev.vesselDepartureId,
    vesselName: vesselDisplayName(voyage),
    voyageNumber: voyage.voyage_number ?? voyage.voyageNumber ?? prev.voyageNumber,
    lloydId: voyage.vessel?.lloyds_number ?? voyage.vessel?.lloydsNumber ?? prev.lloydId,
    terminalId: terminalId || prev.terminalId,
    portOfLoading: nextPortOfLoading,
    shippingLineId: shippingLineId || prev.shippingLineId,
    freeDays: nextFreeDays,
    vesselCutoffDate: toDateInputValue(voyage.vessel_cutoff_date ?? voyage.vesselCutoffDate) || prev.vesselCutoffDate,
    etd: toDateInputValue(voyage.vessel_etd ?? voyage.vesselEtd ?? voyage.etd) || prev.etd,
  };
}

function toDateInputValue(value) {
  if (!value) return "";
  const match = String(value).trim().match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : "";
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
    ...defaultPemsDraftFields(),
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
    fumigationType: "ambient",
    targetOfFumigation: ["commodity"],
    enclosureType: "",
    enclosureOtherText: "",
    enclosureDescription: "",
    enclosureLengthM: "",
    enclosureWidthM: "",
    enclosureHeightM: "",
    volumeM3: "",
    consignmentSuitable: true,
    consignmentRemedialAction: "",
    actualTonnage: "",
    minForecastedTemperature: "",
    minAmbientTemperature: "",
    actualTemperature: "",
    prescribedDoseRate: "",
    prescribedDoseUnit: "g/m3",
    prescribedExposure: "",
    prescribedExposureUnit: "hours",
    prescribedTemperature: "",
    dosageValue: "",
    dosageUnit: "g/m3",
    calculatedDosageValue: "",
    calculatedDosageUnit: "g",
    specificDosageRateValue: "",
    specificDosageRateUnit: "g/m3",
    actualDosageAppliedValue: "",
    actualDosageAppliedUnit: "g",
    chloropicrinUsed: null,
    chloropicrinPercent: "",
    heatersUsed: null,
    endPointConcentration: "",
    endPointConcentrationUnit: "g/m3",
    ctRequired: "",
    ctAchieved: "",
    thirdPartySystem: false,
    thirdPartySystemName: "",
    exposureTimeValue: "",
    exposureTimeUnit: "hours",
    fumigationStartAt: "",
    dosingFinishAt: "",
    fumigationEndAt: "",
    ventilationStartAt: "",
    monitoringDeviceSerials: "",
    finalTlvPpm1: "",
    finalTlvPpm2: "",
    finalTlvPpm3: "",
    clearanceValue: "",
    topUpEntries: [],
    fumigatorName: "",
    fumigationResult: "pass",
    governmentOfficerName: "",
    governmentOfficerSignature: "",
    additionalDeclarations: "",
    fumigationNotes: "",
  };
}

function defaultIsoForContainerCode(containerCode) {
  return ISO_BY_CONTAINER_CODE[String(containerCode || "").toUpperCase()] || "";
}

function createDraftContainer(pack, index, existing = {}) {
  const order = index + 1;
  // Pre-fill release details from the pack's first release when the container has none set
  const firstRelease = Array.isArray(pack.releaseDetails) ? pack.releaseDetails[0] : null;
  const hasExistingRelease = existing.releaseNumber || existing.emptyContainerParkId || existing.transporterId;
  return {
    id: existing.id || `container-${order}`,
    packId: existing.packId ?? pack.id ?? null,
    order,
    containerNumber: existing.containerNumber ?? existing.containerNo ?? "",
    containerCode: existing.containerCode ?? pack.containerCode ?? "",
    containerIsoCode:
      existing.containerIsoCode ||
      existing.isoCode ||
      defaultIsoForContainerCode(existing.containerCode) ||
      pack.containerCode ||
      "",
    sealNumber: existing.sealNumber ?? existing.sealNo ?? "",
    releaseNumber: existing.releaseNumber ?? (hasExistingRelease ? "" : (firstRelease?.releaseRef ?? "")),
    releasePark: existing.releasePark ?? "",
    transporter: existing.transporter ?? "",
    emptyContainerParkId: existing.emptyContainerParkId ?? (hasExistingRelease ? "" : (firstRelease?.emptyContainerParkId ?? "")),
    transporterId: existing.transporterId ?? (hasExistingRelease ? "" : (firstRelease?.transporterId ?? "")),
    startDate: existing.startDate ?? pack.packingStartDate ?? new Date().toISOString().slice(0, 10),
    startHour: existing.startHour ?? "",
    startMinute: existing.startMinute ?? "",
    grainLocation: existing.grainLocation ?? "",
    stockBayId: existing.stockBayId ?? "",
    packer: existing.packer ?? "",
    tare: existing.tare != null && existing.tare !== "" ? existing.tare : null,
    grossWeight: existing.grossWeight != null && existing.grossWeight !== "" ? existing.grossWeight : null,
    nettWeight: existing.nettWeight != null && existing.nettWeight !== "" ? existing.nettWeight : null,
    containerTareWeight: existing.containerTareWeight != null && existing.containerTareWeight !== "" ? existing.containerTareWeight : null,
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
    tests: existing.tests && typeof existing.tests === "object" ? existing.tests : {},
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
  containerCodeId: "",
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
  // Blend pack
  isBlend: false,
  blendComponents: [],
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

const normalizeFileItems = normalizePackAttachmentFiles;

function toFileEntries(fileList) {
  return Array.from(fileList || []).map((file, index) => ({
    id: `${file.name}-${file.lastModified}-${index}`,
    name: file.name,
    size: file.size,
    type: file.type,
    file,
  }));
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

async function resolveFileItemsForSave(items) {
  const normalized = normalizePackAttachmentFiles(items);
  return Promise.all(
    normalized.map(async (item) => {
      if (item.file instanceof File && !item.url) {
        try {
          const url = await readFileAsDataUrl(item.file);
          return { ...item, url };
        } catch {
          return item;
        }
      }
      return item;
    })
  );
}

function rowToPack(row, siteId, customerOpts, commodityOpts) {
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
  const rawDetail = row.fumigationDetail ?? row.fumigation_detail;
  const detail =
    rawDetail && typeof rawDetail === "object"
      ? { ...blankFumigationDetail(), ...rawDetail }
      : blankFumigationDetail();
  const customers = Array.isArray(customerOpts) ? customerOpts : [];
  const commodities = Array.isArray(commodityOpts) ? commodityOpts : [];
  const resolvedCustomerId =
    row.customer_id ?? row.customerId ??
    customers.find((c) => c.name === row.customer)?.id ?? "";
  const resolvedExporterId =
    row.exporter_id ?? row.exporterId ??
    (typeof row.exporter === "string" ? customers.find((c) => c.name === row.exporter)?.id ?? "" : row.exporter ?? "");
  const resolvedCommodityId =
    row.commodity_id ?? row.commodityId ??
    commodities.find((c) => c.description === row.commodity)?.id ?? "";
  const resolvedCommodityTypeId =
    row.commodity_type_id ?? row.commodityTypeId ??
    commodities.find((c) => c.id === resolvedCommodityId)?.commodity_type_id ??
    commodities.find((c) => c.description === row.commodity)?.commodityTypeId ?? "";
  const resolvedVesselVoyageId = row.vessel_voyage_id ?? row.vesselVoyageId ?? row.vesselDepartureId ?? null;
  const resolvedTerminalId = row.terminal_id ?? row.terminalId ?? "";
  const resolvedShippingLineId = row.shipping_line_id ?? row.shippingLineId ?? "";
  return {
    ...blankPack(siteId),
    importExport: (row.import_export ?? row.importExport) || "Export",
    status: row.status || "Pending",
    customerId: resolvedCustomerId,
    exporter: resolvedExporterId,
    commodityId: resolvedCommodityId,
    commodityTypeId: resolvedCommodityTypeId,
    shippingLineId: resolvedShippingLineId,
    jobReference: (row.job_reference ?? row.jobReference) || "",
    packNumber: (row.pack_number ?? row.packNumber) || "",
    containersRequired: (row.containers_required ?? row.containersRequired) ?? "",
    mtTotal: (row.mt_total ?? row.mtTotal) ?? "",
    containerCode: (typeof row.container_code === "object" ? row.container_code?.iso_code : row.container_code) ?? row.containerCode ?? "",
    containerCodeId: row.container_code?.id ?? row.container_code_id ?? row.containerCodeId ?? "",
    packType: (row.pack_type ?? row.packType) || "container",
    testRequired: Boolean(row.test_required ?? row.testRequired),
    shrinkTaken: Boolean(row.shrink_taken ?? row.shrinkTaken),
    plannedInspectionDate: formatDateTimeInput(row.planned_inspection_date ?? row.plannedInspectionDate) || "",
    daffInspectionBooked: row.daff_inspection_booked ?? row.daffInspectionBooked ?? null,
    daffConfirmedDate: formatDateTimeInput(row.daff_confirmed_date ?? row.daffConfirmedDate) || "",
    unloadingLocation: (row.unloading_location ?? row.unloadingLocation) || "",
    importDirectionsReceived: row.import_directions_received ?? row.importDirectionsReceived ?? null,
    importDirectionCode: (row.import_direction_code ?? row.importDirectionCode) || "",
    edoReceived: row.edo_received ?? row.edoReceived ?? null,
    dateCollected: formatDateTimeInput(row.date_collected ?? row.dateCollected) || "",
    freeDays: (row.free_days ?? row.freeDays) ?? "",
    dehireByDate: formatDateTimeInput(row.dehire_by_date ?? row.dehireByDate) || "",
    finalDehireDate: formatDateTimeInput(row.final_dehire_date ?? row.finalDehireDate) || "",
    importPackNotes: (row.import_pack_notes ?? row.importPackNotes) || "",
    sampleRequired: Boolean(row.sample_required ?? row.sampleRequired),
    quantityPerContainer: (row.quantity_per_container ?? row.quantityPerContainer) ?? "",
    maxQtyPerContainer: (row.max_qty_per_container ?? row.maxQtyPerContainer) ?? "",
    destinationPort: (row.destination_port ?? row.destinationPort) || "",
    transshipmentPort: (row.transshipment_port ?? row.transshipmentPort) || "",
    transshipmentPortCode: (row.transshipment_port_code ?? row.transshipmentPortCode) || "",
    rfpComment: (row.rfp_comment ?? row.rfpComment) || "",
    rfpExpiry: (row.rfp_expiry ?? row.rfpExpiry) || "",
    rfpCommodityCode: (row.rfp_commodity_code ?? row.rfpCommodityCode) || "",
    rfpPackType: (row.rfp_pack_type ?? row.rfpPackType) || "",
    rfpTotalQuantity: (row.rfp_total_quantity ?? row.rfpTotalQuantity) ?? "",
    rfpQuantityUnit: (row.rfp_quantity_unit ?? row.rfpQuantityUnit) || "M/TONS",
    rfpFlowPath: (row.rfp_flow_path ?? row.rfpFlowPath) || "",
    originalRfpNumber: (row.original_rfp_number ?? row.originalRfpNumber) || "",
    assignedPackerIds: Array.isArray(row.packer_assignments)
      ? row.packer_assignments.map((a) => String(a.packer_id ?? a.packerId ?? "")).filter(Boolean)
      : Array.isArray(row.assigned_packers ?? row.assignedPackers)
        ? (row.assigned_packers ?? row.assignedPackers).map((p) => String(p.id ?? "")).filter(Boolean)
        : Array.isArray(row.assigned_packer_ids ?? row.assignedPackerIds)
          ? (row.assigned_packer_ids ?? row.assignedPackerIds).map(String)
          : [],
    assignedPackers: Array.isArray(row.assigned_packers ?? row.assignedPackers)
      ? (row.assigned_packers ?? row.assignedPackers)
      : Array.isArray(row.packer_assignments)
        ? row.packer_assignments.map((a) => ({
            id: a.packer_id ?? a.packerId,
            name: a.packer?.name ?? a.name ?? "",
            status: a.packer?.status ?? a.status ?? "Active",
          })).filter((p) => p.id)
        : [],
    releaseDetails: Array.isArray(row.releases) ? row.releases.map((r) => ({
      releaseRef: r.release_ref ?? r.releaseRef ?? "",
      emptyContainerParkId: r.empty_container_park_id ?? r.emptyContainerParkId ?? null,
      transporterId: r.transporter_id ?? r.transporterId ?? null,
    })) : Array.isArray(row.releaseDetails) ? row.releaseDetails : legacyReleaseDetails,
    destinationCountry: (row.destination_country ?? row.destinationCountry) || "",
    terminalId: resolvedTerminalId,
    portOfLoading: (row.port_of_loading ?? row.portOfLoading) || "",
    commodityCountryOfOrigin: (row.commodity_country_of_origin ?? row.commodityCountryOfOrigin) || "Australia",
    treatmentProviderId: (row.treatment_provider_id ?? row.treatmentProviderId) || "",
    fumigatorAccreditationNumber: (row.fumigator_accreditation_number ?? row.fumigatorAccreditationNumber) || "",
    vesselDepartureId: resolvedVesselVoyageId,
    vesselName: row.vessel_voyage?.vessel?.vessel_name ?? row.vesselVoyage?.vessel?.vesselName ?? row.vessel ?? "",
    packingStartDate: toDateInputValue(row.packing_start_date ?? row.packingStartDate),
    packConfirmed: Boolean(row.pack_confirmed ?? row.packConfirmed),
    voyageNumber: (row.voyage_number ?? row.voyageNumber) || "",
    lloydId: (row.lloyd_id ?? row.lloydId) || "",
    vesselCutoffDate: (row.vessel_cutoff_date ?? row.vesselCutoffDate) || "",
    etd: row.etd ?? "",
    fumigation: row.fumigation || detail.fumigationNotes || "",
    fumigationRequired: Boolean(row.fumigation_required ?? row.fumigationRequired),
    fumigationTiming: (row.fumigation_timing ?? row.fumigationTiming) || "",
    fumigantId: (row.fumigant_id ?? row.fumigantId) ?? null,
    methodologyId: (row.methodology_id ?? row.methodologyId) ?? null,
    certificateTemplateId: (row.certificate_template_id ?? row.certificateTemplateId) ?? null,
    recordTemplateId: (row.record_template_id ?? row.recordTemplateId) ?? null,
    containers: buildPackContainers(row, row),
    fumigationDetail: detail,
    daffPermission: (row.daff_permission ?? row.daffPermission) || "N/A",
    edn: row.edn || "",
    importPermitRequired: Boolean(row.import_permit_required ?? row.importPermitRequired),
    importPermitNumber: (row.import_permit_number ?? row.importPermitNumber) || "",
    importPermitDate: (row.import_permit_date ?? row.importPermitDate) || "",
    packWarningRequired: Boolean(row.pack_warning_required ?? row.packWarningRequired),
    packWarning: (row.pack_warning ?? row.packWarning) || "",
    jobNotes: (row.job_notes ?? row.jobNotes) || "",
    date: row.date || new Date().toISOString().slice(0, 10),
    sampleEntries: Array.isArray(row.samples) ? row.samples.map((s) => ({
      type: s.type ?? "Pre",
      sampleLocation: s.sample_location ?? s.sampleLocation ?? "",
      sampleSentDate: s.sample_sent_date ?? s.sampleSentDate ?? "",
      status: s.status ?? SAMPLE_STATUSES[0] ?? "Pending",
      notes: s.notes ?? "",
    })) : Array.isArray(row.sampleEntries) ? row.sampleEntries
      : (row.sampleStatuses || []).map((status, index) => ({
        type: "Pre",
        sampleLocation: row.sampleLocations?.[index] || "",
        sampleSentDate: row.sampleSentDates?.[index] || "",
        status: status || SAMPLE_STATUSES[0] || "Pending",
        notes: "",
      })),
    importPermitFiles: normalizeFileItems(
      row.importPermitFiles ??
      (Array.isArray(row.files) ? row.files.filter((f) => f.category === "importPermit") : null)
    ),
    additionalDeclarationFiles: normalizeFileItems(
      row.additionalDeclarationFiles ??
      (Array.isArray(row.files) ? row.files.filter((f) => f.category === "additionalDeclaration") : null)
    ),
    rfp: row.rfp || "",
    rfpFiles: normalizeFileItems(
      row.rfpFiles ??
      (Array.isArray(row.files) ? row.files.filter((f) => f.category === "rfp") : null)
    ),
    rfpAdditionalDeclarationRequired: Boolean(row.rfp_additional_declaration_required ?? row.rfpAdditionalDeclarationRequired),
    packingInstructionFiles: normalizeFileItems(
      row.packingInstructionFiles ??
      (Array.isArray(row.files) ? row.files.filter((f) => f.category === "packingInstruction") : row.files?.packingInstruction)
    ),
    importOrderFiles: normalizeFileItems(
      row.importOrderFiles ??
      (Array.isArray(row.files) ? row.files.filter((f) => f.category === "importOrder") : row.files?.importOrder)
    ),
    importPackingListFiles: normalizeFileItems(
      row.importPackingListFiles ??
      (Array.isArray(row.files) ? row.files.filter((f) => f.category === "importPackingList") : row.files?.importPackingList)
    ),
    importAdditionalFiles: normalizeFileItems(
      row.importAdditionalFiles ??
      (Array.isArray(row.files) ? row.files.filter((f) => f.category === "importAdditional") : row.files?.importAdditional)
    ),
    importContainerListFiles: normalizeFileItems(
      row.importContainerListFiles ??
      (Array.isArray(row.files) ? row.files.filter((f) => f.category === "importContainerList") : row.files?.importContainerList)
    ),
    pemsDraft: { ...defaultPemsDraft(), ...((row.pems_draft ?? row.pemsDraft) || {}) },
    pemsSubmissions: Array.isArray(row.pems_submissions ?? row.pemsSubmissions) ? (row.pems_submissions ?? row.pemsSubmissions) : [],
    // Blend pack
    isBlend: Boolean(row.is_blend ?? row.isBlend),
    blendComponents: (() => {
      const components = row.blend_components ?? row.blendComponents;
      if (!Array.isArray(components)) return [];
      return components.map((c) => ({
        commodityId: c.commodity_id ?? c.commodityId ?? null,
        locationId: c.location_id ?? c.locationId ?? null,
        quantity: c.quantity != null ? Number(c.quantity) : null,
        commodityName: c.commodity?.description ?? c.commodityName ?? "",
        locationName: c.location?.name ?? c.locationName ?? "",
        commodityTypeId: c.commodity?.commodity_type_id ?? c.commodity?.commodityTypeId ?? c.commodityTypeId ?? null,
      }));
    })(),
    blendPerformedAt: row.blend_performed_at ?? row.blendPerformedAt ?? null,
    blendTransferId: row.blend_transfer_id ?? row.blendTransferId ?? null,
    blendPending: Boolean((row.is_blend ?? row.isBlend) && !(row.blend_performed_at ?? row.blendPerformedAt)),
  };
}

function packToScheduleRow(pack, existingRow) {
  const sampleEntries = Array.isArray(pack.sampleEntries) ? pack.sampleEntries : [];
  const releaseDetails = Array.isArray(pack.releaseDetails) ? pack.releaseDetails : [];
  const containers = buildPackContainers(pack, existingRow);
  const detail =
    pack.fumigationDetail && typeof pack.fumigationDetail === "object"
      ? { ...blankFumigationDetail(), ...pack.fumigationDetail }
      : blankFumigationDetail();
  const fumigationSummary = String(detail.fumigationNotes || pack.fumigation || "").trim();
  return {
    id: existingRow?.id ?? null,
    importExport: pack.importExport,
    customerId: pack.customerId ?? null,
    commodityId: pack.commodityId ?? null,
    commodityTypeId: pack.commodityTypeId ?? null,
    exporterId: pack.exporter ?? null,
    shippingLineId: pack.shippingLineId ?? null,
    vessel_voyage_id: pack.vesselDepartureId ?? null,
    terminalId: pack.terminalId ?? "",
    status: pack.status,
    jobReference: pack.jobReference || "",
    packType: pack.packType || "container",
    containersRequired: pack.containersRequired === "" ? 0 : Number(pack.containersRequired),
    containerCodeId: pack.containerCodeId || null,
    quantityPerContainer: pack.quantityPerContainer === "" || pack.quantityPerContainer == null ? null : Number(pack.quantityPerContainer),
    maxQtyPerContainer: pack.maxQtyPerContainer === "" || pack.maxQtyPerContainer == null ? null : Number(pack.maxQtyPerContainer),
    mtTotal: pack.mtTotal === "" || pack.mtTotal == null ? null : Number(pack.mtTotal),
    releases: releaseDetails.filter((r) => r.releaseRef || r.emptyContainerParkId || r.transporterId),
    containers,
    destinationCountry: pack.destinationCountry || "",
    destinationPort: pack.destinationPort || "",
    transshipmentPort: pack.transshipmentPort || "",
    transshipmentPortCode: pack.transshipmentPortCode || "",
    portOfLoading: pack.portOfLoading || "",
    commodityCountryOfOrigin: pack.commodityCountryOfOrigin || "Australia",
    treatmentProviderId: pack.treatmentProviderId || "",
    fumigatorAccreditationNumber: pack.fumigatorAccreditationNumber || "",
    packingStartDate: pack.packingStartDate || "",
    packConfirmed: Boolean(pack.packConfirmed),
    voyageNumber: pack.voyageNumber || "",
    lloydId: pack.lloydId || "",
    vesselCutoffDate: pack.vesselCutoffDate || "",
    etd: pack.etd || "",
    fumigation: fumigationSummary,
    fumigationRequired: Boolean(pack.fumigationRequired),
    fumigationTiming: pack.fumigationTiming || "",
    fumigantId: pack.fumigantId || null,
    methodologyId: pack.methodologyId || null,
    certificateTemplateId: pack.certificateTemplateId || null,
    recordTemplateId: pack.recordTemplateId || null,
    fumigationDetail: detail,
    testRequired: Boolean(pack.testRequired),
    shrinkTaken: Boolean(pack.shrinkTaken),
    plannedInspectionDate: pack.plannedInspectionDate || null,
    daffInspectionBooked: pack.daffInspectionBooked ?? null,
    daffConfirmedDate: pack.daffConfirmedDate || null,
    unloadingLocation: pack.unloadingLocation || "",
    importDirectionsReceived: pack.importDirectionsReceived ?? null,
    importDirectionCode: pack.importDirectionCode || "",
    edoReceived: pack.edoReceived ?? null,
    dateCollected: pack.dateCollected || null,
    freeDays: pack.freeDays === "" || pack.freeDays == null ? null : Number(pack.freeDays),
    dehireByDate: pack.dehireByDate || null,
    finalDehireDate: pack.finalDehireDate || null,
    importPackNotes: pack.importPackNotes || "",
    sampleRequired: Boolean(pack.sampleRequired),
    daffPermission: pack.daffPermission || "N/A",
    edn: pack.edn || "",
    packWarningRequired: Boolean(pack.packWarningRequired),
    packWarning: pack.packWarning || "",
    jobNotes: pack.jobNotes || "",
    date: pack.date || new Date().toISOString().slice(0, 10),
    samples: sampleEntries,
    importPermitRequired: Boolean(pack.importPermitRequired),
    importPermitNumber: pack.importPermitNumber || "",
    importPermitDate: pack.importPermitDate || "",
    files: {
      importPermit: normalizeFileItems(pack.importPermitFiles),
      rfp: normalizeFileItems(pack.rfpFiles),
      packingInstruction: normalizeFileItems(pack.packingInstructionFiles),
      additionalDeclaration: normalizeFileItems(pack.additionalDeclarationFiles),
      importOrder: normalizeFileItems(pack.importOrderFiles),
      importPackingList: normalizeFileItems(pack.importPackingListFiles),
      importAdditional: normalizeFileItems(pack.importAdditionalFiles),
      importContainerList: normalizeFileItems(pack.importContainerListFiles),
    },
    importPermitFiles: normalizeFileItems(pack.importPermitFiles),
    importOrderFiles: normalizeFileItems(pack.importOrderFiles),
    importPackingListFiles: normalizeFileItems(pack.importPackingListFiles),
    importAdditionalFiles: normalizeFileItems(pack.importAdditionalFiles),
    importContainerListFiles: normalizeFileItems(pack.importContainerListFiles),
    additionalDeclarationFiles: normalizeFileItems(pack.additionalDeclarationFiles),
    rfp: pack.rfp || "",
    rfpAdditionalDeclarationRequired: Boolean(pack.rfpAdditionalDeclarationRequired),
    rfpComment: pack.rfpComment || "",
    rfpExpiry: pack.rfpExpiry || "",
    rfpCommodityCode: pack.rfpCommodityCode || "",
    rfpPackType: pack.rfpPackType || "",
    rfpTotalQuantity: pack.rfpTotalQuantity === "" || pack.rfpTotalQuantity == null ? null : Number(pack.rfpTotalQuantity),
    rfpQuantityUnit: pack.rfpQuantityUnit || "M/TONS",
    rfpFlowPath: pack.rfpFlowPath || "",
    originalRfpNumber: pack.originalRfpNumber || "",
    rfpFiles: normalizeFileItems(pack.rfpFiles),
    packingInstructionFiles: normalizeFileItems(pack.packingInstructionFiles),
    packer_assignments: Array.isArray(pack.assignedPackerIds)
      ? pack.assignedPackerIds.map((id) => ({ packer_id: id }))
      : [],
    assigned_packers: (() => {
      const ids = Array.isArray(pack.assignedPackerIds) ? pack.assignedPackerIds.map(String) : [];
      const fromPack = Array.isArray(pack.assignedPackers) ? pack.assignedPackers : [];
      if (fromPack.length) {
        return fromPack
          .filter((p) => ids.includes(String(p.id)))
          .map((p) => ({ id: p.id, name: p.name ?? "", status: p.status ?? "Active" }));
      }
      return ids.map((id) => ({ id, name: "", status: "Active" }));
    })(),
    pemsDraft: { ...defaultPemsDraft(), ...(pack.pemsDraft || {}) },
    pemsSubmissions: Array.isArray(pack.pemsSubmissions) ? pack.pemsSubmissions : [],
    // Blend pack
    isBlend: Boolean(pack.isBlend),
    blendComponents: Array.isArray(pack.blendComponents)
      ? pack.blendComponents
          .filter((c) => c.commodityId || c.locationId || c.quantity != null)
          .map((c) => ({
            commodityId: c.commodityId ?? null,
            locationId: c.locationId ?? null,
            quantity: c.quantity != null && c.quantity !== "" ? Number(c.quantity) : null,
          }))
      : [],
  };
}

function FormRow({ label, labelClassName, children, className = "" }) {
  return (
    <div className={cn("min-w-0 space-y-0.5", className)}>
      <label className={cn("block text-[10px] font-semibold uppercase leading-tight tracking-wide text-slate-500", labelClassName)}>
        {label}
      </label>
      {children}
    </div>
  );
}

/** Read-only field — matches packers schedule PEMs staging `Field` layout. */
function PemsStagingField({ label, value, labelClassName = "", valueClassName = "" }) {
  return (
    <div className="space-y-1">
      <div className={cn("text-[11px] font-semibold uppercase tracking-wide text-slate-500", labelClassName)}>{label}</div>
      <div className={cn("rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-700", valueClassName)}>{value}</div>
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
const stagingGridClass = "grid gap-x-2 gap-y-1.5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5";
const stagingGrid6Class = "grid gap-x-2 gap-y-1.5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6";
const stagingGrid3Class = "grid gap-x-2 gap-y-1.5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4";
const fumigationGridClass = "grid gap-x-2 gap-y-1.5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5";
const fumigationInnerClass = "flex h-full min-h-0 flex-col min-w-0 rounded-md border border-slate-200 bg-slate-50/40 p-2.5";
const fumigationTopGridClass = "grid gap-x-3 gap-y-2 sm:grid-cols-2 lg:grid-cols-3";
const GPPIR_WEIGHT_UNIT = "M/TONS";
const gppirTableCompactCol = "w-12 min-w-[3rem] max-w-[4rem] px-1 py-1.5 whitespace-nowrap text-center";
const gppirTableNarrowCol = "w-16 min-w-[3.5rem] px-1 py-1.5 whitespace-nowrap";
const gppirTableNumCol = "w-[4.5rem] min-w-[4rem] px-1 py-1.5 whitespace-nowrap text-right tabular-nums";
const gppirTableTypeCol = "w-[4.5rem] min-w-[4rem] px-1 py-1.5 whitespace-nowrap";
const gppirTableInspectionLevelCol = "w-[7.5rem] min-w-[7.5rem] px-2 py-2 whitespace-nowrap";
const gppirTableRfpCol = "w-[6.5rem] min-w-[6.5rem] px-2 py-2 whitespace-nowrap";
const gppirTableResultCol = "w-[4.5rem] min-w-[4.5rem] px-2 py-2 whitespace-nowrap";
const gppirTableSealCol = "w-[6rem] min-w-[6rem] px-2 py-2 whitespace-nowrap";
const gppirTableExpiryDateCol = "w-[6.5rem] min-w-[6.5rem] px-2 py-2 whitespace-nowrap text-center";
const gppirTableInspectionAoCol = "w-[9rem] min-w-[9rem] px-2 py-2 whitespace-nowrap";
const gppirTableContainerCol = "w-[7rem] min-w-[7rem] px-2 py-2 whitespace-nowrap";
const gppirTableCellCol = "px-1.5 py-1.5";
const gppirTableRemarksCol = "w-[10rem] min-w-[10rem] px-2 py-2 align-top";

function blankBlendComponent() {
  return { commodityId: null, locationId: null, quantity: null, commodityName: "", locationName: "", commodityTypeId: null };
}

function useBlendLocationStock(customerId, commodityId) {
  const [locationStock, setLocationStock] = useState([]);
  const [loadingStock, setLoadingStock] = useState(false);

  useEffect(() => {
    if (!customerId || !commodityId) {
      setLocationStock([]);
      setLoadingStock(false);
      return undefined;
    }

    let cancelled = false;
    setLoadingStock(true);
    fetchStockByLocationForAccount({ accountId: customerId, commodityId })
      .then((rows) => {
        if (!cancelled) setLocationStock(rows);
      })
      .catch(() => {
        if (!cancelled) setLocationStock([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingStock(false);
      });

    return () => {
      cancelled = true;
    };
  }, [customerId, commodityId]);

  return { locationStock, loadingStock };
}

function BlendStockByLocationPanel({ locationStock, loading, selectedLocationId, onSelectLocation }) {
  if (loading) {
    return <p className="text-[10px] text-slate-400">Loading stock by location…</p>;
  }
  if (!locationStock.length) {
    return (
      <p className="text-[10px] text-slate-400">
        No stock on hand at any location for this commodity.
      </p>
    );
  }

  return (
    <div className="space-y-0.5">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Stock by location</p>
      <div className="flex flex-wrap gap-1">
        {locationStock.map((loc) => {
          const selected = String(loc.locationId) === String(selectedLocationId ?? "");
          return (
            <button
              key={String(loc.locationId)}
              type="button"
              onClick={() => onSelectLocation?.(loc)}
              className={cn(
                "rounded border px-1.5 py-0.5 text-[10px] font-medium transition-colors",
                selected
                  ? "border-brand/40 bg-brand/10 text-brand-ink"
                  : "border-slate-200 bg-white text-slate-600 hover:border-brand/30 hover:bg-brand/5"
              )}
            >
              {loc.locationName}: {Number(loc.quantity).toLocaleString(undefined, { maximumFractionDigits: 3 })} MT
            </button>
          );
        })}
      </div>
    </div>
  );
}

function BlendComponentEditor({
  component,
  index,
  customerId,
  commoditySelectOpts,
  locationSelectOpts,
  inputClass,
  onUpdate,
  onRemove,
}) {
  const { locationStock, loadingStock } = useBlendLocationStock(customerId, component.commodityId);
  const selectedSoh =
    locationStock.find((loc) => String(loc.locationId) === String(component.locationId ?? ""))?.quantity ?? null;
  const exceeds = selectedSoh != null && Number(component.quantity) > Number(selectedSoh) + 0.001;

  function selectLocation(loc) {
    onUpdate({
      locationId: loc.locationId,
      locationName: loc.locationName,
    });
  }

  return (
    <div className="space-y-1.5 rounded-md border border-slate-200/80 bg-slate-50/40 p-2">
      <div className="grid gap-1.5 sm:grid-cols-[1fr_1fr_5rem_auto]">
        <div className="min-w-0 space-y-0.5">
          <label className="block text-[10px] font-semibold uppercase leading-tight tracking-wide text-slate-500">
            Source commodity
          </label>
          <ClutchSelect
            placeholder="- Select -"
            options={commoditySelectOpts}
            value={commoditySelectOpts.find((o) => String(o.value) === String(component.commodityId ?? "")) ?? null}
            onChange={(option) =>
              onUpdate({
                commodityId: option ? option.value : null,
                commodityName: option ? option.label : "",
                commodityTypeId: option ? (option._typeId ?? null) : null,
                locationId: null,
                locationName: "",
              })
            }
          />
        </div>
        <div className="min-w-0 space-y-0.5">
          <label className="block text-[10px] font-semibold uppercase leading-tight tracking-wide text-slate-500">
            Stock location
          </label>
          <ClutchSelect
            placeholder="- Select -"
            options={locationSelectOpts}
            value={locationSelectOpts.find((o) => String(o.value) === String(component.locationId ?? "")) ?? null}
            onChange={(option) =>
              onUpdate({
                locationId: option ? option.value : null,
                locationName: option ? option.label : "",
              })
            }
          />
          {selectedSoh != null ? (
            <p className={cn("text-[10px] font-medium", exceeds ? "text-amber-700" : "text-slate-500")}>
              {exceeds ? (
                <span className="inline-flex items-center gap-1">
                  <AlertCircle className="size-3 shrink-0" />
                  Exceeds on hand ({Number(selectedSoh).toLocaleString(undefined, { maximumFractionDigits: 3 })} MT)
                </span>
              ) : (
                <>On hand: {Number(selectedSoh).toLocaleString(undefined, { maximumFractionDigits: 3 })} MT</>
              )}
            </p>
          ) : null}
        </div>
        <div className="min-w-0 space-y-0.5">
          <label className="block text-[10px] font-semibold uppercase leading-tight tracking-wide text-slate-500">
            Qty (MT)
          </label>
          <input
            className={inputClass ?? "h-8 w-full rounded-md border border-slate-300 px-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"}
            type="number"
            min="0"
            step="0.001"
            value={component.quantity ?? ""}
            onChange={(e) => onUpdate({ quantity: e.target.value === "" ? null : Number(e.target.value) })}
            placeholder="0"
          />
        </div>
        <div className="flex items-end">
          <button
            type="button"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-400 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
            aria-label={`Remove component ${index + 1}`}
            onClick={() => onRemove(index)}
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      </div>

      {component.commodityId ? (
        <BlendStockByLocationPanel
          locationStock={locationStock}
          loading={loadingStock}
          selectedLocationId={component.locationId}
          onSelectLocation={selectLocation}
        />
      ) : null}
    </div>
  );
}

function BlendPerformAction({ pack, packId, commodityOptions, stockLocations, mtTotal, actualPackedMt, onPerformed, sectionClass }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState([]);
  const [performing, setPerforming] = useState(false);
  const [error, setError] = useState("");

  if (!pack?.isBlend || !packId) return null;

  const performed = Boolean(pack.blendPerformedAt);

  function openModal() {
    setError("");
    const seeded = (Array.isArray(pack.blendComponents) ? pack.blendComponents : []).map((c) => ({
      commodityId: c.commodityId ?? null,
      commodityName: c.commodityName ?? "",
      commodityTypeId: c.commodityTypeId ?? null,
      locationId: c.locationId ?? null,
      locationName: c.locationName ?? "",
      quantity: c.quantity ?? null,
    }));
    setDraft(seeded.length ? seeded : [blankBlendComponent()]);
    setOpen(true);
  }

  function updateComponent(index, patch) {
    setDraft((prev) => prev.map((row, idx) => (idx === index ? { ...row, ...patch } : row)));
  }

  function addComponent() {
    setDraft((prev) => [...prev, blankBlendComponent()]);
  }

  function removeComponent(index) {
    setDraft((prev) => prev.filter((_, idx) => idx !== index));
  }

  async function confirm() {
    setError("");
    const components = draft
      .filter((c) => c.commodityId && c.locationId && Number(c.quantity) > 0)
      .map((c) => ({
        commodityId: c.commodityId,
        locationId: c.locationId,
        quantity: Number(c.quantity),
      }));
    if (components.length === 0) {
      setError("Add at least one component with a commodity, location and quantity.");
      return;
    }
    setPerforming(true);
    try {
      const updated = await performBlend(packId, components);
      onPerformed(updated);
      setOpen(false);
    } catch (err) {
      setError(err?.message || "Failed to perform blend.");
    } finally {
      setPerforming(false);
    }
  }

  return (
    <section className={sectionClass} aria-label="Perform blend">
      {performed ? (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-medium text-emerald-800">
          Blend completed{pack.blendTransferId ? ` — transfer ${pack.blendTransferId}` : ""}.
        </div>
      ) : (
        <div className="flex items-center justify-between gap-3 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1.5">
          <span className="flex items-center gap-1.5 text-xs font-medium text-amber-800">
            <AlertCircle className="size-3.5" />
            Blend pending — perform the blend transfer once the pack is out-loaded.
          </span>
          <Button type="button" size="sm" onClick={openModal}>
            Perform blend
          </Button>
        </div>
      )}

      {open ? (
        <BlendPerformModal
          pack={pack}
          customerId={pack.customerId}
          components={draft}
          isPerforming={performing}
          error={error}
          mtTotal={mtTotal}
          actualPackedMt={actualPackedMt}
          commodityOptions={commodityOptions}
          stockLocations={stockLocations}
          onUpdateComponent={updateComponent}
          onAddComponent={addComponent}
          onRemoveComponent={removeComponent}
          onConfirm={confirm}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </section>
  );
}

function BlendPerformModal({
  pack,
  customerId,
  components,
  isPerforming,
  error,
  mtTotal,
  actualPackedMt,
  commodityOptions,
  stockLocations,
  onUpdateComponent,
  onAddComponent,
  onRemoveComponent,
  onConfirm,
  onClose,
}) {
  const commoditySelectOpts = (Array.isArray(commodityOptions) ? commodityOptions : []).map((c) => ({
    value: String(c.id),
    label: c.description,
    _typeId: c.commodity_type_id ?? c.commodityTypeId ?? null,
  }));

  const locationSelectOpts = (Array.isArray(stockLocations) ? stockLocations : []).map((s) => ({
    value: String(s.id),
    label: s.name,
  }));

  const finalCommodityLabel =
    commoditySelectOpts.find((o) => String(o.value) === String(pack.commodityId ?? ""))?.label || "final commodity";

  const componentQtySum = components
    .map((c) => Number(c.quantity))
    .filter((v) => Number.isFinite(v))
    .reduce((s, v) => s + v, 0);

  const actualPacked = Number(actualPackedMt);
  const actualPackedMismatch =
    Number.isFinite(actualPacked) && actualPacked > 0 && Math.abs(componentQtySum - actualPacked) > 0.001;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-800">Perform blend</h2>
            <p className="text-xs text-slate-500">
              Posts a commodity-to-commodity transfer per component into {finalCommodityLabel}.
            </p>
          </div>
          <button
            type="button"
            className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Close"
            onClick={onClose}
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="flex-1 space-y-2 overflow-y-auto px-4 py-3">
          {error ? (
            <p className="rounded-md border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-medium text-rose-700">
              {error}
            </p>
          ) : null}
          {actualPackedMismatch ? (
            <p className="flex items-start gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs font-medium text-amber-800">
              <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
              <span>
                Blend components sum to{" "}
                {componentQtySum.toLocaleString(undefined, { maximumFractionDigits: 3 })} MT but the actual amount packed is{" "}
                {actualPacked.toLocaleString(undefined, { maximumFractionDigits: 3 })} MT.
              </span>
            </p>
          ) : null}

          {components.map((component, index) => (
            <BlendComponentEditor
              key={`blend-perform-${index}`}
              component={component}
              index={index}
              customerId={customerId}
              commoditySelectOpts={commoditySelectOpts}
              locationSelectOpts={locationSelectOpts}
              onUpdate={(patch) => onUpdateComponent(index, patch)}
              onRemove={onRemoveComponent}
            />
          ))}

          <button
            type="button"
            className="flex h-7 w-full items-center justify-center gap-1 rounded-md border border-dashed border-slate-300 bg-white text-xs font-medium text-slate-600 hover:border-brand/40 hover:bg-brand/5 hover:text-brand-ink"
            onClick={onAddComponent}
          >
            <Plus className="size-3.5" />
            Add component
          </button>

          {mtTotal != null && Number.isFinite(Number(mtTotal)) ? (
            <p className="text-[11px] text-slate-500">
              Components sum to {componentQtySum.toLocaleString(undefined, { maximumFractionDigits: 3 })} MT · pack MT total{" "}
              {Number(mtTotal).toLocaleString(undefined, { maximumFractionDigits: 3 })} MT.
            </p>
          ) : null}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-4 py-3">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isPerforming}>
            Cancel
          </Button>
          <Button type="button" size="sm" onClick={onConfirm} disabled={isPerforming}>
            {isPerforming ? "Performing…" : "Perform blend"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function BlendPackSection({ isBlend, blendComponents, customerId, commodityOptions, stockLocations, mtTotal, actualPackedMt, onToggle, onChange, sectionClass, inputClass }) {
  const components = Array.isArray(blendComponents) ? blendComponents : [];

  // Derived warnings (non-blocking)
  const hasMultipleCommodityTypes = (() => {
    if (!isBlend || components.length < 2) return false;
    const types = components.map((c) => c.commodityTypeId).filter(Boolean);
    return types.length >= 2 && new Set(types).size > 1;
  })();

  const componentQtySum = (() => {
    if (!isBlend) return null;
    const vals = components.map((c) => Number(c.quantity));
    if (vals.some((v) => !Number.isFinite(v))) return null;
    return vals.reduce((s, v) => s + v, 0);
  })();

  const qtySumMismatch = (() => {
    if (componentQtySum == null || mtTotal == null || !Number.isFinite(Number(mtTotal))) return false;
    return Math.abs(componentQtySum - Number(mtTotal)) > 0.001;
  })();

  const actualPacked = Number(actualPackedMt);
  const actualPackedMismatch = (() => {
    if (componentQtySum == null || !Number.isFinite(actualPacked) || actualPacked <= 0) return false;
    return Math.abs(componentQtySum - actualPacked) > 0.001;
  })();

  const commoditySelectOpts = (Array.isArray(commodityOptions) ? commodityOptions : []).map((c) => ({
    value: String(c.id),
    label: c.description,
    _typeId: c.commodity_type_id ?? c.commodityTypeId ?? null,
  }));

  const locationSelectOpts = (Array.isArray(stockLocations) ? stockLocations : []).map((s) => ({
    value: String(s.id),
    label: s.name,
  }));

  function updateComponent(index, patch) {
    const next = components.map((row, idx) => (idx === index ? { ...row, ...patch } : row));
    onChange(next);
  }

  function addComponent() {
    onChange([...components, blankBlendComponent()]);
  }

  function removeComponent(index) {
    onChange(components.filter((_, idx) => idx !== index));
  }

  return (
    <section className={sectionClass} aria-label="Blend pack">
      <div className="flex items-center gap-3">
        <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-700">
          <input
            type="checkbox"
            className="size-3.5 rounded border-slate-300 accent-brand"
            checked={isBlend}
            onChange={(e) => onToggle(e.target.checked)}
          />
          Blend pack
        </label>
        {isBlend ? (
          <span className="rounded-full bg-brand/10 px-2 py-0.5 text-[10px] font-semibold text-brand-ink ring-1 ring-brand/20">
            {components.length} component{components.length !== 1 ? "s" : ""}
          </span>
        ) : null}
      </div>

      {isBlend ? (
        <div className="mt-2 space-y-2">
          {!customerId ? (
            <p className="rounded-md border border-sky-200 bg-sky-50 px-2.5 py-1.5 text-xs font-medium text-sky-800">
              Select a customer to view stock on hand by location.
            </p>
          ) : null}
          {hasMultipleCommodityTypes ? (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs font-medium text-amber-800">
              Components are of different commodity types.
            </p>
          ) : null}
          {qtySumMismatch ? (
            <p className="rounded-md border border-sky-200 bg-sky-50 px-2.5 py-1.5 text-xs font-medium text-sky-800">
              Component quantities sum to {Number(componentQtySum).toLocaleString(undefined, { maximumFractionDigits: 3 })} MT
              but pack MT total is {Number(mtTotal).toLocaleString(undefined, { maximumFractionDigits: 3 })} MT.
            </p>
          ) : null}
          {actualPackedMismatch ? (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs font-medium text-amber-800">
              Component quantities sum to {Number(componentQtySum).toLocaleString(undefined, { maximumFractionDigits: 3 })} MT
              but the actual amount packed is {actualPacked.toLocaleString(undefined, { maximumFractionDigits: 3 })} MT.
            </p>
          ) : null}

          {components.map((component, index) => (
            <BlendComponentEditor
              key={`blend-component-${index}`}
              component={component}
              index={index}
              customerId={customerId}
              commoditySelectOpts={commoditySelectOpts}
              locationSelectOpts={locationSelectOpts}
              inputClass={inputClass}
              onUpdate={(patch) => updateComponent(index, patch)}
              onRemove={removeComponent}
            />
          ))}

          <button
            type="button"
            className="flex h-7 w-full items-center justify-center gap-1 rounded-md border border-dashed border-slate-300 bg-white text-xs font-medium text-slate-600 hover:border-brand/40 hover:bg-brand/5 hover:text-brand-ink"
            onClick={addComponent}
          >
            <Plus className="size-3.5" />
            Add component
          </button>
        </div>
      ) : null}
    </section>
  );
}

export default function NewPackFormPage() {
  return (
    <Suspense fallback={null}>
      <NewPackFormPageInner />
    </Suspense>
  );
}

function NewPackFormPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { siteId: activeSiteId, site } = useSite();
  const { dock, verticalExpanded } = useNavDock();
  const mode = searchParams.get("mode") === "edit" ? "edit" : "add";
  const editId = searchParams.get("id") || "";
  const requestedTab = searchParams.get("tab");
  const currentSite = activeSiteId || null;

  // All form lookup data from TanStack Query — cached globally, refetches on
  // window focus so switching back from a reference-data tab picks up new options.
  const queryLookups = useAllPackLookups();
  const invalidateReferenceData = useInvalidateReferenceData();
  const { data: pemsInspectionRemarks = { ecInspectionRemarks: [], goodsInspectionRemarks: [] } } =
    usePemsInspectionRemarksQuery();

  const [fumigants] = useState(() => loadFumigants());
  const [methodologies] = useState(() => loadMethodologies());
  const [certificateTemplates] = useState(() => loadCertificateTemplates());
  const [recordTemplates] = useState(() => loadRecordTemplates());
  const [quickVesselOpen, setQuickVesselOpen] = useState(false);

  const customerOptions = queryLookups.customers;
  const commodityOptions = queryLookups.commodities;
  const commodityTypeOptions = queryLookups.commodityTypes;
  const shippingLineOptions = useMemo(
    () =>
      queryLookups.shippingLines.map((s) => ({
        id: s.id,
        name: s.shipping_line_name ?? s.name ?? "",
        code: s.shipping_line_code ?? s.code ?? "",
      })),
    [queryLookups.shippingLines]
  );
  const containerParkOptions = useMemo(
    () => queryLookups.containerParks.map((p) => ({ id: p.id, name: p.name ?? p.containerParkName ?? "" })),
    [queryLookups.containerParks]
  );
  const transporterOptions = useMemo(
    () => queryLookups.transporters.map((t) => ({ id: t.id, name: t.name ?? "" })),
    [queryLookups.transporters]
  );
  const containerCodeOptions = queryLookups.containerCodes;
  const packerOptions = useMemo(
    () => (queryLookups.referencePackers.length ? queryLookups.referencePackers : queryLookups.packers),
    [queryLookups.referencePackers, queryLookups.packers]
  );
  const packerNames = queryLookups.packerNames;
  const testsCatalog = useTestsCatalog();
  const terminalOptions = queryLookups.terminals;
  const vesselVoyageOptions = queryLookups.vesselVoyages;
  const countryOptions = useMemo(
    () =>
      queryLookups.countries.map((c) => ({
        id: c.id,
        name: c.country_name ?? c.countryName ?? "",
        code: c.country_code ?? c.countryCode ?? "",
      })),
    [queryLookups.countries]
  );
  const portOptions = queryLookups.ports;
  const releaseOptions = useMemo(
    () => queryLookups.releases.map(normalizeReleaseOption).filter((r) => r.releaseNumber),
    [queryLookups.releases]
  );
  const quickReleaseLookups = useMemo(
    () => ({
      containerParks: containerParkOptions,
      transporters: transporterOptions,
      containerCodes: containerCodeOptions,
      loading: queryLookups.isLoading,
    }),
    [containerParkOptions, transporterOptions, containerCodeOptions, queryLookups.isLoading]
  );
  const [pack, setPack] = useState(() => blankPack(currentSite));
  const packerSelectOptions = useMemo(
    () => packAssignedPackerOptions(pack, queryLookups.referencePackers ?? queryLookups.packers ?? []),
    [pack, queryLookups.referencePackers, queryLookups.packers]
  );
  const allowedCommodityIds = useMemo(() => {
    if (!pack.commodityId) return null;
    return new Set([pack.commodityId]);
  }, [pack.commodityId]);
  const [editingRow, setEditingRow] = useState(null);
  const [activeTab, setActiveTab] = useState(() =>
    ["general", "fumigation", "accounting", "pems"].includes(requestedTab || "") ? requestedTab : "general"
  );
  const [editingContainerId, setEditingContainerId] = useState(null);
  const [pemsSubmitError, setPemsSubmitError] = useState("");
  const [isSubmittingPems, setIsSubmittingPems] = useState(false);
  const [activeSampleIndex, setActiveSampleIndex] = useState(0);
  const prevSampleCountRef = useRef(0);

  const [saveError, setSaveError] = useState("");
  const [quickReleaseOpen, setQuickReleaseOpen] = useState(false);
  const [quickReleaseMode, setQuickReleaseMode] = useState("add");
  const [quickReleaseDraft, setQuickReleaseDraft] = useState(() => blankRelease());
  const [quickReleaseError, setQuickReleaseError] = useState("");
  const [quickReleaseSaving, setQuickReleaseSaving] = useState(false);
  const [quickReleaseTargetIndex, setQuickReleaseTargetIndex] = useState(null);
  const [bulkImportSaving, setBulkImportSaving] = useState(false);
  const [bulkImportError, setBulkImportError] = useState("");

  const set = (key, val) => setPack((prev) => ({ ...prev, [key]: val }));

  function openQuickAddRelease(targetIndex = null) {
    setQuickReleaseError("");
    setQuickReleaseMode("add");
    setQuickReleaseTargetIndex(targetIndex);
    setQuickReleaseDraft(blankRelease());
    setQuickReleaseOpen(true);
  }

  // Open the combined modal in edit mode for an existing pack release line. Loads the full
  // release record (dates, free days, all parks) when it matches a Reference Data release so
  // edits PUT back to that record; falls back to the line's own park/transporter otherwise.
  function openEditRelease(lineIndex) {
    const line = releaseRows[lineIndex];
    if (!line) return;
    const releaseRef = String(line.releaseRef ?? line.release_ref ?? "").trim();
    const fullRecord = queryLookups.releases.find(
      (r) => String(r.releaseNumber ?? r.release_number ?? "").trim() === releaseRef
    );
    const draft = fullRecord
      ? { ...blankRelease(), ...fullRecord, releaseNumber: releaseRef }
      : {
          ...blankRelease(),
          releaseNumber: releaseRef,
          parks: [
            {
              containerParkId: line.emptyContainerParkId ?? "",
              transporterIds: line.transporterId ? [line.transporterId] : [],
            },
          ],
        };
    setQuickReleaseError("");
    setQuickReleaseMode("edit");
    setQuickReleaseTargetIndex(lineIndex);
    setQuickReleaseDraft(draft);
    setQuickReleaseOpen(true);
  }

  // Detach (remove) a release line from this pack. The Reference Data release record is left
  // untouched — this only unlinks it from the current pack.
  function detachReleaseLine(lineIndex) {
    setPack((prev) => {
      const list = Array.isArray(prev.releaseDetails) ? prev.releaseDetails : [];
      return { ...prev, releaseDetails: list.filter((_, idx) => idx !== lineIndex) };
    });
    closeQuickAddRelease();
  }

  function closeQuickAddRelease() {
    setQuickReleaseOpen(false);
    setQuickReleaseError("");
    setQuickReleaseTargetIndex(null);
    setQuickReleaseMode("add");
  }

  function setQuickReleaseField(key, value) {
    setQuickReleaseDraft((prev) => {
      const next = { ...prev, [key]: value };
      if (key === "releaseAvailableAt" || key === "freeDays") {
        next.releaseExpiryAt = computeReleaseExpiry(
          key === "releaseAvailableAt" ? value : prev.releaseAvailableAt,
          key === "freeDays" ? value : prev.freeDays,
        );
      }
      return next;
    });
  }

  function updateQuickReleasePark(index, key, value) {
    setQuickReleaseDraft((prev) => ({
      ...prev,
      parks: prev.parks.map((park, idx) => (idx === index ? { ...park, [key]: value } : park)),
    }));
  }

  function addQuickReleasePark() {
    setQuickReleaseDraft((prev) => ({
      ...prev,
      parks: [...(prev.parks || []), { containerParkId: "", transporterIds: [] }],
    }));
  }

  function removeQuickReleasePark(index) {
    setQuickReleaseDraft((prev) => {
      const next = (prev.parks || []).filter((_, idx) => idx !== index);
      return { ...prev, parks: next.length ? next : [{ containerParkId: "", transporterIds: [] }] };
    });
  }

  function toggleQuickReleaseTransporter(parkIndex, transporterId) {
    setQuickReleaseDraft((prev) => ({
      ...prev,
      parks: prev.parks.map((park, idx) => {
        if (idx !== parkIndex) return park;
        const exists = (park.transporterIds || []).some((id) => String(id) === String(transporterId));
        const nextIds = exists
          ? park.transporterIds.filter((id) => String(id) !== String(transporterId))
          : [...(park.transporterIds || []), transporterId];
        return { ...park, transporterIds: nextIds };
      }),
    }));
  }

  async function saveQuickAddRelease() {
    if (quickReleaseSaving) return;
    const releaseRef = String(quickReleaseDraft.releaseNumber || "").trim();
    if (!releaseRef) {
      setQuickReleaseError("Release Number is required.");
      return;
    }
    const cleanedParks = (quickReleaseDraft.parks || [])
      .map((park) => ({
        containerParkId: park.containerParkId === "" ? "" : park.containerParkId,
        transporterIds: (park.transporterIds || []).filter((id) => id !== "" && id != null),
      }))
      .filter((park) => park.containerParkId !== "" || park.transporterIds.length > 0);
    if (!cleanedParks.length) {
      setQuickReleaseError("Add at least one Empty Container Park with a transporter.");
      return;
    }

    // Persist the release to the database (Modules/ReferenceData ReleaseController).
    setQuickReleaseSaving(true);
    setQuickReleaseError("");
    try {
      await saveRelease({
        ...quickReleaseDraft,
        releaseNumber: releaseRef,
        parks: cleanedParks,
        releaseExpiryAt:
          computeReleaseExpiry(quickReleaseDraft.releaseAvailableAt, quickReleaseDraft.freeDays) ||
          quickReleaseDraft.releaseExpiryAt ||
          "",
      });
    } catch (err) {
      setQuickReleaseError(err instanceof Error ? err.message : "Failed to save release.");
      return;
    } finally {
      setQuickReleaseSaving(false);
    }

    await invalidateReferenceData("releases");

    const firstPark = cleanedParks[0];
    const firstTransporterId = firstPark.transporterIds[0] ?? "";
    const newLine = {
      releaseRef,
      emptyContainerParkId: firstPark.containerParkId,
      transporterId: firstTransporterId,
    };

    setPack((prev) => {
      const currentReleases = Array.isArray(prev.releaseDetails) ? prev.releaseDetails : [];
      let nextReleases;
      if (quickReleaseTargetIndex != null && currentReleases[quickReleaseTargetIndex]) {
        nextReleases = currentReleases.map((row, idx) =>
          idx === quickReleaseTargetIndex ? { ...row, ...newLine } : row,
        );
      } else {
        nextReleases = [...currentReleases.filter((row) => row.releaseRef || row.emptyContainerParkId || row.transporterId), newLine];
      }
      return { ...prev, releaseDetails: nextReleases };
    });

    closeQuickAddRelease();
  }

  function handleQuickVesselCreated(option) {
    if (!option?.id) return;
    invalidateReferenceData("vesselVoyages");
    const { terminalId: nextTerminalId, portOfLoading: nextPortOfLoading } = resolveTerminalFromVoyage(option, terminalOptions);
    setPack((prev) => ({
      ...prev,
      vesselDepartureId: option.id,
      vesselName: vesselDisplayName(option),
      voyageNumber: option.voyage_number ?? prev.voyageNumber,
      lloydId: option.vessel?.lloyds_number ?? prev.lloydId,
      vesselCutoffDate: toDateInputValue(option.vessel_cutoff_date) || prev.vesselCutoffDate,
      etd: toDateInputValue(option.vessel_etd) || prev.etd,
      terminalId: nextTerminalId ? nextTerminalId : prev.terminalId,
      portOfLoading:
        nextPortOfLoading && !String(prev.portOfLoading ?? "").trim() ? nextPortOfLoading : prev.portOfLoading,
    }));
  }

  useEffect(() => {
    if (!["general", "fumigation", "accounting", "pems"].includes(requestedTab || "")) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
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

  const fd =
    pack.fumigationDetail && typeof pack.fumigationDetail === "object"
      ? pack.fumigationDetail
      : blankFumigationDetail();
  const fumigationMethodologyOptions = useMemo(() => {
    if (!pack.fumigantId) return [];
    return methodologies.filter((item) => String(item.fumigantId) === String(pack.fumigantId));
  }, [pack.fumigantId, methodologies]);
  const selectedFumigationMethodology = useMemo(() => {
    const methodologyId = pack.methodologyId || null;
    if (!methodologyId) return null;
    return methodologies.find((item) => String(item.id) === String(methodologyId)) || null;
  }, [pack.methodologyId, methodologies]);

  /** Match a temperature value against the methodology's dosage bands (half-open [min, max)). */
  const findBandForTemp = useCallback(
    (rawTemp) => {
      const ranges = selectedFumigationMethodology?.dosageRanges;
      if (!Array.isArray(ranges) || ranges.length === 0) return null;
      const t = Number(rawTemp);
      if (!Number.isFinite(t)) return null;
      return ranges.find((r) => Number(r.minTempC) <= t && t < Number(r.maxTempC)) ?? null;
    },
    [selectedFumigationMethodology],
  );

  // Prescribed schedule lookup is keyed off the forecast minimum temperature
  const matchedPrescribedRange = useMemo(
    () => findBandForTemp(fd.minForecastedTemperature),
    [findBandForTemp, fd.minForecastedTemperature],
  );
  // Applied schedule lookup is keyed off the actual measured start temperature
  const matchedAppliedRange = useMemo(
    () => findBandForTemp(fd.actualTemperature),
    [findBandForTemp, fd.actualTemperature],
  );
  // Reference-panel highlight uses whichever temperature the user has entered most recently
  // (actual takes priority, falls back to forecast)
  const matchedDosageRange = matchedAppliedRange ?? matchedPrescribedRange;

  // Auto-prefill prescribed dose rate / exposure from the band matched against min forecast temp.
  // Only writes when the prescribed field is currently empty so we don't clobber user edits.
  useEffect(() => {
    if (!matchedPrescribedRange) return;
    const current = pack.fumigationDetail ?? {};
    const empty = (v) => v == null || String(v).trim() === "";
    if (!empty(current.prescribedDoseRate) && !empty(current.prescribedExposure)) return;
    updateFumigationDetail({
      prescribedDoseRate: empty(current.prescribedDoseRate)
        ? String(matchedPrescribedRange.dosageValue)
        : current.prescribedDoseRate,
      prescribedDoseUnit: matchedPrescribedRange.dosageUnit || "g/m3",
      prescribedExposure: empty(current.prescribedExposure)
        ? String(matchedPrescribedRange.exposureValue)
        : current.prescribedExposure,
      prescribedExposureUnit: matchedPrescribedRange.exposureUnit || "hours",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchedPrescribedRange?.id]);

  // Auto-prefill applied dose rate / exposure from the band matched against actual start temp.
  useEffect(() => {
    if (!matchedAppliedRange) return;
    const current = pack.fumigationDetail ?? {};
    const empty = (v) => v == null || String(v).trim() === "";
    if (!empty(current.dosageValue) && !empty(current.exposureTimeValue)) return;
    updateFumigationDetail({
      dosageValue: empty(current.dosageValue) ? String(matchedAppliedRange.dosageValue) : current.dosageValue,
      dosageUnit: matchedAppliedRange.dosageUnit || "g/m3",
      exposureTimeValue: empty(current.exposureTimeValue)
        ? String(matchedAppliedRange.exposureValue)
        : current.exposureTimeValue,
      exposureTimeUnit: matchedAppliedRange.exposureUnit || "hours",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchedAppliedRange?.id]);

  // ── Derived values: volume, tonnage, calculated dose, amount applied ──────
  const matchedContainerCode = useMemo(() => {
    const code = String(pack.containerCode || "").trim();
    if (!code) return null;
    const dbMatch = containerCodeOptions.find(
      (row) => String(row.iso_code ?? row.isoCode ?? "").toUpperCase() === code.toUpperCase()
    );
    if (dbMatch) {
      return {
        cubicMeters: Number(dbMatch.cubic_meters ?? dbMatch.cubicMeters ?? 0),
        containerSize: dbMatch.container_size ?? dbMatch.containerSize ?? "",
      };
    }
    return REFERENCE_CONTAINER_CODE_ROWS.find(
      (row) => String(row.containerSize || "").toUpperCase() === code.toUpperCase()
    ) ?? null;
  }, [pack.containerCode, containerCodeOptions]);

  const derivedVolumeM3 = useMemo(() => {
    const containers = Number(pack.containersRequired || 0);
    const m3PerContainer = Number(matchedContainerCode?.cubicMeters || 0);
    if (!containers || !m3PerContainer) return null;
    return Number((containers * m3PerContainer).toFixed(2));
  }, [pack.containersRequired, matchedContainerCode]);

  const derivedActualTonnageMT = useMemo(() => {
    const containers = Array.isArray(pack.containers) ? pack.containers : [];
    if (!containers.length) return null;
    const totalNettKg = containers.reduce((acc, c) => {
      const nett = Number(c?.nettWeight);
      return acc + (Number.isFinite(nett) ? nett : 0);
    }, 0);
    if (!totalNettKg) return null;
    return Number((totalNettKg / 1000).toFixed(3));
  }, [pack.containers]);

  // Auto-fill volume when blank
  useEffect(() => {
    if (derivedVolumeM3 == null) return;
    const current = pack.fumigationDetail ?? {};
    const empty = (v) => v == null || String(v).trim() === "";
    if (!empty(current.volumeM3)) return;
    updateFumigationDetail({ volumeM3: String(derivedVolumeM3) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [derivedVolumeM3]);

  // Auto-fill actual tonnage when blank
  useEffect(() => {
    if (derivedActualTonnageMT == null) return;
    const current = pack.fumigationDetail ?? {};
    const empty = (v) => v == null || String(v).trim() === "";
    if (!empty(current.actualTonnage)) return;
    updateFumigationDetail({ actualTonnage: String(derivedActualTonnageMT) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [derivedActualTonnageMT]);

  // Auto-fill calculated dose = prescribedDoseRate × volume (g) when blank
  useEffect(() => {
    const current = pack.fumigationDetail ?? {};
    const empty = (v) => v == null || String(v).trim() === "";
    if (!empty(current.calculatedDosageValue)) return;
    const rate = Number(current.prescribedDoseRate);
    const volume = Number(current.volumeM3);
    if (!Number.isFinite(rate) || !Number.isFinite(volume) || rate <= 0 || volume <= 0) return;
    updateFumigationDetail({
      calculatedDosageValue: String(Number((rate * volume).toFixed(2))),
      calculatedDosageUnit: "g",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fd.prescribedDoseRate, fd.volumeM3]);

  // Auto-fill amount of fumigant applied = appliedDoseRate × volume (g) when blank
  useEffect(() => {
    const current = pack.fumigationDetail ?? {};
    const empty = (v) => v == null || String(v).trim() === "";
    if (!empty(current.actualDosageAppliedValue)) return;
    const rate = Number(current.dosageValue);
    const volume = Number(current.volumeM3);
    if (!Number.isFinite(rate) || !Number.isFinite(volume) || rate <= 0 || volume <= 0) return;
    updateFumigationDetail({
      actualDosageAppliedValue: String(Number((rate * volume).toFixed(2))),
      actualDosageAppliedUnit: "g",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fd.dosageValue, fd.volumeM3]);

  // ── Employee lists for Fumigator + Authorised Officer dropdowns ──────────
  const contactUsers = useMemo(() => loadContactUsers(), []);
  const fumigatorOptions = useMemo(
    () => contactUsers.filter((u) => u && u.isFumigator && u.active !== false),
    [contactUsers],
  );
  const aoOptions = useMemo(() => filterAuthorisedOfficers(contactUsers), [contactUsers]);

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

  async function applyBulkContainerImport(updatedContainers, _appliedRows, logistics) {
    // Add the release/park/transporter used for this import to the pack if it's a
    // combo the pack doesn't already carry.
    const nextReleaseDetails = ensureReleaseLineOnPack(pack.releaseDetails, logistics);
    const nextPack = { ...pack, containers: updatedContainers, releaseDetails: nextReleaseDetails };

    const packId = nextPack.id ?? editingRow?.id;
    if (!packId) {
      // New, unsaved pack — there is no record to PUT to yet. Keep the import in the
      // form; it will persist when the user creates the pack.
      setPack(nextPack);
      setBulkImportError("Create the pack first — imported containers will save with it.");
      return true;
    }

    setBulkImportSaving(true);
    setBulkImportError("");
    try {
      const rowToSave = packToScheduleRow(nextPack, editingRow ?? nextPack);
      await savePack({ ...rowToSave, id: packId });
      // Only reflect the import in the form once it is safely persisted, so a failed
      // import leaves the panel in a clean, retryable state.
      setPack(nextPack);
      return true;
    } catch (err) {
      setBulkImportError(err?.message || "Failed to save imported containers.");
      return false;
    } finally {
      setBulkImportSaving(false);
    }
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

  async function submitPemsFromForm() {
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

    setIsSubmittingPems(true);
    setPemsSubmitError("");
    try {
      const packForPayload = {
        ...pack,
        id: pack.id || editingRow?.id || "draft",
        commodity: commodityOptions.find((row) => String(row.id) === String(pack.commodityId))?.description || "",
        exporter: customerOptions.find((c) => String(c.id) === String(pack.exporter))?.name || "",
      };
      const payload = buildPemsInspectionPayload({
        pack: packForPayload,
        site: selectedPackSite,
        recordType: pemsDraft.recordType,
        pemsDraft,
        containers: containers.map((c) => ({ ...c, containerNo: c.containerNumber, sealNo: c.sealNumber })),
        contactUsers,
      });
      const validationErrors = validatePemsSubmission({
        recordType: pemsDraft.recordType,
        pack: packForPayload,
        site: selectedPackSite,
        containers: payload.containers,
        lines: payload.lines,
        timeEntries: payload.timeEntries,
        pemsDraft,
      });
      if (validationErrors.length) throw new Error(validationErrors[0]);

      const data = await submitPemsInspectionFlow({ recordType: pemsDraft.recordType, payload, isGppir });
      const submittedAt = data?.submittedAt || new Date().toISOString();
      const batchId = data?.submissionId || data?.pemsInspectionId || data?.id || `PEMS-${Date.now()}`;
      const submission = attachPemsSubmissionSnapshot({
        batchId,
        submittedAt,
        status: data?.status || data?.pemsStatus || "Accepted",
        pemsInspectionId: data?.pemsInspectionId || data?.id || "",
        recordType: pemsDraft.recordType,
        packId: pack.id || editingRow?.id || "draft",
        jobReference: pack.jobReference || "",
        rfp: pack.rfp || "",
        exporter: packForPayload.exporter,
        destinationCountry: pack.destinationCountry || "",
        importPermitRequired: Boolean(pack.importPermitRequired),
        importPermitNumber: pack.importPermitNumber || "",
        rfpAdditionalDeclarationRequired: Boolean(pack.rfpAdditionalDeclarationRequired),
        establishmentName: selectedPackSite?.name || site?.label || site?.name || "",
        establishmentNumber: String(selectedPackSite?.establishmentNumber || selectedPackSite?.yardNo || ""),
        commodity: packForPayload.commodity,
        aoSignoff: pemsDraft.aoSignoff,
        aoNumber: selectedAoNumber,
        inspectionStart: pemsDraft.inspectionStart,
        inspectionEnd: pemsDraft.inspectionEnd,
        ecrComments: pemsDraft.ecrComments || "N/A",
        yardId: String(selectedPackSite?.yardId ?? selectedPackSite?.yardNo ?? ""),
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
        const nextPack = {
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
        const packId = nextPack.id ?? editingRow?.id;
        if (packId) {
          const rowToSave = packToScheduleRow(nextPack, editingRow ?? nextPack);
          savePack({ ...rowToSave, id: packId }).catch(() => {});
        }
        return nextPack;
      });
    } catch (error) {
      setPemsSubmitError(isPemsRfpRefreshError(error) ? pemsRfpRefreshUserMessage() : error?.message || "PEMs submission failed.");
    } finally {
      setIsSubmittingPems(false);
    }
  }

  const selectedVessel = useMemo(() => {
    if (!pack.vesselDepartureId) return null;
    return vesselVoyageOptions.find((v) => String(v.id) === String(pack.vesselDepartureId)) || null;
  }, [pack.vesselDepartureId, vesselVoyageOptions]);
  const isImportJob = pack.importExport === "Import";
  const vesselImportDates = useMemo(() => vesselImportScheduleFields(selectedVessel), [selectedVessel]);
  const releaseRows = Array.isArray(pack.releaseDetails) ? pack.releaseDetails : [];
  const destinationCountryId = useMemo(() => {
    const raw = String(pack.destinationCountry || "").trim();
    if (!raw) return "";
    const exact = countryOptions.find((c) => c.name === raw);
    if (exact?.id) return String(exact.id);
    const lower = raw.toLowerCase();
    const byName = countryOptions.find((c) => c.name.toLowerCase() === lower);
    if (byName?.id) return String(byName.id);
    const byCode = countryOptions.find((c) => String(c.code || "").toLowerCase() === lower);
    return byCode?.id ? String(byCode.id) : "";
  }, [pack.destinationCountry, countryOptions]);
  const destinationPortOptions = useMemo(() => {
    const countryName = String(pack.destinationCountry || "").trim().toLowerCase();
    if (!destinationCountryId && !countryName) return portOptions;
    return portOptions.filter((port) => {
      if (destinationCountryId && String(port.countryId) === String(destinationCountryId)) return true;
      const portCountryName = String(port.countryName || "").trim().toLowerCase();
      return Boolean(countryName && portCountryName === countryName);
    });
  }, [portOptions, pack.destinationCountry, destinationCountryId]);
  const packContainers = useMemo(() => buildPackContainers(pack, editingRow), [pack, editingRow]);
  const accountingPackId = String(pack.id || editingRow?.id || "").trim();
  const accountingRefreshKey = useMemo(() => {
    const packedSignature = packContainers
      .map((container) => `${container.id}:${container.nettWeight ?? ""}`)
      .join("|");
    return `${accountingPackId}:${packedSignature}:${pack.containersRequired ?? ""}:${pack.mtTotal ?? ""}`;
  }, [accountingPackId, packContainers, pack.containersRequired, pack.mtTotal]);
  // Count of filled containers (those with a container number) assigned to each release ref,
  // keyed by upper-cased ref. Used for the per-release count badges on the release lines.
  const containerCountByReleaseRef = useMemo(() => {
    const map = {};
    for (const c of packContainers) {
      const num = String(c.containerNumber ?? c.container_number ?? "").trim();
      if (!num) continue;
      const ref = String(c.releaseNumber ?? c.release_number ?? "").trim().toUpperCase();
      if (!ref) continue;
      map[ref] = (map[ref] || 0) + 1;
    }
    return map;
  }, [packContainers]);
  const countForReleaseRef = (ref) =>
    containerCountByReleaseRef[String(ref ?? "").trim().toUpperCase()] || 0;
  const pemsDraft = useMemo(() => ({ ...defaultPemsDraft(), ...(pack.pemsDraft || {}) }), [pack.pemsDraft]);
  const pemsSubmissions = Array.isArray(pack.pemsSubmissions) ? pack.pemsSubmissions : [];
  const siteRows = useMemo(() => readSiteRows(), []);
  const selectedPackSite = useMemo(() => {
    const byId = siteRows.find((row) => String(row.id) === String(pack.siteId));
    return byId || siteRows[0] || null;
  }, [siteRows, pack.siteId]);

  // Treatment Provider ID auto-derive from the pack's selected site (only when blank)
  useEffect(() => {
    const site = selectedPackSite;
    if (!site?.treatmentProviderId) return;
    if (String(pack.treatmentProviderId ?? "").trim()) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPack((prev) => ({ ...prev, treatmentProviderId: site.treatmentProviderId }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPackSite?.id]);

  const aoNumberByName = useMemo(() => {
    const map = new Map();
    loadContactUsers().forEach((row) => {
      if (!row?.aoActive && !(row?.userClassifications || []).includes("AUTHORISED_OFFICER")) return;
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
    () => safeValue(commodityOptions.find((row) => String(row.id) === String(pack.commodityId))?.description),
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

  // Actuals from the packed containers: total nett weight (MT) and the count of
  // containers completed with all packer + inspection checks passed.
  const actualPackedMt = useMemo(() => totalNettWeight(packContainers), [packContainers]);
  const containersPacked = useMemo(() => countPackedContainers(packContainers), [packContainers]);

  const stickySummary = useMemo(() => {
    const customerName = customerOptions.find((c) => String(c.id) === String(pack.customerId))?.name;
    const commodityName = commodityOptions.find((c) => String(c.id) === String(pack.commodityId))?.description;
    const releaseLines = releaseRows
      .filter((row) => row.releaseRef || row.emptyContainerParkId || row.transporterId)
      .map((row) => {
        const parts = [];
        if (row.releaseRef) parts.push(row.releaseRef);
        const park = containerParkOptions.find((p) => String(p.id) === String(row.emptyContainerParkId))?.name;
        if (park) parts.push(park);
        const tr = transporterOptions.find((t) => String(t.id) === String(row.transporterId))?.name;
        if (tr) parts.push(tr);
        return parts.length ? parts.join(" · ") : null;
      })
      .filter(Boolean);

    return {
      customer: customerName || "",
      jobRef: String(pack.jobReference || "").trim() || "",
      commodity: commodityName || "",
      fumigation: String(pack.fumigationDetail?.fumigationNotes || pack.fumigation || "").trim() || "",
      packWarning:
        pack.packWarningRequired && String(pack.packWarning || "").trim()
          ? String(pack.packWarning).trim()
          : "",
      releases: releaseLines.length ? releaseLines.join(" â€¢ ") : "",
      containers:
        pack.containersRequired === "" || pack.containersRequired == null ? "" : String(pack.containersRequired),
      containerCode: String(pack.containerCode || "").trim() || "",
      mtTotal: computedMtTotal != null && Number.isFinite(computedMtTotal) ? String(computedMtTotal) : "",
      vessel: vesselDisplayName(selectedVessel).trim() || "",
      etd: String(pack.etd || "").trim() || "",
      transshipment: String(pack.transshipmentPort || "").trim() || "",
      rfp: String(pack.rfp || "").trim() || "",
      edn: String(pack.edn || "").trim() || "",
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
    customerOptions,
    commodityOptions,
    containerParkOptions,
    transporterOptions,
  ]);

  // Fetch the pack once when entering edit mode. customerOptions/commodityOptions are intentionally
  // excluded from deps — entity IDs are now preserved by normalizePack so the form does not need to
  // re-derive them from name lookups when options finish loading (which would reset user edits).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (mode !== "edit" || !editId) return;
    let cancelled = false;
    import("@/lib/api/packing").then(({ getPack }) => getPack(editId)).then((row) => {
      if (cancelled || !row) return;
      setEditingRow(row);
      setPack(rowToPack(row, currentSite, customerOptions, commodityOptions));
    }).catch(() => {});
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, editId, currentSite]);

  useEffect(() => {
    if (mode !== "add") return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPack((prev) => ({ ...prev, siteId: currentSite }));
  }, [currentSite, mode]);

  useEffect(() => {
    if (!pack.fumigationRequired && activeTab === "fumigation") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActiveTab("general");
    }
  }, [pack.fumigationRequired, activeTab]);

  useEffect(() => {
    if (!selectedVessel) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPack((prev) => {
      const next = applySelectedVoyageToPack(prev, selectedVessel, prev.importExport === "Import", terminalOptions);
      if (
        prev.voyageNumber === next.voyageNumber &&
        prev.vesselCutoffDate === next.vesselCutoffDate &&
        prev.vesselName === next.vesselName &&
        prev.etd === next.etd &&
        prev.lloydId === next.lloydId &&
        String(prev.terminalId ?? "") === String(next.terminalId ?? "") &&
        String(prev.portOfLoading ?? "") === String(next.portOfLoading ?? "") &&
        prev.shippingLineId === next.shippingLineId &&
        prev.freeDays === next.freeDays
      ) {
        return prev;
      }
      return next;
    });
  }, [selectedVessel, terminalOptions]);

  const sampleEntries = pack.sampleEntries || [];
  const sampleRowCount = sampleEntries.length;

  useEffect(() => {
    const count = sampleEntries.length;
    if (count > prevSampleCountRef.current) {
      setActiveSampleIndex(count - 1);
    } else if (count > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActiveSampleIndex((prev) => (prev >= count ? count - 1 : prev));
    } else {
      setActiveSampleIndex(0);
    }
    prevSampleCountRef.current = count;
  }, [sampleEntries.length]);

  const save = async () => {
    const [
      resolvedImportPermitFiles,
      resolvedAdditionalDeclarationFiles,
      resolvedRfpFiles,
      resolvedPackingInstructionFiles,
      resolvedImportOrderFiles,
      resolvedImportPackingListFiles,
      resolvedImportAdditionalFiles,
      resolvedImportContainerListFiles,
    ] = await Promise.all([
      resolveFileItemsForSave(pack.importPermitFiles),
      resolveFileItemsForSave(pack.additionalDeclarationFiles),
      resolveFileItemsForSave(pack.rfpFiles),
      resolveFileItemsForSave(pack.packingInstructionFiles),
      resolveFileItemsForSave(pack.importOrderFiles),
      resolveFileItemsForSave(pack.importPackingListFiles),
      resolveFileItemsForSave(pack.importAdditionalFiles),
      resolveFileItemsForSave(pack.importContainerListFiles),
    ]);

    const normalized = {
      ...pack,
      customerId: pack.customerId || null,
      commodityId: pack.commodityId || null,
      commodityTypeId: pack.commodityTypeId || null,
      siteId: pack.siteId || currentSite || null,
      containersRequired: pack.containersRequired === "" ? null : Number(pack.containersRequired),
      quantityPerContainer: pack.quantityPerContainer === "" ? null : Number(pack.quantityPerContainer),
      maxQtyPerContainer: pack.maxQtyPerContainer === "" ? null : Number(pack.maxQtyPerContainer),
      mtTotal: computedMtTotal != null && Number.isFinite(computedMtTotal) ? Number(computedMtTotal) : null,
      shippingLineId: pack.shippingLineId || null,
      vesselDepartureId: pack.vesselDepartureId || null,
      exporter: pack.exporter || null,
      fumigationRequired: Boolean(pack.fumigationRequired),
      fumigantId: pack.fumigantId != null && pack.fumigantId !== "" ? pack.fumigantId : null,
      methodologyId: pack.methodologyId != null && pack.methodologyId !== "" ? pack.methodologyId : null,
      certificateTemplateId: pack.certificateTemplateId != null && pack.certificateTemplateId !== "" ? pack.certificateTemplateId : null,
      recordTemplateId: pack.recordTemplateId != null && pack.recordTemplateId !== "" ? pack.recordTemplateId : null,
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
      importPermitFiles: resolvedImportPermitFiles,
      additionalDeclarationFiles: resolvedAdditionalDeclarationFiles,
      rfpFiles: resolvedRfpFiles,
      packingInstructionFiles: resolvedPackingInstructionFiles,
      importOrderFiles: resolvedImportOrderFiles,
      importPackingListFiles: resolvedImportPackingListFiles,
      importAdditionalFiles: resolvedImportAdditionalFiles,
      importContainerListFiles: resolvedImportContainerListFiles,
      freeDays: pack.freeDays === "" || pack.freeDays == null ? null : Number(pack.freeDays),
    };
    setSaveError("");
    try {
      if (mode === "edit" && editingRow) {
        const updated = packToScheduleRow(normalized, editingRow);
        await savePack({ ...updated, id: editingRow.id });
      } else {
        const created = packToScheduleRow(normalized, null);
        await savePack(created);
      }
      router.push("/packing-schedule");
    } catch (err) {
      setSaveError(err?.message || "Failed to save pack.");
    }
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
      <div className="mx-auto w-full max-w-none space-y-1 px-1 pb-[6.5rem] pt-0 sm:px-2 lg:px-3">
        <div className="flex flex-wrap items-center justify-between gap-1">
          <h1 className="text-base font-semibold leading-tight text-slate-900">
            {mode === "edit"
              ? `Edit Pack${pack.packNumber ? ` — ${pack.packNumber}` : pack.jobReference ? ` — ${pack.jobReference}` : editingRow?.packNumber ? ` — ${editingRow.packNumber}` : editingRow?.jobReference ? ` — ${editingRow.jobReference}` : ""}`
              : "Add Pack"}
          </h1>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setActiveTab("general")}
            className={cn(
              "rounded-md border px-2.5 py-1 text-xs font-semibold",
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
                "rounded-md border px-2.5 py-1 text-xs font-semibold",
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
              "rounded-md border px-2.5 py-1 text-xs font-semibold",
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
              "rounded-md border px-2.5 py-1 text-xs font-semibold",
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
            <div className={topRowSectionsClass}>
              <section className={flushSectionClass} aria-label="Pack basics">
                <div className={cn(flushSectionBodyClass, sectionStackClass)}>
                  <div className="grid grid-cols-2 gap-1.5">
                    <FormRow label="Pack type">
                      <ClutchSelect
                        isClearable={false}
                        options={PACK_TYPE_OPTIONS}
                        value={PACK_TYPE_OPTIONS.find((o) => o.value === pack.packType) ?? null}
                        onChange={(option) => set("packType", option ? option.value : "")}
                      />
                    </FormRow>
                    <FormRow label="Pack confirmed">
                      <ClutchSelect
                        isClearable={false}
                        options={YES_NO_OPTIONS}
                        value={YES_NO_OPTIONS.find((o) => o.value === (pack.packConfirmed ? "yes" : "no")) ?? null}
                        onChange={(option) => set("packConfirmed", option?.value === "yes")}
                      />
                    </FormRow>
                  </div>
                  <FormRow label="Import / Export">
                    <ClutchSelect
                      isClearable={false}
                      options={IMPORT_EXPORT_OPTIONS}
                      value={IMPORT_EXPORT_OPTIONS.find((o) => o.value === pack.importExport) ?? null}
                      onChange={(option) => set("importExport", option ? option.value : "")}
                    />
                  </FormRow>
                  <FormRow label="Status">
                    <ClutchSelect
                      isClearable={false}
                      options={PACK_STATUS_OPTIONS}
                      value={PACK_STATUS_OPTIONS.find((o) => o.value === pack.status) ?? null}
                      onChange={(option) => set("status", option ? option.value : "")}
                    />
                  </FormRow>
                </div>
              </section>

              <section className={flushSectionClass} aria-label="Site and import">
                <div className={cn(flushSectionBodyClass, sectionStackClass)}>
                  <FormRow label="Site">
                    <input className={inputClass} value={site?.label || site?.name || `Site ${currentSite}`} readOnly disabled />
                  </FormRow>
                  {pack.packType === "bulk" ? (
                    <FormRow label="Test required">
                      <ClutchSelect
                        isClearable={false}
                        options={YES_NO_OPTIONS}
                        value={YES_NO_OPTIONS.find((o) => o.value === (pack.testRequired ? "yes" : "no")) ?? null}
                        onChange={(option) => set("testRequired", option?.value === "yes")}
                      />
                    </FormRow>
                  ) : null}
                  {isImportJob ? (
                    <FormRow label="Shrink taken">
                      <ClutchSelect
                        isClearable={false}
                        options={YES_NO_OPTIONS}
                        value={YES_NO_OPTIONS.find((o) => o.value === (pack.shrinkTaken ? "yes" : "no")) ?? null}
                        onChange={(option) => set("shrinkTaken", option?.value === "yes")}
                      />
                    </FormRow>
                  ) : null}
                </div>
              </section>

              <section className={flushSectionClass} aria-label="Sample">
                <div className={cn(flushSectionBodyClass, sectionStackClass)}>
                  <FormRow
                    label={
                      sampleRowCount > 0 ? (
                        <span className="inline-flex items-center gap-1.5">
                          Sample required
                          <span className="rounded-full bg-slate-200/90 px-1.5 py-0 text-[9px] font-semibold tabular-nums leading-none text-slate-700">
                            {sampleRowCount}
                          </span>
                        </span>
                      ) : (
                        "Sample required"
                      )
                    }
                  >
                    <ClutchSelect
                      isClearable={false}
                      options={YES_NO_OPTIONS}
                      value={YES_NO_OPTIONS.find((o) => o.value === (pack.sampleRequired ? "yes" : "no")) ?? null}
                      onChange={(option) => {
                        const enabled = option?.value === "yes";
                        setPack((prev) => {
                          const nextEntries = Array.isArray(prev.sampleEntries) ? prev.sampleEntries : [];
                          return {
                            ...prev,
                            sampleRequired: enabled,
                            sampleEntries: enabled && nextEntries.length === 0 ? [createSampleEntry()] : nextEntries,
                          };
                        });
                      }}
                    />
                  </FormRow>
                  {pack.sampleRequired ? (
                    <div className="space-y-1.5">
                      {sampleEntries.map((entry, index) => {
                        const isExpanded = sampleRowCount === 1 || index === activeSampleIndex;

                        if (!isExpanded) {
                          return (
                            <div
                              key={`sample-${index}`}
                              className="flex items-center gap-1 rounded-md border border-slate-200/80 bg-white px-1.5 py-1"
                            >
                              <button
                                type="button"
                                className="min-w-0 flex-1 truncate rounded px-1 py-0.5 text-left text-[13px] text-slate-600 hover:bg-slate-50"
                                onClick={() => setActiveSampleIndex(index)}
                              >
                                <span className="font-medium text-slate-700">{entry.type}</span>
                                <span className="text-slate-400"> · </span>
                                {entry.status}
                                {entry.sampleSentDate ? (
                                  <>
                                    <span className="text-slate-400"> · </span>
                                    {formatDateDisplay(entry.sampleSentDate)}
                                  </>
                                ) : null}
                                {entry.sampleLocation ? (
                                  <>
                                    <span className="text-slate-400"> · </span>
                                    {entry.sampleLocation}
                                  </>
                                ) : null}
                              </button>
                              <Button
                                variant="ghost"
                                size="sm"
                                type="button"
                                className="h-7 shrink-0 px-2 text-slate-400 hover:text-destructive"
                                aria-label="Remove sample"
                                onClick={() => {
                                  const next = sampleEntries.filter((_, idx) => idx !== index);
                                  set("sampleEntries", next);
                                }}
                              >
                                <Trash2 className="size-3.5" />
                              </Button>
                            </div>
                          );
                        }

                        return (
                          <div
                            key={`sample-${index}`}
                            className="space-y-1 rounded-md border border-slate-200/80 bg-slate-50/40 p-1.5"
                          >
                            <div className="grid grid-cols-3 gap-1">
                              <ClutchSelect
                                isClearable={false}
                                options={SAMPLE_TYPE_OPTIONS}
                                value={SAMPLE_TYPE_OPTIONS.find((o) => o.value === entry.type) ?? null}
                                onChange={(option) => {
                                  const next = [...sampleEntries];
                                  next[index] = { ...next[index], type: option ? option.value : "" };
                                  set("sampleEntries", next);
                                }}
                              />
                              <ClutchSelect
                                isClearable={false}
                                options={SAMPLE_STATUS_OPTIONS}
                                value={SAMPLE_STATUS_OPTIONS.find((o) => o.value === entry.status) ?? null}
                                onChange={(option) => {
                                  const next = [...sampleEntries];
                                  next[index] = { ...next[index], status: option ? option.value : "" };
                                  set("sampleEntries", next);
                                }}
                              />
                              <input
                                className={inputClass}
                                type="date"
                                aria-label="Sample sent date"
                                value={entry.sampleSentDate}
                                onChange={(e) => {
                                  const next = [...sampleEntries];
                                  next[index] = { ...next[index], sampleSentDate: e.target.value };
                                  set("sampleEntries", next);
                                }}
                              />
                            </div>
                            <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] gap-1">
                              <input
                                className={inputClass}
                                value={entry.sampleLocation}
                                aria-label="Sample location"
                                onChange={(e) => {
                                  const next = [...sampleEntries];
                                  next[index] = { ...next[index], sampleLocation: e.target.value };
                                  set("sampleEntries", next);
                                }}
                                placeholder="Location"
                              />
                              <input
                                className={inputClass}
                                value={entry.notes || ""}
                                aria-label="Sample notes"
                                onChange={(e) => {
                                  const next = [...sampleEntries];
                                  next[index] = { ...next[index], notes: e.target.value };
                                  set("sampleEntries", next);
                                }}
                                placeholder="Notes"
                              />
                              <Button
                                variant="destructive"
                                size="sm"
                                type="button"
                                className="h-7 shrink-0 px-2"
                                aria-label="Remove sample"
                                onClick={() => {
                                  const next = sampleEntries.filter((_, idx) => idx !== index);
                                  set("sampleEntries", next);
                                }}
                              >
                                <Trash2 className="size-3.5" />
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                      <Button
                        variant="secondary"
                        size="sm"
                        type="button"
                        className="h-7 w-full"
                        onClick={() => {
                          set("sampleEntries", [...sampleEntries, createSampleEntry()]);
                        }}
                      >
                        + Add sample
                      </Button>
                    </div>
                  ) : null}
                </div>
              </section>
            </div>

            <section className={sectionClass} aria-label="Basic details">
              <div className={gridClass}>
                <FormRow label="Customer">
                  {(() => {
                    const customerSelectOpts = customerOptions.map((c) => ({ value: String(c.id), label: c.name }));
                    return (
                      <ClutchSelect
                        placeholder="- Select -"
                        options={customerSelectOpts}
                        value={customerSelectOpts.find((o) => String(o.value) === String(pack.customerId)) ?? null}
                        onChange={(option) => set("customerId", option ? option.value : "")}
                      />
                    );
                  })()}
                </FormRow>
                <FormRow label="Exporter">
                  {(() => {
                    const customerSelectOpts = customerOptions.map((c) => ({ value: String(c.id), label: c.name }));
                    return (
                      <ClutchSelect
                        placeholder="- Select -"
                        options={customerSelectOpts}
                        value={customerSelectOpts.find((o) => String(o.value) === String(pack.exporter)) ?? null}
                        onChange={(option) => set("exporter", option ? option.value : "")}
                      />
                    );
                  })()}
                </FormRow>
                <FormRow label={pack.isBlend ? "Final commodity (blend target)" : "Commodity"}>
                  {(() => {
                    const commoditySelectOpts = commodityOptions.map((c) => ({ value: String(c.id), label: c.description }));
                    return (
                      <ClutchSelect
                        placeholder="- Select -"
                        options={commoditySelectOpts}
                        value={commoditySelectOpts.find((o) => String(o.value) === String(pack.commodityId)) ?? null}
                        onChange={(option) => {
                          const id = option ? option.value : "";
                          const row = id ? commodityOptions.find((c) => String(c.id) === id) : null;
                          setPack((prev) => ({
                            ...prev,
                            commodityId: id,
                            commodityTypeId: (row?.commodity_type_id ?? row?.commodityTypeId) != null ? String(row.commodity_type_id ?? row.commodityTypeId) : "",
                          }));
                        }}
                      />
                    );
                  })()}
                </FormRow>
                {mode === "edit" && pack.packNumber ? (
                  <FormRow label="Pack number">
                    <input className={`${inputClass} bg-slate-50 text-slate-600`} value={pack.packNumber} readOnly disabled />
                  </FormRow>
                ) : null}
                <FormRow label="Job reference">
                  <input className={inputClass} value={pack.jobReference} onChange={(e) => set("jobReference", e.target.value)} placeholder="Job reference" />
                </FormRow>
                <FormRow label="Packing start date">
                  <input className={inputClass} type="date" value={pack.packingStartDate || ""} onChange={(e) => set("packingStartDate", e.target.value)} />
                </FormRow>
                <FormRow label="Assigned packers">
                  <div className="flex flex-wrap gap-x-4 gap-y-1 rounded-md border border-slate-200 bg-white px-2 py-1.5">
                    {packerOptions.filter((p) => String(p.status ?? "active").toLowerCase() === "active").length === 0 ? (
                      <span className="text-xs text-slate-400">No packers available</span>
                    ) : (
                      packerOptions
                        .filter((p) => String(p.status ?? "active").toLowerCase() === "active")
                        .map((p) => {
                          const checked = Array.isArray(pack.assignedPackerIds) && pack.assignedPackerIds.includes(String(p.id));
                          return (
                            <label key={p.id} className="flex cursor-pointer items-center gap-1.5 text-xs text-slate-700">
                              <input
                                type="checkbox"
                                checked={checked}
                                className="size-3.5 border-slate-300 accent-brand"
                                onChange={() => {
                                  const currentIds = Array.isArray(pack.assignedPackerIds) ? pack.assignedPackerIds.map(String) : [];
                                  const id = String(p.id);
                                  const nextIds = currentIds.includes(id) ? currentIds.filter((x) => x !== id) : [...currentIds, id];
                                  const nextAssigned = packerOptions
                                    .filter((row) => nextIds.includes(String(row.id)))
                                    .map((row) => ({ id: row.id, name: row.name ?? "", status: row.status ?? "Active" }));
                                  setPack((prev) => ({ ...prev, assignedPackerIds: nextIds, assignedPackers: nextAssigned }));
                                }}
                              />
                              {p.name}
                            </label>
                          );
                        })
                    )}
                  </div>
                </FormRow>
                <div className={spanFullClass}>
                  <div className={cn("grid gap-2", pack.fumigationRequired ? "sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" : "sm:grid-cols-1")}>
                    <FormRow label="Fumigation required">
                      <ClutchSelect
                        isClearable={false}
                        options={YES_NO_OPTIONS}
                        value={YES_NO_OPTIONS.find((o) => o.value === (pack.fumigationRequired ? "yes" : "no")) ?? null}
                        onChange={(option) => {
                          const enabled = option?.value === "yes";
                          setPack((prev) => ({
                            ...prev,
                            fumigationRequired: enabled,
                            fumigationTiming: enabled ? prev.fumigationTiming : "",
                            fumigantId: enabled ? prev.fumigantId : null,
                            methodologyId: enabled ? prev.methodologyId : null,
                            certificateTemplateId: enabled ? prev.certificateTemplateId : null,
                            recordTemplateId: enabled ? prev.recordTemplateId : null,
                          }));
                        }}
                      />
                    </FormRow>
                    {pack.fumigationRequired ? (
                      <FormRow label="Fumigant selector">
                        {(() => {
                          const fumigantSelectOpts = fumigants.map((item) => {
                            const lbl = `${item.code} - ${item.name}`;
                            return { value: lbl, label: lbl, _id: item.id };
                          });
                          return (
                            <ClutchSelect
                              placeholder="- Select fumigant -"
                              options={fumigantSelectOpts}
                              value={fumigantSelectOpts.find((o) => o.value === (pack.fumigationDetail?.fumigationNotes || pack.fumigation || "")) ?? null}
                              onChange={(option) => {
                                const value = option ? option.value : "";
                                const matched = fumigants.find((item) => `${item.code} - ${item.name}` === value);
                                setPack((prev) => ({
                                  ...prev,
                                  fumigantId: matched ? matched.id : prev.fumigantId,
                                  fumigation: value,
                                  fumigationDetail: {
                                    ...(prev.fumigationDetail || blankFumigationDetail()),
                                    fumigationNotes: value,
                                  },
                                }));
                              }}
                            />
                          );
                        })()}
                      </FormRow>
                    ) : null}
                    {pack.fumigationRequired ? (
                      <FormRow label="DAFF Permission">
                        <ClutchSelect
                          isClearable={false}
                          options={DAFF_PERMISSION_SELECT_OPTIONS}
                          value={DAFF_PERMISSION_SELECT_OPTIONS.find((o) => o.value === (pack.daffPermission || "N/A")) ?? null}
                          onChange={(option) => set("daffPermission", option ? option.value : "")}
                        />
                      </FormRow>
                    ) : null}
                  </div>
                </div>
                <FormRow label="Pack warning" className={spanFullClass}>
                  <div className="flex flex-wrap items-center gap-3">
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
                  <FormRow label="Pack warning details" className={spanFullClass}>
                    <textarea
                      className={`${inputClass} min-h-[3rem] resize-y`}
                      value={pack.packWarning || ""}
                      onChange={(e) => set("packWarning", e.target.value)}
                      placeholder="Enter pack warning…"
                    />
                  </FormRow>
                ) : null}
              </div>
            </section>

            <BlendPackSection
              isBlend={pack.isBlend}
              blendComponents={pack.blendComponents}
              customerId={pack.customerId}
              commodityOptions={commodityOptions}
              stockLocations={queryLookups.stockLocations}
              mtTotal={computedMtTotal}
              actualPackedMt={actualPackedMt}
              onToggle={(enabled) =>
                setPack((prev) => ({
                  ...prev,
                  isBlend: enabled,
                  blendComponents: enabled && (!prev.blendComponents || prev.blendComponents.length === 0)
                    ? [{ commodityId: null, locationId: null, quantity: null, commodityName: "", locationName: "", commodityTypeId: null }]
                    : prev.blendComponents || [],
                }))
              }
              onChange={(components) => set("blendComponents", components)}
              sectionClass={sectionClass}
              inputClass={inputClass}
            />

            <BlendPerformAction
              pack={pack}
              packId={pack.id || editingRow?.id || editId}
              commodityOptions={commodityOptions}
              stockLocations={queryLookups.stockLocations}
              mtTotal={computedMtTotal}
              actualPackedMt={actualPackedMt}
              onPerformed={(result) =>
                setPack((prev) => ({
                  ...prev,
                  blendPerformedAt: result?.blendPerformedAt ?? new Date().toISOString(),
                  blendTransferId: result?.blendTransferId ?? prev.blendTransferId,
                  blendPending: false,
                }))
              }
              sectionClass={sectionClass}
            />

            <div className={containersShippingRowClass}>
              <section className={flushSectionClass} aria-label="Containers and quantity">
                <div className={cn(innerPanelClass, flushSectionBodyClass)}>
                  <div className="grid gap-2 lg:grid-cols-3 xl:grid-cols-5">
                    <FormRow label="Containers Required">
                      <input className={inputClass} type="number" value={pack.containersRequired} onChange={(e) => set("containersRequired", e.target.value)} placeholder="0" />
                    </FormRow>
                    <FormRow label="Containers Left To Pack">
                      <input className={inputClass} value={containersLeftToPackDisplay} readOnly disabled placeholder="0" />
                    </FormRow>
                    <FormRow label="Container Code">
                      {(() => {
                        const containerCodeSelectOpts = containerCodeOptions.map((row) => {
                          const iso = row.iso_code ?? row.isoCode ?? "";
                          const size = row.container_size ?? row.containerSize ?? "";
                          const desc = row.description ?? "";
                          const lbl = [iso, size ? `· ${size}` : "", desc ? `— ${desc}` : ""].filter(Boolean).join(" ");
                          return { value: iso, label: lbl, _id: row.id };
                        });
                        return (
                          <ClutchSelect
                            placeholder="- Select container code -"
                            options={containerCodeSelectOpts}
                            value={containerCodeSelectOpts.find((o) => o.value === (pack.containerCode || "")) ?? null}
                            onChange={(option) => {
                              const iso = option ? option.value : "";
                              const matched = containerCodeOptions.find((r) => (r.iso_code ?? r.isoCode ?? "") === iso);
                              setPack((prev) => ({ ...prev, containerCode: iso, containerCodeId: matched?.id ?? "" }));
                            }}
                          />
                        );
                      })()}
                    </FormRow>
                  </div>

                  <div className="grid gap-2 lg:grid-cols-3 xl:grid-cols-5">
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
                    <FormRow label="MT total">
                      <input
                        className={`${inputClass} cursor-default bg-slate-50 text-slate-800 tabular-nums`}
                        readOnly
                        value={computedMtTotal != null && Number.isFinite(computedMtTotal) ? String(computedMtTotal) : ""}
                        placeholder="—"
                        title="Containers required × required tonnes per container"
                      />
                    </FormRow>
                  </div>

                  <div className="grid gap-2 lg:grid-cols-3 xl:grid-cols-5">
                    <FormRow label="Actual amount packed (MT)">
                      <input
                        className={`${inputClass} cursor-default bg-slate-50 text-slate-800 tabular-nums`}
                        readOnly
                        value={actualPackedMt > 0 ? actualPackedMt.toLocaleString(undefined, { maximumFractionDigits: 3 }) : ""}
                        placeholder="—"
                        title="Total nett weight of all containers"
                      />
                    </FormRow>
                    <FormRow label="Containers packed">
                      <input
                        className={`${inputClass} cursor-default bg-slate-50 text-slate-800 tabular-nums`}
                        readOnly
                        value={
                          pack.containersRequired === "" || pack.containersRequired == null
                            ? String(containersPacked)
                            : `${containersPacked} / ${pack.containersRequired}`
                        }
                        placeholder="—"
                        title="Containers completed with passed inspections"
                      />
                    </FormRow>
                  </div>

                  <div className="space-y-2 border-t border-slate-200/80 pt-2">
                    <p className="text-[10px] text-slate-500">
                      Releases are pickup references only. Container counts are controlled by the pack and its draft containers.
                    </p>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                      Release number <span className="font-normal normal-case text-slate-400">· Release lines: {releaseRows.length}</span>
                    </p>
                    {(releaseRows.length ? releaseRows : [{ releaseRef: "", emptyContainerParkId: "", transporterId: "" }]).map((entry, index) => {
                      const baseRows = releaseRows.length ? releaseRows : [{ releaseRef: "", emptyContainerParkId: "", transporterId: "" }];
                      const isKnownRelease = releaseOptions.some((r) => r.releaseNumber === entry.releaseRef);
                      return (
                      <div key={`release-row-${index}`} className="grid gap-1.5 lg:grid-cols-[1fr_1fr_1fr_auto]">
                        {(() => {
                          const releaseSelectOpts = [
                            ...(!isKnownRelease && entry.releaseRef ? [{ value: entry.releaseRef, label: entry.releaseRef }] : []),
                            ...releaseOptions.map((r) => ({ value: r.releaseNumber, label: r.releaseNumber + (r.status ? ` (${r.status})` : "") })),
                          ];
                          return (
                            <ClutchSelect
                              placeholder="- Select release -"
                              options={releaseSelectOpts}
                              value={releaseSelectOpts.find((o) => o.value === (entry.releaseRef || "")) ?? null}
                              onChange={(option) => {
                                const num = option ? option.value : "";
                                const rel = releaseOptions.find((r) => r.releaseNumber === num);
                                const firstPark = rel?.parks?.[0];
                                const next = baseRows.map((row, idx) =>
                                  idx === index
                                    ? {
                                        ...row,
                                        releaseRef: num,
                                        emptyContainerParkId: firstPark?.containerParkId || row.emptyContainerParkId || "",
                                        transporterId: firstPark?.transporterIds?.[0] || row.transporterId || "",
                                      }
                                    : row
                                );
                                // Keep a trailing blank row so more releases can be added without a separate button.
                                if (num && index === baseRows.length - 1) {
                                  next.push({ releaseRef: "", emptyContainerParkId: "", transporterId: "" });
                                }
                                set("releaseDetails", next);
                              }}
                            />
                          );
                        })()}
                        {(() => {
                          const parkSelectOpts = containerParkOptions.map((park) => ({ value: String(park.id), label: park.name }));
                          return (
                            <ClutchSelect
                              placeholder="Empty Container Park"
                              options={parkSelectOpts}
                              value={parkSelectOpts.find((o) => String(o.value) === String(entry.emptyContainerParkId ?? "")) ?? null}
                              onChange={(option) => {
                                const next = baseRows.map((row, idx) => (idx === index ? { ...row, emptyContainerParkId: option ? option.value : "" } : row));
                                set("releaseDetails", next);
                              }}
                            />
                          );
                        })()}
                        {(() => {
                          const transporterSelectOpts = transporterOptions.map((t) => ({ value: String(t.id), label: t.name }));
                          return (
                            <ClutchSelect
                              placeholder="Select Transporter"
                              options={transporterSelectOpts}
                              value={transporterSelectOpts.find((o) => String(o.value) === String(entry.transporterId ?? "")) ?? null}
                              onChange={(option) => {
                                const next = baseRows.map((row, idx) => (idx === index ? { ...row, transporterId: option ? option.value : "" } : row));
                                set("releaseDetails", next);
                              }}
                            />
                          );
                        })()}
                        <div className="flex items-center justify-end gap-1.5">
                          {entry.releaseRef ? (
                            <span
                              className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium tabular-nums text-slate-600"
                              title="Containers assigned to this release on this pack"
                            >
                              {countForReleaseRef(entry.releaseRef)} ctr
                            </span>
                          ) : null}
                          {entry.releaseRef ? (
                            <button
                              type="button"
                              className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-brand"
                              title="Edit release, import containers, or remove from pack"
                              aria-label="Edit release"
                              onClick={() => openEditRelease(index)}
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                          ) : null}
                        </div>
                      </div>
                      );
                    })}

                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        type="button"
                        onClick={() => openQuickAddRelease()}
                        title="Create a full Release record and attach it to this pack"
                      >
                        + Quick add Release
                      </Button>
                    </div>
                  </div>
                </div>
              </section>

              <section className={flushSectionClass} aria-label={isImportJob ? "Import vessel" : "Destination and shipping"}>
                <div className={cn(flushSectionBodyClass, "gap-1", isImportJob && "rounded-md bg-emerald-50/60 p-2")}>
                  <div className={shippingGridClass}>
                    {!isImportJob ? (
                      <>
                        <FormRow label="Destination country">
                          {(() => {
                            const countrySelectOpts = countryOptions.map((c) => ({ value: c.name, label: c.name }));
                            return (
                              <ClutchSelect
                                placeholder="- Select country -"
                                options={countrySelectOpts}
                                value={countrySelectOpts.find((o) => o.value === pack.destinationCountry) ?? null}
                                onChange={(option) =>
                                  setPack((prev) => ({
                                    ...prev,
                                    destinationCountry: option ? option.value : "",
                                    destinationPort: "",
                                  }))
                                }
                              />
                            );
                          })()}
                        </FormRow>
                        <FormRow label="Destination port">
                          {(() => {
                            const destPortOpts = [
                              ...(pack.destinationPort && !destinationPortOptions.some((p) => p.name === pack.destinationPort)
                                ? [{ value: pack.destinationPort, label: pack.destinationPort }]
                                : []),
                              ...destinationPortOptions.map((port) => ({ value: port.name, label: port.name + (port.code ? ` (${port.code})` : "") })),
                            ];
                            return (
                              <ClutchSelect
                                placeholder={pack.destinationCountry ? "- Select port -" : "- Select country first -"}
                                options={destPortOpts}
                                value={destPortOpts.find((o) => o.value === (pack.destinationPort || "")) ?? null}
                                onChange={(option) => set("destinationPort", option ? option.value : "")}
                              />
                            );
                          })()}
                        </FormRow>
                      </>
                    ) : null}
                    <FormRow label={isImportJob ? "Shipping operator" : "Shipping line"}>
                      {(() => {
                        const shippingLineSelectOpts = shippingLineOptions.map((l) => ({ value: String(l.id), label: `${l.name} (${l.code})` }));
                        return (
                          <ClutchSelect
                            placeholder="- Select -"
                            options={shippingLineSelectOpts}
                            value={shippingLineSelectOpts.find((o) => String(o.value) === String(pack.shippingLineId)) ?? null}
                            onChange={(option) => set("shippingLineId", option ? option.value : "")}
                          />
                        );
                      })()}
                    </FormRow>
                    <FormRow label={isImportJob ? "Terminal" : "Terminal (port of loading)"}>
                      {(() => {
                        const terminalSelectOpts = terminalOptions.map((t) => ({
                          value: String(t.id),
                          label: (t.terminal_name ?? t.terminalName ?? t.name) + ((t.terminal_code ?? t.terminalCode) ? ` (${t.terminal_code ?? t.terminalCode})` : ""),
                        }));
                        return (
                          <ClutchSelect
                            placeholder="- Select -"
                            options={terminalSelectOpts}
                            value={terminalSelectOpts.find((o) => String(o.value) === String(pack.terminalId ?? "")) ?? null}
                            onChange={(option) => {
                              const terminalId = option ? option.value : "";
                              const matched = terminalId ? terminalOptions.find((t) => String(t.id) === terminalId) : null;
                              setPack((prev) => ({
                                ...prev,
                                terminalId,
                                portOfLoading:
                                  (matched?.port_of_loading ?? matched?.portOfLoading) && !String(prev.portOfLoading ?? "").trim()
                                    ? (matched.port_of_loading ?? matched.portOfLoading)
                                    : prev.portOfLoading,
                              }));
                            }}
                          />
                        );
                      })()}
                    </FormRow>
                    {!isImportJob ? (
                      <>
                        <FormRow label="Transshipment port">
                          {(() => {
                            const transshipmentPortOpts = [
                              ...(pack.transshipmentPort && !portOptions.some((p) => p.name === pack.transshipmentPort)
                                ? [{ value: pack.transshipmentPort, label: pack.transshipmentPort }]
                                : []),
                              ...portOptions.map((port) => ({ value: port.name, label: port.name + (port.code ? ` (${port.code})` : "") })),
                            ];
                            return (
                              <ClutchSelect
                                placeholder="- Select port -"
                                options={transshipmentPortOpts}
                                value={transshipmentPortOpts.find((o) => o.value === (pack.transshipmentPort || "")) ?? null}
                                onChange={(option) => {
                                  const name = option ? option.value : "";
                                  const matched = portOptions.find((p) => p.name === name);
                                  setPack((prev) => ({
                                    ...prev,
                                    transshipmentPort: name,
                                    transshipmentPortCode: matched?.code ?? prev.transshipmentPortCode,
                                  }));
                                }}
                              />
                            );
                          })()}
                        </FormRow>
                        <FormRow label="Transshipment port code">
                          <input className={inputClass} value={pack.transshipmentPortCode} onChange={(e) => set("transshipmentPortCode", e.target.value)} placeholder="Code" />
                        </FormRow>
                      </>
                    ) : null}
                    {isImportJob ? (
                      <FormRow label="Vessel">
                        <input className={inputClass} value={pack.vesselName || ""} readOnly placeholder="Select a voyage below" />
                      </FormRow>
                    ) : null}
                    <FormRow label={isImportJob ? "Vessel search" : "Vessel departure"}>
                      <div className="flex items-center gap-1.5">
                        {(() => {
                          const vesselSelectOpts = vesselVoyageOptions.map((vd) => {
                            const name = vesselDisplayName(vd);
                            const voyageNo = vd.voyage_number ?? vd.voyageNumber ?? "";
                            const cutoff = vd.vessel_cutoff_date ?? vd.vesselCutoffDate ?? "";
                            const eta = vd.vessel_eta ?? vd.vesselEta ?? "";
                            const suffix = isImportJob
                              ? (eta ? ` - ETA ${formatDateDisplay(eta)}` : "")
                              : (cutoff ? ` - Cut-off ${formatDateDisplay(cutoff)}` : "");
                            return {
                              value: String(vd.id),
                              label: name + (voyageNo ? ` (${voyageNo})` : "") + suffix,
                            };
                          });
                          return (
                            <ClutchSelect
                              placeholder="- Select vessel -"
                              options={vesselSelectOpts}
                              value={vesselSelectOpts.find((o) => String(o.value) === String(pack.vesselDepartureId ?? "")) ?? null}
                              onChange={(option) => {
                                const nextId = option ? option.value : null;
                                const voyage = nextId ? vesselVoyageOptions.find((vd) => String(vd.id) === nextId) : null;
                                setPack((prev) =>
                                  applySelectedVoyageToPack({ ...prev, vesselDepartureId: nextId }, voyage, isImportJob, terminalOptions),
                                );
                              }}
                            />
                          );
                        })()}
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="shrink-0 whitespace-nowrap"
                          onClick={() => setQuickVesselOpen(true)}
                          title="Create a new vessel and voyage"
                        >
                          {isImportJob ? "Vessel search" : "+ Quick add"}
                        </Button>
                        {isImportJob && pack.vesselDepartureId ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="shrink-0 whitespace-nowrap"
                            onClick={() => router.push("/shipping-details/vessel-voyage")}
                            title="Edit vessel details in Shipping Details"
                          >
                            Edit vessel
                          </Button>
                        ) : null}
                      </div>
                    </FormRow>
                    <FormRow label="Terminal (port of loading)">
                      {(() => {
                        const terminalSelectOpts = terminalOptions.map((t) => ({
                          value: String(t.id),
                          label: (t.terminal_name ?? t.terminalName ?? t.name) + ((t.terminal_code ?? t.terminalCode) ? ` (${t.terminal_code ?? t.terminalCode})` : ""),
                        }));
                        return (
                          <ClutchSelect
                            placeholder="- Select -"
                            options={terminalSelectOpts}
                            value={terminalSelectOpts.find((o) => String(o.value) === String(pack.terminalId ?? "")) ?? null}
                            onChange={(option) => {
                              const terminalId = option ? option.value : "";
                              const matched = terminalId ? terminalOptions.find((t) => String(t.id) === terminalId) : null;
                              setPack((prev) => ({
                                ...prev,
                                terminalId,
                                portOfLoading:
                                  (matched?.port_of_loading ?? matched?.portOfLoading) && !String(prev.portOfLoading ?? "").trim()
                                    ? (matched.port_of_loading ?? matched.portOfLoading)
                                    : prev.portOfLoading,
                              }));
                            }}
                          />
                        );
                      })()}
                    </FormRow>
                    <FormRow label="Voyage number">
                      <input className={inputClass} value={pack.voyageNumber || ""} onChange={(e) => set("voyageNumber", e.target.value)} placeholder="Voyage number" />
                    </FormRow>
                    <FormRow label={isImportJob ? "Lloyds number" : "Lloyd ID"}>
                      <input className={inputClass} value={pack.lloydId || ""} onChange={(e) => set("lloydId", e.target.value)} placeholder={isImportJob ? "Lloyds number" : "Lloyd ID"} />
                    </FormRow>
                    {isImportJob ? (
                      <>
                        <FormRow label="Estimated arrival date">
                          <input
                            className={cn(inputClass, "bg-slate-50")}
                            type="datetime-local"
                            value={formatDateTimeInput(vesselImportDates.vesselEta)}
                            readOnly
                            tabIndex={-1}
                          />
                        </FormRow>
                        <FormRow label="First free date">
                          <input
                            className={cn(inputClass, "bg-slate-50")}
                            type="datetime-local"
                            value={formatDateTimeInput(vesselImportDates.firstFreeImportDate)}
                            readOnly
                            tabIndex={-1}
                          />
                        </FormRow>
                        <FormRow label="Storage start date">
                          <input
                            className={cn(inputClass, "bg-slate-50")}
                            type="datetime-local"
                            value={formatDateTimeInput(vesselImportDates.importStorageStartDate)}
                            readOnly
                            tabIndex={-1}
                          />
                        </FormRow>
                      </>
                    ) : (
                      <>
                        <FormRow label="Cut-off">
                          <input className={inputClass} type="date" value={pack.vesselCutoffDate || ""} onChange={(e) => set("vesselCutoffDate", e.target.value)} />
                        </FormRow>
                        <FormRow label="ETD">
                          <input className={inputClass} type="date" value={pack.etd || ""} onChange={(e) => set("etd", e.target.value)} />
                        </FormRow>
                      </>
                    )}
                  </div>
                  {selectedVessel ? (
                    <p className="shrink-0 text-[10px] leading-snug text-slate-500">
                      <span className="font-semibold text-slate-700">Vessel schedule:</span>{" "}
                      {vesselDisplayName(selectedVessel)}{" "}
                      {(selectedVessel.voyage_number ?? selectedVessel.voyageNumber) ? `(${selectedVessel.voyage_number ?? selectedVessel.voyageNumber})` : ""}
                      {isImportJob && vesselImportDates.vesselEta
                        ? ` · ETA ${formatDateDisplay(vesselImportDates.vesselEta)}`
                        : (selectedVessel.vessel_cutoff_date ?? selectedVessel.vesselCutoffDate)
                          ? ` · Cut-off ${formatDateDisplay(selectedVessel.vessel_cutoff_date ?? selectedVessel.vesselCutoffDate)}`
                          : ""}
                    </p>
                  ) : null}
                </div>
              </section>

              {isImportJob ? (
                <section className={flushSectionClass} aria-label="Import schedule details">
                  <div className={cn(flushSectionBodyClass, "gap-1")}>
                    <div className={shippingGridClass}>
                      <FormRow label="Planned inspection date">
                        <input
                          className={inputClass}
                          type="datetime-local"
                          value={formatDateTimeInput(pack.plannedInspectionDate)}
                          onChange={(e) => set("plannedInspectionDate", e.target.value)}
                        />
                      </FormRow>
                      <FormRow label="DAFF inspection booked">
                        <ClutchSelect
                          isClearable={false}
                          options={YES_NO_OPTIONS}
                          value={
                            YES_NO_OPTIONS.find((o) =>
                              o.value === (pack.daffInspectionBooked === null ? "" : pack.daffInspectionBooked ? "yes" : "no")
                            ) ?? null
                          }
                          onChange={(option) => set("daffInspectionBooked", option?.value === "yes" ? true : option?.value === "no" ? false : null)}
                        />
                      </FormRow>
                      <FormRow label="DAFF confirmed date">
                        <input
                          className={inputClass}
                          type="datetime-local"
                          value={formatDateTimeInput(pack.daffConfirmedDate)}
                          onChange={(e) => set("daffConfirmedDate", e.target.value)}
                        />
                      </FormRow>
                      <FormRow label="Tonnes per container">
                        <input
                          className={inputClass}
                          type="number"
                          step="0.0001"
                          value={pack.quantityPerContainer ?? ""}
                          onChange={(e) => set("quantityPerContainer", e.target.value)}
                          placeholder="Tonnes"
                        />
                      </FormRow>
                      <FormRow label="Total tonnage">
                        <input className={cn(inputClass, "bg-slate-50")} type="number" step="0.0001" value={computedMtTotal ?? pack.mtTotal ?? 0} readOnly tabIndex={-1} />
                      </FormRow>
                      <FormRow label="Unloading location">
                        {(() => {
                          const unloadingOpts = [
                            ...(pack.unloadingLocation && !terminalOptions.some((t) => (t.terminal_name ?? t.terminalName ?? t.name) === pack.unloadingLocation)
                              ? [{ value: pack.unloadingLocation, label: pack.unloadingLocation }]
                              : []),
                            ...terminalOptions.map((t) => ({
                              value: t.terminal_name ?? t.terminalName ?? t.name,
                              label: (t.terminal_name ?? t.terminalName ?? t.name) + ((t.terminal_code ?? t.terminalCode) ? ` (${t.terminal_code ?? t.terminalCode})` : ""),
                            })),
                          ];
                          return (
                            <ClutchSelect
                              placeholder="- Select location -"
                              options={unloadingOpts}
                              value={unloadingOpts.find((o) => o.value === (pack.unloadingLocation || "")) ?? null}
                              onChange={(option) => set("unloadingLocation", option ? option.value : "")}
                            />
                          );
                        })()}
                      </FormRow>
                      <FormRow label="Import directions received">
                        <ClutchSelect
                          isClearable={false}
                          options={YES_NO_OPTIONS}
                          value={
                            YES_NO_OPTIONS.find((o) =>
                              o.value === (pack.importDirectionsReceived === null ? "" : pack.importDirectionsReceived ? "yes" : "no")
                            ) ?? null
                          }
                          onChange={(option) => set("importDirectionsReceived", option?.value === "yes" ? true : option?.value === "no" ? false : null)}
                        />
                      </FormRow>
                      <FormRow label="Import direction code">
                        <input className={inputClass} value={pack.importDirectionCode || ""} onChange={(e) => set("importDirectionCode", e.target.value)} placeholder="Direction code" />
                      </FormRow>
                      <FormRow label="EDO received">
                        <ClutchSelect
                          isClearable={false}
                          options={YES_NO_OPTIONS}
                          value={
                            YES_NO_OPTIONS.find((o) =>
                              o.value === (pack.edoReceived === null ? "" : pack.edoReceived ? "yes" : "no")
                            ) ?? null
                          }
                          onChange={(option) => set("edoReceived", option?.value === "yes" ? true : option?.value === "no" ? false : null)}
                        />
                      </FormRow>
                      <FormRow label="Date collected">
                        <input
                          className={inputClass}
                          type="datetime-local"
                          value={formatDateTimeInput(pack.dateCollected)}
                          onChange={(e) => set("dateCollected", e.target.value)}
                        />
                      </FormRow>
                      <FormRow label="Free days">
                        <input
                          className={inputClass}
                          type="number"
                          min="0"
                          step="1"
                          value={pack.freeDays ?? ""}
                          onChange={(e) => set("freeDays", e.target.value)}
                          placeholder="Days"
                        />
                      </FormRow>
                      <FormRow label="Dehire by date">
                        <input
                          className={inputClass}
                          type="datetime-local"
                          value={formatDateTimeInput(pack.dehireByDate)}
                          onChange={(e) => set("dehireByDate", e.target.value)}
                        />
                      </FormRow>
                      <FormRow label="Final dehire date">
                        <input
                          className={inputClass}
                          type="datetime-local"
                          value={formatDateTimeInput(pack.finalDehireDate)}
                          onChange={(e) => set("finalDehireDate", e.target.value)}
                        />
                      </FormRow>
                    </div>
                  </div>
                </section>
              ) : null}
            </div>

            <div className={importPermitRfpRowClass}>
              {!isImportJob ? (
              <section className={flushSectionClass} aria-label="Import permit">
                <div className={cn(flushSectionBodyClass, "gap-2")}>
                  <div className={sectionStackClass}>
                    <FormRow label="Import permit required">
                      <ClutchSelect
                        isClearable={false}
                        options={YES_NO_OPTIONS}
                        value={YES_NO_OPTIONS.find((o) => o.value === (pack.importPermitRequired ? "yes" : "no")) ?? null}
                        onChange={(option) => set("importPermitRequired", option?.value === "yes")}
                      />
                    </FormRow>
                    <FormRow label="Import permit number">
                      <input className={inputClass} value={pack.importPermitNumber} onChange={(e) => set("importPermitNumber", e.target.value)} placeholder="Number" />
                    </FormRow>
                    <FormRow label="Import permit date">
                      <input className={inputClass} type="date" value={pack.importPermitDate} onChange={(e) => set("importPermitDate", e.target.value)} />
                    </FormRow>
                  </div>
                  <FormRow label="Import permit file(s)">
                    <input
                      className={inputClass}
                      type="file"
                      multiple
                      onChange={(e) => {
                        addFiles("importPermitFiles", e.target.files);
                        e.target.value = "";
                      }}
                    />
                    <PackFileList items={normalizeFileItems(pack.importPermitFiles)} onRemove={(id) => removeFile("importPermitFiles", id)} />
                  </FormRow>
                </div>
              </section>
              ) : null}

              {!isImportJob ? (
              <section className={flushSectionClass} aria-label="RFP">
                <div className={flushSectionBodyClass}>
                  <div className={rfpGridClass}>
                    <FormRow label="RFP">
                      <input className={inputClass} value={pack.rfp} onChange={(e) => set("rfp", e.target.value)} placeholder="RFP reference" />
                    </FormRow>
                    <FormRow label="EDN">
                      <input className={inputClass} value={pack.edn || ""} onChange={(e) => set("edn", e.target.value)} placeholder="EDN reference" />
                    </FormRow>
                    <FormRow label="RFP additional declaration required" labelClassName="normal-case tracking-normal text-[10px] leading-tight">
                      <ClutchSelect
                        isClearable={false}
                        options={YES_NO_OPTIONS}
                        value={YES_NO_OPTIONS.find((o) => o.value === (pack.rfpAdditionalDeclarationRequired ? "yes" : "no")) ?? null}
                        onChange={(option) => set("rfpAdditionalDeclarationRequired", option?.value === "yes")}
                      />
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
                    <FormRow label="RFP pack type">
                      <input className={inputClass} value={pack.rfpPackType || ""} onChange={(e) => set("rfpPackType", e.target.value)} placeholder="e.g. Packaged" />
                    </FormRow>
                    <FormRow label="RFP total quantity">
                      <input className={inputClass} type="number" step="0.0001" value={pack.rfpTotalQuantity ?? ""} onChange={(e) => set("rfpTotalQuantity", e.target.value)} placeholder="Quantity" />
                    </FormRow>
                    <FormRow label="RFP quantity unit">
                      <input className={inputClass} value={pack.rfpQuantityUnit || "M/TONS"} onChange={(e) => set("rfpQuantityUnit", e.target.value)} placeholder="M/TONS" />
                    </FormRow>
                    <FormRow label="RFP flow path">
                      <input className={inputClass} value={pack.rfpFlowPath || ""} onChange={(e) => set("rfpFlowPath", e.target.value)} placeholder="Packaged" />
                    </FormRow>
                    <FormRow label="Original RFP number">
                      <input className={inputClass} value={pack.originalRfpNumber || ""} onChange={(e) => set("originalRfpNumber", e.target.value)} placeholder="Optional" />
                    </FormRow>
                  </div>
                  <div className={cn(rfpFilesRowClass, "mt-auto")}>
                    <FormRow label="RFP file(s)">
                      <input
                        className={inputClass}
                        type="file"
                        multiple
                        onChange={(e) => {
                          addFiles("rfpFiles", e.target.files);
                          e.target.value = "";
                        }}
                      />
                      <PackFileList items={normalizeFileItems(pack.rfpFiles)} onRemove={(id) => removeFile("rfpFiles", id)} />
                    </FormRow>
                    <FormRow label="Additional declaration file(s)">
                      <input
                        className={inputClass}
                        type="file"
                        multiple
                        onChange={(e) => {
                          addFiles("additionalDeclarationFiles", e.target.files);
                          e.target.value = "";
                        }}
                      />
                      <PackFileList
                        items={normalizeFileItems(pack.additionalDeclarationFiles)}
                        onRemove={(id) => removeFile("additionalDeclarationFiles", id)}
                      />
                    </FormRow>
                  </div>
                </div>
              </section>
              ) : null}
            </div>

            {isImportJob ? (
              <section className={sectionClass} aria-label="Import documents and notes">
                <div className="grid gap-2 xl:grid-cols-2 2xl:grid-cols-4">
                  <FormRow label="Import order file">
                    <input
                      className={inputClass}
                      type="file"
                      multiple
                      onChange={(e) => {
                        addFiles("importOrderFiles", e.target.files);
                        e.target.value = "";
                      }}
                    />
                    <PackFileList items={normalizeFileItems(pack.importOrderFiles)} onRemove={(id) => removeFile("importOrderFiles", id)} />
                  </FormRow>
                  <FormRow label="Packing list file">
                    <input
                      className={inputClass}
                      type="file"
                      multiple
                      onChange={(e) => {
                        addFiles("importPackingListFiles", e.target.files);
                        e.target.value = "";
                      }}
                    />
                    <PackFileList items={normalizeFileItems(pack.importPackingListFiles)} onRemove={(id) => removeFile("importPackingListFiles", id)} />
                  </FormRow>
                  <FormRow label="Additional file">
                    <input
                      className={inputClass}
                      type="file"
                      multiple
                      onChange={(e) => {
                        addFiles("importAdditionalFiles", e.target.files);
                        e.target.value = "";
                      }}
                    />
                    <PackFileList items={normalizeFileItems(pack.importAdditionalFiles)} onRemove={(id) => removeFile("importAdditionalFiles", id)} />
                  </FormRow>
                  <FormRow label="Import container list">
                    <input
                      className={inputClass}
                      type="file"
                      multiple
                      onChange={(e) => {
                        addFiles("importContainerListFiles", e.target.files);
                        e.target.value = "";
                      }}
                    />
                    <PackFileList items={normalizeFileItems(pack.importContainerListFiles)} onRemove={(id) => removeFile("importContainerListFiles", id)} />
                  </FormRow>
                </div>
                <FormRow label="Import pack notes" className="mt-2">
                  <textarea
                    className={`${inputClass} min-h-[4rem] resize-y`}
                    value={pack.importPackNotes}
                    onChange={(e) => set("importPackNotes", e.target.value)}
                    placeholder="Import pack notes..."
                  />
                </FormRow>
              </section>
            ) : (
            <section className={sectionClass} aria-label="Packing and notes">
              <div className="grid gap-2 xl:grid-cols-2">
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
                  <PackFileList
                    items={normalizeFileItems(pack.packingInstructionFiles)}
                    onRemove={(id) => removeFile("packingInstructionFiles", id)}
                  />
                </FormRow>
                <FormRow label="Job notes">
                  <textarea className={`${inputClass} min-h-[3rem] resize-y`} value={pack.jobNotes} onChange={(e) => set("jobNotes", e.target.value)} placeholder="Notes..." />
                </FormRow>
              </div>
            </section>
            )}
          </>
        ) : null}

        {activeTab === "pems" ? (
          <PemsTab
            containers={packContainers}
            packerNames={packerNames}
            selectedContainerId={editingContainerId}
            onSelectContainer={setEditingContainerId}
            onOpenContainer={setEditingContainerId}
            openContainerLabel="Edit"
            pemsDraft={pemsDraft}
            selectedAoNumber={selectedAoNumber}
            pemsSubmissions={pemsSubmissions}
            siteRow={selectedPackSite}
            packRow={{ ...pack, commodity: packPemsCommodityLabel, jobReference: pack.jobReference || pack.packNumber }}
            aoNameOptions={aoOptions.map((ao) => ao.name)}
            customerOptions={customerOptions}
            countryOptions={countryOptions.map((country) => country.name)}
            submitError={pemsSubmitError}
            isSubmitting={isSubmittingPems}
            canAoSignoff={hasPermission("packing.container.ao-signoff")}
            onUpdatePemsDraft={updatePemsDraft}
            onToggleStage={togglePemsContainer}
            onStageAll={() =>
              updatePemsDraft({
                stagedContainerIds:
                  pemsDraft.recordType === GPPIR_RECORD_TYPE
                    ? packContainers.filter((container) => container.ecrSubmitted).map((container) => container.id)
                    : packContainers.map((container) => container.id),
              })
            }
            onClearStage={() => updatePemsDraft({ stagedContainerIds: [] })}
            onSubmitBatch={submitPemsFromForm}
            onUpdatePackRow={(patch) => setPack((prev) => ({ ...prev, ...patch }))}
            onUpdateContainer={updatePackContainer}
            inputClass={inputClass}
          />
        ) : null}

            {activeTab === "accounting" ? (
              <PackAccountingTab
                packId={accountingPackId}
                packStatus={pack.status}
                refreshKey={accountingRefreshKey}
                isActive={activeTab === "accounting"}
              />
            ) : null}

            {activeTab === "fumigation" && pack.fumigationRequired ? (
              <section className={sectionClass} aria-label="Fumigation">
                <p className="mb-2 text-[10px] leading-snug text-slate-500">
                  Section layout mirrors the AU Government fumigation cert/record template. Every field here pre-fills into the
                  Certificate &amp; Record editors when you click Generate.
                </p>
                <div className="space-y-2">

                  <div className={cn(sectionColumnsClass, "gap-3 xl:gap-4")}>
                    {/* ─── Section A — Fumigator in charge ─── */}
                    <div className={fumigationInnerClass} aria-label="Section A — Fumigator in charge">
                      <div className={fumigationTopGridClass}>
                        <FormRow label="Fumigant">
                          {(() => {
                            const fumigantOpts = fumigants.map((item) => ({ value: item.id, label: `${item.code} - ${item.name}` }));
                            return (
                              <ClutchSelect
                                placeholder="- Select -"
                                options={fumigantOpts}
                                value={fumigantOpts.find((o) => o.value === (pack.fumigantId ?? null)) ?? null}
                                onChange={(option) => {
                                  const fumigantId = option ? option.value : null;
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
                              />
                            );
                          })()}
                        </FormRow>
                        <FormRow label="Methodology">
                          {(() => {
                            const methodologyOpts = fumigationMethodologyOptions.map((item) => ({
                              value: item.id,
                              label: item.name + (item.version ? ` (${item.version})` : ""),
                            }));
                            return (
                              <ClutchSelect
                                placeholder="- Select -"
                                options={methodologyOpts}
                                value={methodologyOpts.find((o) => o.value === (pack.methodologyId ?? null)) ?? null}
                                isDisabled={!pack.fumigantId}
                                onChange={(option) => set("methodologyId", option ? option.value : null)}
                              />
                            );
                          })()}
                        </FormRow>
                        <FormRow label="Fumigation timing">
                          <ClutchSelect
                            placeholder="Select timing…"
                            options={FUMIGATION_TIMING_OPTIONS}
                            value={FUMIGATION_TIMING_OPTIONS.find((o) => o.value === (pack.fumigationTiming ?? "")) ?? null}
                            onChange={(option) => set("fumigationTiming", option ? option.value : "")}
                          />
                        </FormRow>
                      </div>
                      <div className={cn("mt-2", fumigationTopGridClass)}>
                        <FormRow label="Fumigator name">
                          {(() => {
                            const fumigatorSelectOpts = fumigatorOptions.map((u) => ({ value: u.name, label: u.name + (u.fumigatorLicence ? ` (${u.fumigatorLicence})` : "") }));
                            return (
                              <ClutchSelect
                                placeholder="- Select fumigator -"
                                options={fumigatorSelectOpts}
                                value={fumigatorSelectOpts.find((o) => o.value === (fd.fumigatorName || "")) ?? null}
                                onChange={(option) => {
                                  const name = option ? option.value : "";
                                  const matched = fumigatorOptions.find((u) => u.name === name) || null;
                                  setPack((prev) => {
                                    const detail = (prev.fumigationDetail && typeof prev.fumigationDetail === "object")
                                      ? prev.fumigationDetail
                                      : blankFumigationDetail();
                                    // Pre-fill accreditation (fumigatorLicence) on selection; user can still override.
                                    const accreditation = matched?.fumigatorLicence ?? prev.fumigatorAccreditationNumber ?? "";
                                    return {
                                      ...prev,
                                      fumigatorAccreditationNumber: accreditation,
                                      fumigationDetail: { ...detail, fumigatorName: name },
                                    };
                                  });
                                }}
                              />
                            );
                          })()}
                        </FormRow>
                        <FormRow label="Accreditation number">
                          <input
                            className={inputClass}
                            value={pack.fumigatorAccreditationNumber ?? ""}
                            onChange={(e) => setPack((p) => ({ ...p, fumigatorAccreditationNumber: e.target.value }))}
                            placeholder="Pre-filled from fumigator's licence"
                          />
                        </FormRow>
                        <FormRow label="Treatment provider ID">
                          <input
                            className={inputClass}
                            value={pack.treatmentProviderId ?? ""}
                            onChange={(e) => setPack((p) => ({ ...p, treatmentProviderId: e.target.value }))}
                            placeholder={
                              selectedPackSite?.treatmentProviderId
                                ? "Pre-filled from site — edit to override"
                                : "Set on the Site reference data, or enter here"
                            }
                          />
                        </FormRow>
                      </div>
                    </div>

                    {/* ─── Section B — Job & consignment details ─── */}
                    <div className={fumigationInnerClass} aria-label="Section B — Job and consignment details">
                      <div className={fumigationTopGridClass}>
                        <PemsStagingField label="Job identification" value={pack.jobReference || "—"} />
                        <PemsStagingField label="Client (from pack)" value={stickySummary.customer || pack.customer || "—"} />
                        <PemsStagingField label="Destination country (from pack)" value={pack.destinationCountry || "—"} />
                        <FormRow label="Port of loading">
                          <input
                            className={inputClass}
                            value={pack.portOfLoading ?? ""}
                            onChange={(e) => setPack((p) => ({ ...p, portOfLoading: e.target.value }))}
                            placeholder="e.g. Port of Melbourne"
                          />
                        </FormRow>
                        <FormRow label="Commodity country of origin">
                          <input
                            className={inputClass}
                            value={pack.commodityCountryOfOrigin ?? ""}
                            onChange={(e) => setPack((p) => ({ ...p, commodityCountryOfOrigin: e.target.value }))}
                            placeholder="e.g. Australia"
                          />
                        </FormRow>
                      </div>
                      <FormRow className="mt-2" label="Target of fumigation (pick all that apply)">
                        <div className="flex flex-wrap gap-2 pt-0.5">
                          {FUMIGATION_TARGETS.map((t) => (
                            <label key={t.value} className="flex items-center gap-1.5 text-sm cursor-pointer">
                              <input
                                type="checkbox"
                                checked={(fd.targetOfFumigation ?? []).includes(t.value)}
                                onChange={(e) => {
                                  const prev = fd.targetOfFumigation ?? [];
                                  updateFumigationDetail({
                                    targetOfFumigation: e.target.checked
                                      ? [...prev, t.value]
                                      : prev.filter((v) => v !== t.value),
                                  });
                                }}
                              />
                              {t.label}
                            </label>
                          ))}
                        </div>
                      </FormRow>
                    </div>
                  </div>

                  {/* ─── Section C — Fumigation details ─── */}
                  <div className={fumigationInnerClass} aria-label="Section C — Fumigation details">

                    {/* Enclosure type */}
                    <FormRow label="Enclosure type">
                      <div className="flex flex-wrap gap-2 pt-0.5">
                        {ENCLOSURE_TYPES.map((opt) => (
                          <label key={opt.value} className="flex items-center gap-1.5 text-sm cursor-pointer">
                            <input
                              type="radio"
                              name="packEnclosureType"
                              value={opt.value}
                              checked={fd.enclosureType === opt.value}
                              onChange={() => updateFumigationDetail({ enclosureType: opt.value })}
                            />
                            {opt.label}
                          </label>
                        ))}
                      </div>
                    </FormRow>
                    {fd.enclosureType === "other" && (
                      <FormRow className="mt-2" label="Other enclosure description">
                        <input
                          className={inputClass}
                          value={fd.enclosureOtherText || ""}
                          onChange={(e) => updateFumigationDetail({ enclosureOtherText: e.target.value })}
                        />
                      </FormRow>
                    )}

                    <div className={cn("mt-2", fumigationGridClass)}>
                      <FormRow label="Length (m)">
                        <input
                          className={inputClass}
                          type="number"
                          step="any"
                          value={fd.enclosureLengthM ?? ""}
                          onChange={(e) => updateFumigationDetail({ enclosureLengthM: e.target.value })}
                        />
                      </FormRow>
                      <FormRow label="Width (m)">
                        <input
                          className={inputClass}
                          type="number"
                          step="any"
                          value={fd.enclosureWidthM ?? ""}
                          onChange={(e) => updateFumigationDetail({ enclosureWidthM: e.target.value })}
                        />
                      </FormRow>
                      <FormRow label="Height (m)">
                        <input
                          className={inputClass}
                          type="number"
                          step="any"
                          value={fd.enclosureHeightM ?? ""}
                          onChange={(e) => updateFumigationDetail({ enclosureHeightM: e.target.value })}
                        />
                      </FormRow>
                      <FormRow label="Total volume (m³)">
                        <input
                          className={inputClass}
                          type="number"
                          step="any"
                          value={fd.volumeM3 ?? ""}
                          onChange={(e) => updateFumigationDetail({ volumeM3: e.target.value })}
                        />
                      </FormRow>
                    </div>

                    <FormRow className="mt-2" label="Consignment suitable for fumigation?">
                      <div className="flex flex-wrap gap-2 pt-0.5">
                        {[
                          { v: true, l: "Yes — suitable" },
                          { v: false, l: "No — remedial action taken" },
                        ].map(({ v, l }) => (
                          <label key={String(v)} className="flex items-center gap-1.5 text-sm cursor-pointer">
                            <input
                              type="radio"
                              name="packConsignmentSuitable"
                              checked={fd.consignmentSuitable === v}
                              onChange={() => updateFumigationDetail({ consignmentSuitable: v })}
                            />
                            {l}
                          </label>
                        ))}
                      </div>
                    </FormRow>
                    {fd.consignmentSuitable === false && (
                      <FormRow className="mt-2" label="Remedial action taken">
                        <textarea
                          className={inputClass}
                          rows={2}
                          value={fd.consignmentRemedialAction ?? ""}
                          onChange={(e) => updateFumigationDetail({ consignmentRemedialAction: e.target.value })}
                        />
                      </FormRow>
                    )}

                    {/* Methodology reference panel — kept inside Section C */}
                    {selectedFumigationMethodology ? (
                      <div className="rounded-md border border-slate-200 bg-slate-50 p-2 text-[10px] text-slate-600">
                        <p className="font-semibold text-slate-800">
                          {selectedFumigationMethodology.name}
                          {selectedFumigationMethodology.version ? ` ${selectedFumigationMethodology.version}` : ""}
                        </p>
                        <p className="mt-1">Dosage guide: {selectedFumigationMethodology.dosageGuide || "—"}</p>
                        <p className="mt-1">Safety notes: {selectedFumigationMethodology.safetyNotes || "—"}</p>
                        {/* Dosage ranges reference table */}
                        {Array.isArray(selectedFumigationMethodology?.dosageRanges) &&
                          selectedFumigationMethodology.dosageRanges.length > 0 && (
                            <div className="mt-3">
                              {matchedDosageRange && (
                                <div className="mb-2 rounded bg-amber-50 px-3 py-1.5 text-xs text-amber-800 ring-1 ring-amber-200">
                                  Suggested at{" "}
                                  {fd.actualTemperature ?? fd.minAmbientTemperature ?? fd.minForecastedTemperature}°C:{" "}
                                  <strong>
                                    {matchedDosageRange.dosageValue} {matchedDosageRange.dosageUnit}
                                  </strong>{" "}
                                  for{" "}
                                  <strong>
                                    {matchedDosageRange.exposureValue} {matchedDosageRange.exposureUnit}
                                  </strong>
                                </div>
                              )}
                              <p className="mb-1 text-xs font-medium text-slate-600">Dosage guide by temperature</p>
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="border-b border-slate-200">
                                    <th className="pb-1 text-left font-medium text-slate-500">Temp band (°C)</th>
                                    <th className="pb-1 text-left font-medium text-slate-500">Dosage</th>
                                    <th className="pb-1 text-left font-medium text-slate-500">Exposure</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {selectedFumigationMethodology.dosageRanges.map((r) => (
                                    <tr
                                      key={r.id}
                                      className={cn(
                                        "border-b border-slate-100",
                                        matchedDosageRange?.id === r.id
                                          ? "bg-amber-100 ring-1 ring-inset ring-amber-300"
                                          : ""
                                      )}
                                    >
                                      <td className="py-0.5 pr-4">
                                        {r.minTempC}–{r.maxTempC}
                                      </td>
                                      <td className="py-0.5 pr-4">
                                        {r.dosageValue} {r.dosageUnit}
                                      </td>
                                      <td className="py-0.5">
                                        {r.exposureValue} {r.exposureUnit}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                              <p className="mt-1 text-xs italic text-slate-400">
                                Upper bound is exclusive — e.g. 25°C is in the 25–35 band.
                              </p>
                            </div>
                          )}
                      </div>
                    ) : null}

                    <FormRow className="mt-2" label="Fumigation type">
                      <div className="flex flex-wrap gap-2 pt-0.5">
                        {[
                          { v: "ambient", l: "Ambient temperature (forecast)" },
                          { v: "controlled", l: "Controlled temperature (heated enclosure)" },
                        ].map(({ v, l }) => (
                          <label key={v} className="flex items-center gap-1.5 text-sm cursor-pointer">
                            <input
                              type="radio"
                              name="packFumigationType"
                              checked={fd.fumigationType === v}
                              onChange={() => updateFumigationDetail({ fumigationType: v })}
                            />
                            {l}
                          </label>
                        ))}
                      </div>
                    </FormRow>

                    <div className={cn("mt-2", fumigationGridClass)}>
                      <FormRow label="Min forecast temperature (°C)">
                        <input
                          className={inputClass}
                          type="number"
                          step="0.5"
                          value={fd.minForecastedTemperature ?? ""}
                          onChange={(e) => updateFumigationDetail({ minForecastedTemperature: e.target.value })}
                        />
                      </FormRow>
                      <FormRow label="Actual start temperature (°C)">
                        <input
                          className={inputClass}
                          type="number"
                          step="0.5"
                          value={fd.actualTemperature ?? ""}
                          onChange={(e) => updateFumigationDetail({ actualTemperature: e.target.value })}
                        />
                      </FormRow>
                    </div>

                    <p className="mt-2 mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                      Prescribed treatment schedule
                    </p>
                    <div className={fumigationGridClass}>
                      <FormRow label="Dose rate (g/m³)">
                        <input
                          className={inputClass}
                          type="number"
                          step="0.01"
                          value={fd.prescribedDoseRate ?? ""}
                          onChange={(e) => updateFumigationDetail({ prescribedDoseRate: e.target.value })}
                        />
                      </FormRow>
                      <FormRow label="Exposure (hours)">
                        <input
                          className={inputClass}
                          type="number"
                          step="1"
                          value={fd.prescribedExposure ?? ""}
                          onChange={(e) => updateFumigationDetail({ prescribedExposure: e.target.value })}
                        />
                      </FormRow>
                      <FormRow label="Min temperature (°C)">
                        <input
                          className={inputClass}
                          type="number"
                          step="0.5"
                          value={fd.prescribedTemperature ?? ""}
                          onChange={(e) => updateFumigationDetail({ prescribedTemperature: e.target.value })}
                        />
                      </FormRow>
                    </div>

                    <p className="mt-2 mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                      Applied dose
                    </p>
                    <div className={fumigationGridClass}>
                      <FormRow label="Applied dose rate">
                        <div className="flex gap-2">
                          <input
                            className={inputClass}
                            type="number"
                            step="0.01"
                            value={fd.dosageValue ?? ""}
                            onChange={(e) => updateFumigationDetail({ dosageValue: e.target.value })}
                          />
                          <ClutchSelect
                            isClearable={false}
                            options={DOSAGE_UNIT_OPTIONS}
                            value={DOSAGE_UNIT_OPTIONS.find((o) => o.value === (fd.dosageUnit || "g/m3")) ?? null}
                            onChange={(option) => updateFumigationDetail({ dosageUnit: option ? option.value : "g/m3" })}
                            className="w-[5.5rem]"
                          />
                        </div>
                      </FormRow>
                      <FormRow label="Applied exposure">
                        <div className="flex gap-2">
                          <input
                            className={inputClass}
                            type="number"
                            step="1"
                            value={fd.exposureTimeValue ?? ""}
                            onChange={(e) => updateFumigationDetail({ exposureTimeValue: e.target.value })}
                          />
                          <ClutchSelect
                            isClearable={false}
                            options={EXPOSURE_UNIT_OPTIONS}
                            value={EXPOSURE_UNIT_OPTIONS.find((o) => o.value === (fd.exposureTimeUnit || "hours")) ?? null}
                            onChange={(option) => updateFumigationDetail({ exposureTimeUnit: option ? option.value : "hours" })}
                            className="w-[5.5rem]"
                          />
                        </div>
                      </FormRow>
                      <FormRow label="Application method">
                        <ClutchSelect
                          isClearable={false}
                          options={APPLICATION_METHOD_OPTIONS}
                          value={APPLICATION_METHOD_OPTIONS.find((o) => o.value === (fd.applicationMethod || "in-container")) ?? null}
                          onChange={(option) => updateFumigationDetail({ applicationMethod: option ? option.value : "in-container" })}
                        />
                      </FormRow>
                      <FormRow label="Calculated dose">
                        <div className="flex gap-2">
                          <input
                            className={inputClass}
                            type="number"
                            step="0.1"
                            value={fd.calculatedDosageValue ?? ""}
                            onChange={(e) => updateFumigationDetail({ calculatedDosageValue: e.target.value })}
                          />
                          <ClutchSelect
                            isClearable={false}
                            options={MASS_UNIT_OPTIONS}
                            value={MASS_UNIT_OPTIONS.find((o) => o.value === (fd.calculatedDosageUnit || "g")) ?? null}
                            onChange={(option) => updateFumigationDetail({ calculatedDosageUnit: option ? option.value : "g" })}
                            className="w-[4.5rem]"
                          />
                        </div>
                      </FormRow>
                      <FormRow label="Amount of fumigant applied">
                        <div className="flex gap-2">
                          <input
                            className={inputClass}
                            type="number"
                            step="0.1"
                            value={fd.actualDosageAppliedValue ?? ""}
                            onChange={(e) => updateFumigationDetail({ actualDosageAppliedValue: e.target.value })}
                          />
                          <ClutchSelect
                            isClearable={false}
                            options={MASS_UNIT_OPTIONS}
                            value={MASS_UNIT_OPTIONS.find((o) => o.value === (fd.actualDosageAppliedUnit || "g")) ?? null}
                            onChange={(option) => updateFumigationDetail({ actualDosageAppliedUnit: option ? option.value : "g" })}
                            className="w-[4.5rem]"
                          />
                        </div>
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
                    </div>

                    <p className="mt-2 mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                      Methyl bromide additives
                    </p>
                    <div className={fumigationGridClass}>
                      <FormRow label="Chloropicrin used?">
                        <div className="flex gap-4 pt-1">
                          {[
                            { v: true, l: "Yes" },
                            { v: false, l: "No" },
                          ].map(({ v, l }) => (
                            <label key={l} className="flex items-center gap-1.5 text-sm cursor-pointer">
                              <input
                                type="radio"
                                name="packChloropicrin"
                                checked={fd.chloropicrinUsed === v}
                                onChange={() => updateFumigationDetail({ chloropicrinUsed: v })}
                              />
                              {l}
                            </label>
                          ))}
                        </div>
                      </FormRow>
                      {fd.chloropicrinUsed === true && (
                        <FormRow label="Chloropicrin (%)">
                          <input
                            className={inputClass}
                            type="number"
                            step="0.1"
                            value={fd.chloropicrinPercent ?? ""}
                            onChange={(e) => updateFumigationDetail({ chloropicrinPercent: e.target.value })}
                          />
                        </FormRow>
                      )}
                      <FormRow label="Heaters used?">
                        <div className="flex gap-4 pt-1">
                          {[
                            { v: true, l: "Yes" },
                            { v: false, l: "No" },
                          ].map(({ v, l }) => (
                            <label key={l} className="flex items-center gap-1.5 text-sm cursor-pointer">
                              <input
                                type="radio"
                                name="packHeaters"
                                checked={fd.heatersUsed === v}
                                onChange={() => updateFumigationDetail({ heatersUsed: v })}
                              />
                              {l}
                            </label>
                          ))}
                        </div>
                      </FormRow>
                    </div>

                    <p className="mt-2 mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                      Sulfuryl fluoride — end-point &amp; CT
                    </p>
                    <div className={fumigationGridClass}>
                      <FormRow label="End-point concentration (g/m³)">
                        <input
                          className={inputClass}
                          type="number"
                          step="0.01"
                          value={fd.endPointConcentration ?? ""}
                          onChange={(e) => updateFumigationDetail({ endPointConcentration: e.target.value })}
                        />
                      </FormRow>
                      <FormRow label="CT required (g·h/m³)">
                        <input
                          className={inputClass}
                          type="number"
                          step="0.1"
                          value={fd.ctRequired ?? ""}
                          onChange={(e) => updateFumigationDetail({ ctRequired: e.target.value })}
                        />
                      </FormRow>
                      <FormRow label="CT achieved (g·h/m³)">
                        <input
                          className={inputClass}
                          type="number"
                          step="0.1"
                          value={fd.ctAchieved ?? ""}
                          onChange={(e) => updateFumigationDetail({ ctAchieved: e.target.value })}
                        />
                      </FormRow>
                      <FormRow label="Approved 3rd-party CT system?">
                        <label className="flex items-center gap-1.5 text-sm pt-1 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={Boolean(fd.thirdPartySystem)}
                            onChange={(e) => updateFumigationDetail({ thirdPartySystem: e.target.checked })}
                          />
                          Used
                        </label>
                      </FormRow>
                      {fd.thirdPartySystem && (
                        <FormRow className={spanFullClass} label="3rd-party system name">
                          <input
                            className={inputClass}
                            value={fd.thirdPartySystemName ?? ""}
                            onChange={(e) => updateFumigationDetail({ thirdPartySystemName: e.target.value })}
                          />
                        </FormRow>
                      )}
                    </div>

                    <FormRow className="mt-2" label="Free-text enclosure description (legacy / internal)">
                      <input
                        className={inputClass}
                        value={fd.enclosureDescription || ""}
                        onChange={(e) => updateFumigationDetail({ enclosureDescription: e.target.value })}
                        placeholder="Container, chamber, sheeted stack..."
                      />
                    </FormRow>
                  </div>

                  <div className={sectionColumnsClass}>
                    {/* ─── Section D — Concentration readings & ventilation ─── */}
                    <div className={fumigationInnerClass} aria-label="Section D — Concentration readings and ventilation">
                      <FormRow label="Monitoring device serial(s)">
                        <input
                          className={inputClass}
                          value={fd.monitoringDeviceSerials ?? ""}
                          onChange={(e) => updateFumigationDetail({ monitoringDeviceSerials: e.target.value })}
                          placeholder="Comma-separated serial numbers"
                        />
                      </FormRow>
                      <div className={cn("mt-2", fumigationGridClass)}>
                        <FormRow label="Fumigation commenced">
                          <input
                            className={inputClass}
                            type="datetime-local"
                            value={fd.fumigationStartAt ?? ""}
                            onChange={(e) => updateFumigationDetail({ fumigationStartAt: e.target.value })}
                          />
                        </FormRow>
                        <FormRow label="Fumigant injection finished">
                          <input
                            className={inputClass}
                            type="datetime-local"
                            value={fd.dosingFinishAt ?? ""}
                            onChange={(e) => updateFumigationDetail({ dosingFinishAt: e.target.value })}
                          />
                        </FormRow>
                        <FormRow label="Fumigation completed">
                          <input
                            className={inputClass}
                            type="datetime-local"
                            value={fd.fumigationEndAt ?? ""}
                            onChange={(e) => updateFumigationDetail({ fumigationEndAt: e.target.value })}
                          />
                        </FormRow>
                        <FormRow label="Enclosure ventilation start">
                          <input
                            className={inputClass}
                            type="datetime-local"
                            value={fd.ventilationStartAt ?? ""}
                            onChange={(e) => updateFumigationDetail({ ventilationStartAt: e.target.value })}
                          />
                        </FormRow>
                      </div>
                      <div className={cn("mt-2", fumigationGridClass)}>
                        <FormRow label="Final TLV reading 1 (ppm)">
                          <input
                            className={inputClass}
                            type="number"
                            step="0.1"
                            value={fd.finalTlvPpm1 ?? ""}
                            onChange={(e) => updateFumigationDetail({ finalTlvPpm1: e.target.value })}
                          />
                        </FormRow>
                        <FormRow label="Final TLV reading 2 (ppm)">
                          <input
                            className={inputClass}
                            type="number"
                            step="0.1"
                            value={fd.finalTlvPpm2 ?? ""}
                            onChange={(e) => updateFumigationDetail({ finalTlvPpm2: e.target.value })}
                          />
                        </FormRow>
                        <FormRow label="Final TLV reading 3 (ppm)">
                          <input
                            className={inputClass}
                            type="number"
                            step="0.1"
                            value={fd.finalTlvPpm3 ?? ""}
                            onChange={(e) => updateFumigationDetail({ finalTlvPpm3: e.target.value })}
                          />
                        </FormRow>
                      </div>

                      {/* Top-up entries */}
                      <div className="mt-2">
                        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                          Top-up details (if any)
                        </p>
                        {(fd.topUpEntries ?? []).map((entry) => (
                          <div key={entry.id} className="mb-2 flex items-center gap-2">
                            <input
                              className={`${inputClass} flex-1`}
                              placeholder="Amount (g/m³)"
                              value={entry.amountGm3 ?? ""}
                              onChange={(e) =>
                                updateFumigationDetail({
                                  topUpEntries: (fd.topUpEntries ?? []).map((row) =>
                                    row.id === entry.id ? { ...row, amountGm3: e.target.value } : row,
                                  ),
                                })
                              }
                            />
                            <input
                              className={`${inputClass} flex-1`}
                              placeholder="Time (hh:mm)"
                              value={entry.time ?? ""}
                              onChange={(e) =>
                                updateFumigationDetail({
                                  topUpEntries: (fd.topUpEntries ?? []).map((row) =>
                                    row.id === entry.id ? { ...row, time: e.target.value } : row,
                                  ),
                                })
                              }
                            />
                            <input
                              className={`${inputClass} flex-1`}
                              placeholder="Concentration (g/m³)"
                              value={entry.concentrationGm3 ?? ""}
                              onChange={(e) =>
                                updateFumigationDetail({
                                  topUpEntries: (fd.topUpEntries ?? []).map((row) =>
                                    row.id === entry.id ? { ...row, concentrationGm3: e.target.value } : row,
                                  ),
                                })
                              }
                            />
                            <button
                              type="button"
                              onClick={() =>
                                updateFumigationDetail({
                                  topUpEntries: (fd.topUpEntries ?? []).filter((row) => row.id !== entry.id),
                                })
                              }
                              className="text-slate-400 hover:text-red-500"
                              title="Remove top-up row"
                            >
                              <Trash2 className="size-4" />
                            </button>
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={() => {
                            const entries = fd.topUpEntries ?? [];
                            const newId = Math.max(0, ...entries.map((e) => Number(e.id) || 0)) + 1;
                            updateFumigationDetail({
                              topUpEntries: [
                                ...entries,
                                { id: newId, amountGm3: "", time: "", concentrationGm3: "" },
                              ],
                            });
                          }}
                          className="inline-flex items-center gap-1.5 text-xs font-medium text-brand hover:text-brand/80"
                        >
                          <Plus className="size-3" /> Add top-up row
                        </button>
                      </div>
                    </div>

                    {/* ─── Section E — Result & declaration ─── */}
                    <div className={fumigationInnerClass} aria-label="Section E — Result and declaration">
                      <div className={fumigationGridClass}>
                        <FormRow label="Fumigation result">
                          <ClutchSelect
                            placeholder="— select —"
                            options={FUMIGATION_RESULT_OPTIONS}
                            value={FUMIGATION_RESULT_OPTIONS.find((o) => o.value === (fd.fumigationResult ?? "")) ?? null}
                            onChange={(option) => updateFumigationDetail({ fumigationResult: option ? option.value : "" })}
                          />
                        </FormRow>
                        <FormRow label="Authorised officer (if supervised)">
                          {(() => {
                            const aoSelectOpts = aoOptions.map((u) => ({ value: u.name, label: u.name + (u.aoNumber ? ` (${u.aoNumber})` : "") }));
                            return (
                              <ClutchSelect
                                placeholder="- Select AO -"
                                options={aoSelectOpts}
                                value={aoSelectOpts.find((o) => o.value === (fd.governmentOfficerName ?? "")) ?? null}
                                onChange={(option) => updateFumigationDetail({ governmentOfficerName: option ? option.value : "" })}
                              />
                            );
                          })()}
                        </FormRow>
                        <FormRow className={spanFullClass} label="Additional declarations (free text)">
                          <textarea
                            className={inputClass}
                            rows={2}
                            value={fd.additionalDeclarations ?? ""}
                            onChange={(e) => updateFumigationDetail({ additionalDeclarations: e.target.value })}
                          />
                        </FormRow>
                        <FormRow className={spanFullClass} label="Internal notes">
                          <textarea
                            className={inputClass}
                            rows={2}
                            value={fd.fumigationNotes ?? ""}
                            onChange={(e) => updateFumigationDetail({ fumigationNotes: e.target.value })}
                          />
                        </FormRow>
                      </div>
                    </div>
                  </div>

                  {/* Template selectors — hidden in a collapsed details so they don't dominate the layout */}
                  <details className="rounded-md border border-slate-200 bg-white p-2.5 group">
                    <summary className="cursor-pointer text-[10px] font-semibold uppercase tracking-wider text-slate-500 group-open:mb-2">
                      Advanced — override default certificate / record template
                    </summary>
                    <div className={fumigationGridClass}>
                      <FormRow label="Certificate template">
                        {(() => {
                          const certTemplateOpts = certificateTemplates.map((item) => ({ value: item.id, label: item.name }));
                          return (
                            <ClutchSelect
                              placeholder="- Select -"
                              options={certTemplateOpts}
                              value={certTemplateOpts.find((o) => o.value === (pack.certificateTemplateId ?? null)) ?? null}
                              onChange={(option) => set("certificateTemplateId", option ? option.value : null)}
                            />
                          );
                        })()}
                      </FormRow>
                      <FormRow label="Record template">
                        {(() => {
                          const recTemplateOpts = recordTemplates.map((item) => ({ value: item.id, label: item.name }));
                          return (
                            <ClutchSelect
                              placeholder="- Select -"
                              options={recTemplateOpts}
                              value={recTemplateOpts.find((o) => o.value === (pack.recordTemplateId ?? null)) ?? null}
                              onChange={(option) => set("recordTemplateId", option ? option.value : null)}
                            />
                          );
                        })()}
                      </FormRow>
                    </div>
                  </details>
                </div>

                {/* Generate documents — only when pack is saved and all fumigation fields are set */}
                {editingRow?.id != null && (
                  <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-2">
                    <button
                      type="button"
                      disabled={!pack.fumigationRequired || !pack.fumigantId || !pack.methodologyId}
                      onClick={() => router.push(`/fumigation/certificates/${editingRow.id}`)}
                      title={
                        !pack.fumigantId || !pack.methodologyId
                          ? "Select a fumigant and methodology first"
                          : "Generate Certificate of Fumigation"
                      }
                      className={cn(
                        "rounded-lg px-4 py-2 text-sm font-medium transition-colors",
                        pack.fumigationRequired && pack.fumigantId && pack.methodologyId
                          ? "bg-brand text-white hover:bg-brand/90"
                          : "cursor-not-allowed bg-slate-100 text-slate-400"
                      )}
                    >
                      Generate Certificate
                    </button>
                    <button
                      type="button"
                      disabled={!pack.fumigationRequired || !pack.fumigantId || !pack.methodologyId}
                      onClick={() => router.push(`/fumigation/records/${editingRow.id}`)}
                      title={
                        !pack.fumigantId || !pack.methodologyId
                          ? "Select a fumigant and methodology first"
                          : "Generate Record of Fumigation"
                      }
                      className={cn(
                        "rounded-lg px-4 py-2 text-sm font-medium transition-colors",
                        pack.fumigationRequired && pack.fumigantId && pack.methodologyId
                          ? "bg-slate-700 text-white hover:bg-slate-600"
                          : "cursor-not-allowed bg-slate-100 text-slate-400"
                      )}
                    >
                      Generate Record
                    </button>
                  </div>
                )}
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
                    packerSelectOptions={packerSelectOptions}
                    yesNoOptions={YES_NO_STRINGS}
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
                    packReleases={Array.isArray(pack.releaseDetails) ? pack.releaseDetails : []}
                    containerParkOptions={containerParkOptions}
                    transporterOptions={transporterOptions}
                    ecInspectionRemarks={pemsInspectionRemarks.ecInspectionRemarks}
                    goodsInspectionRemarks={pemsInspectionRemarks.goodsInspectionRemarks}
                    onResetContainer={selectedEditContainerActions?.onResetContainer}
                    onMarkPacked={selectedEditContainerActions?.onMarkPacked}
                    onSubmitPra={selectedEditContainerActions?.onSubmitPra}
                  />

                  {pack.commodityTypeId ? (
                    <div className="mt-3 rounded-lg border border-slate-200/90 bg-slate-50/30">
                      <div className="border-b border-slate-200 bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-800">
                        Test results
                      </div>
                      <div className="p-3">
                        <TestResultsSection
                          commodityTypeId={pack.commodityTypeId}
                          commodities={commodityOptions}
                          allowedCommodityIds={allowedCommodityIds}
                          testsCatalog={testsCatalog}
                          surface="Outgoing Containers"
                          testValues={selectedEditContainer.tests ?? {}}
                          onChange={(name, value) =>
                            updatePackContainer(selectedEditContainer.id, {
                              tests: { ...(selectedEditContainer.tests ?? {}), [name]: value },
                            })
                          }
                          inputClass={inputClass}
                          emptyMessage="No tests are configured for this commodity."
                        />
                      </div>
                    </div>
                  ) : null}

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
            <div className="flex shrink-0 flex-col items-end gap-1.5 border-t border-slate-100 pt-2 sm:border-t-0 sm:pt-0">
              {saveError ? <p className="text-[11px] text-red-600">{saveError}</p> : null}
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" type="button" onClick={() => router.push("/packing-schedule")}>
                  Cancel
                </Button>
                <Button size="sm" type="button" onClick={save}>
                  {mode === "edit" ? "Save changes" : "Create pack"}
                </Button>
              </div>
            </div>
          </div>
        </footer>

        <ReleaseModal
          open={quickReleaseOpen}
          mode={quickReleaseMode}
          draft={quickReleaseDraft}
          error={quickReleaseError}
          saving={quickReleaseSaving}
          lookups={quickReleaseLookups}
          assignedContainerCount={countForReleaseRef(quickReleaseDraft.releaseNumber)}
          canDetach={quickReleaseMode === "edit" && quickReleaseTargetIndex != null}
          onDetach={() => detachReleaseLine(quickReleaseTargetIndex)}
          onClose={closeQuickAddRelease}
          onSave={saveQuickAddRelease}
          onChangeField={setQuickReleaseField}
          onUpdatePark={updateQuickReleasePark}
          onAddPark={addQuickReleasePark}
          onRemovePark={removeQuickReleasePark}
          onToggleTransporter={toggleQuickReleaseTransporter}
          bulkContainers={packContainers}
          containerParkOptions={containerParkOptions}
          transporterOptions={transporterOptions}
          onBulkApply={applyBulkContainerImport}
          bulkApplying={bulkImportSaving}
          bulkProgress={bulkImportSaving ? "Saving imported containers…" : ""}
        />

        <QuickAddVesselModal
          open={quickVesselOpen}
          onClose={() => setQuickVesselOpen(false)}
          onCreated={handleQuickVesselCreated}
          shippingLineOptions={shippingLineOptions}
          terminalOptions={terminalOptions}
          portOptions={portOptions}
        />

        {bulkImportError ? (
          <div className="fixed bottom-4 right-4 z-[70] max-w-md rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 shadow-lg">
            {bulkImportError}
            <button
              type="button"
              className="ms-3 font-semibold text-red-900 hover:underline"
              onClick={() => setBulkImportError("")}
            >
              Dismiss
            </button>
          </div>
        ) : null}
      </>
      );
}

function ReleaseModal({
  open,
  mode = "add",
  draft,
  error,
  saving = false,
  lookups,
  assignedContainerCount = 0,
  canDetach = false,
  onDetach,
  onClose,
  onSave,
  onChangeField,
  onUpdatePark,
  onAddPark,
  onRemovePark,
  onToggleTransporter,
  bulkContainers = [],
  containerParkOptions: bulkContainerParkOptions = [],
  transporterOptions: bulkTransporterOptions = [],
  onBulkApply,
  bulkApplying = false,
  bulkProgress = "",
}) {
  if (!open) return null;
  const isEdit = mode === "edit";
  const parks = Array.isArray(draft?.parks) && draft.parks.length
    ? draft.parks
    : [{ containerParkId: "", transporterIds: [] }];
  const fieldLabel = "text-[11px] font-semibold uppercase tracking-wide text-slate-600";
  const lookupsLoading = lookups?.loading;
  const containerParkOptions = lookups?.containerParks || [];
  const transporterOptions = lookups?.transporters || [];
  const containerCodeOptions = lookups?.containerCodes || [];
  const releaseRef = String(draft?.releaseNumber || "").trim();
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button type="button" className="absolute inset-0 bg-black/40" aria-label="Close dialog" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="release-modal-title"
        className="relative max-h-[min(92vh,820px)] w-full max-w-3xl overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-4 py-3">
          <h2 id="release-modal-title" className="text-sm font-semibold text-slate-900">
            {isEdit ? `Edit release${releaseRef ? ` · ${releaseRef}` : ""}` : "Add release"}
          </h2>
          <button
            type="button"
            className="rounded-md px-2 py-1 text-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            onClick={onClose}
          >
            x
          </button>
        </div>
        <div className="p-4">
          {error ? (
            <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-600">{error}</div>
          ) : null}
          {isEdit ? (
            <div className="mb-4 flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
              <span className="rounded-full bg-brand/10 px-2 py-0.5 font-semibold tabular-nums text-brand-ink">
                {assignedContainerCount}
              </span>
              container{assignedContainerCount === 1 ? "" : "s"} on this release for this pack.
            </div>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label className={fieldLabel}>Release Number <span className="text-red-500">*</span></label>
              <input
                className={inputClass}
                value={draft.releaseNumber}
                onChange={(e) => onChangeField("releaseNumber", e.target.value)}
                placeholder="e.g. REL-2026-001"
              />
            </div>
            <div className="space-y-1">
              <label className={fieldLabel}>Release Status</label>
              <ClutchSelect
                isClearable={false}
                options={RELEASE_STATUS_SELECT_OPTIONS}
                value={RELEASE_STATUS_SELECT_OPTIONS.find((o) => o.value === draft.status) ?? null}
                onChange={(option) => onChangeField("status", option ? option.value : "")}
              />
            </div>
            <div className="space-y-1">
              <label className={fieldLabel}>Release Available</label>
              <input
                type="datetime-local"
                className={inputClass}
                value={draft.releaseAvailableAt}
                onChange={(e) => onChangeField("releaseAvailableAt", e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className={fieldLabel}>Number of Free Days</label>
              <input
                type="number"
                min="0"
                className={inputClass}
                value={draft.freeDays}
                onChange={(e) => onChangeField("freeDays", e.target.value)}
                placeholder="e.g. 7"
              />
            </div>
            <div className="space-y-1">
              <label className={fieldLabel}>Release Expiry (computed)</label>
              <input
                type="datetime-local"
                className={`${inputClass} bg-slate-50`}
                value={draft.releaseExpiryAt}
                readOnly
                placeholder=""
              />
            </div>
            <div className="space-y-1">
              <label className={fieldLabel}>Pickup By</label>
              <input
                type="datetime-local"
                className={inputClass}
                value={draft.pickupBy}
                onChange={(e) => onChangeField("pickupBy", e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className={fieldLabel}>Number of Containers</label>
              <input
                type="number"
                min="0"
                className={inputClass}
                value={draft.containerCount}
                onChange={(e) => onChangeField("containerCount", e.target.value)}
                placeholder="e.g. 4"
              />
            </div>
            <div className="space-y-1">
              <label className={fieldLabel}>Container Type</label>
              {(() => {
                const containerTypeOpts = containerCodeOptions.map((row) => {
                  const iso = row.iso_code ?? row.isoCode ?? "";
                  const size = row.container_size ?? row.containerSize ?? "";
                  const desc = row.description ?? "";
                  return { value: iso, label: [iso, size, desc].filter(Boolean).join(" · ") };
                });
                return (
                  <ClutchSelect
                    placeholder={lookupsLoading ? "Loading…" : "Select container type..."}
                    options={containerTypeOpts}
                    value={containerTypeOpts.find((o) => o.value === draft.containerCodeIsoCode) ?? null}
                    onChange={(option) => onChangeField("containerCodeIsoCode", option ? option.value : "")}
                  />
                );
              })()}
            </div>
          </div>

          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50/40 p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className={fieldLabel}>Empty Container Park(s) and Transporter(s)</p>
              <Button type="button" size="sm" variant="outline" onClick={onAddPark}>
                + Add park
              </Button>
            </div>
            <div className="space-y-2">
              {parks.map((park, index) => (
                <div key={`qr-park-${index}`} className="rounded-md border border-slate-200 bg-white p-2.5">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-slate-600">Park {index + 1}</p>
                    {parks.length > 1 ? (
                      <button
                        type="button"
                        className="rounded bg-rose-50 px-1.5 py-0.5 text-xs text-rose-600 hover:bg-rose-100"
                        onClick={() => onRemovePark(index)}
                      >
                        Remove
                      </button>
                    ) : null}
                  </div>
                  <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
                    {(() => {
                      const parkOpts = containerParkOptions.map((cp) => ({ value: String(cp.id), label: cp.name }));
                      return (
                        <ClutchSelect
                          placeholder={lookupsLoading ? "Loading…" : "Select empty container park..."}
                          options={parkOpts}
                          value={parkOpts.find((o) => o.value === (park.containerParkId === "" ? "" : String(park.containerParkId))) ?? null}
                          onChange={(option) => onUpdatePark(index, "containerParkId", option ? option.value : "")}
                        />
                      );
                    })()}
                    <div className="rounded-md border border-slate-200 bg-white p-2">
                      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                        Transporters
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {transporterOptions.length === 0 ? (
                          <p className="text-[11px] text-slate-400">
                            {lookupsLoading ? "Loading transporters…" : "No transporters available."}
                          </p>
                        ) : null}
                        {transporterOptions.map((t) => {
                          const checked = (park.transporterIds || []).some(
                            (id) => String(id) === String(t.id),
                          );
                          return (
                            <label
                              key={t.id}
                              className={cn(
                                "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium",
                                checked
                                  ? "border-brand bg-brand/10 text-brand-ink"
                                  : "border-slate-200 bg-slate-50 text-slate-600",
                              )}
                            >
                              <input
                                type="checkbox"
                                className="h-3 w-3"
                                checked={checked}
                                onChange={() => onToggleTransporter(index, t.id)}
                              />
                              {t.name}
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <p className="mt-3 text-[10px] text-slate-500">
            {isEdit
              ? "Saving updates this Release record in Reference Data and refreshes the release reference + first park/transporter on this pack."
              : "Saving creates a Release record in Reference Data and adds the release reference + first park/transporter to this pack."}
          </p>

          <div className="mt-5 border-t border-slate-200 pt-4">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
              Bulk import containers
            </p>
            <BulkContainerImportPanel
              release={{ releaseRef, parks }}
              containers={bulkContainers}
              containerNumberField="containerNumber"
              containerParkOptions={bulkContainerParkOptions}
              transporterOptions={bulkTransporterOptions}
              onApply={onBulkApply}
              isApplying={bulkApplying}
              applyProgress={bulkProgress}
              disabled={!isEdit || !releaseRef}
              disabledReason={
                !releaseRef
                  ? "Enter a release number first."
                  : "Save the release first, then import containers for it."
              }
            />
          </div>

          <div className="mt-5 flex items-center justify-between gap-2 border-t border-slate-200 pt-4">
            <div>
              {isEdit && canDetach ? (
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  disabled={saving}
                  onClick={onDetach}
                  title="Remove this release from the pack (the Release record is kept)"
                >
                  <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                  Remove from pack
                </Button>
              ) : null}
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="ghost" size="sm" disabled={saving} onClick={onClose}>
                Cancel
              </Button>
              <Button type="button" size="sm" disabled={saving} onClick={onSave}>
                {saving ? "Saving…" : isEdit ? "Save changes" : "Create & attach"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
