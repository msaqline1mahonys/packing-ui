import { readAuthPayload, handleUnauthorizedResponse } from "@/lib/auth-session";

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api").replace(
  /\/+$/,
  ""
);

export const SITE_CHANGED_EVENT = "packing-site-changed";

function isActiveSite(site) {
  const status = String(site?.status ?? "active").toLowerCase();
  return status === "active";
}

/** Map login / me `allowed_sites` to navbar `{ id, label }` options. */
export function sitesFromAuthPayload(payload = readAuthPayload()) {
  if (!payload) return [];
  const allowed = payload.allowed_sites ?? payload.allowedSites ?? [];
  if (!Array.isArray(allowed)) return [];

  return allowed
    .filter(isActiveSite)
    .map((site) => ({
      id: String(site.id),
      label:
        (typeof site.name === "string" && site.name.trim()) ||
        (typeof site.code === "string" && site.code.trim()) ||
        `Site ${site.id}`,
    }));
}

export function currentSiteIdFromAuth(payload = readAuthPayload()) {
  const site = payload?.current_site ?? payload?.currentSite;
  return site?.id != null ? String(site.id) : "";
}

function getAuthHeaders() {
  const token = typeof window !== "undefined" ? localStorage.getItem("authToken") : null;
  return {
    Accept: "application/json",
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

/** Switch active site on the backend and refresh cached auth payload (permissions + current_site). */
export async function switchActiveSite(siteId) {
  const id = String(siteId ?? "").trim();
  if (!id) throw new Error("Site is required.");

  const switchResponse = await fetch(`${API_BASE}/user-switch/switch`, {
    method: "POST",
    headers: getAuthHeaders(),
    credentials: "include",
    body: JSON.stringify({ site_id: id }),
  });
  const switchResult = await switchResponse.json().catch(() => null);
  if (!switchResponse.ok) {
    throw new Error(switchResult?.message || "Unable to switch site.");
  }

  const meResponse = await fetch(`${API_BASE}/me`, {
    headers: getAuthHeaders(),
    credentials: "include",
  });
  if (handleUnauthorizedResponse(meResponse)) {
    throw new Error("Your session has expired. Please sign in again.");
  }
  const mePayload = await meResponse.json().catch(() => null);
  if (!meResponse.ok) {
    throw new Error(mePayload?.message || "Unable to refresh session after site switch.");
  }

  localStorage.setItem("authPayload", JSON.stringify(mePayload));
  return mePayload;
}

export function notifySiteChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(SITE_CHANGED_EVENT));
}

/** Re-fetch `/me` and update cached auth payload (e.g. after site CRUD). */
export async function refreshAuthPayload() {
  const meResponse = await fetch(`${API_BASE}/me`, {
    headers: getAuthHeaders(),
    credentials: "include",
  });
  if (handleUnauthorizedResponse(meResponse)) {
    throw new Error("Your session has expired. Please sign in again.");
  }
  const mePayload = await meResponse.json().catch(() => null);
  if (!meResponse.ok) {
    throw new Error(mePayload?.message || "Unable to refresh session.");
  }

  localStorage.setItem("authPayload", JSON.stringify(mePayload));
  return mePayload;
}
