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

/**
 * Build the profile fields block (snake_case) for create/update.
 * Only includes AO fields when isAo=true and fumigator fields when isFumigator=true.
 */
function buildProfileFields({ isAo, isFumigator, profileData }) {
  const fields = {};

  // Signature is always included when provided
  if (profileData.signature !== undefined && profileData.signature !== null) {
    fields.signature = profileData.signature || null;
  }

  if (isAo) {
    fields.ao_active = true;
    if (profileData.ao_number !== undefined) fields.ao_number = profileData.ao_number || null;
    if (profileData.ao_license_number !== undefined) fields.ao_license_number = profileData.ao_license_number || null;
    if (profileData.ao_expiry !== undefined) fields.ao_expiry = profileData.ao_expiry || null;
    if (profileData.ao_pems_username !== undefined) fields.ao_pems_username = profileData.ao_pems_username || null;
    if (profileData.ao_pems_password !== undefined && profileData.ao_pems_password) {
      fields.ao_pems_password = profileData.ao_pems_password;
    }
    if (profileData.ao_token !== undefined && profileData.ao_token) {
      fields.ao_token = profileData.ao_token;
    }
  } else {
    fields.ao_active = false;
  }

  if (isFumigator) {
    if (profileData.fumigator_licence !== undefined) fields.fumigator_licence = profileData.fumigator_licence || null;
    if (profileData.fumigation_expiry !== undefined) fields.fumigation_expiry = profileData.fumigation_expiry || null;
  }

  return fields;
}

export async function createApiUser({ name, email, password, roles, classifications, siteIds, profileData, isAo, isFumigator, isActive }) {
  const payload = {
    name,
    email,
    password,
  };
  if (Array.isArray(roles) && roles.length) payload.roles = roles;
  if (Array.isArray(classifications) && classifications.length) payload.classifications = classifications;
  if (Array.isArray(siteIds) && siteIds.length) payload.site_ids = siteIds;
  if (isActive !== undefined) {
    payload.is_active = isActive;
  }
  if (profileData) {
    Object.assign(payload, buildProfileFields({ isAo: Boolean(isAo), isFumigator: Boolean(isFumigator), profileData }));
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
  if (Array.isArray(data.roles) && data.roles.length) payload.roles = data.roles;
  if (Array.isArray(data.classifications) && data.classifications.length) payload.classifications = data.classifications;
  if (Array.isArray(data.site_ids) && data.site_ids.length) payload.site_ids = data.site_ids;
  if (data.is_active !== undefined) payload.is_active = data.is_active;

  if (data.profileData) {
    Object.assign(
      payload,
      buildProfileFields({
        isAo: Boolean(data.isAo),
        isFumigator: Boolean(data.isFumigator),
        profileData: data.profileData,
      })
    );
  }

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

/** All sites in the organization (for the multi-site picker on the user form). */
export async function fetchOrgSites() {
  const result = await usersRequest(`${API_BASE_URL}/sites?per_page=500`);
  const sites = result?.sites?.data ?? result?.sites ?? result?.data ?? [];
  return Array.isArray(sites) ? sites : [];
}
