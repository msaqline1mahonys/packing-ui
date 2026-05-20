"use client";

import { useEffect, useMemo, useState } from "react";

import {
  COMMODITY_TYPE_MASTER_ROWS,
  CUSTOMER_MASTER_ROWS,
  GENERAL_PACK_PRICING_STATE,
  REFERENCE_CONTAINER_CODE_ROWS,
} from "@/lib/Data";
import { cn } from "@/lib/utils";

const MOBILE_BREAKPOINT = 900;
const RATE_BASIS_PER_TON = "perTon";
const RATE_BASIS_PER_CONTAINER = "perContainer";
const inputClass =
  "w-full rounded-md border border-slate-200/95 bg-white px-2.5 py-1.5 text-xs text-slate-900 outline-none ring-brand/15 placeholder:text-slate-400 focus:border-brand/35 focus:ring-2";

const initialPricingState = GENERAL_PACK_PRICING_STATE;

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

function containerSizeSortValue(size) {
  const matched = String(size).match(/^(\d+)/);
  if (!matched) return Number.MAX_SAFE_INTEGER;
  return Number(matched[1]);
}

function InfoRow({ label, value, highlight }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[11px] font-semibold text-slate-500">{label}</span>
      <span className={cn("break-words text-[13px] font-medium text-slate-800", highlight && "font-semibold text-blue-700")}>
        {value || "-"}
      </span>
    </div>
  );
}

