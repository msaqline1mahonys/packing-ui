"use client";

import { Search, X } from "lucide-react";

import ClutchSelect from "@/components/custom/ClutchSelect";
import CustomDateRangePicker from "@/components/ui/custom-date-range-picker";
import { cn } from "@/lib/utils";

const DATE_FIELD_OPTIONS = [
  { value: "vesselCutoffDate", label: "Cut-off" },
  { value: "etd", label: "ETD" },
  { value: "packingStartDate", label: "Packing Start Date" },
];

const inputClass =
  "h-8 rounded border border-slate-200 bg-white px-2 text-[11px] text-slate-800 outline-none focus:border-brand/35 focus:ring-1 focus:ring-brand/10";

function dateModeButtonClass(active) {
  return cn(
    "inline-flex h-7 cursor-pointer items-center rounded px-2 text-[11px] font-medium leading-none transition-colors",
    active ? "bg-white text-brand-ink shadow-sm ring-1 ring-brand/15" : "text-slate-600 hover:text-slate-800"
  );
}

export function ScheduleFilterBar({
  title = "Packing Schedule",
  gridSearch,
  onGridSearchChange,
  onClearSearch,
  dateFilterMode,
  onDateFilterModeChange,
  dateFilterField,
  onDateFilterFieldChange,
  specificDate,
  onSpecificDateChange,
  dateRangeValue,
  onDateRangeChange,
}) {
  return (
    <div className="packing-schedule-filter-bar flex min-h-[48px] flex-wrap items-center gap-x-5 gap-y-2 border-b border-slate-200 bg-slate-50/90 px-3 py-2.5">
      <h1 className="shrink-0 text-[14px] font-semibold tracking-tight text-brand-ink">{title}</h1>

      <span className="mx-1 hidden h-5 w-px shrink-0 bg-brand/15 sm:block" aria-hidden />

      <label className="flex h-8 w-[280px] shrink-0 items-center gap-1.5 rounded border border-slate-200 bg-white px-2 sm:w-[320px] md:w-[360px]">
        <Search className="size-3.5 shrink-0 text-slate-400" aria-hidden />
        <input
          suppressHydrationWarning
          type="search"
          value={gridSearch}
          onChange={(e) => onGridSearchChange(e.target.value)}
          placeholder="Search..."
          aria-label="Search packing schedule"
          className="min-w-0 flex-1 border-0 bg-transparent text-[11px] leading-none text-slate-800 outline-none placeholder:text-slate-400"
        />
        {gridSearch ? (
          <button
            type="button"
            onClick={onClearSearch}
            className="shrink-0 text-slate-400 hover:text-slate-600"
            aria-label="Clear search"
          >
            <X className="size-3.5" />
          </button>
        ) : null}
      </label>

      <div className="ms-auto flex shrink-0 flex-wrap items-center justify-end gap-x-1.5 gap-y-1">
        <div className="inline-flex h-8 shrink-0 items-center gap-0.5 rounded border border-slate-200 bg-slate-50 p-0.5">
          <label className="cursor-pointer">
            <input
              suppressHydrationWarning
              type="radio"
              name="date-filter-mode"
              checked={dateFilterMode === "all"}
              onChange={() => onDateFilterModeChange("all")}
              className="sr-only"
            />
            <span className={dateModeButtonClass(dateFilterMode === "all")}>All Dates</span>
          </label>
          <label className="cursor-pointer">
            <input
              suppressHydrationWarning
              type="radio"
              name="date-filter-mode"
              checked={dateFilterMode === "specific"}
              onChange={() => onDateFilterModeChange("specific")}
              className="sr-only"
            />
            <span className={dateModeButtonClass(dateFilterMode === "specific")}>By Date</span>
          </label>
          <label className="cursor-pointer">
            <input
              suppressHydrationWarning
              type="radio"
              name="date-filter-mode"
              checked={dateFilterMode === "range"}
              onChange={() => onDateFilterModeChange("range")}
              className="sr-only"
            />
            <span className={dateModeButtonClass(dateFilterMode === "range")}>Range</span>
          </label>
        </div>

        {dateFilterMode === "specific" || dateFilterMode === "range" ? (
          <>
            <ClutchSelect
              compact
              className="w-[100px] shrink-0"
              isClearable={false}
              options={DATE_FIELD_OPTIONS}
              value={DATE_FIELD_OPTIONS.find((o) => String(o.value) === String(dateFilterField)) ?? null}
              onChange={(option) => onDateFilterFieldChange(option ? option.value : "vesselCutoffDate")}
              aria-label="Select date filter field"
            />
            {dateFilterMode === "specific" ? (
              <input
                suppressHydrationWarning
                className={`${inputClass} w-[116px] shrink-0`}
                type="date"
                value={specificDate}
                onChange={(e) => onSpecificDateChange(e.target.value)}
                aria-label="Specific date"
              />
            ) : (
              <div className="w-[168px] shrink-0">
                <CustomDateRangePicker compact value={dateRangeValue} onChange={onDateRangeChange} />
              </div>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}
