"use client";

import Link from "next/link";

import { calculateLineItemAmount, formatCurrency, formatTon } from "@/lib/packs-ready-to-invoice-dummy";

const BREAKDOWN_GRID =
  "grid grid-cols-[56px_minmax(180px,1fr)_150px_100px_minmax(160px,1fr)_120px] items-center gap-2";

export default function PackCostBreakdownPanel({
  breakdown,
  loading = false,
  errorText = "",
  emptyText = "Save the pack to view the cost breakdown.",
  showReadyToInvoiceLink = false,
  readyToInvoiceHref = "",
}) {
  const lineItems = breakdown?.lineItems ?? [];
  const progress = breakdown?.progress;
  const total =
    breakdown?.breakdownTotal ??
    breakdown?.invoiceTotal ??
    lineItems.reduce((sum, item) => sum + calculateLineItemAmount(item), 0);

  if (loading) {
    return <p className="py-8 text-center text-sm text-slate-400">Loading cost breakdown…</p>;
  }

  if (errorText) {
    return (
      <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{errorText}</div>
    );
  }

  if (!breakdown) {
    return <p className="py-6 text-sm text-slate-500">{emptyText}</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Cost breakdown</h3>
          <p className="mt-1 text-xs text-slate-500">
            Guideline revenue lines from accounting pricing rules, scaled to the pack&apos;s current packing progress.
          </p>
        </div>
        {showReadyToInvoiceLink && readyToInvoiceHref ? (
          <Link
            href={readyToInvoiceHref}
            className="inline-flex items-center rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"
          >
            Open in Ready To Invoice
          </Link>
        ) : null}
      </div>

      {progress ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            label="Containers packed"
            value={`${progress.packedContainers ?? 0} / ${progress.requiredContainers ?? 0}`}
          />
          <MetricCard
            label="Weight packed"
            value={`${formatTon(progress.packedWeightTon ?? 0)} of ${formatTon(progress.plannedWeightTon ?? 0)}`}
          />
          <MetricCard label="Terminal" value={breakdown.terminal || "—"} />
          <MetricCard label="Container park" value={breakdown.containerPark || "—"} />
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <div className={`${BREAKDOWN_GRID} border-b border-slate-200 px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500`}>
          <span>Line</span>
          <span>Cost line</span>
          <span>Unit price</span>
          <span>Qty</span>
          <span>Basis</span>
          <span className="text-right">Amount</span>
        </div>

        {lineItems.length === 0 ? (
          <p className="px-3 py-8 text-center text-sm text-slate-500">No cost lines available for this pack yet.</p>
        ) : (
          lineItems.map((item, index) => (
            <div
              key={item.id ?? `line-${index}`}
              className={`${BREAKDOWN_GRID} border-b border-slate-100 px-3 py-2 text-xs last:border-b-0`}
            >
              <span className="text-slate-500">{index + 1}</span>
              <span className="font-medium text-slate-700">{item.label}</span>
              <span className="text-slate-600">
                {formatCurrency(item.unitPrice)} / {item.unitLabel}
              </span>
              <span className="text-slate-600">{item.quantity}</span>
              <span className="text-slate-600">{item.basisText || "—"}</span>
              <span className="text-right font-semibold text-slate-800">
                {formatCurrency(calculateLineItemAmount(item))}
              </span>
            </div>
          ))
        )}

        <div className={`${BREAKDOWN_GRID} border-t border-slate-200 bg-slate-50 px-3 py-2.5 text-sm`}>
          <span className="col-span-5 font-semibold text-slate-900">Breakdown total</span>
          <span className="text-right text-base font-bold text-brand">{formatCurrency(total)}</span>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}
