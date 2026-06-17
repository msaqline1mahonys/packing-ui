import {
  formatContainerSealValidationError,
  getSealNumberFromRecord,
} from "@/lib/container-number-validation";
import { containerLoadLabel } from "@/lib/pack-import";

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

/** Fields required before out-loading / in-loading (matches backend load rules). */
export function getOutloadBlockers(container, options = {}) {
  if (!container || container.outLoaded !== "Yes") return [];

  const loadVerb = options.isImport ? "in-loading" : "out-loading";
  const blockers = [];
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
