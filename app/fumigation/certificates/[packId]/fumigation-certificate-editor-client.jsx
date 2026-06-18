"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import FumigationCertificateDocument from "@/components/fumigation/fumigation-certificate-document";
import {
  EditorToolbar,
  DocumentPreview,
  SectionCard,
  SectionHeading,
  FormField,
  inputClass,
} from "@/components/fumigation/fumigation-form-primitives";
import {
  saveFumigationCertSnapshot as saveCertSnapshot,
  loadFumigationCertSnapshot as loadCertSnapshot,
  saveCertificateIssue as issueCertificate,
} from "@/lib/fumigation-cert-storage";
import {
  resolveFumigationCertificate,
  resolveFumigationCertificateAsync,
  nextFumigationCertificateNumber,
  previewFumigationCertificateNumber,
} from "@/lib/fumigation-cert-print";
import { certSnapshotHasContent, mergeCertDraftFromPack, looksLikeUuid } from "@/lib/fumigation-detail";
import { getPack } from "@/lib/api/packing";
import { ENCLOSURE_TYPES, FUMIGATION_TARGETS } from "@/lib/fumigation-fields";
import { loadContactUsers } from "@/lib/contact-users-store";
import { filterAuthorisedOfficers } from "@/lib/user-classifications";
import {
  findContactUserByName,
  resolveSignoffFields,
} from "@/lib/fumigation-signatures";
import { SignatureDisplay } from "@/components/fumigation/fumigation-signoff-display";

// ─── Normalize snapshot to handle older fields ────────────────────────────────

function normalizeCert(m) {
  if (!m || typeof m !== "object") return null;
  return {
    certificateNumber: "",
    issuedDate: "",
    targetOfFumigation: [],
    enclosureType: "",
    enclosureOtherText: "",
    enclosureLengthM: "",
    enclosureWidthM: "",
    enclosureHeightM: "",
    volumeM3: "",
    consignmentSuitable: null,
    consignmentRemedialAction: "",
    prescribedDoseRate: "",
    prescribedDoseUnit: "g/m3",
    prescribedExposure: "",
    prescribedExposureUnit: "hours",
    prescribedTemperature: "",
    fumigationType: "ambient",
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
    actualTemperature: "",
    minForecastedTemperature: "",
    minAmbientTemperature: "",
    fumigationStartAt: "",
    dosingFinishAt: "",
    fumigationEndAt: "",
    ventilationStartAt: "",
    monitoringDeviceSerials: "",
    finalTlvPpm1: "",
    finalTlvPpm2: "",
    finalTlvPpm3: "",
    clearanceValue: "",
    fumigationResult: "",
    fumigatorSignature: "",
    fumigatorSignatureImage: "",
    governmentOfficerName: "",
    governmentOfficerNumber: "",
    governmentOfficerLicenseNumber: "",
    governmentOfficerSignature: "",
    governmentOfficerSignatureImage: "",
    additionalDeclarations: "",
    fumigationNotes: "",
    // From pack (pre-filled, user may override)
    fumigatorName: "",
    fumigatorAccreditationNumber: "",
    fumigatorLicenceNumber: "",
    treatmentProviderId: "",
    customerName: "",
    customerAddress: "",
    commodityDescription: "",
    commodityCountryOfOrigin: "",
    commodityQuantity: "",
    portOfLoading: "",
    destinationCountry: "",
    containerNumbers: [],
    sealNumbers: [],
    // Fumigant & methodology (non-editable display)
    fumigant: null,
    methodology: null,
    template: null,
    site: null,
    siteAddress: null,
    packRef: "",
    packId: null,
    ...m,
  };
}

