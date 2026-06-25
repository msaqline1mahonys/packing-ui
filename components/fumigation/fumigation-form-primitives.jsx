"use client";

import { cn } from "@/lib/utils";

export const inputClass =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-brand/15 focus:border-brand/35 focus:ring-2 disabled:bg-slate-50 disabled:text-slate-400";

export const labelClass = "block text-xs font-medium text-slate-600 mb-1";

export function FormField({ label, wide = false, children, className }) {
  return (
    <div className={cn("space-y-1", wide && "sm:col-span-2", className)}>
      <label className={labelClass}>{label}</label>
      {children}
    </div>
  );
}

export function SectionHeading({ children }) {
  return (
    <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 border-b border-slate-100 pb-1 mb-3">
      {children}
    </h3>
  );
}

export function SectionCard({ children, className }) {
  return (
    <section className={cn("rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4", className)}>
      {children}
    </section>
  );
}

/** Shared sticky page toolbar for both cert and record editors */
export function EditorToolbar({
  title,
  subtitle,
  onSaveAndPrint,
  onSaveAndPreview,
  onRefreshFromPack,
  onDiscard,
  onBackToPack,
}) {
  return (
    <div className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur-sm">
      <div className="flex w-full flex-wrap items-center justify-between gap-3 px-4 py-3 md:px-6">
        <div>
          <p className="text-sm font-semibold text-slate-900">{title}</p>
          {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          {onSaveAndPrint && (
            <button
              type="button"
              onClick={onSaveAndPrint}
              className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand/90"
            >
              Save &amp; Print
            </button>
          )}
          {onSaveAndPreview && (
            <button
              type="button"
              onClick={onSaveAndPreview}
              className="rounded-lg bg-slate-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-600"
            >
              Save &amp; Preview
            </button>
          )}
          {onRefreshFromPack && (
            <button
              type="button"
              onClick={onRefreshFromPack}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
              title="Re-populate from pack data (overrides unsaved changes)"
            >
              Refresh from pack
            </button>
          )}
          {onDiscard && (
            <button
              type="button"
              onClick={onDiscard}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
            >
              Discard
            </button>
          )}
          {onBackToPack && (
            <button
              type="button"
              onClick={onBackToPack}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
            >
              Back to pack
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/** Scaled preview pane used in both editors' right-hand live preview */
export function DocumentPreview({ children }) {
  return (
    <aside className="sticky top-20 flex max-h-[calc(100vh-6rem)] min-w-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="shrink-0 border-b border-slate-100 px-4 py-2 text-xs font-medium text-slate-500">
        Live preview
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-3">
        <div className="w-full min-w-0 text-[10px] leading-tight [&_table]:text-[9px]">
          {children}
        </div>
      </div>
    </aside>
  );
}
