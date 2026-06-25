import { API_BASE_URL } from "@/lib/api-config";
import { getTenantPayload } from "@/lib/api/packing";

/** Return the YYYY-MM-DD portion of any date/datetime string, or "" if empty. */
export function stripToDate(value) {
  if (!value) return "";
  const match = String(value).trim().match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : "";
}

export function formatSampleDate(value) {
  const datePart = stripToDate(value);
  if (!datePart) return "—";
  const [year, month, day] = datePart.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  if (Number.isNaN(date.getTime())) return datePart;
  return date.toLocaleDateString("en-AU");
}

export function getPackSamples(row) {
  const raw = row?.samples ?? row?.sampleEntries ?? [];
  return Array.isArray(raw) ? raw.filter(Boolean) : [];
}

export function sampleStatusBadgeClass(status) {
  switch ((status || "").toLowerCase()) {
    case "passed":
      return "bg-emerald-50 text-emerald-900 ring-1 ring-emerald-200";
    case "failed":
      return "bg-rose-50 text-rose-900 ring-1 ring-rose-200";
    case "sent":
      return "bg-sky-50 text-sky-900 ring-1 ring-sky-200";
    default:
      return "bg-amber-50 text-amber-900 ring-1 ring-amber-200";
  }
}

export function formatPackSampleSummary(sample) {
  if (!sample) return "";
  const parts = [sample.type, sample.status];
  if (sample.sampleLocation) parts.push(sample.sampleLocation);
  return parts.filter(Boolean).join(" · ");
}

export function formatPackSampleTooltip(sample) {
  if (!sample) return "";
  const parts = [formatPackSampleSummary(sample)];
  if (sample.sampleSentDate) parts.push(`Sent ${formatSampleDate(sample.sampleSentDate)}`);
  if (sample.trackingDetail) parts.push(sample.trackingDetail);
  if (sample.notes) parts.push(sample.notes);
  return parts.join(" | ");
}

function getAuthHeaders({ json = true } = {}) {
  const token = typeof window !== "undefined" ? localStorage.getItem("authToken") : null;
  return {
    Accept: "application/json",
    ...(json ? { "Content-Type": "application/json" } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function buildTenantQuery(extra = {}) {
  const tenant = getTenantPayload();
  const params = new URLSearchParams();
  if (tenant.organization_id) params.set("organization_id", tenant.organization_id);
  if (tenant.site_id) params.set("site_id", tenant.site_id);
  for (const [key, value] of Object.entries(extra)) {
    if (value == null || value === "") continue;
    if (Array.isArray(value)) {
      value.forEach((item) => params.append(`${key}[]`, String(item)));
    } else {
      params.set(key, String(value));
    }
  }
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

function extractApiError(result, fallback) {
  if (result?.errors) return Object.values(result.errors).flat().join(", ");
  return result?.message || result?.msg || fallback;
}

async function sampleRequest(path = "", options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      ...getAuthHeaders({ json: !options.body || !(options.body instanceof FormData) }),
      ...(options.headers || {}),
    },
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || result?.success === false) {
    throw new Error(extractApiError(result, "Sample request failed."));
  }
  return result?.output ?? result?.data ?? result;
}

export function packSampleFromApi(raw) {
  if (!raw) return null;
  const pack = raw.pack ?? {};
  const customer = pack.customer ?? {};
  const commodity = pack.commodity ?? {};
  const commodityType = pack.commodity_type ?? pack.commodityType ?? {};
  return {
    id: raw.id,
    packId: raw.pack_id ?? raw.packId ?? pack.id ?? null,
    type: raw.type ?? "Pre",
    sampleLocation: raw.sample_location ?? raw.sampleLocation ?? "",
    sampleSentDate: stripToDate(raw.sample_sent_date ?? raw.sampleSentDate),
    requestedDate: stripToDate(raw.requested_date ?? raw.requestedDate ?? raw.created_at ?? raw.createdAt),
    createdAt: raw.created_at ?? raw.createdAt ?? "",
    status: raw.status ?? "Pending",
    notes: raw.notes ?? "",
    trackingDetail: raw.tracking_detail ?? raw.trackingDetail ?? "",
    resultFileName: raw.result_file_name ?? raw.resultFileName ?? "",
    resultFileUrl: raw.result_file_url ?? raw.resultFileUrl ?? "",
    resultFileMime: raw.result_file_mime ?? raw.resultFileMime ?? "",
    resultFileSize: raw.result_file_size ?? raw.resultFileSize ?? null,
    jobReference: pack.job_reference ?? pack.jobReference ?? "",
    packStatus: pack.status ?? "",
    packDate: pack.date ?? "",
    customerName: customer.name ?? "",
    commodityName: commodity.description ?? commodity.name ?? "",
    commodityTypeName: commodityType.name ?? "",
  };
}

export async function fetchPackSamples(filters = {}) {
  const data = await sampleRequest(`/packing/samples${buildTenantQuery(filters)}`);
  const rows = Array.isArray(data) ? data : [];
  return rows.map(packSampleFromApi).filter(Boolean);
}

export async function updatePackSample(sampleId, payload) {
  const data = await sampleRequest(`/packing/samples/${sampleId}${buildTenantQuery()}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
  return packSampleFromApi(data);
}

export async function uploadPackSampleResult(sampleId, file) {
  const formData = new FormData();
  formData.append("file", file);
  const data = await sampleRequest(`/packing/samples/${sampleId}/result${buildTenantQuery()}`, {
    method: "POST",
    body: formData,
  });
  return packSampleFromApi(data);
}

export async function deletePackSampleResult(sampleId) {
  const data = await sampleRequest(`/packing/samples/${sampleId}/result${buildTenantQuery()}`, {
    method: "DELETE",
  });
  return packSampleFromApi(data);
}
