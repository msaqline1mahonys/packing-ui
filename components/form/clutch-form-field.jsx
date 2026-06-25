"use client";

import ClutchSelect, { toOptions } from "@/components/custom/ClutchSelect";
import { inputClassName, formLabelClass, formLabelErrorClass, formFieldErrorTextClass } from "@/lib/form-styles";
import { numberInputProps } from "@/lib/number-input";
import { cn } from "@/lib/utils";

/**
 * Config-driven form field used across reference data, product settings, and shipping screens.
 * Pass `hasError` after a failed save to highlight missing required values.
 */
export default function ClutchFormField({
  field,
  value,
  onChange,
  disabled = false,
  hasError = false,
}) {
  if (field.type === "section") {
    return (
      <div className="sm:col-span-2 border-t border-slate-200 pt-3 mt-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-700">{field.label}</p>
      </div>
    );
  }

  const options = field.options ?? [];
  const resolvedValue = value ?? "";

  return (
    <div
      className={cn(
        "space-y-1",
        field.wide && "sm:col-span-2",
        field.type === "textarea" && "sm:col-span-2"
      )}
    >
      <label
        className={cn(formLabelClass, hasError && formLabelErrorClass)}
      >
        {field.label}
        {field.required ? <span className="text-red-500"> *</span> : null}
      </label>

      {field.type === "select" ? (
        <ClutchSelect
          options={toOptions(options)}
          value={
            toOptions(options).find((o) => String(o.value) === String(resolvedValue)) ?? null
          }
          onChange={(option) => onChange(option ? option.value : "")}
          isDisabled={disabled}
          placeholder="Select..."
          error={hasError ? "Required" : undefined}
        />
      ) : field.type === "textarea" ? (
        <textarea
          suppressHydrationWarning
          className={inputClassName(hasError, "min-h-20 resize-y")}
          value={resolvedValue}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          placeholder={field.placeholder}
          rows={3}
        />
      ) : (
        <input
          suppressHydrationWarning
          type={field.type || "text"}
          className={inputClassName(hasError)}
          value={resolvedValue}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          placeholder={field.placeholder}
          {...numberInputProps(field.type)}
        />
      )}

      {hasError && field.type !== "select" ? (
        <p className={formFieldErrorTextClass}>Required</p>
      ) : null}
    </div>
  );
}
