"use client";

const STORAGE_KEY = "packing-ui-releases-rows";

export const RELEASE_STATUSES = ["Open", "In-progress", "Completed", "Closed"];

export function loadReleases() {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(normalizeRelease) : [];
  } catch {
    return [];
  }
}

export function saveReleases(rows) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify((rows || []).map(normalizeRelease)));
}

export function nextReleaseId(rows) {
  return Math.max(0, ...rows.map((row) => Number(row.id) || 0)) + 1;
}

export function computeReleaseExpiry(availableAt, freeDays) {
  if (!availableAt) return "";
  const parsed = new Date(availableAt);
  if (Number.isNaN(parsed.getTime())) return "";
  const days = Number(freeDays);
  if (!Number.isFinite(days)) return "";
  parsed.setDate(parsed.getDate() + days);
  return formatDateTimeInput(parsed);
}

function formatDateTimeInput(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function normalizePark(park) {
  return {
    containerParkId: park?.containerParkId ?? "",
    transporterIds: Array.isArray(park?.transporterIds)
      ? park.transporterIds.filter((id) => id !== "" && id != null)
      : [],
  };
}

function normalizeAttachment(file) {
  if (!file) return null;
  return {
    id: file.id ?? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: file.name ?? "",
    size: file.size ?? 0,
    type: file.type ?? "",
    url: file.url ?? "",
  };
}

export function normalizeRelease(row) {
  if (!row) return row;
  const parks = Array.isArray(row.parks) ? row.parks.map(normalizePark) : [];
  const attachments = Array.isArray(row.attachments)
    ? row.attachments.map(normalizeAttachment).filter(Boolean)
    : [];
  return {
    id: row.id,
    releaseNumber: row.releaseNumber ?? "",
    status: row.status ?? "Open",
    releaseAvailableAt: row.releaseAvailableAt ?? "",
    freeDays: row.freeDays ?? "",
    releaseExpiryAt:
      row.releaseExpiryAt ?? computeReleaseExpiry(row.releaseAvailableAt, row.freeDays),
    containerCount: row.containerCount ?? "",
    containerCodeIsoCode: row.containerCodeIsoCode ?? "",
    pickupBy: row.pickupBy ?? "",
    parks: parks.length ? parks : [{ containerParkId: "", transporterIds: [] }],
    attachments,
  };
}

export function blankRelease() {
  return normalizeRelease({
    releaseNumber: "",
    status: "Open",
    releaseAvailableAt: "",
    freeDays: "",
    releaseExpiryAt: "",
    containerCount: "",
    containerCodeIsoCode: "",
    pickupBy: "",
    parks: [{ containerParkId: "", transporterIds: [] }],
    attachments: [],
  });
}
