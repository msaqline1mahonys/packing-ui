"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Grid } from "@/components/clutch-table";
import { cn } from "@/lib/utils";

const inputClass =
  "w-full rounded-lg border border-slate-200/95 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-brand/15 placeholder:text-slate-400 focus:border-brand/35 focus:ring-2";

/* ─── Mock data ─── */
const MOCK_TRANSACTIONS = [
  { id: 1, transactionDate: "2026-05-10T09:14:00", ticketId: 201, ticketType: "in", transactionType: "deposit", accountId: 1, accountType: "customer", commodityId: 1, locationId: 1, quantity: 45.0, status: "active", reference: "TXN-001", notes: "" },
  { id: 2, transactionDate: "2026-05-10T09:14:00", ticketId: 201, ticketType: "in", transactionType: "shrinkage", accountId: 1, accountType: "customer", commodityId: 1, locationId: 1, quantity: -4.5, status: "active", reference: "TXN-001-S", notes: "10% shrinkage" },
  { id: 3, transactionDate: "2026-05-10T09:14:00", ticketId: 201, ticketType: "in", transactionType: "shrinkage", accountId: 99, accountType: "internal", commodityId: 1, locationId: 1, quantity: 4.5, status: "active", reference: "TXN-001-SI", notes: "Shrink account credit" },
  { id: 4, transactionDate: "2026-05-10T10:30:00", ticketId: 301, ticketType: "out", transactionType: "withdrawal", accountId: 1, accountType: "customer", commodityId: 1, locationId: 1, quantity: -20.0, status: "active", reference: "TXN-002", notes: "Pack #101" },
  { id: 5, transactionDate: "2026-05-10T14:22:00", ticketId: 202, ticketType: "in", transactionType: "deposit", accountId: 2, accountType: "customer", commodityId: 3, locationId: 2, quantity: 22.5, status: "active", reference: "TXN-003", notes: "" },
  { id: 6, transactionDate: "2026-05-10T14:22:00", ticketId: 202, ticketType: "in", transactionType: "shrinkage", accountId: 2, accountType: "customer", commodityId: 3, locationId: 2, quantity: -2.25, status: "active", reference: "TXN-003-S", notes: "10% shrinkage" },
  { id: 7, transactionDate: "2026-05-11T08:05:00", ticketId: 203, ticketType: "in", transactionType: "deposit", accountId: 3, accountType: "customer", commodityId: 2, locationId: 4, quantity: 60.0, status: "adjusted", reference: "TXN-004", notes: "Weight corrected" },
  { id: 8, transactionDate: "2026-05-11T08:06:00", ticketId: 203, ticketType: "in", transactionType: "deposit", accountId: 3, accountType: "customer", commodityId: 2, locationId: 4, quantity: 62.5, status: "active", reference: "TXN-004R", notes: "Corrected weight" },
  { id: 9, transactionDate: "2026-05-11T11:40:00", ticketId: 302, ticketType: "out", transactionType: "withdrawal", accountId: 4, accountType: "customer", commodityId: 4, locationId: 3, quantity: -15.0, status: "reversed", reference: "TXN-005", notes: "Ticket deleted" },
  { id: 10, transactionDate: "2026-05-11T13:15:00", ticketId: 303, ticketType: "out", transactionType: "withdrawal", accountId: 1, accountType: "customer", commodityId: 1, locationId: 3, quantity: -10.0, status: "active", reference: "TXN-006", notes: "Pack #105" },
];

const MOCK_CUSTOMERS = [
  { id: 1, name: "ACME Corp" },
  { id: 2, name: "GrainLink" },
  { id: 3, name: "Southern Export" },
  { id: 4, name: "Pacific Traders" },
];
const MOCK_INTERNAL = [{ id: 99, name: "Shrinkage Account" }];
const MOCK_COMMODITIES = [
  { id: 1, name: "Wheat" },
  { id: 2, name: "Barley" },
  { id: 3, name: "Chickpeas" },
  { id: 4, name: "Canola" },
];
const MOCK_LOCATIONS = [
  { id: 1, name: "Bay 1 – Main Shed" },
  { id: 2, name: "Bay 2 – Overflow" },
  { id: 3, name: "Silo A" },
  { id: 4, name: "Silo B" },
];

