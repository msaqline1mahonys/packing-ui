"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import PackFormClutchSelect from "@/components/packing-schedule/pack-form-clutch-select";
import { fetchVesselVoyageById, fetchVesselVoyagesList } from "@/lib/api/reference-data";
import { buildVesselVoyageSelectOption } from "@/lib/vessel-voyage-select";

/**
 * Server-side searchable vessel voyage picker for the pack form.
 * Options include terminal, operator, and port so duplicate vessel+voyage rows are distinguishable.
 */
export default function VesselVoyageSelect({
  value,
  onChange,
  onVoyageChange,
  isImportJob = false,
  fallbackVoyage = null,
  quickAdd = "vesselVoyage",
  placeholder = "- Select vessel -",
  className,
}) {
  const [options, setOptions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const requestIdRef = useRef(0);
  const resolvedValueRef = useRef(null);

  const mergeOption = useCallback((option) => {
    if (!option) return;
    setOptions((prev) => {
      if (prev.some((row) => String(row.value) === String(option.value))) return prev;
      return [option, ...prev];
    });
  }, []);

  const loadOptions = useCallback(
    async (search) => {
      const requestId = ++requestIdRef.current;
      setIsLoading(true);
      try {
        const trimmed = String(search || "").trim();
        const rows = await fetchVesselVoyagesList({
          search: trimmed,
          perPage: trimmed ? 500 : 100,
        });
        if (requestId !== requestIdRef.current) return;

        const nextOptions = rows
          .map((row) => buildVesselVoyageSelectOption(row, { isImportJob }))
          .filter(Boolean);

        setOptions((prev) => {
          const selected = prev.find((row) => value && String(row.value) === String(value));
          if (selected && !nextOptions.some((row) => String(row.value) === String(selected.value))) {
            return [selected, ...nextOptions];
          }
          return nextOptions;
        });
      } catch {
        if (requestId === requestIdRef.current) setOptions([]);
      } finally {
        if (requestId === requestIdRef.current) setIsLoading(false);
      }
    },
    [isImportJob, value],
  );

  useEffect(() => {
    const delayMs = searchInput.trim() ? 300 : 0;
    const timer = window.setTimeout(() => {
      loadOptions(searchInput);
    }, delayMs);
    return () => window.clearTimeout(timer);
  }, [searchInput, loadOptions]);

  useEffect(() => {
    if (!value) {
      resolvedValueRef.current = null;
      return;
    }
    if (resolvedValueRef.current && String(resolvedValueRef.current.id) === String(value)) {
      mergeOption(buildVesselVoyageSelectOption(resolvedValueRef.current, { isImportJob }));
      return;
    }
    if (fallbackVoyage && String(fallbackVoyage.id) === String(value)) {
      resolvedValueRef.current = fallbackVoyage;
      mergeOption(buildVesselVoyageSelectOption(fallbackVoyage, { isImportJob }));
      onVoyageChange?.(fallbackVoyage);
      return;
    }

    let cancelled = false;
    fetchVesselVoyageById(value)
      .then((voyage) => {
        if (cancelled || !voyage) return;
        resolvedValueRef.current = voyage;
        mergeOption(buildVesselVoyageSelectOption(voyage, { isImportJob }));
        onVoyageChange?.(voyage);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [value, fallbackVoyage, isImportJob, mergeOption, onVoyageChange]);

  const selectedOption = useMemo(() => {
    if (!value) return null;
    return options.find((row) => String(row.value) === String(value)) ?? null;
  }, [options, value]);

  return (
    <PackFormClutchSelect
      quickAdd={quickAdd}
      className={className}
      placeholder={placeholder}
      options={options}
      value={selectedOption}
      isLoading={isLoading}
      filterOption={() => true}
      onInputChange={(nextValue, meta) => {
        if (meta.action === "input-change") setSearchInput(nextValue);
      }}
      onChange={(option) => {
        const voyage = option?.voyage ?? null;
        if (voyage) {
          resolvedValueRef.current = voyage;
          onVoyageChange?.(voyage);
        } else if (!option) {
          resolvedValueRef.current = null;
          onVoyageChange?.(null);
        }
        onChange?.(option);
      }}
    />
  );
}
