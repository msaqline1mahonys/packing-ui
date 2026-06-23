import {
  formatContainerSealValidationError,
  getSealNumberFromRecord,
} from "@/lib/container-number-validation";
import { containerLoadLabel } from "@/lib/pack-import";

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

/** Seal number is required before packer signoff or out-loading. */
export function getSignoffBlockers(container) {
  if (!container || !trimField(container.packerSignoff)) return [];
  if (hasSealNumber(container)) return [];
  return ["Seal number is required before packer signoff."];
}

/** Fields required before out-loading / in-loading (matches backend load rules). */
export function getOutloadBlockers(container, options = {}) {
  if (!container || container.outLoaded !== "Yes") return [];

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

/** Mandatory checks for Complete stage (packers-schedule-spec §5). */
export function getCompletionMissingChecks(container, options = {}) {
  if (!container) return [];

  const loadLabel = containerLoadLabel(Boolean(options.isImport));
  const missing = [];
  if (!trimField(container.packerSignoff)) missing.push("Packer signoff");
  if (container.outLoaded !== "Yes") missing.push(`${loadLabel} confirmation`);
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
  return container?.outLoaded === "Yes" && containerHasCompleteChecks(container, options);
}

/** Returns an error message when save should be blocked, or null if OK. */
export function validateContainerForSave(container, options = {}) {
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

/**
 * When applying a patch, block signoff/outload without a seal number and
 * transitions to outLoaded=Yes without prerequisites.
 * Returns { ok: true, container } or { ok: false, error }.
 */
export function applyContainerPatch(container, patch, options = {}) {
  const next = typeof patch === "function" ? patch(container) : { ...container, ...patch };

  const grossWeightError = validateGrossWeight(next.grossWeight);
  if (grossWeightError) {
    return { ok: false, error: grossWeightError };
  }

  const prevSignoff = trimField(container?.packerSignoff);
  const nextSignoff = trimField(next.packerSignoff);
  if (nextSignoff && nextSignoff !== prevSignoff && !hasSealNumber(next)) {
    return { ok: false, error: "Seal number is required before packer signoff." };
  }

  if (next.outLoaded === "Yes" && container?.outLoaded !== "Yes") {
    const blockers = getOutloadBlockers(next, options);
    if (blockers.length) {
      return { ok: false, error: formatOutloadError(blockers) };
    }
  }

  return { ok: true, container: next };
}
