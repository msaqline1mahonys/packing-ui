"use client";

import { useMemo, useRef, useState, useEffect } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

/* â”€â”€â”€ Constants â”€â”€â”€ */
const DAYS_OPTIONS = [7, 14, 21, 28];
const DEFAULT_DAYS = 14;

/* â”€â”€â”€ Mock data â”€â”€â”€ */
const MOCK_PACKERS = [
  { id: 1, name: "James Turner", status: "active" },
  { id: 2, name: "Sarah Mitchell", status: "active" },
  { id: 3, name: "Liam Chen", status: "active" },
  { id: 4, name: "Emily Watson", status: "active" },
];

const MOCK_COMMODITIES = [
  { id: 1, name: "Wheat" },
  { id: 2, name: "Barley" },
  { id: 3, name: "Chickpeas" },
  { id: 4, name: "Canola" },
];

const MOCK_CUSTOMERS = [
  { id: 1, name: "ACME Corp" },
  { id: 2, name: "GrainLink" },
  { id: 3, name: "Southern Export" },
  { id: 4, name: "Pacific Traders" },
];

const MOCK_PACKS = [
  { id: 101, jobReference: "JOB-2026-001", customerId: 1, commodityId: 1, assignedPackerIds: [1, 2], status: "Scheduled", date: "2026-05-12", packType: "container", containersRequired: 4, mtTotal: 100 },
  { id: 102, jobReference: "JOB-2026-002", customerId: 2, commodityId: 3, assignedPackerIds: [3], status: "Scheduled", date: "2026-05-13", packType: "container", containersRequired: 2, mtTotal: 52 },
  { id: 103, jobReference: "JOB-2026-003", customerId: 3, commodityId: 2, assignedPackerIds: [], status: "Pending", date: "2026-05-14", packType: "container", containersRequired: 6, mtTotal: 150 },
  { id: 104, jobReference: "JOB-2026-004", customerId: 4, commodityId: 4, assignedPackerIds: [], status: "Pending", date: "2026-05-15", packType: "bulk", containersRequired: 0, mtTotal: 78 },
  { id: 105, jobReference: "JOB-2026-005", customerId: 1, commodityId: 1, assignedPackerIds: [4], status: "Scheduled", date: "2026-05-16", packType: "container", containersRequired: 5, mtTotal: 125 },
];

