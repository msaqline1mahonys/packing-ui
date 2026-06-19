import { fetchPackers, fetchStockLocations, fetchUsersForSelect } from "@/lib/api/packing";
import { fetchReleases } from "@/lib/releases-api";
import { normalizeApiSiteRow } from "@/lib/site-data";

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api").replace(/\/+$/, "");

function getAuthHeaders() {
  const token = typeof window !== "undefined" ? localStorage.getItem("authToken") : null;
  return {
    Accept: "application/json",
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function extractApiError(result, fallback) {
  if (result?.errors) {
    return Object.values(result.errors).flat().join(", ");
  }
  return result?.message || fallback;
}

function unwrapList(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  return [];
}

function unwrapPager(data) {
  if (Array.isArray(data)) {
    return { rows: data, lastPage: 1 };
  }
  if (Array.isArray(data?.data)) {
    return { rows: data.data, lastPage: Number(data.last_page ?? 1) || 1 };
  }
  return { rows: [], lastPage: 1 };
}

async function referenceDataRequest(path, fallbackMessage = "Reference data request failed.") {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: getAuthHeaders(),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || result?.success === false) {
    throw new Error(extractApiError(result, fallbackMessage));
  }
  return result?.data ?? result;
}

async function referenceDataGet(path, fallbackMessage = "Reference data request failed.") {
  const data = await referenceDataRequest(path, fallbackMessage);
  return unwrapList(data);
}

async function referenceDataGetAllPages(basePath, fallbackMessage = "Reference data request failed.") {
  const all = [];
  let page = 1;
  let lastPage = 1;
  const joiner = basePath.includes("?") ? "&" : "?";

  do {
    const data = await referenceDataRequest(`${basePath}${joiner}per_page=500&page=${page}`, fallbackMessage);
    const { rows, lastPage: pagerLastPage } = unwrapPager(data);
    all.push(...rows);
    lastPage = pagerLastPage;
    page += 1;
  } while (page <= lastPage);

  return all;
}

/** Normalize a port API row into the shape used by pack form selects. */
export function normalizePortRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    code: row.code ?? "",
    name: row.name ?? "",
    countryId: row.country_id ?? row.countryId ?? row.country?.id ?? "",
    countryName: row.country?.country_name ?? row.country_name ?? row.countryName ?? "",
  };
}

export async function fetchCustomersList() {
  return referenceDataGet("/reference-data/customers?per_page=500", "Unable to load customers.");
}

export async function fetchCommoditiesList() {
  return referenceDataGet("/product-settings/commodities?per_page=500", "Unable to load commodity grades.");
}

export async function fetchCommodityTypesList() {
  return referenceDataGet("/product-settings/commodity-types?per_page=500", "Unable to load commodity types.");
}

export async function fetchShippingLinesList() {
  return referenceDataGet("/reference-data/shipping-lines?per_page=500", "Unable to load shipping lines.");
}

export async function fetchContainerCodesList() {
  return referenceDataGet("/reference-data/container-codes?per_page=500", "Unable to load container codes.");
}

export async function fetchContainerParksList() {
  return referenceDataGet("/reference-data/container-parks?per_page=500", "Unable to load container parks.");
}

export async function fetchTransportersList() {
  return referenceDataGet("/contacts/transporters?per_page=500", "Unable to load transporters.");
}

export async function fetchTerminalsList() {
  return referenceDataGet("/reference-data/terminals?per_page=500", "Unable to load terminals.");
}

export async function fetchCountriesList() {
  return referenceDataGet("/reference-data/countries?per_page=500", "Unable to load countries.");
}

export async function fetchPortsList() {
  const rows = await referenceDataGetAllPages("/reference-data/ports", "Unable to load ports.");
  return rows.map(normalizePortRow).filter((row) => row?.id);
}

export async function fetchVesselVoyagesList() {
  return referenceDataGet("/reference-data/vessel-voyages?per_page=500", "Unable to load vessel voyages.");
}

export async function fetchReleasesList() {
  return fetchReleases();
}

export async function fetchSitesList() {
  const response = await fetch(`${API_BASE}/sites?per_page=500`, {
    headers: getAuthHeaders(),
    credentials: "include",
  });
  const result = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(extractApiError(result, "Unable to load sites."));
  }
  const pager = result?.sites ?? result?.data ?? result;
  const apiRows = Array.isArray(pager?.data) ? pager.data : Array.isArray(pager) ? pager : [];
  return apiRows.map(normalizeApiSiteRow).filter(Boolean);
}

export async function fetchPemsInspectionRemarks() {
  const response = await fetch(`${API_BASE}/reference-data/pems-inspection-remarks?type=all`, {
    headers: getAuthHeaders(),
    credentials: "include",
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(extractApiError(result, "Unable to load PEMS inspection remarks."));
  }
  const output = result?.data ?? result?.output ?? result ?? {};
  return {
    ecInspectionRemarks: Array.isArray(output.ecInspectionRemarks) ? output.ecInspectionRemarks : [],
    goodsInspectionRemarks: Array.isArray(output.goodsInspectionRemarks) ? output.goodsInspectionRemarks : [],
  };
}

export { fetchUsersForSelect, fetchStockLocations, fetchPackers };
