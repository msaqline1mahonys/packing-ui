"use client";

import { useEffect, useMemo, useState } from "react";

import { CADENCE_LABELS } from "@/lib/reports-windows";
import { ALL_SECTIONS, SECTION_LABELS, getCommodityDirectory, getCustomerDirectory } from "@/lib/reports-data";
import { getHistoryEntry } from "@/lib/reports-store";

export default function PreviewClient({ runId }) {
  const [entry, setEntry] = useState(undefined);
  const customers = useMemo(() => getCustomerDirectory(), []);
  const commodities = useMemo(() => getCommodityDirectory(), []);

  useEffect(() => {
    setEntry(getHistoryEntry(runId));
  }, [runId]);

  if (entry === undefined) {
    return <div className="p-8 text-sm text-slate-500">Loading…</div>;
  }
  if (entry === null) {
    return (
      <div className="p-8">
        <h1 className="text-lg font-semibold text-slate-900">Report not found</h1>
        <p className="mt-1 text-[12px] text-slate-500">
          The history entry for run <span className="font-mono">{runId}</span> isn&apos;t in this browser.
          History is stored locally per device in the UI-only phase.
        </p>
      </div>
    );
  }

  const customerNames = (entry.recipients || [])
    .map((r) => customers.find((c) => Number(c.id) === Number(r.customerId))?.name)
    .filter(Boolean);

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-8 text-[12px]">
      <header className="border-b border-slate-200 pb-3">
        <p className="text-[11px] uppercase tracking-wide text-slate-500">Report run preview</p>
        <h1 className="mt-1 text-xl font-semibold text-slate-900">
          {entry.source === "ad-hoc" ? "Ad-hoc run" : `${CADENCE_LABELS[entry.source] || entry.source} run`}
        </h1>
        <p className="mt-1 text-[12px] text-slate-600">
          <span className="font-mono">{String(entry.ranAt).replace("T", " ").slice(0, 19)}</span>
          {entry.ranBy ? <> · ran by <span className="font-mono">{entry.ranBy}</span></> : null}
        </p>
      </header>

      <section className="space-y-1">
        <h2 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Window</h2>
        <p className="font-mono text-slate-800">{entry.dateRange?.from || "?"} → {entry.dateRange?.to || "?"}</p>
      </section>

      <section className="space-y-1">
        <h2 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Status</h2>
        <p className="text-slate-800">{entry.status} {entry.notes ? <span className="text-slate-500">— {entry.notes}</span> : null}</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Customers ({customerNames.length})</h2>
        <ul className="list-disc space-y-0.5 ps-5 text-slate-800">
          {(entry.recipients || []).map((r, idx) => {
            const cust = customers.find((c) => Number(c.id) === Number(r.customerId));
            return (
              <li key={idx}>
                <span className="font-medium">{cust?.name || "Unknown customer"}</span>
                {" — "}
                <span className="text-slate-600">{(r.emails || []).join(", ") || "(no recipients)"}</span>
                <span className="ms-2 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-slate-600">{r.deliveredAs}</span>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Sections covered</h2>
        <ul className="flex flex-wrap gap-1.5">
          {ALL_SECTIONS.map((s) => (
            <li key={s} className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] text-slate-700">{SECTION_LABELS[s]}</li>
          ))}
        </ul>
        <p className="text-[11px] text-slate-500">In the UI-only phase, history stores delivery metadata only — bundle blobs are session-scoped and not persisted. Once the backend module ships, this preview will list real artifact links.</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Commodity filter</h2>
        <p className="text-[11px] text-slate-500">Commodity filter for scheduled runs lives on each subscription. Ad-hoc runs use the filter selected at the moment of run; recompute by re-running.</p>
      </section>
    </div>
  );
}
