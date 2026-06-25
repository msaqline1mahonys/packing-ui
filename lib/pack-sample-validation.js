export function validatePackSampleEntries(pack) {
  if (!pack?.sampleRequired) {
    return { ok: true };
  }

  const entries = Array.isArray(pack.sampleEntries) ? pack.sampleEntries : [];
  if (entries.length === 0) {
    return {
      ok: false,
      message: "Add at least one sample when sample is required.",
    };
  }

  const missingIndex = entries.findIndex(
    (entry) => !String(entry?.sampleLocation ?? "").trim()
  );
  if (missingIndex >= 0) {
    return {
      ok: false,
      message: `Sample ${missingIndex + 1} requires a location before saving.`,
    };
  }

  return { ok: true };
}
