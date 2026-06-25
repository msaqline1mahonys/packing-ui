"use client";

import { formLabelClass, formLabelErrorClass, formFieldErrorTextClass } from "@/lib/form-styles";
import { cn } from "@/lib/utils";

/** Stacked label + control row used on contact and accounting forms. */
export default function FormRow({ label, required = false, hasError = false, children }) {
  return (
    <div className="space-y-1.5">
      <label className={cn(formLabelClass, hasError && formLabelErrorClass)}>
        {label}
        {required ? <span className="text-red-500"> *</span> : null}
      </label>
      {children}
      {hasError ? <p className={formFieldErrorTextClass}>Required</p> : null}
    </div>
  );
}
