"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  fetchStockOnHand,
  fetchStockByLocationForAccount,
  exceedsTransferLimit,
  transferLimitErrorMessage,
  projectedDestinationBalance,
} from "@/lib/stock-transfers-api";
import { Field, ErrorText, WarningText, controlClassName, inputClass, commodityLabel, nowDatetimeLocalDate, qtyColor } from "./form-primitives";
import StockLocationChips from "./stock-location-chips";

function blankState() {
  return {
    transferDate: nowDatetimeLocalDate(),
    locationId: "",
    commodityId: "",
    fromCustomerId: "",
    toCustomerId: "",
    amount: "",
    notes: "",
  };
}

export default function CustomerTransferForm({
  locations,
  customers,
  commodities,
  defaultSiteId,
  submitting,
  onSubmit,
  onContextChange,
}) {
  const [form, setForm] = useState(blankState);
  const [stockOnHand, setStockOnHand] = useState(0);
  const [sohLoading, setSohLoading] = useState(false);
  const [locationStock, setLocationStock] = useState([]);
  const [locationStockLoading, setLocationStockLoading] = useState(false);
  const [destStockOnHand, setDestStockOnHand] = useState(0);
  const [destSohLoading, setDestSohLoading] = useState(false);
  const [touched, setTouched] = useState({});

  const set = (k, v) => setForm((prev) => ({ ...prev, [k]: v }));
  const touch = (k) => setTouched((prev) => ({ ...prev, [k]: true }));

  // SOH effect: fires when the "from" coordinate is fully chosen
  useEffect(() => {
    const { fromCustomerId, commodityId, locationId } = form;
    if (!fromCustomerId || !commodityId || !locationId) {
      setStockOnHand(0);
      return;
    }

    let cancelled = false;
    setSohLoading(true);
    fetchStockOnHand({ accountId: fromCustomerId, commodityId, locationId })
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
  }, [form.fromCustomerId, form.commodityId, form.locationId]);

  useEffect(() => {
    const { toCustomerId, commodityId, locationId } = form;
    if (!toCustomerId || !commodityId || !locationId) {
      setDestStockOnHand(0);
      return undefined;
    }

    let cancelled = false;
    setDestSohLoading(true);
    fetchStockOnHand({ accountId: toCustomerId, commodityId, locationId })
      .then((qty) => {
        if (!cancelled) setDestStockOnHand(qty || 0);
      })
      .catch(() => {
        if (!cancelled) setDestStockOnHand(0);
      })
      .finally(() => {
        if (!cancelled) setDestSohLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [form.toCustomerId, form.commodityId, form.locationId]);

  useEffect(() => {
    const { fromCustomerId, commodityId } = form;
    if (!fromCustomerId || !commodityId) {
      setLocationStock([]);
      setLocationStockLoading(false);
      return undefined;
    }

    let cancelled = false;
    setLocationStockLoading(true);
    fetchStockByLocationForAccount({ accountId: fromCustomerId, commodityId })
      .then((rows) => {
        if (!cancelled) setLocationStock(rows);
      })
      .catch(() => {
        if (!cancelled) setLocationStock([]);
      })
      .finally(() => {
        if (!cancelled) setLocationStockLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [form.fromCustomerId, form.commodityId]);

  useEffect(() => {
    onContextChange?.({
      fromCustomerId: form.fromCustomerId,
      commodityId: form.commodityId,
      locationId: form.locationId,
      toCustomerId: form.toCustomerId,
    });
  }, [form.fromCustomerId, form.commodityId, form.locationId, form.toCustomerId, onContextChange]);

  const siteLocations = useMemo(() => {
    if (!defaultSiteId) return locations ?? [];
    return (locations ?? []).filter((l) => String(l.siteId) === String(defaultSiteId));
  }, [locations, defaultSiteId]);

  const toCustomers = useMemo(() => {
    return (customers ?? []).filter((c) => String(c.id) !== String(form.fromCustomerId));
  }, [customers, form.fromCustomerId]);

  const qty = parseFloat(form.amount) || 0;
  const fromCoordChosen = !!(form.fromCustomerId && form.commodityId && form.locationId);
  const exceedsLimit = fromCoordChosen && exceedsTransferLimit(stockOnHand, qty);
  const projectedDestBalance = projectedDestinationBalance(destStockOnHand, qty, stockOnHand);
  const showDestWarning =
    qty > 0 &&
    form.toCustomerId &&
    !destSohLoading &&
    projectedDestBalance < -0.0001;

  // Validation
  const errors = useMemo(() => {
    const e = {};
    if (!form.locationId) e.locationId = "Location is required.";
    if (!form.commodityId) e.commodityId = "Commodity Grade is required.";
    if (!form.fromCustomerId) e.fromCustomerId = "From Customer is required.";
    if (!form.toCustomerId) e.toCustomerId = "To Customer is required.";
    if (form.fromCustomerId && form.toCustomerId && form.fromCustomerId === form.toCustomerId)
      e.toCustomerId = "To Customer must differ from From Customer.";
    if (!form.amount || qty <= 0) e.amount = "Amount must be greater than 0.";
    if (exceedsLimit) e.amount = transferLimitErrorMessage(stockOnHand);
    return e;
  }, [form, qty, stockOnHand, exceedsLimit]);

  const isValid = Object.keys(errors).length === 0;
  const canSave = isValid && !submitting;

  function handleCancel() {
    setForm(blankState());
    setTouched({});
    setStockOnHand(0);
  }

  function handleSubmit() {
    // Touch all fields to show errors
    setTouched({
      locationId: true,
      commodityId: true,
      fromCustomerId: true,
      toCustomerId: true,
      amount: true,
    });
    if (!isValid || submitting) return;

    onSubmit({
      transferType: "customer",
      transferDate: form.transferDate,
      notes: form.notes,
      lines: [
        {
          quantity: parseFloat(form.amount),
          from: {
            accountId: form.fromCustomerId,
            accountType: "customer",
            commodityId: form.commodityId,
            locationId: form.locationId,
          },
          to: {
            accountId: form.toCustomerId,
            accountType: "customer",
            commodityId: form.commodityId,
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

      <Field label="Location" required hasError={Boolean(fieldErr("locationId"))}>
        <select
          suppressHydrationWarning
          className={controlClassName(inputClass, fieldErr("locationId"))}
          value={form.locationId}
          onChange={(e) => { set("locationId", e.target.value); touch("locationId"); }}
          onBlur={() => touch("locationId")}
        >
          <option value="">Select location</option>
          {siteLocations.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
        {fieldErr("locationId") ? <ErrorText>{fieldErr("locationId")}</ErrorText> : null}
      </Field>

      {/* Commodity */}
      <Field label="Commodity Grade" required hasError={Boolean(fieldErr("commodityId"))}>
        <select
          suppressHydrationWarning
          className={controlClassName(inputClass, fieldErr("commodityId"))}
          value={form.commodityId}
          onChange={(e) => { set("commodityId", e.target.value); touch("commodityId"); }}
          onBlur={() => touch("commodityId")}
        >
          <option value="">Select commodity</option>
          {(commodities ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {commodityLabel(c)}
            </option>
          ))}
        </select>
        {fieldErr("commodityId") ? <ErrorText>{fieldErr("commodityId")}</ErrorText> : null}
      </Field>

      {form.fromCustomerId && form.commodityId ? (
        <StockLocationChips
          locationStock={locationStock}
          loading={locationStockLoading}
          selectedLocationId={form.locationId}
          onSelectLocation={(loc) => {
            set("locationId", String(loc.locationId));
            touch("locationId");
          }}
        />
      ) : null}

      {/* From Customer + To Customer */}
      <div className="grid gap-2.5 sm:grid-cols-2">
        <Field label="From Customer" required hasError={Boolean(fieldErr("fromCustomerId"))}>
          <select
            suppressHydrationWarning
            className={controlClassName(inputClass, fieldErr("fromCustomerId"))}
            value={form.fromCustomerId}
            onChange={(e) => {
              set("fromCustomerId", e.target.value);
              touch("fromCustomerId");
              // If toCustomer becomes the same, clear it
              if (form.toCustomerId && form.toCustomerId === e.target.value) {
                set("toCustomerId", "");
              }
            }}
            onBlur={() => touch("fromCustomerId")}
          >
            <option value="">Select customer</option>
            {(customers ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.code ? ` (${c.code})` : ""}
              </option>
            ))}
          </select>
          {fieldErr("fromCustomerId") ? <ErrorText>{fieldErr("fromCustomerId")}</ErrorText> : null}
        </Field>

        <Field label="To Customer" required hasError={Boolean(fieldErr("toCustomerId"))}>
          <select
            suppressHydrationWarning
            className={controlClassName(inputClass, fieldErr("toCustomerId"))}
            value={form.toCustomerId}
            onChange={(e) => { set("toCustomerId", e.target.value); touch("toCustomerId"); }}
            onBlur={() => touch("toCustomerId")}
          >
            <option value="">Select customer</option>
            {toCustomers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.code ? ` (${c.code})` : ""}
              </option>
            ))}
          </select>
          {fieldErr("toCustomerId") ? <ErrorText>{fieldErr("toCustomerId")}</ErrorText> : null}
        </Field>
      </div>

      {/* Amount + SOH badge */}
      <div className="grid gap-2.5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <Field label="Amount (t)" required hasError={Boolean(fieldErr("amount"))}>
          <input
            suppressHydrationWarning
            type="number"
            step="0.01"
            min="0"
            className={controlClassName(inputClass, fieldErr("amount"))}
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
            <p className={cn("text-lg font-bold tabular-nums", qtyColor(stockOnHand))}>
              {sohLoading ? "…" : stockOnHand.toFixed(2)}
            </p>
          </div>
        ) : null}
      </div>

      {showDestWarning ? (
        <WarningText>
          Destination balance will be {projectedDestBalance.toFixed(2)} t after this transfer.
        </WarningText>
      ) : null}

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
