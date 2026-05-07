"use client";

import { PACK_SCHEDULE_ROWS } from "@/lib/Data";

const STORAGE_KEY = "packing-ui-pack-schedule-rows";

export function loadPackScheduleRows() {
  if (typeof window === "undefined") return [...PACK_SCHEDULE_ROWS];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [...PACK_SCHEDULE_ROWS];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [...PACK_SCHEDULE_ROWS];
  } catch {
    return [...PACK_SCHEDULE_ROWS];
  }
}

export function savePackScheduleRows(rows) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
}

export function nextPackId(rows) {
  return Math.max(0, ...rows.map((row) => Number(row.id) || 0)) + 1;
}
