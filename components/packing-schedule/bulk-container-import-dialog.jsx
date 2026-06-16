"use client";

import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  applyBulkImport,
  getReleaseRef,
  planBulkImport,
  prefillParkTransporterFromRelease,
} from "@/lib/container-bulk-import";
import { cn } from "@/lib/utils";

const fieldClass =
  "w-full rounded-lg border border-slate-200/95 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-brand/15 placeholder:text-slate-400 focus:border-brand/35 focus:ring-2 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400";

const STATUS_LABELS = {
  ready: "Ready",
  blocked: "Blocked",
  invalid_format: "Invalid format",
  conflict_skip: "Conflict — skipped",
  conflict_overwrite: "Overwrite existing slot",
  duplicate_paste: "Duplicate in paste",
};

function statusClass(status) {
  if (status === "ready" || status === "conflict_overwrite") return "text-emerald-700";
  if (status === "blocked" || status === "invalid_format") return "text-red-700";
  if (status === "conflict_skip") return "text-amber-700";
  return "text-slate-500";
}

/**
 * Embedded bulk-import panel. Targets a single, fixed release (the one being edited in the
 * release modal) so there are no release/park/transporter selectors here — those come from
 * the release record itself. Pasted numbers fill empty container slots on the pack.
 */
export default function BulkContainerImportPanel({
  release,
  containers = [],
  containerNumberField = "containerNumber",
  releaseNumberField = "releaseNumber",
  containerParkOptions = [],
  transporterOptions = [],
  onApply,
  isApplying = false,
  applyProgress = "",
  disabled = false,
  disabledReason = "",
}) {
  const [pastedText, setPastedText] = useState("");
  const [userActions, setUserActions] = useState({});

  const selectedReleaseRef = getReleaseRef(release);
  const { parkId, transporterId } = useMemo(
    () => prefillParkTransporterFromRelease(release),
    [release]
  );

  const plan = useMemo(
    () =>
      planBulkImport({
        pastedText,
        containers,
        selectedReleaseRef,
        containerNumberField,
        releaseNumberField,
        userActions,
      }),
    [pastedText, containers, selectedReleaseRef, containerNumberField, releaseNumberField, userActions]
  );

  function setRowAction(rowKey, action) {
    setUserActions((prev) => ({ ...prev, [rowKey]: action }));
  }

  async function handleApply() {
    if (disabled || plan.blocked || plan.toApply === 0 || isApplying) return;

    const logistics = {
      releaseRef: selectedReleaseRef,
      emptyContainerParkId: parkId || null,
      transporterId: transporterId || null,
    };

    const updated = applyBulkImport({
      containers,
      planRows: plan.rows,
      selectedRelease: logistics,
      containerNumberField,
      lookupOptions: { containerParkOptions, transporterOptions },
    });

    const applied = plan.rows.filter((row) => row.action !== "skip" && row.targetSlotId);
    const ok = await onApply?.(updated, applied, logistics);
    if (ok) {
      setPastedText("");
      setUserActions({});
    }
  }

  const canImport = !disabled && !plan.blocked && plan.toApply > 0 && !isApplying;

  if (disabled) {
    return (
      <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-500">
        {disabledReason || "Save the release first to import container numbers."}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">
          Container numbers
        </label>
        <textarea
          className={cn(fieldClass, "min-h-[110px] resize-y font-mono")}
          value={pastedText}
          disabled={isApplying}
          placeholder={"Paste one container number per line\nABCU1234567\nMSCU7654321"}
          onChange={(e) => {
            setPastedText(e.target.value);
            setUserActions({});
          }}
        />
        <p className="text-[10px] text-slate-500">
          One per line, or separated by commas or tabs. Numbers fill empty slots on this pack and are
          tagged with release <span className="font-semibold">{selectedReleaseRef || "—"}</span>.
        </p>
      </div>

      {plan.duplicateNumbers.length ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Duplicate numbers in paste (only first occurrence imported): {plan.duplicateNumbers.join(", ")}
        </div>
      ) : null}

      {plan.blocked && plan.parsedCount > 0 ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {plan.blockReason}
        </div>
      ) : null}

      {plan.parsedCount > 0 && !plan.blocked ? (
        <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
          {plan.parsedCount} number{plan.parsedCount === 1 ? "" : "s"} → {plan.toApply} slot
          {plan.toApply === 1 ? "" : "s"} ({plan.emptySlotCount} empty available)
        </div>
      ) : null}

      {plan.rows.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full min-w-[560px] text-left text-xs">
            <thead className="bg-slate-50 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-2 py-2">#</th>
                <th className="px-2 py-2">Container no.</th>
                <th className="px-2 py-2">Slot</th>
                <th className="px-2 py-2">Current</th>
                <th className="px-2 py-2">Status</th>
                <th className="px-2 py-2">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {plan.rows.map((row) => {
                const hasConflict = row.conflictType === "number_on_other_slot";
                const actionOptions = hasConflict
                  ? [
                      { value: "skip", label: "Skip" },
                      { value: "overwrite", label: `Overwrite slot #${row.conflictSlotOrder}` },
                    ]
                  : [{ value: "apply", label: "Apply" }];

                return (
                  <tr key={row.rowKey} className="bg-white">
                    <td className="px-2 py-1.5 tabular-nums text-slate-500">{row.importIndex}</td>
                    <td className="px-2 py-1.5 font-mono font-medium text-slate-900">{row.number}</td>
                    <td className="px-2 py-1.5 tabular-nums text-slate-700">
                      {row.targetSlotOrder ? `#${row.targetSlotOrder}` : row.slotOrder ? `#${row.slotOrder}` : "—"}
                    </td>
                    <td className="px-2 py-1.5 font-mono text-slate-500">{row.currentValue || "—"}</td>
                    <td className={cn("px-2 py-1.5", statusClass(row.status))}>
                      {row.status === "invalid_format" && row.formatError
                        ? row.formatError
                        : hasConflict && row.action === "skip"
                        ? `Already on slot #${row.conflictSlotOrder}`
                        : STATUS_LABELS[row.status] || row.status}
                    </td>
                    <td className="px-2 py-1.5">
                      {hasConflict && !plan.blocked ? (
                        <select
                          className="w-full rounded border border-slate-200 bg-white px-1.5 py-1 text-xs"
                          value={row.action}
                          disabled={isApplying}
                          onChange={(e) => setRowAction(row.rowKey, e.target.value)}
                        >
                          {actionOptions.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}

      {applyProgress ? <div className="text-xs font-medium text-slate-600">{applyProgress}</div> : null}

      <div className="flex justify-end">
        <Button type="button" size="sm" disabled={!canImport} onClick={handleApply}>
          {isApplying ? "Importing…" : `Import ${plan.toApply} container${plan.toApply === 1 ? "" : "s"}`}
        </Button>
      </div>
    </div>
  );
}
