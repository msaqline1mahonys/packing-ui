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
