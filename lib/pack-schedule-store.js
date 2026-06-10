"use client";

<<<<<<< HEAD
import { createPack, deletePack, getPack, listPacks, updatePack } from "@/lib/api/packing";

export async function fetchPackRows(params = {}) {
  return listPacks(params);
}

export async function fetchPack(id) {
  return getPack(id);
}

export async function savePack(payload) {
  if (payload.id) {
    const { id, ...rest } = payload;
    return updatePack(id, rest);
  }
  return createPack(payload);
}

export async function removePack(id) {
  return deletePack(id);
=======
import { PACK_SCHEDULE_ROWS } from "@/lib/Data";
import {
  deletePack as deletePackApi,
  fetchPack,
  fetchPacks,
  savePack as savePackApi,
} from "@/lib/pack-schedule-api";

const STORAGE_KEY = "packing-ui-pack-schedule-rows";

/** When schedule rows are loaded from localStorage, attachment arrays may be empty while seed data has demo/docs. */
const ATTACHMENT_FILE_KEYS = ["importPermitFiles", "rfpFiles", "packingInstructionFiles", "additionalDeclarationFiles"];

const PACK_ROW_TEMPLATE_BY_ID = new Map(PACK_SCHEDULE_ROWS.map((row) => [String(row.id), row]));

/** Stable fingerprint so we can refresh demo rows when seed file paths/names change in code. */
function attachmentMetaSignature(files) {
  if (!Array.isArray(files)) return "";
  return [...(files || [])]
    .map((f) => ({ id: String(f?.id ?? ""), u: String(f?.url ?? ""), n: String(f?.name ?? "") }))
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((x) => `${x.id}\t${x.u}\t${x.n}`)
    .join("\n");
}

function mergePackAttachmentFilesFromSeed(row) {
  const template = PACK_ROW_TEMPLATE_BY_ID.get(String(row.id));
  if (!template) return row;
  const packId = String(row.id);
  let next = row;
  let changed = false;
  for (const key of ATTACHMENT_FILE_KEYS) {
    const saved = row[key];
    const savedLen = Array.isArray(saved) ? saved.length : 0;
    const hasSaved = savedLen > 0;
    const seed = template[key];
    const hasSeed = Array.isArray(seed) && seed.length > 0;
    const seedLen = hasSeed ? seed.length : 0;
    const demoOnly10442 =
      packId === "10442" &&
      hasSaved &&
      saved.every((f) => typeof f === "object" && f != null && String(f.id || "").startsWith("demo-10442-"));
    const demo10442SeedUpdated =
      demoOnly10442 && hasSeed && savedLen === seedLen && attachmentMetaSignature(saved) !== attachmentMetaSignature(seed);
    const useSeed =
      hasSeed &&
      (!hasSaved || seedLen > savedLen || (demoOnly10442 && seedLen < savedLen) || demo10442SeedUpdated);
    if (useSeed) {
      if (!changed) {
        next = { ...row };
        changed = true;
      }
      next[key] = seed;
    }
  }
  if (packId === "10442" && template.status && next.status !== template.status) {
    if (!changed) next = { ...next };
    next.status = template.status;
  }
  return next;
}

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
  const merged = mergePackAttachmentFilesFromSeed(row);
  return {
    ...merged,
    containers: normalizePackContainers(merged),
  };
}

export async function loadPackScheduleRows(filters = {}) {
  try {
    const rows = await fetchPacks(filters);
    return rows.map(normalizePackRow);
  } catch {
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
}

export async function loadPackScheduleRow(id) {
  try {
    const row = await fetchPack(id);
    return normalizePackRow(row);
  } catch {
    const rows = await loadPackScheduleRows();
    return rows.find((row) => String(row.id) === String(id)) ?? null;
  }
}

export async function persistPackScheduleRow(pack) {
  const saved = await savePackApi(pack);
  return normalizePackRow(saved);
}

export async function removePackScheduleRow(id) {
  await deletePackApi(id);
}

export function savePackScheduleRows(rows) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify((rows || []).map(normalizePackRow)));
}

export function nextPackId(rows) {
  return Math.max(0, ...rows.map((row) => Number(row.id) || 0)) + 1;
>>>>>>> 2507bc838466530d30cfcfc124ea19c461d3c58f
}

export { normalizePackRow, normalizePackContainers };
