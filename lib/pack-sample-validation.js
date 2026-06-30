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

export function validatePackSampleUpdate({ status, trackingDetail, resultFileUrl } = {}) {
  if (String(status ?? "").toLowerCase() !== "passed") {
    return { ok: true, errors: {} };
  }

  const errors = {};

  if (!String(trackingDetail ?? "").trim()) {
    errors.trackingDetail = "Tracking detail is required when status is Passed.";
  }

  if (!String(resultFileUrl ?? "").trim()) {
    errors.resultFile = "A result PDF is required when status is Passed.";
  }

  if (Object.keys(errors).length === 0) {
    return { ok: true, errors: {} };
  }

  return { ok: false, errors };
}
