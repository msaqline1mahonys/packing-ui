"use client";

import { useMemo, useState } from "react";

const TOPICS = [
  {
    area: "Incoming tickets",
    summary: "Capture weights, QA tests, and unload bays.",
    doc: "Mahonys `/incoming` & `/ticket/in` flows",
  },
  {
    area: "Outgoing tickets",
    summary: "Pick locations, confirm commodity, sign-offs.",
    doc: "Mahonys `/outgoing` & `/ticket/out` flows",
  },
  {
    area: "Transaction ledger",
    summary: "Deposit/withdraw/shrinkage reconciliation.",
    doc: "Mahonys `/stock-management/all-transactions`",
  },
  {
    area: "Packing schedule",
    summary: "Statuses from Pending through Invoiced.",
    doc: "Mahonys `/packing-schedule`",
  },
  {
    area: "Reports",
    summary: "Operational exports and balances.",
    doc: "Mahonys `/reports`",
  },
];

export default function HelpClient() {
  const [q, setQ] = useState("");
  const rows = useMemo(() => {
    if (!q.trim()) return TOPICS;
    const s = q.toLowerCase();
    return TOPICS.filter((t) => `${t.area} ${t.summary} ${t.doc}`.toLowerCase().includes(s));
  }, [q]);

  return (
    <div className="space-y-6">
      <p className="max-w-2xl text-sm text-slate-600">
        Quick map from this shell to Mahonys Packing screens—use it while wiring APIs or training operators.
      </p>
      <input
        className="w-full max-w-md rounded-lg border border-slate-200/95 bg-white px-3 py-2 text-sm outline-none ring-brand/15 focus:border-brand/35 focus:ring-2"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search topics…"
      />
      <div className="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-sm">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/90">
              <th className="px-3 py-2.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">Area</th>
              <th className="px-3 py-2.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">Summary</th>
              <th className="px-3 py-2.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">Mahonys reference</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => (
              <tr key={t.area} className="border-b border-slate-100 last:border-0">
                <td className="px-3 py-2 font-semibold text-slate-900">{t.area}</td>
                <td className="px-3 py-2 text-slate-600">{t.summary}</td>
                <td className="px-3 py-2 font-mono text-xs text-slate-500">{t.doc}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
