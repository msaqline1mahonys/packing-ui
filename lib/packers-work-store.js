"use client";

import { containerHasCompleteChecks, isContainerOutloadComplete } from "@/lib/packers-container-validation";
import { isImportPack } from "@/lib/pack-import";
import { defaultContainerPemsFields, defaultPemsDraftFields } from "@/lib/pems/constants";

const WORK_KEY = "packing-ui-packers-work-v1";
const PRA_TEMPLATE_DEFAULT = "Original";
const DEFAULT_PACK_CHECKS = {
  importDetailsChecked: false,
  sampleRequirementsChecked: false,
  rfpDetailsChecked: false,
  micorRequirementsChecked: false,
};
const DEFAULT_PEMS_DRAFT = {
  recordType: "Empty Container Inspection Record",
  inspectionStart: "",
  inspectionEnd: "",
  aoSignoff: "",
  aoNumber: "",
  stagedContainerIds: [],
  ecrComments: "",
  ...defaultPemsDraftFields(),
};

function parseNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function round2(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

function mapById(rows, key = "id", value = "name") {
  const m = new Map();
  for (const row of rows || []) {
    if (row?.[key] == null) continue;
    m.set(String(row[key]), String(row?.[value] ?? ""));
  }
  return m;
}

function newContainerDraft({ packRow, index, sourceContainer, parkName, transporterName, firstPackRelease }) {
  // Accept both camelCase (normalized) and snake_case (raw API fallback)
  // NOTE: We intentionally do NOT default startDate to the pack's packing start date.
  // The container start date is set by the packer; showing today's date as a UI hint
  // is handled in the form component when the stored value is empty.
  const releaseRef = String(sourceContainer?.releaseNumber ?? sourceContainer?.release_number ?? "").trim();
  // Pre-fill with first pack release ref when container has no explicit release
  const effectiveReleaseRef = releaseRef || String(firstPackRelease?.releaseNumber ?? firstPackRelease?.releaseRef ?? firstPackRelease?.release_ref ?? "").trim();
  const effectiveReleaseId = sourceContainer?.releaseId ?? sourceContainer?.release_id ?? firstPackRelease?.releaseId ?? null;
  const containerNo = sourceContainer?.containerNumber ?? sourceContainer?.container_number ?? sourceContainer?.containerNo ?? "";
  return {
    id: sourceContainer?.id || `${packRow.id}-${index + 1}`,
    order: index + 1,
    containerNo,
    releaseId: effectiveReleaseId,
    releaseNumber: effectiveReleaseRef,
    emptyContainerParkId: sourceContainer?.emptyContainerParkId ?? sourceContainer?.empty_container_park_id ?? firstPackRelease?.emptyContainerParkId ?? null,
    transporterId: sourceContainer?.transporterId ?? sourceContainer?.transporter_id ?? firstPackRelease?.transporterId ?? null,
    sealNo: sourceContainer?.sealNumber || sourceContainer?.sealNo || "",
    // Only use explicitly saved ISO — do not compute a fallback
    isoCode: sourceContainer?.containerIsoCode || sourceContainer?.isoCode || "",
    // Only use explicitly saved stock bay — do not default to a location name
    stockBayId: sourceContainer?.stockBayId || "",
    packer: sourceContainer?.packer || "",
    startDate: sourceContainer?.startDate ?? "",
    startHour: sourceContainer?.startHour || "",
    startMinute: sourceContainer?.startMinute || "",
    // Weights: start blank (null) if not yet saved — never compute from mtTotal
    tare: sourceContainer?.tare != null ? round2(sourceContainer.tare) : null,
    grossWeight: sourceContainer?.grossWeight != null ? round2(sourceContainer.grossWeight) : null,
    nettWeight: sourceContainer?.nettWeight != null ? round2(sourceContainer.nettWeight) : null,
    containerTareWeight: sourceContainer?.containerTareWeight != null ? round2(sourceContainer.containerTareWeight) : null,
    releasePark: sourceContainer?.releasePark || parkName || "",
    transporter: sourceContainer?.transporter || transporterName || "",
    containerNotes: sourceContainer?.containerNotes || "",
    // Signoffs: start blank — do not pre-fill with a default user name
    packerSignoff: sourceContainer?.packerSignoff || "",
    outLoaded: sourceContainer?.outLoaded || "No",
    praSignoff: sourceContainer?.praSignoff || "",
    praSubmitted: Boolean(sourceContainer?.praSubmitted),
    praTemplate: sourceContainer?.praTemplate || PRA_TEMPLATE_DEFAULT,
    praLastStatus: sourceContainer?.praLastStatus || "Pending",
    praLastSubmittedTime: sourceContainer?.praLastSubmittedTime || "",
    praLastError: sourceContainer?.praLastError || "",
    emptyInspection: sourceContainer?.emptyInspection || "Pending",
    grainInspection: sourceContainer?.grainInspection || "Pending",
    aoSignoff: sourceContainer?.aoSignoff || "",
    aoInspectionRemark: sourceContainer?.aoInspectionRemark || "",
    ...defaultContainerPemsFields(),
    inspectionResultCode: sourceContainer?.inspectionResultCode || "",
    ecrSubmitted: Boolean(sourceContainer?.ecrSubmitted ?? sourceContainer?.pemsSubmitted),
    ecrLastSubmittedAt: sourceContainer?.ecrLastSubmittedAt || sourceContainer?.pemsLastSubmittedAt || "",
    ecrLastBatchId: sourceContainer?.ecrLastBatchId || sourceContainer?.pemsLastBatchId || "",
    gppirSubmitted: Boolean(sourceContainer?.gppirSubmitted),
    gppirLastSubmittedAt: sourceContainer?.gppirLastSubmittedAt || "",
    gppirLastBatchId: sourceContainer?.gppirLastBatchId || "",
    packerNotes: sourceContainer?.packerNotes || "",
    tests: sourceContainer?.tests && typeof sourceContainer.tests === "object" ? sourceContainer.tests : {},
    status: sourceContainer?.status || "Draft",
    onSite: Boolean(sourceContainer?.onSite ?? sourceContainer?.on_site),
    replacesContainerId: sourceContainer?.replacesContainerId ?? sourceContainer?.replaces_container_id ?? null,
    replacedByContainerId: sourceContainer?.replacedByContainerId ?? sourceContainer?.replaced_by_container_id ?? null,
    replacesContainerNumber:
      sourceContainer?.replacesContainerNumber ??
      sourceContainer?.replaces_container?.container_number ??
      "",
  };
}

function toContainerDrafts(packRow, previousPackDraft, parkNames, transporterNames) {
  // Handle both camelCase (normalized) and snake_case (raw API fallback)
  const requiredCount = Math.max(parseNumber(packRow.containersRequired ?? packRow.containers_required, 0), 1);
  const sourceContainers = Array.isArray(packRow.containers) ? packRow.containers : [];
  const sortedSources = [...sourceContainers].sort(
    (a, b) => (Number(a.order) || 0) - (Number(b.order) || 0),
  );
  const slotCount = Math.max(requiredCount, sortedSources.length);

  // First release on the pack used to pre-fill containers that have no release set
  const packReleaseList = Array.isArray(packRow.releases) ? packRow.releases
    : Array.isArray(packRow.releaseDetails) ? packRow.releaseDetails : [];
  const firstPackRelease = packReleaseList[0] ?? null;

  const next = [];

  for (let index = 0; index < slotCount; index += 1) {
    const sourceContainer = sortedSources[index] || {};
    const existing = previousPackDraft?.containers?.find((container) => container.id === sourceContainer.id) || previousPackDraft?.containers?.[index];
    if (existing) {
      const tare = existing.tare != null ? round2(parseNumber(existing.tare)) : null;
      const grossWeight = existing.grossWeight != null ? round2(parseNumber(existing.grossWeight)) : null;
      const scheduleRelease = String(sourceContainer?.releaseNumber ?? sourceContainer?.release_number ?? "").trim();
      // Prefer the real database UUID; only fall back to the localStorage draft ID
      // if there is no authoritative ID from the API (e.g. not yet persisted).
      const resolvedId = sourceContainer.id || existing.id || `${packRow.id}-${index + 1}`;

      // Sync park/transporter from API container if the existing draft has no IDs yet
      const resolvedParkId = existing.emptyContainerParkId ??
        sourceContainer.emptyContainerParkId ?? sourceContainer.empty_container_park_id ??
        firstPackRelease?.emptyContainerParkId ?? null;
      const resolvedTransporterId = existing.transporterId ??
        sourceContainer.transporterId ?? sourceContainer.transporter_id ??
        firstPackRelease?.transporterId ?? null;
      const resolvedParkName = existing.releasePark ||
        parkNames.get(String(resolvedParkId)) || "";
      const resolvedTransporterName = existing.transporter ||
        transporterNames.get(String(resolvedTransporterId)) || "";

      // Sync planner-assigned fields from the server so that Refresh reflects
      // container numbers / seals / ISO codes assigned in the packing schedule.
      // Packer-entered fields (weights, signoffs, dates) keep the local draft value.
      const serverContainerNo =
        String(sourceContainer?.containerNo ?? sourceContainer?.containerNumber ?? sourceContainer?.container_number ?? "").trim();
      const serverSealNo =
        String(sourceContainer?.sealNo ?? sourceContainer?.sealNumber ?? sourceContainer?.seal_number ?? "").trim();
      const serverIsoCode =
        String(sourceContainer?.isoCode ?? sourceContainer?.containerIsoCode ?? sourceContainer?.container_iso_code ?? "").trim();

      next.push({
        ...existing,
        order: index + 1,
        id: resolvedId,
        status: existing.status || sourceContainer.status || "Draft",
        nettWeight: tare != null && grossWeight != null ? round2(Math.max(grossWeight - tare, 0)) : null,
        // Planning fields: prefer server value so Refresh always shows latest
        containerNo: serverContainerNo || existing.containerNo || "",
        sealNo: serverSealNo || existing.sealNo || "",
        isoCode: serverIsoCode || existing.isoCode || "",
        releaseNumber: String(existing.releaseNumber || "").trim() || scheduleRelease,
        releaseId: existing.releaseId ?? sourceContainer.releaseId ?? sourceContainer.release_id ?? firstPackRelease?.releaseId ?? null,
        emptyContainerParkId: resolvedParkId,
        transporterId: resolvedTransporterId,
        releasePark: resolvedParkName,
        transporter: resolvedTransporterName,
        aoInspectionRemark:
          String(existing.aoInspectionRemark ?? "").trim() ||
          String(sourceContainer?.aoInspectionRemark ?? sourceContainer?.ao_inspection_remark ?? "").trim() ||
          "",
        packerNotes:
          String(existing.packerNotes ?? "").trim() ||
          String(sourceContainer?.packerNotes ?? sourceContainer?.packer_notes ?? "").trim() ||
          "",
        packer:
          String(existing.packer ?? "").trim() ||
          String(sourceContainer?.packer ?? "").trim() ||
          "",
        tests: {
          ...(sourceContainer?.tests && typeof sourceContainer.tests === "object" ? sourceContainer.tests : {}),
          ...(existing.tests && typeof existing.tests === "object" ? existing.tests : {}),
        },
        onSite: Boolean(sourceContainer?.onSite ?? sourceContainer?.on_site ?? existing.onSite),
        replacesContainerId:
          sourceContainer?.replacesContainerId ??
          sourceContainer?.replaces_container_id ??
          existing.replacesContainerId ??
          null,
        replacedByContainerId:
          sourceContainer?.replacedByContainerId ??
          sourceContainer?.replaced_by_container_id ??
          existing.replacedByContainerId ??
          null,
        replacesContainerNumber:
          String(
            sourceContainer?.replacesContainerNumber ??
              sourceContainer?.replaces_container?.container_number ??
              existing.replacesContainerNumber ??
              "",
          ).trim(),
      });
      continue;
    }
    const parkId = sourceContainer.emptyContainerParkId ?? sourceContainer.empty_container_park_id ??
      (String(sourceContainer?.releaseNumber ?? "").trim() ? null : firstPackRelease?.emptyContainerParkId ?? null);
    const transporterId = sourceContainer.transporterId ?? sourceContainer.transporter_id ??
      (String(sourceContainer?.releaseNumber ?? "").trim() ? null : firstPackRelease?.transporterId ?? null);
    const parkName = parkNames.get(String(parkId)) || "";
    const transporterName = transporterNames.get(String(transporterId)) || "";
    next.push(newContainerDraft({ packRow, index, sourceContainer, parkName, transporterName, firstPackRelease }));
  }
  return next;
}

export function syncWorkDrafts(packRows, previousWork = {}, lookups = {}) {
  const parkNames = mapById(lookups.containerParks);
  const transporterNames = mapById(lookups.transporters);

  const next = {};
  for (const row of packRows) {
    const previousPackDraft = previousWork?.[row.id];
    const containers = toContainerDrafts(row, previousPackDraft, parkNames, transporterNames);
    next[row.id] = {
      bulkSampleCollectionRequired: previousPackDraft?.bulkSampleCollectionRequired || "No",
      bulkSampleRequired: previousPackDraft?.bulkSampleRequired || "No",
      pemsDraft: {
        ...DEFAULT_PEMS_DRAFT,
        ...(previousPackDraft?.pemsDraft || {}),
      },
      pemsSubmissions: Array.isArray(previousPackDraft?.pemsSubmissions) && previousPackDraft.pemsSubmissions.length
        ? previousPackDraft.pemsSubmissions
        : Array.isArray(row.pemsSubmissions)
          ? row.pemsSubmissions
          : [],
      packChecks: {
        ...DEFAULT_PACK_CHECKS,
        ...(previousPackDraft?.packChecks || {}),
        importDetailsChecked: Boolean(row.importDetailsChecked ?? row.import_details_checked ?? previousPackDraft?.packChecks?.importDetailsChecked),
        sampleRequirementsChecked: Boolean(row.sampleRequirementsChecked ?? row.sample_requirements_checked ?? previousPackDraft?.packChecks?.sampleRequirementsChecked),
        rfpDetailsChecked: Boolean(row.rfpDetailsChecked ?? row.rfp_details_checked ?? previousPackDraft?.packChecks?.rfpDetailsChecked),
        micorRequirementsChecked: Boolean(row.micorRequirementsChecked ?? row.micor_requirements_checked ?? previousPackDraft?.packChecks?.micorRequirementsChecked),
      },
      containers,
    };
  }
  return next;
}

export function loadWorkDrafts() {
  if (typeof window === "undefined") return {};
  try {
    const parsed = JSON.parse(window.localStorage.getItem(WORK_KEY) || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function saveWorkDrafts(value) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(WORK_KEY, JSON.stringify(value));
}

function trimField(value) {
  return String(value ?? "").trim();
}

export function isEcFailedContainer(container) {
  return String(container?.emptyInspection ?? container?.empty_inspection ?? "").toLowerCase() === "failed";
}

export function isPackableContainer(container) {
  return !isEcFailedContainer(container);
}

/** GPPIR staging/submission — EC-failed containers are excluded. */
export function isEligibleForPemsGppir(container) {
  if (isEcFailedContainer(container)) return false;
  return Boolean(container?.ecrSubmitted ?? container?.ecr_submitted);
}

/** Containers included in fumigation, invoicing, and other operational workflows. */
export function filterOperationalContainers(containers) {
  if (!Array.isArray(containers)) return [];
  return containers.filter(isPackableContainer);
}

export function getContainerNumberFromRecord(container) {
  return trimField(
    container?.containerNo ?? container?.containerNumber ?? container?.container_number,
  );
}

export function getSealNumberFromContainerRecord(container) {
  return trimField(container?.sealNo ?? container?.sealNumber ?? container?.seal_number);
}

function containerIsOnSite(container) {
  return Boolean(container?.onSite ?? container?.on_site);
}

function containerHasPackingWorkflowStarted(container) {
  if (container?.praSubmitted) return true;
  const containerNo = trimField(
    container?.containerNo ?? container?.containerNumber ?? container?.container_number,
  );
  const seal = trimField(container?.sealNo ?? container?.sealNumber ?? container?.seal_number);
  if (containerNo && seal) return true;
  if (trimField(container?.packerSignoff)) return true;
  if (trimField(container?.aoSignoff)) return true;
  if (trimField(container?.stockBayId ?? container?.stock_bay_id)) return true;
  if (Number(container?.nettWeight ?? container?.nett_weight) > 0) return true;
  if (Number(container?.grossWeight ?? container?.gross_weight) > 0) return true;
  const emptyInsp = String(container?.emptyInspection ?? container?.empty_inspection ?? "Pending");
  if (emptyInsp !== "Pending") return true;
  const grainInsp = String(container?.grainInspection ?? container?.grain_inspection ?? "Pending");
  if (grainInsp !== "Pending") return true;
  if (container?.outLoaded === "Yes") return true;
  if (container?.ecrSubmitted) return true;
  if (container?.gppirSubmitted) return true;
  return false;
}

export function canToggleSiteStage(stage) {
  return stage === "Off Site" || stage === "On Site";
}

export function containerStage(container, isImport = false) {
  if (isImport) {
    return containerHasCompleteChecks(container, { isImport: true }) ? "Complete" : "Packing";
  }

  if (isEcFailedContainer(container)) return "EC Failed";

  const praStatus = String(container?.praLastStatus || "").toLowerCase();
  const isAccepted = praStatus === "accepted";
  const isFailed = praStatus === "rejected" || praStatus === "error";
  const checksComplete = containerHasCompleteChecks(container);

  if (isAccepted && checksComplete) return "Complete";
  if (isAccepted) return "PRA Passed";
  if (isFailed) return "PRA Failed";
  if (container?.praSubmitted) return "PRA Submitted";

  if (!containerHasPackingWorkflowStarted(container)) {
    return containerIsOnSite(container) ? "On Site" : "Off Site";
  }

  return "Packing";
}

export function countOnSiteContainers(containers, isImport = false) {
  if (!Array.isArray(containers)) return 0;
  return containers.filter((c) => containerStage(c, isImport) === "On Site").length;
}

export function countEcFailedContainers(containers, isImport = false) {
  if (!Array.isArray(containers)) return 0;
  return containers.filter((c) => containerStage(c, isImport) === "EC Failed").length;
}

export function getPackPraProgress(packRow, workByPack) {
  const draft = workByPack?.[packRow?.id];
  const required = Math.max(parseNumber(packRow?.containersRequired ?? packRow?.containers_required, 0), 0);
  if (isImportPack(packRow)) {
    const loaded = (draft?.containers || []).filter((container) => container.outLoaded === "Yes").length;
    return { submitted: loaded, required, label: `${loaded}/${required}` };
  }
  const submitted = (draft?.containers || []).filter((container) => container.praSubmitted).length;
  return { submitted, required, label: `${submitted}/${required}` };
}

export function getPackProgressLabel(packRow) {
  return isImportPack(packRow) ? "In-loaded" : "PRA";
}

export function getPackProgress(packRow, workByPack) {
  const draft = workByPack?.[packRow?.id];
  const isImport = isImportPack(packRow);
  const completed = (draft?.containers || []).filter((container) => isContainerOutloadComplete(container, { isImport })).length;
  const required = Math.max(parseNumber(packRow?.containersRequired ?? packRow?.containers_required, 0), 0);
  return { completed, required, label: `${completed}/${required}` };
}

export function toInputNumber(value) {
  if (value == null) return "";
  const n = Number(value);
  return Number.isFinite(n) ? String(n) : "";
}

export function toRoundedNumber(value) {
  return round2(value);
}

