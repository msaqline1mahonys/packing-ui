"use client";

import ClutchSelect from "@/components/custom/ClutchSelect";
import { getQuickAddLabel, quickAddCreatedOption } from "@/lib/pack-form-quick-add-config";
import { usePackFormQuickAddOptional } from "@/components/packing-schedule/pack-form-quick-add-provider";

/**
 * ClutchSelect with optional quick-add row for pack schedule form lookups.
 * @param {string} [quickAdd] - key from PACK_FORM_QUICK_ADD_CONFIG
 */
export default function PackFormClutchSelect({ quickAdd, onChange, ...props }) {
  const quickAddCtx = usePackFormQuickAddOptional();
  const addNewProps =
    quickAdd && quickAddCtx
      ? {
          addNew: {
            label: getQuickAddLabel(quickAdd),
            onAddNew: () =>
              quickAddCtx.openQuickAdd(quickAdd, {
                onCreated: (created) => {
                  const option = quickAddCreatedOption(quickAdd, created);
                  if (option && onChange) onChange(option);
                },
              }),
          },
        }
      : {};
  return <ClutchSelect {...props} onChange={onChange} {...addNewProps} />;
}
