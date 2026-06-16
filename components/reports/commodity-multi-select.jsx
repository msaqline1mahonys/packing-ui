"use client";

import { MultiSelectCombobox } from "@/components/reports/multi-select-combobox";
import { commodityOptionLabel } from "@/lib/commodity-display";

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
      getLabel={commodityOptionLabel}
      getMeta={(c) => c.description || ""}
      placeholder="Select commodities..."
      searchPlaceholder="Filter commodities..."
      emptyMeansAll={allowEmpty}
      allLabel={emptyLabel}
    />
  );
}
