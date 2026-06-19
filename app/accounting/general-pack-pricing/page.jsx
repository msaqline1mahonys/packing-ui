"use client";

import { useEffect, useMemo, useState } from "react";

import { getPackPricing, getPricingFormData, savePackPricing } from "@/lib/api/accounting";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MOBILE_BREAKPOINT = 900;
const RATE_BASIS_PER_TON = "perTon";
const RATE_BASIS_PER_CONTAINER = "perContainer";
const inputClass =
  "w-full rounded-md border border-slate-200/95 bg-white px-2.5 py-1.5 text-xs text-slate-900 outline-none ring-brand/15 placeholder:text-slate-400 focus:border-brand/35 focus:ring-2";

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

function nextId(items) {
  return Math.max(0, ...items.map((item) => Number(item.id) || 0)) + 1;
}

function toNumber(value) {
  if (value == null) return 0;
  const parsed = Number.parseFloat(String(value).trim());
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function toInputValue(value) {
  if (value == null) return "";
  return String(value);
}

function normalizeRateBasis(value) {
  return value === RATE_BASIS_PER_CONTAINER ? RATE_BASIS_PER_CONTAINER : RATE_BASIS_PER_TON;
}

function normalizeContainerSize(value) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
}

/** "20FT" -> "20 Foot Containers", fallback to raw */
function sizeTabLabel(size) {
  const m = String(size).match(/^(\d+)FT$/i);
  if (m) return `${m[1]} Foot Containers`;
  return size;
}

// ---------------------------------------------------------------------------
// Module-scope sub-components
// ---------------------------------------------------------------------------

function BtnPrimary({ className, ...props }) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-md bg-brand px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  );
}

function BtnDanger({ className, ...props }) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-md border border-rose-200 bg-white px-3 py-1.5 text-xs font-semibold text-rose-600 transition-colors hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-40",
        className
      )}
      {...props}
    />
  );
}

/** Container-size tab bar */
function SizeTabs({ sizes, selectedSize, onSelect }) {
  return (
    <div className="flex flex-wrap gap-1 border-b border-slate-200 pb-3">
      {sizes.map((size) => {
        const active = size === selectedSize;
        return (
          <button
            key={size}
            type="button"
            onClick={() => onSelect(size)}
            className={cn(
              "rounded-md px-3 py-1.5 text-xs font-semibold transition-colors",
              active
                ? "bg-brand text-white shadow-sm"
                : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            )}
          >
            {sizeTabLabel(size)}
          </button>
        );
      })}
    </div>
  );
}

