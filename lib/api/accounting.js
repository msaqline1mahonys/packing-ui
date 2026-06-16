const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api").replace(/\/+$/, "");

function readAuthPayload() {
  try {
    return JSON.parse(localStorage.getItem("authPayload") || "{}");
  } catch {
    return {};
  }
}

function getAuthHeaders() {
  const token = typeof window !== "undefined" ? localStorage.getItem("authToken") : null;
  return {
    Accept: "application/json",
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export function getTenantPayload() {
  const authPayload = readAuthPayload();
  return {
    ...(authPayload.organization?.id ? { organization_id: authPayload.organization.id } : {}),
    ...(authPayload.current_site?.id ? { site_id: authPayload.current_site.id } : {}),
  };
}

function extractApiError(result, fallback) {
  if (result?.errors) {
    return Object.values(result.errors).flat().join(", ");
  }
  return result?.message || fallback;
}

async function accountingRequest(path = "", options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      ...getAuthHeaders(),
      ...(options.headers || {}),
    },
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || result?.success === false) {
    throw new Error(extractApiError(result, "Accounting request failed."));
  }
  return result?.data ?? result;
}

// Reference lists for the pricing screens (commodity types, customers, sizes, fumigants)
export async function getPricingFormData() {
  return accountingRequest("/accounting/pricing-form-data");
}

// Pack pricing
export async function getPackPricing() {
  return accountingRequest("/accounting/pack-pricing");
}

export async function savePackPricing(payload) {
  return accountingRequest("/accounting/pack-pricing", {
    method: "PUT",
    body: JSON.stringify({ ...getTenantPayload(), ...payload }),
  });
}

// Fumigant pricing
export async function getFumigantPricing() {
  return accountingRequest("/accounting/fumigant-pricing");
}

export async function saveFumigantPricing(payload) {
  return accountingRequest("/accounting/fumigant-pricing", {
    method: "PUT",
    body: JSON.stringify({ ...getTenantPayload(), ...payload }),
  });
}

// Fees & charges (CRUD)
export async function listCharges() {
  return accountingRequest("/accounting/charges");
}

export async function createCharge(payload) {
  return accountingRequest("/accounting/charges", {
    method: "POST",
    body: JSON.stringify({ ...getTenantPayload(), ...payload }),
  });
}

export async function updateCharge(id, payload) {
  return accountingRequest(`/accounting/charges/${id}`, {
    method: "PUT",
    body: JSON.stringify({ ...getTenantPayload(), ...payload }),
  });
}

export async function deleteCharge(id) {
  return accountingRequest(`/accounting/charges/${id}`, { method: "DELETE" });
}

// Terminal prices
export async function getTerminalPrices() {
  return accountingRequest("/accounting/terminal-prices");
}

export async function saveTerminalPrices(payload) {
  return accountingRequest("/accounting/terminal-prices", {
    method: "PUT",
    body: JSON.stringify({ ...getTenantPayload(), ...payload }),
  });
}

// Empty park prices
export async function getEmptyParkPrices() {
  return accountingRequest("/accounting/empty-park-prices");
}

export async function saveEmptyParkPrices(payload) {
  return accountingRequest("/accounting/empty-park-prices", {
    method: "PUT",
    body: JSON.stringify({ ...getTenantPayload(), ...payload }),
  });
}

// Ready to invoice
export async function listReadyToInvoice() {
  return accountingRequest("/accounting/ready-to-invoice");
}

export async function getReadyToInvoicePack(packId) {
  return accountingRequest(`/accounting/ready-to-invoice/${encodeURIComponent(packId)}`);
}

export async function getPackCostBreakdown(packId) {
  return accountingRequest(`/accounting/pack-breakdown/${encodeURIComponent(packId)}`);
}

// Invoices
export async function listInvoices() {
  return accountingRequest("/accounting/invoices");
}

export async function getInvoice(id) {
  return accountingRequest(`/accounting/invoices/${id}`);
}

export async function createInvoice(payload) {
  return accountingRequest("/accounting/invoices", {
    method: "POST",
    body: JSON.stringify({ ...getTenantPayload(), ...payload }),
  });
}
