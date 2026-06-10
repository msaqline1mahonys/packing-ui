"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

import {
  calculateLineItemAmount,
  createFeeLineItem,
  formatCurrency,
  formatTon,
} from "@/lib/packs-ready-to-invoice-dummy";
import { findPackReadyToInvoice } from "@/lib/packs-ready-to-invoice";
import { createInvoice } from "@/lib/api/accounting";

export default function PackInvoiceBreakdownPage() {
  const params = useParams();
  const packId = decodeURIComponent(String(params?.packId || ""));

  const [selectedPack, setSelectedPack] = useState(null);
  const [lineItems, setLineItems] = useState([]);
  const [selectedChargeId, setSelectedChargeId] = useState("");

  // Generate Invoice state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [generatedInvoice, setGeneratedInvoice] = useState(null);
  const [invoiceError, setInvoiceError] = useState(null);

  useEffect(() => {
    findPackReadyToInvoice(packId).then((pack) => {
      setSelectedPack(pack || null);
      setLineItems(pack?.lineItems ?? []);
    });
  }, [packId]);

  const availableCharges = useMemo(
    () =>
      (selectedPack?.charges ?? []).filter(
        (charge) => !lineItems.some((item) => item.source === "fee" && item.chargeId === charge.id)
      ),
    [lineItems, selectedPack]
  );

  const invoiceTotal = useMemo(() => lineItems.reduce((total, item) => total + calculateLineItemAmount(item), 0), [lineItems]);

  function handleRemoveLineItem(id) {
    setLineItems((prev) => prev.filter((item) => item.id !== id));
  }

  function handleAddCharge() {
    if (!selectedPack || !selectedChargeId) return;
    const charge = (selectedPack.charges ?? []).find((item) => String(item.id) === selectedChargeId);
    if (!charge) return;

    setLineItems((prev) => [...prev, createFeeLineItem(charge, selectedPack)]);
    setSelectedChargeId("");
  }

  function handleUnitPriceChange(id, value) {
    const parsed = Number.parseFloat(value);
    const nextUnitPrice = Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
    setLineItems((prev) => prev.map((item) => (item.id === id ? { ...item, unitPrice: nextUnitPrice } : item)));
  }

  async function handleGenerateInvoice() {
    if (!selectedPack || isSubmitting || generatedInvoice) return;
    setIsSubmitting(true);
    setInvoiceError(null);
    try {
      const result = await createInvoice({ packId: selectedPack.id, lineItems });
      setGeneratedInvoice(result);
    } catch (err) {
      setInvoiceError(err?.message || "Failed to generate invoice. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!selectedPack) {
    return (
      <div className="space-y-4">
        <p className="text-xs text-slate-500">Accounting / Ready To Invoice / Breakdown</p>
        <div className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600">
          Pack not found.{" "}
          <Link href="/accounting/packs-ready-to-invoice" className="font-semibold text-brand hover:underline">
            Return to pack list
          </Link>
          .
        </div>
      </div>
    );
  }

  const isLocked = Boolean(generatedInvoice);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs text-slate-500">Accounting / Ready To Invoice / Breakdown</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 md:text-[1.65rem]">
            Invoice Breakdown - {selectedPack.id}
          </h1>
          <p className="mt-1 text-xs text-slate-500">
            Unit prices are brought back as guideline values and can be edited before finalizing the breakdown.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/accounting/packs-ready-to-invoice"
            className="inline-flex items-center rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"
          >
            Back to Pack List
          </Link>
          <button
            type="button"
            onClick={handleGenerateInvoice}
            disabled={isSubmitting || isLocked}
            className="inline-flex items-center rounded-md bg-brand px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? "Generating…" : "Generate Invoice"}
          </button>
        </div>
      </div>

      {generatedInvoice ? (
        <div className="rounded-xl border border-green-200 bg-green-50 p-4">
          <p className="text-sm font-semibold text-green-800">Invoice generated successfully!</p>
          <p className="mt-1 text-xs text-green-700">
            Invoice number: <span className="font-semibold">{generatedInvoice.invoice_number}</span>
          </p>
          <p className="mt-2 text-xs text-green-700">
            <Link href="/accounting/packs-ready-to-invoice" className="font-semibold underline hover:text-green-900">
              Back to Pack List
            </Link>
          </p>
        </div>
      ) : null}

      {invoiceError ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
          <p className="text-sm font-semibold text-rose-800">Error generating invoice</p>
          <p className="mt-1 text-xs text-rose-700">{invoiceError}</p>
        </div>
      ) : null}

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{selectedPack.customer}</h2>
            <p className="text-sm text-slate-600">
              {selectedPack.commodity} • {selectedPack.vessel}
            </p>
          </div>
          <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
            Ready to Invoice
          </span>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <MetricCard label="Containers" value={selectedPack.totalContainers} />
          <MetricCard label="Total Weight" value={formatTon(selectedPack.totalWeightTon)} />
          <MetricCard
            label="Fumigation"
            value={selectedPack.fumigationRequired ? "Required" : "Not required"}
          />
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Edit Breakdown</h3>
            <p className="mt-1 text-xs text-slate-500">
              Remove line items as needed and edit unit prices. Additional fees can be added from Fees &amp; Charges.
            </p>
          </div>

          {!isLocked ? (
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={selectedChargeId}
                onChange={(event) => setSelectedChargeId(event.target.value)}
                className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-700 outline-none focus:border-brand/40 focus:ring-2 focus:ring-brand/20"
              >
                <option value="">Select fee/charge to add</option>
                {availableCharges.map((charge) => (
                  <option key={charge.id} value={String(charge.id)}>
                    {charge.chargeName} ({charge.chargeType})
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleAddCharge}
                disabled={!selectedChargeId}
                className="inline-flex items-center rounded-md bg-brand px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Add line item
              </button>
            </div>
          ) : null}
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[780px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                <th className="py-2 pr-3 font-semibold">Line #</th>
                <th className="py-2 pr-3 font-semibold">Cost line</th>
                <th className="py-2 pr-3 font-semibold">Unit price</th>
                <th className="py-2 pr-3 font-semibold">Qty</th>
                <th className="py-2 pr-3 font-semibold">Basis</th>
                <th className="py-2 pr-3 text-right font-semibold">Amount</th>
                <th className="py-2 text-right font-semibold">Action</th>
              </tr>
            </thead>
            <tbody className="text-slate-800">
              {lineItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-sm text-slate-500">
                    No line items currently on this invoice.
                  </td>
                </tr>
              ) : (
                lineItems.map((item, index) => (
                  <tr key={item.id} className="border-b border-slate-100 last:border-b-0">
                    <td className="py-3 pr-3 text-slate-500">{index + 1}</td>
                    <td className="py-3 pr-3 font-medium">{item.label}</td>
                    <td className="py-3 pr-3 text-slate-600">
                      {isLocked ? (
                        <span>{formatCurrency(item.unitPrice)} / {item.unitLabel}</span>
                      ) : (
                        <div className="inline-flex items-center gap-1.5">
                          <span className="text-[11px] text-slate-400">$</span>
                          <input
                            type="number"
                            min={0}
                            step={0.01}
                            value={item.unitPrice}
                            onWheel={(event) => event.currentTarget.blur()}
                            onChange={(event) => handleUnitPriceChange(item.id, event.target.value)}
                            className="w-24 rounded-md border border-slate-300 px-2 py-1 text-xs outline-none focus:border-brand/40 focus:ring-2 focus:ring-brand/20"
                          />
                          <span className="text-[11px] text-slate-500">/ {item.unitLabel}</span>
                        </div>
                      )}
                    </td>
                    <td className="py-3 pr-3 text-slate-600">{item.quantity}</td>
                    <td className="py-3 pr-3 text-slate-600">{item.basisText}</td>
                    <td className="py-3 pr-3 text-right font-semibold">{formatCurrency(calculateLineItemAmount(item))}</td>
                    <td className="py-3 text-right">
                      {!isLocked ? (
                        <button
                          type="button"
                          onClick={() => handleRemoveLineItem(item.id)}
                          className="inline-flex items-center rounded-md border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 transition-colors hover:bg-rose-100"
                        >
                          Remove
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            <tfoot>
              <tr className="border-t border-slate-300 bg-slate-50 text-slate-900">
                <td className="py-3 pr-3 text-sm font-semibold" colSpan={5}>
                  Invoice total
                </td>
                <td className="py-3 pr-3 text-right text-base font-bold">{formatCurrency(invoiceTotal)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
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
