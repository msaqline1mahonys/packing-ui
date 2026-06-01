// Fumigation Record — sessionStorage snapshot (per-session draft state)
// and localStorage audit trail (issued copies).

const SNAP_PREFIX = "fumigation-record:";
const ISSUES_KEY = "packing-ui-fumigation-record-issues";

// ─── sessionStorage helpers (draft while editing) ────────────────────────────

export function saveFumigationRecordSnapshot(packId, snapshot) {
  if (typeof window === "undefined" || packId == null) return;
  try {
    window.sessionStorage.setItem(`${SNAP_PREFIX}${packId}`, JSON.stringify(snapshot));
  } catch { /* quota / private mode */ }
}

export function loadFumigationRecordSnapshot(packId) {
  if (typeof window === "undefined" || packId == null) return null;
  try {
    const raw = window.sessionStorage.getItem(`${SNAP_PREFIX}${packId}`);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function clearFumigationRecordSnapshot(packId) {
  if (typeof window === "undefined" || packId == null) return;
  try { window.sessionStorage.removeItem(`${SNAP_PREFIX}${packId}`); } catch { /* */ }
}

// ─── localStorage helpers (issued copies — audit trail) ──────────────────────

function readIssues() {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(ISSUES_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function writeIssues(issues) {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(ISSUES_KEY, JSON.stringify(issues)); } catch { /* */ }
}

/** Save an issued copy. Returns the issuedAt ISO string. */
export function saveRecordIssue(packId, recordModel) {
  const issuedAt = new Date().toISOString();
  let issuedBy = "Unknown";
  try {
    const payload = JSON.parse(window.localStorage.getItem("authPayload") || "{}");
    issuedBy = payload?.user?.name ?? payload?.user?.email ?? "Unknown";
  } catch { /* */ }
  const issues = readIssues();
  issues.unshift({ packId, issuedAt, issuedBy, payload: recordModel });
  writeIssues(issues);
  return issuedAt;
}

/** Returns all issues for this pack, newest first. */
export function loadRecordIssues(packId) {
  return readIssues().filter((i) => i.packId === packId);
}

/** Returns the payload of a specific issued copy, or null. */
export function loadRecordIssue(packId, issuedAt) {
  const issue = readIssues().find((i) => i.packId === packId && i.issuedAt === issuedAt);
  return issue?.payload ?? null;
}
