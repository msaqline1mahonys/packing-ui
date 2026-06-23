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
import { normalizeFumigationDetail, resolveFumigantDisplayModel, resolveMethodologyDisplayName } from "@/lib/fumigation-detail";
import { loadContactUsers } from "@/lib/contact-users-store";
import {
  findContactUserByName,
  resolveSignoffFields,
} from "@/lib/fumigation-signatures";
import { totalPackedNettWeight } from "@/lib/packers-container-validation";
import { filterOperationalContainers, getContainerNumberFromRecord, getSealNumberFromContainerRecord } from "@/lib/packers-work-store";

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

/** Human-readable pack segment for CERT-{pack}-{seq} (pack number / job ref — never UUID). */
export function formatCertNumberPackSegment(pack) {
  const packNumber = blank(pack?.packNumber ?? pack?.pack_number);
  const jobReference = blank(pack?.jobReference ?? pack?.job_reference);
  const raw = packNumber || jobReference;
  if (!raw) return "000000";
  const digitsOnly = raw.replace(/\D/g, "");
  if (digitsOnly) return digitsOnly.padStart(6, "0");
  return raw.replace(/[^a-zA-Z0-9-]/g, "").slice(0, 12).toUpperCase();
}

function certSeqStorageKey(packId) {
  return `packing-ui-cert-seq-${packId}`;
}

/** Next sequence for this pack without incrementing (preview / draft). */
export function previewFumigationCertificateNumber(packId, pack) {
  if (typeof window === "undefined") return "";
  const seq = Number(window.localStorage.getItem(certSeqStorageKey(packId)) || 0) + 1;
  return `CERT-${formatCertNumberPackSegment(pack)}-${String(seq).padStart(3, "0")}`;
}

/** Allocate and persist the next certificate number for this pack. */
export function nextFumigationCertificateNumber(packId, pack) {
  if (typeof window === "undefined") return "";
  const key = certSeqStorageKey(packId);
  const seq = Number(window.localStorage.getItem(key) || 0) + 1;
  window.localStorage.setItem(key, String(seq));
  return `CERT-${formatCertNumberPackSegment(pack)}-${String(seq).padStart(3, "0")}`;
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

  const operationalContainers = filterOperationalContainers(pack.containers);
  const containerNumbers = operationalContainers.map((c) => getContainerNumberFromRecord(c)).filter(Boolean);
  const sealNumbers = operationalContainers.map((c) => getSealNumberFromContainerRecord(c)).filter(Boolean);

  // Prescribed dose from matched dosage range when pack hasn't filled it
  const matchedRange = (() => {
    if (!methodology?.dosageRanges?.length) return null;
    const tRaw = fd.actualTemperature ?? fd.minAmbientTemperature ?? fd.minForecastedTemperature;
    return findDosageBandForTemp(methodology.dosageRanges, tRaw);
  })();

  const packNumber = blank(pack.packNumber ?? pack.pack_number);
  const packRef =
    blank(jobReference) || packNumber || `PACK-${formatCertNumberPackSegment(pack)}`;

  return {
    packId,
    packRef,
    packNumber,
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
    fumigant: resolveFumigantDisplayModel(fumigant, fumigantId, pack, fd),
    methodology: methodology
      ? {
          name: methodology.name,
          version: methodology.version,
          applicationMethods: methodology.applicationMethods ?? [],
          dosageGuide: methodology.dosageGuide,
          safetyNotes: methodology.safetyNotes,
        }
      : {
          name: resolveMethodologyDisplayName(null, methodologyId, pack),
          version: "",
          applicationMethods: [],
          dosageGuide: "",
          safetyNotes: "",
        },

    template: template ?? {
      id: null, name: "Default", headerText: "", footerText: "", body: "", fields: [],
    },
    site: DEMO_SITE,
    siteAddress: DEMO_SITE_ADDRESS,
  };
}

/** Resolve a certificate using reference data loaded from the API. */
export async function resolveFumigationCertificateAsync(packId, packOverride = null) {
  const {
    fetchCertificateTemplatesNormalized,
    fetchFumigantsNormalized,
    fetchMethodologiesNormalized,
  } = await import("@/lib/api/fumigation");
  const [certificateTemplates, fumigants, methodologies] = await Promise.all([
    fetchCertificateTemplatesNormalized(),
    fetchFumigantsNormalized(),
    fetchMethodologiesNormalized(),
  ]);
  return resolveFumigationCertificate(packId, packOverride, {
    certificateTemplates,
    fumigants,
    methodologies,
  });
}
