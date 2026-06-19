"use client";

import { useCallback, useMemo, useState } from "react";

import ClutchSelect from "@/components/custom/ClutchSelect";
import { addCustomSeason, loadSeasonOptions, normalizeSeasonInput } from "@/lib/season-options";

export default function SeasonSelect({
  value = "",
  onChange,
  isDisabled = false,
  placeholder = "Select season...",
}) {
  const [options, setOptions] = useState(() => loadSeasonOptions(value));
  const [addError, setAddError] = useState("");

  const selected = useMemo(
    () => options.find((o) => o.value === value) ?? (value ? { value, label: value } : null),
    [options, value]
  );

  const refreshOptions = useCallback(
    (nextValue = value) => {
      setOptions(loadSeasonOptions(nextValue));
    },
    [value]
  );

  const handleAddNew = useCallback(
    (inputValue) => {
      const normalized = normalizeSeasonInput(inputValue);
      if (!normalized) {
        setAddError('Use format YYYY-YY (e.g. "2028-29").');
        return;
      }
      addCustomSeason(normalized);
      setAddError("");
      refreshOptions(normalized);
      onChange?.(normalized);
    },
    [onChange, refreshOptions]
  );

  return (
    <div>
      <ClutchSelect
        options={options}
        value={selected}
        isDisabled={isDisabled}
        placeholder={placeholder}
        onChange={(option) => {
          setAddError("");
          onChange?.(option ? option.value : "");
        }}
        addNew={{
          label: "➕ Add season",
          onAddNew: handleAddNew,
        }}
      />
      {addError ? <p className="mt-1 text-xs text-rose-600">{addError}</p> : null}
    </div>
  );
}
