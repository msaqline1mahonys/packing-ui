"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import dayjs from "dayjs";

import { Button } from "@/components/ui/button";
import CustomDateRangePicker from "@/components/ui/custom-date-range-picker";
import ClutchSelect from "@/components/custom/ClutchSelect";
import {
  calculateLineItemAmount,
  formatCurrency,
  formatTon,
} from "@/lib/packs-ready-to-invoice-dummy";
import { loadPacksReadyToInvoice, matchesPackingStartDateFilter, packDisplayRef, packScheduleEditPath } from "@/lib/packs-ready-to-invoice";
import { bulkCreateInvoices } from "@/lib/api/accounting";

const inputClass =
  "h-7 rounded-md border border-slate-200 bg-white px-2 text-[11px] text-slate-800 outline-none ring-brand/15 focus:border-brand/35 focus:ring-2";

const LIST_GRID =
  "grid min-w-[1220px] grid-cols-[40px_130px_minmax(180px,1fr)_100px_90px_100px_100px_110px_120px_130px]";

const DATE_FILTER_MODES = [
  { key: "all", label: "Any Date" },
  { key: "specific", label: "Specific Date" },
  { key: "range", label: "Date Range" },
];

const DATE_MODE_OPTS = DATE_FILTER_MODES.map((m) => ({ value: m.key, label: m.label }));

