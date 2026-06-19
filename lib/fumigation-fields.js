/**
 * Canonical field label arrays for fumigation certificate and record templates.
 * Single source of truth — import these everywhere instead of re-declaring them.
 */

export const CERTIFICATE_FIELDS = [
  "Template name",
  "Customer",
  "Commodity Grade",
  "Fumigant",
  "Dosage",
  "Exposure",
  "Location",
  "Fumigator",
  "Date issued",
];

export const RECORD_FIELDS = [
  "Customer",
  "Commodity Grade",
  "Fumigant",
  "Dosage",
  "Exposure",
  "Location",
  "Fumigator",
  "Monitoring intervals",
  "Gas readings",
  "Clearance reading",
  "Fumigator sign-off",
  "Inspector verification",
];

/** Enclosure type options (gov template) */
export const ENCLOSURE_TYPES = [
  { value: "sheeted", label: "Sheeted enclosure" },
  { value: "chamber", label: "Fumigation chamber" },
  { value: "unsheeted-container", label: "Un-sheeted container" },
  { value: "other", label: "Other" },
];

/** Default enclosure type when fumigation timing is chosen on the pack form. */
export function defaultEnclosureTypeForTiming(timing) {
  const value = String(timing ?? "").trim().toLowerCase();
  if (value === "post-pack") return "unsheeted-container";
  if (value === "pre-pack") return "chamber";
  return "";
}

/** Fumigation target options (multi-select, gov template) */
export const FUMIGATION_TARGETS = [
  { value: "commodity", label: "Commodity Grade" },
  { value: "container", label: "Container" },
  { value: "packaging", label: "Packaging" },
];

/**
 * Certificate document sections — used by the certificate template admin to toggle
 * which gov-aligned sections render on the printed cert. Each enabled key in
 * `template.sections` causes the matching block to render in
 * `FumigationCertificateDocument`. Missing sections array = all enabled (back-compat).
 */
export const CERTIFICATE_SECTIONS = [
  { key: "consignment", label: "Consignment details" },
  { key: "targetEnclosure", label: "Target of fumigation & enclosure type" },
  { key: "schedule", label: "Treatment schedule (prescribed vs applied)" },
  { key: "treatmentDetails", label: "Treatment details (amount applied, chloropicrin, heaters, TLV)" },
  { key: "endpointCt", label: "End-point concentration & CT (SF)" },
  { key: "place", label: "Place of fumigation" },
  { key: "times", label: "Treatment times" },
  { key: "declaration", label: "Declaration block" },
];

/**
 * Record document sections (A–E) — gov-aligned. Same opt-in/opt-out behaviour as
 * the certificate sections, applied to `FumigationRecordDocument`.
 */
export const RECORD_SECTIONS = [
  { key: "sectionA", label: "Section A — Fumigator in charge" },
  { key: "sectionB", label: "Section B — Job details" },
  { key: "sectionC", label: "Section C — Fumigation details" },
  { key: "sectionD", label: "Section D — Concentration readings" },
  { key: "sectionE", label: "Section E — Fumigator declaration" },
];
