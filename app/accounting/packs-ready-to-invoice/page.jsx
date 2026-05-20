"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  PACKS_READY_TO_INVOICE,
  calculateInitialLineItems,
  calculateLineItemAmount,
  formatCurrency,
  formatTon,
} from "@/lib/packs-ready-to-invoice-dummy";

export default function PacksReadyToInvoicePage() {
  const [selectedPackId, setSelectedPackId] = useState("");

  const packsWithBreakdown = useMemo(
    () =>
      PACKS_READY_TO_INVOICE.map((pack) => ({
        ...pack,
        lineItems: calculateInitialLineItems(pack),
        invoiceTotal: calculateInitialLineItems(pack).reduce((total, item) => total + calculateLineItemAmount(item), 0),
      })),
    []
  );

  const selectedPack = useMemo(() => packsWithBreakdown.find((pack) => pack.id === selectedPackId) || null, [packsWithBreakdown, selectedPackId]);

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs text-slate-500">Accounting / Packs Ready To Invoice</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 md:text-[1.65rem]">Packs Ready To Invoice</h1>
        <p className="mt-1 text-xs text-slate-500">
          Click a pack row to expand and view guideline cost lines, then use Edit Breakdown to update unit prices.
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Pack List</h2>
            <p className="text-[11px] text-slate-500">{packsWithBreakdown.length} invoice-ready packs (dummy data)</p>
          </div>
          <Link
            href={selectedPack ? `/accounting/packs-ready-to-invoice/${encodeURIComponent(selectedPack.id)}` : "#"}
            className={`inline-flex items-center rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
              selectedPack ? "bg-brand text-white hover:bg-brand/90" : "cursor-not-allowed bg-slate-200 text-slate-500"
            }`}
            aria-disabled={!selectedPack}
            onClick={(event) => {
              if (!selectedPack) event.preventDefault();
            }}
          >
            Edit Breakdown
          </Link>
        </div>
        <div className="max-h-[620px] overflow-auto">
          <div className="grid min-w-[760px] grid-cols-[140px_minmax(220px,1fr)_130px_130px_130px_160px] border-b border-slate-200 bg-white px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            <span>Pack ID</span>
            <span>Customer / Commodity</span>
            <span>Containers</span>
            <span>Total Weight</span>
            <span>Vessel</span>
            <span className="text-right">Invoice Total</span>
          </div>
          {packsWithBreakdown.map((pack) => {
            const isSelected = pack.id === selectedPack?.id;
            return (
              <div key={pack.id} className="border-b border-slate-100 last:border-b-0">
                <button
                  type="button"
                  onClick={() => setSelectedPackId((prev) => (prev === pack.id ? "" : pack.id))}
                  className={`grid w-full min-w-[760px] grid-cols-[140px_minmax(220px,1fr)_130px_130px_130px_160px] cursor-pointer items-center px-4 py-3 text-left text-sm transition-colors ${
                    isSelected ? "bg-blue-50" : "hover:bg-slate-50"
                  }`}
                >
                  <span className="font-semibold text-slate-800">{pack.id}</span>
                  <span className="text-slate-700">
                    {pack.customer} <span className="text-slate-400">•</span> {pack.commodity}
                  </span>
                  <span className="text-slate-700">{pack.totalContainers}</span>
                  <span className="text-slate-700">{formatTon(pack.totalWeightTon)}</span>
                  <span className="text-slate-700">{pack.vessel}</span>
                  <span className="text-right font-semibold text-brand">{formatCurrency(pack.invoiceTotal)}</span>
                </button>

                {isSelected ? (
                  <div className="min-w-[760px] bg-blue-50 px-4 pb-3">
                    <div className="border-t border-blue-100 pt-2">
                      <div className="grid grid-cols-[56px_minmax(220px,1fr)_150px_100px_120px] items-center gap-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                        <span>Line</span>
                        <span>Cost line</span>
                        <span>Unit price</span>
                        <span>Qty</span>
                        <span className="text-right">Amount</span>
                      </div>
                      <div>
                        {pack.lineItems.map((item, index) => (
                          <div
                            key={item.id}
                            className="grid grid-cols-[56px_minmax(220px,1fr)_150px_100px_120px] items-center gap-2 border-b border-blue-100/90 py-1.5 text-xs last:border-b-0"
                          >
                            <span className="text-slate-500">{index + 1}</span>
                            <span className="font-medium text-slate-700">{item.label}</span>
                            <span className="text-slate-600">
                              {formatCurrency(item.unitPrice)} / {item.unitLabel}
                            </span>
                            <span className="text-slate-600">{item.quantity}</span>
                            <span className="text-right font-semibold text-slate-800">
                              {formatCurrency(calculateLineItemAmount(item))}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

