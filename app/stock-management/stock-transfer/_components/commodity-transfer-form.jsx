"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { fetchStockOnHand } from "@/lib/stock-transfers-api";
import { Field, ErrorText, inputClass, commodityLabel, nowDatetimeLocalDate } from "./form-primitives";

function blankState(defaultSiteId = "") {
  return {
    transferDate: nowDatetimeLocalDate(),
    siteId: defaultSiteId,
    locationId: "",
    customerId: "",
    fromCommodityId: "",
    toCommodityId: "",
    amount: "",
    notes: "",
  };
}

export default function CommodityTransferForm({
  sites,
  locations,
  customers,
  commodities,
  defaultSiteId,
  submitting,
  onSubmit,
}) {
  const [form, setForm] = useState(() => blankState(defaultSiteId ?? ""));
  const [stockOnHand, setStockOnHand] = useState(0);
  const [sohLoading, setSohLoading] = useState(false);
  const [touched, setTouched] = useState({});

  // Keep siteId in sync if defaultSiteId prop changes on first mount
  useEffect(() => {
    if (defaultSiteId && !form.siteId) {
      setForm((prev) => ({ ...prev, siteId: defaultSiteId }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultSiteId]);

  const set = (k, v) => setForm((prev) => ({ ...prev, [k]: v }));
  const touch = (k) => setTouched((prev) => ({ ...prev, [k]: true }));

  // SOH effect: fires when the "from" coordinate is fully chosen
  useEffect(() => {
    const { customerId, fromCommodityId, locationId } = form;
    if (!customerId || !fromCommodityId || !locationId) {
      setStockOnHand(0);
      return;
    }

    let cancelled = false;
    setSohLoading(true);
    fetchStockOnHand({ accountId: customerId, commodityId: fromCommodityId, locationId })
      .then((qty) => {
        if (!cancelled) setStockOnHand(qty || 0);
      })
      .catch(() => {
        if (!cancelled) setStockOnHand(0);
      })
      .finally(() => {
        if (!cancelled) setSohLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [form.customerId, form.fromCommodityId, form.locationId]);

  const siteLocations = useMemo(() => {
    if (!form.siteId) return locations ?? [];
    return (locations ?? []).filter((l) => String(l.siteId) === String(form.siteId));
  }, [locations, form.siteId]);

  const toCommodities = useMemo(() => {
    return (commodities ?? []).filter((c) => String(c.id) !== String(form.fromCommodityId));
  }, [commodities, form.fromCommodityId]);

  const qty = parseFloat(form.amount) || 0;
  const fromCoordChosen = !!(form.customerId && form.fromCommodityId && form.locationId);
  const exceedsStock = fromCoordChosen && qty > 0 && qty > stockOnHand + 0.0001;

  // Validation
  const errors = useMemo(() => {
    const e = {};
    if (!form.locationId) e.locationId = "Location is required.";
    if (!form.customerId) e.customerId = "Customer is required.";
    if (!form.fromCommodityId) e.fromCommodityId = "From Commodity is required.";
    if (!form.toCommodityId) e.toCommodityId = "To Commodity is required.";
    if (form.fromCommodityId && form.toCommodityId && form.fromCommodityId === form.toCommodityId)
      e.toCommodityId = "To Commodity must differ from From Commodity.";
    if (!form.amount || qty <= 0) e.amount = "Amount must be greater than 0.";
    if (exceedsStock) e.amount = `Exceeds stock on hand (${stockOnHand.toFixed(2)} t)`;
    return e;
  }, [form, qty, stockOnHand, exceedsStock]);

  const isValid = Object.keys(errors).length === 0;
  const canSave = isValid && !submitting;

  function handleCancel() {
    setForm(blankState(defaultSiteId ?? ""));
    setTouched({});
    setStockOnHand(0);
  }

  function handleSubmit() {
    // Touch all fields to show errors
    setTouched({
      locationId: true,
      customerId: true,
      fromCommodityId: true,
      toCommodityId: true,
      amount: true,
    });
    if (!isValid || submitting) return;

    onSubmit({
      transferType: "commodity",
      transferDate: form.transferDate,
      notes: form.notes,
      lines: [
        {
          quantity: parseFloat(form.amount),
          from: {
            accountId: form.customerId,
            accountType: "customer",
            commodityId: form.fromCommodityId,
            locationId: form.locationId,
          },
          to: {
            accountId: form.customerId,
            accountType: "customer",
            commodityId: form.toCommodityId,
            locationId: form.locationId,
          },
        },
      ],
    });
  }

  const fieldErr = (k) => (touched[k] ? errors[k] : undefined);

  return (
    <div className="space-y-3">
      {/* Date */}
      <Field label="Date" required>
        <input
          suppressHydrationWarning
          type="date"
          className={inputClass}
          value={form.transferDate}
          onChange={(e) => set("transferDate", e.target.value)}
          onBlur={() => touch("transferDate")}
        />
      </Field>

      {/* Site + Location */}
      <div className="grid gap-2.5 sm:grid-cols-2">
        <Field label="Site" required>
          <select
            suppressHydrationWarning
            className={inputClass}
            value={form.siteId}
            onChange={(e) => {
              set("siteId", e.target.value);
              set("locationId", "");
            }}
          >
            <option value="">Select site</option>
            {(sites ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Location" required>
          <select
            suppressHydrationWarning
            className={inputClass}
            value={form.locationId}
            disabled={!form.siteId}
            onChange={(e) => { set("locationId", e.target.value); touch("locationId"); }}
            onBlur={() => touch("locationId")}
          >
            <option value="">{form.siteId ? "Select location" : "Select a site first"}</option>
            {siteLocations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
          {fieldErr("locationId") ? <ErrorText>{fieldErr("locationId")}</ErrorText> : null}
        </Field>
      </div>

      {/* Customer */}
      <Field label="Customer" required>
        <select
          suppressHydrationWarning
          className={inputClass}
          value={form.customerId}
          onChange={(e) => { set("customerId", e.target.value); touch("customerId"); }}
          onBlur={() => touch("customerId")}
        >
          <option value="">Select customer</option>
          {(customers ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
              {c.code ? ` (${c.code})` : ""}
            </option>
          ))}
        </select>
        {fieldErr("customerId") ? <ErrorText>{fieldErr("customerId")}</ErrorText> : null}
      </Field>

      {/* From Commodity + To Commodity */}
      <div className="grid gap-2.5 sm:grid-cols-2">
        <Field label="From Commodity" required>
          <select
            suppressHydrationWarning
            className={inputClass}
            value={form.fromCommodityId}
            onChange={(e) => {
              set("fromCommodityId", e.target.value);
              touch("fromCommodityId");
              // If toCommodity becomes the same, clear it
              if (form.toCommodityId && form.toCommodityId === e.target.value) {
                set("toCommodityId", "");
              }
            }}
            onBlur={() => touch("fromCommodityId")}
          >
            <option value="">Select commodity</option>
            {(commodities ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {commodityLabel(c)}
              </option>
            ))}
          </select>
          {fieldErr("fromCommodityId") ? <ErrorText>{fieldErr("fromCommodityId")}</ErrorText> : null}
        </Field>

        <Field label="To Commodity" required>
          <select
            suppressHydrationWarning
            className={inputClass}
            value={form.toCommodityId}
            onChange={(e) => { set("toCommodityId", e.target.value); touch("toCommodityId"); }}
            onBlur={() => touch("toCommodityId")}
          >
            <option value="">Select commodity</option>
            {toCommodities.map((c) => (
              <option key={c.id} value={c.id}>
                {commodityLabel(c)}
              </option>
            ))}
          </select>
          {fieldErr("toCommodityId") ? <ErrorText>{fieldErr("toCommodityId")}</ErrorText> : null}
        </Field>
      </div>

      {/* Amount + SOH badge */}
      <div className="grid gap-2.5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <Field label="Amount (t)" required>
          <input
            suppressHydrationWarning
            type="number"
            step="0.01"
            min="0"
            className={inputClass}
            value={form.amount}
            placeholder="0.00"
            onChange={(e) => { set("amount", e.target.value); touch("amount"); }}
            onBlur={() => touch("amount")}
          />
          {fieldErr("amount") ? <ErrorText>{fieldErr("amount")}</ErrorText> : null}
        </Field>

        {fromCoordChosen ? (
          <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-center">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">SOH</p>
            <p className="text-lg font-bold text-slate-900">
              {sohLoading ? "…" : stockOnHand.toFixed(2)}
            </p>
          </div>
        ) : null}
      </div>

      {/* Notes */}
      <Field label="Notes">
        <textarea
          suppressHydrationWarning
          className={cn(inputClass, "min-h-16 resize-y")}
          value={form.notes}
          onChange={(e) => set("notes", e.target.value)}
          placeholder="Optional notes…"
          rows={3}
        />
      </Field>

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        <Button
          className="flex-1 justify-center"
          size="sm"
          disabled={!canSave}
          onClick={handleSubmit}
        >
          Save
        </Button>
        <Button variant="outline" size="sm" onClick={handleCancel} disabled={submitting}>
          Cancel
        </Button>
      </div>

      {!isValid && Object.keys(touched).length > 0 ? (
        <p className="text-center text-[10px] text-slate-400">
          Complete all required fields to save.
        </p>
      ) : null}
    </div>
  );
}
