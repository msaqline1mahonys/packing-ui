"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Grid } from "@/components/clutch-table";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const inputClass =
  "w-full rounded-lg border border-slate-200/95 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-brand/15 placeholder:text-slate-400 focus:border-brand/35 focus:ring-2";

/* â”€â”€â”€ Mock data â”€â”€â”€ */
const MOCK_COMMODITY_TYPES = [
  { id: 1, name: "Grain" },
  { id: 2, name: "Pulse" },
  { id: 3, name: "Oilseed" },
];
const MOCK_COMMODITIES = [
  { id: 1, name: "Wheat", code: "WHT", typeId: 1 },
  { id: 2, name: "Barley", code: "BRL", typeId: 1 },
  { id: 3, name: "Chickpeas", code: "CHP", typeId: 2 },
  { id: 4, name: "Canola", code: "CNL", typeId: 3 },
];
const MOCK_LOCATIONS = [
  { id: 1, name: "Bay 1 â€“ Main Shed", type: "Bay", stock: { 1: 180.5, 2: 60.0 } },
  { id: 2, name: "Bay 2 â€“ Overflow", type: "Bay", stock: { 3: 22.5 } },
  { id: 3, name: "Silo A", type: "Silo", stock: { 1: 45.0, 4: 85.0 } },
  { id: 4, name: "Silo B", type: "Silo", stock: { 2: 119.2 } },
];

const INITIAL_TRANSFERS = [
  { id: 1, date: "2026-05-10", fromLocationId: 1, toLocationId: 3, commodityTypeId: 1, commodityId: 1, quantity: 45.0, reference: "TRF-001", reason: "Consolidate wheat stock", status: "Completed" },
  { id: 2, date: "2026-05-11", fromLocationId: 2, toLocationId: 4, commodityTypeId: 2, commodityId: 3, quantity: 22.5, reference: "TRF-002", reason: "Awaiting forklift", status: "Pending" },
  { id: 3, date: "2026-05-11", fromLocationId: 3, toLocationId: 1, commodityTypeId: 1, commodityId: 2, quantity: 18.0, reference: "TRF-003", reason: "", status: "Completed" },
];

function blankForm() {
  return { commodityTypeId: "", commodityId: "", fromLocationId: "", toLocationId: "", quantity: "", reference: "", reason: "" };
}

/* Grid columns for Transfer History */
const gridColumns = [
  { key: "date", header: "Date", type: "text", sortable: true, filterable: true, resizable: true },
  { key: "reference", header: "Reference", type: "text", sortable: true, filterable: true, resizable: true },
  { key: "fromDisplay", header: "From", type: "text", sortable: true, filterable: true, resizable: true },
  { key: "toDisplay", header: "To", type: "text", sortable: true, filterable: true, resizable: true },
  { key: "commodityDisplay", header: "Commodity", type: "text", sortable: true, filterable: true, resizable: true },
  { key: "quantityDisplay", header: "Qty (t)", type: "text", sortable: true, filterable: true, resizable: true },
  { key: "status", header: "Status", type: "text", sortable: true, filterable: true, resizable: true },
];

