"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Grid } from "@/components/clutch-table";
import { Button } from "@/components/ui/button";
import {
  getDirectionRules,
  getFieldMeta,
  isFieldRequired,
  isFieldVisible,
  STOCK_TRANSFER_DIRECTIONS,
  validateStockTransferForm,
} from "@/lib/stock-transfer-directions";
import {
  fetchStockOnHand,
  fetchStockTransferFormData,
  getDefaultSiteId,
  nowDatetimeLocal,
} from "@/lib/stock-transfers-api";
import { cn } from "@/lib/utils";

const inputClass =
  "w-full rounded-md border border-slate-200/95 bg-white px-2.5 py-1.5 text-sm text-slate-900 outline-none ring-brand/15 placeholder:text-slate-400 focus:border-brand/35 focus:ring-2";

function blankForm(defaultSiteId = "") {
  return {
    direction: "",
    datetime: nowDatetimeLocal(),
    siteId: defaultSiteId,
    locationId: "",
    fromLocationId: "",
    toLocationId: "",
    amount: "",
    stockOwnerId: "",
    counterpartyStockOwnerId: "",
    commodityId: "",
    sourceCommodityId: "",
    notes: "",
  };
}

const gridColumns = [
  { key: "datetimeDisplay", header: "Date", type: "text", sortable: true, filterable: true, resizable: true },
  { key: "directionLabel", header: "Direction", type: "text", sortable: true, filterable: true, resizable: true },
  { key: "reference", header: "Reference", type: "text", sortable: true, filterable: true, resizable: true },
  { key: "locationDisplay", header: "Location(s)", type: "text", sortable: true, filterable: true, resizable: true },
  { key: "commodityDisplay", header: "Commodity", type: "text", sortable: true, filterable: true, resizable: true },
  { key: "amountDisplay", header: "Amount (t)", type: "text", sortable: true, filterable: true, resizable: true },
  { key: "status", header: "Status", type: "text", sortable: true, filterable: true, resizable: true },
];

function formatDatetimeDisplay(value) {
  if (!value) return "-";
  const normalized = value.includes("T") ? value : `${value}T00:00`;
  const d = new Date(normalized);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" });
}

function commodityLabel(c) {
  if (!c) return "";
  const code = c.commodityCode ? ` (${c.commodityCode})` : "";
  return `${c.description}${code}`;
}

