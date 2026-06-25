"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import dayjs from "dayjs";

import { Grid } from "@/components/clutch-table";
import { HistoryDrawer } from "@/components/audit/history-drawer";
import { Button } from "@/components/ui/button";
import CustomDateRangePicker from "@/components/ui/custom-date-range-picker";
import { deleteTicket, fetchTickets } from "@/lib/ticketing-api";
import { todayIso } from "@/lib/ticket-turnaround";
import { usePolling } from "@/lib/use-polling";
import { cn } from "@/lib/utils";

const inputClass =
  "h-7 rounded-md border border-slate-200 bg-white px-2 text-[11px] text-slate-800 outline-none ring-brand/15 focus:border-brand/35 focus:ring-2";

const STATUS_OPTIONS = [
  { key: "booked", label: "Booked" },
  { key: "processing", label: "Processing" },
  { key: "completed", label: "Completed" },
  { key: "cancelled", label: "Cancelled" },
];

function statusBadgeClass(status) {
  switch (status) {
    case "booked":
      return "bg-brand/12 text-brand-ink ring-1 ring-brand/25";
    case "processing":
      return "bg-amber-50 text-amber-900 ring-1 ring-amber-200";
    case "completed":
      return "bg-emerald-50 text-emerald-900 ring-1 ring-emerald-200";
    case "cancelled":
      return "bg-slate-100 text-slate-700 ring-1 ring-slate-200";
    default:
      return "bg-slate-50 text-slate-700 ring-1 ring-slate-200";
  }
}

function formatNet(v) {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  return Number(v).toFixed(2);
}

