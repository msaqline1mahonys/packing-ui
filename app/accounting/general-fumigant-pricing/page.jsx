"use client";

import { useEffect, useMemo, useState } from "react";

import { CUSTOMER_MASTER_ROWS, FUMIGANT_MASTER_ROWS, GENERAL_FUMIGANT_PRICING_STATE } from "@/lib/Data";
import { cn } from "@/lib/utils";

const MOBILE_BREAKPOINT = 900;
const inputClass =
  "w-full rounded-lg border border-slate-200/95 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-brand/15 placeholder:text-slate-400 focus:border-brand/35 focus:ring-2";

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

export default function GeneralFumigantPricingPage() {
  const fumigants = useMemo(() => FUMIGANT_MASTER_ROWS.map((row) => ({ ...row })), []);
  const customers = useMemo(() => CUSTOMER_MASTER_ROWS.map((row) => ({ ...row })), []);

  const [pricingState, setPricingState] = useState(() => ({
    baseFumigantPrices: GENERAL_FUMIGANT_PRICING_STATE.baseFumigantPrices.map((item) => ({ ...item })),
    customerFumigantPrices: GENERAL_FUMIGANT_PRICING_STATE.customerFumigantPrices.map((item) => ({ ...item })),
  }));
  const { baseFumigantPrices, customerFumigantPrices } = pricingState;

  const [isMobile, setIsMobile] = useState(false);
  const [selectedFumigantId, setSelectedFumigantId] = useState(fumigants[0]?.id ?? null);
  const [baseDraft, setBaseDraft] = useState("");
  const [customerDrafts, setCustomerDrafts] = useState({});
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
    if (!selectedFumigantId) return;

    const baseMatch = baseFumigantPrices.find((item) => item.fumigantId === selectedFumigantId);
    setBaseDraft(toInputValue(baseMatch?.price));

    const nextCustomerDrafts = {};
    customers.forEach((customer) => {
      const customerMatch = customerFumigantPrices.find(
        (item) => item.customerId === customer.id && item.fumigantId === selectedFumigantId
      );
      nextCustomerDrafts[customer.id] = toInputValue(customerMatch?.price);
    });
    setCustomerDrafts(nextCustomerDrafts);
    setBaseDirty(false);
    setDirtyCustomers({});
    setErrorText("");
  }, [selectedFumigantId, customers, baseFumigantPrices, customerFumigantPrices]);

  function handleBaseChange(value) {
    setBaseDraft(value);
    setBaseDirty(true);
    setErrorText("");
  }

  function handleCustomerChange(customerId, value) {
    setCustomerDrafts((prev) => ({ ...prev, [customerId]: value }));
    setDirtyCustomers((prev) => ({ ...prev, [customerId]: true }));
    setErrorText("");
  }

  function saveBasePrice() {
    if (!selectedFumigantId) return;
    const raw = String(baseDraft ?? "").trim();
    const parsed = raw === "" ? "" : toNumber(raw);
    if (parsed == null) {
      setErrorText("Base fumigant price must be a valid number.");
      return;
    }

    setPricingState((prev) => {
      const existing = prev.baseFumigantPrices.find((item) => item.fumigantId === selectedFumigantId);
      if (parsed === "") {
        if (!existing) return prev;
        return {
          ...prev,
          baseFumigantPrices: prev.baseFumigantPrices.filter((item) => item.id !== existing.id),
        };
      }

      if (existing) {
        return {
          ...prev,
          baseFumigantPrices: prev.baseFumigantPrices.map((item) =>
            item.id === existing.id ? { ...item, price: parsed } : item
          ),
        };
      }

      return {
        ...prev,
        baseFumigantPrices: [
          ...prev.baseFumigantPrices,
          {
            id: nextId(prev.baseFumigantPrices),
            fumigantId: selectedFumigantId,
            price: parsed,
          },
        ],
      };
    });
    setBaseDirty(false);
    setErrorText("");
  }

  function resetBaseDraft() {
    if (!selectedFumigantId) return;
    const baseMatch = baseFumigantPrices.find((item) => item.fumigantId === selectedFumigantId);
    setBaseDraft(toInputValue(baseMatch?.price));
    setBaseDirty(false);
    setErrorText("");
  }

  function saveCustomerPrice(customerId) {
    if (!selectedFumigantId) return;
    const raw = String(customerDrafts[customerId] ?? "").trim();
    const parsed = raw === "" ? "" : toNumber(raw);
    if (parsed == null) {
      const customer = customers.find((item) => item.id === customerId);
      setErrorText(`${customer?.name || "Customer"} price must be a valid number.`);
      return;
    }

    setPricingState((prev) => {
      const existing = prev.customerFumigantPrices.find(
        (item) => item.customerId === customerId && item.fumigantId === selectedFumigantId
      );

      if (parsed === "") {
        if (!existing) return prev;
        return {
          ...prev,
          customerFumigantPrices: prev.customerFumigantPrices.filter((item) => item.id !== existing.id),
        };
      }

      if (existing) {
        return {
          ...prev,
          customerFumigantPrices: prev.customerFumigantPrices.map((item) =>
            item.id === existing.id ? { ...item, price: parsed } : item
          ),
        };
      }

      return {
        ...prev,
        customerFumigantPrices: [
          ...prev.customerFumigantPrices,
          {
            id: nextId(prev.customerFumigantPrices),
            customerId,
            fumigantId: selectedFumigantId,
            price: parsed,
          },
        ],
      };
    });

    setDirtyCustomers((prev) => ({ ...prev, [customerId]: false }));
    setErrorText("");
  }

  function resetCustomerDraft(customerId) {
    if (!selectedFumigantId) return;
    const customerMatch = customerFumigantPrices.find(
      (item) => item.customerId === customerId && item.fumigantId === selectedFumigantId
    );
    setCustomerDrafts((prev) => ({ ...prev, [customerId]: toInputValue(customerMatch?.price) }));
    setDirtyCustomers((prev) => ({ ...prev, [customerId]: false }));
    setErrorText("");
  }

  const selectedFumigant = fumigants.find((item) => item.id === selectedFumigantId);

  return (
    <div className="space-y-4 md:space-y-5">
      <div className="space-y-1">
        <p className="text-xs text-slate-500">Accounting / General Fumigant Pricing</p>
        <h1 className="text-2xl font-semibold tracking-tight text-[#0f1e3d] md:text-[1.65rem]">General Fumigant Pricing</h1>
        <p className="text-xs leading-relaxed text-slate-500">
          Set base fumigant price and optional customer-specific overrides in one place.
        </p>
      </div>

      <div className="rounded-[10px] border border-slate-200 bg-white p-3 md:p-[18px]">
        {errorText ? (
          <div className="mb-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
            {errorText}
          </div>
        ) : null}

        <div className={cn("grid gap-4", !isMobile && "grid-cols-[260px_minmax(0,1fr)]")}>
          <div className="rounded-[10px] border border-slate-200">
            <div className="border-b border-slate-200 bg-slate-50 px-3 py-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Fumigants</p>
            </div>
            <div className="max-h-[460px] overflow-auto">
              {fumigants.map((fumigant) => {
                const selected = fumigant.id === selectedFumigantId;
                return (
                  <button
                    key={fumigant.id}
                    type="button"
                    onClick={() => setSelectedFumigantId(fumigant.id)}
                    className={cn(
                      "flex w-full items-center justify-between border-b border-slate-100 px-3 py-2 text-left text-sm transition-colors last:border-b-0",
                      selected ? "bg-brand/10 font-semibold text-[#0f1e3d]" : "text-slate-700 hover:bg-slate-50"
                    )}
                  >
                    <span>{fumigant.name}</span>
                    <span className="text-slate-400">&gt;</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-[10px] border border-slate-200 bg-white p-3 md:p-4">
              <div className={cn("mb-3 flex items-center justify-between gap-3", isMobile && "flex-col items-stretch")}>
                <div>
                  <h3 className="text-sm font-semibold text-[#0f1e3d]">
                    Base fumigant price {selectedFumigant ? `(${selectedFumigant.name})` : ""}
                  </h3>
                  <p className="text-xs text-slate-500">Used when no customer-specific fumigant price exists.</p>
                </div>
                <div className={cn("flex gap-2", isMobile && "w-full flex-col")}>
                  <BtnPrimary onClick={saveBasePrice} disabled={!baseDirty} className={cn(isMobile && "w-full justify-center")}>
                    Save
                  </BtnPrimary>
                  <BtnSecondary onClick={resetBaseDraft} disabled={!baseDirty} className={cn(isMobile && "w-full justify-center")}>
                    Reset
                  </BtnSecondary>
                </div>
              </div>
              <FormRow label="Price per ton (ex GST)">
                <input
                  className={inputClass}
                  type="number"
                  min={0}
                  step={0.01}
                  value={baseDraft}
                  onWheel={(event) => event.currentTarget.blur()}
                  onChange={(event) => handleBaseChange(event.target.value)}
                  placeholder="0.00"
                />
              </FormRow>
            </div>

            <div className="rounded-[10px] border border-slate-200 bg-white p-3 md:p-4">
              <div className="mb-3">
                <h3 className="text-sm font-semibold text-[#0f1e3d]">Customer specific price</h3>
                <p className="text-xs text-slate-500">Set only where a customer needs a different fumigant price.</p>
              </div>

              {isMobile ? (
                <div className="space-y-2.5">
                  {customers.map((customer) => (
                    <div key={customer.id} className="space-y-2 rounded-[10px] border border-slate-200 p-3">
                      <InfoRow label="Customer" value={customer.name} highlight />
                      <FormRow label="Price per ton (ex GST)">
                        <input
                          className={inputClass}
                          type="number"
                          min={0}
                          step={0.01}
                          value={customerDrafts[customer.id] ?? ""}
                          onWheel={(event) => event.currentTarget.blur()}
                          onChange={(event) => handleCustomerChange(customer.id, event.target.value)}
                          placeholder="Leave blank to use base fumigant price"
                        />
                      </FormRow>
                      <div className="flex gap-2">
                        <BtnPrimary
                          className="flex-1 justify-center"
                          disabled={!dirtyCustomers[customer.id]}
                          onClick={() => saveCustomerPrice(customer.id)}
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
                    style={{ gridTemplateColumns: "minmax(180px,1fr) 140px 150px" }}
                  >
                    <span>Customer</span>
                    <span>Price</span>
                    <span>Actions</span>
                  </div>
                  {customers.map((customer) => (
                    <div
                      key={customer.id}
                      className="grid items-center gap-2 border-b border-slate-100 py-2 text-[13px] last:border-b-0"
                      style={{ gridTemplateColumns: "minmax(180px,1fr) 140px 150px" }}
                    >
                      <span className="font-medium text-slate-800">{customer.name}</span>
                      <input
                        className={inputClass}
                        type="number"
                        min={0}
                        step={0.01}
                        value={customerDrafts[customer.id] ?? ""}
                        onWheel={(event) => event.currentTarget.blur()}
                        onChange={(event) => handleCustomerChange(customer.id, event.target.value)}
                        placeholder="-"
                      />
                      <div className="flex gap-1">
                        <BtnPrimary
                          className="px-2 py-1 text-[11px]"
                          disabled={!dirtyCustomers[customer.id]}
                          onClick={() => saveCustomerPrice(customer.id)}
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
    <div className="space-y-1">
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
