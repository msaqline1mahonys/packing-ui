import { API_BASE_URL } from "@/lib/api-config";

const RELEASES_ENDPOINT = `${API_BASE_URL}/reference-data/releases`;
// Public storage base for attachment download URLs (Laravel 'public' disk).
const STORAGE_BASE = API_BASE_URL.replace(/\/api\/?$/, "");

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

function getTenantPayload() {
  const payload = readAuthPayload();
  return {
    ...(payload.organization?.id ? { organization_id: payload.organization.id } : {}),
    ...(payload.current_site?.id ? { site_id: payload.current_site.id } : {}),
  };
}

function tenantQuery() {
  const params = new URLSearchParams(getTenantPayload());
  const qs = params.toString();
  return qs ? `&${qs}` : "";
}

function extractApiError(result, fallback) {
  if (result?.errors) return Object.values(result.errors).flat().join(", ");
  return result?.message || result?.msg || fallback;
}

async function request(url, options = {}) {
  const response = await fetch(url, {
    credentials: "include",
    ...options,
    headers: { ...getAuthHeaders(), ...(options.headers || {}) },
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || result?.success === false) {
    throw new Error(extractApiError(result, "Release request failed."));
  }
  return result?.data ?? result;
}

function unwrapList(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  return [];
}

// API stores datetimes; the form binds <input type="datetime-local"> which needs
// "YYYY-MM-DDTHH:mm". Treat the stored value as wall-clock (consistent with how the
// rest of the app handles ETD / cut-off) — no timezone math.
function toDateTimeLocal(value) {
  if (!value) return "";
  const s = String(value);
  const t = s.includes("T") ? s : s.replace(" ", "T");
  return t.slice(0, 16);
}

export function releaseFromApi(row) {
  if (!row) return null;

  const parks = Array.isArray(row.parks)
    ? row.parks.map((p) => ({
        containerParkId: p.container_park_id ?? p.containerParkId ?? p.container_park?.id ?? "",
        transporterIds: Array.isArray(p.transporters)
          ? p.transporters.map((t) => t.id)
          : Array.isArray(p.transporter_ids)
            ? p.transporter_ids
            : Array.isArray(p.transporterIds)
              ? p.transporterIds
              : [],
      }))
    : [];

  const attachments = Array.isArray(row.attachments)
    ? row.attachments.map((a) => ({
        id: a.id,
        name: a.name ?? "",
        size: a.size_bytes ?? a.size ?? 0,
        type: a.mime_type ?? a.type ?? "",
        url: a.path ? `${STORAGE_BASE}/storage/${a.path}` : (a.url ?? ""),
      }))
    : [];

  return {
    id: row.id,
    releaseNumber: row.release_number ?? row.releaseNumber ?? "",
    status: row.status ?? "Open",
    releaseAvailableAt: toDateTimeLocal(row.release_available_at ?? row.releaseAvailableAt),
    freeDays: row.free_days ?? row.freeDays ?? "",
    releaseExpiryAt: toDateTimeLocal(row.release_expiry_at ?? row.releaseExpiryAt),
    containerCount: row.container_count ?? row.containerCount ?? "",
    containerCodeIsoCode:
      row.container_iso_code ?? row.container_code?.iso_code ?? row.containerCodeIsoCode ?? "",
    pickupBy: toDateTimeLocal(row.pickup_by ?? row.pickupBy),
    parks: parks.length ? parks : [{ containerParkId: "", transporterIds: [] }],
    attachments,
  };
}

export function releaseToApi(draft) {
  const parks = (draft.parks || [])
    .map((p) => ({
      containerParkId: p.containerParkId || null,
      transporterIds: (p.transporterIds || []).filter((id) => id !== "" && id != null),
    }))
    .filter((p) => p.containerParkId || p.transporterIds.length);

  const attachments = (draft.attachments || [])
    .map((a) => {
      const url = typeof a.url === "string" ? a.url : "";
      const isDataUri = url.startsWith("data:");
      // Existing (already persisted) attachment — keep it by id, no re-upload.
      if (a.id && !isDataUri) {
        return { id: a.id, name: a.name };
      }
      // Newly added file — send the base64 data URI for the backend to store.
      return {
        name: a.name,
        ...(a.type ? { mime_type: a.type } : {}),
        ...(a.size ? { size_bytes: a.size } : {}),
        data: url,
      };
    })
    .filter((a) => a.id || a.data);

  return {
    ...getTenantPayload(),
    release_number: draft.releaseNumber,
    status: draft.status || "Open",
    release_available_at: draft.releaseAvailableAt || null,
    free_days: draft.freeDays === "" ? null : draft.freeDays,
    release_expiry_at: draft.releaseExpiryAt || null,
    container_count: draft.containerCount === "" ? null : draft.containerCount,
    container_iso_code: draft.containerCodeIsoCode || null,
    parks,
    attachments,
  };
}

export async function fetchReleases() {
  const data = await request(`${RELEASES_ENDPOINT}?per_page=500${tenantQuery()}`);
  return unwrapList(data).map(releaseFromApi);
}

export async function saveRelease(draft) {
  const payload = releaseToApi(draft);
  if (draft.id) {
    const data = await request(`${RELEASES_ENDPOINT}/${draft.id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
    return releaseFromApi(data);
  }
  const data = await request(RELEASES_ENDPOINT, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return releaseFromApi(data);
}

export async function deleteRelease(id) {
  await request(`${RELEASES_ENDPOINT}/${id}`, { method: "DELETE" });
}
