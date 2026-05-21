"use client";

import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { DocPrintToolbar } from "@/components/fumigation/fumigation-shared-print";
import { formatDateTime } from "@/lib/fumigation-cert-print";
import { ENCLOSURE_TYPES, FUMIGATION_TARGETS } from "@/lib/fumigation-fields";

function SectionTitle({ letter, title }) {
  return (
    <h2 className="mb-2 flex items-baseline gap-2 border-b border-slate-300 pb-1">
      <span className="text-sm font-bold text-slate-900">Section {letter}:</span>
      <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">{title}</span>
    </h2>
  );
}

function Row({ label, value }) {
  if (value == null || value === "") return null;
  return (
    <tr className="border-b border-gray-100">
      <td className="py-1 pr-4 font-medium text-gray-600 w-52 align-top text-xs">{label}</td>
      <td className="py-1 text-gray-900 text-xs">{value}</td>
    </tr>
  );
}

function CheckBox({ label, checked }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-gray-800 mr-4">
      <span className={cn("w-3.5 h-3.5 border border-gray-500 inline-flex items-center justify-center text-[9px]", checked && "bg-gray-900 text-white")}>
        {checked ? "✓" : ""}
      </span>
      {label}
    </span>
  );
}

export default function FumigationRecordDocument({ model, backHref, hideToolbar }) {
  if (!model) {
    return (
      <div className="mx-auto max-w-lg px-6 py-16 text-center">
        <p className="text-sm text-slate-600">Record not found or could not be resolved.</p>
        {backHref && (
          <Link href={backHref} className="mt-4 inline-flex items-center text-sm text-brand underline">
            Go back
          </Link>
        )}
      </div>
    );
  }

  const handlePrint = () => { if (typeof window !== "undefined") window.print(); };
  const addr = model.siteAddress ?? {};
  const fumigantName = model.fumigant?.name || "Fumigation";
  const readings = Array.isArray(model.concentrationReadings) ? model.concentrationReadings : [];
  const topUps = Array.isArray(model.topUpEntries) ? model.topUpEntries : [];

  return (
    <>
      <style>{`
        @page { size: A4; margin: 12mm 14mm; }
        @media print {
          .cert-print-toolbar { display: none !important; }
          .cert-print-document { margin: 0 !important; padding: 0 !important; max-width: none !important; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          table { page-break-inside: auto; }
          tr { page-break-inside: avoid; page-break-after: auto; }
          h1, h2 { page-break-after: avoid; }
          thead { display: table-header-group; }
        }
      `}</style>

      {!hideToolbar && (
        <DocPrintToolbar
          title={`Record of Fumigation — ${model.packRef}`}
          onPrint={handlePrint}
          backHref={backHref}
        />
      )}

      <div className="cert-print-document mx-auto max-w-[60rem] bg-white px-8 py-8 print:max-w-none print:px-0 print:py-0">

        {/* ── HEADER ── */}
        <div className="flex items-start justify-between border-b-2 border-slate-800 pb-4 mb-5">
          <div className="shrink-0">
            <Image src="/mahonys-logo.png" alt="Mahonys Packing" width={180} height={48} className="h-auto w-[150px] object-contain" priority />
          </div>
          <div className="text-right text-xs leading-snug text-slate-700">
            {addr.line1 && <p className="font-semibold text-slate-900">{addr.line1}</p>}
            {addr.line2 && <p>{addr.line2}</p>}
            {addr.phone && <p>Phone: {addr.phone}</p>}
            {addr.email && <p>Email: {addr.email}</p>}
          </div>
        </div>

        {/* ── TITLE ── */}
        <div className="mb-5 text-center">
          <h1 className="text-xl font-bold uppercase tracking-wide text-slate-900">
            Record of Fumigation — {fumigantName} (non-perishable commodity)
          </h1>
          <p className="mt-1 text-sm text-slate-600">{model.packRef} — {model.issuedDate}</p>
        </div>

        {/* ── SECTION A ── */}
        <div className="mb-5">
          <SectionTitle letter="A" title="Fumigator in charge" />
          <table className="w-full text-xs border-collapse">
            <tbody>
              <Row label="Full name" value={model.fumigatorName} />
              <Row label="Accreditation number" value={model.fumigatorAccreditationNumber} />
            </tbody>
          </table>
        </div>

        {/* ── SECTION B ── */}
        <div className="mb-5">
          <SectionTitle letter="B" title="Job details" />
          <table className="w-full text-xs border-collapse">
            <tbody>
              <Row label="Treatment provider ID" value={model.treatmentProviderId} />
              <Row label="Client name / details" value={model.customerName} />
              <Row label="Job identification number" value={model.jobIdentificationNumber} />
              <Row label="Location — Street" value={model.placeStreet} />
              <Row label="Location — Suburb/Town/City" value={model.placeSuburb} />
              <Row label="Location — Country" value={model.placeCountry} />
              <Row label="Location — Postcode" value={model.placePostcode} />
              <Row label="Description of consignment" value={model.commodityDescription} />
              <Row label="Consignment ID / Container numbers" value={model.containerNumbers?.join(", ")} />
            </tbody>
          </table>
          {model.targetOfFumigation?.length > 0 && (
            <div className="mt-2">
              <p className="text-xs font-medium text-gray-600 mb-1">Target of fumigation:</p>
              <div className="flex flex-wrap gap-1">
                {FUMIGATION_TARGETS.map((t) => (
                  <CheckBox key={t.value} label={t.label} checked={(model.targetOfFumigation ?? []).includes(t.value)} />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── SECTION C ── */}
        <div className="mb-5">
          <SectionTitle letter="C" title="Fumigation details" />

          {/* Prescribed schedule + enclosure type */}
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div className="rounded border border-gray-200 p-2">
              <p className="text-xs font-semibold text-gray-600 mb-1">Specified treatment schedule</p>
              <table className="w-full text-xs">
                <thead><tr className="border-b border-gray-200"><th className="text-left py-0.5 pr-2 font-medium text-gray-500">Dose (g/m3)</th><th className="text-left py-0.5 pr-2 font-medium text-gray-500">Exposure (hrs)</th><th className="text-left py-0.5 font-medium text-gray-500">Temp (°C)</th></tr></thead>
                <tbody><tr><td className="py-0.5 pr-2">{model.prescribedDoseRate || "—"}</td><td className="py-0.5 pr-2">{model.prescribedExposure || "—"}</td><td className="py-0.5">{model.prescribedTemperature || "—"}</td></tr></tbody>
              </table>
            </div>
            <div className="rounded border border-gray-200 p-2">
              <p className="text-xs font-semibold text-gray-600 mb-1">Enclosure type</p>
              <div className="flex flex-wrap gap-1">
                {ENCLOSURE_TYPES.map((e) => (
                  <CheckBox key={e.value} label={e.value === "other" && model.enclosureOtherText && model.enclosureType === "other" ? `Other: ${model.enclosureOtherText}` : e.label} checked={model.enclosureType === e.value} />
                ))}
              </div>
            </div>
          </div>

          {/* Suitability & dimensions */}
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div className="rounded border border-gray-200 p-2">
              <p className="text-xs font-semibold text-gray-600 mb-1">Consignment suitability</p>
              {model.consignmentSuitable == null ? (
                <p className="text-xs text-gray-400 italic">Not specified</p>
              ) : model.consignmentSuitable ? (
                <p className="text-xs text-green-700">✓ Yes — consignment suitable</p>
              ) : (
                <>
                  <p className="text-xs text-red-700">✗ No — remedial action taken</p>
                  {model.consignmentRemedialAction && <p className="text-xs text-gray-600 mt-0.5">Action: {model.consignmentRemedialAction}</p>}
                </>
              )}
            </div>
            <div className="rounded border border-gray-200 p-2">
              <p className="text-xs font-semibold text-gray-600 mb-1">Enclosure volume</p>
              <p className="text-xs text-gray-900">
                {[
                  model.enclosureLengthM && `L: ${model.enclosureLengthM}m`,
                  model.enclosureWidthM && `W: ${model.enclosureWidthM}m`,
                  model.enclosureHeightM && `H: ${model.enclosureHeightM}m`,
                  model.volumeM3 && `Total: ${model.volumeM3} m3`,
                ].filter(Boolean).join(" | ") || "—"}
              </p>
            </div>
          </div>

          {/* Dose details (fumigant-agnostic — generic labels) */}
          <table className="w-full text-xs border-collapse mb-2">
            <tbody>
              <Row label="Dose rate used (g/m3)" value={model.dosageValue} />
              <Row label="Calculated dose (g)" value={model.calculatedDosageValue} />
              <Row label="Amount of fumigant applied (g)" value={model.actualDosageAppliedValue} />
              {model.chloropicrinUsed != null && (
                <tr className="border-b border-gray-100">
                  <td className="py-1 pr-4 font-medium text-gray-600 w-52 align-top text-xs">Chloropicrin</td>
                  <td className="py-1 text-gray-900 text-xs">
                    {model.chloropicrinUsed ? `Yes${model.chloropicrinPercent ? ` — ${model.chloropicrinPercent}%` : ""}` : "No"}
                  </td>
                </tr>
              )}
              {model.heatersUsed != null && <Row label="Heaters used" value={model.heatersUsed ? "Yes" : "No"} />}
              {model.endPointConcentration && (
                <Row
                  label="End-point concentration"
                  value={`${model.endPointConcentration} ${model.endPointConcentrationUnit || "g/m3"}`}
                />
              )}
              {model.ctRequired && <Row label="CT required (g·h/m3)" value={model.ctRequired} />}
              {model.ctAchieved && <Row label="CT achieved (g·h/m3)" value={model.ctAchieved} />}
              {model.thirdPartySystem && (
                <Row label="Approved 3rd-party system" value={model.thirdPartySystemName || "Yes"} />
              )}
            </tbody>
          </table>

          {/* Fumigation type */}
          <div className="flex gap-4 text-xs mt-1">
            <CheckBox label={`Ambient temperature: Forecast min temp ${model.minForecastedTemperature || "—"}°C`} checked={model.fumigationType === "ambient"} />
            <CheckBox label={`Controlled temperature: Min enclosure temp ${model.actualTemperature || "—"}°C`} checked={model.fumigationType === "controlled"} />
          </div>
        </div>

        {/* ── SECTION D ── */}
        <div className="mb-5">
          <SectionTitle letter="D" title="Concentration readings" />
          <p className="text-xs text-gray-500 mb-2">
            Monitoring device serial(s): <span className="font-medium text-gray-800">{model.monitoringDeviceSerials || "—"}</span>
          </p>
          <p className="text-xs text-gray-600 mb-2">
            Fumigant injection finished: <span className="font-medium">{formatDateTime(model.dosingFinishAt) || "—"}</span>
          </p>

          {readings.length > 0 ? (
            <div className="overflow-x-auto mb-3">
              <table className="w-full text-[10px] border-collapse border border-gray-300">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="border border-gray-200 px-1 py-1 text-left font-semibold text-gray-600">Phase</th>
                    <th className="border border-gray-200 px-1 py-1 text-left font-semibold text-gray-600">Date (dd/mm)</th>
                    <th className="border border-gray-200 px-1 py-1 text-left font-semibold text-gray-600">Time (hh:mm)</th>
                    <th className="border border-gray-200 px-1 py-1 text-center font-semibold text-gray-600">Loc 1</th>
                    <th className="border border-gray-200 px-1 py-1 text-center font-semibold text-gray-600">Loc 2</th>
                    <th className="border border-gray-200 px-1 py-1 text-center font-semibold text-gray-600">Loc 3</th>
                    <th className="border border-gray-200 px-1 py-1 text-center font-semibold text-gray-600">Loc 4</th>
                    <th className="border border-gray-200 px-1 py-1 text-center font-semibold text-gray-600">Loc 5</th>
                    <th className="border border-gray-200 px-1 py-1 text-center font-semibold text-gray-600">Eq.%</th>
                    <th className="border border-gray-200 px-1 py-1 text-center font-semibold text-gray-600">Std(g/m3)</th>
                    <th className="border border-gray-200 px-1 py-1 text-center font-semibold text-gray-600">Initials</th>
                  </tr>
                </thead>
                <tbody>
                  {readings.map((row) => (
                    <tr key={row.id} className="border-b border-gray-200">
                      <td className="border border-gray-200 px-1 py-1 font-medium text-gray-700 capitalize">{row.phaseLabel || row.phase}</td>
                      <td className="border border-gray-200 px-1 py-1">{row.date || ""}</td>
                      <td className="border border-gray-200 px-1 py-1">{row.time || ""}</td>
                      <td className="border border-gray-200 px-1 py-1 text-center">{row.location1 || ""}</td>
                      <td className="border border-gray-200 px-1 py-1 text-center">{row.location2 || ""}</td>
                      <td className="border border-gray-200 px-1 py-1 text-center">{row.location3 || ""}</td>
                      <td className="border border-gray-200 px-1 py-1 text-center">{row.location4 || ""}</td>
                      <td className="border border-gray-200 px-1 py-1 text-center">{row.location5 || ""}</td>
                      <td className="border border-gray-200 px-1 py-1 text-center">{row.equilibriumPercent || ""}</td>
                      <td className="border border-gray-200 px-1 py-1 text-center">{row.standardGm3 || ""}</td>
                      <td className="border border-gray-200 px-1 py-1 text-center">{row.fumigatorInitials || ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-xs italic text-gray-400 mb-3">(No concentration readings recorded)</p>
          )}

          <p className="text-xs text-gray-600 mb-1">
            Enclosure ventilation start: <span className="font-medium">{formatDateTime(model.ventilationStartAt) || "—"}</span>
          </p>
          <p className="text-xs text-gray-600 mb-2">
            Final TLV readings (ppm):{" "}
            <span className="font-medium">
              {[model.finalTlvPpm1, model.finalTlvPpm2, model.finalTlvPpm3].filter(Boolean).join(" / ") || "—"}
            </span>
          </p>

          {/* Top-up details */}
          {topUps.length > 0 && (
            <div className="mb-2">
              <p className="text-xs font-semibold text-gray-600 mb-1">Top-up details:</p>
              <table className="w-full text-xs border-collapse border border-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="border border-gray-200 px-2 py-1 text-left font-medium text-gray-500">Amount (g/m3)</th>
                    <th className="border border-gray-200 px-2 py-1 text-left font-medium text-gray-500">Time (hh:mm)</th>
                    <th className="border border-gray-200 px-2 py-1 text-left font-medium text-gray-500">Concentration (g/m3)</th>
                  </tr>
                </thead>
                <tbody>
                  {topUps.map((t) => (
                    <tr key={t.id} className="border-b border-gray-100">
                      <td className="border border-gray-200 px-2 py-1">{t.amountGm3 || "—"}</td>
                      <td className="border border-gray-200 px-2 py-1">{t.time || "—"}</td>
                      <td className="border border-gray-200 px-2 py-1">{t.concentrationGm3 || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── SECTION E ── */}
        <div className="mb-6">
          <SectionTitle letter="E" title="Fumigator declaration" />
          <p className="text-xs text-gray-700 mb-4 leading-relaxed">
            I, the fumigator-in-charge declare that the fumigation was conducted in accordance with the treatment schedule
            and all the requirements in the {fumigantName} Fumigation Methodology, and the information I have provided is
            true and correct.
          </p>
          <div className="grid grid-cols-2 gap-8 mb-4">
            <div>
              <p className="text-xs font-semibold mb-5">Signature (fumigator in charge):</p>
              <div className="border-b border-gray-400" />
            </div>
            <div>
              <p className="text-xs font-semibold mb-5">Date (dd/mm/yyyy):</p>
              <div className="border-b border-gray-400" />
            </div>
          </div>
          <div className="mb-4">
            <p className="text-xs font-semibold text-gray-600 mb-1">
              Fumigation result:{" "}
              <span className={cn("font-bold", model.fumigationResult === "pass" ? "text-green-700" : model.fumigationResult === "fail" ? "text-red-700" : "text-gray-500")}>
                {model.fumigationResult ? model.fumigationResult.toUpperCase() : "—"}
              </span>
            </p>
          </div>
          {(model.governmentOfficerName || model.governmentOfficerSignature) && (
            <div>
              <p className="text-xs font-semibold text-gray-600 mb-2">Authorised officer (if supervised):</p>
              <div className="grid grid-cols-2 gap-8">
                <div>
                  <p className="text-xs mb-5">Name: {model.governmentOfficerName || ""}</p>
                  <div className="border-b border-gray-400" />
                </div>
                <div>
                  <p className="text-xs font-semibold mb-5">Signature:</p>
                  <div className="border-b border-gray-400" />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── FOOTER ── */}
        {model.template?.footerText && (
          <div className="mt-8 border-t border-slate-200 pt-4 text-center">
            <p className="text-[10px] text-slate-400">{model.template.footerText}</p>
          </div>
        )}
      </div>
    </>
  );
}
