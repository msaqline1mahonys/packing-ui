"use client";

import { useEffect, useMemo, useState } from "react";

import { getRecipientChoicesForCustomer, getRecipientChoicesForCustomers } from "@/lib/reports-data";
import { cn } from "@/lib/utils";

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
}

/**
 * Lets the user pick which emails (from customer.emails + contacts) should receive
 * a report for a given customer, plus type in extra ad-hoc addresses.
 */
export function RecipientPicker({ customerId, customerIds, value = [], onChange }) {
  const { customer, customers, emails } = useMemo(() => {
    if (Array.isArray(customerIds) && customerIds.length > 0) {
      const merged = getRecipientChoicesForCustomers(customerIds);
      return {
        customer: null,
        customers: merged.customers,
        emails: merged.emails,
      };
    }
    const single = getRecipientChoicesForCustomer(customerId);
    return { customer: single.customer, customers: [], emails: single.emails };
  }, [customerId, customerIds]);
  const [adHoc, setAdHoc] = useState("");
  const valueSet = useMemo(() => new Set(value.map((v) => v.toLowerCase())), [value]);

  /* If selection is empty (newly opened), pre-tick every known address. */
  useEffect(() => {
    if (emails.length === 0 && !customers.length && !customer) return;
    if (value.length > 0) return;
    const initial = emails.map((e) => e.email);
    if (initial.length) onChange(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId, customerIds]);

  function toggle(email) {
    const lower = email.toLowerCase();
    if (valueSet.has(lower)) onChange(value.filter((v) => v.toLowerCase() !== lower));
    else onChange([...value, email]);
  }

  function addAdHoc() {
    const trimmed = adHoc.trim();
    if (!trimmed) return;
    if (!isValidEmail(trimmed)) return;
    if (valueSet.has(trimmed.toLowerCase())) {
      setAdHoc("");
      return;
    }
    onChange([...value, trimmed]);
    setAdHoc("");
  }

  function removeAdHoc(email) {
    onChange(value.filter((v) => v.toLowerCase() !== email.toLowerCase()));
  }

  const known = new Set(emails.map((e) => e.email.toLowerCase()));
  const adHocValues = value.filter((v) => !known.has(v.toLowerCase()));

  if (!customer && customers.length === 0) {
    return (
      <div className="space-y-2">
        <p className="rounded-md border border-dashed border-slate-200 px-2 py-2 text-[11px] italic text-slate-500">
          No customer selected — add recipient emails manually below.
        </p>
        {adHocValues.map((email) => (
          <div key={`adhoc-${email}`} className="flex items-center gap-2 rounded-md border border-brand/30 bg-brand/5 px-2 py-1.5 text-[11px]">
            <span className="flex-1 truncate text-slate-800">{email}</span>
            <span className="shrink-0 text-[10px] uppercase tracking-wide text-slate-400">Ad-hoc</span>
            <button type="button" onClick={() => removeAdHoc(email)} className="text-[11px] text-slate-400 hover:text-destructive">Remove</button>
          </div>
        ))}
        <div className="flex items-center gap-2">
          <input
            type="email"
            value={adHoc}
            onChange={(e) => setAdHoc(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addAdHoc(); } }}
            placeholder="Add email address..."
            className="h-7 flex-1 rounded-md border border-slate-200 bg-white px-2 text-[11px] text-slate-800 outline-none focus:border-brand/35 focus:ring-2 focus:ring-brand/15"
          />
          <button
            type="button"
            onClick={addAdHoc}
            disabled={!isValidEmail(adHoc)}
            className="h-7 rounded-md border border-slate-200 bg-white px-2 text-[11px] font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
          >
            Add
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <ul className="space-y-1">
        {emails.length === 0 ? (
          <li className="rounded-md border border-dashed border-slate-200 px-2 py-2 text-[11px] italic text-slate-500">
            No emails on file for {customer.name}. Add one below.
          </li>
        ) : null}
        {emails.map((entry) => {
          const checked = valueSet.has(entry.email.toLowerCase());
          return (
            <li key={entry.email}>
              <label className={cn("flex cursor-pointer items-center gap-2 rounded-md border px-2 py-1.5 text-[11px]", checked ? "border-brand/30 bg-brand/10" : "border-slate-200 bg-white hover:bg-slate-50")}>
                <input type="checkbox" checked={checked} onChange={() => toggle(entry.email)} className="accent-brand" />
                <span className="flex-1 truncate text-slate-800">{entry.email}</span>
                <span className="shrink-0 text-[10px] uppercase tracking-wide text-slate-400">{entry.label}</span>
              </label>
            </li>
          );
        })}
        {adHocValues.map((email) => (
          <li key={`adhoc-${email}`}>
            <div className="flex items-center gap-2 rounded-md border border-brand/30 bg-brand/5 px-2 py-1.5 text-[11px]">
              <span className="flex-1 truncate text-slate-800">{email}</span>
              <span className="shrink-0 text-[10px] uppercase tracking-wide text-slate-400">Ad-hoc</span>
              <button type="button" onClick={() => removeAdHoc(email)} className="text-[11px] text-slate-400 hover:text-destructive">Remove</button>
            </div>
          </li>
        ))}
      </ul>
      <div className="flex items-center gap-2">
        <input
          type="email"
          value={adHoc}
          onChange={(e) => setAdHoc(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addAdHoc();
            }
          }}
          placeholder="Add another email..."
          className="h-7 flex-1 rounded-md border border-slate-200 bg-white px-2 text-[11px] text-slate-800 outline-none focus:border-brand/35 focus:ring-2 focus:ring-brand/15"
        />
        <button
          type="button"
          onClick={addAdHoc}
          disabled={!isValidEmail(adHoc)}
          className="h-7 rounded-md border border-slate-200 bg-white px-2 text-[11px] font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
        >
          Add
        </button>
      </div>
    </div>
  );
}
