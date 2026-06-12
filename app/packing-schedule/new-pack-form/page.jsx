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
import PemsInspectionPanel from "@/components/pems/pems-inspection-panel";
import { savePack } from "@/lib/pack-schedule-store";
import { packAssignedPackerOptions } from "@/lib/api/packing";
import { getApplicablePackTests, mergePackTests } from "@/lib/pack-tests";
import { useAllPackLookups } from "@/lib/hooks/use-pack-form-data";
import { useInvalidateReferenceData } from "@/lib/hooks/use-reference-data-queries";
import {
  RELEASE_STATUSES,
  blankRelease,
  computeReleaseExpiry,
} from "@/lib/releases-store";
import { saveRelease } from "@/lib/releases-api";
import { resolvePackRfpRef } from "@/lib/pems-rfp-display";
import { attachPemsSubmissionSnapshot, downloadPemsSubmissionPdf } from "@/lib/pems-staging-snapshot";
import PemsSubmissionPreviewModal from "@/components/pems/pems-submission-preview-modal";
import {
  CONTAINER_INSPECTION_REMARK_FIELD,
  containerInspectionRemarkPatch,
  getContainerInspectionRemark,
} from "@/lib/pems-container-fields";
import { normalizePackAttachmentFiles } from "@/lib/pack-attachments";
import { readSiteRows } from "@/lib/site-data";
import { Plus, Trash2 } from "lucide-react";