export default function StockTransferPage() {
  const [sites, setSites] = useState([]);
  const [locations, setLocations] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [commodities, setCommodities] = useState([]);
  const [formLoading, setFormLoading] = useState(true);
  const [formError, setFormError] = useState("");

  const [transfers, setTransfers] = useState([]);
  const [form, setForm] = useState(() => blankForm());
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [submittedErrors, setSubmittedErrors] = useState({});
  const [stockOnHand, setStockOnHand] = useState(0);
  const [sohLoading, setSohLoading] = useState(false);

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const loadFormData = useCallback(async () => {
    setFormLoading(true);
    setFormError("");
    try {
      const data = await fetchStockTransferFormData();
      setSites(data.sites);
      setLocations(data.locations.filter((l) => l.status !== "inactive"));
      setCustomers(data.customers);
      setCommodities(data.commodities);
      const defaultSiteId = getDefaultSiteId(data.sites);
      setForm((prev) => (prev.siteId ? prev : { ...prev, siteId: defaultSiteId }));
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to load form data.");
    } finally {
      setFormLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFormData();
  }, [loadFormData]);

  const directionRules = getDirectionRules(form.direction);
  const validation = useMemo(() => validateStockTransferForm(form), [form]);

  const siteLocations = useMemo(() => {
    if (!form.siteId) return locations;
    return locations.filter((l) => String(l.siteId) === String(form.siteId));
  }, [locations, form.siteId]);

  const toLocations = useMemo(() => {
    return siteLocations.filter((l) => String(l.id) !== String(form.fromLocationId));
  }, [siteLocations, form.fromLocationId]);

  const sohLocationId = form.direction === "move" ? form.fromLocationId : form.locationId;

  useEffect(() => {
    if (!form.stockOwnerId || !form.commodityId || !sohLocationId) {
      setStockOnHand(0);
      return;
    }

    let cancelled = false;
    setSohLoading(true);
    fetchStockOnHand({
      accountId: form.stockOwnerId,
      commodityId: form.commodityId,
      locationId: sohLocationId,
    })
      .then((qty) => {
        if (!cancelled) setStockOnHand(qty);
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
  }, [form.stockOwnerId, form.commodityId, sohLocationId]);

  const qty = parseFloat(form.amount) || 0;
  const exceedsStock =
    form.commodityId &&
    sohLocationId &&
    qty > 0 &&
    (form.direction === "out" || form.direction === "move" || form.direction === "xferout" || form.direction === "mixout") &&
    qty > stockOnHand;

  const canSave = validation.valid && !exceedsStock && !formLoading;

  const lookupLoc = (id) => locations.find((l) => String(l.id) === String(id))?.name ?? "";
  const lookupComm = (id) => commodityLabel(commodities.find((c) => String(c.id) === String(id)));
  const lookupOwner = (id) => customers.find((c) => String(c.id) === String(id))?.name ?? "";
  const lookupDirection = (value) => STOCK_TRANSFER_DIRECTIONS.find((d) => d.value === value)?.label ?? value;

  function handleDirectionChange(value) {
    const defaultSiteId = getDefaultSiteId(sites);
    setForm((prev) => ({
      ...blankForm(prev.siteId || defaultSiteId),
      direction: value,
      datetime: prev.datetime,
    }));
    setSubmittedErrors({});
  }

  function handleCancel() {
    setForm(blankForm(getDefaultSiteId(sites)));
    setSubmittedErrors({});
  }

  function executeTransfer() {
    const result = validateStockTransferForm(form);
    setSubmittedErrors(result.errors);
    if (!result.valid || exceedsStock) return;

    const nextId = transfers.length > 0 ? Math.max(...transfers.map((t) => t.id)) + 1 : 1;
    const newTransfer = {
      id: nextId,
      datetime: form.datetime,
      direction: form.direction,
      siteId: form.siteId || null,
      locationId: form.locationId || null,
      fromLocationId: form.fromLocationId || null,
      toLocationId: form.toLocationId || null,
      stockOwnerId: form.stockOwnerId,
      counterpartyStockOwnerId: form.counterpartyStockOwnerId || null,
      commodityId: form.commodityId,
      sourceCommodityId: form.sourceCommodityId || null,
      amount: qty,
      reference: `TRF-${String(nextId).padStart(3, "0")}`,
      notes: form.notes,
      status: "Completed",
    };
    setTransfers((p) => [newTransfer, ...p]);
    setShowConfirmation(true);
    setTimeout(() => {
      setShowConfirmation(false);
      handleCancel();
    }, 2500);
  }

  const displayRows = useMemo(() => {
    return transfers.map((t) => ({
      ...t,
      datetimeDisplay: formatDatetimeDisplay(t.datetime),
      directionLabel: lookupDirection(t.direction),
      locationDisplay:
        t.direction === "move"
          ? `${lookupLoc(t.fromLocationId)} → ${lookupLoc(t.toLocationId)}`
          : lookupLoc(t.locationId),
      commodityDisplay: lookupComm(t.commodityId),
      amountDisplay: t.amount.toFixed(2),
    }));
  }, [transfers, locations, commodities]);

  const fieldError = (key) => submittedErrors[key];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs text-slate-500">Stock Management / Stock Transfer</p>
          <h1 className="mt-0.5 text-2xl font-semibold tracking-tight text-slate-900">Stock Transfer</h1>
        </div>
        <div className="flex gap-2">
          <Link href="/stock-management/account-balance" className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50">← Account Balances</Link>
          <Link href="/stock-management/all-transactions" className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50">View Transactions</Link>
        </div>
      </div>

      {formError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{formError}</div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(400px,560px)_minmax(0,1fr)] lg:items-start">
        <aside className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">New Stock Movement</h2>
          {directionRules ? (
            <p className="mt-1 text-[11px] leading-relaxed text-slate-500">{directionRules.description}</p>
          ) : (
            <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
              Select a direction to record stock movements — in, out, moves, transfers, and adjustments.
            </p>
          )}

          {formLoading ? (
            <p className="mt-4 text-sm text-slate-500">Loading form data…</p>
          ) : (
            <div className="mt-3 space-y-3">
              <div className="grid gap-2.5 sm:grid-cols-2">
                <Field label="Date & Time" required={isFieldRequired(form.direction, "datetime")}>
                  <input
                    suppressHydrationWarning
                    type="datetime-local"
                    className={inputClass}
                    value={form.datetime}
                    onChange={(e) => set("datetime", e.target.value)}
                  />
                  {fieldError("datetime") ? <ErrorText>{fieldError("datetime")}</ErrorText> : null}
                </Field>

                <Field label="Site" required={isFieldRequired(form.direction, "siteId")}>
                  <select
                    suppressHydrationWarning
                    className={inputClass}
                    value={form.siteId}
                    onChange={(e) => {
                      set("siteId", e.target.value);
                      set("locationId", "");
                      set("fromLocationId", "");
                      set("toLocationId", "");
                    }}
                  >
                    <option value="">Select site</option>
                    {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </Field>
              </div>

              {isFieldVisible(form.direction, "locationId") ? (
                <Field label="Location" required={isFieldRequired(form.direction, "locationId")}>
                  <select suppressHydrationWarning className={inputClass} value={form.locationId} onChange={(e) => set("locationId", e.target.value)} disabled={!form.siteId}>
                    <option value="">{form.siteId ? "Select location" : "Select a site first"}</option>
                    {siteLocations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </select>
                  {fieldError("locationId") ? <ErrorText>{fieldError("locationId")}</ErrorText> : null}
                </Field>
              ) : null}

              {isFieldVisible(form.direction, "fromLocationId") ? (
                <div className="grid gap-2.5 sm:grid-cols-2">
                  <Field label={getFieldMeta(form.direction, "fromLocationId")?.label ?? "From Location"} required={isFieldRequired(form.direction, "fromLocationId")}>
                    <select suppressHydrationWarning className={inputClass} value={form.fromLocationId} onChange={(e) => { set("fromLocationId", e.target.value); if (form.toLocationId === e.target.value) set("toLocationId", ""); }} disabled={!form.siteId}>
                      <option value="">{form.siteId ? "Select source" : "Select a site first"}</option>
                      {siteLocations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                    </select>
                    {fieldError("fromLocationId") ? <ErrorText>{fieldError("fromLocationId")}</ErrorText> : null}
                  </Field>
                  <Field label={getFieldMeta(form.direction, "toLocationId")?.label ?? "To Location"} required={isFieldRequired(form.direction, "toLocationId")}>
                    <select suppressHydrationWarning className={inputClass} value={form.toLocationId} onChange={(e) => set("toLocationId", e.target.value)} disabled={!form.siteId}>
                      <option value="">{form.siteId ? "Select destination" : "Select a site first"}</option>
                      {toLocations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                    </select>
                    {fieldError("toLocationId") ? <ErrorText>{fieldError("toLocationId")}</ErrorText> : null}
                  </Field>
                </div>
              ) : null}

              <div className="grid gap-2.5 sm:grid-cols-2">
                <Field
                  label="Amount"
                  required={isFieldRequired(form.direction, "amount")}
                  hint={form.direction ? "negative removes" : undefined}
                >
                  <input
                    suppressHydrationWarning
                    type="number"
                    step="0.01"
                    className={inputClass}
                    value={form.amount}
                    onChange={(e) => set("amount", e.target.value)}
                    placeholder="0.00"
                  />
                  {fieldError("amount") ? <ErrorText>{fieldError("amount")}</ErrorText> : null}
                  {exceedsStock ? <ErrorText>Exceeds stock on hand ({stockOnHand.toFixed(2)} t)</ErrorText> : null}
                </Field>

                <Field
                  label={getFieldMeta(form.direction, "stockOwnerId")?.label ?? "Stock Owner"}
                  required={isFieldRequired(form.direction, "stockOwnerId")}
                >
                  <select suppressHydrationWarning className={inputClass} value={form.stockOwnerId} onChange={(e) => set("stockOwnerId", e.target.value)}>
                    <option value="">Select customer</option>
                    {customers.map((c) => <option key={c.id} value={c.id}>{c.name}{c.code ? ` (${c.code})` : ""}</option>)}
                  </select>
                  {fieldError("stockOwnerId") ? <ErrorText>{fieldError("stockOwnerId")}</ErrorText> : null}
                </Field>
              </div>

              <Field label="Direction" required>
                <select suppressHydrationWarning className={inputClass} value={form.direction} onChange={(e) => handleDirectionChange(e.target.value)}>
                  <option value="">Select direction</option>
                  {STOCK_TRANSFER_DIRECTIONS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
                </select>
                {fieldError("direction") ? <ErrorText>{fieldError("direction")}</ErrorText> : null}
              </Field>

              {isFieldVisible(form.direction, "counterpartyStockOwnerId") ? (
                <Field
                  label={getFieldMeta(form.direction, "counterpartyStockOwnerId")?.label ?? "Counterparty Stock Owner"}
                  required={isFieldRequired(form.direction, "counterpartyStockOwnerId")}
                >
                  <select suppressHydrationWarning className={inputClass} value={form.counterpartyStockOwnerId} onChange={(e) => set("counterpartyStockOwnerId", e.target.value)}>
                    <option value="">Select customer</option>
                    {customers.filter((c) => String(c.id) !== form.stockOwnerId).map((c) => (
                      <option key={c.id} value={c.id}>{c.name}{c.code ? ` (${c.code})` : ""}</option>
                    ))}
                  </select>
                  {fieldError("counterpartyStockOwnerId") ? <ErrorText>{fieldError("counterpartyStockOwnerId")}</ErrorText> : null}
                </Field>
              ) : null}

              <div className="grid gap-2.5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                <div className="space-y-2.5">
                  {isFieldVisible(form.direction, "sourceCommodityId") ? (
                    <Field
                      label={getFieldMeta(form.direction, "sourceCommodityId")?.label ?? "Source Commodity"}
                      required={isFieldRequired(form.direction, "sourceCommodityId")}
                    >
                      <select suppressHydrationWarning className={inputClass} value={form.sourceCommodityId} onChange={(e) => set("sourceCommodityId", e.target.value)}>
                        <option value="">Select commodity</option>
                        {commodities.map((c) => <option key={c.id} value={c.id}>{commodityLabel(c)}</option>)}
                      </select>
                      {fieldError("sourceCommodityId") ? <ErrorText>{fieldError("sourceCommodityId")}</ErrorText> : null}
                    </Field>
                  ) : null}

                  {form.direction ? (
                    <Field
                      label={getFieldMeta(form.direction, "commodityId")?.label ?? "Commodity"}
                      required={isFieldRequired(form.direction, "commodityId")}
                    >
                      <select suppressHydrationWarning className={inputClass} value={form.commodityId} onChange={(e) => set("commodityId", e.target.value)}>
                        <option value="">Select commodity</option>
                        {commodities.map((c) => <option key={c.id} value={c.id}>{commodityLabel(c)}</option>)}
                      </select>
                      {fieldError("commodityId") ? <ErrorText>{fieldError("commodityId")}</ErrorText> : null}
                    </Field>
                  ) : null}
                </div>

                {form.direction && (sohLocationId || form.commodityId) ? (
                  <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-center">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">SOH</p>
                    <p className="text-lg font-bold text-slate-900">
                      {sohLoading ? "…" : stockOnHand.toFixed(2)}
                    </p>
                  </div>
                ) : null}
              </div>

              {isFieldVisible(form.direction, "notes") ? (
                <Field label="Notes">
                  <textarea suppressHydrationWarning className={cn(inputClass, "min-h-16 resize-y")} value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Optional notes..." rows={3} />
                </Field>
              ) : null}
            </div>
          )}

          {canSave ? (
            <div className="mt-3 rounded-lg border border-dashed border-slate-200 bg-slate-50/80 px-3 py-2 text-xs">
              <p className="font-semibold text-slate-700">Summary</p>
              <dl className="mt-1.5 space-y-1">
                <SummaryRow label="When" value={formatDatetimeDisplay(form.datetime)} />
                <SummaryRow label="Direction" value={lookupDirection(form.direction)} />
                <SummaryRow label="Stock Owner" value={lookupOwner(form.stockOwnerId)} />
                {form.counterpartyStockOwnerId ? (
                  <SummaryRow label="Counterparty" value={lookupOwner(form.counterpartyStockOwnerId)} />
                ) : null}
                <SummaryRow
                  label="Location"
                  value={
                    form.direction === "move"
                      ? `${lookupLoc(form.fromLocationId)} → ${lookupLoc(form.toLocationId)}`
                      : lookupLoc(form.locationId)
                  }
                />
                <SummaryRow label="Commodity" value={lookupComm(form.commodityId)} />
                <SummaryRow label="Amount" value={`${qty.toFixed(2)} t`} color={qty < 0 ? "text-red-600" : "text-emerald-600"} />
              </dl>
            </div>
          ) : null}

          <div className="mt-3 flex gap-2">
            <Button className="flex-1 justify-center" size="sm" disabled={!form.direction || formLoading} onClick={executeTransfer}>Save</Button>
            <Button variant="outline" size="sm" onClick={handleCancel} disabled={formLoading}>Cancel</Button>
          </div>
          {form.direction && !canSave && !formLoading ? (
            <p className="mt-2 text-center text-[10px] text-slate-400">Complete all required fields for {lookupDirection(form.direction)}</p>
          ) : null}
        </aside>

        <div className="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-4 py-2.5">
            <span className="text-sm font-semibold text-slate-700">Transfer History ({transfers.length})</span>
          </div>
          <Grid
            columns={gridColumns}
            rows={displayRows}
            getRowId={(row) => row.id}
            theme="light"
            density="standard"
            fileName="Transfer History"
            visibleRows={14}
            emptyMessage="No transfers recorded yet."
          />
        </div>
      </div>

      {showConfirmation ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="max-w-sm rounded-xl bg-white p-8 text-center shadow-2xl">
            <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-emerald-100 text-2xl text-emerald-600">✓</div>
            <h3 className="text-lg font-bold text-slate-900">Movement Saved</h3>
            <p className="mt-2 text-sm text-slate-500">
              {lookupDirection(form.direction)} — {Math.abs(qty).toFixed(2)} t of {lookupComm(form.commodityId)}
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Field({ label, required, hint, children }) {
  return (
    <div className="space-y-0.5">
      <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-600">
        {label}
        {required ? <span className="text-red-500"> *</span> : null}
        {hint ? <span className="ml-1 font-normal normal-case text-slate-400">({hint})</span> : null}
      </label>
      {children}
    </div>
  );
}

function ErrorText({ children }) {
  return <p className="mt-0.5 text-[10px] font-semibold text-red-500">{children}</p>;
}

function SummaryRow({ label, value, color }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-slate-500">{label}</span>
      <span className={cn("text-right font-semibold text-slate-900", color)}>{value || "-"}</span>
    </div>
  );
}
