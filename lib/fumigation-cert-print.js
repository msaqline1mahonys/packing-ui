import {
  CUSTOMER_CONTACT_ROWS,
  COMMODITY_MASTER_ROWS,
} from "@/lib/Data";
import { loadPackScheduleRows } from "@/lib/pack-schedule-store";
import {
  loadFumigants,
  loadMethodologies,
  loadCertificateTemplates,
  DEFAULT_FUMIGANTS,
  DEFAULT_METHODOLOGIES,
  DEFAULT_CERTIFICATE_TEMPLATES,
} from "@/lib/fumigation-store";
import { DEMO_SITE, DEMO_SITE_ADDRESS } from "@/lib/demo-in-ticket-data";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Returns "" for null/undefined/blank; never returns "—". Use for values that
 *  will be concatenated with other strings. */
function blank(v) {
  if (v == null || String(v).trim() === "" || v === "—") return "";
  return String(v);
}

/** Returns "—" for null/undefined/blank. Use for standalone display values. */
function safe(v) {
  const s = blank(v);
  return s === "" ? "—" : s;
}

function formatDateOnly(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

/** Format as DD/MM/YYYY HH:MM am/pm — used for all print datetime fields */
export function formatDateTime(value) {
  if (!value || value === "—") return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, "0");
  const ampm = hours >= 12 ? "pm" : "am";
  hours = hours % 12 || 12;
  return `${day}/${month}/${year} ${hours}:${minutes} ${ampm}`;
}

/** Blank fumigation detail defaults — used as fallback when pack has no detail */
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
    specificDosageRateValue: "",
    specificDosageRateUnit: "g/m3",
  };
}

// ─── Certificate resolver ─────────────────────────────────────────────────────

