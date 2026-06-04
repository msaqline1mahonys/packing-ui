"use client";

/**
 * localStorage CRUD for the Reports module. Two collections:
 *   - subscriptions: customer enrolments in one of the four fixed cadences
 *   - history:       record of every ad-hoc run and simulated scheduled run
 *
 * The site-wide fire time lives in its own key so the Subscriptions tab can
 * display "sends every morning at 06:00" without coupling to site-settings.
 */

const SUBSCRIPTIONS_KEY = "packing-ui-reports-subscriptions";
const HISTORY_KEY = "packing-ui-reports-history";
const FIRE_TIME_KEY = "packing-ui-reports-fire-time";
const HISTORY_MAX = 200;

function readArray(key) {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeArray(key, rows) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(rows || []));
}

function readAuthPayload() {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem("authPayload") || "{}");
  } catch {
    return {};
  }
}

export function getCurrentUserEmail() {
  const payload = readAuthPayload();
  return payload?.user?.email || "";
}

export function getTenantContext() {
  const payload = readAuthPayload();
  return {
    organizationId: payload?.organization?.id ?? null,
    siteId: payload?.current_site?.id ?? null,
    userId: payload?.user?.id ?? null,
    userEmail: payload?.user?.email ?? "",
  };
}

function newId(prefix = "id") {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/* ---------------- Subscriptions ---------------- */

export function loadSubscriptions() {
  return readArray(SUBSCRIPTIONS_KEY);
}

export function saveSubscriptions(rows) {
  writeArray(SUBSCRIPTIONS_KEY, rows);
}

export function upsertSubscription(input) {
  const rows = loadSubscriptions();
  const ctx = getTenantContext();
  const now = new Date().toISOString();
  if (input.id) {
    const next = rows.map((r) =>
      r.id === input.id ? { ...r, ...input, updatedAt: now } : r
    );
    saveSubscriptions(next);
    return next.find((r) => r.id === input.id) || null;
  }
  // Resolve customerIds — accept array or legacy single customerId
  const customerIds = Array.isArray(input.customerIds) && input.customerIds.length
    ? input.customerIds
    : input.customerId != null
    ? [input.customerId]
    : [];

  const created = {
    id: newId("sub"),
    cadence: input.cadence || "daily",
    customerIds,
    commodityIds: Array.isArray(input.commodityIds) ? input.commodityIds : [],
    recipientEmails: Array.isArray(input.recipientEmails) ? input.recipientEmails : [],
    enabled: input.enabled !== false,
    organizationId: ctx.organizationId,
    siteId: ctx.siteId,
    createdAt: now,
    updatedAt: now,
    createdBy: ctx.userId,
    lastFiredAt: null,
  };
  const next = [...rows, created];
  saveSubscriptions(next);
  return created;
}

export function deleteSubscription(id) {
  saveSubscriptions(loadSubscriptions().filter((r) => r.id !== id));
}

export function setSubscriptionEnabled(id, enabled) {
  const rows = loadSubscriptions().map((r) =>
    r.id === id ? { ...r, enabled: Boolean(enabled), updatedAt: new Date().toISOString() } : r
  );
  saveSubscriptions(rows);
}

export function markSubscriptionFired(id, firedAt = new Date().toISOString()) {
  const rows = loadSubscriptions().map((r) =>
    r.id === id ? { ...r, lastFiredAt: firedAt } : r
  );
  saveSubscriptions(rows);
}

/* ---------------- History ---------------- */

export function loadHistory() {
  return readArray(HISTORY_KEY);
}

export function appendHistory(entry) {
  const ctx = getTenantContext();
  const row = {
    id: newId("run"),
    source: entry.source || "ad-hoc", // "ad-hoc" | "daily" | "weekly" | "monthly" | "yearly"
    ranAt: new Date().toISOString(),
    ranBy: ctx.userEmail || null,
    dateRange: entry.dateRange || { from: "", to: "" },
    recipients: Array.isArray(entry.recipients) ? entry.recipients : [],
    artifacts: Array.isArray(entry.artifacts) ? entry.artifacts : [],
    status: entry.status || "ok",
    notes: entry.notes || "",
    organizationId: ctx.organizationId,
    siteId: ctx.siteId,
  };
  const next = [row, ...loadHistory()].slice(0, HISTORY_MAX);
  writeArray(HISTORY_KEY, next);
  return row;
}

export function getHistoryEntry(id) {
  return loadHistory().find((r) => r.id === id) || null;
}

export function clearHistory() {
  writeArray(HISTORY_KEY, []);
}

/* ---------------- Site-wide fire time ---------------- */

const DEFAULT_FIRE_TIME = "06:00";

export function getFireTime() {
  if (typeof window === "undefined") return DEFAULT_FIRE_TIME;
  return window.localStorage.getItem(FIRE_TIME_KEY) || DEFAULT_FIRE_TIME;
}

export function setFireTime(hhmm) {
  if (typeof window === "undefined") return;
  if (!/^\d{2}:\d{2}$/.test(String(hhmm || ""))) return;
  window.localStorage.setItem(FIRE_TIME_KEY, hhmm);
}