/** Scrollable single-select master list (left panel) */
function MasterList({ header, items, selectedId, onSelect }) {
  return (
    <div className="flex flex-col rounded-[10px] border border-slate-200 overflow-hidden">
      <div className="border-b border-slate-200 bg-slate-50 px-3 py-2 shrink-0">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{header}</p>
      </div>
      <div className="flex-1 overflow-auto max-h-[460px]">
        {items.length === 0 && (
          <p className="px-3 py-3 text-[13px] text-slate-400">No items.</p>
        )}
        {items.map((item) => {
          const selected = item.id === selectedId;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelect(item.id)}
              className={cn(
                "flex w-full items-center justify-between border-b border-slate-100 px-3 py-2 text-left text-sm transition-colors last:border-b-0",
                selected
                  ? "bg-brand/10 font-semibold text-[#0f1e3d]"
                  : "text-slate-700 hover:bg-slate-50"
              )}
            >
              <span>{item.label}</span>
              {selected && (
                <svg className="h-3.5 w-3.5 shrink-0 text-brand" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                </svg>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** "Using Base Commodity Price" badge */
function UsingBaseIndicator() {
  return (
    <div className="inline-flex items-center gap-1.5 rounded-md border border-orange-200 bg-orange-50 px-2.5 py-1.5 text-xs font-semibold text-orange-700">
      <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
      </svg>
      Using Base Commodity Grade Price
    </div>
  );
}

/**
 * Base price block — single container size, single commodity type.
 * Props: price (string), rateBasis, dirty, onPriceChange, onRateBasisChange, onSave
 */
function BasePriceBlock({ price, rateBasis, dirty, onPriceChange, onRateBasisChange, onSave }) {
  const isPerContainer = rateBasis === RATE_BASIS_PER_CONTAINER;
  return (
    <div className="rounded-[10px] border border-slate-200 bg-white p-3 md:p-4 space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-[#0f1e3d]">Commodity Grade Base Price Per Ton (Ex GST)</h3>
        <p className="text-[11px] text-slate-500">Applies to every commodity grade under this commodity type.</p>
      </div>
      <div className="flex items-end gap-3 flex-wrap">
        <div className="flex items-center gap-1 flex-1 min-w-[120px] max-w-[200px]">
          <span className="text-sm font-semibold text-slate-500">$</span>
          <input
            type="number"
            min={0}
            step={0.01}
            value={price}
            placeholder="0.00"
            onWheel={(e) => e.currentTarget.blur()}
            onChange={(e) => onPriceChange(e.target.value)}
            className={inputClass}
          />
        </div>
        <label className="flex cursor-pointer items-center gap-1.5 text-xs text-slate-600 select-none pb-1.5">
          <input
            type="checkbox"
            checked={isPerContainer}
            onChange={(e) => onRateBasisChange(e.target.checked)}
            className="h-3.5 w-3.5 rounded border-slate-300 accent-brand"
          />
          Per Container
        </label>
        <BtnPrimary disabled={!dirty} onClick={onSave}>
          Save
        </BtnPrimary>
      </div>
    </div>
  );
}

/**
 * Customer list panel (scrollable single-select, inside the right panel).
 * Props: customers [{id, label}], selectedId, onSelect
 */
function CustomerListPanel({ customers, selectedId, onSelect }) {
  return (
    <div className="rounded-[10px] border border-slate-200 overflow-hidden">
      <div className="border-b border-slate-200 bg-slate-50 px-3 py-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Customers</p>
      </div>
      <div className="max-h-[300px] overflow-auto">
        {customers.length === 0 && (
          <p className="px-3 py-3 text-[13px] text-slate-400">No customers found.</p>
        )}
        {customers.map((c) => {
          const selected = c.id === selectedId;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => onSelect(c.id)}
              className={cn(
                "flex w-full items-center justify-between border-b border-slate-100 px-3 py-2 text-left text-sm transition-colors last:border-b-0",
                selected
                  ? "bg-brand/10 font-semibold text-[#0f1e3d]"
                  : "text-slate-700 hover:bg-slate-50"
              )}
            >
              <span>{c.label}</span>
              {selected && (
                <svg className="h-3.5 w-3.5 shrink-0 text-brand" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                </svg>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Customer override block — shows below the customer list once a customer is selected.
 */
function CustomerOverrideBlock({
  customerName,
  usingBase,
  price,
  rateBasis,
  dirty,
  hasExistingOverride,
  onPriceChange,
  onRateBasisChange,
  onSave,
  onDelete,
}) {
  const isPerContainer = rateBasis === RATE_BASIS_PER_CONTAINER;
  return (
    <div className="rounded-[10px] border border-slate-200 bg-white p-3 md:p-4 space-y-3">
      <div className="flex items-center gap-3 flex-wrap">
        {usingBase && <UsingBaseIndicator />}
        {customerName && (
          <span className="text-xs font-semibold text-slate-500">{customerName}</span>
        )}
      </div>
      <h3 className="text-sm font-semibold text-[#0f1e3d]">Customer Price Per Ton (Ex GST)</h3>
      <div className="flex items-end gap-3 flex-wrap">
        <div className="flex items-center gap-1 flex-1 min-w-[120px] max-w-[200px]">
          <span className="text-sm font-semibold text-slate-500">$</span>
          <input
            type="number"
            min={0}
            step={0.01}
            value={price}
            placeholder="0.00"
            onWheel={(e) => e.currentTarget.blur()}
            onChange={(e) => onPriceChange(e.target.value)}
            className={inputClass}
          />
        </div>
        <label className="flex cursor-pointer items-center gap-1.5 text-xs text-slate-600 select-none pb-1.5">
          <input
            type="checkbox"
            checked={isPerContainer}
            onChange={(e) => onRateBasisChange(e.target.checked)}
            className="h-3.5 w-3.5 rounded border-slate-300 accent-brand"
          />
          Per Container
        </label>
        <div className="flex gap-2 pb-0">
          <BtnPrimary disabled={!dirty} onClick={onSave}>
            Save
          </BtnPrimary>
          <BtnDanger disabled={!hasExistingOverride} onClick={onDelete}>
            Delete
          </BtnDanger>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function GeneralPackPricingPage() {
  // Reference lists — loaded from the backend (real DB records), not seed data.
  const [commodityTypes, setCommodityTypes] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [containerSizes, setContainerSizes] = useState([]);

  // Pricing state — all four arrays are kept so the backend round-trip is preserved,
  // but this screen only edits the commodity-type tiers (default + type+customer).
  const [pricingState, setPricingState] = useState({
    defaultPackingPrices: [],
    commodityPrices: [],
    commodityTypeCustomerPrices: [],
    commodityCustomerPrices: [],
  });
  const { defaultPackingPrices, commodityTypeCustomerPrices } = pricingState;

  // UI / navigation state
  const [isMobile, setIsMobile] = useState(false);
  const [selectedSize, setSelectedSize] = useState("");
  const [selectedTypeId, setSelectedTypeId] = useState(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);

  // Base block draft
  const [baseDraft, setBaseDraft] = useState("");
  const [baseRateBasis, setBaseRateBasis] = useState(RATE_BASIS_PER_TON);
  const [baseDirty, setBaseDirty] = useState(false);

  // Customer override block draft
  const [customerDraft, setCustomerDraft] = useState("");
  const [customerRateBasis, setCustomerRateBasis] = useState(RATE_BASIS_PER_TON);
  const [customerDirty, setCustomerDirty] = useState(false);

  const [errorText, setErrorText] = useState("");

  // Derived lists
  const masterItems = useMemo(
    () => commodityTypes.map((t) => ({ id: t.id, label: t.name })),
    [commodityTypes]
  );
  const customerItems = useMemo(() => customers.map((c) => ({ id: c.id, label: c.name })), [customers]);

  // Responsive breakpoint
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const handler = () => setIsMobile(mq.matches);
    handler();
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // Load reference lists (commodity types, customers, sizes) from the backend.
  useEffect(() => {
    getPricingFormData()
      .then((data) => {
        if (!data) return;
        const types = data.commodityTypes ?? [];
        const custs = data.customers ?? [];
        const sizes = data.containerSizes ?? [];
        setCommodityTypes(types);
        setCustomers(custs);
        setContainerSizes(sizes);
        setSelectedTypeId((prev) => prev ?? types[0]?.id ?? null);
        setSelectedCustomerId((prev) => prev ?? custs[0]?.id ?? null);
        setSelectedSize((prev) => prev || sizes[0] || "");
      })
      .catch(() => {});
  }, []);

  // Hydrate pricing values from the backend on mount.
  useEffect(() => {
    getPackPricing()
      .then((data) => {
        if (!data) return;
        setPricingState({
          defaultPackingPrices: data.defaultPackingPrices ?? [],
          commodityPrices: data.commodityPrices ?? [],
          commodityTypeCustomerPrices: data.commodityTypeCustomerPrices ?? [],
          commodityCustomerPrices: data.commodityCustomerPrices ?? [],
        });
      })
      .catch(() => {});
  }, []);

  // Hydrate base draft from the default (commodity-type) tier
  useEffect(() => {
    if (!selectedTypeId || !selectedSize) {
      setBaseDraft("");
      setBaseRateBasis(RATE_BASIS_PER_TON);
      setBaseDirty(false);
      return;
    }
    const normSize = normalizeContainerSize(selectedSize);
    const match = defaultPackingPrices.find(
      (item) =>
        item.commodityTypeId === selectedTypeId &&
        normalizeContainerSize(item.containerSize) === normSize
    );
    setBaseDraft(toInputValue(match?.price));
    setBaseRateBasis(normalizeRateBasis(match?.rateBasis));
    setBaseDirty(false);
    setErrorText("");
  }, [selectedTypeId, selectedSize, pricingState]); // eslint-disable-line react-hooks/exhaustive-deps

  // Hydrate customer draft from the type+customer tier
  useEffect(() => {
    if (!selectedTypeId || !selectedSize || !selectedCustomerId) {
      setCustomerDraft("");
      setCustomerRateBasis(RATE_BASIS_PER_TON);
      setCustomerDirty(false);
      return;
    }
    const normSize = normalizeContainerSize(selectedSize);
    const match = commodityTypeCustomerPrices.find(
      (item) =>
        item.customerId === selectedCustomerId &&
        item.commodityTypeId === selectedTypeId &&
        normalizeContainerSize(item.containerSize) === normSize
    );
    setCustomerDraft(toInputValue(match?.price));
    setCustomerRateBasis(normalizeRateBasis(match?.rateBasis));
    setCustomerDirty(false);
    setErrorText("");
  }, [selectedTypeId, selectedSize, selectedCustomerId, pricingState]); // eslint-disable-line react-hooks/exhaustive-deps

  function persist(nextState) {
    savePackPricing(nextState).catch(() => {});
  }

  // Base price Save → default (commodity-type) tier
  function handleSaveBase() {
    if (!selectedTypeId || !selectedSize) return;
    const raw = String(baseDraft ?? "").trim();
    const parsed = raw === "" ? "" : toNumber(raw);
    if (parsed == null) {
      setErrorText("Base price must be a valid non-negative number.");
      return;
    }
    const normSize = normalizeContainerSize(selectedSize);
    const rateBasis = normalizeRateBasis(baseRateBasis);

    setPricingState((prev) => {
      let rows = [...prev.defaultPackingPrices];
      const idx = rows.findIndex(
        (item) =>
          item.commodityTypeId === selectedTypeId &&
          normalizeContainerSize(item.containerSize) === normSize
      );
      if (parsed === "") {
        if (idx >= 0) rows.splice(idx, 1);
      } else if (idx >= 0) {
        rows[idx] = { ...rows[idx], price: parsed, rateBasis };
      } else {
        rows = [...rows, { id: nextId(rows), commodityTypeId: selectedTypeId, containerSize: normSize, price: parsed, rateBasis }];
      }
      const next = { ...prev, defaultPackingPrices: rows };
      persist(next);
      return next;
    });
    setBaseDirty(false);
    setErrorText("");
  }

  // Customer price Save → type+customer tier
  function handleSaveCustomer() {
    if (!selectedTypeId || !selectedSize || !selectedCustomerId) return;
    const raw = String(customerDraft ?? "").trim();
    const parsed = raw === "" ? "" : toNumber(raw);
    if (parsed == null) {
      setErrorText("Customer price must be a valid non-negative number.");
      return;
    }
    const normSize = normalizeContainerSize(selectedSize);
    const rateBasis = normalizeRateBasis(customerRateBasis);

    setPricingState((prev) => {
      let rows = [...prev.commodityTypeCustomerPrices];
      const idx = rows.findIndex(
        (item) =>
          item.customerId === selectedCustomerId &&
          item.commodityTypeId === selectedTypeId &&
          normalizeContainerSize(item.containerSize) === normSize
      );
      if (parsed === "") {
        if (idx >= 0) rows.splice(idx, 1);
      } else if (idx >= 0) {
        rows[idx] = { ...rows[idx], price: parsed, rateBasis };
      } else {
        rows = [...rows, { id: nextId(rows), customerId: selectedCustomerId, commodityTypeId: selectedTypeId, containerSize: normSize, price: parsed, rateBasis }];
      }
      const next = { ...prev, commodityTypeCustomerPrices: rows };
      persist(next);
      return next;
    });
    setCustomerDirty(false);
    setErrorText("");
  }

  // Customer price Delete (remove override → falls back to base)
  function handleDeleteCustomer() {
    if (!selectedTypeId || !selectedSize || !selectedCustomerId) return;
    const normSize = normalizeContainerSize(selectedSize);

    setPricingState((prev) => {
      const rows = prev.commodityTypeCustomerPrices.filter(
        (item) =>
          !(
            item.customerId === selectedCustomerId &&
            item.commodityTypeId === selectedTypeId &&
            normalizeContainerSize(item.containerSize) === normSize
          )
      );
      const next = { ...prev, commodityTypeCustomerPrices: rows };
      persist(next);
      return next;
    });
    setCustomerDirty(false);
    setErrorText("");
  }

  // Derived values for render
  const normSelectedSize = normalizeContainerSize(selectedSize);

  const hasExistingCustomerOverride =
    !!selectedTypeId &&
    !!selectedSize &&
    !!selectedCustomerId &&
    commodityTypeCustomerPrices.some(
      (item) =>
        item.customerId === selectedCustomerId &&
        item.commodityTypeId === selectedTypeId &&
        normalizeContainerSize(item.containerSize) === normSelectedSize
    );

  const selectedCustomerName = customers.find((c) => c.id === selectedCustomerId)?.name ?? "";

  // Render
  return (
    <div className="space-y-4 md:space-y-5">
      {/* Page header */}
      <div className="space-y-1">
        <p className="text-xs text-slate-500">Accounting / General Pack Pricing</p>
        <h1 className="text-2xl font-semibold tracking-tight text-[#0f1e3d] md:text-[1.65rem]">
          General Pack Pricing
        </h1>
        <p className="text-xs leading-relaxed text-slate-500">
          Set the base packing price for each commodity type and container size, with optional
          customer-specific contract overrides. The type price applies to every commodity grade under it.
        </p>
      </div>

      {/* Outer wrapper card */}
      <div className="rounded-[10px] border border-slate-200 bg-white p-3 md:p-[18px] space-y-4">

        {/* Container size tabs */}
        <SizeTabs
          sizes={containerSizes}
          selectedSize={selectedSize}
          onSelect={(size) => {
            setSelectedSize(size);
            setBaseDirty(false);
            setCustomerDirty(false);
            setErrorText("");
          }}
        />

        {/* Error banner */}
        {errorText ? (
          <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
            {errorText}
          </div>
        ) : null}

        {/* Master–detail layout */}
        <div className={cn("grid gap-4", !isMobile && "grid-cols-[240px_minmax(0,1fr)]")}>

          {/* LEFT — Commodity types */}
          <MasterList
            header="Commodity Types"
            items={masterItems}
            selectedId={selectedTypeId}
            onSelect={(id) => {
              setSelectedTypeId(id);
              setBaseDirty(false);
              setCustomerDirty(false);
              setErrorText("");
            }}
          />

          {/* RIGHT — Base + Customer panels */}
          <div className="space-y-4">

            {/* Base price block */}
            {selectedTypeId ? (
              <BasePriceBlock
                price={baseDraft}
                rateBasis={baseRateBasis}
                dirty={baseDirty}
                onPriceChange={(val) => { setBaseDraft(val); setBaseDirty(true); setErrorText(""); }}
                onRateBasisChange={(checked) => { setBaseRateBasis(checked ? RATE_BASIS_PER_CONTAINER : RATE_BASIS_PER_TON); setBaseDirty(true); setErrorText(""); }}
                onSave={handleSaveBase}
              />
            ) : (
              <div className="rounded-[10px] border border-slate-200 p-4 text-[13px] text-slate-400">
                Select a commodity type on the left.
              </div>
            )}

            {/* Customer list */}
            <CustomerListPanel
              customers={customerItems}
              selectedId={selectedCustomerId}
              onSelect={(id) => {
                setSelectedCustomerId(id);
                setCustomerDirty(false);
                setErrorText("");
              }}
            />

            {/* Customer override block */}
            {selectedCustomerId && selectedTypeId ? (
              <CustomerOverrideBlock
                customerName={selectedCustomerName}
                usingBase={!hasExistingCustomerOverride}
                price={customerDraft}
                rateBasis={customerRateBasis}
                dirty={customerDirty}
                hasExistingOverride={hasExistingCustomerOverride}
                onPriceChange={(val) => { setCustomerDraft(val); setCustomerDirty(true); setErrorText(""); }}
                onRateBasisChange={(checked) => { setCustomerRateBasis(checked ? RATE_BASIS_PER_CONTAINER : RATE_BASIS_PER_TON); setCustomerDirty(true); setErrorText(""); }}
                onSave={handleSaveCustomer}
                onDelete={handleDeleteCustomer}
              />
            ) : null}

          </div>
        </div>
      </div>
    </div>
  );
}
