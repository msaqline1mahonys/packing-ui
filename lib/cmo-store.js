"use client";

const STORAGE_KEY = "packing-ui-cmo-rows";

export function loadCmoRows() {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveCmoRows(rows) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
}

export function nextCmoId(rows) {
  return Math.max(0, ...rows.map((row) => Number(row.id) || 0)) + 1;
}
