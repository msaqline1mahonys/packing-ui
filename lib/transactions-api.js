const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api"
).replace(/\/+$/, "");

const TRANSACTIONS_ENDPOINT = `${API_BASE_URL}/transactions`;

function readAuthPayload() {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem("authPayload") || "{}");
  } catch {
    return {};
  }
}

export function getAuthHeaders() {
  const token = typeof window !== "undefined" ? localStorage.getItem("authToken") : null;
  return {
    Accept: "application/json",
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function getTenantQuery() {
  const authPayload = readAuthPayload();
  const params = new URLSearchParams();
  if (authPayload.organization?.id) params.set("organization_id", authPayload.organization.id);
  if (authPayload.current_site?.id) params.set("site_id", authPayload.current_site.id);
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

function extractApiError(result, fallback) {
  if (result?.errors) return Object.values(result.errors).flat().join(", ");
  return result?.message || result?.msg || fallback;
}

async function transactionsRequest(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { ...getAuthHeaders(), ...(options.headers || {}) },
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || result?.success === false) {
    throw new Error(extractApiError(result, "Transaction request failed."));
  }
  return result?.output ?? result?.data ?? result;
}

function unwrapList(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  return [];
}

export function transactionFromApi(row) {
  if (!row) return null;
  return {
    id: row.id,
    transactionDate: row.transactionDate ?? row.transaction_date ?? "",
    ticketId: row.ticketId ?? row.ticket_id ?? null,
    ticketType: row.ticketType ?? row.ticket_type ?? "",
    transactionType: row.transactionType ?? row.transaction_type ?? "",
    accountId: row.accountId ?? row.account_id ?? "",
    accountType: row.accountType ?? row.account_type ?? "customer",
    account: row.account ?? "",
    commodityId: row.commodityId ?? row.commodity_id ?? "",
    commodity: row.commodity ?? "",
    commodityTypeId: row.commodityTypeId ?? row.commodity_type_id ?? "",
    locationId: row.locationId ?? row.location_id ?? "",
    location: row.location ?? "",
    quantity: Number(row.quantity ?? 0),
    status: row.status ?? "active",
    reference: row.reference ?? "",
    notes: row.notes ?? "",
    adjustmentOf: row.adjustmentOf ?? row.adjustment_of ?? null,
  };
}

export function balanceFromApi(row) {
  if (!row) return null;
  return {
    key: row.key,
    accountId: row.accountId ?? row.account_id,
    accountName: row.accountName ?? row.account_name ?? "",
    accountType: row.accountType ?? row.account_type ?? "customer",
    commodityId: row.commodityId ?? row.commodity_id,
    commodityName: row.commodityName ?? row.commodity_name ?? "",
    locationId: row.locationId ?? row.location_id,
    locationName: row.locationName ?? row.location_name ?? "",
    quantity: Number(row.quantity ?? 0),
    unit: row.unit ?? "MT",
  };
}

export async function fetchTransactions({ ticketId, type, status, date, accountId, transactionType } = {}) {
  const params = new URLSearchParams(getTenantQuery().replace("?", ""));
  if (ticketId) params.set("ticket_id", ticketId);
  if (type) params.set("type", type);
  if (status) params.set("status", status);
  if (date) params.set("date", date);
  if (accountId) params.set("account_id", accountId);
  if (transactionType) params.set("transaction_type", transactionType);
  const qs = params.toString();
  const data = await transactionsRequest(`${TRANSACTIONS_ENDPOINT}${qs ? `?${qs}` : ""}`);
  return unwrapList(data).map(transactionFromApi);
}

export async function fetchAccountBalances({ accountId, commodityId, locationId, hideInternal } = {}) {
  const params = new URLSearchParams(getTenantQuery().replace("?", ""));
  if (accountId) params.set("account_id", accountId);
  if (commodityId) params.set("commodity_id", commodityId);
  if (locationId) params.set("location_id", locationId);
  if (hideInternal) params.set("hide_internal", "1");
  const qs = params.toString();
  const data = await transactionsRequest(`${TRANSACTIONS_ENDPOINT}/balances${qs ? `?${qs}` : ""}`);
  return unwrapList(data).map(balanceFromApi);
}

export function formatTransactionRow(t) {
  const date = t.transactionDate ? (String(t.transactionDate).includes("T") ? t.transactionDate.split("T")[0] : t.transactionDate) : "-";
  const qty = Number(t.quantity);
  return {
    ...t,
    date,
    ticketDisplay: t.ticketId ? `#${String(t.ticketId).slice(0, 8)}` : "-",
    ticketTypeDisplay: (t.ticketType || "").toUpperCase(),
    transactionTypeDisplay: t.transactionType ? t.transactionType.charAt(0).toUpperCase() + t.transactionType.slice(1) : "-",
    quantityDisplay: `${qty >= 0 ? "+" : ""}${qty.toFixed(3)}`,
    notes: t.notes || "-",
  };
}

export function computeTransactionTotals(rows, { activeOnly = false } = {}) {
  const source = activeOnly ? rows.filter((t) => t.status === "active") : rows;
  const deposits = source.filter((t) => t.quantity > 0).reduce((s, t) => s + t.quantity, 0);
  const withdrawals = source.filter((t) => t.quantity < 0 && t.transactionType === "withdrawal").reduce((s, t) => s + Math.abs(t.quantity), 0);
  const shrinkage = source
    .filter((t) => t.transactionType === "shrinkage" && t.accountType === "customer")
    .reduce((s, t) => s + Math.abs(t.quantity), 0);
  const net = source.reduce((s, t) => s + t.quantity, 0);
  return { deposits, withdrawals, shrinkage, net };
}
