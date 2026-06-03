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
  const columnState = payload?.column_state;
  return Array.isArray(columnState) ? columnState : null;
}

export async function saveGridPreference(key, columnState, { signal } = {}) {
  if (!key || !getAuthToken()) return null;
  const res = await fetch(`${API_BASE_URL}/grid-preferences/${encodeKey(key)}`, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify({ column_state: columnState }),
    signal,
  });
  if (!res.ok) throw new Error(`PUT grid-preferences/${key} failed: ${res.status}`);
  const json = await res.json().catch(() => null);
  return json?.data?.column_state ?? null;
}

export function hasAuthForGridPreferences() {
  return Boolean(getAuthToken());
}
