"use client";

import { useMemo } from "react";

import { getCommodityDirectory, getCustomerDirectory } from "@/lib/reports-data";
import { cn } from "@/lib/utils";

export function SubscriptionRow({ subscription, onEdit, onDelete, onToggle }) {
  const customers = useMemo(() => getCustomerDirectory(), []);
  const commodities = useMemo(() => getCommodityDirectory(), []);

  // Support both new customerIds[] and legacy single customerId
  const customerIds = useMemo(() => {
    if (Array.isArray(subscription.customerIds) && subscription.customerIds.length) {
      return subscription.customerIds.map(Number);
    }
    if (subscription.customerId != null) return [Number(subscription.customerId)];
    return [];
  }, [subscription]);

  const selectedCustomers = customers.filter((c) => customerIds.includes(Number(c.id)));
  const allSelected = selectedCustomers.length === customers.length && customers.length > 0;

  const commodityNames = (subscription.commodityIds || [])
    .map((id) => commodities.find((c) => Number(c.id) === Number(id))?.description)
    .filter(Boolean);

  function customerLabel() {
    if (customerIds.length === 0) return "No customers";
    if (allSelected) return "All customers";
    if (selectedCustomers.length === 1) return selectedCustomers[0].name;
    if (selectedCustomers.length === 2) return `${selectedCustomers[0].name} & ${selectedCustomers[1].name}`;
    return `${selectedCustomers[0].name} +${selectedCustomers.length - 1} more`;
  }

  return (
    <div className={cn("rounded-lg border bg-white p-3 shadow-sm", subscription.enabled ? "border-slate-200" : "border-slate-200 opacity-70")}>
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-sm font-semibold text-slate-900">{customerLabel()}</h3>
            {allSelected ? (
              <span className="rounded-full bg-brand/15 px-2 py-0.5 text-[10px] font-medium text-brand-ink">All</span>
            ) : customerIds.length > 1 ? (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">{customerIds.length} customers</span>
            ) : null}
            {!subscription.enabled ? (
              <span className="rounded-full bg-slate-200/60 px-2 py-0.5 text-[10px] font-medium text-slate-600">Disabled</span>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {commodityNames.length === 0 ? (
              <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600">All commodities</span>
            ) : (
              commodityNames.map((name) => (
                <span key={name} className="rounded-md bg-brand/10 px-2 py-0.5 text-[10px] text-brand-ink">{name}</span>
              ))
            )}
          </div>
          <p className="text-[11px] text-slate-500">
            {subscription.recipientEmails?.length || 0} recipient{(subscription.recipientEmails?.length || 0) === 1 ? "" : "s"}
            {subscription.lastFiredAt ? ` · last simulated ${String(subscription.lastFiredAt).slice(0, 10)}` : " · not yet fired"}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <label className="flex cursor-pointer items-center gap-1 text-[11px] text-slate-600">
            <input type="checkbox" checked={subscription.enabled} onChange={(e) => onToggle(subscription.id, e.target.checked)} className="accent-brand" />
            <span>Enabled</span>
          </label>
          <button type="button" onClick={() => onEdit(subscription)} className="rounded-md border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50">
            Edit
          </button>
          <button type="button" onClick={() => onDelete(subscription.id)} className="rounded-md border border-destructive/30 bg-destructive/5 px-2 py-1 text-[11px] font-medium text-destructive hover:bg-destructive/10">
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
