"use client";

import { Plus, Trash2 } from "lucide-react";
import {
  calcEquilibriumPercent,
  emptyContainerReadingRow,
  syncReadingsWithContainers,
} from "@/lib/fumigation-concentration-readings";

const READING_COLS = [
  "containerNumber",
  "date",
  "startAt",
  "startTopGm3",
  "startMiddleGm3",
  "startBaseGm3",
  "endAt",
  "endTopGm3",
  "endMiddleGm3",
  "endBaseGm3",
  "tvlAt",
  "tvlPpm",
];

const DATETIME_COLS = new Set(["startAt", "endAt", "tvlAt"]);

/**
 * Editable container-centric concentration readings grid (Section D).
 */
export default function ConcentrationReadingsEditor({
  readings = [],
  onChange,
  inputClass = "w-full min-w-0 rounded border border-slate-200 bg-white px-1 py-0.5 text-[10px] text-slate-900 outline-none",
  containerNumbers = [],
  showSyncButton = false,
}) {
  const rows = Array.isArray(readings) ? readings : [];

  function updateRow(rowId, col, value) {
    onChange(rows.map((r) => (r.id === rowId ? { ...r, [col]: value } : r)));
  }

  function addRow() {
    const newId = Math.max(0, ...rows.map((r) => Number(r.id) || 0)) + 1;
    onChange([...rows, emptyContainerReadingRow(newId)]);
  }

  function removeRow(rowId) {
    onChange(rows.filter((r) => r.id !== rowId));
  }

  function syncFromContainers() {
    onChange(syncReadingsWithContainers(rows, containerNumbers));
  }

  const cellInput = `${inputClass} border-0 shadow-none focus:ring-0`;

  return (
    <div className="overflow-x-auto">
      <p className="mb-2 text-[10px] text-slate-500">
        Equilibrium: (Highest − Lowest) / Lowest × 100 = % — target below 15%
      </p>
      <table className="mb-2 w-full border-collapse border border-slate-200 text-[10px]">
        <thead>
          <tr>
            <th className="border border-slate-200 bg-slate-50 px-1 py-1 font-medium text-slate-600" rowSpan={2}>
              Container
            </th>
            <th className="border border-slate-200 bg-slate-50 px-1 py-1 font-medium text-slate-600" rowSpan={2}>
              Date
            </th>
            <th className="border border-slate-200 bg-sky-100 px-1 py-1 text-center font-medium text-slate-600" colSpan={4}>
              Start
            </th>
            <th className="border border-slate-200 bg-emerald-100 px-1 py-1 text-center font-medium text-slate-600" colSpan={4}>
              End
            </th>
            <th className="border border-slate-200 bg-amber-100 px-1 py-1 text-center font-medium text-slate-600" colSpan={2}>
              TVL
            </th>
            <th className="border border-slate-200 bg-slate-50 px-1 py-1 font-medium text-slate-600" rowSpan={2}>
              Eq.%
            </th>
            <th className="border border-slate-200 px-1 py-1" rowSpan={2} />
          </tr>
          <tr>
            {["Time", "Top", "Mid", "Base", "Time", "Top", "Mid", "Base", "Time", "PPM"].map((h) => (
              <th key={h} className="whitespace-nowrap border border-slate-200 px-1 py-1 font-medium text-slate-500">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const eqPct = calcEquilibriumPercent(row.startTopGm3, row.startMiddleGm3, row.startBaseGm3);
            return (
              <tr key={row.id}>
                {READING_COLS.map((col) => (
                  <td key={col} className="border border-slate-200 px-0.5 py-0.5">
                    <input
                      className={cellInput}
                      type={DATETIME_COLS.has(col) ? "datetime-local" : "text"}
                      value={row[col] ?? ""}
                      onChange={(e) => updateRow(row.id, col, e.target.value)}
                    />
                  </td>
                ))}
                <td className="border border-slate-200 px-1 py-1 text-center text-slate-500">
                  {eqPct ? `${eqPct}%` : ""}
                </td>
                <td className="border border-slate-200 px-1 py-1 text-center">
                  <button
                    type="button"
                    onClick={() => removeRow(row.id)}
                    className="text-slate-400 hover:text-red-500"
                    title="Remove container row"
                  >
                    <Trash2 className="size-3" />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="mb-2 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={addRow}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-brand hover:text-brand/80"
        >
          <Plus className="size-3" /> Add container row
        </button>
        {showSyncButton && containerNumbers.length > 0 && (
          <button
            type="button"
            onClick={syncFromContainers}
            className="text-xs font-medium text-slate-600 hover:text-slate-900"
          >
            Sync from pack containers
          </button>
        )}
      </div>
    </div>
  );
}
