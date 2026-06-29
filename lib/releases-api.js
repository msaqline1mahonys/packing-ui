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

/** Normalize park × transporter rows from API or form state. */
export function normalizeReleaseParks(parks) {
  return (Array.isArray(parks) ? parks : [])
    .map((p) => {
      const containerParkId =
        p.container_park_id ??
        p.containerParkId ??
        p.container_park?.id ??
        p.containerPark?.id ??
        "";
      const transporterIds = Array.isArray(p.transporters)
        ? p.transporters.map((t) => t?.id ?? t).filter(Boolean)
        : Array.isArray(p.transporter_ids)
          ? p.transporter_ids.filter(Boolean)
          : Array.isArray(p.transporterIds)
            ? p.transporterIds.filter(Boolean)
            : [];
      const transporters = Array.isArray(p.transporters)
        ? p.transporters.map((t) => ({ id: t?.id ?? t, name: t?.name ?? "" })).filter((t) => t.id)
        : transporterIds.map((id) => ({ id, name: "" }));
      return {
        containerParkId,
        containerParkName:
          p.container_park?.name ?? p.containerPark?.name ?? p.containerParkName ?? "",
        transporterIds,
        transporters,
      };
    })
    .filter((p) => p.containerParkId);
}

function pickReleaseParks(localRaw, catalogRaw) {
  const local = normalizeReleaseParks(localRaw);
  const catalog = normalizeReleaseParks(catalogRaw);
  const localIncomplete = local.length === 0 || local.some((p) => !p.containerParkId);
  if (catalog.length && localIncomplete) return catalog;
  return local.length ? local : catalog;
}

/**
 * Merge parks / cap / status from the reference-data catalog when a pack-linked
 * release row only carries release_id + number (common after pack API reads).
 */
export function enrichReleaseFromCatalog(release, catalog = []) {
  if (!release) return null;

  const releaseId = release.releaseId ?? release.release_id ?? release.id ?? null;
  const releaseNumber = String(
    release.releaseNumber ??
      release.release_number ??
      release.releaseRef ??
      release.release_ref ??
      ""
  ).trim();

  const list = Array.isArray(catalog) ? catalog : [];
  const match = list.find(
    (r) =>
      (releaseId && String(r.id ?? r.releaseId) === String(releaseId)) ||
      (releaseNumber &&
        String(r.releaseNumber ?? r.release_number ?? "").trim() === releaseNumber)
  );

  const parks = pickReleaseParks(release.parks, match?.parks);

  return {
    ...release,
    id: release.packReleaseId ?? release.id ?? releaseId ?? match?.id ?? null,
    releaseId: releaseId ?? match?.id ?? null,
    releaseNumber: releaseNumber || match?.releaseNumber || match?.release_number || "",
    releaseRef: releaseNumber || match?.releaseNumber || match?.release_number || "",
    containerCount:
      release.containerCount ??
      release.container_count ??
      match?.containerCount ??
      match?.container_count ??
      null,
    status: release.status ?? match?.status ?? "",
    parks,
  };
}

export function releaseFromApi(row) {
  if (!row) return null;

  const parks = normalizeReleaseParks(row.parks);

  const attachments = Array.isArray(row.attachments)
    ? row.attachments.map((a) => ({
        id: a.id,
        name: a.name ?? "",
        size: a.size_bytes ?? a.size ?? 0,
        type: a.mime_type ?? a.type ?? "",
        url: a.path ? `${STORAGE_BASE}/storage/${a.path}` : (a.url ?? ""),
      }))
    : [];

  const usage = row.usage
    ? {
        pickedUpTotal: row.usage.picked_up_total ?? row.usage.pickedUpTotal ?? 0,
        remainingTotal: row.usage.remaining_total ?? row.usage.remainingTotal ?? null,
        byCombo: Array.isArray(row.usage.by_combo ?? row.usage.byCombo)
          ? (row.usage.by_combo ?? row.usage.byCombo).map((c) => ({
              containerParkId: c.container_park_id ?? c.containerParkId ?? null,
              transporterId: c.transporter_id ?? c.transporterId ?? null,
              pickedUp: c.picked_up ?? c.pickedUp ?? 0,
            }))
          : [],
      }
    : null;

  return {
    id: row.id,
    releaseNumber: row.release_number ?? row.releaseNumber ?? "",
    status: row.status ?? "Open",
    releaseAvailableAt: toDateTimeLocal(row.release_available_at ?? row.releaseAvailableAt),
    freeDays: row.free_days ?? row.freeDays ?? "",
    dehireByAt: toDateTimeLocal(row.dehire_by_at ?? row.dehireByAt),
    containerCount: row.container_count ?? row.containerCount ?? "",
    containerCodeIsoCode:
      row.container_iso_code ?? row.container_code?.iso_code ?? row.containerCodeIsoCode ?? "",
    releaseExpiryAt: toDateTimeLocal(row.release_expiry_at ?? row.releaseExpiryAt),
    parks: parks.length ? parks : [],
    attachments,
    usage,
  };
}

/** Flatten parks × transporters into selectable logistics combos. */
export function getValidCombos(release) {
  if (!release) return [];
  const parks = normalizeReleaseParks(release.parks);
  const combos = [];

  for (const park of parks) {
    const parkId = park.containerParkId ?? park.container_park_id ?? "";
    if (!parkId) continue;
    const transporterIds = Array.isArray(park.transporterIds)
      ? park.transporterIds.filter(Boolean)
      : Array.isArray(park.transporters)
        ? park.transporters.map((t) => t?.id ?? t).filter(Boolean)
        : [];

    if (!transporterIds.length) {
      combos.push({
        releaseId: release.releaseId ?? release.id,
        releaseNumber: release.releaseNumber ?? release.release_number ?? "",
        emptyContainerParkId: parkId,
        transporterId: null,
      });
      continue;
    }

    for (const transporterId of transporterIds) {
      combos.push({
        releaseId: release.releaseId ?? release.id,
        releaseNumber: release.releaseNumber ?? release.release_number ?? "",
        emptyContainerParkId: parkId,
        transporterId,
      });
    }
  }

  return combos;
}

export async function fetchReleaseById(id) {
  if (!id) return null;
  const params = new URLSearchParams(getTenantPayload());
  const qs = params.toString();
  const suffix = qs ? `?${qs}` : "";
  const data = await request(`${RELEASES_ENDPOINT}/${id}${suffix}`);
  return releaseFromApi(data);
}

export async function fetchReleaseUsage(releaseId, { packId } = {}) {
  const params = new URLSearchParams(getTenantPayload());
  if (packId) params.set("pack_id", packId);
  const qs = params.toString();
  const suffix = qs ? `?${qs}` : "";
  const data = await request(`${RELEASES_ENDPOINT}/${releaseId}/usage${suffix}`);
  return {
    pickedUpTotal: data.picked_up_total ?? data.pickedUpTotal ?? 0,
    remainingTotal: data.remaining_total ?? data.remainingTotal ?? null,
    byCombo: Array.isArray(data.by_combo ?? data.byCombo)
      ? (data.by_combo ?? data.byCombo).map((c) => ({
          containerParkId: c.container_park_id ?? c.containerParkId ?? null,
          transporterId: c.transporter_id ?? c.transporterId ?? null,
          pickedUp: c.picked_up ?? c.pickedUp ?? 0,
        }))
      : [],
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
    dehire_by_at: draft.dehireByAt || null,
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
