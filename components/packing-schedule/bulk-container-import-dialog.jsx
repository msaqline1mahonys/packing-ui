"use client";

import { useMemo, useState } from "react";

import ClutchSelect from "@/components/custom/ClutchSelect";
import { Button } from "@/components/ui/button";
import {
  applyBulkImport,
  buildBulkImportReleaseOptions,
  initialBulkImportLogistics,
  planBulkImport,
  prefillParkTransporterFromRelease,
} from "@/lib/container-bulk-import";
import { cn } from "@/lib/utils";

const fieldClass =
  "w-full rounded-lg border border-slate-200/95 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-brand/15 placeholder:text-slate-400 focus:border-brand/35 focus:ring-2 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400";

const STATUS_LABELS = {
  ready: "Ready",
  blocked: "Blocked",
  conflict_skip: "Conflict — skipped",
  conflict_overwrite: "Overwrite existing slot",
  duplicate_paste: "Duplicate in paste",
};

function statusClass(status) {
  if (status === "ready" || status === "conflict_overwrite") return "text-emerald-700";
  if (status === "blocked") return "text-red-700";
  if (status === "conflict_skip") return "text-amber-700";
  return "text-slate-500";
}

function LogisticsField({ label, children }) {
  return (
    <div className="space-y-1">
      <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">{label}</label>
      {children}
    </div>
  );
}

