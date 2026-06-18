import { AlertCircle } from "lucide-react";

import { cn } from "@/lib/utils";

function BtnPrimary({ className, children, ...props }) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex items-center rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function AccountingPriceSaveToolbar({ unsavedCount, saving, savedIndicator, onSave, className }) {
  return (
    <div className={cn("flex shrink-0 flex-wrap items-center justify-end gap-3", className)}>
      {unsavedCount > 0 ? (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold text-amber-800 ring-1 ring-amber-300">
          <AlertCircle className="size-3 shrink-0" aria-hidden />
          {unsavedCount} unsaved {unsavedCount === 1 ? "change" : "changes"}
        </span>
      ) : null}
      {savedIndicator ? (
        <span className="text-xs font-medium text-emerald-600">Saved successfully.</span>
      ) : null}
      <BtnPrimary onClick={onSave} disabled={saving || unsavedCount === 0}>
        {saving ? "Saving…" : "Save"}
      </BtnPrimary>
    </div>
  );
}
