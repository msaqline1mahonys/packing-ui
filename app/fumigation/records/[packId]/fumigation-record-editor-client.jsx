"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import FumigationRecordDocument from "@/components/fumigation/fumigation-record-document";
import {
  EditorToolbar,
  DocumentPreview,
  SectionCard,
  SectionHeading,
  FormField,
  inputClass,
} from "@/components/fumigation/fumigation-form-primitives";
import {
  saveFumigationRecordSnapshot as saveRecordSnapshot,
  loadFumigationRecordSnapshot as loadRecordSnapshot,
  saveRecordIssue as issueRecord,
} from "@/lib/fumigation-record-storage";
import { resolveFumigationRecord, resolveFumigationRecordAsync } from "@/lib/fumigation-record-print";
import { mergeCertDraftFromPack, normalizeFumigationDetail, sectionDFieldsFromRecord } from "@/lib/fumigation-detail";
import { getPack, updatePack } from "@/lib/api/packing";
import ConcentrationReadingsEditor from "@/components/fumigation/concentration-readings-editor";
import { ENCLOSURE_TYPES, FUMIGATION_TARGETS } from "@/lib/fumigation-fields";
import { loadContactUsers } from "@/lib/contact-users-store";
import { filterAuthorisedOfficers } from "@/lib/user-classifications";
import {
  findContactUserByName,
  resolveSignoffFields,
} from "@/lib/fumigation-signatures";
import { SignatureDisplay } from "@/components/fumigation/fumigation-signoff-display";
import {
  defaultContainerReadings,
  migrateLegacyReadings,
} from "@/lib/fumigation-concentration-readings";

// ─── Default concentration readings grid ─────────────────────────────────────

function defaultReadings(containerNumbers = []) {
  return defaultContainerReadings(containerNumbers);
}

// ─── Normalize snapshot to handle older fields ────────────────────────────────

