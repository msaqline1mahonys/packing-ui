/**
 * Display order: pack-level RFP string, then staged container release refs,
 * then any pack container release refs, then schedule release ref list.
 */
export function resolvePackRfpRef({
  packRfp = "",
  stagedContainers = [],
  allContainers = [],
  releaseRefs = [],
  packReleaseNumber = "",
} = {}) {
  const t = (v) => String(v ?? "").trim();
  const fromPack = t(packRfp);
  if (fromPack) return fromPack;
  for (const c of stagedContainers) {
    const r = t(c?.releaseNumber);
    if (r) return r;
  }
  for (const c of allContainers) {
    const r = t(c?.releaseNumber);
    if (r) return r;
  }
  for (const ref of releaseRefs) {
    const r = t(ref);
    if (r) return r;
  }
  return t(packReleaseNumber);
}
