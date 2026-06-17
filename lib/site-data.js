export const SITE_REFERENCE_STORAGE_KEY = "packing-reference-sites";
export const SITES_UPDATED_EVENT = "packing-sites-updated";

export const DEFAULT_SITE_ROWS = [
  {
    id: "1",
    name: "Melbourne",
    yardNo: "6851",
    establishmentNumber: "6851",
    yardId: 6851,
    treatmentProviderId: "",
    addressLine1: "123 Industrial Drive",
    addressLine2: "",
    suburb: "Laverton",
    stateCode: "VIC",
    postcode: "3028",
  },
  {
    id: "2",
    name: "Sydney",
    yardNo: "1002",
    establishmentNumber: "1002",
    yardId: 1002,
    treatmentProviderId: "",
    addressLine1: "",
    addressLine2: "",
    suburb: "",
    stateCode: "NSW",
    postcode: "",
  },
  {
    id: "3",
    name: "Brisbane",
    yardNo: "1003",
    establishmentNumber: "1003",
    yardId: 1003,
    treatmentProviderId: "",
    addressLine1: "",
    addressLine2: "",
    suburb: "",
    stateCode: "QLD",
    postcode: "",
  },
];

export function normalizeSiteRows(rows) {
  if (!Array.isArray(rows)) return [];
  return rows
    .map((row) => {
      const id = String(row?.id ?? "").trim();
      const name = String(row?.name ?? "").trim();
      const yardNo = String(row?.yardNo ?? row?.establishmentNumber ?? "").trim();
      const establishmentNumber = String(row?.establishmentNumber ?? yardNo).trim();
      const yardIdRaw = row?.yardId ?? row?.yard_id;
      const yardId =
        yardIdRaw === "" || yardIdRaw == null
          ? establishmentNumber
            ? Number(establishmentNumber)
            : null
          : Number(yardIdRaw);
      const treatmentProviderId = String(
        row?.treatmentProviderId ?? row?.treatment_provider_id ?? ""
      ).trim();
      if (!id || !name) return null;
      return {
        id,
        name,
        yardNo: yardNo || establishmentNumber,
        establishmentNumber,
        yardId: Number.isFinite(yardId) ? yardId : null,
        treatmentProviderId,
        addressLine1: String(row?.addressLine1 ?? "").trim(),
        addressLine2: String(row?.addressLine2 ?? "").trim(),
        suburb: String(row?.suburb ?? "").trim(),
        stateCode: String(row?.stateCode ?? "").trim(),
        postcode: String(row?.postcode ?? "").trim(),
      };
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

export function getSiteById(siteId) {
  const id = String(siteId ?? "").trim();
  return readSiteRows().find((row) => String(row.id) === id) || null;
}

/** Map a `/api/sites` row into the pack-form site shape. */
export function normalizeApiSiteRow(site) {
  if (!site) return null;
  const id = String(site.id ?? "").trim();
  const name = String(site.name ?? "").trim();
  const yardNo = String(
    site.establishment_number ?? site.establishmentNumber ?? site.yard_no ?? site.yardNo ?? ""
  ).trim();
  const establishmentNumber = String(site.establishment_number ?? site.establishmentNumber ?? yardNo).trim();
  const yardIdRaw = site.yard_id ?? site.yardId;
  const yardId =
    yardIdRaw === "" || yardIdRaw == null
      ? establishmentNumber
        ? Number(establishmentNumber)
        : null
      : Number(yardIdRaw);
  if (!id || !name) return null;
  return {
    id,
    name,
    yardNo: yardNo || establishmentNumber,
    establishmentNumber,
    yardId: Number.isFinite(yardId) ? yardId : null,
    treatmentProviderId: String(site.treatment_provider_id ?? site.treatmentProviderId ?? "").trim(),
    addressLine1: String(site.address_line1 ?? site.addressLine1 ?? "").trim(),
    addressLine2: String(site.address_line2 ?? site.addressLine2 ?? "").trim(),
    suburb: String(site.suburb ?? "").trim(),
    stateCode: String(site.state_code ?? site.stateCode ?? "").trim(),
    postcode: String(site.postcode ?? "").trim(),
  };
}
