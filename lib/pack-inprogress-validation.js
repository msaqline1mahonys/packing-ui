import { normalizePackAttachmentFiles } from "@/lib/pack-attachments";

export function hasRfpFileAttachment(items) {
  return normalizePackAttachmentFiles(items).some(
    (item) =>
      item.file instanceof File ||
      (typeof item.url === "string" && item.url.trim() !== "")
  );
}

function isPreSampleType(type) {
  const normalized = String(type ?? "").trim().toLowerCase();
  return normalized === "pre" || normalized === "pre-pack";
}

function hasPreTypeSample(pack) {
  const entries = Array.isArray(pack?.sampleEntries) ? pack.sampleEntries : [];
  return entries.some((entry) => isPreSampleType(entry?.type));
}

function hasPassedPreSample(pack) {
  const entries = Array.isArray(pack?.sampleEntries) ? pack.sampleEntries : [];
  return entries.some(
    (entry) =>
      isPreSampleType(entry?.type) &&
      String(entry?.status ?? "").trim().toLowerCase() === "passed"
  );
}

function requiresPassedPreSample(pack) {
  if (!pack?.sampleRequired) return false;
  return hasPreTypeSample(pack);
}

export function validateInprogressPackSave(pack) {
  if (pack?.status !== "Inprogress") {
    return { ok: true };
  }

  const missing = [];
  if (!String(pack.rfp ?? "").trim()) missing.push("RFP");
  if (!String(pack.edn ?? "").trim()) missing.push("EDN");
  if (!hasRfpFileAttachment(pack.rfpFiles)) missing.push("an RFP file attachment");
  if (requiresPassedPreSample(pack) && !hasPassedPreSample(pack)) {
    missing.push("a Pre sample with Passed status");
  }

  if (!missing.length) {
    return { ok: true };
  }

  return {
    ok: false,
    message: `Pack requires ${missing.join(", ")} to change status to Inprogress.`,
  };
}
