"use client";

import { useId, useMemo, useState } from "react";
import Select from "react-select";

import { cn } from "@/lib/utils";

/**
 * ClutchSelect — the app's standard single/multi pick control.
 *
 * A thin, themed wrapper around `react-select`. It keeps react-select's native
 * API (`{ label, value }` options, `onChange(selected, meta)` signature,
 * `isMulti`, `isLoading`, `menuPlacement`, `filterOption`, …) and layers on the
 * conventions this app needs:
 *
 *   - an optional bold label above the control, with a red asterisk when `required`
 *   - brand-themed control / focus ring / option states (var(--brand))
 *   - an "Add New" synthetic option that fires a callback (e.g. open a modal)
 *     instead of mutating the selection, with the current search text passed in
 *   - a two-column "asset" option row (registration left, fleet code right)
 *   - customer-style "match from the start of words" filtering
 *   - `searchLabel` per option so options can match on more text than they show
 *
 * Options are the standard react-select shape:
 *   { label, value, searchLabel?, subLabel?, isDisabled? }
 *
 * @param {object}   props
 * @param {string}   [props.label]            bold label rendered above the control
 * @param {boolean}  [props.required]         show a red asterisk after the label
 * @param {string}   [props.name]             field name (forwarded to react-select)
 * @param {*}        [props.value]            selected option object(s) (controlled)
 * @param {Function} [props.onChange]         react-select onChange(selected, meta)
 * @param {Array}    [props.options]          option list
 * @param {string}   [props.placeholder]      defaults to "Select..."
 * @param {boolean}  [props.isMulti]          allow multiple values
 * @param {boolean}  [props.isClearable]      show the clear (X) affordance — default true
 * @param {boolean}  [props.isSearchable]     type-to-filter — default true
 * @param {boolean}  [props.isLoading]        show the loading state
 * @param {boolean}  [props.isDisabled]       disable the control
 * @param {"top"|"bottom"|"auto"} [props.menuPlacement] default "bottom"
 * @param {Function} [props.onFocus]          often used to lazy-load options
 * @param {boolean}  [props.filterFromStart]  match from the start of words (customer style)
 * @param {Function} [props.filterOption]     full override of react-select filtering
 * @param {Function} [props.formatOptionLabel] full override of option rendering
 * @param {object}   [props.addNew]           { label, onAddNew(inputValue) }; the
 *                                            chosen row runs the callback and does
 *                                            NOT update the parent value
 * @param {string}   [props.className]        wrapper class
 * @param {string}   [props.error]            error text shown under the control
 * @param {boolean}  [props.menuPortal]       portal the menu to <body> — default true
 *                                            (avoids clipping inside overflow-hidden modals)
 */
export default function ClutchSelect({
  label,
  required = false,
  name,
  value,
  onChange,
  options = [],
  placeholder = "Select...",
  isMulti = false,
  isClearable = true,
  isSearchable = true,
  isLoading = false,
  isDisabled = false,
  menuPlacement = "bottom",
  onFocus,
  filterFromStart = false,
  filterOption,
  formatOptionLabel,
  addNew,
  className,
  error,
  menuPortal = true,
  compact = false,
  inputId: inputIdProp,
  ...rest
}) {
  const generatedId = useId();
  const inputId = inputIdProp ?? `clutch-select-${generatedId}`;
  const [inputValue, setInputValue] = useState("");

  const ADD_NEW_VALUE = "__clutch_add_new__";

  // Inject the synthetic "Add New" row at the top when configured.
  const computedOptions = useMemo(() => {
    if (!addNew) return options;
    return [
      { label: addNew.label ?? "➕ Add New", value: ADD_NEW_VALUE, __isAddNew: true },
      ...options,
    ];
  }, [options, addNew]);

  // Default filtering: substring on label/value/searchLabel, or "from the start
  // of words" when filterFromStart is set. The Add New row always stays visible.
  const computedFilterOption = useMemo(() => {
    if (filterOption) return filterOption;
    return (candidate, rawInput) => {
      if (candidate.data?.__isAddNew) return true;
      const input = (rawInput || "").trim().toLowerCase();
      if (!input) return true;
      const haystack = `${candidate.data?.searchLabel ?? candidate.label ?? ""} ${candidate.value ?? ""}`.toLowerCase();
      if (filterFromStart) {
        return haystack.split(/\s+/).some((word) => word.startsWith(input));
      }
      return haystack.includes(input);
    };
  }, [filterOption, filterFromStart]);

  // Built-in option rendering: bold Add New row, and the two-column asset row
  // when an option carries `subLabel`. Caller-supplied formatOptionLabel wins.
  const computedFormatOptionLabel = formatOptionLabel ?? defaultFormatOptionLabel;

  function handleChange(selected, meta) {
    // Selecting the synthetic row runs the callback with the current search
    // text and intentionally leaves the parent value untouched.
    if (addNew) {
      const picked = isMulti
        ? (Array.isArray(selected) ? selected.find((o) => o?.__isAddNew) : null)
        : (selected?.__isAddNew ? selected : null);
      if (picked) {
        addNew.onAddNew?.(inputValue);
        return;
      }
    }
    onChange?.(selected, meta);
  }

  return (
    <div className={cn("w-full", className)}>
      {label ? (
        <label htmlFor={inputId} className="mb-1 block text-sm font-bold text-gray-700">
          {label}
          {required ? <span className="text-red-500"> *</span> : null}
        </label>
      ) : null}

      <Select
        inputId={inputId}
        instanceId={inputId}
        name={name}
        value={value}
        onChange={handleChange}
        options={computedOptions}
        placeholder={placeholder}
        isMulti={isMulti}
        isClearable={isClearable}
        isSearchable={isSearchable}
        isLoading={isLoading}
        isDisabled={isDisabled}
        menuPlacement={menuPlacement}
        onFocus={onFocus}
        onInputChange={(v, meta) => {
          // Keep our own copy of the search text for the Add New callback,
          // but don't fight react-select's internal input handling.
          if (meta.action === "input-change") setInputValue(v);
          return v;
        }}
        filterOption={computedFilterOption}
        formatOptionLabel={computedFormatOptionLabel}
        classNamePrefix="clutch-select"
        menuPortalTarget={menuPortal && typeof document !== "undefined" ? document.body : undefined}
        styles={selectStyles(Boolean(error), compact)}
        {...rest}
      />

      {error ? <p className="mt-1 text-xs text-red-500">{error}</p> : null}
    </div>
  );
}

