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

export async function fetchGridPreference(key, { signal } = {}) {
  if (!key || !getAuthToken()) return null;
  const res = await fetch(`${API_BASE_URL}/grid-preferences/${encodeKey(key)}`, {
    method: "GET",
    headers: authHeaders(),
    signal,
  });
  if (!res.ok) throw new Error(`GET grid-preferences/${key} failed: ${res.status}`);
  const json = await res.json().catch(() => null);
  const payload = json?.data ?? null;
  return {
    columnState: Array.isArray(payload?.column_state) ? payload.column_state : null,
    gridState: payload?.grid_state && typeof payload.grid_state === "object" ? payload.grid_state : null,
  };
}

async function putGridPreference(key, body, { signal } = {}) {
  if (!key || !getAuthToken()) return null;
  const res = await fetch(`${API_BASE_URL}/grid-preferences/${encodeKey(key)}`, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) throw new Error(`PUT grid-preferences/${key} failed: ${res.status}`);
  const json = await res.json().catch(() => null);
  return json?.data ?? null;
}

export function saveGridPreference(key, columnState, opts = {}) {
  return putGridPreference(key, { column_state: columnState }, opts);
}

export function saveGridState(key, gridState, opts = {}) {
  return putGridPreference(key, { grid_state: gridState }, opts);
}

export function hasAuthForGridPreferences() {
  return Boolean(getAuthToken());
}
