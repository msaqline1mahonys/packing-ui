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

export { nowDatetimeLocal } from "@/lib/utils";

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
    isWriteOff: Boolean(row.is_write_off ?? row.isWriteOff),
  };
}

export function isWriteOffCustomer(c) {
  if (!c) return false;
  return Boolean(c.isWriteOff ?? c.is_write_off);
}

export function isSystemCustomer(c) {
  if (!c) return false;
  return Boolean(c.isShrink ?? c.is_shrink ?? isWriteOffCustomer(c));
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

export async function fetchWriteOffSourceCustomers() {
  const params = new URLSearchParams(getTenantQuery().replace("?", ""));
  params.set("per_page", "500");
  const data = await apiGet(`${CUSTOMERS_ENDPOINT}?${params.toString()}`);
  return unwrapList(data)
    .map(customerFromApi)
    .filter(Boolean)
    .filter((c) => !isWriteOffCustomer(c))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function fetchCustomers() {
  const params = new URLSearchParams(getTenantQuery().replace("?", ""));
  params.set("per_page", "500");
  const data = await apiGet(`${CUSTOMERS_ENDPOINT}?${params.toString()}`);
  return unwrapList(data).map(customerFromApi).filter(Boolean).filter((c) => !isSystemCustomer(c));
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

export async function fetchStockOnHand({ accountId, commodityId, locationId, accountType = "customer" }) {
  if (!accountId || !commodityId || !locationId) return 0;
  const rows = await fetchAccountBalances({
    accountId,
    commodityId,
    locationId,
  });
  return rows
    .filter((row) => (row.accountType ?? "customer") === accountType)
    .reduce((sum, row) => sum + row.quantity, 0);
}

/** Max positive transfer amount allowed for a source balance. */
export function getTransferAmountLimit(available) {
  const bal = Number(available) || 0;
  return bal < 0 ? Math.abs(bal) : Math.max(0, bal);
}

/** Whether a signed write-off amount exceeds the allowed limit for the account balance. */
export function exceedsWriteOffLimit(available, qty) {
  const amount = Number(qty) || 0;
  if (amount === 0) return true;
  const bal = Number(available) || 0;
  if (amount > 0) return amount > Math.max(0, bal) + 0.0001;
  if (bal >= -0.0001) return true;
  return Math.abs(amount) > Math.abs(bal) + 0.0001;
}

/** Error message when a write-off amount exceeds the allowed limit. */
export function writeOffLimitErrorMessage(available, qty) {
  const amount = Number(qty) || 0;
  const bal = Number(available) || 0;
  if (amount > 0) return transferLimitErrorMessage(available);
  if (bal >= -0.0001) return "A negative amount requires a negative balance on this account.";
  return `Exceeds negative balance (${bal.toFixed(3)} MT)`;
}

/** Whether a positive transfer amount exceeds the allowed limit for a source balance. */
export function exceedsTransferLimit(available, qty) {
  const amount = Number(qty) || 0;
  if (amount <= 0) return false;
  return amount > getTransferAmountLimit(available) + 0.0001;
}

/** Error message when transfer amount exceeds the allowed limit. */
export function transferLimitErrorMessage(available) {
  const bal = Number(available) || 0;
  if (bal < 0) {
    return `Exceeds negative balance (${Math.abs(bal).toFixed(2)} t)`;
  }
  return `Exceeds stock on hand (${bal.toFixed(2)} t)`;
}

/** Signed balance after relocating qty from a negative source to destination. */
export function projectedDestinationBalance(destBalance, qty, sourceBalance) {
  const amount = Number(qty) || 0;
  const source = Number(sourceBalance) || 0;
  const dest = Number(destBalance) || 0;
  if (amount <= 0) return dest;
  if (source < 0) return dest - amount;
  return dest + amount;
}

/** Default positive move amount when prefilling a holdings row. */
export function defaultMoveAmountForBalance(available) {
  const bal = Number(available) || 0;
  if (bal < 0) return String(Math.abs(bal));
  if (bal > 0) return String(bal);
  return "";
}

/** Stock on hand per location for a customer + commodity (non-zero balances only). */
export async function fetchStockByLocationForAccount({ accountId, commodityId }) {
  if (!accountId || !commodityId) return [];
  const rows = await fetchAccountBalances({ accountId, commodityId });
  const byLocation = new Map();
  for (const row of rows) {
    const qty = Number(row.quantity);
    if (!Number.isFinite(qty) || Math.abs(qty) <= 0.0001) continue;
    const locId = String(row.locationId ?? "");
    if (!locId) continue;
    const existing = byLocation.get(locId);
    if (existing) {
      existing.quantity += qty;
    } else {
      byLocation.set(locId, {
        locationId: row.locationId,
        locationName: row.locationName || "Unknown",
        quantity: qty,
      });
    }
  }
  return [...byLocation.values()].sort((a, b) => a.locationName.localeCompare(b.locationName));
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
