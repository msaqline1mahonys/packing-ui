/** Container-centric concentration reading row (one row per container). */
export function emptyContainerReadingRow(id, containerNumber = "") {
  return {
    id,
    containerNumber: containerNumber || "",
    date: "",
    startAt: "",
    startTopGm3: "",
    startMiddleGm3: "",
    startBaseGm3: "",
    endAt: "",
    endTopGm3: "",
    endMiddleGm3: "",
    endBaseGm3: "",
    tvlAt: "",
    tvlPpm: "",
  };
}

/** True when readings use the old phase/location grid shape. */
export function isLegacyReadingRow(row) {
  if (!row || typeof row !== "object") return false;
  return "phase" in row || "location1" in row || "phaseLabel" in row;
}

/** One empty row per container number; falls back to a single blank row. */
export function defaultContainerReadings(containerNumbers = []) {
  const numbers = Array.isArray(containerNumbers)
    ? containerNumbers.map((n) => String(n ?? "").trim()).filter(Boolean)
    : [];
  if (numbers.length === 0) {
    return [emptyContainerReadingRow(1)];
  }
  return numbers.map((containerNumber, i) => emptyContainerReadingRow(i + 1, containerNumber));
}

/**
 * Replace legacy phase-based readings with container rows.
 * Preserves container numbers from existing new-format rows when present.
 */
export function migrateLegacyReadings(readings, containerNumbers = []) {
  if (!Array.isArray(readings) || readings.length === 0) {
    return defaultContainerReadings(containerNumbers);
  }
  if (!readings.some(isLegacyReadingRow)) {
    return readings;
  }
  return defaultContainerReadings(containerNumbers);
}

/** (Highest − Lowest) / Lowest × 100 — returns "" when not calculable. */
export function calcEquilibriumPercent(top, middle, base) {
  const values = [top, middle, base]
    .map((v) => (v == null || String(v).trim() === "" ? NaN : Number(v)))
    .filter((n) => !Number.isNaN(n));
  if (values.length < 2) return "";
  const highest = Math.max(...values);
  const lowest = Math.min(...values);
  if (lowest === 0) return "";
  const pct = ((highest - lowest) / lowest) * 100;
  return Number.isFinite(pct) ? pct.toFixed(1) : "";
}

/** True when a row has any reading data beyond container number. */
function rowHasReadingData(row) {
  if (!row || typeof row !== "object") return false;
  const keys = [
    "date", "startAt", "startTopGm3", "startMiddleGm3", "startBaseGm3",
    "endAt", "endTopGm3", "endMiddleGm3", "endBaseGm3", "tvlAt", "tvlPpm",
  ];
  return keys.some((key) => String(row[key] ?? "").trim() !== "");
}

/**
 * Pre-fill concentration reading rows from pack container numbers.
 * Seeds one row per container when empty; otherwise adds missing containers.
 */
export function prefillReadingsFromPack(readings, containerNumbers = []) {
  const numbers = Array.isArray(containerNumbers)
    ? containerNumbers.map((n) => String(n ?? "").trim()).filter(Boolean)
    : [];
  if (numbers.length === 0) return Array.isArray(readings) ? readings : [];

  const existing = Array.isArray(readings) ? readings : [];
  const hasContainerNumbers = existing.some((r) => String(r.containerNumber ?? "").trim());
  const hasReadingData = existing.some(rowHasReadingData);

  if (!hasContainerNumbers && !hasReadingData) {
    return defaultContainerReadings(numbers);
  }
  return syncReadingsWithContainers(existing, numbers);
}

/** Add rows for pack containers not already present in the grid. */
export function syncReadingsWithContainers(readings, containerNumbers = []) {
  const numbers = Array.isArray(containerNumbers)
    ? containerNumbers.map((n) => String(n ?? "").trim()).filter(Boolean)
    : [];
  const existing = Array.isArray(readings) ? readings : [];
  if (numbers.length === 0) return existing;

  const present = new Set(existing.map((r) => String(r.containerNumber ?? "").trim()).filter(Boolean));
  const nextId = Math.max(0, ...existing.map((r) => Number(r.id) || 0));
  const additions = numbers
    .filter((n) => !present.has(n))
    .map((containerNumber, i) => emptyContainerReadingRow(nextId + i + 1, containerNumber));

  return additions.length > 0 ? [...existing, ...additions] : existing;
}

export const CONCENTRATION_READING_COLUMNS = [
  { key: "containerNumber", label: "Container number", group: "meta" },
  { key: "date", label: "Date", group: "meta" },
  { key: "startAt", label: "Start concentration reading time", group: "start" },
  { key: "startTopGm3", label: "Top (g/m³)", group: "start" },
  { key: "startMiddleGm3", label: "Middle (g/m³)", group: "start" },
  { key: "startBaseGm3", label: "Base (g/m³)", group: "start" },
  { key: "endAt", label: "End concentration reading time", group: "end" },
  { key: "endTopGm3", label: "Top (g/m³)", group: "end" },
  { key: "endMiddleGm3", label: "Middle (g/m³)", group: "end" },
  { key: "endBaseGm3", label: "Base (g/m³)", group: "end" },
  { key: "tvlAt", label: "TVL reading time", group: "tvl" },
  { key: "tvlPpm", label: "TVL (ppm)", group: "tvl" },
];