import { cn } from "@/lib/utils";

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
  packTests: [],
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
    containersRequired: (row.containers_required ?? row.containersRequired) ?? "",
    mtTotal: (row.mt_total ?? row.mtTotal) ?? "",
    containerCode: (typeof row.container_code === "object" ? row.container_code?.iso_code : row.container_code) ?? row.containerCode ?? "",
    containerCodeId: row.container_code?.id ?? row.container_code_id ?? row.containerCodeId ?? "",
    packType: (row.pack_type ?? row.packType) || "container",
    testRequired: Boolean(row.test_required ?? row.testRequired),
    shrinkTaken: Boolean(row.shrink_taken ?? row.shrinkTaken),
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
    packTests: Array.isArray(row.pack_tests ?? row.packTests)
      ? (row.pack_tests ?? row.packTests).map((t) => ({
          id: t.id ?? null,
          testId: t.test_id ?? t.testId ?? null,
          testName: t.test_name ?? t.testName ?? "",
          testType: t.test_type ?? t.testType ?? "Percentage",
          unit: t.unit ?? "",
          thresholdMin: t.threshold_min ?? t.thresholdMin ?? null,
          thresholdMax: t.threshold_max ?? t.thresholdMax ?? null,
          value: t.value ?? "",
          findings: Array.isArray(t.findings) ? t.findings : [],
          status: t.status ?? "pending",
          notes: t.notes ?? "",
        }))
      : [],
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
      (Array.isArray(row.files) ? row.files.filter((f) => f.category === "packingInstruction") : null)
    ),
    pemsDraft: { ...defaultPemsDraft(), ...((row.pems_draft ?? row.pemsDraft) || {}) },
    pemsSubmissions: Array.isArray(row.pems_submissions ?? row.pemsSubmissions) ? (row.pems_submissions ?? row.pemsSubmissions) : [],
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
    },
    importPermitFiles: normalizeFileItems(pack.importPermitFiles),
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
    pack_tests: Array.isArray(pack.packTests)
      ? pack.packTests.map((t) => ({
          test_id: t.testId ?? null,
          test_name: t.testName,
          test_type: t.testType ?? "Percentage",
          unit: t.unit ?? "",
          threshold_min: t.thresholdMin ?? null,
          threshold_max: t.thresholdMax ?? null,
          value: t.value ?? "",
          findings: t.findings ?? null,
          status: t.status ?? "pending",
          notes: t.notes ?? "",
        }))
      : [],
    pemsDraft: { ...defaultPemsDraft(), ...(pack.pemsDraft || {}) },
    pemsSubmissions: Array.isArray(pack.pemsSubmissions) ? pack.pemsSubmissions : [],
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
  const [testsCatalog, setTestsCatalog] = useState([]);
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
  const selectedCommodity = useMemo(
    () => commodityOptions.find((c) => String(c.id) === String(pack.commodityId)) ?? null,
    [commodityOptions, pack.commodityId]
  );
  const applicablePackTests = useMemo(
    () => getApplicablePackTests(selectedCommodity, testsCatalog),
    [selectedCommodity, testsCatalog]
  );
  const showPackTestsSection = applicablePackTests.length > 0 || pack.testRequired || (pack.packTests || []).length > 0;
  const [editingRow, setEditingRow] = useState(null);
  const [activeTab, setActiveTab] = useState(() =>
    ["general", "fumigation", "accounting", "pems"].includes(requestedTab || "") ? requestedTab : "general"
  );
  const [editingContainerId, setEditingContainerId] = useState(null);
  const [pemsSubmitError, setPemsSubmitError] = useState("");
  const [isSubmittingPems, setIsSubmittingPems] = useState(false);
  const [pemsContainerSearch, setPemsContainerSearch] = useState("");
  const [previewPemsSubmission, setPreviewPemsSubmission] = useState(null);
  const [downloadingPemsBatchId, setDownloadingPemsBatchId] = useState("");
  const [activeSampleIndex, setActiveSampleIndex] = useState(0);
  const prevSampleCountRef = useRef(0);

  const [saveError, setSaveError] = useState("");
  const [quickReleaseOpen, setQuickReleaseOpen] = useState(false);
  const [quickReleaseDraft, setQuickReleaseDraft] = useState(() => blankRelease());
  const [quickReleaseError, setQuickReleaseError] = useState("");
  const [quickReleaseSaving, setQuickReleaseSaving] = useState(false);
  const [quickReleaseTargetIndex, setQuickReleaseTargetIndex] = useState(null);

  const set = (key, val) => setPack((prev) => ({ ...prev, [key]: val }));

  function openQuickAddRelease(targetIndex = null) {
    setQuickReleaseError("");
    setQuickReleaseTargetIndex(targetIndex);
    setQuickReleaseDraft(blankRelease());
    setQuickReleaseOpen(true);
  }

  function closeQuickAddRelease() {
    setQuickReleaseOpen(false);
    setQuickReleaseError("");
    setQuickReleaseTargetIndex(null);
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
    setPack((prev) => ({
      ...prev,
      vesselDepartureId: option.id,
      vesselName: vesselDisplayName(option),
      voyageNumber: option.voyage_number ?? prev.voyageNumber,
      lloydId: option.vessel?.lloyds_number ?? prev.lloydId,
      vesselCutoffDate: toDateInputValue(option.vessel_cutoff_date) || prev.vesselCutoffDate,
      etd: toDateInputValue(option.vessel_etd) || prev.etd,
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

  async function handleDownloadPemsSubmission(submission) {
    const batchId = submission?.batchId;
    if (!batchId || downloadingPemsBatchId) return;
    setDownloadingPemsBatchId(batchId);
    try {
      await downloadPemsSubmissionPdf(submission);
    } finally {
      setDownloadingPemsBatchId("");
    }
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
    let cancelled = false;
    const base = (process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api").replace(/\/+$/, "");
    const token = typeof window !== "undefined" ? localStorage.getItem("authToken") : null;
    fetch(`${base}/product-settings/tests?per_page=500`, {
      headers: {
        Accept: "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    })
      .then((res) => res.json())
      .then((result) => {
        if (cancelled) return;
        const rows = Array.isArray(result?.data?.data)
          ? result.data.data
          : Array.isArray(result?.data)
            ? result.data
            : [];
        setTestsCatalog(rows);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

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
      const nextVoyage = selectedVessel.voyage_number ?? selectedVessel.voyageNumber ?? "";
      const nextCutoff = toDateInputValue(selectedVessel.vessel_cutoff_date ?? selectedVessel.vesselCutoffDate);
      const nextEtd = toDateInputValue(selectedVessel.vessel_etd ?? selectedVessel.vesselEtd ?? selectedVessel.etd);
      const nextVesselName = vesselDisplayName(selectedVessel);
      const nextLloyd = selectedVessel.vessel?.lloyds_number ?? selectedVessel.vessel?.lloydsNumber ?? prev.lloydId;
      const nextCutoffValue = nextCutoff || prev.vesselCutoffDate;
      const nextEtdValue = nextEtd || prev.etd;
      if (
        prev.voyageNumber === nextVoyage &&
        prev.vesselCutoffDate === nextCutoffValue &&
        prev.vesselName === nextVesselName &&
        prev.etd === nextEtdValue &&
        prev.lloydId === nextLloyd
      ) {
        return prev;
      }
      return {
        ...prev,
        vesselName: nextVesselName,
        voyageNumber: nextVoyage,
        lloydId: nextLloyd,
        vesselCutoffDate: nextCutoffValue,
        etd: nextEtdValue,
      };
    });
  }, [selectedVessel]);

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
    ] = await Promise.all([
      resolveFileItemsForSave(pack.importPermitFiles),
      resolveFileItemsForSave(pack.additionalDeclarationFiles),
      resolveFileItemsForSave(pack.rfpFiles),
      resolveFileItemsForSave(pack.packingInstructionFiles),
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
              ? `Edit Pack${pack.jobReference ? ` — ${pack.jobReference}` : editingRow?.jobReference ? ` — ${editingRow.jobReference}` : ""}`
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
                      <select className={inputClass} value={pack.packType} onChange={(e) => set("packType", e.target.value)}>
                        <option value="container">Container</option>
                        <option value="bulk">Bulk</option>
                      </select>
                    </FormRow>
                    <FormRow label="Pack confirmed">
                      <select className={inputClass} value={pack.packConfirmed ? "yes" : "no"} onChange={(e) => set("packConfirmed", e.target.value === "yes")}>
                        <option value="no">No</option>
                        <option value="yes">Yes</option>
                      </select>
                    </FormRow>
                  </div>
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

              <section className={flushSectionClass} aria-label="Site and import">
                <div className={cn(flushSectionBodyClass, sectionStackClass)}>
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
                              <select
                                className={inputClass}
                                value={entry.type}
                                aria-label="Sample type"
                                onChange={(e) => {
                                  const next = [...sampleEntries];
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
                              <select
                                className={inputClass}
                                value={entry.status}
                                aria-label="Sample status"
                                onChange={(e) => {
                                  const next = [...sampleEntries];
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

              {showPackTestsSection ? (
                <section className={flushSectionClass} aria-label="Pack tests">
                  <div className={cn(flushSectionBodyClass, sectionStackClass)}>
                    <FormRow label="Tests on pack">
                      <p className="text-xs text-slate-500">
                        Tests are created on the pack from commodity thresholds. Results can be updated on the Ticketing pack tests page.
                      </p>
                    </FormRow>
                    {(pack.packTests || []).length === 0 ? (
                      <p className="text-xs text-slate-400">No tests apply for the selected commodity.</p>
                    ) : (
                      <div className="space-y-1.5">
                        {(pack.packTests || []).map((test, index) => (
                          <div key={test.testName || index} className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-semibold text-slate-900">{test.testName}</span>
                              <span className="text-slate-500">{test.testType}{test.unit ? ` · ${test.unit}` : ""}</span>
                              {(test.thresholdMin != null && test.thresholdMin !== "") || (test.thresholdMax != null && test.thresholdMax !== "") ? (
                                <span className="text-slate-500">
                                  Threshold
                                  {test.thresholdMin != null && test.thresholdMin !== "" ? ` min ${test.thresholdMin}` : ""}
                                  {test.thresholdMax != null && test.thresholdMax !== "" ? ` max ${test.thresholdMax}` : ""}
                                </span>
                              ) : null}
                            </div>
                            <input
                              className={cn(inputClass, "mt-1.5 !h-9 text-xs")}
                              value={test.notes || ""}
                              onChange={(e) => {
                                const next = [...(pack.packTests || [])];
                                next[index] = { ...next[index], notes: e.target.value };
                                set("packTests", next);
                              }}
                              placeholder="Schedule notes (optional)"
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </section>
              ) : null}
            </div>

            <section className={sectionClass} aria-label="Basic details">
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
                      const nextApplicable = row ? getApplicablePackTests(row, testsCatalog) : [];
                      setPack((prev) => ({
                        ...prev,
                        commodityId: id,
                        commodityTypeId: (row?.commodity_type_id ?? row?.commodityTypeId) != null ? String(row.commodity_type_id ?? row.commodityTypeId) : "",
                        packTests: nextApplicable.length ? mergePackTests(prev.packTests, nextApplicable) : [],
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
                      <select
                        className={inputClass}
                        value={pack.fumigationRequired ? "yes" : "no"}
                        onChange={(e) => {
                          const enabled = e.target.value === "yes";
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
                              fumigantId: matched ? matched.id : prev.fumigantId,
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
                      <select className={inputClass} value={pack.containerCode || ""} onChange={(e) => {
                          const iso = e.target.value;
                          const matched = containerCodeOptions.find((r) => (r.iso_code ?? r.isoCode ?? "") === iso);
                          setPack((prev) => ({ ...prev, containerCode: iso, containerCodeId: matched?.id ?? "" }));
                        }}>
                        <option value="">- Select container code -</option>
                        {containerCodeOptions.map((row) => {
                          const iso = row.iso_code ?? row.isoCode ?? "";
                          const size = row.container_size ?? row.containerSize ?? "";
                          const desc = row.description ?? "";
                          return (
                            <option key={row.id ?? iso} value={iso}>
                              {iso}
                              {size ? ` · ${size}` : ""}
                              {desc ? ` — ${desc}` : ""}
                            </option>
                          );
                        })}
                      </select>
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
                        <select
                          className={inputClass}
                          value={entry.releaseRef || ""}
                          onChange={(e) => {
                            const num = e.target.value;
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
                        >
                          <option value="">- Select release -</option>
                          {!isKnownRelease && entry.releaseRef ? (
                            <option value={entry.releaseRef}>{entry.releaseRef}</option>
                          ) : null}
                          {releaseOptions.map((r) => (
                            <option key={r.id} value={r.releaseNumber}>
                              {r.releaseNumber}
                              {r.status ? ` (${r.status})` : ""}
                            </option>
                          ))}
                        </select>
                        <select
                          className={inputClass}
                          value={entry.emptyContainerParkId ?? ""}
                          onChange={(e) => {
                            const next = baseRows.map((row, idx) => (idx === index ? { ...row, emptyContainerParkId: e.target.value || "" } : row));
                            set("releaseDetails", next);
                          }}
                        >
                          <option value="">Empty Container Park</option>
                          {containerParkOptions.map((park) => (
                            <option key={park.id} value={park.id}>
                              {park.name}
                            </option>
                          ))}
                        </select>
                        <select
                          className={inputClass}
                          value={entry.transporterId ?? ""}
                          onChange={(e) => {
                            const next = baseRows.map((row, idx) => (idx === index ? { ...row, transporterId: e.target.value || "" } : row));
                            set("releaseDetails", next);
                          }}
                        >
                          <option value="">Select Transporter</option>
                          {transporterOptions.map((transporter) => (
                            <option key={transporter.id} value={transporter.id}>
                              {transporter.name}
                            </option>
                          ))}
                        </select>
                        <Button
                          variant="destructive"
                          type="button"
                          onClick={() => {
                            const next = baseRows.filter((_, idx) => idx !== index);
                            set("releaseDetails", next);
                          }}
                        >
                          Remove
                        </Button>
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

              <section className={flushSectionClass} aria-label="Destination and shipping">
                <div className={cn(flushSectionBodyClass, "gap-1")}>
                  <div className={shippingGridClass}>
                    <FormRow label="Destination country">
                      <select
                        className={inputClass}
                        value={pack.destinationCountry}
                        onChange={(e) =>
                          setPack((prev) => ({
                            ...prev,
                            destinationCountry: e.target.value,
                            destinationPort: "",
                          }))
                        }
                      >
                        <option value="">- Select country -</option>
                        {countryOptions.map((country) => (
                          <option key={country.id} value={country.name}>
                            {country.name}
                          </option>
                        ))}
                      </select>
                    </FormRow>
                    <FormRow label="Destination port">
                      <select className={inputClass} value={pack.destinationPort || ""} onChange={(e) => set("destinationPort", e.target.value)}>
                        <option value="">{pack.destinationCountry ? "- Select port -" : "- Select country first -"}</option>
                        {pack.destinationPort && !destinationPortOptions.some((p) => p.name === pack.destinationPort) ? (
                          <option value={pack.destinationPort}>{pack.destinationPort}</option>
                        ) : null}
                        {destinationPortOptions.map((port) => (
                          <option key={port.id} value={port.name}>
                            {port.name}
                            {port.code ? ` (${port.code})` : ""}
                          </option>
                        ))}
                      </select>
                    </FormRow>
                    <FormRow label="Shipping line">
                      <select className={inputClass} value={pack.shippingLineId} onChange={(e) => set("shippingLineId", e.target.value)}>
                        <option value="">- Select -</option>
                        {shippingLineOptions.map((l) => (
                          <option key={l.id} value={l.id}>
                            {l.name} ({l.code})
                          </option>
                        ))}
                      </select>
                    </FormRow>
                    <FormRow label="Terminal (port of loading)">
                      <select
                        className={inputClass}
                        value={pack.terminalId ?? ""}
                        onChange={(e) => {
                          const terminalId = e.target.value || "";
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
                      >
                        <option value="">- Select -</option>
                        {terminalOptions.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.terminal_name ?? t.terminalName ?? t.name} {(t.terminal_code ?? t.terminalCode) ? `(${t.terminal_code ?? t.terminalCode})` : ""}
                          </option>
                        ))}
                      </select>
                    </FormRow>
                    <FormRow label="Transshipment port">
                      <select
                        className={inputClass}
                        value={pack.transshipmentPort || ""}
                        onChange={(e) => {
                          const name = e.target.value;
                          const matched = portOptions.find((p) => p.name === name);
                          setPack((prev) => ({
                            ...prev,
                            transshipmentPort: name,
                            transshipmentPortCode: matched?.code ?? prev.transshipmentPortCode,
                          }));
                        }}
                      >
                        <option value="">- Select port -</option>
                        {pack.transshipmentPort && !portOptions.some((p) => p.name === pack.transshipmentPort) ? (
                          <option value={pack.transshipmentPort}>{pack.transshipmentPort}</option>
                        ) : null}
                        {portOptions.map((port) => (
                          <option key={port.id} value={port.name}>
                            {port.name}
                            {port.code ? ` (${port.code})` : ""}
                          </option>
                        ))}
                      </select>
                    </FormRow>
                    <FormRow label="Transshipment port code">
                      <input className={inputClass} value={pack.transshipmentPortCode} onChange={(e) => set("transshipmentPortCode", e.target.value)} placeholder="Code" />
                    </FormRow>
                    <FormRow label="Vessel departure">
                      <div className="flex items-center gap-1.5">
                        <select
                          className={inputClass}
                          value={pack.vesselDepartureId ?? ""}
                          onChange={(e) => {
                            const nextId = e.target.value || null;
                            const voyage = nextId ? vesselVoyageOptions.find((vd) => String(vd.id) === nextId) : null;
                            setPack((prev) => ({
                              ...prev,
                              vesselDepartureId: nextId,
                              vesselName: vesselDisplayName(voyage),
                              voyageNumber: voyage?.voyage_number ?? voyage?.voyageNumber ?? prev.voyageNumber,
                              lloydId: voyage?.vessel?.lloyds_number ?? voyage?.vessel?.lloydsNumber ?? prev.lloydId,
                              vesselCutoffDate: toDateInputValue(voyage?.vessel_cutoff_date ?? voyage?.vesselCutoffDate) || prev.vesselCutoffDate,
                              etd: toDateInputValue(voyage?.vessel_etd ?? voyage?.vesselEtd ?? voyage?.etd) || prev.etd,
                            }));
                          }}
                        >
                          <option value="">- Select vessel -</option>
                          {vesselVoyageOptions.map((vd) => {
                            const name = vesselDisplayName(vd);
                            const voyageNo = vd.voyage_number ?? vd.voyageNumber ?? "";
                            const cutoff = vd.vessel_cutoff_date ?? vd.vesselCutoffDate ?? "";
                            return (
                              <option key={vd.id} value={vd.id}>
                                {name}
                                {voyageNo ? ` (${voyageNo})` : ""}
                                {cutoff ? ` - Cut-off ${formatDateDisplay(cutoff)}` : ""}
                              </option>
                            );
                          })}
                        </select>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="shrink-0 whitespace-nowrap"
                          onClick={() => setQuickVesselOpen(true)}
                          title="Create a new vessel and voyage"
                        >
                          + Quick add
                        </Button>
                      </div>
                    </FormRow>
                    <FormRow label="Voyage number">
                      <input className={inputClass} value={pack.voyageNumber || ""} onChange={(e) => set("voyageNumber", e.target.value)} placeholder="Voyage number" />
                    </FormRow>
                    <FormRow label="Lloyd ID">
                      <input className={inputClass} value={pack.lloydId || ""} onChange={(e) => set("lloydId", e.target.value)} placeholder="Lloyd ID" />
                    </FormRow>
                    <FormRow label="Cut-off">
                      <input className={inputClass} type="date" value={pack.vesselCutoffDate || ""} onChange={(e) => set("vesselCutoffDate", e.target.value)} />
                    </FormRow>
                    <FormRow label="ETD">
                      <input className={inputClass} type="date" value={pack.etd || ""} onChange={(e) => set("etd", e.target.value)} />
                    </FormRow>
                  </div>
                  {selectedVessel ? (
                    <p className="shrink-0 text-[10px] leading-snug text-slate-500">
                      <span className="font-semibold text-slate-700">Vessel schedule:</span>{" "}
                      {vesselDisplayName(selectedVessel)}{" "}
                      {(selectedVessel.voyage_number ?? selectedVessel.voyageNumber) ? `(${selectedVessel.voyage_number ?? selectedVessel.voyageNumber})` : ""}
                      {(selectedVessel.vessel_cutoff_date ?? selectedVessel.vesselCutoffDate)
                        ? ` · Cut-off ${formatDateDisplay(selectedVessel.vessel_cutoff_date ?? selectedVessel.vesselCutoffDate)}`
                        : ""}
                    </p>
                  ) : null}
                </div>
              </section>
            </div>

            <div className={importPermitRfpRowClass}>
              <section className={flushSectionClass} aria-label="Import permit">
                <div className={cn(flushSectionBodyClass, "gap-2")}>
                  <div className={sectionStackClass}>
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
            </div>

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
          </>
        ) : null}

        {activeTab === "pems" ? (
          <>
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
                            onClick={() => setPreviewPemsSubmission(row)}
                          >
                            View
                          </button>
                          <button
                            type="button"
                            className="text-[10px] font-medium text-brand-600 hover:underline disabled:opacity-50"
                            disabled={downloadingPemsBatchId === row.batchId}
                            onClick={() => handleDownloadPemsSubmission(row)}
                          >
                            {downloadingPemsBatchId === row.batchId ? "Downloading…" : "Download PDF"}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section className={sectionClass} aria-label="PEMs submission setup">
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
                    <select className={inputClass} value={pemsDraft.aoSignoff} onChange={(e) => updatePemsDraft({ aoSignoff: e.target.value })}>
                      <option value="">Select AO…</option>
                      {aoOptions.map((ao) => (
                        <option key={ao.id} value={ao.name}>
                          {ao.name}
                          {ao.aoNumber ? ` (${ao.aoNumber})` : ""}
                        </option>
                      ))}
                    </select>
                  </FormRow>
                </div>
                <PemsInspectionPanel
                  className="mt-3"
                  pemsDraft={pemsDraft}
                  onChange={updatePemsDraft}
                />
                <div className="mt-2 flex flex-row flex-wrap items-start gap-2 sm:gap-3">
                  <div className="min-w-0 flex-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">PEMs checker</p>
                    <div className="mt-1 grid auto-rows-auto grid-cols-1 items-start divide-y divide-slate-200 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
                      {[
                        {
                          title: "Yard number",
                          ...(!selectedPackSite?.establishmentNumber && !selectedPackSite?.yardNo
                            ? { ok: false, label: "Missing establishment number on site." }
                            : { ok: true, label: `Establishment ${selectedPackSite.establishmentNumber || selectedPackSite.yardNo}` }),
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
                  {hasPermission("packing.container.ao-signoff") ? (
                    <Button
                      type="button"
                      className="h-10 shrink-0 self-center sm:min-w-[160px]"
                      onClick={submitPemsFromForm}
                      disabled={!stagedPemsContainers.length || isSubmittingPems}
                    >
                      {isSubmittingPems ? "Submitting…" : `Submit ${stagedPemsContainers.length}`}
                    </Button>
                  ) : (
                    <div className="flex h-10 shrink-0 items-center self-center rounded-lg border border-amber-200 bg-amber-50 px-3 text-xs font-medium text-amber-700 sm:min-w-[160px]">
                      Requires Authorised Officer permission
                    </div>
                  )}
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
                          <PemsStagingFormField label="RFP Number">
                            <input
                              className={stagingInputClass}
                              value={pack.rfp}
                              onChange={(e) => set("rfp", e.target.value)}
                              placeholder="RFP reference"
                            />
                          </PemsStagingFormField>
                          <PemsStagingField label="Establishment Name" value={safeValue(selectedPackSite?.name)} />
                          <PemsStagingField label="Establishment Number" value={safeValue(selectedPackSite?.yardNo)} />
                          <PemsStagingFormField label="Exporter Name">
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
                        <div className={stagingGrid6Class}>
                          <PemsStagingField label="Original RFP No." value="N/A" />
                          <PemsStagingField label="Total Quantity" value={gppirStagingTotalWeight.toFixed(4)} />
                          <PemsStagingField label="Unit" value={GPPIR_WEIGHT_UNIT} />
                          <PemsStagingField label="Est. Net Metric Weight" value={`${gppirStagingTotalWeight.toFixed(2)} TONS`} />
                          <PemsStagingField label="Inspection Start Date and Time" value={formatDateTimeValue(pemsDraft.inspectionStart)} />
                          <PemsStagingField label="Inspection End Date and Time" value={formatDateTimeValue(pemsDraft.inspectionEnd)} />
                        </div>
                        <div className={stagingGrid6Class}>
                          <PemsStagingFormField label="Destination Country">
                            <select
                              className={stagingInputClass}
                              value={pack.destinationCountry}
                              onChange={(e) => set("destinationCountry", e.target.value)}
                            >
                              <option value="">- Select country -</option>
                              {countryOptions.map((country) => (
                                <option key={country.id} value={country.name}>
                                  {country.name}
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
                          <PemsStagingField label="Outcome type" value="Packaged" />
                          <PemsStagingField label="Expiry Date" value={stagingExpiryDate} />
                        </div>
                        <div className="overflow-x-auto rounded-md border border-slate-200 bg-white">
                          <table className="w-full table-fixed text-left text-xs">
                            <thead className="bg-slate-100 text-slate-700">
                              <tr>
                                <th className={cn(gppirTableCompactCol, "font-semibold")}>RFP Line No</th>
                                <th className={cn(gppirTableCellCol, "font-semibold")}>Container Number</th>
                                <th className={cn(gppirTableCellCol, "font-semibold")}>Source</th>
                                <th className={cn(gppirTableCellCol, "font-semibold")}>Commodity</th>
                                <th className={cn(gppirTableCompactCol, "font-semibold")}>Package Number</th>
                                <th className={cn(gppirTableTypeCol, "font-semibold")}>Type</th>
                                <th className={cn(gppirTableNumCol, "font-semibold")}>Weight</th>
                                <th className={cn(gppirTableNarrowCol, "font-semibold")}>Unit</th>
                                <th className={cn(gppirTableNumCol, "font-semibold")}>Line Weight</th>
                                <th className={cn(gppirTableNarrowCol, "font-semibold")}>Unit</th>
                                <th className={cn(gppirTableCompactCol, "font-semibold")}>Sampled</th>
                                <th className={cn(gppirTableResultCol, "font-semibold")}>Result</th>
                                <th className={cn(gppirTableCellCol, "font-semibold")}>Inspection AO Name</th>
                                <th className={cn(gppirTableRemarksCol, "font-semibold")}>Remarks</th>
                              </tr>
                            </thead>
                            <tbody>
                              {stagedPemsContainers.map((container) => {
                                const containerWeight = toRoundedNumber(container.nettWeight);
                                return (
                                  <tr key={container.id} className="border-t border-slate-100 text-slate-700">
                                    <td className={cn(gppirTableCompactCol, "text-center")}>1</td>
                                    <td className={cn(gppirTableCellCol, "truncate font-medium")}>{safeValue(container.containerNumber)}</td>
                                    <td className={cn(gppirTableCellCol, "truncate")}>{safeValue(container.grainLocation || container.stockBayId)}</td>
                                    <td className={cn(gppirTableCellCol, "truncate")}>{packPemsCommodityLabel}</td>
                                    <td className={cn(gppirTableCompactCol, "text-center")}>1</td>
                                    <td className={gppirTableTypeCol}>CONTAINER</td>
                                    <td className={gppirTableNumCol}>{containerWeight.toFixed(2)}</td>
                                    <td className={gppirTableNarrowCol}>{GPPIR_WEIGHT_UNIT}</td>
                                    <td className={gppirTableNumCol}>{containerWeight.toFixed(4)}</td>
                                    <td className={gppirTableNarrowCol}>{GPPIR_WEIGHT_UNIT}</td>
                                    <td className={cn(gppirTableCompactCol, "text-center")}>N/A</td>
                                    <td className={gppirTableResultCol}>
                                      {container.grainInspection === "Passed"
                                        ? "Passed"
                                        : container.grainInspection === "Failed"
                                          ? "Failed"
                                          : "Pending"}
                                    </td>
                                    <td className={cn(gppirTableCellCol, "truncate")}>{safeValue(pemsDraft.aoSignoff)}</td>
                                    <td className={gppirTableRemarksCol}>
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
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                        <div className={stagingGridClass}>
                          <PemsStagingField label="Submitted AO Name" value={safeValue(pemsDraft.aoSignoff)} />
                          <PemsStagingField label="Submitted AO Number" value={safeValue(selectedAoNumber)} />
                        </div>
                        <div className={stagingGrid3Class}>
                          <PemsStagingFormField label="Additional Declaration">
                            <select
                              className={stagingInputClass}
                              value={pack.rfpAdditionalDeclarationRequired ? "yes" : "no"}
                              onChange={(e) => set("rfpAdditionalDeclarationRequired", e.target.value === "yes")}
                            >
                              <option value="no">N/A</option>
                              <option value="yes">Yes</option>
                            </select>
                          </PemsStagingFormField>
                          <PemsStagingField label="Total Passed" value={gppirStagingPassedWeight.toFixed(4)} />
                          <PemsStagingField label="Unit" value={GPPIR_WEIGHT_UNIT} />
                        </div>
                        <div className={stagingGrid3Class}>
                          <PemsStagingFormField label="Comments">
                            <input
                              className={stagingInputClass}
                              value={pemsDraft.ecrComments ?? ""}
                              onChange={(e) => updatePemsDraft({ ecrComments: e.target.value })}
                              placeholder="N/A"
                            />
                          </PemsStagingFormField>
                          <PemsStagingField label="Total Failed" value={gppirStagingFailedWeight.toFixed(4)} />
                          <PemsStagingField label="Unit" value={GPPIR_WEIGHT_UNIT} />
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
                          <table className="w-full table-fixed text-left text-xs [&_th]:leading-snug [&_td]:leading-snug">
                            <thead className="bg-slate-100 text-slate-700">
                              <tr>
                                <th className={cn(gppirTableContainerCol, "font-semibold")}>Container Number</th>
                                <th className={cn(gppirTableInspectionLevelCol, "font-semibold")}>Inspection Level</th>
                                <th className={cn(gppirTableRfpCol, "font-semibold")}>RFP Number</th>
                                <th className={cn(gppirTableResultCol, "font-semibold")}>Result</th>
                                <th className={cn(gppirTableSealCol, "font-semibold")}>Seal Number</th>
                                <th className={cn(gppirTableExpiryDateCol, "font-semibold")}>Expiry Date</th>
                                <th className={cn(gppirTableInspectionAoCol, "font-semibold")}>Inspection AO Name</th>
                                <th className={cn(gppirTableRemarksCol, "font-semibold")}>Remarks</th>
                              </tr>
                            </thead>
                            <tbody>
                              {stagedPemsContainers.map((container) => (
                                <tr key={container.id} className="border-t border-slate-100 text-slate-700">
                                  <td className={cn(gppirTableContainerCol, "truncate font-medium")}>{safeValue(container.containerNumber)}</td>
                                  <td className={gppirTableInspectionLevelCol}>Consumable</td>
                                  <td className={cn(gppirTableRfpCol, "truncate")}>{safeValue(packRfpText || container.releaseNumber)}</td>
                                  <td className={gppirTableResultCol}>
                                    {container.emptyInspection === "Passed"
                                      ? "Pass"
                                      : container.emptyInspection === "Failed"
                                        ? "Fail"
                                        : "Pending"}
                                  </td>
                                  <td className={cn(gppirTableSealCol, "truncate")}>{safeValue(container.sealNumber)}</td>
                                  <td className={gppirTableExpiryDateCol}>{stagingExpiryDate}</td>
                                  <td className={cn(gppirTableInspectionAoCol, "truncate")}>{safeValue(pemsDraft.aoSignoff)}</td>
                                  <td className={gppirTableRemarksCol}>
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
                      </div>
            )}
                        <div className="mt-3 rounded-md border border-slate-200 bg-white p-2.5">
                          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-600">Submitted PEMs records</h3>
                          {!pemsSubmissions.length ? (
                            <p className="mt-2 text-xs text-slate-500">No submissions yet.</p>
                          ) : (
                            <div className="mt-2 space-y-1.5">
                              {pemsSubmissions.map((row) => (
                                <div key={row.batchId} className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs">
                                  <div className="flex items-center gap-2">
                                    <span className="font-semibold text-slate-800">{row.batchId}</span>
                                    <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800">{safeValue(row.status)}</span>
                                    <span className="ms-auto text-[10px] text-slate-400">{formatDateTimeValue(row.submittedAt)}</span>
                                  </div>
                                  <p className="mt-0.5 text-[11px] text-slate-600">
                                    {safeValue(row.recordType)} · Containers {Array.isArray(row.containerIds) ? row.containerIds.length : 0}
                                  </p>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </section>
                  </div>
                </div>
              <PemsSubmissionPreviewModal submission={previewPemsSubmission} onClose={() => setPreviewPemsSubmission(null)} />
            </>
        ) : null}

            {activeTab === "accounting" ? (
              <div className={sectionColumnsClass}>
                <section className={flushSectionClass} aria-label="Revenue">
                  <div className={flushSectionBodyClass}>
                    <p className="text-sm text-slate-500">
                      Revenue calculations will appear once commodity pricing and container data are connected.
                    </p>
                  </div>
                </section>
                <section className={flushSectionClass} aria-label="Expense">
                  <div className={flushSectionBodyClass}>
                    <p className="text-sm text-slate-500">Cost-side lines will be added in a future release.</p>
                  </div>
                </section>
              </div>
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
                        <FormRow label="Fumigation timing">
                          <select
                            className={inputClass}
                            value={pack.fumigationTiming ?? ""}
                            onChange={(e) => set("fumigationTiming", e.target.value)}
                          >
                            <option value="">Select timing…</option>
                            <option value="pre-pack">Pre-Pack</option>
                            <option value="post-pack">Post-Pack</option>
                          </select>
                        </FormRow>
                      </div>
                      <div className={cn("mt-2", fumigationTopGridClass)}>
                        <FormRow label="Fumigator name">
                          <select
                            className={inputClass}
                            value={fd.fumigatorName || ""}
                            onChange={(e) => {
                              const name = e.target.value;
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
                          >
                            <option value="">- Select fumigator -</option>
                            {fumigatorOptions.map((u) => (
                              <option key={u.id} value={u.name}>
                                {u.name}
                                {u.fumigatorLicence ? ` (${u.fumigatorLicence})` : ""}
                              </option>
                            ))}
                          </select>
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
                          <select
                            className={inputClass}
                            style={{ maxWidth: "5.5rem" }}
                            value={fd.dosageUnit || "g/m3"}
                            onChange={(e) => updateFumigationDetail({ dosageUnit: e.target.value })}
                          >
                            {PACK_FUMIGATION_DOSAGE_UNITS.map((unit) => (
                              <option key={unit} value={unit}>{unit}</option>
                            ))}
                          </select>
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
                          <select
                            className={inputClass}
                            style={{ maxWidth: "5.5rem" }}
                            value={fd.exposureTimeUnit || "hours"}
                            onChange={(e) => updateFumigationDetail({ exposureTimeUnit: e.target.value })}
                          >
                            {FUMIGATION_MIN_EXPOSURE_UNITS.map((unit) => (
                              <option key={unit} value={unit}>{unit}</option>
                            ))}
                          </select>
                        </div>
                      </FormRow>
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
                      <FormRow label="Calculated dose">
                        <div className="flex gap-2">
                          <input
                            className={inputClass}
                            type="number"
                            step="0.1"
                            value={fd.calculatedDosageValue ?? ""}
                            onChange={(e) => updateFumigationDetail({ calculatedDosageValue: e.target.value })}
                          />
                          <select
                            className={inputClass}
                            style={{ maxWidth: "4.5rem" }}
                            value={fd.calculatedDosageUnit || "g"}
                            onChange={(e) => updateFumigationDetail({ calculatedDosageUnit: e.target.value })}
                          >
                            {PACK_FUMIGATION_MASS_UNITS.map((unit) => (
                              <option key={unit} value={unit}>{unit}</option>
                            ))}
                          </select>
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
                          <select
                            className={inputClass}
                            style={{ maxWidth: "4.5rem" }}
                            value={fd.actualDosageAppliedUnit || "g"}
                            onChange={(e) => updateFumigationDetail({ actualDosageAppliedUnit: e.target.value })}
                          >
                            {PACK_FUMIGATION_MASS_UNITS.map((unit) => (
                              <option key={unit} value={unit}>{unit}</option>
                            ))}
                          </select>
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
                          <select
                            className={inputClass}
                            value={fd.fumigationResult ?? ""}
                            onChange={(e) => updateFumigationDetail({ fumigationResult: e.target.value })}
                          >
                            <option value="">— select —</option>
                            <option value="pass">Pass</option>
                            <option value="fail">Fail</option>
                          </select>
                        </FormRow>
                        <FormRow label="Authorised officer (if supervised)">
                          <select
                            className={inputClass}
                            value={fd.governmentOfficerName ?? ""}
                            onChange={(e) => updateFumigationDetail({ governmentOfficerName: e.target.value })}
                          >
                            <option value="">- Select AO -</option>
                            {aoOptions.map((u) => (
                              <option key={u.id} value={u.name}>
                                {u.name}
                                {u.aoNumber ? ` (${u.aoNumber})` : ""}
                              </option>
                            ))}
                          </select>
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
                    packReleases={Array.isArray(pack.releaseDetails) ? pack.releaseDetails : []}
                    containerParkOptions={containerParkOptions}
                    transporterOptions={transporterOptions}
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

        <QuickAddReleaseModal
          open={quickReleaseOpen}
          draft={quickReleaseDraft}
          error={quickReleaseError}
          lookups={quickReleaseLookups}
          onClose={closeQuickAddRelease}
          onSave={saveQuickAddRelease}
          onChangeField={setQuickReleaseField}
          onUpdatePark={updateQuickReleasePark}
          onAddPark={addQuickReleasePark}
          onRemovePark={removeQuickReleasePark}
          onToggleTransporter={toggleQuickReleaseTransporter}
        />

        <QuickAddVesselModal
          open={quickVesselOpen}
          onClose={() => setQuickVesselOpen(false)}
          onCreated={handleQuickVesselCreated}
          shippingLineOptions={shippingLineOptions}
          terminalOptions={terminalOptions}
          portOptions={portOptions}
        />
      </>
      );
}

function QuickAddReleaseModal({
  open,
  draft,
  error,
  lookups,
  onClose,
  onSave,
  onChangeField,
  onUpdatePark,
  onAddPark,
  onRemovePark,
  onToggleTransporter,
}) {
  if (!open) return null;
  const parks = Array.isArray(draft?.parks) && draft.parks.length
    ? draft.parks
    : [{ containerParkId: "", transporterIds: [] }];
  const fieldLabel = "text-[11px] font-semibold uppercase tracking-wide text-slate-600";
  const lookupsLoading = lookups?.loading;
  const containerParkOptions = lookups?.containerParks || [];
  const transporterOptions = lookups?.transporters || [];
  const containerCodeOptions = lookups?.containerCodes || [];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button type="button" className="absolute inset-0 bg-black/40" aria-label="Close dialog" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="quick-release-title"
        className="relative max-h-[min(92vh,820px)] w-full max-w-3xl overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-4 py-3">
          <h2 id="quick-release-title" className="text-sm font-semibold text-slate-900">
            Quick Add Release
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
              <select
                className={inputClass}
                value={draft.status}
                onChange={(e) => onChangeField("status", e.target.value)}
              >
                {RELEASE_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
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
              <select
                className={inputClass}
                value={draft.containerCodeIsoCode}
                onChange={(e) => onChangeField("containerCodeIsoCode", e.target.value)}
              >
                <option value="">
                  {lookupsLoading ? "Loading…" : "Select container type..."}
                </option>
                {containerCodeOptions.map((row) => {
                  const iso = row.iso_code ?? row.isoCode ?? "";
                  const size = row.container_size ?? row.containerSize ?? "";
                  const desc = row.description ?? "";
                  return (
                    <option key={row.id} value={iso}>
                      {[iso, size, desc].filter(Boolean).join(" · ")}
                    </option>
                  );
                })}
              </select>
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
                    <select
                      className={inputClass}
                      value={park.containerParkId === "" ? "" : String(park.containerParkId)}
                      onChange={(e) => onUpdatePark(index, "containerParkId", e.target.value || "")}
                    >
                      <option value="">
                        {lookupsLoading ? "Loading…" : "Select empty container park..."}
                      </option>
                      {containerParkOptions.map((cp) => (
                        <option key={cp.id} value={cp.id}>
                          {cp.name}
                        </option>
                      ))}
                    </select>
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
            Saving creates a Release record in Reference Data and adds the release reference + first park/transporter to this pack.
          </p>

          <div className="mt-4 flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button type="button" size="sm" onClick={onSave}>
              Create & attach
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
