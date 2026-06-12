import { API_BASE_URL } from "@/lib/api-config";
import { fetchAccountBalances, getAuthHeaders } from "@/lib/transactions-api";

const SITES_ENDPOINT = `${API_BASE_URL}/sites`;
const STOCK_LOCATIONS_ENDPOINT = `${API_BASE_URL}/reference-data/stock-locations`;
const CUSTOMERS_ENDPOINT = `${API_BASE_URL}/reference-data/customers`;
const COMMODITIES_ENDPOINT = `${API_BASE_URL}/product-settings/commodities`;
const STOCK_TRANSFERS_ENDPOINT = `${API_BASE_URL}/stock-transfers`;

function readAuthPayload() {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem("authPayload") || "{}");
  } catch {
    return {};
  }
}

function getTenantQuery() {
  const authPayload = readAuthPayload();
  const params = new URLSearchParams();
  if (authPayload.organization?.id) params.set("organization_id", authPayload.organization.id);
  if (authPayload.current_site?.id) params.set("site_id", authPayload.current_site.id);
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

function getTenantPayload() {
  const authPayload = readAuthPayload();
  const payload = {};
  if (authPayload.organization?.id) payload.organization_id = authPayload.organization.id;
  if (authPayload.current_site?.id) payload.site_id = authPayload.current_site.id;
  return payload;
}

function extractApiError(result, fallback) {
  if (result?.errors) return Object.values(result.errors).flat().join(", ");
  return result?.message || result?.msg || fallback;
}

function unwrapList(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  return [];
}

async function apiGet(url) {
  const response = await fetch(url, { headers: getAuthHeaders() });
  const result = await response.json().catch(() => null);
  if (!response.ok || result?.success === false) {
    throw new Error(extractApiError(result, "Request failed."));
  }
  return result?.output ?? result?.data ?? result;
}

export function nowDatetimeLocal() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

export function siteFromApi(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name ?? "",
  };
}

export function stockLocationFromApi(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name ?? "",
    siteId: String(row.site_id ?? row.siteId ?? row.site?.id ?? ""),
    locationType: row.location_type ?? row.locationType ?? "",
    status: String(row.status ?? "active").toLowerCase(),
  };
}

export function customerFromApi(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name ?? "",
    code: row.code ?? "",
    isShrink: Boolean(row.is_shrink ?? row.isShrink),
  };
}

export function commodityFromApi(row) {
  if (!row) return null;
  return {
    id: row.id,
    description: row.description ?? row.name ?? "",
    commodityCode: row.commodity_code ?? row.commodityCode ?? "",
    commodityTypeId: row.commodity_type_id ?? row.commodityTypeId ?? "",
    status: row.status ?? "Active",
  };
}

export async function fetchSites() {
  const params = new URLSearchParams(getTenantQuery().replace("?", ""));
  params.set("per_page", "100");
  const data = await apiGet(`${SITES_ENDPOINT}?${params.toString()}`);
  const pager = data?.sites ?? data;
  return unwrapList(pager).map(siteFromApi).filter(Boolean);
}

export async function fetchStockLocations() {
  const params = new URLSearchParams(getTenantQuery().replace("?", ""));
  params.set("per_page", "500");
  const data = await apiGet(`${STOCK_LOCATIONS_ENDPOINT}?${params.toString()}`);
  return unwrapList(data).map(stockLocationFromApi).filter(Boolean);
}

export async function fetchCustomers() {
  const params = new URLSearchParams(getTenantQuery().replace("?", ""));
  params.set("per_page", "500");
  const data = await apiGet(`${CUSTOMERS_ENDPOINT}?${params.toString()}`);
  return unwrapList(data).map(customerFromApi).filter(Boolean);
}

export async function fetchCommodities() {
  const params = new URLSearchParams(getTenantQuery().replace("?", ""));
  params.set("per_page", "500");
  const data = await apiGet(`${COMMODITIES_ENDPOINT}?${params.toString()}`);
  return unwrapList(data)
    .map(commodityFromApi)
    .filter((c) => c && String(c.status).toLowerCase() !== "inactive");
}

export async function fetchStockTransferFormData() {
  const [sites, locations, customers, commodities] = await Promise.all([
    fetchSites(),
    fetchStockLocations(),
    fetchCustomers(),
    fetchCommodities(),
  ]);
  return { sites, locations, customers, commodities };
}

export async function fetchStockOnHand({ accountId, commodityId, locationId }) {
  if (!accountId || !commodityId || !locationId) return 0;
  const rows = await fetchAccountBalances({
    accountId,
    commodityId,
    locationId,
  });
  return rows.reduce((sum, row) => sum + row.quantity, 0);
}

export function getDefaultSiteId(sites) {
  const authPayload = readAuthPayload();
  const current = authPayload.current_site?.id ? String(authPayload.current_site.id) : "";
  if (current && sites.some((s) => String(s.id) === current)) return current;
  return sites[0]?.id ? String(sites[0].id) : "";
}

export function stockTransferFromApi(row) {
  if (!row) return null;
  return {
    id: row.id,
    reference: row.reference ?? "",
    transferType: row.transferType ?? row.transfer_type ?? "",
    transferDate: row.transferDate ?? row.transfer_date ?? "",
    status: row.status ?? "active",
    notes: row.notes ?? "",
    quantity: Number(row.quantity ?? 0),
    transactions: Array.isArray(row.transactions)
      ? row.transactions.map((t) => ({
          id: t.id,
          transactionType: t.transactionType ?? t.transaction_type ?? "",
          accountId: t.accountId ?? t.account_id ?? "",
          accountType: t.accountType ?? t.account_type ?? "customer",
          commodityId: t.commodityId ?? t.commodity_id ?? "",
          locationId: t.locationId ?? t.location_id ?? "",
          quantity: Number(t.quantity ?? 0),
        }))
      : [],
  };
}

export async function createStockTransfer({ transferType, transferDate, reference, notes, lines }) {
  const body = {
    ...getTenantPayload(),
    transferType,
    transferDate,
    ...(reference ? { reference } : {}),
    ...(notes ? { notes } : {}),
    lines,
  };
  const response = await fetch(STOCK_TRANSFERS_ENDPOINT, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(body),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || result?.success === false) {
    throw new Error(extractApiError(result, "Failed to create transfer."));
  }
  return stockTransferFromApi(result?.output ?? result?.data ?? result);
}

export async function fetchStockTransfers() {
  const data = await apiGet(`${STOCK_TRANSFERS_ENDPOINT}${getTenantQuery()}`);
  return unwrapList(data).map(stockTransferFromApi).filter(Boolean);
}

export async function fetchHoldingsAtLocation({ locationId, commodityId }) {
  if (!locationId || !commodityId) return [];
  const rows = await fetchAccountBalances({ locationId, commodityId });
  return rows
    .filter((r) => Math.abs(r.quantity) > 0.0001)
    .map((r) => ({
      accountId: r.accountId,
      accountType: r.accountType,
      accountName: r.accountName,
      available: r.quantity,
    }));
}
