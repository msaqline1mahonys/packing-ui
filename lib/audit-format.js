// Shared helpers for rendering change diffs in the notification panel and the
// history drawer. Keeps the "old → new" presentation consistent in both places.

export function formatAuditValue(value) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

export function humanizeField(key) {
  return String(key)
    .replace(/_/g, " ")
    .replace(/\./g, " › ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Notification `data.changes` shape: { field: { old, new } }.
 * @returns {{ key: string, old: unknown, new: unknown }[]}
 */
export function changesFromNotification(changes) {
  if (!changes || typeof changes !== "object") return [];
  return Object.entries(changes).map(([key, val]) => ({
    key,
    old: val?.old ?? null,
    new: val?.new ?? null,
  }));
}

/**
 * Audit log shape: separate oldValues / newValues / changedKeys.
 * @returns {{ key: string, old: unknown, new: unknown }[]}
 */
export function changesFromAuditLog(log) {
  const keys = Array.isArray(log?.changedKeys) && log.changedKeys.length
    ? log.changedKeys
    : Object.keys(log?.newValues || {});
  return keys.map((key) => ({
    key,
    old: log?.oldValues?.[key] ?? null,
    new: log?.newValues?.[key] ?? null,
  }));
}

export function relativeTime(iso) {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diff = Date.now() - then;
  const sec = Math.round(diff / 1000);
  if (sec < 60) return "just now";
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day < 7) return `${day}d ago`;
  return new Date(iso).toLocaleDateString();
}
