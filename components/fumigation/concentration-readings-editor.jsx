"use client";

import { Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  calcEquilibriumDetails,
  emptyContainerReadingRow,
  syncReadingsWithContainers,
} from "@/lib/fumigation-concentration-readings";

const READING_COLS = [
  "containerNumber",
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

const NUMERIC_COLS = new Set([
  "startTopGm3",
  "startMiddleGm3",
  "startBaseGm3",
  "endTopGm3",
  "endMiddleGm3",
  "endBaseGm3",
  "tvlPpm",
]);

const START_READING_COLS = new Set(["startTopGm3", "startMiddleGm3", "startBaseGm3"]);

function withEquilibrium(row) {
  const eq = calcEquilibriumDetails(row.startTopGm3, row.startMiddleGm3, row.startBaseGm3);
  return {
    ...row,
    equilibriumPercent: eq.percent,
    equilibriumHighest: eq.highest === "" ? "" : String(eq.highest),
    equilibriumLowest: eq.lowest === "" ? "" : String(eq.lowest),
  };
}

/**
 * Editable container-centric concentration readings grid (Section D).
 */
export default function ConcentrationReadingsEditor({
  readings = [],
  onChange,
  inputClass = "w-full rounded border border-slate-200 bg-white px-1.5 py-1 text-xs text-slate-900 outline-none",
  containerNumbers = [],
  showSyncButton = false,
}) {
  const rows = Array.isArray(readings) ? readings : [];

  function updateRow(rowId, col, value) {
    onChange(
      rows.map((r) => {
        if (r.id !== rowId) return r;
        const next = { ...r, [col]: value };
        return START_READING_COLS.has(col) ? withEquilibrium(next) : next;
      }),
    );
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

  const cellInput = `${inputClass} min-w-0 border-0 shadow-none focus:ring-0`;
  const numericInput = `${cellInput} text-center tabular-nums`;

  return (
    <div className="-mx-1 overflow-x-auto px-1">
      <p className="mb-2 text-xs text-slate-500">
        Equilibrium: (Highest − Lowest) / Lowest × 100 = % — target below 15%
      </p>
      <table className="mb-2 w-max table-fixed border-collapse border border-slate-200 text-xs">
        <colgroup>
          <col style={{ width: "8.5rem" }} />
          <col style={{ width: "11rem" }} />
          <col style={{ width: "4rem" }} />
          <col style={{ width: "4rem" }} />
          <col style={{ width: "4rem" }} />
          <col style={{ width: "11rem" }} />
          <col style={{ width: "4rem" }} />
          <col style={{ width: "4rem" }} />
          <col style={{ width: "4rem" }} />
          <col style={{ width: "11rem" }} />
          <col style={{ width: "5rem" }} />
          <col style={{ width: "3.5rem" }} />
          <col style={{ width: "2rem" }} />
        </colgroup>
        <thead>
          <tr>
            <th className="border border-slate-200 bg-slate-50 px-2 py-1.5 font-medium text-slate-600" rowSpan={2}>
              Container
            </th>
            <th className="border border-slate-200 bg-sky-100 px-2 py-1.5 text-center font-medium text-slate-600" colSpan={4}>
              Start
            </th>
            <th className="border border-slate-200 bg-emerald-100 px-2 py-1.5 text-center font-medium text-slate-600" colSpan={4}>
              End
            </th>
            <th className="border border-slate-200 bg-amber-100 px-2 py-1.5 text-center font-medium text-slate-600" colSpan={2}>
              TVL
            </th>
            <th className="border border-slate-200 bg-slate-50 px-2 py-1.5 font-medium text-slate-600" rowSpan={2}>
              Eq.%
            </th>
            <th className="border border-slate-200 px-1 py-1.5" rowSpan={2} aria-label="Remove row" />
          </tr>
          <tr>
            {[
              ["start-time", "Date & time"],
              ["start-top", "Top"],
              ["start-mid", "Mid"],
              ["start-base", "Base"],
              ["end-time", "Date & time"],
              ["end-top", "Top"],
              ["end-mid", "Mid"],
              ["end-base", "Base"],
              ["tvl-time", "Date & time"],
              ["tvl-ppm", "PPM"],
            ].map(([key, h]) => (
              <th
                key={key}
                className="whitespace-nowrap border border-slate-200 px-2 py-1 font-medium text-slate-500"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const eq = calcEquilibriumDetails(row.startTopGm3, row.startMiddleGm3, row.startBaseGm3);
            return (
              <tr key={row.id}>
                {READING_COLS.map((col) => (
                  <td key={col} className="border border-slate-200 px-1 py-0.5">
                    <input
                      className={NUMERIC_COLS.has(col) ? numericInput : cellInput}
                      type={DATETIME_COLS.has(col) ? "datetime-local" : "text"}
                      value={row[col] ?? ""}
                      onChange={(e) => updateRow(row.id, col, e.target.value)}
                    />
                  </td>
                ))}
                <td
                  className={cn(
                    "border border-slate-200 bg-slate-50 px-2 py-1 text-center font-medium tabular-nums",
                    eq.percent === ""
                      ? "text-slate-400"
                      : eq.pass
                        ? "text-emerald-700"
                        : "text-red-700",
                  )}
                  title={
                    eq.percent !== ""
                      ? `Highest: ${eq.highest} g/m³ · Lowest: ${eq.lowest} g/m³`
                      : "Enter start Top, Mid, and Base readings"
                  }
                >
                  {eq.percent !== "" ? `${eq.percent}%` : "—"}
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
