import { ECR_RECORD_TYPE, GPPIR_RECORD_TYPE } from "@/lib/pems-staging-snapshot";
import { GPPIR_TRADE_DESC_DEFAULTS, INSPECTION_TYPES, INSPECTION_REASONS } from "@/lib/pems/constants";

export function recordTypeToInspectionType(recordType) {
  if (recordType === GPPIR_RECORD_TYPE) return INSPECTION_TYPES.CGI;
  if (recordType === ECR_RECORD_TYPE) return INSPECTION_TYPES.ECI;
  return INSPECTION_TYPES.ECI;
}

export function validateEciSubmission({ containers, site, timeEntries }) {
  const errors = [];
  if (!Array.isArray(containers) || !containers.length) errors.push("At least one container is required.");
  for (const container of containers) {
    if (!String(container.containerNumber || container.containerNo || "").trim()) {
      errors.push("Each container must have a container number.");
      break;
    }
    if (!String(container.inspectionLevelCode || "").trim()) {
      errors.push("Each container must have an inspection level.");
      break;
    }
    const resultCode = String(container.inspectionResultCode || "").trim();
    if (!resultCode) {
      errors.push("Each container must have an inspection result code.");
      break;
    }
    const par = container.passedAfterRectification;
    if (par && par !== "Y" && par !== "N") {
      errors.push("Passed after rectification must be Y or N.");
      break;
    }
  }
  const hasYard = site?.yardId != null && String(site.yardId).trim() !== "";
  const hasAddress =
    String(site?.addressLine1 || "").trim() &&
    String(site?.suburb || "").trim() &&
    String(site?.stateCode || "").trim() &&
    String(site?.postcode || "").trim();
  if (!hasYard && !hasAddress) {
    errors.push("Site must have yard ID or a full PEMS address (line 1, suburb, state, postcode).");
  }
  if (!Array.isArray(timeEntries) || !timeEntries.length) {
    errors.push("At least one time entry is required.");
  }
  return errors;
}

export function validateCgiSubmission({
  pack,
  site,
  containers,
  lines,
  timeEntries,
  pemsDraft,
}) {
  const errors = [];
  if (!String(pack?.rfp || "").trim()) errors.push("RFP number is required for GPPIR.");
  if (!String(site?.establishmentNumber || site?.yardNo || "").trim()) {
    errors.push("Establishment number is required (configure on Site).");
  }
  const tradeDescRequiredForGoods =
    pemsDraft?.tradeDescRequiredForGoods || GPPIR_TRADE_DESC_DEFAULTS.tradeDescRequiredForGoods;
  const tradeDescPhysicallyApplied =
    pemsDraft?.tradeDescPhysicallyApplied || GPPIR_TRADE_DESC_DEFAULTS.tradeDescPhysicallyApplied;
  const tradeDescRequirementMeet =
    pemsDraft?.tradeDescRequirementMeet || GPPIR_TRADE_DESC_DEFAULTS.tradeDescRequirementMeet;
  if (!["Y", "N"].includes(tradeDescRequiredForGoods)) {
    errors.push("Trade description required for goods must be Y or N.");
  }
  if (!["Y", "N"].includes(tradeDescPhysicallyApplied)) {
    errors.push("Trade description physically applied must be Y or N.");
  }
  if (!["Y", "N", "NA"].includes(tradeDescRequirementMeet)) {
    errors.push("Trade description requirement meet must be Y, N, or NA.");
  }
  if (pemsDraft?.inspectionReason === INSPECTION_REASONS.RE_SUBMIT) {
    const cancelled = pemsDraft?.inspectionsToBeCancelled;
    if (!Array.isArray(cancelled) || !cancelled.length) {
      errors.push("Re-submit requires at least one inspection ID to cancel.");
    }
  }
  if (!Array.isArray(lines) || !lines.length) errors.push("At least one inspection line is required.");
  if (!Array.isArray(timeEntries) || !timeEntries.length) errors.push("At least one time entry is required.");
  if (!Array.isArray(containers) || !containers.length) errors.push("At least one container is required.");
  void tradeFields;
  return errors;
}

export function validatePemsSubmission({ recordType, pack, site, containers, lines, timeEntries, pemsDraft }) {
  const isGppir = recordType === GPPIR_RECORD_TYPE;
  if (isGppir) {
    return validateCgiSubmission({ pack, site, containers, lines, timeEntries, pemsDraft });
  }
  return validateEciSubmission({ containers, site, timeEntries });
}

export function validateAttachment({ inspection, attachment }) {
  const errors = [];
  if (!inspection?.pemsInspectionId) errors.push("Inspection must be submitted before uploading attachments.");
  if (attachment?.attachmentType === "IM" && !String(attachment?.importPermitNumber || "").trim()) {
    errors.push("Import permit number is required for IM attachments.");
  }
  const cid = String(attachment?.documentName || attachment?.cid || "");
  if (/\s/.test(cid)) errors.push("Attachment CID must not contain spaces.");
  return errors;
}
