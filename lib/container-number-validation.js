/**
 * Container and seal number format validation (ISO 6346-style container numbers).
 * Empty values are allowed — validation runs when the user has entered something.
 */

/** 4 owner/equipment letters + 7 digits (ISO 6346). */
export const CONTAINER_NUMBER_REGEX = /^[A-Z]{4}\d{7}$/;

/** 1–15 alphanumeric characters; hyphens allowed between characters. */
export const SEAL_NUMBER_REGEX = /^[A-Z0-9](?:[A-Z0-9-]*[A-Z0-9])?$/;

const CONTAINER_NUMBER_MAX_LENGTH = 11;
const SEAL_NUMBER_MAX_LENGTH = 15;

export function normalizeContainerNumber(value) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[\s-]/g, "");
}

export function normalizeSealNumber(value) {
  return String(value ?? "").trim().toUpperCase();
}

/** Restrict keystrokes to valid container-number characters while typing. */
export function sanitizeContainerNumberInput(value) {
  return String(value ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, CONTAINER_NUMBER_MAX_LENGTH);
}

/** Restrict keystrokes to valid seal-number characters while typing. */
export function sanitizeSealNumberInput(value) {
  return String(value ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, "")
    .slice(0, SEAL_NUMBER_MAX_LENGTH);
}

export function getContainerNumberFromRecord(container) {
  return (
    container?.containerNo ??
    container?.containerNumber ??
    container?.container_no ??
    container?.container_number ??
    ""
  );
}

/** Other slots on the same pack that already use this container number. */
export function findSamePackContainerDuplicates(
  containerNumber,
  packContainers,
  { excludeContainerId, excludeOrder } = {}
) {
  const normalized = normalizeContainerNumber(containerNumber);
  if (!normalized || normalized.length !== 11) return [];

  const excludeId = excludeContainerId != null ? String(excludeContainerId) : "";
  const excludeOrderNum =
    excludeOrder != null && Number.isFinite(Number(excludeOrder)) ? Number(excludeOrder) : null;

  return (packContainers ?? [])
    .filter((row) => {
      if (!row) return false;

      const rowId = String(row.id ?? "");
      if (excludeId && rowId && rowId === excludeId) return false;

      const rowOrder = row.order != null ? Number(row.order) : null;
      if (excludeOrderNum != null && rowOrder === excludeOrderNum) return false;

      return normalizeContainerNumber(getContainerNumberFromRecord(row)) === normalized;
    })
    .map((row) => ({
      containerId: row.id,
      order: row.order,
    }));
}

export function getSealNumberFromRecord(container) {
  return (
    container?.sealNo ??
    container?.sealNumber ??
    container?.seal_no ??
    container?.seal_number ??
    ""
  );
}

/** Other slots on the same pack that already use this seal number. */
export function findSamePackSealDuplicates(
  sealNumber,
  packContainers,
  { excludeContainerId, excludeOrder } = {}
) {
  const normalized = normalizeSealNumber(sealNumber);
  if (!normalized) return [];

  const excludeId = excludeContainerId != null ? String(excludeContainerId) : "";
  const excludeOrderNum =
    excludeOrder != null && Number.isFinite(Number(excludeOrder)) ? Number(excludeOrder) : null;

  return (packContainers ?? [])
    .filter((row) => {
      if (!row) return false;

      const rowId = String(row.id ?? "");
      if (excludeId && rowId && rowId === excludeId) return false;

      const rowOrder = row.order != null ? Number(row.order) : null;
      if (excludeOrderNum != null && rowOrder === excludeOrderNum) return false;

      return normalizeSealNumber(getSealNumberFromRecord(row)) === normalized;
    })
    .map((row) => ({
      containerId: row.id,
      order: row.order,
    }));
}

/** Returns an error message, or null when empty/valid. */
export function validateContainerNumber(value) {
  const normalized = normalizeContainerNumber(value);
  if (!normalized) return null;

  if (!CONTAINER_NUMBER_REGEX.test(normalized)) {
    return "Container number must be 4 letters followed by 7 digits (e.g. MSKU1234567).";
  }

  const equipmentCategory = normalized[3];
  if (!["U", "J", "Z"].includes(equipmentCategory)) {
    return "The 4th character must be U, J, or Z (ISO 6346 freight container).";
  }

  return null;
}

/** Returns an error message, or null when empty/valid. */
export function validateSealNumber(value) {
  const normalized = normalizeSealNumber(value);
  if (!normalized) return null;

  if (normalized.length > SEAL_NUMBER_MAX_LENGTH) {
    return `Seal number must be ${SEAL_NUMBER_MAX_LENGTH} characters or fewer.`;
  }

  if (!SEAL_NUMBER_REGEX.test(normalized)) {
    return "Seal number must use only letters, digits, and hyphens (e.g. SL12345 or SL-90001).";
  }

  return null;
}

export function formatContainerSealValidationError(container) {
  const containerError = validateContainerNumber(getContainerNumberFromRecord(container));
  if (containerError) return containerError;

  const sealError = validateSealNumber(getSealNumberFromRecord(container));
  if (sealError) return sealError;

  return null;
}
