import {
  formatContainerSealValidationError,
  getSealNumberFromRecord,
} from "@/lib/container-number-validation";
import { getEcFailureRevertBlocker } from "@/lib/packers-work-store";
import { isPackersPackerSignoffBlocked } from "@/lib/packing-container-ui";

export const MAX_CONTAINER_GROSS_WEIGHT_MT = 30;

function trimField(value) {
  return String(value ?? "").trim();
}

function parseWeightLimit(value) {
  if (value === "" || value == null) return null;
  const num = Number(value);
  return Number.isFinite(num) && num > 0 ? num : null;
}

function formatWeightMt(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return String(value ?? "");
  return num.toFixed(2);
}

/** Match a container code row by ISO code (case-insensitive). */
export function resolveContainerCodeByIso(isoCode, containerCodes = []) {
  const iso = trimField(isoCode).toUpperCase();
  if (!iso || !Array.isArray(containerCodes)) return null;
  return (
    containerCodes.find((row) => trimField(row?.iso_code ?? row?.isoCode).toUpperCase() === iso) ?? null
  );
}

/** Read max gross/nett/tare limits from a container code row. */
export function getContainerCodeWeightLimits(containerCode) {
  if (!containerCode) return { maxGross: null, maxNett: null, maxTare: null };
  return {
    maxGross: parseWeightLimit(containerCode.max_gross ?? containerCode.maxGross),
    maxNett: parseWeightLimit(containerCode.max_nett ?? containerCode.maxNett),
    maxTare: parseWeightLimit(containerCode.max_tare ?? containerCode.maxTare),
  };
}

/**
 * Non-blocking warnings when entered weights exceed ISO container code limits.
 * Only returns messages when an ISO is selected and the corresponding max is set.
 */
export function getContainerWeightLimitWarnings(container, containerCodes = []) {
  if (!container) return [];

  const isoCode = trimField(container.isoCode ?? container.containerIsoCode ?? container.container_iso_code);
  if (!isoCode) return [];

  const limits = getContainerCodeWeightLimits(resolveContainerCodeByIso(isoCode, containerCodes));
  if (limits.maxGross == null && limits.maxNett == null && limits.maxTare == null) return [];

  const warnings = [];
  const tare = Number(container.tare);
  if (limits.maxTare != null && Number.isFinite(tare) && tare > limits.maxTare) {
    warnings.push(
      `Tare (${formatWeightMt(tare)} MT) exceeds max tare (${formatWeightMt(limits.maxTare)} MT) for ISO ${isoCode}.`
    );
  }

  const gross = Number(container.grossWeight ?? container.gross_weight);
  if (limits.maxGross != null && Number.isFinite(gross) && gross > limits.maxGross) {
    warnings.push(
      `Gross weight (${formatWeightMt(gross)} MT) exceeds max gross (${formatWeightMt(limits.maxGross)} MT) for ISO ${isoCode}.`
    );
  }

  const nett = Number(container.nettWeight ?? container.nett_weight);
  if (limits.maxNett != null && Number.isFinite(nett) && nett > limits.maxNett) {
    warnings.push(
      `Nett weight (${formatWeightMt(nett)} MT) exceeds max nett (${formatWeightMt(limits.maxNett)} MT) for ISO ${isoCode}.`
    );
  }

  return warnings;
}

/** Returns an error message when gross weight exceeds the limit, or null if OK. */
export function validateGrossWeight(value) {
  if (value === "" || value == null) return null;
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  if (num > MAX_CONTAINER_GROSS_WEIGHT_MT) {
    return `Gross weight cannot exceed ${MAX_CONTAINER_GROSS_WEIGHT_MT} MT.`;
  }
  return null;
}

/** Cap gross weight input so values above the limit cannot be entered. */
export function sanitizeGrossWeightInput(value) {
  if (value === "" || value == null) return value;
  const str = String(value);
  if (str === "-" || str.endsWith(".")) return str;
  const num = Number(str);
  if (!Number.isFinite(num)) return str;
  if (num > MAX_CONTAINER_GROSS_WEIGHT_MT) return String(MAX_CONTAINER_GROSS_WEIGHT_MT);
  return str;
}

