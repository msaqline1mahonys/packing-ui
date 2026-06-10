"use client";

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
const ISO_BY_CONTAINER_CODE = {
  "20FT": "22G1",
  "40FT": "42G1",
  HC40: "45G1",
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

function newContainerDraft({ packRow, index, sourceContainer, parkName, transporterName, defaultPacker, defaultAo }) {
  const startDate = packRow.packingStartDate || packRow.date || "";
  const tare = round2((packRow.mtTotal || 0) / Math.max(Number(packRow.containersRequired || 1), 1) * 0.1);
  const gross = round2((packRow.mtTotal || 0) / Math.max(Number(packRow.containersRequired || 1), 1));
  const nett = round2(Math.max(gross - tare, 0));
  const releaseRef = String(sourceContainer?.releaseNumber || "").trim();
  const containerNo = sourceContainer?.containerNumber || sourceContainer?.containerNo || "";
  const containerCode = sourceContainer?.containerCode || packRow.containerCode || "";
  const iso =
    sourceContainer?.containerIsoCode ||
    sourceContainer?.isoCode ||
    ISO_BY_CONTAINER_CODE[String(containerCode || "").toUpperCase()] ||
    "22G1";
  return {
    id: sourceContainer?.id || `${packRow.id}-${index + 1}`,
    order: index + 1,
    containerNo,
    releaseNumber: releaseRef || "",
    sealNo: sourceContainer?.sealNumber || sourceContainer?.sealNo || `0${packRow.id}${index + 1}`,
    grainLocation: sourceContainer?.grainLocation || parkName || "",
    isoCode: iso,
    stockBayId: sourceContainer?.stockBayId || "Silo 2",
    startDate: sourceContainer?.startDate || startDate,
    startHour: sourceContainer?.startHour || "",
    startMinute: sourceContainer?.startMinute || "",
    tare: sourceContainer?.tare != null ? round2(sourceContainer.tare) : tare,
    grossWeight: sourceContainer?.grossWeight != null ? round2(sourceContainer.grossWeight) : gross,
    nettWeight: sourceContainer?.nettWeight != null ? round2(sourceContainer.nettWeight) : nett,
    containerTareWeight:
      sourceContainer?.containerTareWeight != null
        ? round2(sourceContainer.containerTareWeight)
        : round2(Math.max(tare - 0.01, 0)),
    releasePark: sourceContainer?.releasePark || parkName || "",
    transporter: sourceContainer?.transporter || transporterName || "",
    containerNotes: sourceContainer?.containerNotes || "",
    packerSignoff: sourceContainer?.packerSignoff || defaultPacker,
    outLoaded: sourceContainer?.outLoaded || "No",
    praSignoff: sourceContainer?.praSignoff || defaultPacker,
    praSubmitted: Boolean(sourceContainer?.praSubmitted),
    praTemplate: sourceContainer?.praTemplate || PRA_TEMPLATE_DEFAULT,
    praLastStatus: sourceContainer?.praLastStatus || "Pending",
    praLastSubmittedTime: sourceContainer?.praLastSubmittedTime || "",
    praLastError: sourceContainer?.praLastError || "",
    emptyInspection: sourceContainer?.emptyInspection || "Pending",
    grainInspection: sourceContainer?.grainInspection || "Pending",
    aoSignoff: sourceContainer?.aoSignoff || defaultAo,
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
    status: sourceContainer?.status || "Draft",
  };
}

function toContainerDrafts(packRow, previousPackDraft, parkNames, transporterNames, defaultPacker, defaultAo) {
  const requiredCount = Math.max(parseNumber(packRow.containersRequired, 0), 1);
  const sourceContainers = Array.isArray(packRow.containers) ? packRow.containers : [];
  const next = [];

  for (let index = 0; index < requiredCount; index += 1) {
    const sourceContainer = sourceContainers[index] || {};
    const existing = previousPackDraft?.containers?.find((container) => container.id === sourceContainer.id) || previousPackDraft?.containers?.[index];
    if (existing) {
      const tare = round2(parseNumber(existing.tare));
      const grossWeight = round2(parseNumber(existing.grossWeight));
      const scheduleRelease = String(sourceContainer?.releaseNumber || "").trim();
      next.push({
        ...existing,
        order: index + 1,
        id: existing.id || sourceContainer.id || `${packRow.id}-${index + 1}`,
        status: existing.status || sourceContainer.status || "Draft",
        nettWeight: round2(Math.max(grossWeight - tare, 0)),
        releaseNumber: String(existing.releaseNumber || "").trim() || scheduleRelease,
        aoInspectionRemark:
          String(existing.aoInspectionRemark ?? "").trim() ||
          String(sourceContainer?.aoInspectionRemark ?? "").trim() ||
          "",
        packerNotes:
          String(existing.packerNotes ?? "").trim() ||
          String(sourceContainer?.packerNotes ?? "").trim() ||
          "",
      });
      continue;
    }
    const parkName = parkNames.get(String(sourceContainer.emptyContainerParkId)) || "";
    const transporterName = transporterNames.get(String(sourceContainer.transporterId)) || "";
    next.push(newContainerDraft({ packRow, index, sourceContainer, parkName, transporterName, defaultPacker, defaultAo }));
  }
  return next;
}

export function syncWorkDrafts(packRows, previousWork = {}, lookups = {}) {
  const parkNames = mapById(lookups.containerParks);
  const transporterNames = mapById(lookups.transporters);
  const activePackers = (lookups.packers || [])
    .filter((p) => String(p.status ?? "active").toLowerCase() === "active")
    .map((p) => p.name);
  const defaultPacker = activePackers[0] || "";
  const defaultAo = activePackers[0] || "";

  const next = {};
  for (const row of packRows) {
    const previousPackDraft = previousWork?.[row.id];
    const containers = toContainerDrafts(row, previousPackDraft, parkNames, transporterNames, defaultPacker, defaultAo);
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

function hasCompleteChecks(container) {
  return (
    Boolean(container?.packerSignoff) &&
    container?.outLoaded === "Yes" &&
    container?.emptyInspection === "Passed" &&
    container?.grainInspection === "Passed" &&
    Boolean(container?.aoSignoff)
  );
}

export function containerStage(container) {
  const praStatus = String(container?.praLastStatus || "").toLowerCase();
  const isAccepted = praStatus === "accepted";
  const isFailed = praStatus === "rejected" || praStatus === "error";
  const checksComplete = hasCompleteChecks(container);

  if (isAccepted && checksComplete) return "Complete";
  if (isAccepted) return "PRA Passed";
  if (isFailed) return "PRA Failed";
  if (container?.praSubmitted) return "PRA Submitted";
  return "Packing";
}

export function getPackProgress(packRow, workByPack) {
  const draft = workByPack?.[packRow?.id];
  const submitted = (draft?.containers || []).filter((container) => container.praSubmitted).length;
  const required = Math.max(parseNumber(packRow?.containersRequired, 0), 0);
  return { submitted, required, label: `${submitted}/${required}` };
}

export function toInputNumber(value) {
  if (value == null) return "";
  const n = Number(value);
  return Number.isFinite(n) ? String(n) : "";
}

export function toRoundedNumber(value) {
  return round2(value);
}

