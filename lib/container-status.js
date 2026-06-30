/**
 * Container lifecycle statuses (planning → packing → PRA → complete).
 * Butler's transporter integration will set Matched; until then Matchbox park bulk import does.
 */

export const CONTAINER_STATUS = {
  PENDING: "Pending",
  MATCHED: "Matched",
  AVAILABLE_TO_PACK: "Available to Pack",
  ECI_FAILED: "ECI Failed",
  AWAITING_APPROVAL: "Awaiting Approval",
  PRA_SUBMITTED: "PRA Submitted",
  PRA_PASSED: "PRA Passed",
  PRA_FAILED: "PRA Failed",
  COMPLETED: "Completed",
};

/** Legacy DB values mapped to the current model for display and persistence. */
export function normalizeContainerStoredStatus(status) {
  const value = String(status ?? "").trim();
  if (!value || value === "Draft") return CONTAINER_STATUS.PENDING;
  if (value === "In Progress" || value === "ECI Approved") return CONTAINER_STATUS.AVAILABLE_TO_PACK;
  return value;
}

export function isMatchedStatus(status) {
  return normalizeContainerStoredStatus(status) === CONTAINER_STATUS.MATCHED;
}

export function containerNumberFromRecord(container) {
  return String(
    container?.containerNo ?? container?.containerNumber ?? container?.container_number ?? ""
  ).trim();
}

export function isEffectivelyMatchedContainer(container) {
  if (emptyInspectionPassed(container)) return false;
  if (isMatchedStatus(container?.status)) return true;
  if (!containerNumberFromRecord(container)) return false;
  const parkId = container?.emptyContainerParkId ?? container?.empty_container_park_id;
  const releasePark =
    container?.releasePark ??
    container?.release_park ??
    container?.emptyContainerParkName ??
    container?.empty_container_park?.name ??
    "";
  return isMatchboxPark(parkId, { releasePark });
}

export function isContainerStatusProtected(container) {
  return isEffectivelyMatchedContainer(container);
}

export function emptyInspectionPassed(container) {
  return String(container?.emptyInspection ?? container?.empty_inspection ?? "Pending").toLowerCase() === "passed";
}

/** Status to persist when a container number is first assigned (bulk import or integration). */
export function statusWhenContainerNumberEntered(parkId, lookupOptions = {}) {
  return isMatchboxPark(parkId, lookupOptions)
    ? CONTAINER_STATUS.MATCHED
    : CONTAINER_STATUS.AVAILABLE_TO_PACK;
}

/**
 * Early lifecycle status (Pending → Matched / Available to Pack) before PRA workflow.
 * Matchbox imports stay Matched until empty inspection passes.
 */
export function resolveEarlyContainerStatus(container) {
  if (!containerNumberFromRecord(container)) return CONTAINER_STATUS.PENDING;
  if (isEffectivelyMatchedContainer(container)) return CONTAINER_STATUS.MATCHED;
  return CONTAINER_STATUS.AVAILABLE_TO_PACK;
}

/** Prefer server lifecycle status when refreshing packers work-store drafts. */
export function resolveSyncedContainerStatus(sourceContainer, existing) {
  const serverStatus = normalizeContainerStoredStatus(sourceContainer?.status);
  if (serverStatus) return serverStatus;
  const localStatus = normalizeContainerStoredStatus(existing?.status);
  return localStatus || CONTAINER_STATUS.PENDING;
}

/**
 * Display stage from persisted DB status; falls back to computed stage for unmigrated rows.
 * Pass `computeStage` to avoid a circular import from packers-work-store (default export).
 */
export function displayContainerStage(container, isImport = false, computeStage = null) {
  const raw = String(container?.status ?? "").trim();
  if (raw && raw !== "Draft") {
    return normalizeContainerStoredStatus(raw);
  }
  if (typeof computeStage === "function") {
    return computeStage(container, isImport);
  }
  return normalizeContainerStoredStatus(raw) || CONTAINER_STATUS.PENDING;
}

export function isMatchboxPark(parkId, { containerParkOptions = [], releasePark = "" } = {}) {
  const park = containerParkOptions.find((row) => String(row.id) === String(parkId));
  const labels = [
    park?.name,
    park?.parkName,
    park?.park_name,
    park?.code,
    park?.parkCode,
    park?.park_code,
    releasePark,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return labels.includes("matchbox") || labels.includes("matchbox exchange");
}

export function bulkImportStatusForPark(parkId, lookupOptions = {}) {
  return statusWhenContainerNumberEntered(parkId, lookupOptions);
}

export function isContainerSlotEligibleForBulkImport(container, fieldName = "containerNumber") {
  if (isContainerStatusProtected(container)) return false;
  const primary = container?.[fieldName];
  const number = String(
    primary != null && String(primary).trim()
      ? primary
      : container?.containerNumber ?? container?.containerNo ?? container?.container_number ?? ""
  ).trim();
  return !number;
}
