"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import QuickAddChargePanel from "@/components/accounting/quick-add-charge-panel";
import { formatTon } from "@/lib/packs-ready-to-invoice-dummy";
import {
  buildBreakdownSavePayload,
  calculateLineItemAmount,
  createCustomChargeLineItem,
  formatCurrency,
  isCustomBreakdownLine,
  isQuantityEditable,
  normalizeCharges,
  serializeLineItemsForCompare,
} from "@/lib/pack-invoice-breakdown";
import { normalizePackCostBreakdown } from "@/lib/pack-cost-breakdown";
import { listCharges, savePackBreakdown } from "@/lib/api/accounting";

const TABLE_GRID = "min-w-[780px] w-full border-collapse text-left text-sm";

export default function PackInvoiceBreakdownEditor({
  breakdown,
  loading = false,
  errorText = "",
  emptyText = "Save the pack to view the cost breakdown.",
  readOnly = false,
  invoiceContext = false,
  showProgressCards = true,
  showReadyToInvoiceLink = false,
  readyToInvoiceHref = "",
  onSaved,
  onLineItemsChange,
}) {
  const [lineItems, setLineItems] = useState([]);
  const [excludedLineKeys, setExcludedLineKeys] = useState([]);
  const [selectedChargeId, setSelectedChargeId] = useState("");
  const [savedSnapshot, setSavedSnapshot] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveMessage, setSaveMessage] = useState("");
  const [fetchedCharges, setFetchedCharges] = useState([]);
  const [extraCharges, setExtraCharges] = useState([]);

  useEffect(() => {
    const nextItems = breakdown?.lineItems ?? [];
    setLineItems(nextItems);
    setExcludedLineKeys([]);
    setSavedSnapshot(serializeLineItemsForCompare(nextItems));
    setSaveError("");
    setSaveMessage("");
    setExtraCharges([]);
  }, [breakdown]);

  useEffect(() => {
    onLineItemsChange?.(lineItems);
  }, [lineItems, onLineItemsChange]);

  useEffect(() => {
    if ((breakdown?.charges ?? []).length > 0) {
      setFetchedCharges([]);
      return;
    }

    let cancelled = false;

    listCharges()
      .then((rows) => {
        if (cancelled) return;
        setFetchedCharges(normalizeCharges(rows));
      })
      .catch(() => {
        if (cancelled) return;
        setFetchedCharges([]);
      });

    return () => {
      cancelled = true;
    };
  }, [breakdown?.charges, breakdown?.id]);

  const baseCharges = breakdown?.charges?.length ? breakdown.charges : fetchedCharges;
  const charges = useMemo(() => {
    const byId = new Map();
    [...baseCharges, ...extraCharges].forEach((charge) => {
      if (charge?.id) byId.set(String(charge.id), charge);
    });
    return [...byId.values()];
  }, [baseCharges, extraCharges]);
  const progress = breakdown?.progress;
  const isLocked = readOnly;

  const availableCharges = useMemo(
    () =>
      charges.filter(
        (charge) => !lineItems.some((item) => item.source === "fee" && String(item.chargeId) === String(charge.id))
      ),
    [charges, lineItems]
  );

  const invoiceTotal = useMemo(
    () => lineItems.reduce((total, item) => total + calculateLineItemAmount(item), 0),
    [lineItems]
  );

  const isDirty = useMemo(() => {
    const current = serializeLineItemsForCompare(lineItems);
    return current !== savedSnapshot || excludedLineKeys.length > 0;
  }, [excludedLineKeys.length, lineItems, savedSnapshot]);

  function handleRemoveLineItem(item) {
    if (isLocked) return;
    setLineItems((prev) => prev.filter((row) => row.id !== item.id));
    if (!isCustomBreakdownLine(item.lineKey)) {
      setExcludedLineKeys((prev) => [...new Set([...prev, item.lineKey])]);
    }
  }

  function handleAddCharge() {
    if (!selectedChargeId || isLocked) return;
    const charge = charges.find((row) => String(row.id) === selectedChargeId);
    if (!charge) return;
    setLineItems((prev) => [...prev, createCustomChargeLineItem(charge, breakdown)]);
    setSelectedChargeId("");
  }

  function handleUnitPriceChange(id, value) {
    const parsed = Number.parseFloat(value);
    const nextUnitPrice = Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
    setLineItems((prev) => prev.map((item) => (item.id === id ? { ...item, unitPrice: nextUnitPrice } : item)));
  }

  function handleQuantityChange(id, value) {
    const parsed = Number.parseFloat(value);
    const nextQuantity = Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
    setLineItems((prev) => prev.map((item) => (item.id === id ? { ...item, quantity: nextQuantity } : item)));
  }

  function handleQuickAddCharge(charge) {
    setExtraCharges((prev) => {
      if (prev.some((row) => String(row.id) === String(charge.id))) return prev;
      return [...prev, charge];
    });
    setLineItems((prev) => {
      if (prev.some((item) => item.source === "fee" && String(item.chargeId) === String(charge.id))) {
        return prev;
      }
      return [...prev, createCustomChargeLineItem(charge, breakdown)];
    });
  }

  async function handleSave() {
    if (!breakdown?.id || isLocked || !isDirty || isSaving) return;

    setIsSaving(true);
    setSaveError("");
    setSaveMessage("");

    try {
      const result = await savePackBreakdown(breakdown.id, {
        lineItems: buildBreakdownSavePayload(lineItems, excludedLineKeys),
        invoiceContext,
      });
      const normalized = normalizePackCostBreakdown(result);
      const nextItems = normalized?.lineItems ?? lineItems;
      setLineItems(nextItems);
      setExcludedLineKeys([]);
      setSavedSnapshot(serializeLineItemsForCompare(nextItems));
      setSaveMessage("Breakdown saved.");
      onSaved?.(normalized ?? result);
    } catch (err) {
      setSaveError(err?.message || "Failed to save breakdown.");
    } finally {
      setIsSaving(false);
    }
  }

  if (loading) {
    return <p className="py-8 text-center text-sm text-slate-400">Loading cost breakdown…</p>;
  }

  if (errorText) {
    return <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{errorText}</div>;
  }

  if (!breakdown) {
    return <p className="py-6 text-sm text-slate-500">{emptyText}</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Invoice breakdown</h3>
          <p className="mt-1 text-xs text-slate-500">
            Remove line items as needed and edit unit prices or quantities. Additional fees can be added from Fees &amp;
            Charges.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {showReadyToInvoiceLink && readyToInvoiceHref ? (
            <Link
              href={readyToInvoiceHref}
              className="inline-flex items-center rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"
            >
              Open in Ready To Invoice
            </Link>
          ) : null}
          {!isLocked ? (
            <Button
              type="button"
              size="sm"
              disabled={!isDirty || isSaving}
              onClick={handleSave}
              className="h-7 px-2.5 text-[11px]"
            >
              {isSaving ? "Saving…" : "Save breakdown"}
            </Button>
          ) : null}
        </div>
      </div>

      {saveMessage ? (
        <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-800">{saveMessage}</div>
      ) : null}
      {saveError ? (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{saveError}</div>
      ) : null}

      {breakdown.packingInProgress ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-900">
          <p>Quantity updates automatically while packing is in progress.</p>
          <p className="mt-1">Unit price can be saved, but the line total may change until packing is complete.</p>
        </div>
      ) : null}

      {showProgressCards && progress ? (
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

      <div className="space-y-2">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Line items</p>
          </div>
          {!isLocked ? (
            <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
              <select
                value={selectedChargeId}
                onChange={(event) => setSelectedChargeId(event.target.value)}
                disabled={availableCharges.length === 0}
                className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-700 outline-none focus:border-brand/40 focus:ring-2 focus:ring-brand/20 disabled:cursor-not-allowed disabled:bg-slate-50"
              >
                <option value="">
                  {availableCharges.length === 0 ? "No fees/charges available to add" : "Select fee/charge to add"}
                </option>
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
              <QuickAddChargePanel disabled={isLocked} onCreated={handleQuickAddCharge} />
            </div>
          ) : null}
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className={TABLE_GRID}>
          <thead>
            <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
              <th className="py-2 pr-3 pl-3 font-semibold">Line #</th>
              <th className="py-2 pr-3 font-semibold">Cost line</th>
              <th className="py-2 pr-3 font-semibold">Qty</th>
              <th className="py-2 pr-3 font-semibold">Unit price</th>
              <th className="py-2 pr-3 font-semibold">Basis</th>
              <th className="py-2 pr-3 text-right font-semibold">Amount</th>
              {!isLocked ? <th className="py-2 pr-3 text-right font-semibold">Action</th> : null}
            </tr>
          </thead>
          <tbody className="text-slate-800">
            {lineItems.length === 0 ? (
              <tr>
                <td colSpan={isLocked ? 6 : 7} className="px-3 py-8 text-center text-sm text-slate-500">
                  No line items on this breakdown.
                </td>
              </tr>
            ) : (
              lineItems.map((item, index) => {
                const quantityEditable = isQuantityEditable(item, breakdown);
                return (
                  <tr key={item.id} className="border-b border-slate-100 last:border-b-0">
                    <td className="py-3 pr-3 pl-3 text-slate-500">{index + 1}</td>
                    <td className="py-3 pr-3 font-medium">{item.label}</td>
                    <td className="py-3 pr-3 text-slate-600">
                      {isLocked || !quantityEditable ? (
                        <span>{item.quantity}</span>
                      ) : (
                        <input
                          type="number"
                          min={0}
                          step={0.001}
                          value={item.quantity}
                          onWheel={(event) => event.currentTarget.blur()}
                          onChange={(event) => handleQuantityChange(item.id, event.target.value)}
                          className="w-24 rounded-md border border-slate-300 px-2 py-1 text-xs outline-none focus:border-brand/40 focus:ring-2 focus:ring-brand/20"
                        />
                      )}
                    </td>
                    <td className="py-3 pr-3 text-slate-600">
                      {isLocked ? (
                        <span>
                          {formatCurrency(item.unitPrice)} / {item.unitLabel}
                        </span>
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
                    <td className="py-3 pr-3 text-slate-600">{item.basisText || "—"}</td>
                    <td className="py-3 pr-3 text-right font-semibold">{formatCurrency(calculateLineItemAmount(item))}</td>
                    {!isLocked ? (
                      <td className="py-3 pr-3 text-right">
                        <button
                          type="button"
                          onClick={() => handleRemoveLineItem(item)}
                          className="inline-flex items-center rounded-md border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 transition-colors hover:bg-rose-100"
                        >
                          Remove
                        </button>
                      </td>
                    ) : null}
                  </tr>
                );
              })
            )}
          </tbody>
          <tfoot>
            <tr className="border-t border-slate-300 bg-slate-50 text-slate-900">
              <td className="py-3 pr-3 pl-3 text-sm font-semibold" colSpan={isLocked ? 5 : 5}>
                Breakdown total
              </td>
              <td className="py-3 pr-3 text-right text-base font-bold text-brand">{formatCurrency(invoiceTotal)}</td>
              {!isLocked ? <td /> : null}
            </tr>
          </tfoot>
        </table>
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