export function resolveFumigationCertificate(packId, packOverride = null) {
  const rows = typeof window !== "undefined" ? loadPackScheduleRows() : [];
  const pack = packOverride ?? rows.find((r) => r.id === packId) ?? null;
  if (!pack) return null;

  const fumigants =
    typeof window !== "undefined" ? loadFumigants() : DEFAULT_FUMIGANTS;
  const methodologies =
    typeof window !== "undefined" ? loadMethodologies() : DEFAULT_METHODOLOGIES;
  const certTemplates =
    typeof window !== "undefined"
      ? loadCertificateTemplates()
      : DEFAULT_CERTIFICATE_TEMPLATES;

  const fumigant = fumigants.find((f) => f.id === pack.fumigantId) ?? null;
  const methodology =
    methodologies.find((m) => m.id === pack.methodologyId) ?? null;
  const template =
    certTemplates.find((t) => t.id === pack.certificateTemplateId) ??
    certTemplates[0] ??
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
  const sealNumbers = Array.isArray(pack.containers)
    ? pack.containers.map((c) => blank(c.sealNumber || c.sealNo)).filter(Boolean)
    : [];

  // Prescribed dose from matched dosage range when pack hasn't filled it
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
    certificateNumber: "",               // auto-filled on issue
    issuedDate: formatDateOnly(new Date().toISOString()),

    // Treatment provider / fumigator identity
    treatmentProviderId: blank(pack.treatmentProviderId),
    fumigatorName: blank(fd.fumigatorName),
    fumigatorAccreditationNumber: blank(pack.fumigatorAccreditationNumber),

    // Consignment
    customerName: blank(customer?.name ?? pack.customer),
    customerAddress: blank(customer?.addresses?.[0] ?? customer?.address ?? ""),
    commodityDescription: blank(commodity?.description ?? pack.commodity ?? pack.commodityId),
    commodityCode: blank(commodity?.commodityCode ?? ""),
    commodityCountryOfOrigin: blank(pack.commodityCountryOfOrigin ?? commodity?.countryOfOrigin ?? ""),
    commodityQuantity: blank(fd.actualTonnage || pack.mtTotal),
    portOfLoading: blank(pack.portOfLoading),
    destinationCountry: blank(pack.destinationCountry),
    containerNumbers,
    sealNumbers,

    // Target & enclosure
    targetOfFumigation: Array.isArray(fd.targetOfFumigation) ? fd.targetOfFumigation : [],
    enclosureType: blank(fd.enclosureType),
    enclosureOtherText: blank(fd.enclosureOtherText),
    enclosureDescription: blank(fd.enclosureDescription),
    enclosureLengthM: blank(fd.enclosureLengthM),
    enclosureWidthM: blank(fd.enclosureWidthM),
    enclosureHeightM: blank(fd.enclosureHeightM),
    volumeM3: blank(fd.volumeM3),

    // Treatment schedule — prescribed (from methodology)
    prescribedDoseRate: blank(fd.prescribedDoseRate) || blank(matchedRange?.dosageValue),
    prescribedDoseUnit: blank(fd.prescribedDoseUnit) || blank(matchedRange?.dosageUnit) || "g/m3",
    prescribedExposure: blank(fd.prescribedExposure) || blank(matchedRange?.exposureValue),
    prescribedExposureUnit: blank(fd.prescribedExposureUnit) || blank(matchedRange?.exposureUnit) || "hours",
    prescribedTemperature: blank(fd.prescribedTemperature) || blank(fd.actualTemperature),

    // Fumigation details — applied
    fumigationType: blank(fd.fumigationType) || "ambient",
    consignmentSuitable: fd.consignmentSuitable,
    consignmentRemedialAction: blank(fd.consignmentRemedialAction),
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
    actualTemperature: blank(fd.actualTemperature),
    minForecastedTemperature: blank(fd.minForecastedTemperature),
    minAmbientTemperature: blank(fd.minAmbientTemperature),

    // Place of fumigation
    placeStreet: blank(DEMO_SITE_ADDRESS?.line1 ?? ""),
    placeSuburb: blank(DEMO_SITE_ADDRESS?.line2 ?? ""),
    placeCountry: "Australia",
    placePostcode: "",

    // Times
    fumigationStartAt: blank(fd.fumigationStartAt),
    dosingFinishAt: blank(fd.dosingFinishAt),
    fumigationEndAt: blank(fd.fumigationEndAt),
    ventilationStartAt: blank(fd.ventilationStartAt),

    // Clearance / TLV
    finalTlvPpm1: blank(fd.finalTlvPpm1) || blank(fd.clearanceValue),
    finalTlvPpm2: blank(fd.finalTlvPpm2),
    finalTlvPpm3: blank(fd.finalTlvPpm3),
    clearanceValue: blank(fd.clearanceValue),

    // Monitoring
    monitoringDeviceSerials: blank(fd.monitoringDeviceSerials),

    // Result & supervision
    fumigationResult: blank(fd.fumigationResult),
    governmentOfficerName: blank(fd.governmentOfficerName),
    governmentOfficerSignature: blank(fd.governmentOfficerSignature),
    additionalDeclarations: blank(fd.additionalDeclarations),
    fumigationNotes: blank(fd.fumigationNotes),

    // Fumigant & methodology
    fumigant: fumigant
      ? {
          name: fumigant.name,
          code: fumigant.code,
          activeConstituent: fumigant.activeConstituent,
          productForm: fumigant.productForm,
        }
      : { name: blank(pack.fumigantId), code: "", activeConstituent: "", productForm: "" },
    methodology: methodology
      ? {
          name: methodology.name,
          version: methodology.version,
          applicationMethods: methodology.applicationMethods ?? [],
          dosageGuide: methodology.dosageGuide,
          safetyNotes: methodology.safetyNotes,
        }
      : { name: blank(pack.methodologyId), version: "", applicationMethods: [], dosageGuide: "", safetyNotes: "" },

    template: template ?? {
      id: null, name: "Default", headerText: "", footerText: "", body: "", fields: [],
    },
    site: DEMO_SITE,
    siteAddress: DEMO_SITE_ADDRESS,
  };
}
