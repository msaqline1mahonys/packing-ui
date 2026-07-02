import { API_BASE_URL } from "@/lib/api-config";
import { getTenantPayload } from "@/lib/api/packing";

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
  return result?.message || result?.msg || fallback;
}

async function integrationSettingsRequest(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      ...getAuthHeaders(),
      ...(options.headers || {}),
    },
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || result?.success === false) {
    const err = new Error(extractApiError(result, "Integration settings request failed."));
    err.status = response.status;
    throw err;
  }
  return result?.data ?? result;
}

function buildTenantQuery(siteId) {
  const tenant = getTenantPayload();
  const params = new URLSearchParams();
  if (tenant.organization_id) params.set("organization_id", tenant.organization_id);
  if (siteId || tenant.site_id) params.set("site_id", siteId || tenant.site_id);
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export async function fetchIntegrationSettings(siteId) {
  const data = await integrationSettingsRequest(`/system-settings/integrations${buildTenantQuery(siteId)}`);
  return data?.settings_by_type ?? data?.settingsByType ?? {};
}

export async function patchIntegrationSettings(siteId, integrationType, settings) {
  const data = await integrationSettingsRequest("/system-settings/integrations", {
    method: "PATCH",
    body: JSON.stringify({
      integration_type: integrationType,
      integrationType,
      settings,
      site_id: siteId,
      ...getTenantPayload(),
    }),
  });
  return data?.settings ?? settings;
}
