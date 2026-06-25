"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import ClutchSelect from "@/components/custom/ClutchSelect";
import { createWriteOff } from "@/lib/write-offs-api";
import { inputClassName, formLabelErrorClass } from "@/lib/form-styles";
import {
  exceedsWriteOffLimit,
  fetchCommodities,
  fetchStockLocations,
  fetchSites,
  fetchWriteOffSourceCustomers,
  fetchStockOnHand,
  getDefaultSiteId,
  writeOffLimitErrorMessage,
} from "@/lib/stock-transfers-api";
import { commodityLabel, nowDatetimeLocalDate } from "../../stock-transfer/_components/form-primitives";
import { cn } from "@/lib/utils";

const inputClass =
  "w-full rounded-lg border border-slate-200/95 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-brand/15 placeholder:text-slate-400 focus:border-brand/35 focus:ring-2";

function customerLabel(c) {
  const base = c.name + (c.code ? ` (${c.code})` : "");
  if (c.isShrink ?? c.is_shrink) return `${base} — Shrink`;
  return base;
}

function blankForm(defaultSiteId = "") {
  return {
    transactionDate: nowDatetimeLocalDate(),
    siteId: defaultSiteId,
    customerId: "",
    commodityId: "",
    locationId: "",
    quantity: "",
    notes: "",
  };
}

