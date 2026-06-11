"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Grid } from "@/components/clutch-table";
import {
  computeTransactionTotals,
  fetchTransactions,
  formatTransactionRow,
} from "@/lib/transactions-api";
import { TRANSACTION_DETAIL_COLUMNS, TRANSACTION_GRID_COLUMNS } from "@/lib/transactions-grid";
import { usePolling } from "@/lib/use-polling";
import { cn } from "@/lib/utils";

const inputClass =
  "w-full rounded-lg border border-slate-200/95 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-brand/15 placeholder:text-slate-400 focus:border-brand/35 focus:ring-2";

export default function AllTransactionsPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("active");
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedId, setSelectedId] = useState(null);

  const loadRows = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await fetchTransactions({
        ...(filterType !== "all" ? { type: filterType } : {}),
        ...(selectedDate ? { date: selectedDate } : {}),
      });
      setRows(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load transactions.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [filterType, selectedDate]);

  useEffect(() => {
    loadRows();
  }, [loadRows]);

  // Live refresh: poll every 60s (paused when the tab is hidden).
  usePolling(loadRows, { intervalMs: 60000 });

  const baseFiltered = useMemo(() => rows, [rows]);

  const displayRows = useMemo(() => {
    return baseFiltered
      .filter((t) => filterStatus === "all" || t.status === filterStatus)
      .sort((a, b) => String(b.transactionDate).localeCompare(String(a.transactionDate)))
      .map((t) => formatTransactionRow(t));
  }, [baseFiltered, filterStatus]);

  const totals = useMemo(() => {
    const eligible = baseFiltered.filter(
      (t) => t.status === "active" || t.status === "reversed" || t.status === "adjusted"
    );
    return computeTransactionTotals(eligible);
  }, [baseFiltered]);

  const selected = selectedId != null ? displayRows.find((r) => r.id === selectedId) ?? null : null;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs text-slate-500">Stock Management / All Transactions</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">Transaction Ledger</h1>
          <p className="mt-1 text-xs text-slate-500">
            Complete ledger of all stock movements: deposits, withdrawals, shrinkage, and adjustments.
          </p>
        </div>
        <Link
          href="/stock-management/account-balance"
          className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Account Balances
        </Link>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200/90 bg-white px-4 py-3 shadow-sm">
        <select suppressHydrationWarning className={cn(inputClass, "w-36")} value={filterType} onChange={(e) => setFilterType(e.target.value)}>
          <option value="all">All Types</option>
          <option value="in">Incoming</option>
          <option value="out">Outgoing</option>
        </select>
        <select suppressHydrationWarning className={cn(inputClass, "w-36")} value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
          <option value="all">All Statuses</option>
          <option value="active">Active</option>
          <option value="adjusted">Adjusted</option>
          <option value="reversed">Reversed</option>
        </select>
        <input suppressHydrationWarning type="date" className={cn(inputClass, "w-40")} value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} />
        {selectedDate ? (
          <button type="button" onClick={() => setSelectedDate("")} className="rounded-md bg-slate-100 px-2.5 py-1.5 text-xs text-slate-600 hover:bg-slate-200">
            Clear Date
          </button>
        ) : null}

        <div className="ml-auto flex flex-wrap gap-4 text-xs">
          <span>
            <span className="font-semibold text-slate-500">Deposits:</span>{" "}
            <span className="font-bold text-emerald-600">{totals.deposits.toFixed(2)} MT</span>
          </span>
          <span>
            <span className="font-semibold text-slate-500">Withdrawals:</span>{" "}
            <span className="font-bold text-red-600">{totals.withdrawals.toFixed(2)} MT</span>
          </span>
          <span>
            <span className="font-semibold text-slate-500">Shrinkage:</span>{" "}
            <span className="font-bold text-amber-500">{totals.shrinkage.toFixed(2)} MT</span>
          </span>
          <span>
            <span className="font-semibold text-slate-500">Net:</span>{" "}
            <span className={cn("font-bold", totals.net >= 0 ? "text-emerald-600" : "text-red-600")}>
              {totals.net.toFixed(2)} MT
            </span>
          </span>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(240px,320px)] xl:items-start">
        <div className="overflow-hidden rounded-xl bg-white shadow-sm">
          {loading ? (
            <div className="p-8 text-center text-sm text-slate-500">Loading transactions...</div>
          ) : (
            <Grid
              columns={TRANSACTION_GRID_COLUMNS}
              rows={displayRows}
              getRowId={(row) => row.id}
              theme="light"
              density="standard"
              fileName="Transaction Ledger"
              visibleRows={14}
              onRowClick={(row) => setSelectedId((prev) => (prev === row.id ? null : row.id))}
              onPersistedRowActivate={(row) => setSelectedId(row.id)}
            />
          )}
        </div>

        <aside className="rounded-xl border border-slate-200/90 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">Transaction Details</h2>
          {!selected ? (
            <p className="mt-4 text-sm leading-relaxed text-slate-500">Select a row to view details.</p>
          ) : (
            <dl className="mt-4 space-y-3 text-sm">
              {TRANSACTION_DETAIL_COLUMNS.map((col) => (
                <DetailItem key={col.key} label={col.label} value={selected[col.key]} highlight={col.key === "reference"} />
              ))}
            </dl>
          )}
        </aside>
      </div>
    </div>
  );
}

function DetailItem({ label, value, highlight }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className={cn("mt-0.5 text-slate-800", highlight && "font-semibold text-brand")}>{value || "-"}</dd>
    </div>
  );
}
