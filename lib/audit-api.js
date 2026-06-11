import { API_BASE_URL } from "@/lib/api-config";

function getAuthHeaders() {
  const token = typeof window !== "undefined" ? localStorage.getItem("authToken") : null;
  return {
    Accept: "application/json",
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function readAuthPayload() {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem("authPayload") || "{}");
  } catch {
    return {};
  }
}

async function request(url) {
  const response = await fetch(url, {
    credentials: "include",
    headers: getAuthHeaders(),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || result?.success === false) {
    throw new Error(result?.message || result?.msg || "Audit log request failed.");
  }
  return result?.data ?? result;
}

function unwrapList(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  return [];
}

export function auditLogFromApi(row) {
  if (!row) return null;
  return {
    id: row.id,
    event: row.event ?? "updated",
    description: row.description ?? "",
    changedKeys: Array.isArray(row.changed_keys) ? row.changed_keys : [],
    oldValues: row.old_values && typeof row.old_values === "object" ? row.old_values : {},
    newValues: row.new_values && typeof row.new_values === "object" ? row.new_values : {},
    userName: row.user_name ?? row.actor?.name ?? "",
    createdAt: row.created_at ?? null,
  };
}

/**
 * Fetch change history for one record.
 *
 * @param {{ subjectType?: string, subjectId?: string, module?: string, perPage?: number }} opts
 *   subjectType accepts a short alias (pack | ticket | vessel-voyage | release).
 */
export async function fetchAuditLogs({ subjectType, subjectId, module, perPage = 50 } = {}) {
  const payload = readAuthPayload();
  const params = new URLSearchParams();
  if (payload.organization?.id) params.set("organization_id", payload.organization.id);
  if (subjectType) params.set("subject_type", subjectType);
  if (subjectId) params.set("subject_id", subjectId);
  if (module) params.set("module", module);
  params.set("per_page", String(perPage));

  const data = await request(`${API_BASE_URL}/audit-logs?${params.toString()}`);
  return unwrapList(data).map(auditLogFromApi);
}
