export const SITE_REFERENCE_STORAGE_KEY = "packing-reference-sites";
export const SITES_UPDATED_EVENT = "packing-sites-updated";

export const DEFAULT_SITE_ROWS = [
  { id: "1", name: "Melbourne", yardNo: "6851" },
  { id: "2", name: "Sydney", yardNo: "1002" },
  { id: "3", name: "Brisbane", yardNo: "1003" },
];

export function normalizeSiteRows(rows) {
  if (!Array.isArray(rows)) return [];
  return rows
    .map((row) => {
      const id = String(row?.id ?? "").trim();
      const name = String(row?.name ?? "").trim();
      const yardNo = String(row?.yardNo ?? "").trim();
      if (!id || !name) return null;
      return { id, name, yardNo };
    })
    .filter(Boolean);
}

export function rowsToSiteOptions(rows) {
  return normalizeSiteRows(rows).map((row) => ({
    id: row.id,
    label: row.name,
  }));
}

export const DEFAULT_SITE_OPTIONS = rowsToSiteOptions(DEFAULT_SITE_ROWS);

export function readStoredSiteRows() {
  try {
    const raw = localStorage.getItem(SITE_REFERENCE_STORAGE_KEY);
    if (!raw) return [];
    return normalizeSiteRows(JSON.parse(raw));
  } catch {
    return [];
  }
}

export function readSiteRows() {
  const stored = readStoredSiteRows();
  return stored.length ? stored : DEFAULT_SITE_ROWS;
}

export function readSiteOptions() {
  return rowsToSiteOptions(readSiteRows());
}

export function saveSiteRows(rows) {
  const normalized = normalizeSiteRows(rows);
  localStorage.setItem(SITE_REFERENCE_STORAGE_KEY, JSON.stringify(normalized));
  window.dispatchEvent(new Event(SITES_UPDATED_EVENT));
}
