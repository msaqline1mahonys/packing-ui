import { API_BASE_URL } from "@/lib/api-config";

const USERS_ENDPOINT = `${API_BASE_URL}/users`;
const ROLES_ENDPOINT = `${API_BASE_URL}/users-available-roles`;

function readAuthPayload() {
  if (typeof window === "undefined") return {};
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

async function usersRequest(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { ...getAuthHeaders(), ...(options.headers || {}) },
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || result?.success === false) {
    throw new Error(extractApiError(result, "User request failed."));
  }
  return result;
}

export async function fetchApiUsers() {
  const params = new URLSearchParams(getTenantQuery().replace("?", ""));
  params.set("per_page", "500");
  const result = await usersRequest(`${USERS_ENDPOINT}?${params.toString()}`);
  const users = result?.users?.data ?? result?.users ?? result?.data ?? [];
  return Array.isArray(users) ? users : [];
}

export async function createApiUser({ name, email, password, roles, siteId }) {
  const payload = {
    name,
    email,
    password,
    roles,
  };
  if (siteId) {
    payload.site_id = siteId;
  }
  const result = await usersRequest(`${USERS_ENDPOINT}${getTenantQuery()}`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return result?.user ?? result?.data ?? result;
}

export async function updateApiUser(id, data) {
  const payload = {};
  if (data.name !== undefined) payload.name = data.name;
  if (data.email !== undefined) payload.email = data.email;
  if (data.password) payload.password = data.password;
  if (data.roles) payload.roles = data.roles;

  const result = await usersRequest(`${USERS_ENDPOINT}/${id}${getTenantQuery()}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  return result?.user ?? result?.data ?? result;
}

export async function deleteApiUser(id) {
  await usersRequest(`${USERS_ENDPOINT}/${id}${getTenantQuery()}`, { method: "DELETE" });
}

export async function fetchAvailableRoles(siteId) {
  const params = new URLSearchParams(getTenantQuery().replace("?", ""));
  if (siteId) params.set("site_id", siteId);
  const result = await usersRequest(`${ROLES_ENDPOINT}?${params.toString()}`);
  const roles = result?.roles ?? result?.data ?? [];
  return Array.isArray(roles) ? roles : [];
}
