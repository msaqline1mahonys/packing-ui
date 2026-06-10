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

async function packingRequest(path = "", options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      ...getAuthHeaders(),
      ...(options.headers || {}),
    },
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || result?.success === false) {
    throw new Error(extractApiError(result, "Packing request failed."));
  }
  return result?.data ?? result;
}

export async function listPacks(params = {}) {
  const { status, importExport, dateField, from, to, on, search, page, perPage } = params;
  const qs = new URLSearchParams();
  if (Array.isArray(status) && status.length) {
    status.forEach((s) => qs.append("status[]", s));
  } else if (typeof status === "string" && status) {
    qs.append("status[]", status);
  }
  if (importExport && importExport !== "all") qs.set("import_export", importExport);
  if (dateField) qs.set("date_field", dateField);
  if (from) qs.set("from", from);
  if (to) qs.set("to", to);
  if (on) qs.set("on", on);
  if (search) qs.set("search", search);
  if (page) qs.set("page", String(page));
  if (perPage) qs.set("per_page", String(perPage));
  const query = qs.toString();
  const data = await packingRequest(`/packing/packs${query ? `?${query}` : ""}`);
  const items = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
  const pagination = data && !Array.isArray(data) ? {
    currentPage: data.current_page ?? 1,
    lastPage: data.last_page ?? 1,
    perPage: data.per_page ?? items.length,
    total: data.total ?? items.length,
  } : null;
  return { rows: items, pagination };
}

export async function getPack(id) {
  return packingRequest(`/packing/packs/${id}`);
}

export async function createPack(payload) {
  return packingRequest("/packing/packs", {
    method: "POST",
    body: JSON.stringify({ ...getTenantPayload(), ...payload }),
  });
}

export async function updatePack(id, payload) {
  return packingRequest(`/packing/packs/${id}`, {
    method: "PUT",
    body: JSON.stringify({ ...getTenantPayload(), ...payload }),
  });
}

export async function deletePack(id) {
  return packingRequest(`/packing/packs/${id}`, { method: "DELETE" });
}

export async function getPackFormData() {
  return packingRequest("/packing/packs/form-data");
}
