import { normalizePackAttachmentFiles } from "@/lib/pack-attachments";

export function hasRfpFileAttachment(items) {
  return normalizePackAttachmentFiles(items).some(
    (item) =>
      item.file instanceof File ||
      (typeof item.url === "string" && item.url.trim() !== "")
  );
}

export function validateInprogressPackSave(pack) {
  if (pack?.status !== "Inprogress") {
    return { ok: true };
  }

  const missing = [];
  if (!String(pack.rfp ?? "").trim()) missing.push("RFP");
  if (!String(pack.edn ?? "").trim()) missing.push("EDN");
  if (!hasRfpFileAttachment(pack.rfpFiles)) missing.push("RFP file attachment");

  if (!missing.length) {
    return { ok: true };
  }

  return {
    ok: false,
    message:
      "Pack requires RFP, EDN, and an RFP file attachment to change status to Inprogress.",
  };
}
