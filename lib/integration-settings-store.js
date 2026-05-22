import { readSiteRows } from "@/lib/site-data";
import { PEMS_BASE_URLS, PEMS_SERVICE_SUFFIXES, derivePemsServiceUrl } from "@/lib/pems/constants";

export const SYSTEM_INTEGRATION_SETTINGS_STORAGE_KEY = "packing-system-integration-settings";
export const PEMS_ORG_SETTINGS_STORAGE_KEY = "packing-pems-org-settings";
export const INTEGRATION_SETTINGS_UPDATED_EVENT = "packing-system-integration-settings-updated";
export const PEMS_ORG_SETTINGS_UPDATED_EVENT = "packing-pems-org-settings-updated";

export const INTEGRATION_TYPES = {
  PEMS: "PEMS",
  CONTAINER_CHAIN: "CONTAINER_CHAIN",
  CONTAINER_SPACE: "CONTAINER_SPACE",
  PRA: "PRA",
  SHARED: "SHARED",
};

const ALLOWED_TYPES = new Set(Object.values(INTEGRATION_TYPES));

function nowIso() {
  return new Date().toISOString();
}

function normalizeType(value) {
  const type = String(value ?? "").trim().toUpperCase();
  return ALLOWED_TYPES.has(type) ? type : null;
}

function normalizeSettings(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value;
}

function normalizeRows(rows) {
  if (!Array.isArray(rows)) return [];
  return rows
    .map((row) => {
      const id = String(row?.id ?? "").trim();
      const siteId = String(row?.site_id ?? "").trim();
      const integrationType = normalizeType(row?.integration_type);
      if (!id || !siteId || !integrationType) return null;
      return {
        id,
        site_id: siteId,
        integration_type: integrationType,
        settings: normalizeSettings(row?.settings),
        created_at: String(row?.created_at ?? "").trim() || nowIso(),
        updated_at: String(row?.updated_at ?? "").trim() || nowIso(),
      };
    })
    .filter(Boolean);
}

export function readIntegrationSettingsRows() {
  try {
    const raw = localStorage.getItem(SYSTEM_INTEGRATION_SETTINGS_STORAGE_KEY);
    if (!raw) return [];
    return normalizeRows(JSON.parse(raw));
  } catch {
    return [];
  }
}

export function saveIntegrationSettingsRows(rows) {
  const normalized = normalizeRows(rows);
  localStorage.setItem(SYSTEM_INTEGRATION_SETTINGS_STORAGE_KEY, JSON.stringify(normalized));
  window.dispatchEvent(new Event(INTEGRATION_SETTINGS_UPDATED_EVENT));
}

export function listIntegrationSettingsBySite(siteId) {
  const normalizedSiteId = String(siteId ?? "").trim();
  if (!normalizedSiteId) return [];
  return readIntegrationSettingsRows().filter((row) => row.site_id === normalizedSiteId);
}

export function readSiteIntegrationSettings(siteId) {
  const map = {};
  for (const row of listIntegrationSettingsBySite(siteId)) {
    map[row.integration_type] = { ...row.settings };
  }
  return map;
}

export function upsertIntegrationSettings(siteId, integrationType, nextSettings) {
  const normalizedSiteId = String(siteId ?? "").trim();
  const normalizedType = normalizeType(integrationType);
  if (!normalizedSiteId || !normalizedType) return;
  const safeSettings = normalizeSettings(nextSettings);

  const rows = readIntegrationSettingsRows();
  const now = nowIso();
  const index = rows.findIndex(
    (row) => row.site_id === normalizedSiteId && row.integration_type === normalizedType
  );

  if (index >= 0) {
    const row = rows[index];
    rows[index] = {
      ...row,
      settings: { ...normalizeSettings(row.settings), ...safeSettings },
      updated_at: now,
    };
  } else {
    const nextId = String(Math.max(0, ...rows.map((row) => Number(row.id) || 0)) + 1);
    rows.unshift({
      id: nextId,
      site_id: normalizedSiteId,
      integration_type: normalizedType,
      settings: { ...safeSettings },
      created_at: now,
      updated_at: now,
    });
  }

  saveIntegrationSettingsRows(rows);
}

export function ensureSiteRowsHaveIntegrationScaffold() {
  const sites = readSiteRows();
  if (!sites.length) return;
  const rows = readIntegrationSettingsRows();
  let changed = false;

  for (const site of sites) {
    const siteId = String(site?.id ?? "").trim();
    if (!siteId) continue;
    const hasShared = rows.some(
      (row) => row.site_id === siteId && row.integration_type === INTEGRATION_TYPES.SHARED
    );
    if (hasShared) continue;
    changed = true;
    const now = nowIso();
    const nextId = String(Math.max(0, ...rows.map((row) => Number(row.id) || 0)) + 1);
    rows.unshift({
      id: nextId,
      site_id: siteId,
      integration_type: INTEGRATION_TYPES.SHARED,
      settings: {},
      created_at: now,
      updated_at: now,
    });
  }

  if (changed) saveIntegrationSettingsRows(rows);
}

const DEFAULT_ORG_PEMS_SETTINGS = {
  activeEnvironment: "vendor_test",
  orgNamePrefix: "",
  clientReferenceSystem: "",
  installationUsername: "",
  installationPassword: "",
  vendorToken: "",
  baseUrl: "",
  submissionEnabled: false,
};

export function readOrgPemsSettings() {
  try {
    const raw = localStorage.getItem(PEMS_ORG_SETTINGS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_ORG_PEMS_SETTINGS };
    return { ...DEFAULT_ORG_PEMS_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_ORG_PEMS_SETTINGS };
  }
}

export function saveOrgPemsSettings(settings) {
  const next = { ...DEFAULT_ORG_PEMS_SETTINGS, ...(settings || {}) };
  localStorage.setItem(PEMS_ORG_SETTINGS_STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new Event(PEMS_ORG_SETTINGS_UPDATED_EVENT));
  return next;
}

export function derivePemsServiceUrls(baseUrl, environment) {
  const base = String(baseUrl || "").trim() || PEMS_BASE_URLS[environment] || PEMS_BASE_URLS.vendor_test;
  return {
    baseUrl: base,
    ecrUrl: derivePemsServiceUrl(base, PEMS_SERVICE_SUFFIXES.inspection),
    gppirUrl: derivePemsServiceUrl(base, PEMS_SERVICE_SUFFIXES.containerisedGoods),
    resubmissionUrl: derivePemsServiceUrl(base, PEMS_SERVICE_SUFFIXES.resubmission),
    fileAttachmentUrl: derivePemsServiceUrl(base, PEMS_SERVICE_SUFFIXES.attachment),
  };
}
