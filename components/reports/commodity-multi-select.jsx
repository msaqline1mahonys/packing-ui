"use client";

import { MultiSelectCombobox } from "@/components/reports/multi-select-combobox";

/**
 * Thin wrapper around MultiSelectCombobox configured for commodities.
 * Empty selection means "all commodities" (the report includes every commodity
 * the customer has activity in).
 */
export function CommodityMultiSelect({ commodities, value = [], onChange, allowEmpty = true, emptyLabel = "All commodities" }) {
  return (
    <MultiSelectCombobox
      options={commodities}
      value={value}
      onChange={onChange}
      getId={(c) => c.id}
      getLabel={(c) => c.description}
      getMeta={(c) => c.commodityCode || ""}
      placeholder="Select commodities..."
      searchPlaceholder="Filter commodities..."
      emptyMeansAll={allowEmpty}
      allLabel={emptyLabel}
    />
  );
}