export default function WriteOffModal({ open, onClose, onSaved }) {
  const [form, setForm] = useState(blankForm());
  const [sites, setSites] = useState([]);
  const [locations, setLocations] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [commodities, setCommodities] = useState([]);
  const [stockOnHand, setStockOnHand] = useState(0);
  const [sohLoading, setSohLoading] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [touched, setTouched] = useState({});

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    setFormLoading(true);
    setFormError("");
    setSubmitError("");
    setTouched({});

    Promise.all([fetchSites(), fetchStockLocations(), fetchWriteOffSourceCustomers(), fetchCommodities()])
      .then(([siteRows, locationRows, customerRows, commodityRows]) => {
        if (cancelled) return;
        const defaultSiteId = getDefaultSiteId(siteRows);
        setSites(siteRows);
        setLocations(locationRows.filter((l) => l.status !== "inactive"));
        setCustomers(customerRows);
        setCommodities(commodityRows);
        setForm(blankForm(defaultSiteId));
      })
      .catch((err) => {
        if (!cancelled) {
          setFormError(err instanceof Error ? err.message : "Failed to load form data.");
        }
      })
      .finally(() => {
        if (!cancelled) setFormLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    const { customerId, commodityId, locationId } = form;
    if (!customerId || !commodityId || !locationId) {
      setStockOnHand(0);
      return undefined;
    }

    let cancelled = false;
    setSohLoading(true);
    fetchStockOnHand({ accountId: customerId, commodityId, locationId })
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
  }, [form.customerId, form.commodityId, form.locationId]);

  const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));
  const touch = (key) => setTouched((prev) => ({ ...prev, [key]: true }));

  const siteLocations = useMemo(() => {
    if (!form.siteId) return locations;
    return locations.filter((l) => String(l.siteId) === String(form.siteId));
  }, [locations, form.siteId]);

  const customerOptions = useMemo(
    () => customers.map((c) => ({ value: c.id, label: customerLabel(c) })),
    [customers]
  );

  const qty = parseFloat(form.quantity);
  const errors = useMemo(() => {
    const e = {};
    if (!form.customerId) e.customerId = "Customer is required.";
    if (!form.commodityId) e.commodityId = "Commodity is required.";
    if (!form.locationId) e.locationId = "Stock location is required.";
    if (!form.transactionDate) e.transactionDate = "Date is required.";
    if (form.quantity === "" || Number.isNaN(qty) || qty === 0) {
      e.quantity = "Enter a signed amount (positive removes stock, negative settles a deficit).";
    } else if (exceedsWriteOffLimit(stockOnHand, qty)) {
      e.quantity = writeOffLimitErrorMessage(stockOnHand, qty);
    }
    if (!form.notes.trim()) e.notes = "Reason is required.";
    return e;
  }, [form, qty, stockOnHand]);

  const isValid = Object.keys(errors).length === 0;

  const handleClose = () => {
    if (submitting) return;
    onClose();
  };

  const handleSubmit = async () => {
    setTouched({
      customerId: true,
      commodityId: true,
      locationId: true,
      transactionDate: true,
      quantity: true,
      notes: true,
    });
    setSubmitError("");
    if (!isValid) return;

    setSubmitting(true);
    try {
      const created = await createWriteOff({
        accountId: form.customerId,
        commodityId: form.commodityId,
        locationId: form.locationId,
        quantity: qty,
        transactionDate: form.transactionDate,
        notes: form.notes.trim(),
      });
      onSaved?.(created);
      onClose();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Failed to save write-off.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button type="button" className="absolute inset-0 bg-black/40" aria-label="Close dialog" onClick={handleClose} />
      <div
        role="dialog"
        aria-modal="true"
        className="relative max-h-[min(90vh,720px)] w-full max-w-2xl overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Write Off Stock</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Positive amounts remove stock; negative amounts settle a negative balance (e.g. payment agreement).
            </p>
          </div>
          <button
            type="button"
            className="rounded-md px-2 py-1 text-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            onClick={handleClose}
          >
            ×
          </button>
        </div>

        <div className="space-y-4 p-4">
          {formError ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{formError}</div>
          ) : null}
          {submitError ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{submitError}</div>
          ) : null}

          {formLoading ? (
            <p className="py-8 text-center text-sm text-slate-500">Loading form data...</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {sites.length > 1 ? (
                <Field label="Site">
                  {(() => {
                    const siteOptions = sites.map((s) => ({ value: s.id, label: s.name }));
                    return (
                      <ClutchSelect
                        options={siteOptions}
                        value={siteOptions.find((o) => String(o.value) === String(form.siteId)) ?? null}
                        onChange={(option) => {
                          const v = option ? option.value : "";
                          set("siteId", v);
                          set("locationId", "");
                        }}
                        isDisabled={submitting}
                        placeholder="Select site..."
                      />
                    );
                  })()}
                </Field>
              ) : null}

              <Field label="Transaction Date" required hasError={Boolean(touched.transactionDate && errors.transactionDate)}>
                <input
                  type="date"
                  className={inputClassName(Boolean(touched.transactionDate && errors.transactionDate))}
                  value={form.transactionDate}
                  disabled={submitting}
                  onChange={(e) => set("transactionDate", e.target.value)}
                  onBlur={() => touch("transactionDate")}
                />
                {touched.transactionDate && errors.transactionDate ? <ErrorText>{errors.transactionDate}</ErrorText> : null}
              </Field>

              <Field label="Customer" required hasError={Boolean(touched.customerId && errors.customerId)}>
                <ClutchSelect
                  options={customerOptions}
                  value={customerOptions.find((o) => String(o.value) === String(form.customerId)) ?? null}
                  onChange={(option) => {
                    const v = option ? option.value : "";
                    set("customerId", v);
                  }}
                  onBlur={() => touch("customerId")}
                  isDisabled={submitting}
                  placeholder="Select customer..."
                  error={touched.customerId && errors.customerId ? errors.customerId : undefined}
                />
                {touched.customerId && errors.customerId ? <ErrorText>{errors.customerId}</ErrorText> : null}
              </Field>

              <Field label="Commodity Grade" required hasError={Boolean(touched.commodityId && errors.commodityId)}>
                {(() => {
                  const commodityOptions = commodities.map((c) => ({ value: c.id, label: commodityLabel(c) }));
                  return (
                    <ClutchSelect
                      options={commodityOptions}
                      value={commodityOptions.find((o) => String(o.value) === String(form.commodityId)) ?? null}
                      onChange={(option) => {
                        const v = option ? option.value : "";
                        set("commodityId", v);
                      }}
                      onBlur={() => touch("commodityId")}
                      isDisabled={submitting}
                      placeholder="Select commodity..."
                      error={touched.commodityId && errors.commodityId ? errors.commodityId : undefined}
                    />
                  );
                })()}
                {touched.commodityId && errors.commodityId ? <ErrorText>{errors.commodityId}</ErrorText> : null}
              </Field>

              <Field label="Stock Location" required hasError={Boolean(touched.locationId && errors.locationId)}>
                {(() => {
                  const locationOptions = siteLocations.map((l) => ({ value: l.id, label: l.name }));
                  return (
                    <ClutchSelect
                      options={locationOptions}
                      value={locationOptions.find((o) => String(o.value) === String(form.locationId)) ?? null}
                      onChange={(option) => {
                        const v = option ? option.value : "";
                        set("locationId", v);
                      }}
                      onBlur={() => touch("locationId")}
                      isDisabled={submitting}
                      placeholder="Select location..."
                      error={touched.locationId && errors.locationId ? errors.locationId : undefined}
                    />
                  );
                })()}
                {touched.locationId && errors.locationId ? <ErrorText>{errors.locationId}</ErrorText> : null}
              </Field>

              <Field label="Amount (MT)" required hint="signed" hasError={Boolean(touched.quantity && errors.quantity)}>
                <input
                  type="number"
                  step="0.0001"
                  className={inputClassName(Boolean(touched.quantity && errors.quantity))}
                  value={form.quantity}
                  disabled={submitting}
                  placeholder="e.g. 10 or -5"
                  onChange={(e) => set("quantity", e.target.value)}
                  onBlur={() => touch("quantity")}
                />
                {touched.quantity && errors.quantity ? <ErrorText>{errors.quantity}</ErrorText> : null}
                {form.customerId && form.commodityId && form.locationId ? (
                  <p className="mt-1 text-[11px] text-slate-500">
                    {sohLoading ? "Loading stock on hand..." : `Stock on hand: ${stockOnHand.toFixed(3)} MT`}
                  </p>
                ) : null}
              </Field>

              <div className="sm:col-span-2">
                <Field label="Reason" required hasError={Boolean(touched.notes && errors.notes)}>
                  <textarea
                    className={cn(inputClassName(Boolean(touched.notes && errors.notes)), "min-h-24 resize-y")}
                    value={form.notes}
                    disabled={submitting}
                    placeholder="Why is this stock being written off?"
                    rows={3}
                    onChange={(e) => set("notes", e.target.value)}
                    onBlur={() => touch("notes")}
                  />
                  {touched.notes && errors.notes ? <ErrorText>{errors.notes}</ErrorText> : null}
                  <p className="mt-1 text-[11px] text-slate-500">Your user name will be appended automatically on save.</p>
                </Field>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <Button type="button" variant="ghost" size="sm" onClick={handleClose} disabled={submitting}>
              Cancel
            </Button>
            <Button type="button" size="sm" onClick={handleSubmit} disabled={submitting || formLoading || !!formError}>
              {submitting ? "Saving..." : "Write Off Stock"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, required, hint, hasError = false, children }) {
  return (
    <div className="space-y-1">
      <label className={cn("text-[11px] font-semibold uppercase tracking-wide", hasError ? formLabelErrorClass : "text-slate-600")}>
        {label}
        {required ? <span className="text-red-500"> *</span> : null}
        {hint ? <span className="ml-1 font-normal normal-case text-slate-400">({hint})</span> : null}
      </label>
      {children}
    </div>
  );
}

function ErrorText({ children }) {
  return <p className="text-[11px] font-semibold text-red-500">{children}</p>;
}
