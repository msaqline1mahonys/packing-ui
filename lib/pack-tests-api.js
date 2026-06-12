import { API_BASE_URL } from "@/lib/api-config";
import { getAuthHeaders } from "@/lib/ticketing-api";
import { normalizePackTestRow } from "@/lib/pack-tests";

const PACK_TESTS_ENDPOINT = `${API_BASE_URL}/ticketing/pack-tests`;

function readAuthPayload() {
  try {
    return JSON.parse(localStorage.getItem("authPayload") || "{}");
  } catch {
    return {};
  }
}

function tenantQuery() {
  const authPayload = readAuthPayload();
  const params = new URLSearchParams();
  if (authPayload.organization?.id) params.set("organization_id", authPayload.organization.id);
  if (authPayload.current_site?.id) params.set("site_id", authPayload.current_site.id);
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

async function packTestsRequest(path = "", options = {}) {
  const response = await fetch(`${PACK_TESTS_ENDPOINT}${path}`, {
    ...options,
    headers: { ...getAuthHeaders(), ...(options.headers || {}) },
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || result?.success === false) {
    throw new Error(result?.message || result?.msg || "Pack tests request failed.");
  }
  return result?.output ?? result?.data ?? result;
}

export async function listPackTests(params = {}) {
  const qs = new URLSearchParams(tenantQuery().replace(/^\?/, ""));
  if (params.search) qs.set("search", params.search);
  if (params.status) qs.set("status", params.status);
  if (params.page) qs.set("page", String(params.page));
  if (params.perPage) qs.set("per_page", String(params.perPage));
  const query = qs.toString();
  const data = await packTestsRequest(query ? `?${query}` : tenantQuery());
  const items = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
  return {
    rows: items.map(normalizePackTestRow).filter(Boolean),
    pagination: data && !Array.isArray(data)
      ? {
          currentPage: data.current_page ?? 1,
          lastPage: data.last_page ?? 1,
          total: data.total ?? items.length,
        }
      : null,
  };
}

export async function updatePackTest(id, payload) {
  const raw = await packTestsRequest(`/${id}${tenantQuery()}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  return normalizePackTestRow(raw);
}
