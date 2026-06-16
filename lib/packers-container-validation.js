function trimField(value) {
  return String(value ?? "").trim();
}

function hasNettWeight(container) {
  const nett = Number(container?.nettWeight);
  return Number.isFinite(nett) && nett > 0;
}

/** Fields required before out-loading (matches backend outload rules). */
export function getOutloadBlockers(container) {
  if (!container || container.outLoaded !== "Yes") return [];

  const blockers = [];
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
  const outloadBlockers = getOutloadBlockers(container);
  if (outloadBlockers.length) return formatOutloadError(outloadBlockers);
  return null;
}

/**
 * When applying a patch, block transitions to outLoaded=Yes without prerequisites.
 * Returns { ok: true, container } or { ok: false, error }.
 */
export function applyContainerPatch(container, patch) {
  const next = typeof patch === "function" ? patch(container) : { ...container, ...patch };
  if (next.outLoaded === "Yes" && container?.outLoaded !== "Yes") {
    const blockers = getOutloadBlockers(next);
    if (blockers.length) {
      return { ok: false, error: formatOutloadError(blockers) };
    }
  }
  return { ok: true, container: next };
}