/* ─── Helpers ─── */
const lookupAccount = (id, type) => {
  if (type === "customer") return MOCK_CUSTOMERS.find((c) => c.id === id)?.name ?? "Unknown";
  return MOCK_INTERNAL.find((a) => a.id === id)?.name ?? "Unknown";
};
const lookupCommodity = (id) => MOCK_COMMODITIES.find((c) => c.id === id)?.name ?? "—";
const lookupLocation = (id) => MOCK_LOCATIONS.find((l) => l.id === id)?.name ?? "—";
const fmtDate = (d) => (d ? (d.includes("T") ? d.split("T")[0] : d) : "—");
const fmtQty = (q) => `${q >= 0 ? "+" : ""}${q.toFixed(3)}`;

/* ─── Grid column definitions for clutch-table ─── */
const gridColumns = [
  { key: "reference", header: "Reference", type: "text", sortable: true, filterable: true, resizable: true },
  { key: "date", header: "Date", type: "text", sortable: true, filterable: true, resizable: true },
  { key: "ticketDisplay", header: "Ticket", type: "text", sortable: true, filterable: true, resizable: true },
  { key: "account", header: "Account", type: "text", sortable: true, filterable: true, resizable: true },
  { key: "commodity", header: "Commodity", type: "text", sortable: true, filterable: true, resizable: true },
  { key: "location", header: "Location", type: "text", sortable: true, filterable: true, resizable: true },
  { key: "ticketTypeDisplay", header: "Ticket Type", type: "text", sortable: true, filterable: true, resizable: true },
  { key: "transactionType", header: "Trans Type", type: "text", sortable: true, filterable: true, resizable: true },
  { key: "quantityDisplay", header: "Quantity (MT)", type: "text", sortable: true, filterable: true, resizable: true },
  { key: "status", header: "Status", type: "text", sortable: true, filterable: true, resizable: true },
];

/* ─── Detail sidebar columns ─── */
const DETAIL_COLUMNS = [
  { key: "reference", label: "Reference" },
  { key: "date", label: "Date" },
  { key: "ticketDisplay", label: "Ticket" },
  { key: "account", label: "Account" },
  { key: "commodity", label: "Commodity" },
  { key: "location", label: "Location" },
  { key: "ticketTypeDisplay", label: "Ticket Type" },
  { key: "transactionType", label: "Transaction Type" },
  { key: "quantityDisplay", label: "Quantity (MT)" },
  { key: "status", label: "Status" },
  { key: "notes", label: "Notes" },
];

