"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  fetchHoldingsAtLocation,
  defaultMoveAmountForBalance,
  exceedsTransferLimit,
  transferLimitErrorMessage,
  projectedDestinationBalance,
} from "@/lib/stock-transfers-api";
import { Field, ErrorText, WarningText, controlClassName, inputClass, commodityLabel, nowDatetimeLocalDate, qtyColor } from "./form-primitives";

export default function LocationMoveForm({ locations, commodities, defaultSiteId, submitting, onSubmit, onContextChange }) {
  const [fromLocationId, setFromLocationId] = useState("");
  const [toLocationId, setToLocationId] = useState("");
  const [commodityId, setCommodityId] = useState("");
  const [transferDate, setTransferDate] = useState(() => nowDatetimeLocalDate());
  const [notes, setNotes] = useState("");
  const [rows, setRows] = useState([]);
  const [loadingHoldings, setLoadingHoldings] = useState(false);
  const [holdingsError, setHoldingsError] = useState("");
  const [loadedKey, setLoadedKey] = useState("");
  const [submittedError, setSubmittedError] = useState("");
  const [touched, setTouched] = useState({});
  const [destHoldings, setDestHoldings] = useState({});
  const [destHoldingsLoading, setDestHoldingsLoading] = useState(false);

  const touch = (k) => setTouched((prev) => ({ ...prev, [k]: true }));

  // DERIVED
  const siteLocations = useMemo(() => {
    if (!defaultSiteId) return locations;
    return locations.filter((l) => String(l.siteId) === String(defaultSiteId));
  }, [locations, defaultSiteId]);

  const toLocations = useMemo(
    () => siteLocations.filter((l) => String(l.id) !== String(fromLocationId)),
    [siteLocations, fromLocationId]
  );

  const canLoad = Boolean(fromLocationId && commodityId);

  useEffect(() => {
    onContextChange?.({
      fromLocationId,
      toLocationId,
      commodityId,
    });
  }, [fromLocationId, toLocationId, commodityId, onContextChange]);

  useEffect(() => {
    if (!toLocationId || !commodityId) {
      setDestHoldings({});
      setDestHoldingsLoading(false);
      return undefined;
    }

    let cancelled = false;
    setDestHoldingsLoading(true);
    fetchHoldingsAtLocation({ locationId: toLocationId, commodityId })
      .then((rows) => {
        if (cancelled) return;
        const map = {};
        for (const row of rows) {
          map[String(row.accountId)] = row.available ?? 0;
        }
        setDestHoldings(map);
      })
      .catch(() => {
        if (!cancelled) setDestHoldings({});
      })
      .finally(() => {
        if (!cancelled) setDestHoldingsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [toLocationId, commodityId]);

  // Auto-load holdings when from-location and commodity are selected
  useEffect(() => {
    if (!fromLocationId || !commodityId) {
      setRows([]);
      setLoadedKey("");
      setHoldingsError("");
      setLoadingHoldings(false);
      return undefined;
    }

    const key = `${fromLocationId}|${commodityId}`;
    let cancelled = false;
    setLoadingHoldings(true);
    setHoldingsError("");
    setRows([]);

    fetchHoldingsAtLocation({ locationId: fromLocationId, commodityId })
      .then((result) => {
        if (cancelled) return;
        if (!result || result.length === 0) {
          setHoldingsError("No stock held at this location for the selected commodity.");
          setRows([]);
          setLoadedKey("");
        } else {
          setRows(
            result.map((r) => ({
              ...r,
              selected: true,
              moveAmount: defaultMoveAmountForBalance(r.available),
            }))
          );
          setLoadedKey(key);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setHoldingsError(err instanceof Error ? err.message : "Failed to load holdings.");
          setRows([]);
          setLoadedKey("");
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingHoldings(false);
      });

    return () => {
      cancelled = true;
    };
  }, [fromLocationId, commodityId]);

  const selectedRows = rows.filter((r) => r.selected);
  const selectedCount = selectedRows.length;

  const totalMove = selectedRows.reduce((sum, r) => sum + (parseFloat(r.moveAmount) || 0), 0);

  const allSelected = rows.length > 0 && rows.every((r) => r.selected);

  const negativeDestWarnings = useMemo(() => {
    if (!toLocationId || destHoldingsLoading) return [];
    return selectedRows
      .map((row) => {
        const amt = parseFloat(row.moveAmount) || 0;
        if (amt <= 0) return null;
        const destBal = destHoldings[String(row.accountId)] ?? 0;
        const projected = projectedDestinationBalance(destBal, amt, row.available ?? 0);
        if (projected >= -0.0001) return null;
        return { name: row.accountName || "Account", projected };
      })
      .filter(Boolean);
  }, [selectedRows, destHoldings, destHoldingsLoading, toLocationId]);

  // HANDLERS
  function handleFromLocationChange(value) {
    setFromLocationId(value);
    setRows([]);
    setLoadedKey("");
    setHoldingsError("");
  }

  function handleCommodityChange(value) {
    setCommodityId(value);
    setRows([]);
    setLoadedKey("");
    setHoldingsError("");
  }

  function handleSelectAll(checked) {
    setRows((prev) => prev.map((r) => ({ ...r, selected: checked })));
  }

  function handleRowSelect(idx, checked) {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, selected: checked } : r)));
  }

  function handleMoveAmountChange(idx, value) {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, moveAmount: value } : r)));
  }

  // VALIDATION
  const errors = useMemo(() => {
    const e = {};
    if (!fromLocationId) e.fromLocationId = "From Location is required.";
    if (!toLocationId) e.toLocationId = "To Location is required.";
    if (!commodityId) e.commodityId = "Commodity Grade is required.";
    if (fromLocationId && toLocationId && String(fromLocationId) === String(toLocationId)) {
      e.toLocationId = "From and To locations must be different.";
    }
    if (fromLocationId && commodityId && loadedKey !== `${fromLocationId}|${commodityId}`) {
      e.commodityId = "Holdings are loading for the current selection.";
    }
    if (loadedKey === `${fromLocationId}|${commodityId}` && selectedCount === 0) {
      e.rows = "Select at least one owner row to move.";
    }
    for (const r of selectedRows) {
      const amt = parseFloat(r.moveAmount) || 0;
      if (amt <= 0) {
        e.rows = `Move amount must be greater than 0 for ${r.accountName}.`;
        break;
      }
      if (exceedsTransferLimit(r.available ?? 0, amt)) {
        e.rows = `${r.accountName}: ${transferLimitErrorMessage(r.available ?? 0)}`;
        break;
      }
    }
    return e;
  }, [fromLocationId, toLocationId, commodityId, loadedKey, selectedCount, selectedRows]);

  const isValid = Object.keys(errors).length === 0;

  function buildValidation() {
    if (!isValid) {
      const firstKey = Object.keys(errors)[0];
      return { valid: false, message: errors[firstKey] || "Complete all required fields to save." };
    }
    return { valid: true, message: "" };
  }

  const validation = buildValidation();
  const fieldErr = (k) => (touched[k] ? errors[k] : undefined);

  function handleSave() {
    setTouched({
      fromLocationId: true,
      toLocationId: true,
      commodityId: true,
    });
    const v = buildValidation();
    if (!v.valid) {
      setSubmittedError(v.message);
      return;
    }
    setSubmittedError("");
    const lines = selectedRows.map((r) => ({
      quantity: parseFloat(r.moveAmount),
      from: { accountId: r.accountId, accountType: r.accountType, commodityId, locationId: fromLocationId },
      to: { accountId: r.accountId, accountType: r.accountType, commodityId, locationId: toLocationId },
    }));
    onSubmit({ transferType: "location", transferDate, notes, lines });
  }

  function handleCancel() {
    setFromLocationId("");
    setToLocationId("");
    setCommodityId("");
    setTransferDate(nowDatetimeLocalDate());
    setNotes("");
    setRows([]);
    setLoadingHoldings(false);
    setHoldingsError("");
    setLoadedKey("");
    setSubmittedError("");
    setTouched({});
  }

  return (
    <div className="space-y-4">
      {/* ── Section 1: date + locations + commodity ── */}
      <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Transfer Date" required>
          <input
            suppressHydrationWarning
            type="date"
            className={inputClass}
            value={transferDate}
            onChange={(e) => setTransferDate(e.target.value)}
          />
        </Field>

        <Field label="From Location" required hasError={Boolean(fieldErr("fromLocationId"))}>
          <select
            suppressHydrationWarning
            className={controlClassName(inputClass, fieldErr("fromLocationId"))}
            value={fromLocationId}
            onChange={(e) => {
              handleFromLocationChange(e.target.value);
              touch("fromLocationId");
            }}
            onBlur={() => touch("fromLocationId")}
          >
            <option value="">Select location</option>
            {siteLocations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
          {fieldErr("fromLocationId") ? <ErrorText>{fieldErr("fromLocationId")}</ErrorText> : null}
        </Field>

        <Field label="To Location" required hasError={Boolean(fieldErr("toLocationId"))}>
          <select
            suppressHydrationWarning
            className={controlClassName(inputClass, fieldErr("toLocationId"))}
            value={toLocationId}
            onChange={(e) => {
              setToLocationId(e.target.value);
              touch("toLocationId");
            }}
            onBlur={() => touch("toLocationId")}
            disabled={!fromLocationId}
          >
            <option value="">{fromLocationId ? "Select location" : "Select from location first"}</option>
            {toLocations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
          {fieldErr("toLocationId") ? <ErrorText>{fieldErr("toLocationId")}</ErrorText> : null}
        </Field>

        <Field label="Commodity Grade" required hasError={Boolean(fieldErr("commodityId"))}>
          <select
            suppressHydrationWarning
            className={controlClassName(inputClass, fieldErr("commodityId"))}
            value={commodityId}
            onChange={(e) => {
              handleCommodityChange(e.target.value);
              touch("commodityId");
            }}
            onBlur={() => touch("commodityId")}
          >
            <option value="">Select commodity</option>
            {commodities.map((c) => (
              <option key={c.id} value={c.id}>
                {commodityLabel(c)}
              </option>
            ))}
          </select>
          {fieldErr("commodityId") ? <ErrorText>{fieldErr("commodityId")}</ErrorText> : null}
        </Field>
      </div>

      {/* ── Section 2: holdings status ── */}
      <div className="flex flex-wrap items-center gap-3">
        {loadingHoldings ? (
          <span className="text-[11px] text-slate-500">Loading holdings…</span>
        ) : canLoad && rows.length > 0 ? (
          <span className="text-[11px] text-slate-500">
            {rows.length} owner(s) with stock at the from-location.
          </span>
        ) : (
          <span className="text-[11px] text-slate-400">
            Select a from-location and commodity grade to see per-owner stock.
          </span>
        )}
        {holdingsError ? (
          <p className="w-full text-xs font-medium text-red-600">{holdingsError}</p>
        ) : null}
      </div>

      {/* ── Section 3: holdings table ── */}
      {rows.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="px-3 py-2 text-left">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    className="cursor-pointer accent-brand"
                  />
                </th>
                <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                  Customer
                </th>
                <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                  Balance (t)
                </th>
                <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                  Move (t)
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row, idx) => {
                const amt = parseFloat(row.moveAmount) || 0;
                const exceedsLimit = exceedsTransferLimit(row.available ?? 0, amt);
                return (
                  <tr
                    key={`${row.accountId}-${idx}`}
                    className={cn("bg-white transition-colors", row.selected ? "" : "opacity-50")}
                  >
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={row.selected}
                        onChange={(e) => handleRowSelect(idx, e.target.checked)}
                        className="cursor-pointer accent-brand"
                      />
                    </td>
                    <td className="px-3 py-2 text-slate-800">{row.accountName || "-"}</td>
                    <td className={cn("px-3 py-2 text-right tabular-nums font-medium", qtyColor(row.available ?? 0))}>
                      {(row.available ?? 0).toFixed(2)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex flex-col items-end gap-0.5">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          className={cn(inputClass, "w-28 text-right")}
                          value={row.moveAmount}
                          disabled={!row.selected}
                          onChange={(e) => handleMoveAmountChange(idx, e.target.value)}
                        />
                        {exceedsLimit ? <ErrorText>&gt; limit</ErrorText> : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Footer summary */}
          <div className="border-t border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-600">
            Moving{" "}
            <span className="font-semibold text-slate-900">{totalMove.toFixed(2)} t</span> across{" "}
            <span className="font-semibold text-slate-900">{selectedCount}</span> owner(s) →{" "}
            <span className="font-semibold text-slate-900">{selectedCount * 2}</span> transactions
          </div>
        </div>
      ) : null}

      {negativeDestWarnings.length > 0 ? (
        <WarningText>
          {negativeDestWarnings.map((warning) => (
            <p key={warning.name}>
              {warning.name} destination balance will be {warning.projected.toFixed(2)} t.
            </p>
          ))}
        </WarningText>
      ) : null}

      {/* ── Section 4: notes ── */}
      <Field label="Notes">
        <textarea
          suppressHydrationWarning
          className={cn(inputClass, "min-h-16 resize-y")}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Optional notes…"
          rows={3}
        />
      </Field>

      {/* ── Section 5: footer actions ── */}
      <div className="space-y-1.5">
        <div className="flex gap-2">
          <Button
            className="flex-1 justify-center"
            size="sm"
            disabled={submitting || !validation.valid}
            onClick={handleSave}
          >
            {submitting ? "Saving…" : "Save"}
          </Button>
          <Button variant="outline" size="sm" onClick={handleCancel} disabled={submitting}>
            Cancel
          </Button>
        </div>
        {!validation.valid ? (
          <p className="text-center text-[10px] text-slate-400">
            {submittedError || validation.message}
          </p>
        ) : null}
      </div>
    </div>
  );
}
