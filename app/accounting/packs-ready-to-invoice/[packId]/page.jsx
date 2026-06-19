"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

import PackInvoiceBreakdownEditor from "@/components/accounting/pack-invoice-breakdown-editor";
import { formatCurrency, formatTon } from "@/lib/packs-ready-to-invoice-dummy";
import { findPackReadyToInvoice, packDisplayRef, packScheduleEditPath } from "@/lib/packs-ready-to-invoice";
import { createInvoice } from "@/lib/api/accounting";

export default function PackInvoiceBreakdownPage() {
  const params = useParams();
  const packId = decodeURIComponent(String(params?.packId || ""));

  const [selectedPack, setSelectedPack] = useState(null);
  const [invoiceLineItems, setInvoiceLineItems] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [generatedInvoice, setGeneratedInvoice] = useState(null);
  const [invoiceError, setInvoiceError] = useState(null);

  const loadPack = useCallback(async () => {
    const pack = await findPackReadyToInvoice(packId);
    setSelectedPack(pack || null);
    setInvoiceLineItems(pack?.lineItems ?? []);
    return pack;
  }, [packId]);

  useEffect(() => {
    loadPack();
  }, [loadPack]);

  const invoiceTotal = useMemo(
    () => invoiceLineItems.reduce((total, item) => total + (Number(item.unitPrice) || 0) * (Number(item.quantity) || 0), 0),
    [invoiceLineItems]
  );

  async function handleGenerateInvoice() {
    if (!selectedPack || isSubmitting || generatedInvoice) return;
    setIsSubmitting(true);
    setInvoiceError(null);
    try {
      const result = await createInvoice({ packId: selectedPack.id, lineItems: invoiceLineItems });
      setGeneratedInvoice(result);
    } catch (err) {
      setInvoiceError(err?.message || "Failed to generate invoice. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleBreakdownSaved(nextBreakdown) {
    if (!nextBreakdown) return;
    setSelectedPack((prev) => (prev ? { ...prev, ...nextBreakdown } : nextBreakdown));
    setInvoiceLineItems(nextBreakdown.lineItems ?? []);
  }

  function handleLineItemsChange(items) {
    setInvoiceLineItems(items ?? []);
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
            Invoice Breakdown - {packDisplayRef(selectedPack)}
          </h1>
          <p className="mt-1 text-xs text-slate-500">
            Edit and save the invoice breakdown before generating the invoice. Progress-linked quantities were finalised when
            this pack was approved.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={packScheduleEditPath(selectedPack.id)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"
          >
            Open in Packing Schedule
          </Link>
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
          <div className="text-right">
            <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
              Ready to Invoice
            </span>
            <p className="mt-2 text-xs text-slate-500">
              Current total: <span className="font-semibold text-slate-800">{formatCurrency(invoiceTotal)}</span>
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <MetricCard label="Job Ref" value={packDisplayRef(selectedPack)} />
          <MetricCard label="Containers" value={selectedPack.totalContainers} />
          <MetricCard label="Total Weight" value={formatTon(selectedPack.totalWeightTon)} />
          <MetricCard label="Terminal" value={selectedPack.terminal || "—"} />
          <MetricCard label="Container Park" value={selectedPack.containerPark || "—"} />
          <MetricCard
            label="Fumigation"
            value={selectedPack.fumigationRequired ? "Required" : "Not required"}
          />
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <PackInvoiceBreakdownEditor
          breakdown={selectedPack}
          readOnly={isLocked}
          invoiceContext
          showProgressCards={false}
          onSaved={handleBreakdownSaved}
          onLineItemsChange={handleLineItemsChange}
        />
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