/* ─── Main ─── */
export default function AllTransactionsPage() {
  const [filterType, setFilterType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("active");
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedId, setSelectedId] = useState(null);

  /* Base filter (everything except status — so summary reflects actual stock) */
  const baseFiltered = useMemo(() => {
    return MOCK_TRANSACTIONS.filter((t) => {
      if (filterType !== "all" && t.ticketType !== filterType) return false;
      if (selectedDate && fmtDate(t.transactionDate) !== selectedDate) return false;
      return true;
    });
  }, [filterType, selectedDate]);

  /* Table rows — apply status filter + transform for Grid display */
  const displayRows = useMemo(() => {
    return baseFiltered
      .filter((t) => filterStatus === "all" || t.status === filterStatus)
      .sort((a, b) => new Date(b.transactionDate) - new Date(a.transactionDate))
      .map((t) => ({
        ...t,
        date: fmtDate(t.transactionDate),
        ticketDisplay: `#${t.ticketId}`,
        account: lookupAccount(t.accountId, t.accountType),
        commodity: lookupCommodity(t.commodityId),
        location: lookupLocation(t.locationId),
        ticketTypeDisplay: t.ticketType.toUpperCase(),
        transactionType: t.transactionType.charAt(0).toUpperCase() + t.transactionType.slice(1),
        quantityDisplay: fmtQty(t.quantity),
        notes: t.notes || "—",
      }));
  }, [baseFiltered, filterStatus]);

  /* Summary totals — always actual stock */
  const totals = useMemo(() => {
    const eligible = baseFiltered.filter((t) => t.status === "active" || t.status === "reversed" || t.status === "adjusted");
    const deposits = eligible.filter((t) => t.quantity > 0).reduce((s, t) => s + t.quantity, 0);
    const withdrawals = eligible.filter((t) => t.quantity < 0).reduce((s, t) => s + Math.abs(t.quantity), 0);
    const shrinkage = eligible.filter((t) => t.transactionType === "shrinkage" && t.accountType === "customer").reduce((s, t) => s + Math.abs(t.quantity), 0);
    const net = eligible.reduce((s, t) => s + t.quantity, 0);
    return { deposits, withdrawals, shrinkage, net };
  }, [baseFiltered]);

  const selected = selectedId != null ? displayRows.find((r) => r.id === selectedId) ?? null : null;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs text-slate-500">Stock Management / All Transactions</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">Transaction Ledger</h1>
          <p className="mt-1 text-xs text-slate-500">Complete ledger of all stock movements — deposits, withdrawals, shrinkage, and adjustments.</p>
        </div>
        <Link href="/stock-management/account-balance" className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50">Account Balances</Link>
      </div>

      {/* Toolbar: filters + summary */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200/90 bg-white px-4 py-3 shadow-sm">
        <select className={cn(inputClass, "w-36")} value={filterType} onChange={(e) => setFilterType(e.target.value)}>
          <option value="all">All Types</option>
          <option value="in">Incoming</option>
          <option value="out">Outgoing</option>
        </select>
        <select className={cn(inputClass, "w-36")} value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
          <option value="all">All Statuses</option>
          <option value="active">Active</option>
          <option value="adjusted">Adjusted</option>
          <option value="reversed">Reversed</option>
        </select>
        <input type="date" className={cn(inputClass, "w-40")} value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} />
        {selectedDate && <button type="button" onClick={() => setSelectedDate("")} className="rounded-md bg-slate-100 px-2.5 py-1.5 text-xs text-slate-600 hover:bg-slate-200">Clear Date</button>}

        <div className="ml-auto flex flex-wrap gap-4 text-xs">
          <span><span className="font-semibold text-slate-500">Deposits:</span> <span className="font-bold text-emerald-600">{totals.deposits.toFixed(2)} MT</span></span>
          <span><span className="font-semibold text-slate-500">Withdrawals:</span> <span className="font-bold text-red-600">{totals.withdrawals.toFixed(2)} MT</span></span>
          <span><span className="font-semibold text-slate-500">Shrinkage:</span> <span className="font-bold text-amber-500">{totals.shrinkage.toFixed(2)} MT</span></span>
          <span><span className="font-semibold text-slate-500">Net:</span> <span className={cn("font-bold", totals.net >= 0 ? "text-emerald-600" : "text-red-600")}>{totals.net.toFixed(2)} MT</span></span>
        </div>
      </div>

      {/* Grid + Detail sidebar */}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(240px,320px)] xl:items-start">
        <div className="overflow-hidden rounded-xl bg-white shadow-sm">
          <Grid
            columns={gridColumns}
            rows={displayRows}
            getRowId={(row) => row.id}
            theme="light"
            density="standard"
            fileName="Transaction Ledger"
            visibleRows={14}
            onRowClick={(row) => setSelectedId((prev) => (prev === row.id ? null : row.id))}
          />
        </div>

        <aside className="rounded-xl border border-slate-200/90 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">Transaction Details</h2>
          {!selected ? (
            <p className="mt-4 text-sm leading-relaxed text-slate-500">Select a row to view details.</p>
          ) : (
            <dl className="mt-4 space-y-3 text-sm">
              {DETAIL_COLUMNS.map((col) => (
                <DetailItem key={col.key} label={col.label} value={selected[col.key]} highlight={col.key === "reference"} />
              ))}
            </dl>
          )}
        </aside>
      </div>

      {/* Legend */}
      <div className="rounded-xl border border-slate-200/90 bg-white p-5 shadow-sm">
        <h3 className="mb-3 text-sm font-bold text-slate-900">Grain Bank System</h3>
        <div className="grid gap-2 text-xs text-slate-600 sm:grid-cols-2">
          <p><strong>Incoming Tickets:</strong> 3 transactions — (1) DEPOSIT net weight to customer, (2) DEDUCT shrinkage from customer, (3) ADD shrinkage to shrink account.</p>
          <p><strong>Outgoing Tickets:</strong> 1 transaction — WITHDRAW net weight from customer account. No shrinkage.</p>
          <p><strong>Deposit:</strong> Stock added to customer account (positive quantity)</p>
          <p><strong>Withdrawal:</strong> Stock removed from customer account (negative quantity)</p>
          <p><strong>Shrinkage:</strong> Handling loss — only on incoming tickets, calculated as % of net weight</p>
          <p><strong>Adjustment:</strong> When a ticket weight is updated, old entries are marked Adjusted and new entries created</p>
          <p><strong>Active:</strong> Current valid transaction entries</p>
          <p><strong>Reversed:</strong> Cancelled due to ticket deletion</p>
        </div>
      </div>
    </div>
  );
}

function DetailItem({ label, value, highlight }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className={cn("mt-0.5 text-slate-800", highlight && "font-semibold text-brand")}>{value || "—"}</dd>
    </div>
  );
}
