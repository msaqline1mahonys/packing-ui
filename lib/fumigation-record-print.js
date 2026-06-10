import {
  CUSTOMER_CONTACT_ROWS,
  COMMODITY_MASTER_ROWS,
} from "@/lib/Data";
import {
  loadFumigants,
  loadMethodologies,
  loadRecordTemplates,
  DEFAULT_FUMIGANTS,
  DEFAULT_METHODOLOGIES,
  DEFAULT_RECORD_TEMPLATES,
} from "@/lib/fumigation-store";
import { formatDateTime } from "@/lib/fumigation-cert-print";
import { DEMO_SITE, DEMO_SITE_ADDRESS } from "@/lib/demo-in-ticket-data";

export { formatDateTime };

function blank(v) {
  if (v == null || String(v).trim() === "" || v === "—") return "";
  return String(v);
}

function formatDateOnly(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

function blankFd() {
  return {
    applicationMethod: "in-container",
    fumigationType: "ambient",
    targetOfFumigation: [],
    enclosureType: "",
    enclosureOtherText: "",
    enclosureDescription: "",
    enclosureLengthM: "",
    enclosureWidthM: "",
    enclosureHeightM: "",
    volumeM3: "",
    consignmentSuitable: null,
    consignmentRemedialAction: "",
    actualTonnage: "",
    minForecastedTemperature: "",
    minAmbientTemperature: "",
    actualTemperature: "",
    prescribedDoseRate: "",
    prescribedDoseUnit: "g/m3",
    prescribedExposure: "",
    prescribedExposureUnit: "hours",
    prescribedTemperature: "",
    dosageValue: "",
    dosageUnit: "g/m3",
    calculatedDosageValue: "",
    calculatedDosageUnit: "g",
    actualDosageAppliedValue: "",
    actualDosageAppliedUnit: "g",
    chloropicrinUsed: null,
    chloropicrinPercent: "",
    heatersUsed: null,
    endPointConcentration: "",
    endPointConcentrationUnit: "g/m3",
    ctRequired: "",
    ctAchieved: "",
    thirdPartySystem: false,
    thirdPartySystemName: "",
    exposureTimeValue: "",
    exposureTimeUnit: "hours",
    fumigationStartAt: "",
    dosingFinishAt: "",
    fumigationEndAt: "",
    ventilationStartAt: "",
    monitoringDeviceSerials: "",
    finalTlvPpm1: "",
    finalTlvPpm2: "",
    finalTlvPpm3: "",
    clearanceValue: "",
    topUpEntries: [],
    fumigatorName: "",
    fumigationResult: "",
    governmentOfficerName: "",
    governmentOfficerSignature: "",
    additionalDeclarations: "",
    fumigationNotes: "",
  };
}

/** Default 6-phase concentration reading rows matching the gov template */
function defaultConcentrationReadings() {
  const phases = [
    { phase: "start", phaseLabel: "Start" },
    { phase: "during", phaseLabel: "During" },
    { phase: "during", phaseLabel: "During" },
    { phase: "during", phaseLabel: "During" },
    { phase: "during", phaseLabel: "During" },
    { phase: "end", phaseLabel: "End" },
  ];
  return phases.map((p, i) => ({
    id: i + 1,
    phase: p.phase,
    phaseLabel: p.phaseLabel,
    date: "",
    time: "",
    location1: "",
    location2: "",
    location3: "",
    location4: "",
    location5: "",
    equilibriumPercent: "",
    standardGm3: "",
    fumigatorInitials: "",
  }));
}

export function resolveFumigationRecord(packId, packOverride = null) {
  const pack = packOverride ?? null;
  if (!pack) return null;

  const fumigants =
    typeof window !== "undefined" ? loadFumigants() : DEFAULT_FUMIGANTS;
  const methodologies =
    typeof window !== "undefined" ? loadMethodologies() : DEFAULT_METHODOLOGIES;
  const recordTemplates =
    typeof window !== "undefined"
      ? loadRecordTemplates()
      : DEFAULT_RECORD_TEMPLATES;

  const fumigant = fumigants.find((f) => f.id === pack.fumigantId) ?? null;
  const methodology =
    methodologies.find((m) => m.id === pack.methodologyId) ?? null;
  const template =
    recordTemplates.find((t) => t.id === pack.recordTemplateId) ??
    recordTemplates[0] ??
    null;

  const customer =
    CUSTOMER_CONTACT_ROWS.find(
      (c) => c.id === pack.customerId || c.name === pack.customer
    ) ?? null;
  const commodity =
    COMMODITY_MASTER_ROWS.find(
      (c) => c.id === pack.commodityId || c.description === pack.commodity
    ) ?? null;

  const fd = pack.fumigationDetail && typeof pack.fumigationDetail === "object"
    ? { ...blankFd(), ...pack.fumigationDetail }
    : blankFd();

  const containerNumbers = Array.isArray(pack.containers)
    ? pack.containers.map((c) => blank(c.containerNumber || c.containerNo)).filter(Boolean)
    : [];

  const matchedRange = (() => {
    if (!methodology?.dosageRanges?.length) return null;
    const tRaw = fd.actualTemperature ?? fd.minAmbientTemperature ?? fd.minForecastedTemperature;
    const t = Number(tRaw);
    if (!Number.isFinite(t)) return null;
    return methodology.dosageRanges.find((r) => Number(r.minTempC) <= t && t < Number(r.maxTempC)) ?? null;
  })();

  return {
    packId,
    packRef: blank(pack.jobReference) || `PACK-${String(packId).padStart(6, "0")}`,
    issuedDate: formatDateOnly(new Date().toISOString()),

    // Section A — Fumigator in charge
    fumigatorName: blank(fd.fumigatorName),
    fumigatorAccreditationNumber: blank(pack.fumigatorAccreditationNumber),

    // Section B — Job details
    treatmentProviderId: blank(pack.treatmentProviderId),
    customerName: blank(customer?.name ?? pack.customer),
    customerAddress: blank(customer?.addresses?.[0] ?? customer?.address ?? ""),
    jobIdentificationNumber: blank(pack.jobReference),
    placeStreet: blank(DEMO_SITE_ADDRESS?.line1 ?? ""),
    placeSuburb: blank(DEMO_SITE_ADDRESS?.line2 ?? ""),
    placeCountry: "Australia",
    placePostcode: "",
    targetOfFumigation: Array.isArray(fd.targetOfFumigation) ? fd.targetOfFumigation : [],
    commodityDescription: blank(commodity?.description ?? pack.commodity ?? pack.commodityId),
    commodityCode: blank(commodity?.commodityCode ?? ""),
    containerNumbers,

    // Section C — Fumigation details
    enclosureType: blank(fd.enclosureType),
    enclosureOtherText: blank(fd.enclosureOtherText),
    enclosureDescription: blank(fd.enclosureDescription),
    enclosureLengthM: blank(fd.enclosureLengthM),
    enclosureWidthM: blank(fd.enclosureWidthM),
    enclosureHeightM: blank(fd.enclosureHeightM),
    volumeM3: blank(fd.volumeM3),
    consignmentSuitable: fd.consignmentSuitable,
    consignmentRemedialAction: blank(fd.consignmentRemedialAction),
    prescribedDoseRate: blank(fd.prescribedDoseRate) || blank(matchedRange?.dosageValue),
    prescribedDoseUnit: blank(fd.prescribedDoseUnit) || blank(matchedRange?.dosageUnit) || "g/m3",
    prescribedExposure: blank(fd.prescribedExposure) || blank(matchedRange?.exposureValue),
    prescribedExposureUnit: blank(fd.prescribedExposureUnit) || blank(matchedRange?.exposureUnit) || "hours",
    prescribedTemperature: blank(fd.prescribedTemperature) || blank(fd.actualTemperature),
    fumigationType: blank(fd.fumigationType) || "ambient",
    minForecastedTemperature: blank(fd.minForecastedTemperature),
    minAmbientTemperature: blank(fd.minAmbientTemperature),
    actualTemperature: blank(fd.actualTemperature),
    dosageValue: blank(fd.dosageValue),
    dosageUnit: blank(fd.dosageUnit) || "g/m3",
    calculatedDosageValue: blank(fd.calculatedDosageValue),
    calculatedDosageUnit: blank(fd.calculatedDosageUnit) || "g",
    actualDosageAppliedValue: blank(fd.actualDosageAppliedValue),
    actualDosageAppliedUnit: blank(fd.actualDosageAppliedUnit) || "g",
    chloropicrinUsed: fd.chloropicrinUsed,
    chloropicrinPercent: blank(fd.chloropicrinPercent),
    heatersUsed: fd.heatersUsed,
    endPointConcentration: blank(fd.endPointConcentration),
    endPointConcentrationUnit: blank(fd.endPointConcentrationUnit) || "g/m3",
    ctRequired: blank(fd.ctRequired),
    ctAchieved: blank(fd.ctAchieved),
    thirdPartySystem: Boolean(fd.thirdPartySystem),
    thirdPartySystemName: blank(fd.thirdPartySystemName),
    exposureTimeValue: blank(fd.exposureTimeValue),
    exposureTimeUnit: blank(fd.exposureTimeUnit) || "hours",

    // Section D — Concentration readings
    monitoringDeviceSerials: blank(fd.monitoringDeviceSerials),
    dosingFinishAt: blank(fd.dosingFinishAt),
    ventilationStartAt: blank(fd.ventilationStartAt),
    concentrationReadings: defaultConcentrationReadings(),
    finalTlvPpm1: blank(fd.finalTlvPpm1) || blank(fd.clearanceValue),
    finalTlvPpm2: blank(fd.finalTlvPpm2),
    finalTlvPpm3: blank(fd.finalTlvPpm3),
    topUpEntries: Array.isArray(fd.topUpEntries) ? fd.topUpEntries : [],

    // Section E — Declaration
    fumigationResult: blank(fd.fumigationResult),
    governmentOfficerName: blank(fd.governmentOfficerName),
    governmentOfficerSignature: blank(fd.governmentOfficerSignature),

    // Meta
    fumigant: fumigant
      ? { name: fumigant.name, code: fumigant.code, activeConstituent: fumigant.activeConstituent, productForm: fumigant.productForm }
      : { name: blank(pack.fumigantId), code: "", activeConstituent: "", productForm: "" },
    methodology: methodology
      ? { name: methodology.name, version: methodology.version, applicationMethods: methodology.applicationMethods ?? [], dosageGuide: methodology.dosageGuide, safetyNotes: methodology.safetyNotes }
      : { name: blank(pack.methodologyId), version: "", applicationMethods: [], dosageGuide: "", safetyNotes: "" },
    template: template ?? {
      id: null, name: "Default Record Sheet", headerText: "", footerText: "", body: "", includeCertificateFields: true, fields: [],
    },
    site: DEMO_SITE,
    siteAddress: DEMO_SITE_ADDRESS,

    // Legacy compat kept for old snapshots
    record: {
      monitoringIntervals: [],
      gasReadings: [],
      clearanceReading: blank(fd.clearanceValue),
      fumigatorSignoff: blank(fd.fumigatorName),
      inspectorVerification: "",
    },
  };
}
