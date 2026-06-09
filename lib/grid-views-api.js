import { API_BASE_URL } from "@/lib/api-config";

function getAuthToken() {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem("authToken");
  } catch {
    return null;
  }
}

function authHeaders() {
  const token = getAuthToken();
  return {
    Accept: "application/json",
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function encodeKey(key) {
  return encodeURIComponent(String(key));
}

export function hasAuthForGridViews() {
  return Boolean(getAuthToken());
}

function viewFromApi(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    snapshot: row.snapshot ?? null,
    isDefault: Boolean(row.is_default),
    isCurrent: Boolean(row.is_current),
  };
}

export async function fetchGridViews(key, { signal } = {}) {
  if (!key || !getAuthToken()) return null;
  const res = await fetch(`${API_BASE_URL}/grid-views/${encodeKey(key)}`, {
    method: "GET",
    headers: authHeaders(),
    signal,
  });
  if (!res.ok) throw new Error(`GET grid-views/${key} failed: ${res.status}`);
  const json = await res.json().catch(() => null);
  const payload = json?.data ?? {};
  const rawViews = Array.isArray(payload.views) ? payload.views : [];
  return {
    views: rawViews.map(viewFromApi),
    currentId: payload.current_id ?? null,
    defaultId: payload.default_id ?? null,
  };
}

export async function createGridView(key, { name, snapshot, isDefault = false, isCurrent = true }) {
  if (!key || !getAuthToken()) return null;
  const res = await fetch(`${API_BASE_URL}/grid-views/${encodeKey(key)}`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      name,
      snapshot,
      is_default: isDefault,
      is_current: isCurrent,
    }),
  });
  if (!res.ok) {
    const json = await res.json().catch(() => null);
    throw new Error(json?.message || `POST grid-views/${key} failed: ${res.status}`);
  }
  const json = await res.json().catch(() => null);
  return viewFromApi(json?.data ?? null);
}

export async function updateGridView(key, id, patch) {
  if (!key || !id || !getAuthToken()) return null;
  const body = {};
  if (patch.name !== undefined) body.name = patch.name;
  if (patch.snapshot !== undefined) body.snapshot = patch.snapshot;
  if (patch.isDefault !== undefined) body.is_default = patch.isDefault;
  if (patch.isCurrent !== undefined) body.is_current = patch.isCurrent;

  const res = await fetch(`${API_BASE_URL}/grid-views/${encodeKey(key)}/${encodeKey(id)}`, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const json = await res.json().catch(() => null);
    throw new Error(json?.message || `PUT grid-views/${key}/${id} failed: ${res.status}`);
  }
  const json = await res.json().catch(() => null);
  return viewFromApi(json?.data ?? null);
}

export async function deleteGridView(key, id) {
  if (!key || !id || !getAuthToken()) return null;
  const res = await fetch(`${API_BASE_URL}/grid-views/${encodeKey(key)}/${encodeKey(id)}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`DELETE grid-views/${key}/${id} failed: ${res.status}`);
  return true;
}
