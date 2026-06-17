"use client";

import { useEffect, useMemo, useState } from "react";

import { Grid } from "@/components/clutch-table";
import { ALL_SECTIONS, SECTION_LABELS } from "@/lib/reports-data";
import { SECTION_DEFS } from "@/lib/reports-csv";

function toGridColumns(defs) {
  return defs.map((d) => ({
    key: d.key,
    header: d.label,
    type: "text",
    sortable: true,
    filterable: true,
    resizable: true,
    ...(d.get ? { valueGetter: (row) => d.get(row) } : {}),
  }));
}

function customerLabel(report) {
  if (report?.reportLabel) return report.reportLabel;
  const c = report?.customer;
  if (!c) return "All customers";
  return c.code ? `${c.name} (${c.code})` : c.name;
}

function customerKey(report, index) {
  return report?.reportKey ?? report?.customer?.id ?? index;
}

function rowIdFor(section) {
  return (row) => {
    if (row?.id != null) return row.id;
    if (section === "containers") return row.reportKey ?? `${row.packNumber}-${row.order}-${row.containerNumber}`;
    if (section === "stockOnHand") return `${row.accountId}-${row.commodityName}-${row.locationName}`;
    return JSON.stringify(row);
  };
}

export function ReportPreview({ reportsByCustomer = [], sections = [], loading = false, error = "" }) {
  const [selectedKey, setSelectedKey] = useState(null);

  useEffect(() => {
    if (!reportsByCustomer.length) {
      setSelectedKey(null);
      return;
    }
    setSelectedKey((prev) => {
      const stillThere = reportsByCustomer.some((r, i) => String(customerKey(r, i)) === String(prev));
      return stillThere ? prev : String(customerKey(reportsByCustomer[0], 0));
    });
  }, [reportsByCustomer]);

  const activeSections = useMemo(() => ALL_SECTIONS.filter((s) => sections.includes(s)), [sections]);

  if (loading) {
    return (
      <section className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm">
        <p className="text-[11px] text-slate-500">Generating preview…</p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm">
        <p className="text-[11px] text-destructive">{error}</p>
      </section>
    );
  }

  if (!reportsByCustomer.length) return null;

  const report =
    reportsByCustomer.find((r, i) => String(customerKey(r, i)) === String(selectedKey)) || reportsByCustomer[0];
  const customerCode = report?.customer?.code || report?.customer?.name || "all";

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Preview</p>
          {reportsByCustomer.length > 1 ? (
            <div className="flex items-center gap-2 text-[11px]">
              <label className="text-slate-500">{reportsByCustomer.length > 1 ? "Report" : "Customer"}</label>
              <select
                className="h-7 rounded-md border border-slate-200 bg-white px-2 text-[11px] text-slate-800 outline-none focus:border-brand/35 focus:ring-2 focus:ring-brand/15"
                value={selectedKey ?? ""}
                onChange={(e) => setSelectedKey(e.target.value)}
              >
                {reportsByCustomer.map((r, i) => (
                  <option key={customerKey(r, i)} value={String(customerKey(r, i))}>
                    {customerLabel(r)}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <p className="text-[11px] text-slate-600">{customerLabel(report)}</p>
          )}
        </div>
      </section>

      {activeSections.map((key) => {
        const rows = Array.isArray(report[key]) ? report[key] : [];
        return (
          <section key={key} className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              {SECTION_LABELS[key]} <span className="text-slate-400">({rows.length})</span>
            </p>
            <Grid
              columns={toGridColumns(SECTION_DEFS[key].columns)}
              rows={rows}
              getRowId={rowIdFor(key)}
              theme="light"
              density="compact"
              visibleRows={8}
              fileName={`${customerCode}_${key}`}
              emptyMessage="No rows for this section."
            />
          </section>
        );
      })}
    </div>
  );
}
