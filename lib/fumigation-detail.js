/** Map snake_case fumigation_detail keys from the API to camelCase form keys. */
const SNAKE_TO_CAMEL = {
  application_method: "applicationMethod",
  fumigation_type: "fumigationType",
  target_of_fumigation: "targetOfFumigation",
  enclosure_type: "enclosureType",
  enclosure_other_text: "enclosureOtherText",
  enclosure_description: "enclosureDescription",
  enclosure_length_m: "enclosureLengthM",
  enclosure_width_m: "enclosureWidthM",
  enclosure_height_m: "enclosureHeightM",
  volume_m3: "volumeM3",
  consignment_suitable: "consignmentSuitable",
  consignment_remedial_action: "consignmentRemedialAction",
  actual_tonnage: "actualTonnage",
  min_forecasted_temperature: "minForecastedTemperature",
  min_ambient_temperature: "minAmbientTemperature",
  actual_temperature: "actualTemperature",
  prescribed_dose_rate: "prescribedDoseRate",
  prescribed_dose_unit: "prescribedDoseUnit",
  prescribed_exposure: "prescribedExposure",
  prescribed_exposure_unit: "prescribedExposureUnit",
  prescribed_temperature: "prescribedTemperature",
  dosage_value: "dosageValue",
  dosage_unit: "dosageUnit",
  calculated_dosage_value: "calculatedDosageValue",
  calculated_dosage_unit: "calculatedDosageUnit",
  actual_dosage_applied_value: "actualDosageAppliedValue",
  actual_dosage_applied_unit: "actualDosageAppliedUnit",
  chloropicrin_used: "chloropicrinUsed",
  chloropicrin_percent: "chloropicrinPercent",
  heaters_used: "heatersUsed",
  end_point_concentration: "endPointConcentration",
  end_point_concentration_unit: "endPointConcentrationUnit",
  ct_required: "ctRequired",
  ct_achieved: "ctAchieved",
  third_party_system: "thirdPartySystem",
  third_party_system_name: "thirdPartySystemName",
  exposure_time_value: "exposureTimeValue",
  exposure_time_unit: "exposureTimeUnit",
  fumigation_start_at: "fumigationStartAt",
  dosing_finish_at: "dosingFinishAt",
  fumigation_end_at: "fumigationEndAt",
  ventilation_start_at: "ventilationStartAt",
  monitoring_device_serials: "monitoringDeviceSerials",
  final_tlv_ppm1: "finalTlvPpm1",
  final_tlv_ppm2: "finalTlvPpm2",
  final_tlv_ppm3: "finalTlvPpm3",
  clearance_value: "clearanceValue",
  top_up_entries: "topUpEntries",
  fumigator_name: "fumigatorName",
  fumigation_result: "fumigationResult",
  government_officer_name: "governmentOfficerName",
  government_officer_signature: "governmentOfficerSignature",
  fumigator_signature: "fumigatorSignature",
  government_officer_number: "governmentOfficerNumber",
  government_officer_license_number: "governmentOfficerLicenseNumber",
  fumigator_licence_number: "fumigatorLicenceNumber",
  additional_declarations: "additionalDeclarations",
  fumigation_notes: "fumigationNotes",
  specific_dosage_rate_value: "specificDosageRateValue",
  specific_dosage_rate_unit: "specificDosageRateUnit",
  fumigant_name: "fumigantName",
};

/**
 * Normalize pack fumigation_detail JSON (string, snake_case keys, or camelCase) for UI resolvers.
 */
export function normalizeFumigationDetail(raw) {
  if (raw == null) return null;

  let detail = raw;
  if (typeof raw === "string") {
    try {
      detail = JSON.parse(raw);
    } catch {
      return null;
    }
  }

  if (typeof detail !== "object" || Array.isArray(detail)) return null;

  const out = {};
  for (const [key, value] of Object.entries(detail)) {
    const camelKey = SNAKE_TO_CAMEL[key] ?? key;
    out[camelKey] = value;
  }
  return out;
}

/** True when a saved certificate draft has meaningful content (not just empty defaults). */
export function certSnapshotHasContent(snapshot) {
  if (!snapshot || typeof snapshot !== "object") return false;
  const indicators = [
    "prescribedDoseRate",
    "prescribedExposure",
    "dosageValue",
    "exposureTimeValue",
    "actualTemperature",
    "calculatedDosageValue",
    "actualDosageAppliedValue",
    "fumigatorName",
    "customerName",
    "certificateNumber",
  ];
  return indicators.some((key) => String(snapshot[key] ?? "").trim() !== "");
}

/** Merge a pack-resolved certificate with an optional session draft. Pack data wins. */
export function mergeCertDraftFromPack(fromPack, snapshot) {
  if (!fromPack) return null;
  if (!snapshot) return fromPack;
  return {
    ...snapshot,
    ...fromPack,
    certificateNumber: snapshot.certificateNumber ?? fromPack.certificateNumber ?? "",
    issuedDate: snapshot.issuedDate ?? fromPack.issuedDate ?? "",
    template: fromPack.template ?? snapshot.template,
  };
}