function normalizeRecord(m) {
  if (!m || typeof m !== "object") return null;
  return {
    issuedDate: "",
    packRef: "",
    packId: null,
    // Section A
    fumigatorName: "",
    fumigatorAccreditationNumber: "",
    fumigatorLicenceNumber: "",
    fumigatorSignature: "",
    fumigatorSignatureImage: "",
    // Section B
    treatmentProviderId: "",
    customerName: "",
    customerAddress: "",
    jobIdentificationNumber: "",
    placeStreet: "",
    placeSuburb: "",
    placeCountry: "Australia",
    placePostcode: "",
    targetOfFumigation: [],
    commodityDescription: "",
    containerNumbers: [],
    // Section C
    enclosureType: "",
    enclosureOtherText: "",
    enclosureDescription: "",
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
    minForecastedTemperature: "",
    minAmbientTemperature: "",
    actualTemperature: "",
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
    // Section D
    monitoringDeviceSerials: "",
    dosingFinishAt: "",
    ventilationStartAt: "",
    concentrationReadings: defaultReadings(),
    finalTlvPpm1: "",
    finalTlvPpm2: "",
    finalTlvPpm3: "",
    topUpEntries: [],
    // Section E
    fumigationResult: "",
    governmentOfficerName: "",
    governmentOfficerNumber: "",
    governmentOfficerLicenseNumber: "",
    governmentOfficerSignature: "",
    governmentOfficerSignatureImage: "",
    additionalDeclarations: "",
    fumigationNotes: "",
    // Meta
    fumigant: null,
    methodology: null,
    template: null,
    site: null,
    siteAddress: null,
    ...m,
    concentrationReadings: migrateLegacyReadings(
      m.concentrationReadings?.length ? m.concentrationReadings : defaultReadings(m.containerNumbers),
      m.containerNumbers,
    ),
    topUpEntries: Array.isArray(m.topUpEntries) ? m.topUpEntries : [],
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

export default function FumigationRecordEditorClient({ packId }) {
  const router = useRouter();

  // Packs live on the backend now (UUID ids) — fetch the row, then resolve.
  const [packRow, setPackRow] = useState(null);
  const [packLoading, setPackLoading] = useState(true);

  const [rec, setRec] = useState(null);
  const [hydratedFromPack, setHydratedFromPack] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setPackLoading(true);
    setHydratedFromPack(false);
    getPack(packId)
      .then(async (row) => {
        if (cancelled || !row) return;
        setPackRow(row);
        const resolved = await resolveFumigationRecordAsync(packId, row);
        const fromPack = normalizeRecord(resolved);
        const snapshot = loadRecordSnapshot(packId);
        setRec(normalizeRecord(mergeCertDraftFromPack(fromPack, snapshot)));
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

  useEffect(() => {
    if (!hydratedFromPack || !rec) return;
    saveRecordSnapshot(packId, rec);
  }, [rec, packId, hydratedFromPack]);

  const set = useCallback((field, value) => {
    setRec((prev) => ({ ...prev, [field]: value }));
  }, []);

  const contactUsers = useMemo(() => loadContactUsers(), []);
  const fumigatorOptions = useMemo(
    () => contactUsers.filter((u) => u && u.isFumigator && u.active !== false),
    [contactUsers],
  );
  const aoOptions = useMemo(() => filterAuthorisedOfficers(contactUsers), [contactUsers]);

  const refreshFromPack = useCallback(async () => {
    if (!packRow) return;
    const fresh = await resolveFumigationRecordAsync(packId, packRow);
    if (fresh) setRec(normalizeRecord(mergeCertDraftFromPack(fresh, rec)));
  }, [packId, packRow, rec]);

  // Concentration reading helpers
  const setConcentrationReadings = useCallback((readings) => {
    setRec((prev) => ({ ...prev, concentrationReadings: readings }));
  }, []);

  // Top-up entry helpers
  const addTopUp = useCallback(() => {
    setRec((prev) => {
      const entries = prev.topUpEntries ?? [];
      const newId = Math.max(0, ...entries.map((e) => e.id)) + 1;
      return { ...prev, topUpEntries: [...entries, { id: newId, amountGm3: "", time: "", concentrationGm3: "" }] };
    });
  }, []);

  const updateTopUp = useCallback((id, col, value) => {
    setRec((prev) => ({
      ...prev,
      topUpEntries: (prev.topUpEntries ?? []).map((e) => e.id === id ? { ...e, [col]: value } : e),
    }));
  }, []);

  const removeTopUp = useCallback((id) => {
    setRec((prev) => ({
      ...prev,
      topUpEntries: (prev.topUpEntries ?? []).filter((e) => e.id !== id),
    }));
  }, []);

  const handleSaveAndPrint = useCallback(async () => {
    const final = { ...rec, issuedDate: rec.issuedDate || new Date().toLocaleDateString("en-AU") };
    setRec(final);

    if (packRow) {
      try {
        const existingDetail =
          normalizeFumigationDetail(packRow.fumigationDetail ?? packRow.fumigation_detail) ?? {};
        await updatePack(packId, {
          fumigationDetail: {
            ...existingDetail,
            ...sectionDFieldsFromRecord(final),
          },
        });
      } catch {
        // Issue/print still proceeds if pack save fails (e.g. offline)
      }
    }

    issueRecord(packId, final);
    router.push(`/fumigation/records/${packId}/print`);
  }, [rec, packId, packRow, router]);

  const handleDiscard = useCallback(async () => {
    if (!packRow) return;
    const fresh = await resolveFumigationRecordAsync(packId, packRow);
    if (fresh) setRec(normalizeRecord(fresh));
  }, [packId, packRow]);

  if (!rec) {
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

  const smallInput = `${inputClass} text-[11px] py-1 px-1.5`;

  return (
    <div className="min-h-screen bg-slate-50">
      <EditorToolbar
        title={`Record editor — ${rec.packRef || packId}`}
        subtitle={rec.fumigant?.name ? `Fumigant: ${rec.fumigant.name}` : undefined}
        onSaveAndPrint={handleSaveAndPrint}
        onRefreshFromPack={refreshFromPack}
        onDiscard={handleDiscard}
        onBackToPack={() =>
          router.push(`/packing-schedule/new-pack-form?mode=edit&id=${packId}&tab=fumigation`)
        }
      />

      <div className="mx-auto grid max-w-screen-xl grid-cols-1 gap-6 px-4 py-6 xl:grid-cols-[1fr_480px]">

        {/* ── FORM ── */}
        <div className="space-y-5">

          {/* Section A — Fumigator */}
          <SectionCard>
            <SectionHeading>Section A — Fumigator in charge (pre-filled from pack)</SectionHeading>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FormField label="Fumigator name">
                <select
                  className={inputClass}
                  value={rec.fumigatorName ?? ""}
                  onChange={(e) => {
                    const name = e.target.value;
                    setRec((prev) => applySignoffFromSelection(prev, "fumigator", name, contactUsers));
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
                  value={rec.fumigatorLicenceNumber ?? rec.fumigatorAccreditationNumber ?? ""}
                  onChange={(e) => {
                    const value = e.target.value;
                    setRec((prev) => ({
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

          {/* Section B — Job details */}
          <SectionCard>
            <SectionHeading>Section B — Job details (pre-filled from pack)</SectionHeading>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FormField label="Treatment provider ID">
                <input className={inputClass} value={rec.treatmentProviderId ?? ""} onChange={(e) => set("treatmentProviderId", e.target.value)} />
              </FormField>
              <FormField label="Client name / details">
                <input className={inputClass} value={rec.customerName ?? ""} onChange={(e) => set("customerName", e.target.value)} />
              </FormField>
              <FormField label="Job identification number">
                <input className={inputClass} value={rec.jobIdentificationNumber ?? ""} onChange={(e) => set("jobIdentificationNumber", e.target.value)} />
              </FormField>
              <FormField label="Consignment / Container numbers">
                <input className={inputClass} value={(rec.containerNumbers ?? []).join(", ")} onChange={(e) => set("containerNumbers", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))} placeholder="Comma-separated" />
              </FormField>
              <FormField label="Commodity Grade description">
                <input className={inputClass} value={rec.commodityDescription ?? ""} onChange={(e) => set("commodityDescription", e.target.value)} />
              </FormField>
              <FormField label="Target of fumigation" wide>
                <div className="flex flex-wrap gap-3 pt-0.5">
                  {FUMIGATION_TARGETS.map((t) => (
                    <label key={t.value} className="flex items-center gap-1.5 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={(rec.targetOfFumigation ?? []).includes(t.value)}
                        onChange={(e) => {
                          const prev = rec.targetOfFumigation ?? [];
                          set("targetOfFumigation", e.target.checked ? [...prev, t.value] : prev.filter((v) => v !== t.value));
                        }}
                      />
                      {t.label}
                    </label>
                  ))}
                </div>
              </FormField>
            </div>
          </SectionCard>

          {/* Section C — Fumigation details */}
          <SectionCard>
            <SectionHeading>Section C — Fumigation details</SectionHeading>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {/* Enclosure type */}
              <FormField label="Enclosure type" wide>
                <div className="flex flex-wrap gap-3 pt-0.5">
                  {ENCLOSURE_TYPES.map((e) => (
                    <label key={e.value} className="flex items-center gap-1.5 text-sm cursor-pointer">
                      <input type="radio" name="enclosureType" value={e.value} checked={rec.enclosureType === e.value} onChange={() => set("enclosureType", e.value)} />
                      {e.label}
                    </label>
                  ))}
                </div>
              </FormField>
              {rec.enclosureType === "other" && (
                <FormField label="Other enclosure description" wide>
                  <input className={inputClass} value={rec.enclosureOtherText ?? ""} onChange={(e) => set("enclosureOtherText", e.target.value)} />
                </FormField>
              )}
              <FormField label="Dimensions (L × W × H) m">
                <div className="flex gap-2">
                  <input className={inputClass} value={rec.enclosureLengthM ?? ""} onChange={(e) => set("enclosureLengthM", e.target.value)} placeholder="L" />
                  <input className={inputClass} value={rec.enclosureWidthM ?? ""} onChange={(e) => set("enclosureWidthM", e.target.value)} placeholder="W" />
                  <input className={inputClass} value={rec.enclosureHeightM ?? ""} onChange={(e) => set("enclosureHeightM", e.target.value)} placeholder="H" />
                </div>
              </FormField>
              <FormField label="Volume (m3)">
                <input className={inputClass} type="number" step="0.1" value={rec.volumeM3 ?? ""} onChange={(e) => set("volumeM3", e.target.value)} />
              </FormField>
              <FormField label="Consignment suitable?">
                <div className="flex gap-4 pt-1">
                  {[{ v: true, l: "Yes" }, { v: false, l: "No" }].map(({ v, l }) => (
                    <label key={l} className="flex items-center gap-1.5 text-sm cursor-pointer">
                      <input type="radio" name="recConsSuitable" checked={rec.consignmentSuitable === v} onChange={() => set("consignmentSuitable", v)} />
                      {l}
                    </label>
                  ))}
                </div>
              </FormField>
              {rec.consignmentSuitable === false && (
                <FormField label="Remedial action" wide>
                  <textarea className={inputClass} rows={2} value={rec.consignmentRemedialAction ?? ""} onChange={(e) => set("consignmentRemedialAction", e.target.value)} />
                </FormField>
              )}
              <FormField label="Prescribed dose rate (g/m3)">
                <input className={inputClass} type="number" step="0.1" value={rec.prescribedDoseRate ?? ""} onChange={(e) => set("prescribedDoseRate", e.target.value)} />
              </FormField>
              <FormField label="Prescribed exposure (hours)">
                <input className={inputClass} type="number" step="1" value={rec.prescribedExposure ?? ""} onChange={(e) => set("prescribedExposure", e.target.value)} />
              </FormField>
              <FormField label="Prescribed min temp (°C)">
                <input className={inputClass} type="number" step="0.5" value={rec.prescribedTemperature ?? ""} onChange={(e) => set("prescribedTemperature", e.target.value)} />
              </FormField>
              <FormField label="Fumigation type" wide>
                <div className="flex gap-4 pt-1">
                  {[{ v: "ambient", l: "Ambient temperature" }, { v: "controlled", l: "Controlled temperature" }].map(({ v, l }) => (
                    <label key={v} className="flex items-center gap-1.5 text-sm cursor-pointer">
                      <input type="radio" name="recFumType" checked={rec.fumigationType === v} onChange={() => set("fumigationType", v)} />
                      {l}
                    </label>
                  ))}
                </div>
              </FormField>
              <FormField label="Min forecast temp (°C)">
                <input className={inputClass} type="number" step="0.5" value={rec.minForecastedTemperature ?? ""} onChange={(e) => set("minForecastedTemperature", e.target.value)} />
              </FormField>
              <FormField label="Actual start temp (°C)">
                <input className={inputClass} type="number" step="0.5" value={rec.actualTemperature ?? ""} onChange={(e) => set("actualTemperature", e.target.value)} />
              </FormField>
              <FormField label="Applied dose rate (g/m3)">
                <input className={inputClass} type="number" step="0.1" value={rec.dosageValue ?? ""} onChange={(e) => set("dosageValue", e.target.value)} />
              </FormField>
              <FormField label="Applied exposure (hours)">
                <input className={inputClass} type="number" step="1" value={rec.exposureTimeValue ?? ""} onChange={(e) => set("exposureTimeValue", e.target.value)} />
              </FormField>
              <FormField label="Calculated dose (g)">
                <input className={inputClass} type="number" step="0.1" value={rec.calculatedDosageValue ?? ""} onChange={(e) => set("calculatedDosageValue", e.target.value)} />
              </FormField>
              <FormField label="Amount of fumigant applied (g)">
                <input className={inputClass} type="number" step="0.1" value={rec.actualDosageAppliedValue ?? ""} onChange={(e) => set("actualDosageAppliedValue", e.target.value)} />
              </FormField>
              <FormField label="Chloropicrin used?">
                <div className="flex gap-4 pt-1">
                  {[{ v: true, l: "Yes" }, { v: false, l: "No" }].map(({ v, l }) => (
                    <label key={l} className="flex items-center gap-1.5 text-sm cursor-pointer">
                      <input type="radio" name="recChloropicrin" checked={rec.chloropicrinUsed === v} onChange={() => set("chloropicrinUsed", v)} />
                      {l}
                    </label>
                  ))}
                </div>
              </FormField>
              {rec.chloropicrinUsed === true && (
                <FormField label="Chloropicrin %">
                  <input className={inputClass} type="number" step="0.1" value={rec.chloropicrinPercent ?? ""} onChange={(e) => set("chloropicrinPercent", e.target.value)} />
                </FormField>
              )}
              <FormField label="Heaters used?">
                <div className="flex gap-4 pt-1">
                  {[{ v: true, l: "Yes" }, { v: false, l: "No" }].map(({ v, l }) => (
                    <label key={l} className="flex items-center gap-1.5 text-sm cursor-pointer">
                      <input type="radio" name="recHeaters" checked={rec.heatersUsed === v} onChange={() => set("heatersUsed", v)} />
                      {l}
                    </label>
                  ))}
                </div>
              </FormField>
              <FormField label="End-point concentration (g/m3)">
                <input className={inputClass} type="number" step="0.01" value={rec.endPointConcentration ?? ""} onChange={(e) => set("endPointConcentration", e.target.value)} />
              </FormField>
              <FormField label="CT required (g·h/m3)">
                <input className={inputClass} type="number" step="0.1" value={rec.ctRequired ?? ""} onChange={(e) => set("ctRequired", e.target.value)} />
              </FormField>
              <FormField label="CT achieved (g·h/m3)">
                <input className={inputClass} type="number" step="0.1" value={rec.ctAchieved ?? ""} onChange={(e) => set("ctAchieved", e.target.value)} />
              </FormField>
              <FormField label="Approved 3rd-party CT system?">
                <label className="flex items-center gap-1.5 text-sm pt-1 cursor-pointer">
                  <input type="checkbox" checked={Boolean(rec.thirdPartySystem)} onChange={(e) => set("thirdPartySystem", e.target.checked)} />
                  Used
                </label>
              </FormField>
              {rec.thirdPartySystem && (
                <FormField label="3rd-party system name" wide>
                  <input className={inputClass} value={rec.thirdPartySystemName ?? ""} onChange={(e) => set("thirdPartySystemName", e.target.value)} />
                </FormField>
              )}
            </div>
          </SectionCard>

          {/* Section D — Concentration readings */}
          <SectionCard>
            <SectionHeading>Section D — Concentration readings</SectionHeading>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 mb-4">
              <FormField label="Monitoring device serial(s)" wide>
                <input className={inputClass} value={rec.monitoringDeviceSerials ?? ""} onChange={(e) => set("monitoringDeviceSerials", e.target.value)} placeholder="Comma-separated" />
              </FormField>
              <FormField label="Fumigant injection finished">
                <input className={inputClass} type="datetime-local" value={rec.dosingFinishAt ?? ""} onChange={(e) => set("dosingFinishAt", e.target.value)} />
              </FormField>
            </div>

            <ConcentrationReadingsEditor
              readings={rec.concentrationReadings ?? []}
              onChange={setConcentrationReadings}
              inputClass={`${smallInput} py-1 px-1.5`}
              containerNumbers={rec.containerNumbers ?? []}
              showSyncButton
            />

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 mb-3">
              <FormField label="Enclosure ventilation start">
                <input className={inputClass} type="datetime-local" value={rec.ventilationStartAt ?? ""} onChange={(e) => set("ventilationStartAt", e.target.value)} />
              </FormField>
            </div>

            {/* Top-up entries */}
            <div>
              <p className="text-xs font-medium text-slate-700 mb-2">Top-up details (if applicable)</p>
              {(rec.topUpEntries ?? []).map((entry) => (
                <div key={entry.id} className="flex items-center gap-2 mb-2">
                  <input className={`${inputClass} flex-1`} placeholder="Amount (g/m3)" value={entry.amountGm3 ?? ""} onChange={(e) => updateTopUp(entry.id, "amountGm3", e.target.value)} />
                  <input className={`${inputClass} flex-1`} placeholder="Time (hh:mm)" value={entry.time ?? ""} onChange={(e) => updateTopUp(entry.id, "time", e.target.value)} />
                  <input className={`${inputClass} flex-1`} placeholder="Conc. (g/m3)" value={entry.concentrationGm3 ?? ""} onChange={(e) => updateTopUp(entry.id, "concentrationGm3", e.target.value)} />
                  <button type="button" onClick={() => removeTopUp(entry.id)} className="text-slate-400 hover:text-red-500">
                    <Trash2 className="size-4" />
                  </button>
                </div>
              ))}
              <button type="button" onClick={addTopUp} className="flex items-center gap-1.5 text-xs text-brand hover:text-brand/80 font-medium">
                <Plus className="size-3" /> Add top-up row
              </button>
            </div>
          </SectionCard>

          {/* Section E — Declaration */}
          <SectionCard>
            <SectionHeading>Section E — Declaration &amp; result</SectionHeading>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FormField label="Fumigation result">
                <select className={inputClass} value={rec.fumigationResult ?? ""} onChange={(e) => set("fumigationResult", e.target.value)}>
                  <option value="">— select —</option>
                  <option value="pass">Pass</option>
                  <option value="fail">Fail</option>
                </select>
              </FormField>
              <FormField label="Fumigator in charge">
                <select
                  className={inputClass}
                  value={rec.fumigatorName ?? ""}
                  onChange={(e) => {
                    const name = e.target.value;
                    setRec((prev) => applySignoffFromSelection(prev, "fumigator", name, contactUsers));
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
                  value={rec.fumigatorLicenceNumber ?? rec.fumigatorAccreditationNumber ?? ""}
                  onChange={(e) => {
                    const value = e.target.value;
                    setRec((prev) => ({
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
                  value={rec.governmentOfficerName ?? ""}
                  onChange={(e) => {
                    const name = e.target.value;
                    setRec((prev) => applySignoffFromSelection(prev, "ao", name, contactUsers));
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
                  value={rec.governmentOfficerLicenseNumber ?? ""}
                  onChange={(e) => set("governmentOfficerLicenseNumber", e.target.value)}
                  placeholder="Pre-filled from AO profile"
                />
              </FormField>
              <FormField label="Fumigator signature">
                <SignatureDisplay
                  text={rec.fumigatorSignature}
                  imageUrl={rec.fumigatorSignatureImage}
                  className="min-h-[3rem] rounded border border-slate-200 bg-white px-2 py-1"
                />
              </FormField>
              <FormField label="AO signature">
                <SignatureDisplay
                  text={rec.governmentOfficerSignature}
                  imageUrl={rec.governmentOfficerSignatureImage}
                  className="min-h-[3rem] rounded border border-slate-200 bg-white px-2 py-1"
                />
              </FormField>
              <FormField label="Additional declarations" wide>
                <textarea className={inputClass} rows={3} value={rec.additionalDeclarations ?? ""} onChange={(e) => set("additionalDeclarations", e.target.value)} />
              </FormField>
              <FormField label="Notes (internal)" wide>
                <textarea className={inputClass} rows={2} value={rec.fumigationNotes ?? ""} onChange={(e) => set("fumigationNotes", e.target.value)} />
              </FormField>
            </div>
          </SectionCard>

        </div>

        {/* ── LIVE PREVIEW ── */}
        <DocumentPreview>
          <FumigationRecordDocument model={rec} hideToolbar />
        </DocumentPreview>

      </div>
    </div>
  );
}
