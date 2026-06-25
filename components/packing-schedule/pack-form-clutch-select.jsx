"use client";

import ClutchSelect from "@/components/custom/ClutchSelect";
import { packFormQuickAdd } from "@/lib/pack-form-quick-add";

/**
 * ClutchSelect with optional quick-add row for pack schedule form lookups.
 * @param {string} [quickAdd] - key from PACK_FORM_QUICK_ADD (opens admin page in new tab)
 */
export default function PackFormClutchSelect({ quickAdd, ...props }) {
  return <ClutchSelect {...props} {...(quickAdd ? packFormQuickAdd(quickAdd) : {})} />;
}
