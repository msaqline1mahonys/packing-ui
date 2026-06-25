import { cn } from "@/lib/utils";

export const formInputClass =
  "w-full rounded-lg border border-slate-200/95 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-brand/15 placeholder:text-slate-400 focus:border-brand/35 focus:ring-2";

export const formInputErrorClass =
  "border-red-400 bg-red-50/40 ring-red-100 focus:border-red-500 focus:ring-red-200";

export const formLabelClass =
  "text-[11px] font-semibold uppercase tracking-wide text-slate-600";

export const formLabelErrorClass = "text-red-600";

export const formFieldErrorTextClass = "text-[11px] text-red-600";

export function inputClassName(hasError, className) {
  return cn(formInputClass, hasError && formInputErrorClass, className);
}
