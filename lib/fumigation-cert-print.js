import { findDosageBandForTemp } from "@/lib/fumigation-dosage-bands";
import {
  CUSTOMER_CONTACT_ROWS,
  COMMODITY_MASTER_ROWS,
} from "@/lib/Data";
import {
  loadFumigants,
  loadMethodologies,
  loadCertificateTemplates,
  DEFAULT_FUMIGANTS,
  DEFAULT_METHODOLOGIES,
  DEFAULT_CERTIFICATE_TEMPLATES,
} from "@/lib/fumigation-store";
import { DEMO_SITE, DEMO_SITE_ADDRESS } from "@/lib/demo-in-ticket-data";
import { normalizeFumigationDetail } from "@/lib/fumigation-detail";
import { loadContactUsers } from "@/lib/contact-users-store";
import {
  findContactUserByName,
  resolveSignoffFields,
} from "@/lib/fumigation-signatures";
import { totalPackedNettWeight } from "@/lib/packers-container-validation";

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
    fumigatorSignature: "",
    fumigatorLicenceNumber: "",
    fumigationResult: "",
    governmentOfficerName: "",
    governmentOfficerNumber: "",
    governmentOfficerLicenseNumber: "",
    governmentOfficerSignature: "",
    additionalDeclarations: "",
    fumigationNotes: "",
    specificDosageRateValue: "",
    specificDosageRateUnit: "g/m3",
  };
}

// ─── Certificate resolver ─────────────────────────────────────────────────────

export function resolveFumigationCertificate(packId, packOverride = null, options = {}) {
  const pack = packOverride ?? null;
  if (!pack) return null;

  const certTemplates =
    options.certificateTemplates ??
    (typeof window !== "undefined" ? loadCertificateTemplates() : DEFAULT_CERTIFICATE_TEMPLATES);
  const sameId = (a, b) => a != null && b != null && String(a) === String(b);
  const fumigantId = pack.fumigantId ?? pack.fumigant_id;
  const methodologyId = pack.methodologyId ?? pack.methodology_id;
  const certificateTemplateId = pack.certificateTemplateId ?? pack.certificate_template_id;
  const customerId = pack.customerId ?? pack.customer_id;
  const commodityId = pack.commodityId ?? pack.commodity_id;
  const customerNameRaw =
    pack.customer && typeof pack.customer === "object" ? pack.customer.name : pack.customer;
  const commodityDescRaw =
    pack.commodity && typeof pack.commodity === "object" ? pack.commodity.description : pack.commodity;
  const jobReference = pack.jobReference ?? pack.job_reference;
  const rawDetail = normalizeFumigationDetail(pack.fumigationDetail ?? pack.fumigation_detail);

  const fumigants =
    typeof window !== "undefined" ? loadFumigants() : DEFAULT_FUMIGANTS;
  const methodologies =
    typeof window !== "undefined" ? loadMethodologies() : DEFAULT_METHODOLOGIES;

  const fumigant = fumigants.find((f) => sameId(f.id, fumigantId)) ?? null;
  const methodology =
    methodologies.find((m) => sameId(m.id, methodologyId)) ?? null;
  const template =
    certTemplates.find((t) => sameId(t.id, certificateTemplateId)) ??
    certTemplates[0] ??
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

  const containerNumbers = Array.isArray(pack.containers)
    ? pack.containers.map((c) => blank(c.containerNumber || c.container_number || c.containerNo)).filter(Boolean)
    : [];
  const sealNumbers = Array.isArray(pack.containers)
    ? pack.containers.map((c) => blank(c.sealNumber || c.seal_number || c.sealNo)).filter(Boolean)
    : [];

  // Prescribed dose from matched dosage range when pack hasn't filled it
  const matchedRange = (() => {
    if (!methodology?.dosageRanges?.length) return null;
    const tRaw = fd.actualTemperature ?? fd.minAmbientTemperature ?? fd.minForecastedTemperature;
    return findDosageBandForTemp(methodology.dosageRanges, tRaw);
  })();

  return {
    packId,
    packRef: blank(jobReference) || `PACK-${String(packId).padStart(6, "0")}`,
    certificateNumber: "",               // auto-filled on issue
    issuedDate: formatDateOnly(new Date().toISOString()),

    // Treatment provider / fumigator identity
    treatmentProviderId: blank(pack.treatmentProviderId ?? pack.treatment_provider_id),
    fumigatorName: blank(fd.fumigatorName),
    fumigatorAccreditationNumber: fumigatorLicenceNumber,
    fumigatorLicenceNumber,

    // Consignment
    customerName: blank(customer?.name ?? customerNameRaw),
    customerAddress: blank(customer?.addresses?.[0] ?? customer?.address ?? ""),
    commodityDescription: blank(commodity?.description ?? commodityDescRaw ?? commodityId),
    commodityCode: blank(commodity?.commodityCode ?? pack.commodity?.commodity_code ?? ""),
    commodityCountryOfOrigin: blank(pack.commodityCountryOfOrigin ?? pack.commodity_country_of_origin ?? commodity?.countryOfOrigin ?? ""),
    commodityQuantity: (() => {
      const completedMt = totalPackedNettWeight(pack.containers);
      if (completedMt > 0) return String(Number(completedMt.toFixed(3)));
      return blank(fd.actualTonnage || (pack.mtTotal ?? pack.mt_total));
    })(),
    portOfLoading: blank(pack.portOfLoading ?? pack.port_of_loading),
    destinationCountry: blank(pack.destinationCountry ?? pack.destination_country),
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
    fumigatorSignature: fumigatorSignoff.signatureText,
    fumigatorSignatureImage: fumigatorSignoff.signatureImageUrl,
    governmentOfficerName: aoNameResolved,
    governmentOfficerNumber: governmentOfficerLicenseNumber,
    governmentOfficerLicenseNumber,
    governmentOfficerSignature: aoSignoff.signatureText,
    governmentOfficerSignatureImage: aoSignoff.signatureImageUrl,
    // Pack-level override wins; fall back to the template's boilerplate text.
    additionalDeclarations: blank(fd.additionalDeclarations) || blank(template?.additionalDeclarationsText),
    fumigationNotes: blank(fd.fumigationNotes),

    // Fumigant & methodology
    fumigant: fumigant
      ? {
          name: fumigant.name,
          code: fumigant.code,
          activeConstituent: fumigant.activeConstituent,
          productForm: fumigant.productForm,
        }
      : { name: blank(fumigantId), code: "", activeConstituent: "", productForm: "" },
    methodology: methodology
      ? {
          name: methodology.name,
          version: methodology.version,
          applicationMethods: methodology.applicationMethods ?? [],
          dosageGuide: methodology.dosageGuide,
          safetyNotes: methodology.safetyNotes,
        }
      : { name: blank(methodologyId), version: "", applicationMethods: [], dosageGuide: "", safetyNotes: "" },

    template: template ?? {
      id: null, name: "Default", headerText: "", footerText: "", body: "", fields: [],
    },
    site: DEMO_SITE,
    siteAddress: DEMO_SITE_ADDRESS,
  };
}

/** Resolve a certificate using templates loaded from the API (logos, sections, footer). */
export async function resolveFumigationCertificateAsync(packId, packOverride = null) {
  const { fetchCertificateTemplatesNormalized } = await import("@/lib/api/fumigation");
  const certificateTemplates = await fetchCertificateTemplatesNormalized();
  return resolveFumigationCertificate(packId, packOverride, { certificateTemplates });
}
