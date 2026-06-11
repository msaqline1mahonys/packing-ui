"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Grid } from "@/components/clutch-table";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  fetchStockTransferFormData,
  fetchStockTransfers,
  createStockTransfer,
  getDefaultSiteId,
} from "@/lib/stock-transfers-api";
import CustomerTransferForm from "./_components/customer-transfer-form";
import CommodityTransferForm from "./_components/commodity-transfer-form";
import LocationMoveForm from "./_components/location-move-form";

const TYPES = [
  { value: "customer", label: "Customer → Customer", description: "Move a commodity from one customer's account to another, at the same location." },
  { value: "commodity", label: "Commodity → Commodity", description: "Re-grade: convert one commodity to another for the same customer, at one location." },
  { value: "location", label: "Location → Location", description: "Relocate a commodity between locations — pick which owners' stock to move." },
];
const TYPE_LABEL = Object.fromEntries(TYPES.map((t) => [t.value, t.label]));

const gridColumns = [
  { key: "dateDisplay", header: "Date", type: "text", sortable: true, filterable: true, resizable: true },
  { key: "typeLabel", header: "Type", type: "text", sortable: true, filterable: true, resizable: true },
  { key: "reference", header: "Reference", type: "text", sortable: true, filterable: true, resizable: true },
  { key: "amountDisplay", header: "Amount (t)", type: "text", sortable: true, filterable: true, resizable: true },
  { key: "linesDisplay", header: "Lines", type: "text", sortable: true, filterable: true, resizable: true },
  { key: "status", header: "Status", type: "text", sortable: true, filterable: true, resizable: true },
];

function formatDate(value) {
  if (!value) return "-";
  const normalized = String(value).includes("T") ? value : `${value}T00:00`;
  const d = new Date(normalized);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString(undefined, { dateStyle: "medium" });
}

export default function StockTransferPage() {
  const [sites, setSites] = useState([]);
  const [locations, setLocations] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [commodities, setCommodities] = useState([]);
  const [formLoading, setFormLoading] = useState(true);
  const [formError, setFormError] = useState("");

  const [transfers, setTransfers] = useState([]);
  const [activeType, setActiveType] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState("");

  const loadFormData = useCallback(async () => {
    setFormLoading(true);
    setFormError("");
    try {
      const data = await fetchStockTransferFormData();
      setSites(data.sites);
      setLocations(data.locations.filter((l) => l.status !== "inactive"));
      setCustomers(data.customers);
      setCommodities(data.commodities);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to load form data.");
    } finally {
      setFormLoading(false);
    }
  }, []);

  const loadTransfers = useCallback(async () => {
    try {
      setTransfers(await fetchStockTransfers());
    } catch {
      setTransfers([]);
    }
  }, []);

  useEffect(() => {
    loadFormData();
    loadTransfers();
  }, [loadFormData, loadTransfers]);

  const defaultSiteId = useMemo(() => getDefaultSiteId(sites), [sites]);

  const handleSubmit = useCallback(async (payload) => {
    setSubmitting(true);
    setFormError("");
    try {
      const created = await createStockTransfer(payload);
      setToast(`Transfer ${created?.reference ?? ""} saved`);
      setActiveType("");
      await loadTransfers();
      setTimeout(() => setToast(""), 2800);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to save transfer.");
    } finally {
      setSubmitting(false);
    }
  }, [loadTransfers]);

  const displayRows = useMemo(
    () =>
      transfers.map((t) => ({
        ...t,
        dateDisplay: formatDate(t.transferDate),
        typeLabel: TYPE_LABEL[t.transferType] ?? t.transferType,
        amountDisplay: Number(t.quantity || 0).toFixed(2),
        linesDisplay: String(Math.round((t.transactions?.length || 0) / 2)),
      })),
    [transfers]
  );

  const sharedProps = { sites, locations, customers, commodities, defaultSiteId, submitting, onSubmit: handleSubmit };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs text-slate-500">Stock Management / Stock Transfer</p>
          <h1 className="mt-0.5 text-2xl font-semibold tracking-tight text-slate-900">Stock Transfer</h1>
        </div>
        <div className="flex gap-2">
          <Link href="/stock-management/account-balance" className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50">← Account Balances</Link>
          <Link href="/stock-management/all-transactions" className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50">View Transactions</Link>
        </div>
      </div>

      {formError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{formError}</div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(400px,560px)_minmax(0,1fr)] lg:items-start">
        <aside className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm">
          {formLoading ? (
            <p className="text-sm text-slate-500">Loading form data…</p>
          ) : !activeType ? (
            <>
              <h2 className="text-sm font-semibold text-slate-900">New Transfer</h2>
              <div className="mt-3 space-y-2">
                {TYPES.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setActiveType(t.value)}
                    className={cn(
                      "w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-left transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand/20"
                    )}
                  >
                    <p className="text-sm font-semibold text-slate-900">{t.label}</p>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">{t.description}</p>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              <div className="mb-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveType("")}
                  className="text-xs text-slate-500 hover:text-slate-700"
                >
                  ← Change type
                </button>
                <span className="text-slate-300">|</span>
                <span className="text-sm font-semibold text-slate-900">
                  {TYPE_LABEL[activeType]}
                </span>
              </div>
              {activeType === "customer" && <CustomerTransferForm {...sharedProps} />}
              {activeType === "commodity" && <CommodityTransferForm {...sharedProps} />}
              {activeType === "location" && <LocationMoveForm {...sharedProps} />}
            </>
          )}
        </aside>

        <div className="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-4 py-2.5">
            <span className="text-sm font-semibold text-slate-700">Transfer History ({transfers.length})</span>
          </div>
          <Grid
            columns={gridColumns}
            rows={displayRows}
            getRowId={(row) => row.id}
            theme="light"
            density="standard"
            fileName="Stock Transfers"
            visibleRows={14}
            emptyMessage="No transfers recorded yet."
          />
        </div>
      </div>

      {toast ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="max-w-sm rounded-xl bg-white p-8 text-center shadow-2xl">
            <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-emerald-100 text-2xl text-emerald-600">✓</div>
            <h3 className="text-lg font-bold text-slate-900">Transfer Saved</h3>
            <p className="mt-2 text-sm text-slate-500">{toast}</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
