"use client";

import { useEffect, useMemo, useState } from "react";

import { ALL_SECTIONS, SECTION_LABELS, collectReportData, getCommodityDirectory, getCustomerDirectory } from "@/lib/reports-data";
import { Button } from "@/components/ui/button";
import { CommodityMultiSelect } from "@/components/reports/commodity-multi-select";
import { MultiSelectCombobox } from "@/components/reports/multi-select-combobox";
import { ReportPreview } from "@/components/reports/report-preview";
import { SendOrDownloadDialog } from "@/components/reports/send-or-download-dialog";
import { adHocPreset } from "@/lib/reports-windows";
import { cn } from "@/lib/utils";

const inputClass =
  "h-7 rounded-md border border-slate-200 bg-white px-2 text-[11px] text-slate-800 outline-none focus:border-brand/35 focus:ring-2 focus:ring-brand/15";

const PRESETS = [
  { key: "yesterday", label: "Yesterday" },
  { key: "last7", label: "Last 7 days" },
  { key: "monthToDate", label: "Month-to-date" },
  { key: "lastMonth", label: "Last month" },
];

export function AdHocBuilder({ onRanComplete }) {
  const customers = useMemo(() => getCustomerDirectory(), []);
  const commodities = useMemo(() => getCommodityDirectory(), []);

  const [dateRange, setDateRange] = useState(() => adHocPreset("yesterday"));
  const [activePreset, setActivePreset] = useState("yesterday");
  const [commodityIds, setCommodityIds] = useState([]);
  const [customerIds, setCustomerIds] = useState([]);
  const [sections, setSections] = useState(ALL_SECTIONS);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [previewReports, setPreviewReports] = useState([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState("");
  const [previewSections, setPreviewSections] = useState([]);

  useEffect(() => {
    if (!activePreset) return;
    const preset = adHocPreset(activePreset);
    if (preset) setDateRange(preset);
  }, [activePreset]);

  function applyPreset(key) {
    setActivePreset(key);
  }

  function toggleSection(key) {
    setSections((prev) => (prev.includes(key) ? prev.filter((s) => s !== key) : [...prev, key]));
  }

  const canRun = customerIds.length > 0 && sections.length > 0 && dateRange?.from && dateRange?.to;

  async function handlePreview() {
    setPreviewLoading(true);
    setPreviewError("");
    setPreviewSections(sections);
    try {
      const reports = [];
      for (const cid of customerIds) {
        const r = await collectReportData({ dateRange, customerId: cid, commodityIds, sections });
        reports.push(r);
      }
      setPreviewReports(reports);
    } catch (e) {
      setPreviewReports([]);
      setPreviewError(e?.message || "Failed to generate preview.");
    } finally {
      setPreviewLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Date range</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => applyPreset(p.key)}
              className={cn(
                "inline-flex h-7 items-center rounded-md border px-2.5 text-[11px] font-medium transition-colors",
                activePreset === p.key
                  ? "border-brand/30 bg-brand/15 text-brand-ink shadow-sm"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              )}
            >
              {p.label}
            </button>
          ))}
          <div className="ms-auto flex items-center gap-2 text-[11px]">
            <label className="text-slate-500">From</label>
            <input
              type="date"
              className={`${inputClass} w-[140px]`}
              value={dateRange?.from || ""}
              onChange={(e) => {
                setActivePreset("custom");
                setDateRange((prev) => ({ ...(prev || {}), from: e.target.value }));
              }}
            />
            <label className="text-slate-500">To</label>
            <input
              type="date"
              className={`${inputClass} w-[140px]`}
              value={dateRange?.to || ""}
              onChange={(e) => {
                setActivePreset("custom");
                setDateRange((prev) => ({ ...(prev || {}), to: e.target.value }));
              }}
            />
          </div>
        </div>
        <p className="mt-2 text-[10px] text-slate-500">
          Stock on Hand is a point-in-time snapshot as at the range end ({dateRange?.to || "—"}); it doesn&apos;t replay history.
        </p>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Customers</p>
          <div className="mt-2">
            <MultiSelectCombobox
              options={customers}
              value={customerIds}
              onChange={setCustomerIds}
              getId={(c) => Number(c.id)}
              getLabel={(c) => c.name}
              getMeta={(c) => c.code || ""}
              placeholder="Select customers..."
              searchPlaceholder="Filter customers..."
            />
            <p className="mt-2 text-[10px] text-slate-500">Select one or more customers to include in the run.</p>
          </div>
        </section>
        <section className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Commodities</p>
          <div className="mt-2">
            <CommodityMultiSelect commodities={commodities} value={commodityIds} onChange={setCommodityIds} />
          </div>
        </section>
      </div>

      <section className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Report sections</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {ALL_SECTIONS.map((s) => {
            const selected = sections.includes(s);
            return (
              <button
                key={s}
                type="button"
                onClick={() => toggleSection(s)}
                className={cn(
                  "inline-flex h-7 items-center rounded-md border px-2.5 text-[11px] font-medium transition-colors",
                  selected
                    ? "border-brand/30 bg-brand/15 text-brand-ink shadow-sm"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                )}
              >
                {SECTION_LABELS[s]}
              </button>
            );
          })}
        </div>
      </section>

      <div className="flex items-center justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!canRun || previewLoading}
          onClick={handlePreview}
          className="h-8 px-3 text-[11px]"
        >
          {previewLoading ? "Generating…" : "Preview"}
        </Button>
        <Button type="button" size="sm" disabled={!canRun} onClick={() => setDialogOpen(true)} className="h-8 px-3 text-[11px]">
          Continue → Download or Send
        </Button>
      </div>

      <ReportPreview
        reportsByCustomer={previewReports}
        sections={previewSections}
        loading={previewLoading}
        error={previewError}
      />

      <SendOrDownloadDialog
        open={dialogOpen}
        request={{
          source: "ad-hoc",
          dateRange,
          customerIds,
          commodityIds,
          sections,
        }}
        onClose={() => setDialogOpen(false)}
        onComplete={() => onRanComplete?.()}
      />
    </div>
  );
}
