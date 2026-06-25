import { commodityOptionLabel } from "@/lib/commodity-display";
import { formInputErrorClass, formLabelErrorClass } from "@/lib/form-styles";
import { cn } from "@/lib/utils";

export const inputClass =
  "w-full rounded-md border border-slate-200/95 bg-white px-2.5 py-1.5 text-sm text-slate-900 outline-none ring-brand/15 placeholder:text-slate-400 focus:border-brand/35 focus:ring-2";

export function controlClassName(baseClass, hasError) {
  return cn(baseClass, hasError && formInputErrorClass);
}

export function Field({ label, required, hint, hasError = false, children }) {
  return (
    <div className="space-y-0.5">
      <label
        className={cn(
          "text-[10px] font-semibold uppercase tracking-wide",
          hasError ? formLabelErrorClass : "text-slate-600"
        )}
      >
        {label}
        {required ? <span className="text-red-500"> *</span> : null}
        {hint ? <span className="ml-1 font-normal normal-case text-slate-400">({hint})</span> : null}
      </label>
      {children}
    </div>
  );
}

export function ErrorText({ children }) {
  return <p className="mt-0.5 text-[10px] font-semibold text-red-500">{children}</p>;
}

export function WarningText({ children }) {
  return (
    <div className="rounded-md border border-amber-200 bg-amber-50 px-2.5 py-2 text-[11px] font-medium text-amber-900">
      {children}
    </div>
  );
}

export function qtyColor(q) {
  return q < 0 ? "text-red-600" : "text-emerald-700";
}

export function SummaryRow({ label, value, color }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-slate-500">{label}</span>
      <span className={cn("text-right font-semibold text-slate-900", color)}>{value || "-"}</span>
    </div>
  );
}

export function commodityLabel(c) {
  return commodityOptionLabel(c);
}

export function nowDatetimeLocalDate() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}
