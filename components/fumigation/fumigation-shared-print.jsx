"use client";

import Link from "next/link";
import { Printer } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const isBlank = (v) => v == null || String(v).trim() === "" || v === "—";
const joinParts = (parts, sep = ", ") => parts.filter((p) => !isBlank(p)).join(sep);

// ─── In-document print toolbar ────────────────────────────────────────────────

/**
 * Shared sticky toolbar rendered inside the print document.
 * Pass hideToolbar={true} when embedding inside editor live previews.
 */
export function DocPrintToolbar({ title, subtitle, onPrint, backHref }) {
  return (
    <div className="cert-print-toolbar sticky top-0 z-20 border-b border-slate-200/90 bg-white/95 px-4 py-3 backdrop-blur-sm print:hidden">
      <div className="mx-auto flex max-w-[52rem] flex-wrap items-center justify-between gap-3">
        <div>
          {title && <p className="text-sm font-semibold text-[#0f1e3d]">{title}</p>}
          {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
          {!subtitle && (
            <p className="text-xs text-slate-500">
              Opens the browser print dialog — pick &quot;Save as PDF&quot; as the destination to export.
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            onClick={onPrint}
            title="Opens print dialog — choose 'Save as PDF' destination to export"
          >
            <Printer className="size-3.5" aria-hidden />
            Print / Save as PDF
          </Button>
          {backHref && (
            <Link
              href={backHref}
              className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
            >
              Back to editor
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Certificate fields summary block ────────────────────────────────────────

/**
 * Renders the enabled certificate fields as a small summary table.
 * Handles the bleed-through issue: concatenates only non-blank parts.
 */
export function CertificateFieldsBlock({ model }) {
  const fields = model?.template?.fields ?? [];
  if (!fields.length) return null;

  const rows = [];

  if (fields.includes("Template name") && !isBlank(model.template?.name)) {
    rows.push({ label: "Template", value: model.template.name });
  }

  if (fields.includes("Customer")) {
    const parts = [model.customerName, model.customerAddress];
    const value = joinParts(parts, "\n");
    if (!isBlank(value)) rows.push({ label: "Customer", value });
  }

  if (fields.includes("Commodity Grade") || fields.includes("Commodity")) {
    const code = !isBlank(model.commodityCode) ? `(${model.commodityCode})` : "";
    const value = joinParts([model.commodityDescription, code], " ");
    if (!isBlank(value)) rows.push({ label: "Commodity Grade", value });
  }

  if (fields.includes("Fumigant")) {
    const parts = [
      model.fumigant?.name,
      !isBlank(model.fumigant?.code) ? `(${model.fumigant.code})` : "",
      !isBlank(model.fumigant?.activeConstituent) ? `— ${model.fumigant.activeConstituent}` : "",
      !isBlank(model.fumigant?.productForm) ? `[${model.fumigant.productForm}]` : "",
    ];
    const value = joinParts(parts, " ");
    if (!isBlank(value)) rows.push({ label: "Fumigant", value });
  }

  if (fields.includes("Dosage")) {
    const main = joinParts([model.dosageValue, model.dosageUnit], " ");
    const calc = joinParts([model.calculatedDosageValue, model.calculatedDosageUnit], " ");
    if (!isBlank(main) || !isBlank(calc)) {
      rows.push({
        label: "Dosage",
        value: isBlank(main) ? "—" : main,
        sub: isBlank(calc) ? "" : `Calculated: ${calc}`,
      });
    }
  }

  if (fields.includes("Exposure")) {
    const value = joinParts([model.exposureTimeValue, model.exposureTimeUnit], " ");
    if (!isBlank(value)) rows.push({ label: "Exposure", value });
  }

  if (fields.includes("Location")) {
    const parts = [model.enclosureDescription, ...(model.containerNumbers ?? [])];
    const value = joinParts(parts, ", ");
    if (!isBlank(value)) rows.push({ label: "Location", value });
  }

  if (fields.includes("Fumigator") && !isBlank(model.fumigatorName)) {
    rows.push({ label: "Fumigator", value: model.fumigatorName });
  }

  if (fields.includes("Date issued") && !isBlank(model.issuedDate)) {
    rows.push({ label: "Date issued", value: model.issuedDate });
  }

  if (!rows.length) return null;

  return (
    <table className="w-full text-sm border-collapse mb-4">
      <tbody>
        {rows.map(({ label, value, sub }) => (
          <tr key={label} className="border-b border-gray-200">
            <td className="py-1.5 pr-4 font-medium text-gray-600 w-32 align-top">{label}</td>
            <td className="py-1.5 text-gray-900 whitespace-pre-line">
              {value}
              {sub && <span className="block text-xs text-gray-500">{sub}</span>}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
