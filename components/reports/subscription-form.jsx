"use client";

import { useEffect, useMemo, useState } from "react";

import { CADENCE_LABELS } from "@/lib/reports-windows";
import { fetchCommodityDirectory, fetchCustomerDirectory } from "@/lib/reports-data";
import { Button } from "@/components/ui/button";
import { CommodityMultiSelect } from "@/components/reports/commodity-multi-select";
import { MultiSelectCombobox } from "@/components/reports/multi-select-combobox";
import { RecipientPicker } from "@/components/reports/recipient-picker";

export function SubscriptionForm({ open, cadence, initial, onCancel, onSave }) {
  const [customers, setCustomers] = useState([]);
  const [commodities, setCommodities] = useState([]);

  useEffect(() => {
    fetchCustomerDirectory().then(setCustomers);
    fetchCommodityDirectory().then(setCommodities);
  }, []);

  const allCustomerIds = useMemo(() => customers.map((c) => c.id), [customers]);

  function resolveInitialCustomerIds() {
    if (!initial) return allCustomerIds;
    if (Array.isArray(initial.customerIds) && initial.customerIds.length > 0) {
      return [...initial.customerIds];
    }
    // backward compat: single customerId from old subscriptions
    if (initial.customerId != null) return [initial.customerId];
    return allCustomerIds;
  }

  const [customerIds, setCustomerIds] = useState(resolveInitialCustomerIds);
  const [commodityIds, setCommodityIds] = useState(initial?.commodityIds ?? []);
  const [recipientEmails, setRecipientEmails] = useState(initial?.recipientEmails ?? []);
  const [enabled, setEnabled] = useState(initial?.enabled !== false);

  useEffect(() => {
    if (open) {
      setCustomerIds(resolveInitialCustomerIds());
      setCommodityIds(initial?.commodityIds ?? []);
      setRecipientEmails(initial?.recipientEmails ?? []);
      setEnabled(initial?.enabled !== false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initial]);

  if (!open) return null;

  const canSave = customerIds.length > 0 && recipientEmails.length > 0;

  function handleSave() {
    onSave({
      id: initial?.id,
      cadence,
      customerIds: [...customerIds],
      commodityIds: [...commodityIds],
      recipientEmails,
      enabled,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-3xl overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-slate-500">{CADENCE_LABELS[cadence]} subscription</p>
            <h2 className="text-sm font-semibold text-slate-900">{initial?.id ? "Edit subscription" : "New subscription"}</h2>
          </div>
          <button type="button" onClick={onCancel} className="rounded-md border border-slate-200 px-2 py-1 text-[11px] text-slate-600 hover:bg-slate-50">
            Close
          </button>
        </div>

        <div className="grid gap-4 p-4 md:grid-cols-3">
          {/* Customers */}
          <div className="space-y-1">
            <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Customers</label>
            <MultiSelectCombobox
              options={customers}
              value={customerIds}
              onChange={setCustomerIds}
              getId={(c) => c.id}
              getLabel={(c) => c.name}
              getMeta={(c) => c.code || ""}
              placeholder="Select customers..."
              searchPlaceholder="Filter customers..."
            />
            {customerIds.length === 0 ? (
              <p className="text-[10px] text-destructive">Select at least one customer.</p>
            ) : (
              <p className="text-[10px] text-slate-500">New subscriptions default to all customers.</p>
            )}
          </div>

          {/* Commodities */}
          <div className="space-y-1">
            <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Commodity Grades</label>
            <CommodityMultiSelect commodities={commodities} value={commodityIds} onChange={setCommodityIds} />
            <p className="text-[10px] text-slate-500">Leave empty to include all commodity grades.</p>
          </div>

          {/* Recipients + enabled */}
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Recipient emails</label>
              <RecipientPicker customerId={null} value={recipientEmails} onChange={setRecipientEmails} />
              <p className="text-[10px] text-slate-500">Each customer receives their own filtered report.</p>
            </div>
            <label className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5 text-[11px] text-slate-700">
              <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="accent-brand" />
              Subscription is enabled
            </label>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-4 py-3">
          <Button type="button" variant="secondary" size="sm" onClick={onCancel} className="h-7 px-2.5 text-[11px]">
            Cancel
          </Button>
          <Button type="button" size="sm" disabled={!canSave} onClick={handleSave} className="h-7 px-2.5 text-[11px]">
            {initial?.id ? "Save changes" : "Add subscription"}
          </Button>
        </div>
      </div>
    </div>
  );
}
