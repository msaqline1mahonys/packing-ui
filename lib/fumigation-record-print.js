import { findDosageBandForTemp } from "@/lib/fumigation-dosage-bands";
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
import { normalizeFumigationDetail, resolveFumigantDisplayModel, resolveMethodologyDisplayName } from "@/lib/fumigation-detail";
import { DEMO_SITE, DEMO_SITE_ADDRESS } from "@/lib/demo-in-ticket-data";
import { loadContactUsers } from "@/lib/contact-users-store";
import {
  findContactUserByName,
  resolveSignoffFields,
} from "@/lib/fumigation-signatures";
import { filterOperationalContainers, getContainerNumberFromRecord } from "@/lib/packers-work-store";
import { defaultContainerReadings, migrateLegacyReadings } from "@/lib/fumigation-concentration-readings";

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
    fumigatorSignature: "",
    fumigatorLicenceNumber: "",
    fumigationResult: "",
    governmentOfficerName: "",
    governmentOfficerNumber: "",
    governmentOfficerLicenseNumber: "",
    governmentOfficerSignature: "",
    additionalDeclarations: "",
    fumigationNotes: "",
  };
}

export function resolveFumigationRecord(packId, packOverride = null, options = {}) {
  const pack = packOverride ?? null;
  if (!pack) return null;

  const recordTemplates =
    options.recordTemplates ??
    (typeof window !== "undefined" ? loadRecordTemplates() : DEFAULT_RECORD_TEMPLATES);

  // The backend returns snake_case columns and relation objects; older
  // localStorage rows were camelCase with plain string names. Read both shapes.
  const sameId = (a, b) => a != null && b != null && String(a) === String(b);
  const fumigantId = pack.fumigantId ?? pack.fumigant_id;
  const methodologyId = pack.methodologyId ?? pack.methodology_id;
  const recordTemplateId = pack.recordTemplateId ?? pack.record_template_id;
  const customerId = pack.customerId ?? pack.customer_id;
  const commodityId = pack.commodityId ?? pack.commodity_id;
  const customerNameRaw =
    pack.customer && typeof pack.customer === "object" ? pack.customer.name : pack.customer;
  const commodityDescRaw =
    pack.commodity && typeof pack.commodity === "object" ? pack.commodity.description : pack.commodity;
  const jobReference = pack.jobReference ?? pack.job_reference;
  const rawDetail = normalizeFumigationDetail(pack.fumigationDetail ?? pack.fumigation_detail);

  const fumigants =
    options.fumigants ??
    (typeof window !== "undefined" ? loadFumigants() : DEFAULT_FUMIGANTS);
  const methodologies =
    options.methodologies ??
    (typeof window !== "undefined" ? loadMethodologies() : DEFAULT_METHODOLOGIES);

  const fumigant =
    fumigants.find((f) => sameId(f.id, fumigantId)) ??
    (() => {
      const methodologyMatch = methodologies.find((m) => sameId(m.id, methodologyId));
      if (!methodologyMatch?.fumigantId) return null;
      return fumigants.find((f) => sameId(f.id, methodologyMatch.fumigantId)) ?? null;
    })();
  const methodology =
    methodologies.find((m) => sameId(m.id, methodologyId)) ?? null;
  const template =
    recordTemplates.find((t) => sameId(t.id, recordTemplateId)) ??
    recordTemplates[0] ??
    null;

  const customer =
    CUSTOMER_CONTACT_ROWS.find(
      (c) => sameId(c.id, customerId) || c.name === customerNameRaw
    ) ?? null;
  const commodity =
    COMMODITY_MASTER_ROWS.find(
      (c) => sameId(c.id, commodityId) || c.description === commodityDescRaw
    ) ?? null;

  const fd = rawDetail && typeof rawDetail === "object"
    ? { ...blankFd(), ...rawDetail }
    : blankFd();

  const contactUsers = typeof window !== "undefined" ? loadContactUsers() : [];
  const fumigatorNameResolved = blank(fd.fumigatorName);
  const aoNameResolved = blank(fd.governmentOfficerName);
  const fumigatorSignoff = resolveSignoffFields(fumigatorNameResolved, fd.fumigatorSignature, contactUsers);
  const aoSignoff = resolveSignoffFields(aoNameResolved, fd.governmentOfficerSignature, contactUsers);
  const aoUser = findContactUserByName(contactUsers, aoNameResolved);
  const fumigatorUser = findContactUserByName(contactUsers, fumigatorNameResolved);
  const fumigatorLicenceNumber =
    blank(pack.fumigatorAccreditationNumber ?? pack.fumigator_accreditation_number)
    || blank(fumigatorUser?.fumigatorLicence)
    || blank(fd.fumigatorLicenceNumber);
  const governmentOfficerLicenseNumber =
    blank(fd.governmentOfficerLicenseNumber)
    || blank(aoUser?.aoLicenseNumber)
    || blank(fd.governmentOfficerNumber);

  const containerNumbers = filterOperationalContainers(pack.containers)
    .map((c) => getContainerNumberFromRecord(c))
    .filter(Boolean);

  const matchedRange = (() => {
    if (!methodology?.dosageRanges?.length) return null;
    const tRaw = fd.actualTemperature ?? fd.minAmbientTemperature ?? fd.minForecastedTemperature;
    return findDosageBandForTemp(methodology.dosageRanges, tRaw);
  })();

  return {
    packId,
    packRef: blank(jobReference) || `PACK-${String(packId).padStart(6, "0")}`,
    issuedDate: formatDateOnly(new Date().toISOString()),

    // Section A — Fumigator in charge
    fumigatorName: blank(fd.fumigatorName),
    fumigatorAccreditationNumber: fumigatorLicenceNumber,
    fumigatorLicenceNumber,

    // Section B — Job details
    treatmentProviderId: blank(pack.treatmentProviderId ?? pack.treatment_provider_id),
    customerName: blank(customer?.name ?? customerNameRaw),
    customerAddress: blank(customer?.addresses?.[0] ?? customer?.address ?? ""),
    jobIdentificationNumber: blank(jobReference),
    placeStreet: blank(DEMO_SITE_ADDRESS?.line1 ?? ""),
    placeSuburb: blank(DEMO_SITE_ADDRESS?.line2 ?? ""),
    placeCountry: "Australia",
    placePostcode: "",
    targetOfFumigation: Array.isArray(fd.targetOfFumigation) ? fd.targetOfFumigation : [],
    commodityDescription: blank(commodity?.description ?? commodityDescRaw ?? commodityId),
    commodityCode: blank(commodity?.commodityCode ?? pack.commodity?.commodity_code ?? ""),
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
    concentrationReadings: (() => {
      const saved = Array.isArray(fd.concentrationReadings) ? fd.concentrationReadings : [];
      const migrated = migrateLegacyReadings(saved, containerNumbers);
      return migrated.length > 0 ? migrated : defaultContainerReadings(containerNumbers);
    })(),
    finalTlvPpm1: blank(fd.finalTlvPpm1) || blank(fd.clearanceValue),
    finalTlvPpm2: blank(fd.finalTlvPpm2),
    finalTlvPpm3: blank(fd.finalTlvPpm3),
    topUpEntries: Array.isArray(fd.topUpEntries) ? fd.topUpEntries : [],

    // Section E — Declaration
    fumigationResult: blank(fd.fumigationResult),
    fumigatorSignature: fumigatorSignoff.signatureText,
    fumigatorSignatureImage: fumigatorSignoff.signatureImageUrl,
    governmentOfficerName: aoNameResolved,
    governmentOfficerNumber: governmentOfficerLicenseNumber,
    governmentOfficerLicenseNumber,
    governmentOfficerSignature: aoSignoff.signatureText,
    governmentOfficerSignatureImage: aoSignoff.signatureImageUrl,
    additionalDeclarations: blank(fd.additionalDeclarations),
    fumigationNotes: blank(fd.fumigationNotes),

    // Meta
    fumigant: resolveFumigantDisplayModel(fumigant, fumigantId, pack, fd),
    methodology: methodology
      ? { name: methodology.name, version: methodology.version, applicationMethods: methodology.applicationMethods ?? [], dosageGuide: methodology.dosageGuide, safetyNotes: methodology.safetyNotes }
      : { name: resolveMethodologyDisplayName(null, methodologyId, pack), version: "", applicationMethods: [], dosageGuide: "", safetyNotes: "" },
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

/** Resolve a record using reference data loaded from the API. */
export async function resolveFumigationRecordAsync(packId, packOverride = null) {
  const {
    fetchRecordTemplatesNormalized,
    fetchFumigantsNormalized,
    fetchMethodologiesNormalized,
  } = await import("@/lib/api/fumigation");
  const [recordTemplates, fumigants, methodologies] = await Promise.all([
    fetchRecordTemplatesNormalized(),
    fetchFumigantsNormalized(),
    fetchMethodologiesNormalized(),
  ]);
  return resolveFumigationRecord(packId, packOverride, { recordTemplates, fumigants, methodologies });
}
