"use client";

import { formLabelClass, formLabelErrorClass, formFieldErrorTextClass } from "@/lib/form-styles";
import { cn } from "@/lib/utils";

/** Label wrapper for hand-built modal fields (fumigation, contact, etc.). */
export default function LabeledField({
  label,
  required = false,
  wide = false,
  hasError = false,
  children,
}) {
  return (
    <div className={cn("space-y-1", wide && "sm:col-span-2")}>
      <label className={cn(formLabelClass, hasError && formLabelErrorClass)}>
        {label}
        {required ? <span className="text-red-500"> *</span> : null}
      </label>
      {children}
      {hasError ? <p className={formFieldErrorTextClass}>Required</p> : null}
    </div>
  );
}
