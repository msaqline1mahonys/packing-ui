"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { Grid } from "@/components/clutch-table";
import { Button } from "@/components/ui/button";
import {
  computeTransactionTotals,
  fetchTransactions,
  formatTransactionRow,
} from "@/lib/transactions-api";
import { TRANSACTION_DETAIL_COLUMNS, TRANSACTION_GRID_COLUMNS } from "@/lib/transactions-grid";
import { cn } from "@/lib/utils";

const inputClass =
  "rounded-lg border border-slate-200/95 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-brand/15 focus:border-brand/35 focus:ring-2";

export default function TransactionsClient() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedId, setSelectedId] = useState(null);

  const loadRows = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await fetchTransactions({
        ...(filterType !== "all" ? { type: filterType } : {}),
        ...(filterStatus !== "all" ? { status: filterStatus } : {}),
        ...(selectedDate ? { date: selectedDate } : {}),
      });
      setRows(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load transactions.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [filterType, filterStatus, selectedDate]);

  useEffect(() => {
    loadRows();
  }, [loadRows]);

  const displayRows = useMemo(() => {
    const formatted = rows
      .map((t) => formatTransactionRow(t))
      .sort((a, b) => String(b.transactionDate).localeCompare(String(a.transactionDate)));

    if (!search.trim()) return formatted;
    const q = search.toLowerCase();
    return formatted.filter((t) =>
      `${t.id} ${t.ticketId} ${t.account} ${t.commodity} ${t.location} ${t.reference}`.toLowerCase().includes(q)
    );
  }, [rows, search]);

  const totals = useMemo(() => computeTransactionTotals(rows), [rows]);

  const selected = selectedId != null ? displayRows.find((r) => r.id === selectedId) ?? null : null;

  return (
    <div className="space-y-6">
      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>
      ) : null}

      <div className="flex flex-col gap-3 rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm lg:flex-row lg:flex-wrap lg:items-center">
        <input
          className={`${inputClass} min-w-[180px] flex-1`}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search transactions..."
        />
        <select suppressHydrationWarning className={inputClass} value={filterType} onChange={(e) => setFilterType(e.target.value)}>
          <option value="all">All types</option>
          <option value="in">Incoming</option>
          <option value="out">Outgoing</option>
        </select>
        <select suppressHydrationWarning className={inputClass} value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="adjusted">Adjusted</option>
          <option value="reversed">Reversed</option>
        </select>
        <input suppressHydrationWarning className={inputClass} type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} />
        {selectedDate ? (
          <Button type="button" variant="ghost" size="sm" onClick={() => setSelectedDate("")}>
            Clear date
          </Button>
        ) : null}
        <div className="ms-auto flex flex-wrap gap-4 text-xs font-medium text-slate-600 lg:border-l lg:border-slate-200 lg:ps-4">
          <span>
            Deposits: <strong className="text-emerald-700">{totals.deposits.toFixed(2)} MT</strong>
          </span>
          <span>
            Withdrawals: <strong className="text-red-700">{totals.withdrawals.toFixed(2)} MT</strong>
          </span>
          <span>
            Shrinkage: <strong className="text-amber-700">{totals.shrinkage.toFixed(2)} MT</strong>
          </span>
          <span>
            Net:{" "}
            <strong className={totals.net >= 0 ? "text-emerald-700" : "text-red-700"}>{totals.net.toFixed(2)} MT</strong>
          </span>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(240px,320px)] xl:items-start">
        <div className="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-sm">
          {loading ? (
            <div className="p-8 text-center text-sm text-slate-500">Loading transactions...</div>
          ) : (
            <Grid
              columns={TRANSACTION_GRID_COLUMNS}
              rows={displayRows}
              getRowId={(row) => row.id}
              theme="light"
              density="standard"
              fileName="Transactions"
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
