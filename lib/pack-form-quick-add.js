/**
 * Quick-add for pack schedule form lookups — opens modals via PackFormQuickAddProvider.
 */

import { getQuickAddLabel } from "@/lib/pack-form-quick-add-config";

export { getQuickAddLabel, PACK_FORM_QUICK_ADD_CONFIG } from "@/lib/pack-form-quick-add-config";

let quickAddHandler = null;

export function registerPackFormQuickAdd(handler) {
  quickAddHandler = handler;
}

export function openPackFormQuickAdd(entityKey) {
  quickAddHandler?.(entityKey);
}

export function packFormQuickAdd(entityKey) {
  return {
    addNew: {
      label: getQuickAddLabel(entityKey),
      onAddNew: () => openPackFormQuickAdd(entityKey),
    },
  };
}
