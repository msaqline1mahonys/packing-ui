"use client";

/**
 * Tiny permission check for the Reports module.
 *
 * Default-allow until the backend Reports module starts emitting `reports.*`
 * permission keys. Once any `reports.*` key appears, `reports.view` gates
 * page access; granular run/manage keys gate their tabs when explicitly
 * assigned. If only `reports.view` is present (current backend seeder), all
 * tabs are available.
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
  const reportsPerms = perms.filter((p) => p.startsWith("reports."));
  if (reportsPerms.length === 0) return true;
  if (perms.includes(key)) return true;
  // Backend currently seeds only `reports.view`. Until a role is explicitly
  // granted `reports.run_ad_hoc` or `reports.manage_subscriptions`, treat view
  // as full Reports access so the UI doesn't land on a blank tab.
  if (key !== KEYS.view && perms.includes(KEYS.view)) {
    const hasGranular =
      perms.includes(KEYS.runAdHoc) || perms.includes(KEYS.manageSubscriptions);
    if (!hasGranular) return true;
  }
  return false;
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