function hasNettWeight(container) {
  const nett = Number(container?.nettWeight);
  return Number.isFinite(nett) && nett > 0;
}

function hasSealNumber(container) {
  return Boolean(trimField(getSealNumberFromRecord(container)));
}

/** True when packer signoff confirms out-load / in-load (outLoaded stays synced for API). */
export function isContainerLoaded(container) {
  return Boolean(trimField(container?.packerSignoff)) || container?.outLoaded === "Yes";
}

/** Seal number is required before packer signoff or out-loading. */
export function getSignoffBlockers(container) {
  if (!container || !trimField(container.packerSignoff)) return [];
  if (hasSealNumber(container)) return [];
  return ["Seal number is required before packer signoff."];
}

/** Fields required before packer signoff / out-loading / in-loading (matches backend load rules). */
export function getOutloadBlockers(container, options = {}) {
  if (!container || !isContainerLoaded(container)) return [];

  const loadVerb = options.isImport ? "in-loading" : "out-loading";
  const blockers = [];
  if (
    !options.isImport &&
    String(container?.emptyInspection ?? container?.empty_inspection ?? "").toLowerCase() === "failed"
  ) {
    blockers.push("Empty container inspection failed — this container cannot be packed out on this job.");
  }
  if (!hasSealNumber(container)) {
    blockers.push(`Seal number is required before ${loadVerb}.`);
  }
  if (!trimField(container.packerSignoff)) {
    blockers.push(`Packer signoff is required before ${loadVerb}.`);
  }
  if (!trimField(container.stockBayId)) {
    blockers.push(`Stock/Bay is required before ${loadVerb}.`);
  }
  if (!hasNettWeight(container)) {
    blockers.push(`Nett weight is required before ${loadVerb}.`);
  }
  return blockers;
}

/** Mandatory checks for Completed stage. */
export function getCompletionMissingChecks(container, options = {}) {
  if (!container) return [];

  const missing = [];
  if (!trimField(container.packerSignoff)) missing.push("Packer signoff");
  if (options.isImport) return missing;
  if (container.emptyInspection !== "Passed") missing.push("Empty container inspection");
  if (container.grainInspection !== "Passed") missing.push("Grain inspection");
  if (!trimField(container.aoSignoff)) missing.push("AO signoff");
  return missing;
}

export function formatOutloadError(blockers) {
  if (!blockers?.length) return "";
  return blockers.join(" ");
}

export function containerHasCompleteChecks(container, options = {}) {
  return getCompletionMissingChecks(container, options).length === 0;
}

/** Total nett weight (MT) across all containers — the "actual amount packed". */
export function totalNettWeight(containers) {
  if (!Array.isArray(containers)) return 0;
  return containers.reduce((sum, c) => {
    const nett = Number(c?.nettWeight ?? c?.nett_weight);
    return Number.isFinite(nett) ? sum + nett : sum;
  }, 0);
}

/** Total nett weight (MT) across containers completed with all packer + inspection checks passed. */
export function totalPackedNettWeight(containers) {
  if (!Array.isArray(containers)) return 0;
  return containers.reduce((sum, c) => {
    if (!containerHasCompleteChecks(c)) return sum;
    const nett = Number(c?.nettWeight ?? c?.nett_weight);
    return Number.isFinite(nett) ? sum + nett : sum;
  }, 0);
}

/** Count of containers completed with all packer + inspection checks passed. */
export function countPackedContainers(containers) {
  if (!Array.isArray(containers)) return 0;
  return containers.filter(containerHasCompleteChecks).length;
}

/** Out-loaded / in-loaded with all mandatory packer checks complete (excludes PRA). */
export function isContainerOutloadComplete(container, options = {}) {
  return isContainerLoaded(container) && containerHasCompleteChecks(container, options);
}

export function getPackerSignoffStatusBlocker(packStatus) {
  if (!isPackersPackerSignoffBlocked(packStatus)) return null;
  return "Packer signoff is only available when the pack is In progress.";
}

