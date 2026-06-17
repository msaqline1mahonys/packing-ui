import {
  formatContainerSealValidationError,
  getSealNumberFromRecord,
} from "@/lib/container-number-validation";

function trimField(value) {
  return String(value ?? "").trim();
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

/** Fields required before out-loading (matches backend outload rules). */
export function getOutloadBlockers(container) {
  if (!container || container.outLoaded !== "Yes") return [];

  const blockers = [];
  if (!hasSealNumber(container)) {
    blockers.push("Seal number is required before out-loading.");
  }
  if (!trimField(container.packerSignoff)) {
    blockers.push("Packer signoff is required before out-loading.");
  }
  if (!trimField(container.stockBayId)) {
    blockers.push("Stock/Bay is required before out-loading.");
  }
  if (!hasNettWeight(container)) {
    blockers.push("Nett weight is required before out-loading.");
  }
  return blockers;
}

/** Mandatory checks for Complete stage (packers-schedule-spec §5). */
export function getCompletionMissingChecks(container) {
  if (!container) return [];

  const missing = [];
  if (!trimField(container.packerSignoff)) missing.push("Packer signoff");
  if (container.outLoaded !== "Yes") missing.push("Out-loaded confirmation");
  if (container.emptyInspection !== "Passed") missing.push("Empty container inspection");
  if (container.grainInspection !== "Passed") missing.push("Grain inspection");
  if (!trimField(container.aoSignoff)) missing.push("AO signoff");
  return missing;
}

export function formatOutloadError(blockers) {
  if (!blockers?.length) return "";
  return blockers.join(" ");
}

export function containerHasCompleteChecks(container) {
  return getCompletionMissingChecks(container).length === 0;
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

/** Out-loaded with all mandatory packer checks complete (excludes PRA). */
export function isContainerOutloadComplete(container) {
  return container?.outLoaded === "Yes" && containerHasCompleteChecks(container);
}

/** Returns an error message when save should be blocked, or null if OK. */
export function validateContainerForSave(container) {
  const formatError = formatContainerSealValidationError(container);
  if (formatError) return formatError;

  const signoffBlockers = getSignoffBlockers(container);
  if (signoffBlockers.length) return formatOutloadError(signoffBlockers);

  const outloadBlockers = getOutloadBlockers(container);
  if (outloadBlockers.length) return formatOutloadError(outloadBlockers);
  return null;
}

/**
 * When applying a patch, block signoff/outload without a seal number and
 * transitions to outLoaded=Yes without prerequisites.
 * Returns { ok: true, container } or { ok: false, error }.
 */
export function applyContainerPatch(container, patch) {
  const next = typeof patch === "function" ? patch(container) : { ...container, ...patch };

  const prevSignoff = trimField(container?.packerSignoff);
  const nextSignoff = trimField(next.packerSignoff);
  if (nextSignoff && nextSignoff !== prevSignoff && !hasSealNumber(next)) {
    return { ok: false, error: "Seal number is required before packer signoff." };
  }

  if (next.outLoaded === "Yes" && container?.outLoaded !== "Yes") {
    const blockers = getOutloadBlockers(next);
    if (blockers.length) {
      return { ok: false, error: formatOutloadError(blockers) };
    }
  }

  return { ok: true, container: next };
}