export default function GeneralPackPricingPage() {
  const commodityTypes = useMemo(() => COMMODITY_TYPE_MASTER_ROWS.map((row) => ({ ...row })), []);
  const customers = useMemo(() => CUSTOMER_MASTER_ROWS.map((row) => ({ ...row })), []);
  const containerSizes = useMemo(() => {
    const sizesFromContainerCodes = Array.from(
      new Set(REFERENCE_CONTAINER_CODE_ROWS.map((row) => normalizeContainerSize(row.containerSize)).filter(Boolean))
    ).sort((left, right) => {
      const leftValue = containerSizeSortValue(left);
      const rightValue = containerSizeSortValue(right);
      if (leftValue !== rightValue) return leftValue - rightValue;
      return left.localeCompare(right);
    });

    if (sizesFromContainerCodes.length > 0) return sizesFromContainerCodes;

    const fallbackFromPricing = Array.from(
      new Set(
        [...initialPricingState.defaultPackingPrices, ...initialPricingState.commodityTypeCustomerPrices].map((row) =>
          normalizeContainerSize(row.containerSize)
        )
      )
    ).filter(Boolean);

    return fallbackFromPricing.length > 0 ? fallbackFromPricing : ["20FT", "40FT"];
  }, []);

  const [pricingState, setPricingState] = useState(() => ({
    defaultPackingPrices: initialPricingState.defaultPackingPrices.map((item) => ({ ...item })),
    commodityPrices: initialPricingState.commodityPrices.map((item) => ({ ...item })),
    commodityTypeCustomerPrices: initialPricingState.commodityTypeCustomerPrices.map((item) => ({ ...item })),
    commodityCustomerPrices: initialPricingState.commodityCustomerPrices.map((item) => ({ ...item })),
  }));
  const { defaultPackingPrices, commodityTypeCustomerPrices } = pricingState;

  const [isMobile, setIsMobile] = useState(false);
  const [selectedCommodityTypeId, setSelectedCommodityTypeId] = useState(commodityTypes[0]?.id ?? null);
  const [baseDraft, setBaseDraft] = useState(() =>
    containerSizes.reduce((acc, size) => ({ ...acc, [size]: "" }), {})
  );
  const [baseRateBasisDraft, setBaseRateBasisDraft] = useState(() =>
    containerSizes.reduce((acc, size) => ({ ...acc, [size]: RATE_BASIS_PER_TON }), {})
  );
  const [customerDrafts, setCustomerDrafts] = useState({});
  const [customerRateBasisDrafts, setCustomerRateBasisDrafts] = useState({});
  const [baseDirty, setBaseDirty] = useState(false);
  const [dirtyCustomers, setDirtyCustomers] = useState({});
  const [errorText, setErrorText] = useState("");

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const handler = () => setIsMobile(mq.matches);
    handler();
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  useEffect(() => {
    if (!selectedCommodityTypeId) return;
    const nextBase = {};
    const nextBaseRateBasis = {};
    containerSizes.forEach((size) => {
      const match = defaultPackingPrices.find(
        (item) => item.commodityTypeId === selectedCommodityTypeId && normalizeContainerSize(item.containerSize) === size
      );
      nextBase[size] = toInputValue(match?.price);
      nextBaseRateBasis[size] = normalizeRateBasis(match?.rateBasis);
    });

    const nextCustomerDrafts = {};
    const nextCustomerRateBasisDrafts = {};
    customers.forEach((customer) => {
      const perCustomer = {};
      const perCustomerRateBasis = {};
      containerSizes.forEach((size) => {
        const match = commodityTypeCustomerPrices.find(
          (item) =>
            item.customerId === customer.id &&
            item.commodityTypeId === selectedCommodityTypeId &&
            normalizeContainerSize(item.containerSize) === size
        );
        perCustomer[size] = toInputValue(match?.price);
        perCustomerRateBasis[size] = normalizeRateBasis(match?.rateBasis);
      });
      nextCustomerDrafts[customer.id] = perCustomer;
      nextCustomerRateBasisDrafts[customer.id] = perCustomerRateBasis;
    });

    setBaseDraft(nextBase);
    setBaseRateBasisDraft(nextBaseRateBasis);
    setCustomerDrafts(nextCustomerDrafts);
    setCustomerRateBasisDrafts(nextCustomerRateBasisDrafts);
    setBaseDirty(false);
    setDirtyCustomers({});
    setErrorText("");
  }, [selectedCommodityTypeId, containerSizes, customers, defaultPackingPrices, commodityTypeCustomerPrices]);

  function getDefaultPrice(commodityTypeId, containerSize) {
    return defaultPackingPrices.find(
      (item) => item.commodityTypeId === commodityTypeId && normalizeContainerSize(item.containerSize) === containerSize
    );
  }

  function getCustomerPrice(customerId, commodityTypeId, containerSize) {
    return commodityTypeCustomerPrices.find(
      (item) =>
        item.customerId === customerId &&
        item.commodityTypeId === commodityTypeId &&
        normalizeContainerSize(item.containerSize) === containerSize
    );
  }

  function handleBaseInputChange(size, value) {
    setBaseDraft((prev) => ({ ...prev, [size]: value }));
    setBaseDirty(true);
    setErrorText("");
  }

  function handleBaseRateBasisChange(size, checked) {
    setBaseRateBasisDraft((prev) => ({
      ...prev,
      [size]: checked ? RATE_BASIS_PER_CONTAINER : RATE_BASIS_PER_TON,
    }));
    setBaseDirty(true);
    setErrorText("");
  }

  function handleCustomerInputChange(customerId, size, value) {
    setCustomerDrafts((prev) => ({
      ...prev,
      [customerId]: {
        ...(prev[customerId] || {}),
        [size]: value,
      },
    }));
    setDirtyCustomers((prev) => ({ ...prev, [customerId]: true }));
    setErrorText("");
  }

  function handleCustomerRateBasisChange(customerId, size, checked) {
    setCustomerRateBasisDrafts((prev) => ({
      ...prev,
      [customerId]: {
        ...(prev[customerId] || {}),
        [size]: checked ? RATE_BASIS_PER_CONTAINER : RATE_BASIS_PER_TON,
      },
    }));
    setDirtyCustomers((prev) => ({ ...prev, [customerId]: true }));
    setErrorText("");
  }

  function saveBasePrices() {
    if (!selectedCommodityTypeId) return;
    const parsedBySize = {};
    for (const size of containerSizes) {
      const raw = String(baseDraft[size] ?? "").trim();
      if (!raw) {
        parsedBySize[size] = "";
        continue;
      }
      const parsed = toNumber(raw);
      if (parsed == null) {
        setErrorText(`Base ${size} price must be a valid number.`);
        return;
      }
      parsedBySize[size] = parsed;
    }

    setPricingState((prev) => {
      let nextRows = [...prev.defaultPackingPrices];
      let maxId = nextId(nextRows) - 1;

      containerSizes.forEach((size) => {
        const idx = nextRows.findIndex(
          (item) => item.commodityTypeId === selectedCommodityTypeId && normalizeContainerSize(item.containerSize) === size
        );
        const parsed = parsedBySize[size];
        const rateBasis = normalizeRateBasis(baseRateBasisDraft[size]);
        if (parsed === "") {
          if (idx >= 0) nextRows.splice(idx, 1);
          return;
        }

        if (idx >= 0) {
          nextRows[idx] = { ...nextRows[idx], price: parsed, rateBasis };
        } else {
          maxId += 1;
          nextRows.push({
            id: maxId,
            commodityTypeId: selectedCommodityTypeId,
            containerSize: size,
            price: parsed,
            rateBasis,
          });
        }
      });

      return {
        ...prev,
        defaultPackingPrices: nextRows,
      };
    });
    setBaseDirty(false);
    setErrorText("");
  }

  function resetBaseDraft() {
    if (!selectedCommodityTypeId) return;
    const nextBase = {};
    const nextBaseRateBasis = {};
    containerSizes.forEach((size) => {
      const match = getDefaultPrice(selectedCommodityTypeId, size);
      nextBase[size] = toInputValue(match?.price);
      nextBaseRateBasis[size] = normalizeRateBasis(match?.rateBasis);
    });
    setBaseDraft(nextBase);
    setBaseRateBasisDraft(nextBaseRateBasis);
    setBaseDirty(false);
    setErrorText("");
  }

  function saveCustomerPrices(customerId) {
    if (!selectedCommodityTypeId) return;
    const customerDraft = customerDrafts[customerId] || {};
    const parsedBySize = {};
    for (const size of containerSizes) {
      const raw = String(customerDraft[size] ?? "").trim();
      if (!raw) {
        parsedBySize[size] = "";
        continue;
      }
      const parsed = toNumber(raw);
      if (parsed == null) {
        const customer = customers.find((item) => item.id === customerId);
        setErrorText(`${customer?.name || "Customer"} ${size} price must be a valid number.`);
        return;
      }
      parsedBySize[size] = parsed;
    }

    setPricingState((prev) => {
      let nextRows = [...prev.commodityTypeCustomerPrices];
      let maxId = nextId(nextRows) - 1;

      containerSizes.forEach((size) => {
        const idx = nextRows.findIndex(
          (item) =>
            item.customerId === customerId &&
            item.commodityTypeId === selectedCommodityTypeId &&
            normalizeContainerSize(item.containerSize) === size
        );
        const parsed = parsedBySize[size];
        const rateBasis = normalizeRateBasis(customerRateBasisDrafts[customerId]?.[size]);
        if (parsed === "") {
          if (idx >= 0) nextRows.splice(idx, 1);
          return;
        }

        if (idx >= 0) {
          nextRows[idx] = { ...nextRows[idx], price: parsed, rateBasis };
        } else {
          maxId += 1;
          nextRows.push({
            id: maxId,
            customerId,
            commodityTypeId: selectedCommodityTypeId,
            containerSize: size,
            price: parsed,
            rateBasis,
          });
        }
      });

      return {
        ...prev,
        commodityTypeCustomerPrices: nextRows,
      };
    });

    setDirtyCustomers((prev) => ({ ...prev, [customerId]: false }));
    setErrorText("");
  }

  function resetCustomerDraft(customerId) {
    if (!selectedCommodityTypeId) return;
    const nextDraft = {};
    const nextRateBasisDraft = {};
    containerSizes.forEach((size) => {
      const match = getCustomerPrice(customerId, selectedCommodityTypeId, size);
      nextDraft[size] = toInputValue(match?.price);
      nextRateBasisDraft[size] = normalizeRateBasis(match?.rateBasis);
    });
    setCustomerDrafts((prev) => ({ ...prev, [customerId]: nextDraft }));
    setCustomerRateBasisDrafts((prev) => ({ ...prev, [customerId]: nextRateBasisDraft }));
    setDirtyCustomers((prev) => ({ ...prev, [customerId]: false }));
    setErrorText("");
  }

  const selectedCommodityType = commodityTypes.find((item) => item.id === selectedCommodityTypeId);

  return (
    <div className="space-y-3 md:space-y-4">
      <div className="space-y-0.5">
        <p className="text-xs text-slate-500">Accounting / General Pack Pricing</p>
        <h1 className="text-xl font-semibold tracking-tight text-[#0f1e3d] md:text-[1.5rem]">General Pack Pricing</h1>
        <p className="text-xs leading-relaxed text-slate-500">
          Set base prices by commodity type and optional customer-specific overrides for both container sizes in one
          place.
        </p>
      </div>

      <div className="rounded-[10px] border border-slate-200 bg-white p-2.5 md:p-3">
        {errorText ? (
          <div className="mb-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
            {errorText}
          </div>
        ) : null}

        <div className={cn("grid gap-4", !isMobile && "grid-cols-[260px_minmax(0,1fr)]")}>
          <div className="rounded-[10px] border border-slate-200">
            <div className="border-b border-slate-200 bg-slate-50 px-3 py-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Commodity types</p>
            </div>
            <div className="max-h-[460px] overflow-auto">
              {commodityTypes.map((type) => {
                const selected = type.id === selectedCommodityTypeId;
                return (
                  <button
                    key={type.id}
                    type="button"
                    onClick={() => setSelectedCommodityTypeId(type.id)}
                    className={cn(
                      "flex w-full items-center justify-between border-b border-slate-100 px-3 py-2 text-left text-sm transition-colors last:border-b-0",
                      selected ? "bg-brand/10 font-semibold text-[#0f1e3d]" : "text-slate-700 hover:bg-slate-50"
                    )}
                  >
                    <span>{type.name}</span>
                    <span className="text-slate-400">&gt;</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-[10px] border border-slate-200 bg-white p-3 md:p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-[#0f1e3d]">
                    Commodity base price {selectedCommodityType ? `(${selectedCommodityType.name})` : ""}
                  </h3>
                  <p className="text-xs text-slate-500">Used when no customer-specific price exists.</p>
                </div>
                <div className={cn("flex gap-2", isMobile && "w-full flex-col")}>
                  <BtnPrimary onClick={saveBasePrices} disabled={!baseDirty} className={cn(isMobile && "w-full justify-center")}>
                    Save
                  </BtnPrimary>
                  <BtnSecondary onClick={resetBaseDraft} disabled={!baseDirty} className={cn(isMobile && "w-full justify-center")}>
                    Reset
                  </BtnSecondary>
                </div>
              </div>
              <div className={cn("grid gap-2", isMobile ? "grid-cols-1" : "grid-cols-2")}>
                {containerSizes.map((size) => (
                  <FormRow key={`base-${size}`} label={`${size} price`}>
                    <div className="space-y-1">
                      <input
                        className={inputClass}
                        type="number"
                        min={0}
                        step={0.01}
                        value={baseDraft[size] ?? ""}
                        onWheel={(event) => event.currentTarget.blur()}
                        onChange={(event) => handleBaseInputChange(size, event.target.value)}
                        placeholder="0.00"
                      />
                      <label className="flex cursor-pointer items-center gap-1.5 text-[11px] font-medium text-slate-600">
                        <input
                          type="checkbox"
                          className="h-3.5 w-3.5 rounded border-slate-300 text-brand focus:ring-brand/30"
                          checked={baseRateBasisDraft[size] === RATE_BASIS_PER_CONTAINER}
                          onChange={(event) => handleBaseRateBasisChange(size, event.target.checked)}
                        />
                        Per container (unchecked = per ton)
                      </label>
                    </div>
                  </FormRow>
                ))}
              </div>
            </div>

            <div className="rounded-[10px] border border-slate-200 bg-white p-3 md:p-4">
              <div className="mb-3">
                <h3 className="text-sm font-semibold text-[#0f1e3d]">Customer specific price</h3>
                <p className="text-xs text-slate-500">Set only where a customer needs a different rate.</p>
              </div>

              {isMobile ? (
                <div className="space-y-2.5">
                  {customers.map((customer) => (
                    <div key={customer.id} className="space-y-2 rounded-[10px] border border-slate-200 p-3">
                      <InfoRow label="Customer" value={customer.name} highlight />
                      <div className="grid grid-cols-1 gap-2">
                        {containerSizes.map((size) => (
                          <FormRow key={`${customer.id}-${size}`} label={`${size} price`}>
                            <div className="space-y-1">
                              <input
                                className={inputClass}
                                type="number"
                                min={0}
                                step={0.01}
                                value={customerDrafts[customer.id]?.[size] ?? ""}
                                onWheel={(event) => event.currentTarget.blur()}
                                onChange={(event) => handleCustomerInputChange(customer.id, size, event.target.value)}
                                placeholder="Leave blank to use base price"
                              />
                              <label className="flex cursor-pointer items-center gap-1.5 text-[11px] font-medium text-slate-600">
                                <input
                                  type="checkbox"
                                  className="h-3.5 w-3.5 rounded border-slate-300 text-brand focus:ring-brand/30"
                                  checked={customerRateBasisDrafts[customer.id]?.[size] === RATE_BASIS_PER_CONTAINER}
                                  onChange={(event) => handleCustomerRateBasisChange(customer.id, size, event.target.checked)}
                                />
                                Per container (unchecked = per ton)
                              </label>
                            </div>
                          </FormRow>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <BtnPrimary
                          className="flex-1 justify-center"
                          disabled={!dirtyCustomers[customer.id]}
                          onClick={() => saveCustomerPrices(customer.id)}
                        >
                          Save
                        </BtnPrimary>
                        <BtnSecondary
                          className="flex-1 justify-center"
                          disabled={!dirtyCustomers[customer.id]}
                          onClick={() => resetCustomerDraft(customer.id)}
                        >
                          Reset
                        </BtnSecondary>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <div
                    className="mb-2 grid items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500"
                    style={{ gridTemplateColumns: "minmax(180px,1fr) 120px 120px 150px" }}
                  >
                    <span>Customer</span>
                    {containerSizes.map((size) => (
                      <span key={`header-${size}`}>{size}</span>
                    ))}
                    <span>Actions</span>
                  </div>
                  {customers.map((customer) => (
                    <div
                      key={customer.id}
                      className="grid items-center gap-2 border-b border-slate-100 py-2 text-[13px] last:border-b-0"
                      style={{ gridTemplateColumns: "minmax(180px,1fr) 120px 120px 150px" }}
                    >
                      <span className="font-medium text-slate-800">{customer.name}</span>
                      {containerSizes.map((size) => (
                        <div key={`${customer.id}-${size}`} className="space-y-1">
                          <input
                            className={inputClass}
                            type="number"
                            min={0}
                            step={0.01}
                            value={customerDrafts[customer.id]?.[size] ?? ""}
                            onWheel={(event) => event.currentTarget.blur()}
                            onChange={(event) => handleCustomerInputChange(customer.id, size, event.target.value)}
                            placeholder="-"
                          />
                          <label className="flex cursor-pointer items-center gap-1 text-[10px] font-medium text-slate-500">
                            <input
                              type="checkbox"
                              className="h-3 w-3 rounded border-slate-300 text-brand focus:ring-brand/30"
                              checked={customerRateBasisDrafts[customer.id]?.[size] === RATE_BASIS_PER_CONTAINER}
                              onChange={(event) => handleCustomerRateBasisChange(customer.id, size, event.target.checked)}
                            />
                            Per container
                          </label>
                        </div>
                      ))}
                      <div className="flex gap-1">
                        <BtnPrimary
                          className="px-2 py-1 text-[11px]"
                          disabled={!dirtyCustomers[customer.id]}
                          onClick={() => saveCustomerPrices(customer.id)}
                        >
                          Save
                        </BtnPrimary>
                        <BtnSecondary
                          className="px-2 py-1 text-[11px]"
                          disabled={!dirtyCustomers[customer.id]}
                          onClick={() => resetCustomerDraft(customer.id)}
                        >
                          Reset
                        </BtnSecondary>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function FormRow({ label, required, children }) {
  return (
    <div className="space-y-0.5">
      <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">
        {label}
        {required ? <span className="text-red-500"> *</span> : null}
      </label>
      {children}
    </div>
  );
}

function BtnPrimary({ className, ...props }) {
  return (
    <button
      className={cn(
        "inline-flex items-center rounded-md bg-brand px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  );
}

function BtnSecondary({ className, ...props }) {
  return (
    <button
      className={cn(
        "inline-flex items-center rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  );
}

