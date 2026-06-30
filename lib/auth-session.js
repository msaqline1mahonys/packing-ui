const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api").replace(
  /\/+$/,
  ""
);

export const AUTH_SESSION_EXPIRED_EVENT = "auth-session-expired";

const AUTH_ROUTE_PREFIXES = ["/login", "/register", "/forgot-password", "/reset-password"];

/** True when the client has a persisted login session (flag + bearer token + user payload). */
export function isSignedIn() {
  if (typeof window === "undefined") return false;
  const token = localStorage.getItem("authToken");
  if (!token || localStorage.getItem("isAuthenticated") !== "true") return false;

  const user = readAuthPayload()?.user;
  return Boolean(user && typeof user === "object");
}

export function clearAuthSession() {
  if (typeof window === "undefined") return;
  localStorage.removeItem("isAuthenticated");
  localStorage.removeItem("authToken");
  localStorage.removeItem("authPayload");
  notifyAuthSessionChanged();
  window.dispatchEvent(new Event(AUTH_SESSION_EXPIRED_EVENT));
}

export function redirectToLogin() {
  if (typeof window === "undefined") return;
  const path = window.location.pathname;
  if (AUTH_ROUTE_PREFIXES.some((route) => path.startsWith(route))) return;
  window.location.assign("/login");
}

/** Clear session and send the user to sign-in when an API rejects the bearer token. */
export function handleUnauthorizedResponse(response) {
  if (response?.status !== 401 && response?.status !== 403) return false;
  clearAuthSession();
  redirectToLogin();
  return true;
}

/** Verify the cached bearer token with the backend; refresh authPayload on success. */
export async function validateAuthSession() {
  if (!isSignedIn()) return false;

  const token = localStorage.getItem("authToken");
  try {
    const response = await fetch(`${API_BASE}/me`, {
      headers: {
        Accept: "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      credentials: "include",
    });

    if (handleUnauthorizedResponse(response)) return false;

    if (response.ok) {
      const payload = await response.json().catch(() => null);
      if (payload && typeof payload === "object") {
        localStorage.setItem("authPayload", JSON.stringify(payload));
        notifyAuthSessionChanged();
      }
      return true;
    }

    // Transient server/network issues — keep the cached session.
    return true;
  } catch {
    return true;
  }
}

/** @returns {Record<string, unknown> | null} */
export function readAuthPayload() {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("authPayload");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function initialsFromName(name) {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

/** Map login / me API payload to ERP navbar user fields. */
export function mapAuthPayloadToNavUser(payload) {
  if (!payload) return null;
  const u = payload.user;
  if (!u || typeof u !== "object") return null;

  const email = typeof u.email === "string" ? u.email.trim() : "";
  const name =
    (typeof u.name === "string" && u.name.trim()) ||
    (email ? email.split("@")[0] : "") ||
    "User";

  if (!email && name === "User") return null;

  return {
    name,
    email,
    initials: initialsFromName(name),
    avatarSrc: u.avatar_url || u.avatarUrl || "",
    organizationName:
      (typeof payload.organization?.name === "string" && payload.organization.name) || "",
    siteName:
      (typeof payload.current_site?.name === "string" && payload.current_site.name) ||
      (typeof payload.currentSite?.name === "string" && payload.currentSite.name) ||
      "",
  };
}

export function notifyAuthSessionChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event("auth-session-changed"));
}
