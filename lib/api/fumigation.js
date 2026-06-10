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

async function fumigationRequest(path = "", options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      ...getAuthHeaders(),
      ...(options.headers || {}),
    },
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || result?.success === false) {
    throw new Error(extractApiError(result, "Fumigation request failed."));
  }
  return result;
}

function parseList(result) {
  const pager = result?.data;
  return Array.isArray(pager?.data) ? pager.data : Array.isArray(pager) ? pager : [];
}

// ── Fumigants ──

export async function listFumigants(params = {}) {
  const qs = new URLSearchParams({ per_page: "500" });
  const tenant = getTenantPayload();
  if (tenant.organization_id) qs.set("organization_id", tenant.organization_id);
  if (tenant.site_id) qs.set("site_id", tenant.site_id);
  if (params.search) qs.set("search", params.search);
  const result = await fumigationRequest(`/fumigation/fumigants?${qs.toString()}`);
  return parseList(result);
}

export async function createFumigant(payload) {
  return fumigationRequest("/fumigation/fumigants", {
    method: "POST",
    body: JSON.stringify({ ...getTenantPayload(), ...payload }),
  });
}

export async function updateFumigant(id, payload) {
  return fumigationRequest(`/fumigation/fumigants/${id}`, {
    method: "PUT",
    body: JSON.stringify({ ...getTenantPayload(), ...payload }),
  });
}

export async function deleteFumigant(id) {
  return fumigationRequest(`/fumigation/fumigants/${id}`, { method: "DELETE" });
}

// ── Methodologies ──

export async function listMethodologies(params = {}) {
  const qs = new URLSearchParams({ per_page: "500" });
  const tenant = getTenantPayload();
  if (tenant.organization_id) qs.set("organization_id", tenant.organization_id);
  if (tenant.site_id) qs.set("site_id", tenant.site_id);
  if (params.search) qs.set("search", params.search);
  const result = await fumigationRequest(`/fumigation/methodologies?${qs.toString()}`);
  return parseList(result);
}

export async function createMethodology(payload) {
  return fumigationRequest("/fumigation/methodologies", {
    method: "POST",
    body: JSON.stringify({ ...getTenantPayload(), ...payload }),
  });
}

export async function updateMethodology(id, payload) {
  return fumigationRequest(`/fumigation/methodologies/${id}`, {
    method: "PUT",
    body: JSON.stringify({ ...getTenantPayload(), ...payload }),
  });
}

export async function deleteMethodology(id) {
  return fumigationRequest(`/fumigation/methodologies/${id}`, { method: "DELETE" });
}

// ── Certificate Templates ──

export async function listCertificateTemplates(params = {}) {
  const qs = new URLSearchParams({ per_page: "500" });
  const tenant = getTenantPayload();
  if (tenant.organization_id) qs.set("organization_id", tenant.organization_id);
  if (tenant.site_id) qs.set("site_id", tenant.site_id);
  if (params.search) qs.set("search", params.search);
  const result = await fumigationRequest(`/fumigation/certificate-templates?${qs.toString()}`);
  return parseList(result);
}

export async function createCertificateTemplate(payload) {
  return fumigationRequest("/fumigation/certificate-templates", {
    method: "POST",
    body: JSON.stringify({ ...getTenantPayload(), ...payload }),
  });
}

export async function updateCertificateTemplate(id, payload) {
  return fumigationRequest(`/fumigation/certificate-templates/${id}`, {
    method: "PUT",
    body: JSON.stringify({ ...getTenantPayload(), ...payload }),
  });
}

export async function deleteCertificateTemplate(id) {
  return fumigationRequest(`/fumigation/certificate-templates/${id}`, { method: "DELETE" });
}

// ── Record Templates ──

export async function listRecordTemplates(params = {}) {
  const qs = new URLSearchParams({ per_page: "500" });
  const tenant = getTenantPayload();
  if (tenant.organization_id) qs.set("organization_id", tenant.organization_id);
  if (tenant.site_id) qs.set("site_id", tenant.site_id);
  if (params.search) qs.set("search", params.search);
  const result = await fumigationRequest(`/fumigation/record-templates?${qs.toString()}`);
  return parseList(result);
}

export async function createRecordTemplate(payload) {
  return fumigationRequest("/fumigation/record-templates", {
    method: "POST",
    body: JSON.stringify({ ...getTenantPayload(), ...payload }),
  });
}

export async function updateRecordTemplate(id, payload) {
  return fumigationRequest(`/fumigation/record-templates/${id}`, {
    method: "PUT",
    body: JSON.stringify({ ...getTenantPayload(), ...payload }),
  });
}

export async function deleteRecordTemplate(id) {
  return fumigationRequest(`/fumigation/record-templates/${id}`, { method: "DELETE" });
}
