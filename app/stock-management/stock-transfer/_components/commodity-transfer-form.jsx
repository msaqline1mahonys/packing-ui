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
import { Field, ErrorText, WarningText, inputClass, commodityLabel, nowDatetimeLocalDate, qtyColor } from "./form-primitives";
import StockLocationChips from "./stock-location-chips";

function blankState() {
  return {
    transferDate: nowDatetimeLocalDate(),
    locationId: "",
    customerId: "",
    fromCommodityId: "",
    toCommodityId: "",
    amount: "",
    notes: "",
  };
}

export default function CommodityTransferForm({
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

  useEffect(() => {
    const { customerId, toCommodityId, locationId } = form;
    if (!customerId || !toCommodityId || !locationId) {
      setDestStockOnHand(0);
      return undefined;
    }

    let cancelled = false;
    setDestSohLoading(true);
    fetchStockOnHand({ accountId: customerId, commodityId: toCommodityId, locationId })
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
  }, [form.customerId, form.toCommodityId, form.locationId]);

  useEffect(() => {
    const { customerId, fromCommodityId } = form;
    if (!customerId || !fromCommodityId) {
      setLocationStock([]);
      setLocationStockLoading(false);
      return undefined;
    }

    let cancelled = false;
    setLocationStockLoading(true);
    fetchStockByLocationForAccount({ accountId: customerId, commodityId: fromCommodityId })
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
  }, [form.customerId, form.fromCommodityId]);

  useEffect(() => {
    onContextChange?.({
      customerId: form.customerId,
      fromCommodityId: form.fromCommodityId,
      locationId: form.locationId,
      toCommodityId: form.toCommodityId,
    });
  }, [form.customerId, form.fromCommodityId, form.locationId, form.toCommodityId, onContextChange]);

  const siteLocations = useMemo(() => {
    if (!defaultSiteId) return locations ?? [];
    return (locations ?? []).filter((l) => String(l.siteId) === String(defaultSiteId));
  }, [locations, defaultSiteId]);

  const toCommodities = useMemo(() => {
    return (commodities ?? []).filter((c) => String(c.id) !== String(form.fromCommodityId));
  }, [commodities, form.fromCommodityId]);

  const qty = parseFloat(form.amount) || 0;
  const fromCoordChosen = !!(form.customerId && form.fromCommodityId && form.locationId);
  const exceedsLimit = fromCoordChosen && exceedsTransferLimit(stockOnHand, qty);
  const projectedDestBalance = projectedDestinationBalance(destStockOnHand, qty, stockOnHand);
  const showDestWarning =
    qty > 0 &&
    form.toCommodityId &&
    !destSohLoading &&
    projectedDestBalance < -0.0001;

  // Validation
  const errors = useMemo(() => {
    const e = {};
    if (!form.locationId) e.locationId = "Location is required.";
    if (!form.customerId) e.customerId = "Customer is required.";
    if (!form.fromCommodityId) e.fromCommodityId = "From Commodity Grade is required.";
    if (!form.toCommodityId) e.toCommodityId = "To Commodity Grade is required.";
    if (form.fromCommodityId && form.toCommodityId && form.fromCommodityId === form.toCommodityId)
      e.toCommodityId = "To Commodity Grade must differ from From Commodity Grade.";
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

      <Field label="Location" required>
        <select
          suppressHydrationWarning
          className={inputClass}
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
        <Field label="From Commodity Grade" required>
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
            <option value="">Select commodity grade</option>
            {(commodities ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {commodityLabel(c)}
              </option>
            ))}
          </select>
          {fieldErr("fromCommodityId") ? <ErrorText>{fieldErr("fromCommodityId")}</ErrorText> : null}
        </Field>

        <Field label="To Commodity Grade" required>
          <select
            suppressHydrationWarning
            className={inputClass}
            value={form.toCommodityId}
            onChange={(e) => { set("toCommodityId", e.target.value); touch("toCommodityId"); }}
            onBlur={() => touch("toCommodityId")}
          >
            <option value="">Select commodity grade</option>
            {toCommodities.map((c) => (
              <option key={c.id} value={c.id}>
                {commodityLabel(c)}
              </option>
            ))}
          </select>
          {fieldErr("toCommodityId") ? <ErrorText>{fieldErr("toCommodityId")}</ErrorText> : null}
        </Field>
      </div>

      {form.customerId && form.fromCommodityId ? (
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
