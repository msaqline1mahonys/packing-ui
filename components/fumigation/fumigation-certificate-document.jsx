"use client";

import Link from "next/link";
import Image from "next/image";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DocPrintToolbar } from "@/components/fumigation/fumigation-shared-print";
import { formatDateTime } from "@/lib/fumigation-cert-print";
import { CERTIFICATE_SECTIONS, ENCLOSURE_TYPES, FUMIGATION_TARGETS } from "@/lib/fumigation-fields";
import { CertificateSignoffGrid } from "@/components/fumigation/fumigation-signoff-display";

const ALL_CERT_SECTION_KEYS = CERTIFICATE_SECTIONS.map((s) => s.key);

/** True when the template enables the named section. Missing array = all enabled (back-compat). */
function sectionEnabled(template, key) {
  const sections = template?.sections;
  if (!Array.isArray(sections)) return true;
  return sections.includes(key);
}

/** Display a detail row; hides if value is empty */
function Row({ label, value, className }) {
  if (!value && value !== 0) return null;
  return (
    <tr className={cn("border-b border-gray-100", className)}>
      <td className="py-1 pr-4 font-medium text-gray-600 w-44 align-top text-xs">{label}</td>
      <td className="py-1 text-gray-900 text-xs">{value}</td>
    </tr>
  );
}

function CheckRow({ label, checked }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-gray-800 mr-4">
      <span className={cn("w-3.5 h-3.5 border border-gray-500 inline-flex items-center justify-center text-[9px]", checked && "bg-gray-900 text-white")}>
        {checked ? "✓" : ""}
      </span>
      {label}
    </span>
  );
}

