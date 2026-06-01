"use client";

import { cn } from "@/lib/utils";

export function StatusFilterBar({
  label = "Filter by Status",
  statuses,
  selectedStatuses,
  onSelectedStatusesChange,
}) {
  const allSelected = selectedStatuses.length === statuses.length;
  const noneSelected = selectedStatuses.length === 0;

  function toggleStatus(status) {
    onSelectedStatusesChange(
      selectedStatuses.includes(status)
        ? selectedStatuses.filter((value) => value !== status)
        : [...selectedStatuses, status]
    );
  }

  return (
    <div className="mt-3 border-t border-slate-200 pt-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {statuses.map((status) => {
              const selected = selectedStatuses.includes(status);
              return (
                <button
                  key={status}
                  type="button"
                  onClick={() => toggleStatus(status)}
                  className={cn(
                    "inline-flex h-7 cursor-pointer items-center rounded-md border px-2.5 text-[11px] font-medium transition-colors",
                    selected
                      ? "border-brand/30 bg-brand/15 text-brand-ink shadow-sm"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-800"
                  )}
                >
                  {status}
                </button>
              );
            })}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2 text-[11px] font-medium">
          <button
            type="button"
            disabled={allSelected}
            onClick={() => onSelectedStatusesChange([...statuses])}
            className="cursor-pointer text-brand hover:text-brand/80 disabled:cursor-not-allowed disabled:text-slate-300"
          >
            Select All
          </button>
          <span className="text-slate-300">|</span>
          <button
            type="button"
            disabled={noneSelected}
            onClick={() => onSelectedStatusesChange([])}
            className="cursor-pointer text-brand hover:text-brand/80 disabled:cursor-not-allowed disabled:text-slate-300"
          >
            Deselect All
          </button>
        </div>
      </div>
    </div>
  );
}