/* Default option renderer: bold Add New row; two-column asset row (label left,
 * subLabel muted right) when an option carries `subLabel`; plain label otherwise. */
function defaultFormatOptionLabel(option) {
  if (option.__isAddNew) {
    return <span className="font-bold text-brand">{option.label}</span>;
  }
  if (option.subLabel) {
    return (
      <span className="flex items-center justify-between gap-3">
        <span className="truncate">{option.label}</span>
        <span className="shrink-0 text-xs text-slate-400">{option.subLabel}</span>
      </span>
    );
  }
  return option.label;
}

/* Brand-themed react-select style overrides. Colors come from the app's CSS
 * custom properties (var(--brand) = #0070ff) so this control tracks the theme. */
function selectStyles(hasError, compact = false) {
  const BRAND = "var(--brand, #0070ff)";
  const RING = "color-mix(in srgb, var(--brand, #0070ff) 15%, transparent)";
  return {
    control: (base, state) => ({
      ...base,
      minHeight: compact ? 28 : 36,
      height: compact ? 28 : undefined,
      backgroundColor: "#fff",
      borderRadius: compact ? 6 : 8,
      fontSize: compact ? "11px" : "0.875rem",
      borderColor: hasError
        ? "#ef4444"
        : state.isFocused
          ? "color-mix(in srgb, var(--brand, #0070ff) 35%, transparent)"
          : "#e2e8f0",
      boxShadow: state.isFocused ? `0 0 0 2px ${RING}` : "none",
      transition: "border-color 120ms ease, box-shadow 120ms ease",
      "&:hover": { borderColor: state.isFocused ? BRAND : "#cbd5e1" },
    }),
    valueContainer: (base) => ({ ...base, padding: compact ? "0 6px" : "0 8px" }),
    placeholder: (base) => ({ ...base, color: "#94a3b8" }),
    input: (base) => ({ ...base, color: "#0f172a", margin: 0, padding: 0 }),
    singleValue: (base) => ({ ...base, color: "#0f172a" }),
    indicatorSeparator: (base) => ({ ...base, backgroundColor: "#e2e8f0" }),
    dropdownIndicator: (base, state) => ({
      ...base,
      padding: compact ? 4 : 6,
      color: state.isFocused ? BRAND : "#94a3b8",
      "&:hover": { color: BRAND },
    }),
    clearIndicator: (base) => ({ ...base, padding: compact ? 4 : 6, color: "#94a3b8", "&:hover": { color: "#64748b" } }),
    menu: (base) => ({
      ...base,
      borderRadius: 8,
      border: "1px solid #e2e8f0",
      boxShadow: "0 10px 30px -12px rgba(2, 6, 23, 0.25)",
      overflow: "hidden",
    }),
    menuPortal: (base) => ({ ...base, zIndex: 9999 }),
    option: (base, state) => ({
      ...base,
      fontSize: compact ? "11px" : "0.875rem",
      cursor: "pointer",
      color: state.isSelected ? "#fff" : "#334155",
      backgroundColor: state.isSelected
        ? BRAND
        : state.isFocused
          ? "color-mix(in srgb, var(--brand, #0070ff) 10%, transparent)"
          : "#fff",
      "&:active": { backgroundColor: "color-mix(in srgb, var(--brand, #0070ff) 20%, transparent)" },
    }),
    multiValue: (base) => ({
      ...base,
      backgroundColor: "color-mix(in srgb, var(--brand, #0070ff) 10%, transparent)",
      borderRadius: 6,
    }),
    multiValueLabel: (base) => ({ ...base, color: "var(--brand-ink, #003d99)", fontSize: "0.8rem" }),
    multiValueRemove: (base) => ({
      ...base,
      color: "var(--brand-ink, #003d99)",
      borderRadius: 6,
      "&:hover": { backgroundColor: "color-mix(in srgb, var(--brand, #0070ff) 20%, transparent)", color: "var(--brand-ink, #003d99)" },
    }),
  };
}

/* Convenience helpers for the common case of plain string options. */
export function toOption(value, label) {
  if (value == null) return null;
  return { value, label: label ?? String(value) };
}

export function toOptions(values = []) {
  return values.map((v) =>
    typeof v === "object" && v !== null ? v : { value: v, label: String(v) }
  );
}