export default function FumigationCertificateDocument({ model, backHref, hideToolbar }) {
  if (!model) {
    return (
      <div className="mx-auto max-w-lg px-6 py-16 text-center">
        <p className="text-sm text-slate-600">Certificate not found or could not be resolved.</p>
        {backHref && (
          <Link href={backHref} className={cn(buttonVariants({ variant: "outline", size: "sm" }), "mt-4 inline-flex")}>
            Go back
          </Link>
        )}
      </div>
    );
  }

  const handlePrint = () => { if (typeof window !== "undefined") window.print(); };
  const addr = model.siteAddress ?? {};
  const fumigantName = model.fumigant?.name || "Fumigation";
  const template = model.template ?? {};
  const headerLogo = template.logoDataUrl || "/mahonys-logo.png";
  const footerLogo = template.footerLogoDataUrl || "";
  const headerLines = String(template.headerText || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const show = (key) => sectionEnabled(template, key);
  // suppress unused warning when template defaults to everything
  void ALL_CERT_SECTION_KEYS;

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
          title={`Certificate of Fumigation — ${model.packRef}`}
          onPrint={handlePrint}
          backHref={backHref}
        />
      )}

      <div className="cert-print-document mx-auto max-w-[52rem] bg-white px-8 py-8 print:max-w-none print:px-0 print:py-0">

        {/* ── HEADER ── */}
        <div className="flex items-start gap-4 border-b-2 border-slate-800 pb-4 mb-5">
          <div className="shrink-0">
            {headerLogo.startsWith("data:") ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={headerLogo} alt="Header logo" className="h-auto w-[160px] object-contain" />
            ) : (
              <Image src={headerLogo} alt="Mahonys" width={180} height={48} className="h-auto w-[160px] object-contain" priority />
            )}
          </div>
          <div className="flex-1 text-right text-xs leading-tight text-slate-700">
            {headerLines.length > 0 ? (
              headerLines.map((line) => (
                <p key={line} className="font-semibold text-slate-900">
                  {line}
                </p>
              ))
            ) : (
              <>
                {addr.line1 && <p className="font-semibold text-slate-900">{addr.line1}</p>}
                {addr.line2 && <p className="font-semibold text-slate-900">{addr.line2}</p>}
                {addr.phone && <p>Phone: {addr.phone}</p>}
                {addr.email && <p>Email: {addr.email}</p>}
                {addr.web && <p>Web: {addr.web}</p>}
              </>
            )}
          </div>
        </div>

        {/* ── TITLE ── */}
        <div className="mb-4 text-center">
          <h1 className="text-xl font-bold tracking-tight text-slate-900 uppercase">
            Treatment Certificate — {fumigantName}
          </h1>
        </div>

        {/* ── CERT HEADER ROW ── */}
        <div className="grid grid-cols-3 gap-3 mb-4 text-xs">
          <div className="rounded border border-gray-200 p-2">
            <p className="font-semibold text-gray-500 uppercase tracking-wide mb-0.5">Date issued (dd/mm/yyyy)</p>
            <p className="text-gray-900">{model.issuedDate || "—"}</p>
          </div>
          <div className="rounded border border-gray-200 p-2">
            <p className="font-semibold text-gray-500 uppercase tracking-wide mb-0.5">Certificate number</p>
            <p className="text-gray-900">{model.certificateNumber || "—"}</p>
          </div>
          <div className="rounded border border-gray-200 p-2">
            <p className="font-semibold text-gray-500 uppercase tracking-wide mb-0.5">Treatment provider ID</p>
            <p className="text-gray-900">{model.treatmentProviderId || "—"}</p>
          </div>
        </div>

        {/* ── CONSIGNMENT DETAILS ── */}
        {show("consignment") && (
        <div className="mb-4">
          <h2 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-700 border-b border-slate-200 pb-0.5">Consignment details</h2>
          <table className="w-full text-xs border-collapse">
            <tbody>
              <Row label="Consignment / Container numbers" value={model.containerNumbers?.join(", ") || "—"} />
              <Row label="Seal number(s)" value={model.sealNumbers?.join(", ") || "—"} />
              <Row label="Client name" value={model.customerName} />
              <Row label="Client address" value={model.customerAddress} />
              <Row label="Commodity description" value={model.commodityDescription} />
              <Row label="Country of origin" value={model.commodityCountryOfOrigin} />
              <Row label="Commodity quantity" value={model.commodityQuantity} />
              <Row label="Port of loading" value={model.portOfLoading} />
              <Row label="Destination country" value={model.destinationCountry} />
            </tbody>
          </table>
        </div>
        )}

        {/* ── TARGET & ENCLOSURE ── */}
        {show("targetEnclosure") && (
        <div className="mb-4">
          <h2 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-700 border-b border-slate-200 pb-0.5">Target of fumigation &amp; enclosure type</h2>
          <div className="flex flex-wrap gap-1 mb-2">
            {FUMIGATION_TARGETS.map((t) => (
              <CheckRow key={t.value} label={t.label} checked={(model.targetOfFumigation ?? []).includes(t.value)} />
            ))}
          </div>
          <div className="flex flex-wrap gap-1">
            {ENCLOSURE_TYPES.map((e) => {
              const checked = model.enclosureType === e.value;
              const label = e.value === "other" && model.enclosureOtherText && checked
                ? `Other: ${model.enclosureOtherText}`
                : e.label;
              return <CheckRow key={e.value} label={label} checked={checked} />;
            })}
          </div>
        </div>
        )}

        {/* ── TREATMENT SCHEDULE side-by-side ── */}
        {show("schedule") && (
        <div className="mb-4 grid grid-cols-2 gap-3">
          <div className="rounded border border-gray-200 p-3">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-600">Treatment schedule (prescribed)</h2>
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="py-1 pr-2 text-left font-medium text-gray-500">Dose rate (g/m3)</th>
                  <th className="py-1 pr-2 text-left font-medium text-gray-500">Exposure (hours)</th>
                  <th className="py-1 text-left font-medium text-gray-500">Temp (°C)</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="py-1 pr-2">{model.prescribedDoseRate || "—"}</td>
                  <td className="py-1 pr-2">{model.prescribedExposure || "—"}</td>
                  <td className="py-1">{model.prescribedTemperature || "—"}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="rounded border border-gray-200 p-3">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-600">Fumigation details (applied)</h2>
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="py-1 pr-2 text-left font-medium text-gray-500">Applied dose (g/m3)</th>
                  <th className="py-1 pr-2 text-left font-medium text-gray-500">Exposure (hours)</th>
                  <th className="py-1 text-left font-medium text-gray-500">Temp (°C)</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="py-1 pr-2">{model.dosageValue || "—"}</td>
                  <td className="py-1 pr-2">{model.exposureTimeValue || "—"}</td>
                  <td className="py-1">{model.actualTemperature || "—"}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        )}

        {/* ── TREATMENT DETAILS (always shown — fumigant-agnostic) ── */}
        {show("treatmentDetails") && (
        <div className="mb-4">
          <h2 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-700 border-b border-slate-200 pb-0.5">Treatment details</h2>
          <table className="w-full text-xs border-collapse">
            <tbody>
              <Row label="Amount of fumigant applied (g)" value={model.actualDosageAppliedValue ? `${model.actualDosageAppliedValue} ${model.actualDosageAppliedUnit || "g"}` : null} />
              <Row label="Calculated dose (g)" value={model.calculatedDosageValue ? `${model.calculatedDosageValue} ${model.calculatedDosageUnit || "g"}` : null} />
              {model.chloropicrinUsed != null && (
                <tr className="border-b border-gray-100">
                  <td className="py-1 pr-4 font-medium text-gray-600 w-44 align-top text-xs">Chloropicrin</td>
                  <td className="py-1 text-gray-900 text-xs">
                    {model.chloropicrinUsed ? `Yes${model.chloropicrinPercent ? ` — ${model.chloropicrinPercent}%` : ""}` : "No"}
                  </td>
                </tr>
              )}
              {model.heatersUsed != null && (
                <Row label="Heaters used" value={model.heatersUsed ? "Yes" : "No"} />
              )}
              <Row label="Final TLV reading (ppm)" value={[model.finalTlvPpm1, model.finalTlvPpm2, model.finalTlvPpm3].filter(Boolean).join(", ")} />
            </tbody>
          </table>
        </div>
        )}

        {/* ── END-POINT & CT (SF mandatory; harmless for other fumigants) ── */}
        {show("endpointCt") && (model.endPointConcentration || model.ctAchieved || model.ctRequired || model.thirdPartySystem) && (
          <div className="mb-4">
            <h2 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-700 border-b border-slate-200 pb-0.5">End-point concentration &amp; CT</h2>
            <table className="w-full text-xs border-collapse">
              <tbody>
                <Row
                  label="End-point concentration"
                  value={model.endPointConcentration ? `${model.endPointConcentration} ${model.endPointConcentrationUnit || "g/m3"}` : null}
                />
                <Row label="CT required (g·h/m3)" value={model.ctRequired} />
                <Row label="CT achieved (g·h/m3)" value={model.ctAchieved} />
                {model.thirdPartySystem && (
                  <Row label="Approved 3rd-party system" value={model.thirdPartySystemName || "Yes"} />
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* ── PLACE OF FUMIGATION ── */}
        {show("place") && (
        <div className="mb-4">
          <h2 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-700 border-b border-slate-200 pb-0.5">Place of fumigation</h2>
          <table className="w-full text-xs border-collapse">
            <tbody>
              <Row label="Street address" value={model.placeStreet} />
              <Row label="Suburb / Town / City" value={model.placeSuburb} />
              <Row label="Country" value={model.placeCountry} />
              <Row label="Postcode" value={model.placePostcode} />
            </tbody>
          </table>
        </div>
        )}

        {/* ── TIMES ── */}
        {show("times") && (
        <div className="mb-4">
          <h2 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-700 border-b border-slate-200 pb-0.5">Treatment times</h2>
          <table className="w-full text-xs border-collapse">
            <tbody>
              <Row label="Fumigation commenced (dd/mm/yyyy HH:MM am/pm)" value={formatDateTime(model.fumigationStartAt)} />
              <Row label="Fumigant injection finished" value={formatDateTime(model.dosingFinishAt)} />
              <Row label="Fumigation completed (dd/mm/yyyy HH:MM am/pm)" value={formatDateTime(model.fumigationEndAt)} />
              {model.ventilationStartAt && (
                <Row label="Enclosure ventilation start" value={formatDateTime(model.ventilationStartAt)} />
              )}
            </tbody>
          </table>
        </div>
        )}

        {/* ── DECLARATION ── */}
        {show("declaration") && (
        <div className="mb-6 rounded border border-gray-200 bg-gray-50 p-3 text-xs text-gray-700">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-600">Declaration &amp; result</h2>
          <p className="mb-2 leading-relaxed">
            I, the fumigator-in-charge declare: The fumigation certified was conducted in accordance with the treatment
            schedule, import conditions, and all the requirements in the {fumigantName} Fumigation Methodology, and the
            information I have provided is true and correct.
          </p>
          <p className="mb-3 leading-relaxed">
            I, the authorised officer declare: I have supervised this fumigation treatment and confirm the information
            recorded on this certificate is true and correct to the best of my knowledge.
          </p>
          <CertificateSignoffGrid model={model} />
          {model.additionalDeclarations && (
            <div className="mt-4">
              <p className="font-semibold text-gray-600 mb-1">Additional declarations:</p>
              <p className="whitespace-pre-line">{model.additionalDeclarations}</p>
            </div>
          )}
        </div>
        )}

        {/* ── FOOTER (logo + text) ── */}
        {(template.footerText || footerLogo) && (
          <div className="border-t border-slate-200 pt-3 text-xs text-slate-500 flex items-center justify-between gap-4">
            <div className="flex-1 text-center">{template.footerText}</div>
            {footerLogo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={footerLogo} alt="Footer logo" className="h-auto w-[110px] object-contain shrink-0" />
            )}
          </div>
        )}
      </div>
    </>
  );
}
