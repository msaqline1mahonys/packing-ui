"use client";

import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";

const inputClass =
  "rounded-lg border border-slate-200/95 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-brand/15 focus:border-brand/35 focus:ring-2";

const SAMPLE_TX = [
  {
    id: 44021,
    transactionDate: "2026-05-01",
    ticketId: 8821,
    account: "GrainCorp Trading",
    commodity: "Feed barley",
    location: "Bay 12",
    ticketType: "in",
    transactionType: "deposit",
    quantity: 124.35,
    status: "active",
  },
  {
    id: 44020,
    transactionDate: "2026-05-01",
    ticketId: 8814,
    account: "Internal â€” Screenings",
    commodity: "Screenings mix",
    location: "Shed C",
    ticketType: "out",
    transactionType: "withdrawal",
    quantity: -42.1,
    status: "active",
  },
  {
    id: 44015,
    transactionDate: "2026-04-30",
    ticketId: 8802,
    account: "Riverina Co-op",
    commodity: "Canola",
    location: "Bay 12",
    ticketType: "in",
    transactionType: "shrinkage",
    quantity: -1.85,
    status: "adjusted",
  },
];

function statusPill(status) {
  const map = {
    active: "bg-emerald-50 text-emerald-800 ring-emerald-200",
    adjusted: "bg-amber-50 text-amber-900 ring-amber-200",
    reversed: "bg-red-50 text-red-800 ring-red-200",
  };
  return map[status] || "bg-slate-100 text-slate-700 ring-slate-200";
}

function transTypePill(type) {
  const map = {
    deposit: "bg-emerald-50 text-emerald-800",
    withdrawal: "bg-red-50 text-red-800",
    shrinkage: "bg-amber-50 text-amber-900",
  };
  return map[type] || "bg-indigo-50 text-indigo-800";
}

export default function TransactionsClient() {
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [selectedDate, setSelectedDate] = useState("");

  const filtered = useMemo(() => {
    return SAMPLE_TX.filter((t) => {
      if (filterType !== "all" && t.ticketType !== filterType) return false;
      if (filterStatus !== "all" && t.status !== filterStatus) return false;
      if (selectedDate && t.transactionDate !== selectedDate) return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return `${t.id} ${t.ticketId} ${t.account} ${t.commodity} ${t.location}`.toLowerCase().includes(q);
    });
  }, [search, filterType, filterStatus, selectedDate]);

  const totals = useMemo(() => {
    const deposits = SAMPLE_TX.filter((t) => t.quantity > 0).reduce((s, t) => s + t.quantity, 0);
    const withdrawals = SAMPLE_TX.filter((t) => t.quantity < 0).reduce((s, t) => s + Math.abs(t.quantity), 0);
    const shrinkage = SAMPLE_TX.filter((t) => t.transactionType === "shrinkage").reduce((s, t) => s + Math.abs(t.quantity), 0);
    const net = SAMPLE_TX.reduce((s, t) => s + t.quantity, 0);
    return { deposits, withdrawals, shrinkage, net };
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm lg:flex-row lg:flex-wrap lg:items-center">
        <input
          className={`${inputClass} min-w-[180px] flex-1`}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search transactionsâ€¦"
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

      <div className="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-sm">
        <div className="max-h-[min(560px,62vh)] overflow-auto">
          <table className="w-full min-w-[960px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/90">
                {[
                  "Trans ID",
                  "Date",
                  "Ticket",
                  "Account",
                  "Commodity",
                  "Location",
                  "Ticket type",
                  "Trans type",
                  "Qty (MT)",
                  "Status",
                ].map((h) => (
                  <th key={h} className="whitespace-nowrap px-3 py-2.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-3 py-12 text-center text-slate-400">
                    No transactions match the current filters.
                  </td>
                </tr>
              ) : (
                filtered.map((t) => (
                  <tr key={t.id} className="border-b border-slate-100 last:border-0">
                    <td className="px-3 py-2 font-semibold text-indigo-600">{t.id}</td>
                    <td className="px-3 py-2 text-slate-600">{t.transactionDate}</td>
                    <td className="px-3 py-2">
                      <span className="cursor-pointer font-medium text-brand underline-offset-2 hover:underline">#{t.ticketId}</span>
                    </td>
                    <td className="px-3 py-2 text-slate-700">{t.account}</td>
                    <td className="px-3 py-2 text-slate-700">{t.commodity}</td>
                    <td className="px-3 py-2 text-slate-700">{t.location}</td>
                    <td className="px-3 py-2">
                      <span
                        className={`text-[11px] font-semibold uppercase ${t.ticketType === "in" ? "text-emerald-700" : "text-red-700"}`}
                      >
                        {t.ticketType}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <span className={`rounded-md px-2 py-0.5 text-[11px] font-semibold capitalize ${transTypePill(t.transactionType)}`}>
                        {t.transactionType}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-800">{t.quantity.toFixed(2)}</td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize ring-1 ${statusPill(t.status)}`}>
                        {t.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}