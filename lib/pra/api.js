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

async function praRequest(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      ...getAuthHeaders(),
      ...(options.headers || {}),
    },
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || result?.success === false) {
    const err = new Error(extractApiError(result, "PRA request failed."));
    err.status = response.status;
    throw err;
  }
  return result?.data ?? result;
}

function normalizePraContainerPatch(container = {}) {
  return {
    praSubmitted: Boolean(container.pra_submitted ?? container.praSubmitted),
    praLastStatus: container.pra_last_status ?? container.praLastStatus ?? "Pending",
    praLastSubmittedTime: container.pra_last_submitted_at ?? container.praLastSubmittedTime ?? "",
    praLastError: container.pra_last_error ?? container.praLastError ?? "",
    praTemplate: container.pra_template ?? container.praTemplate ?? "",
  };
}

export async function submitPra(packId, containerId, { praTemplate } = {}) {
  const data = await praRequest(`/packing/packs/${encodeURIComponent(packId)}/containers/${encodeURIComponent(containerId)}/pra`, {
    method: "POST",
    body: JSON.stringify({
      ...(praTemplate ? { praTemplate } : {}),
      ...getTenantPayload(),
    }),
  });
  return {
    ...data,
    containerPatch: normalizePraContainerPatch(data?.container),
  };
}

export async function cancelPra(packId, containerId) {
  const data = await praRequest(
    `/packing/packs/${encodeURIComponent(packId)}/containers/${encodeURIComponent(containerId)}/pra/cancel`,
    {
      method: "POST",
      body: JSON.stringify(getTenantPayload()),
    }
  );
  return {
    ...data,
    containerPatch: normalizePraContainerPatch(data?.container),
  };
}

export async function submitPraBulk(packId) {
  return praRequest(`/packing/packs/${encodeURIComponent(packId)}/pra`, {
    method: "POST",
    body: JSON.stringify(getTenantPayload()),
  });
}

export async function fetchPraStatus(packId, containerId) {
  return praRequest(
    `/packing/packs/${encodeURIComponent(packId)}/containers/${encodeURIComponent(containerId)}/pra`
  );
}

function unwrapPager(data) {
  if (Array.isArray(data)) {
    return { rows: data, lastPage: 1, total: data.length };
  }
  if (Array.isArray(data?.data)) {
    return {
      rows: data.data,
      lastPage: Number(data.last_page ?? 1) || 1,
      total: Number(data.total ?? data.data.length) || data.data.length,
    };
  }
  return { rows: [], lastPage: 1, total: 0 };
}

export async function fetchPraSubmissionLog({ page = 1, perPage = 25, search = "", status = "" } = {}) {
  const params = new URLSearchParams({
    page: String(page),
    per_page: String(perPage),
    ...getTenantPayload(),
  });
  if (search.trim()) params.set("search", search.trim());
  if (status.trim()) params.set("status", status.trim());

  const data = await praRequest(`/packing/pra-submissions?${params.toString()}`);
  const pager = unwrapPager(data);
  return {
    rows: pager.rows,
    page,
    lastPage: pager.lastPage,
    total: pager.total,
  };
}

export async function fetchPraSubmissionDetail(submissionId) {
  const params = new URLSearchParams(getTenantPayload());
  return praRequest(`/packing/pra-submissions/${encodeURIComponent(submissionId)}?${params.toString()}`);
}

export async function previewPraPayload(packId, containerId, { praTemplate, cancel = false } = {}) {
  const params = new URLSearchParams();
  if (praTemplate) params.set("praTemplate", praTemplate);
  if (cancel) params.set("cancel", "1");
  const qs = params.toString();
  return praRequest(
    `/packing/packs/${encodeURIComponent(packId)}/containers/${encodeURIComponent(containerId)}/pra/preview${qs ? `?${qs}` : ""}`
  );
}
