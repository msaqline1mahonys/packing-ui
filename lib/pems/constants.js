export const INSPECTION_TYPES = {
  ECI: "ECI",
  CGI: "CGI",
  QSR: "QSR",
  HORTICULTURE: "HORTICULTURE",
};

export const INSPECTION_REASONS = {
  RE_INSPECTION: "R",
  RE_SUBMIT: "RS",
  SUPPLEMENTARY: "S",
};

export const PEMS_STATUSES = ["draft", "submitted", "completed", "under_review", "cancelled", "failed"];

export const PEMS_ENVIRONMENTS = {
  VENDOR_TEST: "vendor_test",
  PRODUCTION: "production",
};

export const PEMS_BASE_URLS = {
  [PEMS_ENVIRONMENTS.VENDOR_TEST]: "https://online-vnd.agriculture.gov.au/pems-sdm/pems-ws/",
  [PEMS_ENVIRONMENTS.PRODUCTION]: "https://online.agriculture.gov.au/pems-sdm/pems-ws/",
};

export const PEMS_SERVICE_SUFFIXES = {
  inspection: "inspection-ws",
  containerisedGoods: "containerised-goods-ws",
  qsr: "qsr-inspection-ws",
  attachment: "attachment-ws",
  referenceData: "reference-data-ws",
  validateContainer: "validate-container",
  inspectionStatus: "inspection-status",
  resubmission: "resubmission-ws",
};

export const REF_TYPES = [
  "REF_CONT_INSP_RESULT",
  "REF_INSPECTION_RESULT",
  "REF_CONT_INSP_LEVEL",
  "REF_ACTIVITY",
  "REF_COMMODITY",
  "REF_PACKAGE_TYPE",
  "REF_PACKAGE_UNIT",
  "REF_CONT_INSP_REMARK",
  "REF_INSP_REMARK_CODE",
  "REF_STATE",
  "REF_POSTCODE",
  "REF_ATTACHMENT_TYPE",
  "REF_INSPECTION_STATUS",
  "REF_RE_INSPECTION_REASON",
  "REF_SAMPLING_TYPE",
  "REF_SAMPLING_INLINE_TYPE",
  "REF_SUB_PACKAGE_TYPE",
];

export const FALLBACK_REFERENCE_DATA = {
  REF_CONT_INSP_LEVEL: [
    { code: "Consumable", description: "Consumable" },
    { code: "Standard", description: "Standard" },
  ],
  REF_CONT_INSP_RESULT: [
    { code: "Pass", description: "Pass" },
    { code: "Fail", description: "Fail" },
  ],
  REF_INSPECTION_RESULT: [
    { code: "Pass", description: "Pass" },
    { code: "Fail", description: "Fail" },
  ],
  REF_CONT_INSP_REMARK: [{ code: "", description: "None" }],
  REF_ACTIVITY: [
    { code: "INSPECTION", description: "Inspection" },
    { code: "SAMPLING", description: "Sampling" },
  ],
  REF_STATE: [
    { code: "VIC", description: "Victoria" },
    { code: "NSW", description: "New South Wales" },
    { code: "QLD", description: "Queensland" },
    { code: "SA", description: "South Australia" },
    { code: "WA", description: "Western Australia" },
    { code: "TAS", description: "Tasmania" },
    { code: "NT", description: "Northern Territory" },
    { code: "ACT", description: "Australian Capital Territory" },
  ],
  REF_PACKAGE_TYPE: [{ code: "CONTAINER", description: "Container" }],
  REF_PACKAGE_UNIT: [{ code: "M/TONS", description: "Metric tonnes" }],
};

export const EMPTY_INSPECTION_TO_REF = {
  Passed: "Pass",
  Failed: "Fail",
  Pending: "",
};

export const GRAIN_INSPECTION_TO_REF = {
  Passed: "Pass",
  Failed: "Fail",
  Pending: "",
};

export function derivePemsServiceUrl(baseUrl, suffix) {
  const base = String(baseUrl || "").replace(/\/+$/, "");
  const path = String(suffix || "").replace(/^\/+/, "");
  return `${base}/${path}`;
}

/** Standard GPPIR trade-description values (Mahony's PEMS test submissions). */
export const GPPIR_TRADE_DESC_DEFAULTS = {
  tradeDescRequiredForGoods: "N",
  tradeDescPhysicallyApplied: "N",
  tradeDescRequirementMeet: "NA",
};

export function defaultPemsDraftFields() {
  return {
    inspectionReason: "",
    parentInspectionId: null,
    inspectionsToBeCancelled: [],
    ...GPPIR_TRADE_DESC_DEFAULTS,
    associatedAoUserIds: [],
    timeEntries: [],
  };
}

export function defaultContainerPemsFields() {
  return {
    inspectionLevelCode: "Consumable",
    inspectionResultCode: "",
    passedAfterRectification: "N",
    inspectionRemarkCode: "",
    packageType: "CONTAINER",
    packageUnit: "M/TONS",
    sampled: "N/A",
    lineNumber: 1,
    samplingType: "",
    inlineSamplingType: "",
  };
}
