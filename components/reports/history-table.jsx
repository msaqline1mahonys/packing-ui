"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { CADENCE_LABELS } from "@/lib/reports-windows";
import { fetchCustomerDirectory, sameId } from "@/lib/reports-data";
import { cn } from "@/lib/utils";

const STATUS_STYLES = {
  ok: "bg-emerald-100 text-emerald-700",
  partial: "bg-amber-100 text-amber-800",
  error: "bg-rose-100 text-rose-700",
};

const DELIVERY_LABELS = {
  download: "Downloaded",
  email: "Emailed",
  simulated: "Simulated",
};

export function HistoryTable({ rows }) {
  const [customers, setCustomers] = useState([]);

  useEffect(() => {
    fetchCustomerDirectory().then(setCustomers);
  }, []);

  const customerById = useMemo(() => new Map(customers.map((c) => [String(c.id), c])), [customers]);

  if (!rows || rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-white p-8 text-center">
        <p className="text-sm font-medium text-slate-800">No report runs yet</p>
        <p className="mt-1 text-[11px] text-slate-500">Ad-hoc runs and simulated scheduled runs will appear here.</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-sm">
      <table className="w-full text-[11px]">
        <thead className="bg-slate-50 text-slate-500">
          <tr>
            <th className="px-3 py-2 text-left font-semibold uppercase tracking-wide">When</th>
            <th className="px-3 py-2 text-left font-semibold uppercase tracking-wide">Source</th>
            <th className="px-3 py-2 text-left font-semibold uppercase tracking-wide">Range</th>
            <th className="px-3 py-2 text-left font-semibold uppercase tracking-wide">Customers</th>
            <th className="px-3 py-2 text-left font-semibold uppercase tracking-wide">Recipients</th>
            <th className="px-3 py-2 text-left font-semibold uppercase tracking-wide">Delivery</th>
            <th className="px-3 py-2 text-left font-semibold uppercase tracking-wide">Status</th>
            <th className="px-3 py-2 text-right font-semibold uppercase tracking-wide">Preview</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const recipientCount = (row.recipients || []).reduce((sum, r) => sum + (r.emails?.length || 0), 0);
            const customerCount = (row.recipients || []).length;
            const deliveries = Array.from(new Set((row.recipients || []).map((r) => r.deliveredAs).filter(Boolean)));
            const customerNames = (row.recipients || [])
              .map((r) => customerById.get(String(r.customerId))?.name)
              .filter(Boolean);
            return (
              <tr key={row.id} className="border-t border-slate-100 hover:bg-slate-50/60">
                <td className="px-3 py-2 align-top font-mono text-[11px] text-slate-700">{String(row.ranAt).replace("T", " ").slice(0, 19)}</td>
                <td className="px-3 py-2 align-top text-slate-700">
                  {row.source === "ad-hoc" ? "Ad-hoc" : CADENCE_LABELS[row.source] || row.source}
                </td>
                <td className="px-3 py-2 align-top font-mono text-slate-700">
                  {row.dateRange?.from || "?"} → {row.dateRange?.to || "?"}
                </td>
                <td className="px-3 py-2 align-top text-slate-700">
                  <span title={customerNames.join(", ")}>{customerCount} customer{customerCount === 1 ? "" : "s"}</span>
                </td>
                <td className="px-3 py-2 align-top text-slate-700">{recipientCount}</td>
                <td className="px-3 py-2 align-top text-slate-700">
                  {deliveries.length === 0
                    ? "—"
                    : deliveries.map((d) => DELIVERY_LABELS[d] || d).join(" + ")}
                </td>
                <td className="px-3 py-2 align-top">
                  <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", STATUS_STYLES[row.status] || "bg-slate-100 text-slate-600")}>
                    {row.status}
                  </span>
                </td>
                <td className="px-3 py-2 text-right align-top">
                  <Link href={`/reports/preview/${row.id}`} target="_blank" className="text-brand hover:underline">
                    View
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