function applySignoffFromSelection(prev, field, name, users) {
  if (field === "fumigator") {
    const sig = resolveSignoffFields(name, "", users);
    const fumigator = findContactUserByName(users, name);
    const licence = String(fumigator?.fumigatorLicence || "").trim();
    return {
      ...prev,
      fumigatorName: name,
      fumigatorSignature: sig.signatureText,
      fumigatorSignatureImage: sig.signatureImageUrl,
      fumigatorAccreditationNumber: licence || prev.fumigatorAccreditationNumber,
      fumigatorLicenceNumber: licence,
    };
  }
  const sig = resolveSignoffFields(name, "", users);
  const ao = findContactUserByName(users, name);
  const aoLicence = String(ao?.aoLicenseNumber || "").trim();
  return {
    ...prev,
    governmentOfficerName: name,
    governmentOfficerNumber: String(ao?.aoNumber || "").trim(),
    governmentOfficerLicenseNumber: aoLicence,
    governmentOfficerSignature: sig.signatureText,
    governmentOfficerSignatureImage: sig.signatureImageUrl,
  };
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function FumigationCertificateEditorClient({ packId }) {
  const router = useRouter();

  // Packs live on the backend now (UUID ids) — fetch the row, then resolve.
  const [packRow, setPackRow] = useState(null);
  const [packLoading, setPackLoading] = useState(true);

  const [cert, setCert] = useState(null);
  const [hydratedFromPack, setHydratedFromPack] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setPackLoading(true);
    setHydratedFromPack(false);
    getPack(packId)
      .then(async (row) => {
        if (cancelled || !row) return;
        setPackRow(row);
        const resolved = await resolveFumigationCertificateAsync(packId, row);
        const fromPack = normalizeCert(resolved);
        const snapshot = loadCertSnapshot(packId);
        const merged = normalizeCert(mergeCertDraftFromPack(fromPack, snapshot));
        const savedNumber = String(merged.certificateNumber ?? "").trim();
        const looksLikeUuidCert =
          savedNumber &&
          (looksLikeUuid(savedNumber) ||
            (String(packId).length > 10 && savedNumber.includes(String(packId))));
        if (!savedNumber || looksLikeUuidCert) {
          merged.certificateNumber = previewFumigationCertificateNumber(packId, row);
        }
        setCert(merged);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) {
          setPackLoading(false);
          setHydratedFromPack(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [packId]);

  // Auto-save snapshot after pack data has been merged in
  useEffect(() => {
    if (!hydratedFromPack || !cert) return;
    saveCertSnapshot(packId, cert);
  }, [cert, packId, hydratedFromPack]);

  const set = useCallback((field, value) => {
    setCert((prev) => ({ ...prev, [field]: value }));
  }, []);

  const contactUsers = useMemo(() => loadContactUsers(), []);
  const fumigatorOptions = useMemo(
    () => contactUsers.filter((u) => u && u.isFumigator && u.active !== false),
    [contactUsers],
  );
  const aoOptions = useMemo(() => filterAuthorisedOfficers(contactUsers), [contactUsers]);

  const refreshFromPack = useCallback(async () => {
    if (!packRow) return;
    const fresh = await resolveFumigationCertificateAsync(packId, packRow);
    if (fresh) {
      setCert(normalizeCert(mergeCertDraftFromPack(fresh, cert)));
    }
  }, [packId, packRow, cert]);

  const handleSaveAndPrint = useCallback(() => {
    const number = nextFumigationCertificateNumber(packId, packRow);
    const issued = cert?.issuedDate || new Date().toLocaleDateString("en-AU");
    const final = { ...cert, certificateNumber: number, issuedDate: issued };
    setCert(final);
    saveCertSnapshot(packId, final);
    const issuedAt = issueCertificate(packId, final);
    router.push(
      `/fumigation/certificates/${packId}/print?issuedAt=${encodeURIComponent(issuedAt)}`
    );
  }, [cert, packId, packRow, router]);

  const handleDiscard = useCallback(async () => {
    if (!packRow) return;
    const fresh = await resolveFumigationCertificateAsync(packId, packRow);
    if (fresh) {
      setCert(normalizeCert(fresh));
    }
  }, [packId, packRow]);

  if (!cert) {
    if (packLoading) {
      return (
        <div className="px-4 py-16 text-center text-sm text-slate-600">
          Loading pack…
        </div>
      );
    }
    return (
      <div className="px-4 py-16 text-center text-sm text-slate-600">
        No pack found for ID {packId}.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <EditorToolbar
        title={`Certificate editor — ${cert.packRef || packId}`}
        subtitle={cert.fumigant?.name ? `Fumigant: ${cert.fumigant.name}` : undefined}
        onSaveAndPrint={handleSaveAndPrint}
        onRefreshFromPack={refreshFromPack}
        onDiscard={handleDiscard}
        onBackToPack={() =>
          router.push(`/packing-schedule/new-pack-form?mode=edit&id=${packId}&tab=fumigation`)
        }
      />

      <div className="mx-auto grid max-w-screen-xl grid-cols-1 gap-6 px-4 py-6 xl:grid-cols-[1fr_440px]">

        {/* ── FORM ── */}
        <div className="space-y-5">

          {/* Consignment details */}
          <SectionCard>
            <SectionHeading>Consignment details (pre-filled from pack)</SectionHeading>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FormField label="Container number(s)">
                <input
                  className={inputClass}
                  value={(cert.containerNumbers ?? []).join(", ")}
                  onChange={(e) => set("containerNumbers", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))}
                  placeholder="e.g. ABCU1234567"
                />
              </FormField>
              <FormField label="Seal number(s)">
                <input
                  className={inputClass}
                  value={(cert.sealNumbers ?? []).join(", ")}
                  onChange={(e) => set("sealNumbers", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))}
                  placeholder="e.g. SL12345"
                />
              </FormField>
              <FormField label="Client name">
                <input className={inputClass} value={cert.customerName ?? ""} onChange={(e) => set("customerName", e.target.value)} />
              </FormField>
              <FormField label="Commodity description">
                <input className={inputClass} value={cert.commodityDescription ?? ""} onChange={(e) => set("commodityDescription", e.target.value)} />
              </FormField>
              <FormField label="Country of origin">
                <input className={inputClass} value={cert.commodityCountryOfOrigin ?? ""} onChange={(e) => set("commodityCountryOfOrigin", e.target.value)} />
              </FormField>
              <FormField label="Commodity quantity">
                <input className={inputClass} value={cert.commodityQuantity ?? ""} onChange={(e) => set("commodityQuantity", e.target.value)} placeholder="e.g. 20 t" />
              </FormField>
              <FormField label="Port of loading">
                <input className={inputClass} value={cert.portOfLoading ?? ""} onChange={(e) => set("portOfLoading", e.target.value)} />
              </FormField>
              <FormField label="Destination country">
                <input className={inputClass} value={cert.destinationCountry ?? ""} onChange={(e) => set("destinationCountry", e.target.value)} />
              </FormField>
            </div>
          </SectionCard>

          {/* Fumigator details */}
          <SectionCard>
            <SectionHeading>Fumigator details (pre-filled from pack)</SectionHeading>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FormField label="Treatment provider ID">
                <input className={inputClass} value={cert.treatmentProviderId ?? ""} onChange={(e) => set("treatmentProviderId", e.target.value)} />
              </FormField>
              <FormField label="Fumigator name">
                <select
                  className={inputClass}
                  value={cert.fumigatorName ?? ""}
                  onChange={(e) => {
                    const name = e.target.value;
                    setCert((prev) => applySignoffFromSelection(prev, "fumigator", name, contactUsers));
                  }}
                >
                  <option value="">— select fumigator —</option>
                  {fumigatorOptions.map((u) => (
                    <option key={u.id ?? u.name} value={u.name}>
                      {u.name}
                      {u.fumigatorLicence ? ` (${u.fumigatorLicence})` : ""}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="Fumigator licence number">
                <input
                  className={inputClass}
                  value={cert.fumigatorLicenceNumber ?? cert.fumigatorAccreditationNumber ?? ""}
                  onChange={(e) => {
                    const value = e.target.value;
                    setCert((prev) => ({
                      ...prev,
                      fumigatorLicenceNumber: value,
                      fumigatorAccreditationNumber: value,
                    }));
                  }}
                  placeholder="Pre-filled from fumigator profile"
                />
              </FormField>
            </div>
          </SectionCard>

          {/* Target & enclosure */}
          <SectionCard>
            <SectionHeading>Target of fumigation &amp; enclosure</SectionHeading>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FormField label="Target of fumigation" wide>
                <div className="flex flex-wrap gap-3 pt-0.5">
                  {FUMIGATION_TARGETS.map((t) => (
                    <label key={t.value} className="flex items-center gap-1.5 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={(cert.targetOfFumigation ?? []).includes(t.value)}
                        onChange={(e) => {
                          const prev = cert.targetOfFumigation ?? [];
                          set("targetOfFumigation", e.target.checked ? [...prev, t.value] : prev.filter((v) => v !== t.value));
                        }}
                      />
                      {t.label}
                    </label>
                  ))}
                </div>
              </FormField>
              <FormField label="Enclosure type" wide>
                <div className="flex flex-wrap gap-3 pt-0.5">
                  {ENCLOSURE_TYPES.map((e) => (
                    <label key={e.value} className="flex items-center gap-1.5 text-sm cursor-pointer">
                      <input
                        type="radio"
                        name="enclosureType"
                        value={e.value}
                        checked={cert.enclosureType === e.value}
                        onChange={() => set("enclosureType", e.value)}
                      />
                      {e.label}
                    </label>
                  ))}
                </div>
              </FormField>
              {cert.enclosureType === "other" && (
                <FormField label="Other enclosure description">
                  <input className={inputClass} value={cert.enclosureOtherText ?? ""} onChange={(e) => set("enclosureOtherText", e.target.value)} />
                </FormField>
              )}
              <FormField label="Enclosure dimensions (L × W × H) m">
                <div className="flex gap-2">
                  <input className={inputClass} value={cert.enclosureLengthM ?? ""} onChange={(e) => set("enclosureLengthM", e.target.value)} placeholder="L" />
                  <input className={inputClass} value={cert.enclosureWidthM ?? ""} onChange={(e) => set("enclosureWidthM", e.target.value)} placeholder="W" />
                  <input className={inputClass} value={cert.enclosureHeightM ?? ""} onChange={(e) => set("enclosureHeightM", e.target.value)} placeholder="H" />
                </div>
              </FormField>
              <FormField label="Volume (m3)">
                <input className={inputClass} value={cert.volumeM3 ?? ""} onChange={(e) => set("volumeM3", e.target.value)} type="number" step="0.1" />
              </FormField>
              <FormField label="Consignment suitability">
                <div className="flex gap-4 pt-1">
                  {[{ v: true, l: "Yes" }, { v: false, l: "No" }].map(({ v, l }) => (
                    <label key={l} className="flex items-center gap-1.5 text-sm cursor-pointer">
                      <input type="radio" name="consignmentSuitable" checked={cert.consignmentSuitable === v} onChange={() => set("consignmentSuitable", v)} />
                      {l}
                    </label>
                  ))}
                </div>
              </FormField>
              {cert.consignmentSuitable === false && (
                <FormField label="Remedial action taken" wide>
                  <textarea className={inputClass} rows={2} value={cert.consignmentRemedialAction ?? ""} onChange={(e) => set("consignmentRemedialAction", e.target.value)} />
                </FormField>
              )}
            </div>
          </SectionCard>

          {/* Prescribed + applied treatment */}
          <SectionCard>
            <SectionHeading>Treatment schedule</SectionHeading>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FormField label="Prescribed dose rate (g/m3)">
                <input className={inputClass} type="number" step="0.1" value={cert.prescribedDoseRate ?? ""} onChange={(e) => set("prescribedDoseRate", e.target.value)} />
              </FormField>
              <FormField label="Prescribed exposure (hours)">
                <input className={inputClass} type="number" step="1" value={cert.prescribedExposure ?? ""} onChange={(e) => set("prescribedExposure", e.target.value)} />
              </FormField>
              <FormField label="Prescribed min temp (°C)">
                <input className={inputClass} type="number" step="0.5" value={cert.prescribedTemperature ?? ""} onChange={(e) => set("prescribedTemperature", e.target.value)} />
              </FormField>
              <FormField label="Fumigation type">
                <div className="flex gap-4 pt-1">
                  {[{ v: "ambient", l: "Ambient temperature" }, { v: "controlled", l: "Controlled temperature" }].map(({ v, l }) => (
                    <label key={v} className="flex items-center gap-1.5 text-sm cursor-pointer">
                      <input type="radio" name="fumigationType" checked={cert.fumigationType === v} onChange={() => set("fumigationType", v)} />
                      {l}
                    </label>
                  ))}
                </div>
              </FormField>
              <FormField label="Min forecast temperature (°C)">
                <input className={inputClass} type="number" step="0.5" value={cert.minForecastedTemperature ?? ""} onChange={(e) => set("minForecastedTemperature", e.target.value)} />
              </FormField>
              <FormField label="Actual temperature at start (°C)">
                <input className={inputClass} type="number" step="0.5" value={cert.actualTemperature ?? ""} onChange={(e) => set("actualTemperature", e.target.value)} />
              </FormField>
              <FormField label="Applied dose rate (g/m3)">
                <input className={inputClass} type="number" step="0.1" value={cert.dosageValue ?? ""} onChange={(e) => set("dosageValue", e.target.value)} />
              </FormField>
              <FormField label="Applied exposure (hours)">
                <input className={inputClass} type="number" step="1" value={cert.exposureTimeValue ?? ""} onChange={(e) => set("exposureTimeValue", e.target.value)} />
              </FormField>
              <FormField label="Calculated dose (g)">
                <input className={inputClass} type="number" step="0.1" value={cert.calculatedDosageValue ?? ""} onChange={(e) => set("calculatedDosageValue", e.target.value)} />
              </FormField>
              <FormField label="Amount of fumigant applied (g)">
                <input className={inputClass} type="number" step="0.1" value={cert.actualDosageAppliedValue ?? ""} onChange={(e) => set("actualDosageAppliedValue", e.target.value)} />
              </FormField>
              <FormField label="Chloropicrin used?">
                <div className="flex gap-4 pt-1">
                  {[{ v: true, l: "Yes" }, { v: false, l: "No" }].map(({ v, l }) => (
                    <label key={l} className="flex items-center gap-1.5 text-sm cursor-pointer">
                      <input type="radio" name="chloropicrin" checked={cert.chloropicrinUsed === v} onChange={() => set("chloropicrinUsed", v)} />
                      {l}
                    </label>
                  ))}
                </div>
              </FormField>
              {cert.chloropicrinUsed === true && (
                <FormField label="Chloropicrin %">
                  <input className={inputClass} type="number" step="0.1" value={cert.chloropicrinPercent ?? ""} onChange={(e) => set("chloropicrinPercent", e.target.value)} />
                </FormField>
              )}
              <FormField label="Heaters used?">
                <div className="flex gap-4 pt-1">
                  {[{ v: true, l: "Yes" }, { v: false, l: "No" }].map(({ v, l }) => (
                    <label key={l} className="flex items-center gap-1.5 text-sm cursor-pointer">
                      <input type="radio" name="heaters" checked={cert.heatersUsed === v} onChange={() => set("heatersUsed", v)} />
                      {l}
                    </label>
                  ))}
                </div>
              </FormField>
            </div>
          </SectionCard>

          {/* End-point & CT (SF; harmless for MBR) */}
          <SectionCard>
            <SectionHeading>End-point concentration &amp; CT</SectionHeading>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FormField label="End-point concentration (g/m3)">
                <input className={inputClass} type="number" step="0.01" value={cert.endPointConcentration ?? ""} onChange={(e) => set("endPointConcentration", e.target.value)} />
              </FormField>
              <FormField label="CT required (g·h/m3)">
                <input className={inputClass} type="number" step="0.1" value={cert.ctRequired ?? ""} onChange={(e) => set("ctRequired", e.target.value)} />
              </FormField>
              <FormField label="CT achieved (g·h/m3)">
                <input className={inputClass} type="number" step="0.1" value={cert.ctAchieved ?? ""} onChange={(e) => set("ctAchieved", e.target.value)} />
              </FormField>
              <FormField label="Approved 3rd-party CT system?">
                <label className="flex items-center gap-1.5 text-sm pt-1 cursor-pointer">
                  <input type="checkbox" checked={Boolean(cert.thirdPartySystem)} onChange={(e) => set("thirdPartySystem", e.target.checked)} />
                  Used
                </label>
              </FormField>
              {cert.thirdPartySystem && (
                <FormField label="3rd-party system name" wide>
                  <input className={inputClass} value={cert.thirdPartySystemName ?? ""} onChange={(e) => set("thirdPartySystemName", e.target.value)} />
                </FormField>
              )}
            </div>
          </SectionCard>

          {/* Times */}
          <SectionCard>
            <SectionHeading>Treatment times</SectionHeading>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FormField label="Fumigation commenced (dd/mm/yyyy HH:MM)">
                <input className={inputClass} type="datetime-local" value={cert.fumigationStartAt ?? ""} onChange={(e) => set("fumigationStartAt", e.target.value)} />
              </FormField>
              <FormField label="Fumigant injection finished">
                <input className={inputClass} type="datetime-local" value={cert.dosingFinishAt ?? ""} onChange={(e) => set("dosingFinishAt", e.target.value)} />
              </FormField>
              <FormField label="Fumigation completed">
                <input className={inputClass} type="datetime-local" value={cert.fumigationEndAt ?? ""} onChange={(e) => set("fumigationEndAt", e.target.value)} />
              </FormField>
              <FormField label="Enclosure ventilation start">
                <input className={inputClass} type="datetime-local" value={cert.ventilationStartAt ?? ""} onChange={(e) => set("ventilationStartAt", e.target.value)} />
              </FormField>
            </div>
          </SectionCard>

          {/* Clearance */}
          <SectionCard>
            <SectionHeading>Monitoring &amp; clearance</SectionHeading>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FormField label="Monitoring device serial(s)" wide>
                <input className={inputClass} value={cert.monitoringDeviceSerials ?? ""} onChange={(e) => set("monitoringDeviceSerials", e.target.value)} placeholder="Comma-separated serials" />
              </FormField>
              <FormField label="Final TLV reading 1 (ppm)">
                <input className={inputClass} type="number" step="0.1" value={cert.finalTlvPpm1 ?? ""} onChange={(e) => set("finalTlvPpm1", e.target.value)} />
              </FormField>
              <FormField label="Final TLV reading 2 (ppm)">
                <input className={inputClass} type="number" step="0.1" value={cert.finalTlvPpm2 ?? ""} onChange={(e) => set("finalTlvPpm2", e.target.value)} />
              </FormField>
              <FormField label="Final TLV reading 3 (ppm)">
                <input className={inputClass} type="number" step="0.1" value={cert.finalTlvPpm3 ?? ""} onChange={(e) => set("finalTlvPpm3", e.target.value)} />
              </FormField>
            </div>
          </SectionCard>

          {/* Declaration */}
          <SectionCard>
            <SectionHeading>Declaration &amp; result</SectionHeading>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FormField label="Fumigation result">
                <select className={inputClass} value={cert.fumigationResult ?? ""} onChange={(e) => set("fumigationResult", e.target.value)}>
                  <option value="">— select —</option>
                  <option value="pass">Pass</option>
                  <option value="fail">Fail</option>
                </select>
              </FormField>
              <FormField label="Fumigator in charge">
                <select
                  className={inputClass}
                  value={cert.fumigatorName ?? ""}
                  onChange={(e) => {
                    const name = e.target.value;
                    setCert((prev) => applySignoffFromSelection(prev, "fumigator", name, contactUsers));
                  }}
                >
                  <option value="">— select fumigator —</option>
                  {fumigatorOptions.map((u) => (
                    <option key={u.id ?? u.name} value={u.name}>
                      {u.name}
                      {u.fumigatorLicence ? ` (${u.fumigatorLicence})` : ""}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="Fumigator licence number">
                <input
                  className={inputClass}
                  value={cert.fumigatorLicenceNumber ?? cert.fumigatorAccreditationNumber ?? ""}
                  onChange={(e) => {
                    const value = e.target.value;
                    setCert((prev) => ({
                      ...prev,
                      fumigatorLicenceNumber: value,
                      fumigatorAccreditationNumber: value,
                    }));
                  }}
                  placeholder="Pre-filled from fumigator profile"
                />
              </FormField>
              <FormField label="Authorised officer">
                <select
                  className={inputClass}
                  value={cert.governmentOfficerName ?? ""}
                  onChange={(e) => {
                    const name = e.target.value;
                    setCert((prev) => applySignoffFromSelection(prev, "ao", name, contactUsers));
                  }}
                >
                  <option value="">— select AO —</option>
                  {aoOptions.map((u) => (
                    <option key={u.id ?? u.name} value={u.name}>
                      {u.name}
                      {u.aoNumber ? ` (${u.aoNumber})` : ""}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="AO licence number">
                <input
                  className={inputClass}
                  value={cert.governmentOfficerLicenseNumber ?? ""}
                  onChange={(e) => set("governmentOfficerLicenseNumber", e.target.value)}
                  placeholder="Pre-filled from AO profile"
                />
              </FormField>
              <FormField label="Fumigator signature">
                <SignatureDisplay
                  text={cert.fumigatorSignature}
                  imageUrl={cert.fumigatorSignatureImage}
                  className="min-h-[3rem] rounded border border-slate-200 bg-white px-2 py-1"
                />
              </FormField>
              <FormField label="AO signature">
                <SignatureDisplay
                  text={cert.governmentOfficerSignature}
                  imageUrl={cert.governmentOfficerSignatureImage}
                  className="min-h-[3rem] rounded border border-slate-200 bg-white px-2 py-1"
                />
              </FormField>
              <FormField label="Additional declarations" wide>
                <textarea className={inputClass} rows={3} value={cert.additionalDeclarations ?? ""} onChange={(e) => set("additionalDeclarations", e.target.value)} />
              </FormField>
              <FormField label="Notes (internal)" wide>
                <textarea className={inputClass} rows={2} value={cert.fumigationNotes ?? ""} onChange={(e) => set("fumigationNotes", e.target.value)} />
              </FormField>
            </div>
          </SectionCard>

        </div>

        {/* ── LIVE PREVIEW ── */}
        <DocumentPreview>
          <FumigationCertificateDocument model={cert} hideToolbar />
        </DocumentPreview>

      </div>
    </div>
  );
}
