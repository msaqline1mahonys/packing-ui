import { readAuthPayload } from "@/lib/auth-session";

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

async function integrationRequest(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { ...getAuthHeaders(), ...(options.headers || {}) },
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || result?.success === false) {
    throw new Error(extractApiError(result, "Integration request failed."));
  }
  return result?.data ?? result;
}

export function getApiBaseUrl() {
  return API_BASE;
}

export function readTenantIds(siteId) {
  const authPayload = readAuthPayload() || {};
  const organizationId = authPayload.organization?.id ?? null;
  const resolvedSiteId = siteId || authPayload.current_site?.id || null;
  return { organizationId, siteId: resolvedSiteId };
}

export async function fetchIntegrationCredentials(siteId, integrationType) {
  const params = new URLSearchParams();
  if (siteId) params.set("site_id", siteId);
  if (integrationType) params.set("integration_type", integrationType);
  const query = params.toString();
  const rows = await integrationRequest(`/integrations/credentials${query ? `?${query}` : ""}`);
  return Array.isArray(rows) ? rows : [];
}

export async function createIntegrationCredential({ siteId, integrationType, label }) {
  return integrationRequest("/integrations/credentials", {
    method: "POST",
    body: JSON.stringify({
      site_id: siteId,
      integration_type: integrationType,
      label: label?.trim() || null,
    }),
  });
}

export async function disableIntegrationCredential(credentialId, siteId) {
  const params = new URLSearchParams();
  if (siteId) params.set("site_id", siteId);
  const query = params.toString();
  return integrationRequest(`/integrations/credentials/${credentialId}${query ? `?${query}` : ""}`, {
    method: "DELETE",
  });
}

export async function fetchVesselIngestRuns(siteId, { perPage = 30 } = {}) {
  const params = new URLSearchParams({ per_page: String(perPage) });
  if (siteId) params.set("site_id", siteId);
  const payload = await integrationRequest(`/reference-data/vessels/ingest/runs?${params}`);
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
}

/**
 * @param {Array<Record<string, unknown>>} runs
 */
export function summarizeVesselIngestSync(runs) {
  const sorted = [...runs].sort(
    (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
  );

  const findLatest = (predicate) => sorted.find(predicate) ?? null;

  const lastSchedule = findLatest((run) => {
    const mode = run?.report?.ingest_mode;
    return Boolean(run?.filename_vs) || mode === "schedule" || mode === "combined";
  });

  const lastRotation = findLatest((run) => {
    const mode = run?.report?.ingest_mode;
    return Boolean(run?.filename_vr) || mode === "rotation" || mode === "combined";
  });

  const lastAny = sorted[0] ?? null;

  return { lastSchedule, lastRotation, lastAny };
}
