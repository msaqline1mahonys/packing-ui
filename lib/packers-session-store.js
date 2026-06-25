"use client";

const SESSION_KEY = "packing-ui-packers-session-v1";

export function loadPackersSession() {
  if (typeof window === "undefined") return {};
  try {
    const parsed = JSON.parse(window.localStorage.getItem(SESSION_KEY) || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function getSessionPackerForPack(packId) {
  if (packId == null || packId === "") return null;
  const entry = loadPackersSession()[String(packId)];
  if (!entry || typeof entry !== "object") return null;
  const packerName = String(entry.packerName ?? entry.packer_name ?? "").trim();
  if (!packerName) return null;
  return {
    packerId: entry.packerId ?? entry.packer_id ?? null,
    packerName,
  };
}

export function setSessionPackerForPack(packId, { packerId = null, packerName = "" } = {}) {
  if (typeof window === "undefined" || packId == null || packId === "") return;
  const all = loadPackersSession();
  all[String(packId)] = {
    packerId: packerId ?? null,
    packerName: String(packerName ?? "").trim(),
  };
  window.localStorage.setItem(SESSION_KEY, JSON.stringify(all));
}