export default function BulkContainerImportDialog({
  open,
  onClose,
  packReleases = [],
  referenceReleases = [],
  containers = [],
  containerNumberField = "containerNumber",
  releaseNumberField = "releaseNumber",
  containerParkOptions = [],
  transporterOptions = [],
  onApply,
  isApplying = false,
  applyProgress = "",
  isLoadingReleases = false,
}) {
  const releases = useMemo(
    () => buildBulkImportReleaseOptions({ packReleases, referenceReleases }),
    [packReleases, referenceReleases]
  );

  const releaseSelectOptions = useMemo(
    () =>
      releases.map((r, idx) => ({
        value: r.releaseRef,
        label: r.status ? `${r.releaseRef} (${r.status})` : r.releaseRef,
        key: r.id ?? idx,
      })),
    [releases]
  );

  const parkSelectOptions = useMemo(
    () => containerParkOptions.map((park) => ({ value: String(park.id), label: park.name })),
    [containerParkOptions]
  );

  const transporterSelectOptions = useMemo(
    () => transporterOptions.map((t) => ({ value: String(t.id), label: t.name })),
    [transporterOptions]
  );

  const initialLogistics = useMemo(() => initialBulkImportLogistics(releases), [releases]);

  const [selectedReleaseRef, setSelectedReleaseRef] = useState(initialLogistics.releaseRef);
  const [selectedParkId, setSelectedParkId] = useState(initialLogistics.parkId);
  const [selectedTransporterId, setSelectedTransporterId] = useState(initialLogistics.transporterId);
  const [pastedText, setPastedText] = useState("");
  const [userActions, setUserActions] = useState({});

  const logisticsComplete = Boolean(selectedReleaseRef && selectedParkId && selectedTransporterId);

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

  function handleReleaseSelect(releaseRef) {
    setSelectedReleaseRef(releaseRef);
    setUserActions({});
    if (!releaseRef) {
      setSelectedParkId("");
      setSelectedTransporterId("");
      return;
    }
    const release = releases.find((r) => r.releaseRef === releaseRef);
    const { parkId, transporterId } = prefillParkTransporterFromRelease(release);
    setSelectedParkId(parkId);
    setSelectedTransporterId(transporterId);
  }

  function setRowAction(rowKey, action) {
    setUserActions((prev) => ({ ...prev, [rowKey]: action }));
  }

  function handleApply() {
    if (!logisticsComplete || plan.blocked || plan.toApply === 0) return;

    const logistics = {
      releaseRef: selectedReleaseRef,
      emptyContainerParkId: selectedParkId,
      transporterId: selectedTransporterId,
    };

    const updated = applyBulkImport({
      containers,
      planRows: plan.rows,
      selectedRelease: logistics,
      containerNumberField,
      lookupOptions: { containerParkOptions, transporterOptions },
    });
    onApply?.(updated, plan.rows.filter((row) => row.action !== "skip" && row.targetSlotId), logistics);
  }

  if (!open) return null;

  const canImport = logisticsComplete && !plan.blocked && plan.toApply > 0 && !isApplying;
  const hasReleases = releases.length > 0;
  const logisticsDisabled = !hasReleases || isApplying || isLoadingReleases;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="Close dialog"
        onClick={() => !isApplying && onClose?.()}
      />
      <div
        role="dialog"
        aria-modal="true"
        className="relative flex max-h-[min(90vh,720px)] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-900">Bulk import container numbers</h2>
          <button
            type="button"
            className="rounded-md px-2 py-1 text-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            onClick={() => !isApplying && onClose?.()}
          >
            ×
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
          {isLoadingReleases ? (
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
              Loading releases…
            </div>
          ) : null}
          {!isLoadingReleases && !hasReleases ? (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              No releases are available. Add releases in Shipping Details or on this pack first.
            </div>
          ) : null}

          <div className="space-y-2">
            <p className="text-[10px] text-slate-500">
              Select the release, empty container park, and transporter before pasting container numbers.
            </p>
            <div className="grid gap-3 md:grid-cols-3">
              <LogisticsField label="Release">
                <ClutchSelect
                  placeholder="- Select release -"
                  options={releaseSelectOptions}
                  value={releaseSelectOptions.find((o) => o.value === selectedReleaseRef) ?? null}
                  isDisabled={logisticsDisabled}
                  onChange={(option) => handleReleaseSelect(option ? option.value : "")}
                />
              </LogisticsField>
              <LogisticsField label="Empty Container Park">
                <ClutchSelect
                  placeholder="Empty Container Park"
                  options={parkSelectOptions}
                  value={parkSelectOptions.find((o) => String(o.value) === String(selectedParkId)) ?? null}
                  isDisabled={logisticsDisabled}
                  onChange={(option) => setSelectedParkId(option ? String(option.value) : "")}
                />
              </LogisticsField>
              <LogisticsField label="Transporter">
                <ClutchSelect
                  placeholder="Select Transporter"
                  options={transporterSelectOptions}
                  value={transporterSelectOptions.find((o) => String(o.value) === String(selectedTransporterId)) ?? null}
                  isDisabled={logisticsDisabled}
                  onChange={(option) => setSelectedTransporterId(option ? String(option.value) : "")}
                />
              </LogisticsField>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">
              Container numbers
            </label>
            <textarea
              className={cn(fieldClass, "min-h-[120px] resize-y font-mono")}
              value={pastedText}
              disabled={!logisticsComplete || isApplying || isLoadingReleases}
              placeholder={"Paste one container number per line\nABCU1234567\nMSCU7654321"}
              onChange={(e) => {
                setPastedText(e.target.value);
                setUserActions({});
              }}
            />
            <p className="text-[10px] text-slate-500">One per line, or separated by commas or tabs.</p>
          </div>

          {plan.duplicateNumbers.length ? (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Duplicate numbers in paste (only first occurrence imported):{" "}
              {plan.duplicateNumbers.join(", ")}
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
              <table className="w-full min-w-[640px] text-left text-xs">
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
                          {
                            value: "overwrite",
                            label: `Overwrite slot #${row.conflictSlotOrder}`,
                          },
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
                          {hasConflict && row.action === "skip"
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

          {applyProgress ? (
            <div className="text-xs font-medium text-slate-600">{applyProgress}</div>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center justify-end gap-2 border-t border-slate-100 px-4 py-3">
          <Button type="button" variant="secondary" disabled={isApplying} onClick={() => onClose?.()}>
            Cancel
          </Button>
          <Button type="button" disabled={!canImport} onClick={handleApply}>
            {isApplying ? "Importing…" : `Import ${plan.toApply} container${plan.toApply === 1 ? "" : "s"}`}
          </Button>
        </div>
      </div>
    </div>
  );
}
