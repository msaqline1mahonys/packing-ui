"use client";

import { PACK_FORM_LOOKUPS } from "@/lib/Data";

const WORK_KEY = "packing-ui-packers-work-v1";
const PRA_TEMPLATE_DEFAULT = "Original";
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
    m.set(Number(row?.[key]), String(row?.[value] ?? ""));
  }
  return m;
}

function newContainerDraft({ packRow, index, releaseRef, parkName, transporterName, defaultPacker, defaultAo }) {
  const startDate = packRow.packingStartDate || packRow.date || "";
  const tare = round2((packRow.mtTotal || 0) / Math.max(Number(packRow.containersRequired || 1), 1) * 0.1);
  const gross = round2((packRow.mtTotal || 0) / Math.max(Number(packRow.containersRequired || 1), 1));
  const nett = round2(Math.max(gross - tare, 0));
  const containerNo = releaseRef || `${String(packRow.jobReference || "PK").replace(/\s+/g, "").toUpperCase()}-${index + 1}`;
  const iso = ISO_BY_CONTAINER_CODE[String(packRow.containerCode || "").toUpperCase()] || "22G1";
  return {
    id: `${packRow.id}-${index + 1}`,
    order: index + 1,
    containerNo,
    releaseNumber: releaseRef || "",
    sealNo: `0${packRow.id}${index + 1}`,
    grainLocation: parkName || "",
    isoCode: iso,
    stockBayId: "Silo 2",
    startDate,
    startHour: "",
    startMinute: "",
    tare,
    grossWeight: gross,
    nettWeight: nett,
    containerTareWeight: round2(Math.max(tare - 0.01, 0)),
    releasePark: parkName || "",
    transporter: transporterName || "",
    containerNotes: "",
    packerSignoff: defaultPacker,
    outLoaded: "No",
    praSignoff: defaultPacker,
    praSubmitted: false,
    praTemplate: PRA_TEMPLATE_DEFAULT,
    praLastStatus: "Pending",
    praLastSubmittedTime: "",
    praLastError: "",
    emptyInspection: "Pending",
    grainInspection: "Pending",
    aoSignoff: defaultAo,
    aoInspectionRemark: "",
    packerNotes: "",
  };
}

function toContainerDrafts(packRow, previousPackDraft, parkNames, transporterNames, defaultPacker, defaultAo) {
  const requiredCount = Math.max(parseNumber(packRow.containersRequired, 0), 1);
  const releaseRows = Array.isArray(packRow.releaseDetails) ? packRow.releaseDetails : [];
  const next = [];

  for (let index = 0; index < requiredCount; index += 1) {
    const existing = previousPackDraft?.containers?.[index];
    if (existing) {
      const tare = round2(parseNumber(existing.tare));
      const grossWeight = round2(parseNumber(existing.grossWeight));
      next.push({
        ...existing,
        order: index + 1,
        id: existing.id || `${packRow.id}-${index + 1}`,
        nettWeight: round2(Math.max(grossWeight - tare, 0)),
      });
      continue;
    }
    const release = releaseRows[index] || {};
    const releaseRef = String(release.releaseRef || "").trim();
    const parkName = parkNames.get(Number(release.emptyContainerParkId)) || "";
    const transporterName = transporterNames.get(Number(release.transporterId)) || "";
    next.push(newContainerDraft({ packRow, index, releaseRef, parkName, transporterName, defaultPacker, defaultAo }));
  }
  return next;
}

export function syncWorkDrafts(packRows, previousWork = {}) {
  const parkNames = mapById(PACK_FORM_LOOKUPS.containerParks);
  const transporterNames = mapById(PACK_FORM_LOOKUPS.transporters);
  const activePackers = (PACK_FORM_LOOKUPS.packers || [])
    .filter((p) => String(p.status).toLowerCase() === "active")
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

