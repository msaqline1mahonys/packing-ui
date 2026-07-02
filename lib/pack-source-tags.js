/** Allowed pack-level container source tags (planning labels). */
export const PACK_SOURCE_TAGS = ["Release", "M.MB", "B.MB", "No MB"];

export const PACK_SOURCE_TAG_OPTIONS = PACK_SOURCE_TAGS.map((tag) => ({
  id: tag,
  label: tag,
}));

/** @param {unknown} value */
export function normalizePackSourceTags(value) {
  if (!value) return [];
  const raw = Array.isArray(value) ? value : [];
  return PACK_SOURCE_TAGS.filter((tag) => raw.includes(tag));
}

/**
 * Merge tags while preserving canonical order.
 * @param {unknown} existing
 * @param {string[]} [toAdd]
 * @param {string[]} [toRemove]
 */
export function mergePackSourceTags(existing, toAdd = [], toRemove = []) {
  const set = new Set(normalizePackSourceTags(existing));
  for (const tag of toRemove) set.delete(tag);
  for (const tag of toAdd) {
    if (PACK_SOURCE_TAGS.includes(tag)) set.add(tag);
  }
  return PACK_SOURCE_TAGS.filter((tag) => set.has(tag));
}

/** @param {unknown} existing */
export function withAutoReleaseTag(existing, hasRelease) {
  return hasRelease
    ? mergePackSourceTags(existing, ["Release"])
    : mergePackSourceTags(existing, [], ["Release"]);
}

/** @param {unknown} existing */
export function withAutoMatchboxImportTag(existing, isMatchbox) {
  return isMatchbox ? mergePackSourceTags(existing, ["M.MB"]) : normalizePackSourceTags(existing);
}

/** @param {unknown} tags */
export function formatPackSourceTags(tags) {
  const normalized = normalizePackSourceTags(tags);
  return normalized.length ? normalized.join(", ") : "";
}

/** @param {unknown} pack */
export function packHasSelectedSourceTag(pack, selectedTags) {
  if (!selectedTags?.length || selectedTags.length === PACK_SOURCE_TAGS.length) return true;
  const rowTags = normalizePackSourceTags(pack?.containerSourceTags ?? pack?.container_source_tags);
  return selectedTags.some((tag) => rowTags.includes(tag));
}