export default function PacksReadyToInvoicePage() {
  const [invoicePacks, setInvoicePacks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [selectedPackId, setSelectedPackId] = useState("");
  const [checkedPackIds, setCheckedPackIds] = useState(() => new Set());
  const [bulkSubmitting, setBulkSubmitting] = useState(false);
  const [bulkResult, setBulkResult] = useState(null);
  const [bulkError, setBulkError] = useState("");
  const [customerFilter, setCustomerFilter] = useState("all");
  const [commodityFilter, setCommodityFilter] = useState("all");
  const [dateFilterMode, setDateFilterMode] = useState("all");
  const [specificDate, setSpecificDate] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  useEffect(() => {
    setLoading(true);
    setLoadError("");
    loadPacksReadyToInvoice()
      .then((rows) => setInvoicePacks(Array.isArray(rows) ? rows : []))
      .catch((err) => {
        setInvoicePacks([]);
        setLoadError(err?.message || "Failed to load approved packs.");
      })
      .finally(() => setLoading(false));
  }, []);

  const packsWithBreakdown = useMemo(
    () =>
      invoicePacks.map((pack) => ({
        ...pack,
        lineItems: pack.lineItems ?? [],
        invoiceTotal: pack.invoiceTotal ?? (pack.lineItems ?? []).reduce((t, i) => t + calculateLineItemAmount(i), 0),
      })),
    [invoicePacks]
  );

  const customerOptions = useMemo(
    () => [...new Set(packsWithBreakdown.map((pack) => pack.customer).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [packsWithBreakdown]
  );

  const commodityOptions = useMemo(
    () => [...new Set(packsWithBreakdown.map((pack) => pack.commodity).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [packsWithBreakdown]
  );

  const customerSelectOpts = useMemo(
    () => [{ value: "all", label: "All customers" }, ...customerOptions.map((c) => ({ value: c, label: c }))],
    [customerOptions]
  );

  const commoditySelectOpts = useMemo(
    () => [{ value: "all", label: "All commodities" }, ...commodityOptions.map((c) => ({ value: c, label: c }))],
    [commodityOptions]
  );

  const filteredPacks = useMemo(() => {
    return packsWithBreakdown
      .filter((pack) => customerFilter === "all" || pack.customer === customerFilter)
      .filter((pack) => commodityFilter === "all" || pack.commodity === commodityFilter)
      .filter((pack) =>
        matchesPackingStartDateFilter(pack, {
          dateFilterMode,
          specificDate,
          dateFrom,
          dateTo,
        })
      );
  }, [packsWithBreakdown, customerFilter, commodityFilter, dateFilterMode, specificDate, dateFrom, dateTo]);

  const selectedPack = useMemo(
    () => filteredPacks.find((pack) => pack.id === selectedPackId) || null,
    [filteredPacks, selectedPackId]
  );

  useEffect(() => {
    if (selectedPackId && !filteredPacks.some((pack) => pack.id === selectedPackId)) {
      setSelectedPackId("");
    }
  }, [filteredPacks, selectedPackId]);

  const checkedPacks = useMemo(
    () => filteredPacks.filter((pack) => checkedPackIds.has(pack.id)),
    [checkedPackIds, filteredPacks]
  );

  const allVisibleChecked = filteredPacks.length > 0 && checkedPacks.length === filteredPacks.length;
  const someVisibleChecked = checkedPacks.length > 0 && !allVisibleChecked;

  function togglePackChecked(packId, checked) {
    setCheckedPackIds((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(packId);
      } else {
        next.delete(packId);
      }
      return next;
    });
  }

  function toggleAllVisibleChecked(checked) {
    if (!checked) {
      setCheckedPackIds(new Set());
      return;
    }
    setCheckedPackIds(new Set(filteredPacks.map((pack) => pack.id)));
  }

  async function handleBulkGenerateInvoices() {
    if (bulkSubmitting || checkedPacks.length === 0) return;

    const count = checkedPacks.length;
    const confirmed = window.confirm(
      `Generate ${count} invoice${count === 1 ? "" : "s"} using each pack's guideline breakdown?`
    );
    if (!confirmed) return;

    setBulkSubmitting(true);
    setBulkError("");
    setBulkResult(null);

    try {
      const result = await bulkCreateInvoices({
        invoices: checkedPacks.map((pack) => ({
          packId: pack.id,
          lineItems: pack.lineItems,
        })),
      });

      const created = Array.isArray(result?.created) ? result.created : [];
      const failed = Array.isArray(result?.failed) ? result.failed : [];
      const createdIds = new Set(created.map((entry) => String(entry.packId ?? entry.pack_id ?? "")));

      if (createdIds.size > 0) {
        setInvoicePacks((prev) => prev.filter((pack) => !createdIds.has(pack.id)));
        setCheckedPackIds((prev) => new Set([...prev].filter((id) => !createdIds.has(id))));
        if (selectedPackId && createdIds.has(selectedPackId)) {
          setSelectedPackId("");
        }
      }

      setBulkResult({
        created: created.map((entry) => ({
          ...entry,
          displayRef:
            packDisplayRef(checkedPacks.find((pack) => pack.id === String(entry.packId ?? entry.pack_id ?? ""))) ||
            String(entry.packId ?? entry.pack_id ?? ""),
        })),
        failed,
      });
    } catch (err) {
      setBulkError(err?.message || "Failed to generate invoices. Please try again.");
    } finally {
      setBulkSubmitting(false);
    }
  }

  const dateRangeValue = useMemo(
    () => [dateFrom ? dayjs(dateFrom) : null, dateTo ? dayjs(dateTo) : null],
    [dateFrom, dateTo]
  );

  const handleDateRangeChange = useCallback(([start, end]) => {
    setDateFrom(start && start.isValid() ? start.format("YYYY-MM-DD") : "");
    setDateTo(end && end.isValid() ? end.format("YYYY-MM-DD") : "");
  }, []);

  const hasActiveFilters = customerFilter !== "all" || commodityFilter !== "all" || dateFilterMode !== "all";

  function clearFilters() {
    setCustomerFilter("all");
    setCommodityFilter("all");
    setDateFilterMode("all");
    setSpecificDate("");
    setDateFrom("");
    setDateTo("");
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs text-slate-500">Accounting / Ready To Invoice</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 md:text-[1.65rem]">Ready To Invoice</h1>
        <p className="mt-1 text-xs text-slate-500">
          Approved packs from the packing schedule appear here with guideline invoice breakdowns. Open a pack in the schedule or
          expand a row below to review cost lines before editing the breakdown.
        </p>
      </div>

      {loadError ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{loadError}</div>
      ) : null}

      {bulkError ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{bulkError}</div>
      ) : null}

      {bulkResult ? (
        <div
          className={`rounded-xl border px-4 py-3 text-sm ${
            bulkResult.failed?.length
              ? "border-amber-200 bg-amber-50 text-amber-900"
              : "border-green-200 bg-green-50 text-green-900"
          }`}
        >
          <p className="font-semibold">
            {bulkResult.created.length} invoice{bulkResult.created.length === 1 ? "" : "s"} generated successfully.
          </p>
          {bulkResult.created.length > 0 ? (
            <ul className="mt-2 space-y-1 text-xs">
              {bulkResult.created.map((entry) => (
                <li key={entry.invoiceId ?? entry.invoice_id ?? entry.packId}>
                  {entry.displayRef || entry.packId}:{" "}
                  <span className="font-semibold">{entry.invoice_number ?? entry.invoiceNumber}</span>
                </li>
              ))}
            </ul>
          ) : null}
          {bulkResult.failed?.length ? (
            <div className="mt-3 border-t border-amber-200/80 pt-3">
              <p className="text-xs font-semibold uppercase tracking-wide">Could not invoice</p>
              <ul className="mt-1 space-y-1 text-xs">
                {bulkResult.failed.map((entry, index) => (
                  <li key={`${entry.packId ?? "unknown"}-${index}`}>
                    {entry.packId || "Unknown pack"}: {entry.message}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}

      <section className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[170px]">
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">Customer</label>
            <ClutchSelect
              className="w-full"
              options={customerSelectOpts}
              value={customerSelectOpts.find((o) => o.value === customerFilter) ?? null}
              onChange={(option) => setCustomerFilter(option ? option.value : "all")}
              isClearable={false}
              placeholder="All customers"
            />
          </div>
          <div className="min-w-[170px]">
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">Commodity</label>
            <ClutchSelect
              className="w-full"
              options={commoditySelectOpts}
              value={commoditySelectOpts.find((o) => o.value === commodityFilter) ?? null}
              onChange={(option) => setCommodityFilter(option ? option.value : "all")}
              isClearable={false}
              placeholder="All commodities"
            />
          </div>
          <div className="min-w-[170px]">
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">Packing Start Date</label>
            <ClutchSelect
              className="w-full"
              options={DATE_MODE_OPTS}
              value={DATE_MODE_OPTS.find((o) => o.value === dateFilterMode) ?? null}
              onChange={(option) => setDateFilterMode(option ? option.value : "all")}
              isClearable={false}
              placeholder="Any Dat"
            />
          </div>
          {dateFilterMode === "specific" ? (
            <div className="min-w-[170px]">
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">Specific Date</label>
              <input
                className={`${inputClass} w-full`}
                aria-label="Specific packing start date"
                type="date"
                value={specificDate}
                onChange={(event) => setSpecificDate(event.target.value)}
              />
            </div>
          ) : null}
          {dateFilterMode === "range" ? (
            <div className="min-w-[288px]">
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">Date Range</label>
              <div className="w-72">
                <CustomDateRangePicker value={dateRangeValue} onChange={handleDateRangeChange} />
              </div>
            </div>
          ) : null}
          {hasActiveFilters ? (
            <Button type="button" size="sm" variant="secondary" className="h-7 px-2.5 text-[11px]" onClick={clearFilters}>
              Clear
            </Button>
          ) : null}
        </div>
      </section>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Pack List</h2>
            <p className="text-[11px] text-slate-500">
              {filteredPacks.length} approved pack{filteredPacks.length === 1 ? "" : "s"} ready to invoice
              {filteredPacks.length !== packsWithBreakdown.length ? ` (${packsWithBreakdown.length} total)` : ""}
              {checkedPacks.length > 0 ? ` • ${checkedPacks.length} selected` : ""}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              disabled={checkedPacks.length === 0 || bulkSubmitting}
              onClick={handleBulkGenerateInvoices}
              className="h-7 px-2.5 text-[11px]"
            >
              {bulkSubmitting
                ? "Generating…"
                : `Generate Invoice${checkedPacks.length === 1 ? "" : "s"}${checkedPacks.length > 0 ? ` (${checkedPacks.length})` : ""}`}
            </Button>
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
        </div>
        <div className="max-h-[620px] overflow-auto">
          <div className={`${LIST_GRID} border-b border-slate-200 bg-white px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500`}>
            <span className="flex items-center">
              <input
                type="checkbox"
                aria-label="Select all visible packs"
                checked={allVisibleChecked}
                ref={(element) => {
                  if (element) element.indeterminate = someVisibleChecked;
                }}
                onChange={(event) => toggleAllVisibleChecked(event.target.checked)}
                disabled={filteredPacks.length === 0 || bulkSubmitting}
                className="h-3.5 w-3.5 rounded border-slate-300 text-brand focus:ring-brand/30"
              />
            </span>
            <span>Job Ref</span>
            <span>Customer / Commodity</span>
            <span>Packing Start</span>
            <span>Containers</span>
            <span>Total Weight</span>
            <span>Vessel</span>
            <span>Terminal</span>
            <span>Container Park</span>
            <span className="text-right">Invoice Total</span>
          </div>
          {loading ? (
            <p className="px-4 py-8 text-center text-xs text-slate-400">Loading approved packs…</p>
          ) : filteredPacks.length === 0 ? (
            <p className="px-4 py-8 text-center text-xs text-slate-400">
              {packsWithBreakdown.length
                ? "No approved packs match the current filters."
                : "No approved packs are ready to invoice. Set a pack to Approved on the packing schedule once operations are complete."}
            </p>
          ) : (
            filteredPacks.map((pack) => {
              const isSelected = pack.id === selectedPack?.id;
              const isChecked = checkedPackIds.has(pack.id);
              const displayRef = packDisplayRef(pack);
              return (
                <div key={pack.id} className="border-b border-slate-100 last:border-b-0">
                  <div
                    className={`${LIST_GRID} w-full items-center px-4 py-3 text-left text-sm transition-colors ${
                      isSelected ? "bg-blue-50" : isChecked ? "bg-slate-50/80" : "hover:bg-slate-50"
                    }`}
                  >
                    <span className="flex items-center">
                      <input
                        type="checkbox"
                        aria-label={`Select ${displayRef} for bulk invoice`}
                        checked={isChecked}
                        disabled={bulkSubmitting}
                        onChange={(event) => togglePackChecked(pack.id, event.target.checked)}
                        onClick={(event) => event.stopPropagation()}
                        className="h-3.5 w-3.5 rounded border-slate-300 text-brand focus:ring-brand/30"
                      />
                    </span>
                    <button
                      type="button"
                      onClick={() => setSelectedPackId((prev) => (prev === pack.id ? "" : pack.id))}
                      className="contents cursor-pointer text-left"
                    >
                      <span className="font-semibold text-slate-800">
                        <Link
                          href={packScheduleEditPath(pack.id)}
                          className="text-brand hover:underline"
                          onClick={(event) => event.stopPropagation()}
                        >
                          {displayRef}
                        </Link>
                      </span>
                      <span className="text-slate-700">
                        {pack.customer} <span className="text-slate-400">•</span> {pack.commodity}
                      </span>
                      <span className="text-slate-700">{pack.packingStartDate || "—"}</span>
                      <span className="text-slate-700">{pack.totalContainers}</span>
                      <span className="text-slate-700">{formatTon(pack.totalWeightTon)}</span>
                      <span className="text-slate-700">{pack.vessel || "—"}</span>
                      <span className="text-slate-700">{pack.terminal || "—"}</span>
                      <span className="truncate text-slate-700" title={pack.containerPark || undefined}>
                        {pack.containerPark || "—"}
                      </span>
                      <span className="text-right font-semibold text-brand">{formatCurrency(pack.invoiceTotal)}</span>
                    </button>
                  </div>

                  {isSelected ? (
                    <div className="min-w-[1220px] bg-blue-50 px-4 pb-3">
                      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-blue-100 pt-2">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Guideline breakdown</p>
                        <Link
                          href={packScheduleEditPath(pack.id)}
                          className="text-[11px] font-semibold text-brand hover:underline"
                        >
                          Open in Packing Schedule
                        </Link>
                      </div>
                      <div className="mt-2">
                        <div className="grid grid-cols-[56px_minmax(180px,1fr)_150px_100px_minmax(160px,1fr)_120px] items-center gap-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                          <span>Line</span>
                          <span>Cost line</span>
                          <span>Unit price</span>
                          <span>Qty</span>
                          <span>Basis</span>
                          <span className="text-right">Amount</span>
                        </div>
                        <div>
                          {pack.lineItems.map((item, index) => (
                            <div
                              key={item.id}
                              className="grid grid-cols-[56px_minmax(180px,1fr)_150px_100px_minmax(160px,1fr)_120px] items-center gap-2 border-b border-blue-100/90 py-1.5 text-xs last:border-b-0"
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
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