export default function TicketListPage({
  ticketType = "in",
  title = "Incoming Tickets",
  subtitle = "Review and manage incoming weighbridge tickets.",
  breadcrumb = "Operations / Incoming",
  createPath = "/ticketing/in/new",
  editPathBase = "/ticketing/in",
  persistKey = "ticket-queue-incoming",
  queueLabel = "Incoming queue",
  dateFilterName = "date-filter-incoming",
}) {
  const router = useRouter();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState(() => new Set(STATUS_OPTIONS.map((s) => s.key)));
  const [dateFilterMode, setDateFilterMode] = useState("range");
  const [filterDate, setFilterDate] = useState("");
  const [dateRange, setDateRange] = useState(() => {
    const today = dayjs(todayIso());
    return [today, today];
  });
  const [selectedId, setSelectedId] = useState(null);
  const [historyOpen, setHistoryOpen] = useState(false);

  const loadRows = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [fromDate, toDate] = dateRange;
      const data = await fetchTickets({
        type: ticketType,
        ...(dateFilterMode === "specific" && filterDate ? { date: filterDate } : {}),
        ...(dateFilterMode === "range" && (fromDate || toDate)
          ? {
              ...(fromDate?.isValid() ? { dateFrom: fromDate.format("YYYY-MM-DD") } : {}),
              ...(toDate?.isValid() ? { dateTo: toDate.format("YYYY-MM-DD") } : {}),
            }
          : {}),
      });
      setRows(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load tickets.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [ticketType, dateFilterMode, filterDate, dateRange]);

  useEffect(() => {
    loadRows();
  }, [loadRows]);

  // Live refresh: poll every 60s (paused when the tab is hidden or while the
  // history drawer is open).
  usePolling(loadRows, { intervalMs: 60000, isBusy: () => historyOpen });

  const toggleStatus = (key) => {
    setStatusFilter((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const filteredRows = useMemo(() => {
    const [fromDate, toDate] = dateRange;
    const rangeActive = dateFilterMode === "range" && (fromDate || toDate);
    return rows.filter((row) => {
      if (statusFilter.size === 0) return false;
      if (!statusFilter.has(row.status)) return false;
      if (rangeActive) {
        if (!row.date) return false;
        const d = dayjs(row.date);
        if (!d.isValid()) return false;
        if (fromDate && d.isBefore(fromDate, "day")) return false;
        if (toDate && d.isAfter(toDate, "day")) return false;
      }
      return true;
    });
  }, [rows, statusFilter, dateFilterMode, dateRange]);

  useEffect(() => {
    if (selectedId != null && !filteredRows.some((r) => r.id === selectedId)) {
      setSelectedId(null);
    }
  }, [filteredRows, selectedId]);

  const selected = selectedId != null ? filteredRows.find((r) => r.id === selectedId) ?? null : null;

  const gridColumns = useMemo(
    () => [
      {
        key: "ticketReference",
        header: "Ticket No.",
        type: "text",
        sortable: true,
        filterable: true,
        resizable: true,
      },
      {
        key: "id",
        header: "ID",
        type: "text",
        align: "left",
        sortable: true,
        filterable: true,
        resizable: true,
        hidden: true,
        renderCell: ({ value }) => <span title={value}>{String(value).slice(0, 8)}</span>,
      },
      { key: "customerCmo", header: "Customer / CMO", type: "text", sortable: true, filterable: true, resizable: true },
      { key: "commodityGrade", header: "Commodity Grade", type: "text", sortable: true, filterable: true, resizable: true },
      { key: "truckDisplay", header: "Truck", type: "text", sortable: true, filterable: true, resizable: true },
      {
        key: "status",
        header: "Status",
        type: "text",
        sortable: true,
        filterable: true,
        resizable: true,
        renderCell: ({ value }) => (
          <span className={cn("inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize", statusBadgeClass(value))}>
            {value ?? ""}
          </span>
        ),
      },
      { key: "netT", header: "Net (T)", type: "number", sortable: true, filterable: true, resizable: true, format: (v) => formatNet(v) },
    ],
    []
  );

  async function handleDelete() {
    if (!selected || selected.status === "completed") return;
    if (!window.confirm("Delete this ticket?")) return;
    try {
      await deleteTicket(selected.id);
      setSelectedId(null);
      await loadRows();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed.");
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs text-slate-500">{breadcrumb}</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 md:text-[1.65rem]">{title}</h1>
        <p className="mt-1 text-xs text-slate-500">{subtitle}</p>
      </div>

      {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div> : null}

      <section className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Status filters</p>
          <div className="flex flex-1 flex-wrap items-center gap-2">
            {STATUS_OPTIONS.map(({ key, label }) => {
              const on = statusFilter.has(key);
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => toggleStatus(key)}
                  className={cn(
                    "inline-flex h-7 items-center rounded-md border px-2.5 text-[11px] font-medium transition-colors",
                    on
                      ? "border-brand/30 bg-brand/15 text-brand-ink shadow-sm"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-800"
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>
          <div className="ms-auto flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 p-1">
              <label className="cursor-pointer">
                <input suppressHydrationWarning type="radio" name={dateFilterName} checked={dateFilterMode === "all"} onChange={() => setDateFilterMode("all")} className="sr-only" />
                <span className={cn("inline-flex h-5 items-center rounded px-2 text-[11px] font-medium transition-colors", dateFilterMode === "all" ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200" : "text-slate-500 hover:text-slate-700")}>
                  All dates
                </span>
              </label>
              {/* <label className="cursor-pointer">
                <input suppressHydrationWarning type="radio" name={dateFilterName} checked={dateFilterMode === "specific"} onChange={() => setDateFilterMode("specific")} className="sr-only" />
                <span className={cn("inline-flex h-5 items-center rounded px-2 text-[11px] font-medium transition-colors", dateFilterMode === "specific" ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200" : "text-slate-500 hover:text-slate-700")}>
                  By date
                </span>
              </label> */}
              <label className="cursor-pointer">
                <input suppressHydrationWarning type="radio" name={dateFilterName} checked={dateFilterMode === "range"} onChange={() => setDateFilterMode("range")} className="sr-only" />
                <span className={cn("inline-flex h-5 items-center rounded px-2 text-[11px] font-medium transition-colors", dateFilterMode === "range" ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200" : "text-slate-500 hover:text-slate-700")}>
                  By Date
                </span>
              </label>
            </div>
            <Button type="button" variant="outline" size="sm" className="h-7 px-2.5 text-[11px]" onClick={loadRows} disabled={loading}>
              Refresh
            </Button>
          </div>
        </div>
        {dateFilterMode === "specific" || dateFilterMode === "range" ? (
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              {dateFilterMode === "range" ? "Filter by date range" : "Filter by date"}
            </span>
            {dateFilterMode === "specific" ? (
              <input suppressHydrationWarning className={`${inputClass} w-[160px]`} type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} aria-label="Specific date" />
            ) : (
              <div className="w-72">
                <CustomDateRangePicker value={dateRange} onChange={setDateRange} />
              </div>
            )}
          </div>
        ) : null}
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(240px,320px)] xl:items-start">
        <div className="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-sm">
          <Grid
            columns={gridColumns}
            rows={filteredRows}
            getRowId={(row) => row.id}
            theme="light"
            density="standard"
            fileName={title}
            persistKey={persistKey}
            visibleRows={14}
            enableSelection={false}
            onRowClick={(row) => setSelectedId(row.id)}
            onPersistedRowActivate={(row) => setSelectedId(row.id)}
            getRowClassName={({ row }) => (row.id === selectedId ? "clutch-row-selected" : undefined)}
            getRowStyle={({ row }) => (row.id === selectedId ? { backgroundColor: "#dbeafe" } : undefined)}
            emptyMessage={loading ? "Loading tickets…" : "No tickets match the current filters."}
            toolbarActions={
              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" size="sm" onClick={() => router.push(createPath)} className="h-7 px-2.5 text-[11px]">
                  + Create
                </Button>
                <Button type="button" size="sm" variant="secondary" disabled={!selected} className="h-7 px-2.5 text-[11px]" onClick={() => selected && router.push(`${editPathBase}/${selected.id}`)}>
                  Edit
                </Button>
                <Button type="button" size="sm" variant="secondary" disabled={!selected} className="h-7 px-2.5 text-[11px]" onClick={() => setHistoryOpen(true)}>
                  History
                </Button>
                <Button type="button" size="sm" variant="destructive" disabled={!selected || selected?.status === "completed"} className="h-7 px-2.5 text-[11px]" onClick={handleDelete}>
                  Delete
                </Button>
                <span className="ms-auto text-[11px] text-slate-500">{queueLabel}</span>
              </div>
            }
          />
        </div>

        <div className="rounded-xl border border-slate-200/90 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-3 py-3">
            <h3 className="text-sm font-semibold text-slate-900">Ticket details</h3>
          </div>
          {!selected ? (
            <div className="p-6 text-center text-xs text-slate-400">Select a ticket to view details</div>
          ) : (
            <div className="space-y-3 p-3 text-xs">
              <Field label="ID" value={String(selected.id).slice(0, 8)} />
              <Field label="Customer / CMO" value={selected.customerCmo} />
              <Field label="Commodity Grade" value={selected.commodityGrade} />
              <Field label="Truck" value={<span className="font-mono">{selected.truckDisplay || "—"}</span>} />
              <Field label="Status" value={<span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize", statusBadgeClass(selected.status))}>{selected.status}</span>} />
              <Field label="Net (T)" value={formatNet(selected.netT)} />
              <Field label="Date" value={selected.date} />
              <Field label="Notes" value={selected.notes || "—"} />
            </div>
          )}
        </div>
      </div>

      <HistoryDrawer
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        subjectType="ticket"
        subjectId={selected?.id}
        title={selected ? `Ticket ${selected.ticketReference || String(selected.id).slice(0, 8)}` : "History"}
      />
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
