export const DEFAULT_SEASON_OPTIONS = [
  { value: "2024-25", label: "2024-25" },
  { value: "2025-26", label: "2025-26" },
  { value: "2026-27", label: "2026-27" },
  { value: "2027-28", label: "2027-28" },
];

/** @deprecated use DEFAULT_SEASON_OPTIONS or loadSeasonOptions() */
export const SEASON_OPTIONS = DEFAULT_SEASON_OPTIONS;

const STORAGE_KEY = "packing-ui-custom-seasons";
const SEASON_PATTERN = /^\d{4}-\d{2}$/;

function readCustomSeasons() {
  if (typeof window === "undefined") return [];
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(raw) ? raw.filter((s) => typeof s === "string" && SEASON_PATTERN.test(s)) : [];
  } catch {
    return [];
  }
}

function writeCustomSeasons(seasons) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seasons));
  } catch {
    /* quota / private mode */
  }
}

export function normalizeSeasonInput(input) {
  const trimmed = String(input ?? "").trim().replace(/\//g, "-");
  if (!SEASON_PATTERN.test(trimmed)) return null;
  const startYear = Number(trimmed.slice(0, 4));
  const endSuffix = trimmed.slice(5, 7);
  const expectedEnd = String(startYear + 1).slice(-2);
  if (endSuffix !== expectedEnd) return null;
  return trimmed;
}

export function loadSeasonOptions(currentValue = "") {
  const seen = new Set();
  const options = [];

  for (const option of DEFAULT_SEASON_OPTIONS) {
    if (seen.has(option.value)) continue;
    seen.add(option.value);
    options.push(option);
  }

  for (const season of readCustomSeasons()) {
    if (seen.has(season)) continue;
    seen.add(season);
    options.push({ value: season, label: season });
  }

  const normalizedCurrent = normalizeSeasonInput(currentValue) ?? (SEASON_PATTERN.test(currentValue) ? currentValue : "");
  if (normalizedCurrent && !seen.has(normalizedCurrent)) {
    options.push({ value: normalizedCurrent, label: normalizedCurrent });
  }

  return options.sort((a, b) => a.value.localeCompare(b.value));
}

export function addCustomSeason(input) {
  const normalized = normalizeSeasonInput(input);
  if (!normalized) return null;

  const defaults = new Set(DEFAULT_SEASON_OPTIONS.map((o) => o.value));
  if (defaults.has(normalized)) return normalized;

  const custom = readCustomSeasons();
  if (!custom.includes(normalized)) {
    writeCustomSeasons([...custom, normalized].sort());
  }
  return normalized;
}