/* â”€â”€â”€ Helpers â”€â”€â”€ */
function fmtDate(d) { return d.toISOString().split("T")[0]; }
function fmtDisplay(d) {
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${days[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]}`;
}
function genDates(start, n) { const a = []; for (let i = 0; i < n; i++) { const d = new Date(start); d.setDate(d.getDate() + i); a.push(d); } return a; }
function isWeekend(d) { return d.getDay() === 0 || d.getDay() === 6; }
function isToday(d) { return d.toDateString() === new Date().toDateString(); }

/* â”€â”€â”€ Status helpers â”€â”€â”€ */
const STATUS_CLS = {
  Pending: "bg-amber-100 border-amber-300 text-amber-800",
  Scheduled: "bg-blue-100 border-blue-300 text-blue-800",
  "In Progress": "bg-emerald-100 border-emerald-300 text-emerald-800",
  Inprogress: "bg-emerald-100 border-emerald-300 text-emerald-800",
  Packed: "bg-violet-100 border-violet-300 text-violet-800",
  Completed: "bg-slate-100 border-slate-300 text-slate-600",
};
function StatusBadge({ status }) {
  return <span className={cn("rounded-full px-1.5 py-0.5 text-[9px] font-semibold", STATUS_CLS[status] || "bg-slate-100 text-slate-500")}>{status}</span>;
}

/* â”€â”€â”€ Lookup helpers â”€â”€â”€ */
const lookupCustomer = (id) => MOCK_CUSTOMERS.find((c) => c.id === id)?.name ?? "";
const lookupCommodity = (id) => MOCK_COMMODITIES.find((c) => c.id === id)?.name ?? "";

/* â”€â”€â”€ Main â”€â”€â”€ */
export default function SchedulePage() {
  const [startDate, setStartDate] = useState(() => fmtDate(new Date()));
  const [daysCount, setDaysCount] = useState(DEFAULT_DAYS);
  const [packerFilter, setPackerFilter] = useState("");
  const [commodityFilter, setCommodityFilter] = useState("");
  const [customerFilter, setCustomerFilter] = useState("");
  const [selectedUnassigned, setSelectedUnassigned] = useState(null);
  const [packs, setPacks] = useState(() => [...MOCK_PACKS]);

  const activePackers = MOCK_PACKERS.filter((p) => p.status === "active");
  const dates = useMemo(() => genDates(new Date(startDate), daysCount), [startDate, daysCount]);
  const dateStrs = useMemo(() => dates.map(fmtDate), [dates]);

  /* Filters */
  const filteredPacks = useMemo(() => packs.filter((p) => {
    if (commodityFilter && p.commodityId !== Number(commodityFilter)) return false;
    if (customerFilter && p.customerId !== Number(customerFilter)) return false;
    if (packerFilter) {
      const pid = Number(packerFilter);
      const match = Array.isArray(p.assignedPackerIds) && p.assignedPackerIds.includes(pid);
      if (!match) return false;
    }
    return true;
  }), [packs, commodityFilter, customerFilter, packerFilter]);

  const hasFilters = !!(packerFilter || commodityFilter || customerFilter);
  const clearFilters = () => { setPackerFilter(""); setCommodityFilter(""); setCustomerFilter(""); };

  const unassignedPacks = useMemo(() => filteredPacks.filter((p) => !Array.isArray(p.assignedPackerIds) || p.assignedPackerIds.length === 0), [filteredPacks]);

  const filteredPackers = useMemo(() => {
    if (!packerFilter) return activePackers;
    return activePackers.filter((p) => p.id === Number(packerFilter));
  }, [activePackers, packerFilter]);

  /* Cell lookup */
  const getCell = (packerId, dateStr) => filteredPacks.filter((p) => p.date === dateStr && Array.isArray(p.assignedPackerIds) && p.assignedPackerIds.includes(packerId));

  /* Day totals */
  const dayTotals = useMemo(() => {
    const m = {};
    dateStrs.forEach((d) => { m[d] = { cnt: 0, mt: 0 }; });
    filteredPacks.forEach((p) => {
      if (!p.date || !m[p.date]) return;
      m[p.date].cnt += p.packType === "container" ? (Number(p.containersRequired) || 0) : 0;
      m[p.date].mt += Number(p.mtTotal) || 0;
    });
    return m;
  }, [filteredPacks, dateStrs]);

  /* Packer totals */
  const packerTotals = useMemo(() => {
    const m = {};
    const ds = new Set(dateStrs);
    activePackers.forEach((pk) => { m[pk.id] = { cnt: 0, mt: 0 }; });
    filteredPacks.forEach((p) => {
      if (!ds.has(p.date)) return;
      const pids = new Set(Array.isArray(p.assignedPackerIds) ? p.assignedPackerIds : []);
      const cnt = p.packType === "container" ? (Number(p.containersRequired) || 0) : 0;
      const mt = Number(p.mtTotal) || 0;
      pids.forEach((pid) => { if (m[pid]) { m[pid].cnt += cnt; m[pid].mt += mt; } });
    });
    return m;
  }, [filteredPacks, activePackers, dateStrs]);

  /* Assign / Unassign */
  function assignPack(packerId, dateStr) {
    if (selectedUnassigned == null) return;
    setPacks((prev) => prev.map((p) => {
      if (p.id !== selectedUnassigned) return p;
      const existing = Array.isArray(p.assignedPackerIds) ? p.assignedPackerIds : [];
      return { ...p, assignedPackerIds: [...existing, packerId], date: dateStr, status: "Scheduled" };
    }));
    setSelectedUnassigned(null);
  }

  function unassignPack(packId, packerId) {
    setPacks((prev) => prev.map((p) => {
      if (p.id !== packId) return p;
      const next = (p.assignedPackerIds || []).filter((id) => id !== packerId);
      return { ...p, assignedPackerIds: next };
    }));
  }

  return (
    <div className="flex flex-col gap-0">
      {/* Top bar */}
      <div className="-mx-6 -mt-6 flex flex-wrap items-center gap-4 border-b border-slate-200 bg-white px-5 py-3 shadow-sm md:-mx-10 md:-mt-10 md:px-8">
        <h1 className="text-base font-bold text-brand-ink">Packer Schedule</h1>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <span className="font-medium">Start date</span>
          <input suppressHydrationWarning type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-900 outline-none focus:border-brand/40 focus:ring-1 focus:ring-brand/20" />
        </label>
        <select suppressHydrationWarning value={daysCount} onChange={(e) => setDaysCount(Number(e.target.value))} className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-600 outline-none focus:border-brand/40">
          {DAYS_OPTIONS.map((d) => <option key={d} value={d}>{d} days</option>)}
        </select>
        <span className="hidden text-xs text-slate-400 lg:inline">Packers on Y axis, dates on X axis</span>
        <Link href="/packing/packing-table" className="ml-auto rounded-md border border-brand/30 bg-brand/5 px-3 py-1.5 text-sm font-medium text-brand-ink transition-colors hover:bg-brand/10">Packing Table</Link>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-5 border-b border-slate-100 bg-slate-50/60 px-5 py-2.5 md:px-8">
        <FilterSelect label="Packers" value={packerFilter} onChange={setPackerFilter} options={activePackers.map((p) => ({ value: String(p.id), label: p.name }))} allLabel="All packers" />
        <FilterSelect label="Commodities" value={commodityFilter} onChange={setCommodityFilter} options={MOCK_COMMODITIES.map((c) => ({ value: String(c.id), label: c.name }))} allLabel="All commodities" />
        <FilterSelect label="Customers" value={customerFilter} onChange={setCustomerFilter} options={MOCK_CUSTOMERS.map((c) => ({ value: String(c.id), label: c.name }))} allLabel="All customers" />
        {hasFilters && (
          <button type="button" onClick={clearFilters} className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">Clear filters</button>
        )}
      </div>

      {/* Body */}
      <div className="mt-4 flex gap-0">
        {/* Sidebar */}
        <aside className="w-52 shrink-0 border-r border-slate-200 pr-3">
          <h2 className="text-[11px] font-bold uppercase tracking-wide text-slate-700">Packs without packer</h2>
          <p className="mt-1 text-[10px] leading-snug text-slate-400">Select one, then click a packer/date cell to assign.</p>
          <hr className="my-3 border-slate-200" />
          {unassignedPacks.length === 0 ? (
            <p className="py-4 text-xs text-slate-400">No packs without packer</p>
          ) : (
            <div className="space-y-2">
              {unassignedPacks.map((p) => (
                <button key={p.id} type="button" onClick={() => setSelectedUnassigned(selectedUnassigned === p.id ? null : p.id)}
                  className={cn("w-full rounded-lg border px-3 py-2.5 text-left text-xs transition-colors", selectedUnassigned === p.id ? "border-brand bg-brand/5 ring-1 ring-brand/30" : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50")}>
                  <div className="font-bold text-brand">#{p.id}</div>
                  <div className="mt-1 text-slate-700">{lookupCustomer(p.customerId)}</div>
                  <div className="text-slate-400">{lookupCommodity(p.commodityId)} · {p.jobReference || ""}</div>
                  <div className="mt-1 text-slate-400">{p.containersRequired || 0} ctrs · {p.mtTotal || 0} MT</div>
                  <div className="mt-1"><StatusBadge status={p.status} /></div>
                </button>
              ))}
            </div>
          )}
        </aside>

        {/* Grid */}
        <div className="min-w-0 flex-1 overflow-x-auto pl-3">
          {filteredPackers.length === 0 ? (
            <div className="flex h-64 items-center justify-center text-sm text-slate-400">No active packers. Add packers in Reference Data to see the schedule.</div>
          ) : (
            <table className="w-full border-collapse text-xs">
              <thead>
                {/* Date header */}
                <tr>
                  <th className="sticky left-0 z-10 min-w-32 bg-slate-50 px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wide text-slate-500 border-r border-slate-200">Packer</th>
                  {dates.map((d) => (
                    <th key={fmtDate(d)} className={cn("min-w-[110px] border-l border-slate-100 px-1.5 py-2 text-center text-[10px] font-semibold", isWeekend(d) ? "bg-slate-50 text-slate-400" : "text-slate-600", isToday(d) && "bg-brand/5 font-bold text-brand-ink")}>
                      {fmtDisplay(d)}
                    </th>
                  ))}
                </tr>
                {/* Day totals row */}
                <tr className="border-b-2 border-slate-200 bg-slate-100">
                  <td className="sticky left-0 z-10 bg-slate-100 px-3 py-1.5 text-[10px] font-semibold text-slate-500 border-r border-slate-200">Day total</td>
                  {dateStrs.map((d) => {
                    const t = dayTotals[d] || { cnt: 0, mt: 0 };
                    return (
                      <td key={d} className="border-l border-slate-200/60 px-1.5 py-1.5 text-center text-[10px] font-semibold text-slate-500">
                        {t.cnt > 0 || t.mt > 0 ? <>{t.cnt} cnt<br />{t.mt} MT</> : ""}
                      </td>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {filteredPackers.map((packer) => {
                  const pt = packerTotals[packer.id] || { cnt: 0, mt: 0 };
                  return (
                    <tr key={packer.id} className="border-t border-slate-100">
                      <td className="sticky left-0 z-10 bg-white px-3 py-2.5 border-r border-slate-200">
                        <div className="text-sm font-medium text-slate-800">{packer.name}</div>
                        {(pt.cnt > 0 || pt.mt > 0) && <div className="mt-0.5 text-[9px] text-slate-400">{pt.cnt} cnt · {pt.mt} MT</div>}
                      </td>
                      {dates.map((d) => {
                        const ds = fmtDate(d);
                        const cellPacks = getCell(packer.id, ds);
                        const canAssign = selectedUnassigned != null;
                        return (
                          <td key={ds} onClick={() => canAssign && assignPack(packer.id, ds)}
                            className={cn("border-l border-slate-100 px-1 py-1.5 align-top transition-colors", isWeekend(d) ? "bg-slate-50/50" : "bg-white", isToday(d) && "bg-brand/[0.03]", canAssign && "cursor-pointer hover:bg-brand/10")}
                            style={{ minHeight: 76 }}>
                            <div className="space-y-1">
                              {cellPacks.map((p) => (
                                <div key={p.id} className={cn("relative rounded-md border px-2 py-1.5 text-[11px] leading-tight transition-shadow hover:shadow-md", STATUS_CLS[p.status] || STATUS_CLS.Pending)}
                                  title={`${p.jobReference} · ${lookupCustomer(p.customerId)} · ${lookupCommodity(p.commodityId)} · ${p.containersRequired} ctrs · ${p.mtTotal} MT`}>
                                  {/* Unassign button */}
                                  <button type="button" onClick={(e) => { e.stopPropagation(); unassignPack(p.id, packer.id); }}
                                    title="Remove from packer"
                                    className="absolute right-1 top-1 flex size-4 items-center justify-center rounded bg-red-50 text-[10px] text-red-500 hover:bg-red-100">
                                    Ã—
                                  </button>
                                  <div className="pr-5 font-bold">#{p.id}</div>
                                  <div className="mt-0.5 truncate opacity-80">{lookupCustomer(p.customerId)}</div>
                                  <div className="mt-0.5 truncate text-[9px] opacity-60">{lookupCommodity(p.commodityId)} · {p.jobReference}</div>
                                  <div className="mt-1"><StatusBadge status={p.status} /></div>
                                </div>
                              ))}
                              {cellPacks.length === 0 && (
                                <span className="text-[10px] text-slate-300">{canAssign ? "Click to assign" : ""}</span>
                              )}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

function FilterSelect({ label, value, onChange, options, allLabel }) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-xs font-medium text-slate-500">{label}</span>
      <select suppressHydrationWarning value={value} onChange={(e) => onChange(e.target.value)} className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-700 outline-none focus:border-brand/40">
        <option value="">{allLabel}</option>
        {options.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
      </select>
    </label>
  );
}