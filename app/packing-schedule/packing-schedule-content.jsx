"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { PACK_SCHEDULE_ROWS, PACK_STATUSES } from "@/lib/Data";

const inputClass =
  "h-8 rounded-md border border-slate-200 bg-white px-2.5 text-xs text-slate-800 outline-none ring-brand/15 focus:border-brand/35 focus:ring-2";

const TABLE_COLUMNS = [
  { id: "id", label: "ID", accessor: (pack) => String(pack.id) },
  { id: "importExport", label: "I/E", accessor: (pack) => pack.importExport },
  { id: "customer", label: "Customer", accessor: (pack) => pack.customer },
  { id: "commodity", label: "Commodity", accessor: (pack) => pack.commodity },
  { id: "status", label: "Status", accessor: (pack) => pack.status },
  { id: "jobReference", label: "Job Ref", accessor: (pack) => pack.jobReference },
  { id: "containersRequired", label: "Cnt", accessor: (pack) => String(pack.containersRequired) },
  { id: "mtTotal", label: "MT", accessor: (pack) => String(pack.mtTotal) },
];

const DEMO_PACKS = PACK_SCHEDULE_ROWS;

export default function PackingScheduleContent({ queueLabel }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [importExportFilter, setImportExportFilter] = useState("all");
  const [searchByDate, setSearchByDate] = useState(false);
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [selectedStatuses, setSelectedStatuses] = useState(() => [...PACK_STATUSES]);
  const [selectedId, setSelectedId] = useState(null);
  const [columnFilters, setColumnFilters] = useState(() =>
    TABLE_COLUMNS.reduce((acc, column) => ({ ...acc, [column.id]: "" }), {})
  );

  const toggleStatus = (s) => {
    setSelectedStatuses((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));
  };

  const filtered = useMemo(() => {
    return DEMO_PACKS.filter((p) => selectedStatuses.includes(p.status))
      .filter((p) => importExportFilter === "all" || p.importExport === importExportFilter)
      .filter((p) => (searchByDate ? p.date === selectedDate : true))
      .filter((p) => {
        if (!search.trim()) return true;
        const q = search.toLowerCase();
        return `${p.id} ${p.jobReference} ${p.customer} ${p.commodity} ${p.vessel} ${p.jobNotes}`.toLowerCase().includes(q);
      })
      .filter((p) => {
        return TABLE_COLUMNS.every((column) => {
          const filterValue = columnFilters[column.id]?.trim().toLowerCase();
          if (!filterValue) return true;
          return column.accessor(p).toLowerCase().includes(filterValue);
        });
      });
  }, [search, importExportFilter, selectedStatuses, searchByDate, selectedDate, columnFilters]);

  const selected = useMemo(() => filtered.find((p) => p.id === selectedId) || null, [filtered, selectedId]);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-slate-50/75 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <input className={`${inputClass} min-w-[220px] flex-1`} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search packs..." />
          <select className={`${inputClass} w-[150px]`} value={importExportFilter} onChange={(e) => setImportExportFilter(e.target.value)}>
            <option value="all">All (Import/Export)</option>
            <option value="Import">Import</option>
            <option value="Export">Export</option>
          </select>
          <div className="flex flex-1 flex-wrap items-center gap-1.5">
            {PACK_STATUSES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => toggleStatus(s)}
                className={`rounded-md px-2 py-1 text-[10px] font-semibold transition-colors ${
                  selectedStatuses.includes(s) ? "bg-brand/20 text-brand-ink ring-1 ring-brand/25" : "bg-white text-slate-500 ring-1 ring-slate-200"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
          <label className="ms-auto inline-flex items-center gap-2 text-xs text-slate-600">
            <input type="checkbox" checked={searchByDate} onChange={(e) => setSearchByDate(e.target.checked)} className="rounded border-slate-300" />
            By Date
          </label>
          {searchByDate ? <input className={`${inputClass} w-[140px]`} type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} /> : null}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Button type="button" size="sm" variant="secondary">
            Schedule
          </Button>
          <Button type="button" size="sm" onClick={() => router.push("/packing-schedule/new-pack-form")}>
            + Add Pack
          </Button>
          <Button type="button" size="sm" variant="secondary" disabled={!selected}>
            Edit
          </Button>
          <Button type="button" size="sm" variant="destructive" disabled={!selected}>
            Delete
          </Button>
          <span className="ms-auto text-[11px] text-slate-500">Queue: {queueLabel}</span>
        </div>
      </div>

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_250px]">
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600">Columns -</div>
          <div className="min-h-[460px] overflow-auto">
            <table className="w-full min-w-[720px] border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  {TABLE_COLUMNS.map((column) => (
                    <th key={column.id} className="whitespace-nowrap px-2 py-2 text-[10px] font-bold uppercase text-slate-500">
                      {column.label}
                    </th>
                  ))}
                </tr>
                <tr className="border-b border-slate-200 bg-white">
                  {TABLE_COLUMNS.map((column) => (
                    <th key={column.id} className="px-1.5 py-1.5">
                      <input
                        className="h-6 w-full rounded border border-slate-200 px-1.5 text-[10px] font-normal text-slate-700 outline-none focus:border-brand/35"
                        placeholder="Filter..."
                        value={columnFilters[column.id]}
                        onChange={(e) => setColumnFilters((prev) => ({ ...prev, [column.id]: e.target.value }))}
                      />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length ? (
                  filtered.map((p) => (
                    <tr
                      key={p.id}
                      onClick={() => setSelectedId(p.id)}
                      className={`cursor-pointer border-b border-slate-100 text-[11px] last:border-0 ${selected?.id === p.id ? "bg-brand/[0.06]" : "hover:bg-slate-50"}`}
                    >
                      <td className="px-2 py-2 font-semibold text-slate-800">{p.id}</td>
                      <td className="px-2 py-2 text-slate-600">{p.importExport}</td>
                      <td className="px-2 py-2 text-slate-700">{p.customer}</td>
                      <td className="px-2 py-2 text-slate-700">{p.commodity}</td>
                      <td className="px-2 py-2 text-slate-700">{p.status}</td>
                      <td className="px-2 py-2 text-slate-600">{p.jobReference}</td>
                      <td className="px-2 py-2 text-right text-slate-700">{p.containersRequired}</td>
                      <td className="px-2 py-2 text-right font-semibold text-slate-700">{p.mtTotal?.toFixed(1)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={TABLE_COLUMNS.length} className="py-20 text-center text-xs text-slate-400">
                      No packs match the current filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-3 py-3">
            <h3 className="text-sm font-semibold text-slate-900">Pack Details</h3>
          </div>
          {selected ? (
            <div className="space-y-3 p-3 text-xs">
              <Field label="Pack ID" value={String(selected.id)} />
              <Field label="Status" value={selected.status} />
              <Field label="Customer" value={selected.customer} />
              <Field label="Commodity" value={selected.commodity} />
              <Field label="Import/Export" value={selected.importExport} />
              <Field label="Job Ref" value={selected.jobReference} />
              <Field label="Count" value={String(selected.containersRequired)} />
              <Field label="MT" value={selected.mtTotal?.toFixed(1)} />
            </div>
          ) : (
            <div className="p-6 text-center text-xs text-slate-400">Select a pack to view details</div>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }) {
  return (
    <div className="space-y-0.5">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="rounded border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] text-slate-700">{value ?? "—"}</div>
    </div>
  );
}
