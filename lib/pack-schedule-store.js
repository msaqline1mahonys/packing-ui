"use client";

import { PACK_SCHEDULE_ROWS } from "@/lib/Data";

const STORAGE_KEY = "packing-ui-pack-schedule-rows";
const ISO_BY_CONTAINER_CODE = {
  "20FT": "22G1",
  "40FT": "42G1",
  HC40: "45G1",
};

function defaultIsoForContainerCode(containerCode) {
  return ISO_BY_CONTAINER_CODE[String(containerCode || "").toUpperCase()] || "";
}

function normalizePackContainers(row) {
  const requiredCount = Math.max(Number(row?.containersRequired || 0), 0);
  const existingContainers = Array.isArray(row?.containers) ? row.containers : [];
  return Array.from({ length: requiredCount }, (_, index) => {
    const existing = existingContainers[index] || {};
    const order = index + 1;
    return {
      ...existing,
      id: existing.id || `${row.id || "pack"}-${order}`,
      packId: existing.packId ?? row.id ?? null,
      order,
      containerNumber: existing.containerNumber ?? existing.containerNo ?? "",
      containerCode: existing.containerCode ?? row.containerCode ?? "",
      containerIsoCode:
        existing.containerIsoCode ??
        existing.isoCode ??
        defaultIsoForContainerCode(existing.containerCode ?? row.containerCode),
      sealNumber: existing.sealNumber ?? existing.sealNo ?? "",
      releaseNumber: existing.releaseNumber ?? "",
      emptyContainerParkId: existing.emptyContainerParkId ?? "",
      transporterId: existing.transporterId ?? "",
      releasePark: existing.releasePark ?? "",
      transporter: existing.transporter ?? "",
      status: existing.status || "Draft",
    };
  });
}

function normalizePackRow(row) {
  return {
    ...row,
    containers: normalizePackContainers(row),
  };
}

export function loadPackScheduleRows() {
  if (typeof window === "undefined") return PACK_SCHEDULE_ROWS.map(normalizePackRow);
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return PACK_SCHEDULE_ROWS.map(normalizePackRow);
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(normalizePackRow) : PACK_SCHEDULE_ROWS.map(normalizePackRow);
  } catch {
    return PACK_SCHEDULE_ROWS.map(normalizePackRow);
  }
}

export function savePackScheduleRows(rows) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify((rows || []).map(normalizePackRow)));
}

export function nextPackId(rows) {
  return Math.max(0, ...rows.map((row) => Number(row.id) || 0)) + 1;
}