/* â”€â”€â”€ Main page â”€â”€â”€ */
export default function StockTransferPage() {
  const [transfers, setTransfers] = useState(() => [...INITIAL_TRANSFERS]);
  const [form, setForm] = useState(() => blankForm());
  const [showConfirmation, setShowConfirmation] = useState(false);

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  /* Commodity filtering by type */
  const availableCommodities = useMemo(() => {
    if (!form.commodityTypeId) return [];
    return MOCK_COMMODITIES.filter((c) => c.typeId === Number(form.commodityTypeId));
  }, [form.commodityTypeId]);

  /* Available stock at source */
  const availableStock = useMemo(() => {
    if (!form.fromLocationId || !form.commodityId) return 0;
    const loc = MOCK_LOCATIONS.find((l) => l.id === Number(form.fromLocationId));
    return loc?.stock?.[Number(form.commodityId)] ?? 0;
  }, [form.fromLocationId, form.commodityId]);

  /* Filtered "to" locations (exclude "from") */
  const toLocations = useMemo(() => {
    return MOCK_LOCATIONS.filter((l) => l.id !== Number(form.fromLocationId));
  }, [form.fromLocationId]);

  /* Validation */
  const qty = parseFloat(form.quantity) || 0;
  const canTransfer = form.commodityTypeId && form.commodityId && form.fromLocationId && form.toLocationId && form.fromLocationId !== form.toLocationId && qty > 0 && qty <= availableStock;

  /* Lookups */
  const fromLoc = MOCK_LOCATIONS.find((l) => l.id === Number(form.fromLocationId));
  const toLoc = MOCK_LOCATIONS.find((l) => l.id === Number(form.toLocationId));
  const selectedComm = MOCK_COMMODITIES.find((c) => c.id === Number(form.commodityId));
  const lookupLoc = (id) => MOCK_LOCATIONS.find((l) => l.id === id)?.name ?? "";
  const lookupComm = (id) => MOCK_COMMODITIES.find((c) => c.id === id)?.name ?? "";

  function executeTransfer() {
    if (!canTransfer) return;
    const nextId = transfers.length > 0 ? Math.max(...transfers.map((t) => t.id)) + 1 : 1;
    const newTransfer = {
      id: nextId,
      date: new Date().toISOString().split("T")[0],
      fromLocationId: Number(form.fromLocationId),
      toLocationId: Number(form.toLocationId),
      commodityTypeId: Number(form.commodityTypeId),
      commodityId: Number(form.commodityId),
      quantity: qty,
      reference: form.reference || `TRF-${String(nextId).padStart(3, "0")}`,
      reason: form.reason,
      status: "Completed",
    };
    setTransfers((p) => [newTransfer, ...p]);
    setShowConfirmation(true);
    setTimeout(() => { setShowConfirmation(false); setForm(blankForm()); }, 2500);
  }

  const displayRows = useMemo(() => {
    return transfers.map(t => ({
      ...t,
      fromDisplay: lookupLoc(t.fromLocationId),
      toDisplay: lookupLoc(t.toLocationId),
      commodityDisplay: lookupComm(t.commodityId),
      quantityDisplay: t.quantity.toFixed(2),
    }));
  }, [transfers]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs text-slate-500">Stock Management / Stock Transfer</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">Stock Transfer</h1>
        </div>
        <div className="flex gap-2">
          <Link href="/stock-management/account-balance" className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50">â† Account Balances</Link>
          <Link href="/stock-management/all-transactions" className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50">View Transactions</Link>
        </div>
      </div>

      {/* Info banner */}
      <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-xs text-blue-800">
        <strong>Note:</strong> Stock transfers create paired tickets to move stock between locations. The stock will be removed from the source location and added to the destination location.
      </div>

      {/* Transfer form */}
      <div className="rounded-xl border border-slate-200/90 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-sm font-bold text-slate-900">New Transfer</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Commodity Type" required>
            <select suppressHydrationWarning className={inputClass} value={form.commodityTypeId} onChange={(e) => { set("commodityTypeId", e.target.value); set("commodityId", ""); }}>
              <option value=""> Select Commodity Type </option>
              {MOCK_COMMODITY_TYPES.map((ct) => <option key={ct.id} value={ct.id}>{ct.name}</option>)}
            </select>
          </Field>
          <Field label="Commodity" required>
            <select suppressHydrationWarning className={inputClass} value={form.commodityId} onChange={(e) => set("commodityId", e.target.value)} disabled={!form.commodityTypeId}>
              <option value=""> Select Commodity </option>
              {availableCommodities.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.code})</option>)}
            </select>
          </Field>
          <Field label="From Location" required>
            <select suppressHydrationWarning className={inputClass} value={form.fromLocationId} onChange={(e) => set("fromLocationId", e.target.value)}>
              <option value=""> Select Source Location </option>
              {MOCK_LOCATIONS.map((l) => <option key={l.id} value={l.id}>{l.name} ({l.type})</option>)}
            </select>
            {form.fromLocationId && form.commodityId && (
              <p className="mt-1 text-[11px] text-slate-500">Available: <span className="font-semibold text-emerald-600">{availableStock.toFixed(2)} t</span></p>
            )}
          </Field>
          <Field label="To Location" required>
            <select suppressHydrationWarning className={inputClass} value={form.toLocationId} onChange={(e) => set("toLocationId", e.target.value)}>
              <option value=""> Select Destination Location </option>
              {toLocations.map((l) => <option key={l.id} value={l.id}>{l.name} ({l.type})</option>)}
            </select>
          </Field>
          <Field label="Quantity (tonnes)" required>
            <input suppressHydrationWarning type="number" step="0.01" min="0.01" className={inputClass} value={form.quantity} onChange={(e) => set("quantity", e.target.value)} placeholder="0.00" />
            {form.quantity && qty > availableStock && (
              <p className="mt-1 text-[11px] font-semibold text-red-500">Exceeds available stock</p>
            )}
          </Field>
          <Field label="Reference">
            <input suppressHydrationWarning className={inputClass} value={form.reference} onChange={(e) => set("reference", e.target.value)} placeholder="Optional reference number" />
          </Field>
          <Field label="Reason" wide>
            <textarea suppressHydrationWarning className={cn(inputClass, "min-h-16 resize-y")} value={form.reason} onChange={(e) => set("reason", e.target.value)} placeholder="Reason for transfer..." rows={2} />
          </Field>
        </div>
      </div>

      {/* Transfer summary */}
      {canTransfer && (
        <div className="rounded-xl border border-slate-200/90 bg-white p-5 shadow-sm">
          <h3 className="mb-3 text-sm font-bold text-slate-900">Transfer Summary</h3>
          <dl className="space-y-2 text-sm">
            <SummaryRow label="Commodity" value={selectedComm?.name} />
            <SummaryRow label="From" value={fromLoc?.name} color="text-red-600" />
            <SummaryRow label="To" value={toLoc?.name} color="text-emerald-600" />
            <div className="border-t border-slate-100 pt-2">
              <SummaryRow label="Quantity" value={`${qty.toFixed(2)} t`} color="text-brand font-bold text-base" />
            </div>
          </dl>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <Button className="flex-1 justify-center" disabled={!canTransfer} onClick={executeTransfer}>Execute Transfer</Button>
        <Button variant="outline" onClick={() => setForm(blankForm())}>Clear</Button>
      </div>
      {!canTransfer && <p className="text-center text-xs text-slate-400">Complete all required fields with valid values to execute transfer</p>}

      {/* Transfer history */}
      <div className="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-4 py-3">
          <span className="text-sm font-semibold text-slate-700">Transfer History ({transfers.length})</span>
        </div>
        <Grid
          columns={gridColumns}
          rows={displayRows}
          getRowId={(row) => row.id}
          theme="light"
          density="standard"
          fileName="Transfer History"
          visibleRows={10}
        />
      </div>

      {/* Success confirmation overlay */}
      {showConfirmation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="max-w-sm rounded-xl bg-white p-8 text-center shadow-2xl">
            <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-emerald-100 text-2xl text-emerald-600">âœ“</div>
            <h3 className="text-lg font-bold text-slate-900">Transfer Complete!</h3>
            <p className="mt-2 text-sm text-slate-500">
              {qty.toFixed(2)} t of {selectedComm?.name} has been transferred from {fromLoc?.name} to {toLoc?.name}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

/* â”€â”€â”€ Sub components â”€â”€â”€ */
function Field({ label, required, wide, children }) {
  return (
    <div className={cn("space-y-1", wide && "sm:col-span-2")}>
      <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">{label}{required && <span className="text-red-500"> *</span>}</label>
      {children}
    </div>
  );
}

function SummaryRow({ label, value, color }) {
  return (
    <div className="flex justify-between">
      <span className="text-slate-500">{label}:</span>
      <span className={cn("font-semibold text-slate-900", color)}>{value}</span>
    </div>
  );
}