function getPackerSignoffStatusPatchBlocker(container, next, packStatus) {
  const blocker = getPackerSignoffStatusBlocker(packStatus);
  if (!blocker) return null;

  const prevSignoff = trimField(container?.packerSignoff);
  const nextSignoff = trimField(next.packerSignoff);
  const isSignoffChange = nextSignoff !== prevSignoff;
  const isActivatingOutLoaded = next.outLoaded === "Yes" && container?.outLoaded !== "Yes";
  if (isSignoffChange || isActivatingOutLoaded) return blocker;
  return null;
}

/** Returns an error message when save should be blocked, or null if OK. */
export function validateContainerForSave(container, options = {}) {
  const statusBlocker = getPackerSignoffStatusPatchBlocker(container, container, options.packStatus);
  if (statusBlocker) return statusBlocker;

  const grossWeightError = validateGrossWeight(container?.grossWeight);
  if (grossWeightError) return grossWeightError;

  const formatError = formatContainerSealValidationError(container);
  if (formatError) return formatError;

  const signoffBlockers = getSignoffBlockers(container);
  if (signoffBlockers.length) return formatOutloadError(signoffBlockers);

  const outloadBlockers = getOutloadBlockers(container, options);
  if (outloadBlockers.length) return formatOutloadError(outloadBlockers);
  return null;
}

function syncOutLoadedFromPackerSignoff(container, patch) {
  if (!Object.prototype.hasOwnProperty.call(patch, "packerSignoff")) return container;
  const signoff = trimField(patch.packerSignoff);
  return {
    ...container,
    packerSignoff: patch.packerSignoff,
    outLoaded: signoff ? "Yes" : "No",
  };
}

/**
 * When applying a patch, block signoff/outload without a seal number and
 * packer signoff without load prerequisites.
 * Returns { ok: true, container } or { ok: false, error }.
 */
export function applyContainerPatch(container, patch, options = {}) {
  const mergedPatch =
    typeof patch === "function"
      ? patch(container)
      : Object.prototype.hasOwnProperty.call(patch, "packerSignoff")
        ? { ...patch, outLoaded: trimField(patch.packerSignoff) ? "Yes" : "No" }
        : patch;
  const next =
    typeof patch === "function"
      ? syncOutLoadedFromPackerSignoff({ ...container, ...mergedPatch }, mergedPatch)
      : { ...container, ...mergedPatch };

  const grossWeightError = validateGrossWeight(next.grossWeight);
  if (grossWeightError) {
    return { ok: false, error: grossWeightError };
  }

  const statusBlocker = getPackerSignoffStatusPatchBlocker(container, next, options.packStatus);
  if (statusBlocker) {
    return { ok: false, error: statusBlocker };
  }

  const prevSignoff = trimField(container?.packerSignoff);
  const nextSignoff = trimField(next.packerSignoff);
  if (nextSignoff && nextSignoff !== prevSignoff && !hasSealNumber(next)) {
    return { ok: false, error: "Seal number is required before packer signoff." };
  }

  if (
    Object.prototype.hasOwnProperty.call(mergedPatch, "outLoaded") &&
    mergedPatch.outLoaded === "Yes" &&
    !nextSignoff
  ) {
    return { ok: false, error: "Packer signoff is required before out-loading." };
  }

  const isActivatingLoad =
    (nextSignoff && nextSignoff !== prevSignoff) ||
    (next.outLoaded === "Yes" && container?.outLoaded !== "Yes");
  if (isActivatingLoad) {
    const blockers = getOutloadBlockers(next, options);
    if (blockers.length) {
      return { ok: false, error: formatOutloadError(blockers) };
    }
  }

  if (!options.isImport) {
    const prevEmpty = String(container?.emptyInspection ?? container?.empty_inspection ?? "").toLowerCase();
    const nextEmpty = String(next.emptyInspection ?? next.empty_inspection ?? prevEmpty).toLowerCase();
    if (prevEmpty === "failed" && nextEmpty !== "failed") {
      const revertBlocker = getEcFailureRevertBlocker(container, options.allContainers);
      if (revertBlocker) {
        return { ok: false, error: revertBlocker };
      }
    }
  }

  return { ok: true, container: next };
}
