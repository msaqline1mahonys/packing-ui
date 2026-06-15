"use client";

import ClutchSelect from "@/components/custom/ClutchSelect";
import { cn } from "@/lib/utils";

import { useSite } from "./site-context";

/**
 * Active site selector — options come from login `allowed_sites`; switching
 * calls the backend and refreshes tenant-scoped data. Standardized on
 * ClutchSelect; site must always hold a value so it is not clearable.
 */
export function SiteSelect({ selectId, className }) {
  const { sites, siteId, setSiteId, isSwitching } = useSite();

  if (!sites?.length) return null;

  const options = sites.map((s) => ({ value: s.id, label: s.label }));
  const value = options.find((o) => String(o.value) === String(siteId)) ?? null;

  return (
    <ClutchSelect
      inputId={selectId ?? "erp-site"}
      aria-label="Site"
      className={cn("w-[11rem] sm:w-[13rem]", className)}
      options={options}
      value={value}
      onChange={(option) => option && setSiteId(option.value)}
      isDisabled={isSwitching}
      isClearable={false}
      placeholder="Select site"
    />
  );
}
