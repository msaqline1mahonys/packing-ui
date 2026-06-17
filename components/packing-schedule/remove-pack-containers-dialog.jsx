"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  containerMayHaveStockTransactions,
  describeContainerSlot,
} from "@/lib/pack-container-sync";

export default function RemovePackContainersDialog({
  open,
  containers = [],
  requiredCount = null,
  error = "",
  saving = false,
  onClose,
  onConfirm,
}) {
  const [selected, setSelected] = useState(() => new Set());

  useEffect(() => {
    if (!open) return;
    setSelected(new Set());
  }, [open, containers]);

  const rows = useMemo(
    () => (containers || []).map((container, index) => describeContainerSlot(container, index)),
    [containers]
  );

  const selectedIds = useMemo(() => Array.from(selected), [selected]);
  const selectedWithTransactions = useMemo(
    () =>
      containers.filter(
        (container) => selected.has(String(container.id)) && containerMayHaveStockTransactions(container)
      ),
    [containers, selected]
  );

  const selectionValid =
    requiredCount == null
      ? selectedIds.length > 0
      : selectedIds.length === requiredCount;

  if (!open) return null;

  function toggle(id) {
    const key = String(id);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <button type="button" className="absolute inset-0 bg-black/40" aria-label="Close dialog" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="remove-containers-title"
        className="relative flex max-h-[min(92vh,720px)] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"
      >
        <div className="border-b border-slate-100 px-4 py-3">
          <h2 id="remove-containers-title" className="text-sm font-semibold text-slate-900">
            Remove containers from pack
          </h2>
          <p className="mt-1 text-xs text-slate-600">
            {requiredCount != null
              ? `Select exactly ${requiredCount} container slot${requiredCount === 1 ? "" : "s"} to remove.`
              : "Select the container slots you want to remove from this pack."}
          </p>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3">
          {error ? (
            <div className="mb-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-600">{error}</div>
          ) : null}

          {selectedWithTransactions.length ? (
            <div className="mb-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              {selectedWithTransactions.length} selected container
              {selectedWithTransactions.length === 1 ? " has" : "s have"} stock transactions linked. Reversal
              transactions will be created when removed.
            </div>
          ) : null}

          <div className="space-y-1.5">
            {rows.map((row) => {
              const checked = selected.has(String(row.id));
              return (
                <label
                  key={row.id}
                  className={`flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 ${
                    checked ? "border-brand/40 bg-brand/5" : "border-slate-200 bg-white hover:bg-slate-50"
                  }`}
                >
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={checked}
                    onChange={() => toggle(row.id)}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-slate-900">
                      Position {row.order}
                      {row.number ? ` · ${row.number}` : ""}
                    </span>
                    <span className="block text-xs text-slate-500">{row.summary}</span>
                  </span>
                </label>
              );
            })}
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-4 py-3">
          <p className="text-xs text-slate-500">
            {selectedIds.length} selected
            {requiredCount != null ? ` · ${requiredCount} required` : ""}
          </p>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={!selectionValid || saving}
              onClick={() => onConfirm(selectedIds)}
            >
              {saving ? "Removing…" : "Remove selected"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
