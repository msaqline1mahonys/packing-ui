import { commodityOptionLabel } from "@/lib/commodity-display";
import { cn } from "@/lib/utils";

export const inputClass =
  "w-full rounded-md border border-slate-200/95 bg-white px-2.5 py-1.5 text-sm text-slate-900 outline-none ring-brand/15 placeholder:text-slate-400 focus:border-brand/35 focus:ring-2";

export function Field({ label, required, hint, children }) {
  return (
    <div className="space-y-0.5">
      <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-600">
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
