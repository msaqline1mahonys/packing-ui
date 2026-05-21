/**
 * Canonical field label arrays for fumigation certificate and record templates.
 * Single source of truth — import these everywhere instead of re-declaring them.
 */

export const CERTIFICATE_FIELDS = [
  "Template name",
  "Customer",
  "Commodity",
  "Fumigant",
  "Dosage",
  "Exposure",
  "Location",
  "Fumigator",
  "Date issued",
];

export const RECORD_FIELDS = [
  "Customer",
  "Commodity",
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

/** Fumigation target options (multi-select, gov template) */
export const FUMIGATION_TARGETS = [
  { value: "commodity", label: "Commodity" },
  { value: "container", label: "Container" },
  { value: "packaging", label: "Packaging" },
];
