"use client";

/**
 * Tiny permission check for the Reports module.
 *
 * Default-allow until the backend Reports module starts emitting `reports.*`
 * permission keys. Concretely: if the cached `authPayload.permissions` either
 * doesn't exist at all OR contains zero keys with the `reports.` prefix, every
 * check here passes. Once any `reports.*` key appears in the payload (i.e.
 * `LoginResponseBuilder` is wired for the module), the granular keys below
 * gate normally.
 */

const KEYS = {
  view: "reports.view",
  runAdHoc: "reports.run_ad_hoc",
  manageSubscriptions: "reports.manage_subscriptions",
};

function readPermissions() {
  if (typeof window === "undefined") return null;
  try {
    const payload = JSON.parse(window.localStorage.getItem("authPayload") || "{}");
    if (!Array.isArray(payload?.permissions)) return null;
    return payload.permissions.map((p) => String(p));
  } catch {
    return null;
  }
}

function check(key) {
  const perms = readPermissions();
  if (perms === null) return true;
  const hasAnyReportsKey = perms.some((p) => p.startsWith("reports."));
  if (!hasAnyReportsKey) return true;
  return perms.includes(key);
}

export function canViewReports() {
  return check(KEYS.view);
}

export function canRunAdHocReports() {
  return check(KEYS.runAdHoc);
}

export function canManageSubscriptions() {
  return check(KEYS.manageSubscriptions);
}

export const REPORT_PERMISSION_KEYS = KEYS;
