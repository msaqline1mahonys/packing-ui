import { API_BASE_URL } from "@/lib/api-config";

const PACKS_ENDPOINT = `${API_BASE_URL}/packing-schedule/packs`;

function readAuthPayload() {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem("authPayload") || "{}");
  } catch {
    return {};
  }
}

export function getAuthHeaders() {
  const token = typeof window !== "undefined" ? localStorage.getItem("authToken") : null;
  return {
    Accept: "application/json",
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function getTenantQuery(extra = {}) {
  const authPayload = readAuthPayload();
  const params = new URLSearchParams();
  if (authPayload.organization?.id) params.set("organization_id", authPayload.organization.id);
  if (authPayload.current_site?.id) params.set("site_id", authPayload.current_site.id);
  for (const [key, value] of Object.entries(extra)) {
    if (value == null || value === "") continue;
    if (Array.isArray(value)) {
      if (value.length) params.set(key, value.join(","));
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

async function packRequest(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { ...getAuthHeaders(), ...(options.headers || {}) },
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || result?.success === false) {
    throw new Error(extractApiError(result, "Packing schedule request failed."));
  }
  return result?.output ?? result?.data ?? result;
}

function unwrapPaginated(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
}

export function packFromApi(row) {
  if (!row) return null;
  return {
    ...row,
    id: row.id,
    importExport: row.importExport ?? row.import_export ?? "Export",
    customer: row.customer ?? "",
    commodity: row.commodity ?? "",
    exporter: typeof row.exporter === "string" ? row.exporter : row.exporterName ?? "-",
    status: row.status ?? "Pending",
    jobReference: row.jobReference ?? row.job_reference ?? "",
    containersRequired: Number(row.containersRequired ?? row.containers_required ?? 0),
    mtTotal: Number(row.mtTotal ?? row.mt_total ?? 0),
    containerCode: row.containerCode ?? row.container_code ?? "",
    vessel: row.vessel ?? row.vesselName ?? row.vessel_name ?? "",
    vesselName: row.vesselName ?? row.vessel_name ?? row.vessel ?? "",
    etd: row.etd ?? "",
    vesselCutoffDate: row.vesselCutoffDate ?? row.vessel_cutoff_date ?? "",
    packingStartDate: row.packingStartDate ?? row.packing_start_date ?? "",
    customerId: row.customerId ?? row.customer_id ?? "",
    exporterId: row.exporterId ?? row.exporter_id ?? "",
    commodityId: row.commodityId ?? row.commodity_id ?? "",
    commodityTypeId: row.commodityTypeId ?? row.commodity_type_id ?? "",
    siteId: row.siteId ?? row.site_id ?? "",
    releaseDetails: Array.isArray(row.releaseDetails) ? row.releaseDetails : [],
    containers: Array.isArray(row.containers) ? row.containers : [],
    sampleEntries: Array.isArray(row.sampleEntries) ? row.sampleEntries : [],
    fumigationDetail: row.fumigationDetail && typeof row.fumigationDetail === "object" ? row.fumigationDetail : {},
    pemsDraft: row.pemsDraft && typeof row.pemsDraft === "object" ? row.pemsDraft : {},
    pemsSubmissions: Array.isArray(row.pemsSubmissions) ? row.pemsSubmissions : [],
  };
}

export function packToApi(pack) {
  const { customer, commodity, exporter, exporterName, ...rest } = pack;
  return {
    ...rest,
    customerId: isUuid(pack.customerId) ? pack.customerId : null,
    commodityId: isUuid(pack.commodityId) ? pack.commodityId : null,
    commodityTypeId: isUuid(pack.commodityTypeId) ? pack.commodityTypeId : null,
    exporterId: isUuid(pack.exporterId)
      ? pack.exporterId
      : isUuid(pack.exporter)
        ? pack.exporter
        : null,
    shippingLineId: isUuid(pack.shippingLineId) ? pack.shippingLineId : null,
    terminalId: isUuid(pack.terminalId) ? pack.terminalId : null,
    vesselDepartureId: isUuid(pack.vesselDepartureId) ? pack.vesselDepartureId : null,
    id: isUuid(pack.id) ? pack.id : undefined,
  };
}

export function isUuid(value) {
  if (value == null || value === "") return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value));
}

export async function fetchPackFormData() {
  return packRequest(`${PACKS_ENDPOINT}/form-data${getTenantQuery()}`);
}

export async function fetchPacks(filters = {}) {
  const payload = await packRequest(`${PACKS_ENDPOINT}${getTenantQuery(filters)}`);
  return unwrapPaginated(payload).map(packFromApi);
}

export async function fetchPack(id) {
  const data = await packRequest(`${PACKS_ENDPOINT}/${id}${getTenantQuery()}`);
  return packFromApi(data);
}

export async function savePack(pack) {
  const payload = packToApi(pack);
  const existingId = payload.id ?? (isUuid(pack.id) ? pack.id : undefined);
  if (existingId) {
    const data = await packRequest(`${PACKS_ENDPOINT}/${existingId}${getTenantQuery()}`, {
      method: "PUT",
      body: JSON.stringify({ ...payload, id: existingId }),
    });
    return packFromApi(data);
  }
  const data = await packRequest(`${PACKS_ENDPOINT}${getTenantQuery()}`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return packFromApi(data);
}

export async function deletePack(id) {
  await packRequest(`${PACKS_ENDPOINT}/${id}${getTenantQuery()}`, {
    method: "DELETE",
    body: JSON.stringify({}),
  });
}
