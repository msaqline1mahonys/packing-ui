"use client";

import { useEffect, useMemo, useState } from "react";

import {
  COMMODITY_MASTER_ROWS,
  COMMODITY_TYPE_MASTER_ROWS,
  CUSTOMER_MASTER_ROWS,
  DEFAULT_CONTAINER_SIZES,
  GENERAL_PACK_PRICING_STATE,
} from "@/lib/Data";
import { cn } from "@/lib/utils";

const MOBILE_BREAKPOINT = 900;
const inputClass =
  "w-full rounded-lg border border-slate-200/95 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-brand/15 placeholder:text-slate-400 focus:border-brand/35 focus:ring-2";

const initialPricingState = GENERAL_PACK_PRICING_STATE;

function nextId(items) {
  return Math.max(0, ...items.map((item) => Number(item.id) || 0)) + 1;
}

function toNumber(value) {
  if (value == null) return 0;
  const parsed = Number.parseFloat(String(value).trim());
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function SectionCard({ title, description, children, isMobile }) {
  return (
    <div className="overflow-hidden rounded-[10px] border border-slate-200 bg-white">
      <div className="border-b border-slate-200 bg-slate-50 px-[14px] py-[10px] md:px-[18px] md:py-[14px]">
        <h3 className="m-0 text-[13px] font-bold text-[#0f1e3d] md:text-sm">{title}</h3>
        {description && !isMobile ? <p className="mt-1 text-xs leading-[1.4] text-slate-500">{description}</p> : null}
      </div>
      <div className="p-3 md:p-[18px]">{children}</div>
    </div>
  );
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
  const commodities = useMemo(() => COMMODITY_MASTER_ROWS.map((row) => ({ ...row })), []);
  const customers = useMemo(() => CUSTOMER_MASTER_ROWS.map((row) => ({ ...row })), []);
  const containerSizes = useMemo(() => DEFAULT_CONTAINER_SIZES, []);

  const [pricingState, setPricingState] = useState(() => ({
    defaultPackingPrices: initialPricingState.defaultPackingPrices.map((item) => ({ ...item })),
    commodityPrices: initialPricingState.commodityPrices.map((item) => ({ ...item })),
    commodityTypeCustomerPrices: initialPricingState.commodityTypeCustomerPrices.map((item) => ({ ...item })),
    commodityCustomerPrices: initialPricingState.commodityCustomerPrices.map((item) => ({ ...item })),
  }));
  const { defaultPackingPrices, commodityPrices, commodityTypeCustomerPrices, commodityCustomerPrices } = pricingState;

  const [isMobile, setIsMobile] = useState(false);
  const [defaultPricesEditing, setDefaultPricesEditing] = useState(false);

  const [cpModalOpen, setCpModalOpen] = useState(false);
  const [cpEditId, setCpEditId] = useState(null);
  const [cpForm, setCpForm] = useState({ commodityId: "", containerSize: "", price: "" });

  const [ctcpModalOpen, setCtcpModalOpen] = useState(false);
  const [ctcpEditId, setCtcpEditId] = useState(null);
  const [ctcpForm, setCtcpForm] = useState({ customerId: "", commodityTypeId: "", containerSize: "", price: "" });

  const [ccpModalOpen, setCcpModalOpen] = useState(false);
  const [ccpEditId, setCcpEditId] = useState(null);
  const [ccpForm, setCcpForm] = useState({ customerId: "", commodityId: "", containerSize: "", price: "" });

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const handler = () => setIsMobile(mq.matches);
    handler();
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  function getDefaultPrice(commodityTypeId, containerSize) {
    return defaultPackingPrices.find(
      (item) => item.commodityTypeId === commodityTypeId && item.containerSize === containerSize
    );
  }

  function handleDefaultPriceChange(commodityTypeId, containerSize, value) {
    if (!defaultPricesEditing) return;
    const parsed = toNumber(value);
    const trimmed = value.trim();

    setPricingState((prev) => {
      const existing = prev.defaultPackingPrices.find(
        (item) => item.commodityTypeId === commodityTypeId && item.containerSize === containerSize
      );

      if (trimmed === "") {
        if (!existing) return prev;
        return {
          ...prev,
          defaultPackingPrices: prev.defaultPackingPrices.filter((item) => item.id !== existing.id),
        };
      }
      if (parsed == null) return prev;

      if (existing) {
        return {
          ...prev,
          defaultPackingPrices: prev.defaultPackingPrices.map((item) =>
            item.id === existing.id ? { ...item, price: parsed } : item
          ),
        };
      }
      return {
        ...prev,
        defaultPackingPrices: [
          ...prev.defaultPackingPrices,
          {
            id: nextId(prev.defaultPackingPrices),
            commodityTypeId,
            containerSize,
            price: parsed,
          },
        ],
      };
    });
  }

  function openAddCp() {
    setCpEditId(null);
    setCpForm({ commodityId: "", containerSize: containerSizes[0] || "", price: "" });
    setCpModalOpen(true);
  }

  function openEditCp(entry) {
    setCpEditId(entry.id);
    setCpForm({
      commodityId: String(entry.commodityId),
      containerSize: entry.containerSize,
      price: entry.price == null ? "" : String(entry.price),
    });
    setCpModalOpen(true);
  }

  function saveCp() {
    if (!cpForm.commodityId || !cpForm.containerSize) return;
    const parsed = toNumber(cpForm.price);
    if (parsed == null) return;

    setPricingState((prev) => {
      if (!cpEditId) {
        const nextItem = {
          id: nextId(prev.commodityPrices),
          commodityId: Number(cpForm.commodityId),
          containerSize: cpForm.containerSize,
          price: parsed,
        };
        return { ...prev, commodityPrices: [...prev.commodityPrices, nextItem] };
      }
      return {
        ...prev,
        commodityPrices: prev.commodityPrices.map((item) =>
          item.id === cpEditId
            ? {
                ...item,
                commodityId: Number(cpForm.commodityId),
                containerSize: cpForm.containerSize,
                price: parsed,
              }
            : item
        ),
      };
    });
    setCpModalOpen(false);
  }

  function openAddCtcp() {
    setCtcpEditId(null);
    setCtcpForm({ customerId: "", commodityTypeId: "", containerSize: containerSizes[0] || "", price: "" });
    setCtcpModalOpen(true);
  }

  function openEditCtcp(entry) {
    setCtcpEditId(entry.id);
    setCtcpForm({
      customerId: String(entry.customerId),
      commodityTypeId: String(entry.commodityTypeId),
      containerSize: entry.containerSize,
      price: entry.price == null ? "" : String(entry.price),
    });
    setCtcpModalOpen(true);
  }

  function saveCtcp() {
    if (!ctcpForm.customerId || !ctcpForm.commodityTypeId || !ctcpForm.containerSize) return;
    const parsed = toNumber(ctcpForm.price);
    if (parsed == null) return;

    setPricingState((prev) => {
      if (!ctcpEditId) {
        const nextItem = {
          id: nextId(prev.commodityTypeCustomerPrices),
          customerId: Number(ctcpForm.customerId),
          commodityTypeId: Number(ctcpForm.commodityTypeId),
          containerSize: ctcpForm.containerSize,
          price: parsed,
        };
        return { ...prev, commodityTypeCustomerPrices: [...prev.commodityTypeCustomerPrices, nextItem] };
      }
      return {
        ...prev,
        commodityTypeCustomerPrices: prev.commodityTypeCustomerPrices.map((item) =>
          item.id === ctcpEditId
            ? {
                ...item,
                customerId: Number(ctcpForm.customerId),
                commodityTypeId: Number(ctcpForm.commodityTypeId),
                containerSize: ctcpForm.containerSize,
                price: parsed,
              }
            : item
        ),
      };
    });
    setCtcpModalOpen(false);
  }

  function openAddCcp() {
    setCcpEditId(null);
    setCcpForm({ customerId: "", commodityId: "", containerSize: containerSizes[0] || "", price: "" });
    setCcpModalOpen(true);
  }

  function openEditCcp(entry) {
    setCcpEditId(entry.id);
    setCcpForm({
      customerId: String(entry.customerId),
      commodityId: String(entry.commodityId),
      containerSize: entry.containerSize,
      price: entry.price == null ? "" : String(entry.price),
    });
    setCcpModalOpen(true);
  }

  function saveCcp() {
    if (!ccpForm.customerId || !ccpForm.commodityId || !ccpForm.containerSize) return;
    const parsed = toNumber(ccpForm.price);
    if (parsed == null) return;

    setPricingState((prev) => {
      if (!ccpEditId) {
        const nextItem = {
          id: nextId(prev.commodityCustomerPrices),
          customerId: Number(ccpForm.customerId),
          commodityId: Number(ccpForm.commodityId),
          containerSize: ccpForm.containerSize,
          price: parsed,
        };
        return { ...prev, commodityCustomerPrices: [...prev.commodityCustomerPrices, nextItem] };
      }
      return {
        ...prev,
        commodityCustomerPrices: prev.commodityCustomerPrices.map((item) =>
          item.id === ccpEditId
            ? {
                ...item,
                customerId: Number(ccpForm.customerId),
                commodityId: Number(ccpForm.commodityId),
                containerSize: ccpForm.containerSize,
                price: parsed,
              }
            : item
        ),
      };
    });
    setCcpModalOpen(false);
  }

  return (
    <div className="space-y-4 md:space-y-5">
      <div className="space-y-1">
        <p className="text-xs text-slate-500">Accounting / General Pack Pricing</p>
        <h1 className="text-2xl font-semibold tracking-tight text-[#0f1e3d] md:text-[1.65rem]">General Pack Pricing</h1>
        {!isMobile ? (
          <p className="text-xs leading-relaxed text-slate-500">
            Packing prices resolve in order: <strong>Commodity + Customer</strong> -&gt;{" "}
            <strong>Commodity Type + Customer</strong> -&gt; <strong>Commodity</strong> -&gt;{" "}
            <strong>Default by commodity type</strong>. The first price set wins.
          </p>
        ) : null}
      </div>

      <SectionCard
        title="1. Default packing price"
        description="Set on commodity type and container size. Used when no customer-specific or commodity-specific price exists."
        isMobile={isMobile}
      >
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {!defaultPricesEditing ? (
            <BtnPrimary onClick={() => setDefaultPricesEditing(true)} className={cn(isMobile && "w-full justify-center")}>
              Edit default prices
            </BtnPrimary>
          ) : (
            <>
              <div className={cn("flex gap-2", isMobile && "w-full flex-col")}>
                <BtnPrimary
                  onClick={() => {
                    setDefaultPricesEditing(false);
                  }}
                  className={cn(isMobile && "w-full justify-center")}
                >
                  Save
                </BtnPrimary>
                <BtnSecondary
                  onClick={() => setDefaultPricesEditing(false)}
                  className={cn(isMobile && "w-full justify-center")}
                >
                  Cancel
                </BtnSecondary>
              </div>
              <span className="text-xs text-slate-500">Press Save to confirm changes</span>
            </>
          )}
        </div>

        <div className="overflow-x-auto">
          <div
            className="mb-2 grid items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500"
            style={{ gridTemplateColumns: `160px repeat(${containerSizes.length}, ${isMobile ? 72 : 100}px)` }}
          >
            <span>Commodity type</span>
            {containerSizes.map((size) => (
              <span key={size}>{size}</span>
            ))}
          </div>

          {commodityTypes.map((type) => (
            <div
              key={type.id}
              className="mb-2 grid items-center gap-2"
              style={{ gridTemplateColumns: `160px repeat(${containerSizes.length}, ${isMobile ? 72 : 100}px)` }}
            >
              <span className="text-[13px] font-medium text-slate-800">{type.name}</span>
              {containerSizes.map((size) => {
                const entry = getDefaultPrice(type.id, size);
                return (
                  <input
                    key={`${type.id}-${size}`}
                    type="number"
                    min={0}
                    step={0.01}
                    value={entry?.price ?? ""}
                    placeholder="-"
                    onWheel={(event) => event.currentTarget.blur()}
                    onChange={(event) => handleDefaultPriceChange(type.id, size, event.target.value)}
                    disabled={!defaultPricesEditing}
                    className={cn(inputClass, !defaultPricesEditing && "cursor-not-allowed bg-slate-100")}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard
        title="2. Commodity price"
        description="Overrides the default commodity type price for a specific commodity and container size."
        isMobile={isMobile}
      >
        <div className="mb-3">
          <BtnPrimary onClick={openAddCp} className={cn(isMobile && "w-full justify-center")}>
            + Add commodity price
          </BtnPrimary>
        </div>
        {commodityPrices.length === 0 ? (
          <p className="text-[13px] text-slate-400">No commodity-level prices. Add one to override the default price.</p>
        ) : (
          <ListSection
            isMobile={isMobile}
            entries={commodityPrices}
            columns={["Commodity", "Size", "Price", "Actions"]}
            renderDesktop={(entry) => {
              const commodity = commodities.find((item) => item.id === entry.commodityId);
              const type = commodityTypes.find((item) => item.id === commodity?.commodityTypeId);
              return (
                <>
                  <span className="font-medium text-slate-800">
                    {commodity
                      ? `${commodity.description || commodity.commodityCode} (${type?.name || ""})`
                      : `Commodity #${entry.commodityId}`}
                  </span>
                  <span className="text-slate-600">{entry.containerSize}</span>
                  <span className="font-semibold text-blue-700">{Number(entry.price).toFixed(2)}</span>
                  <span className="flex gap-1">
                    <BtnSecondary className="px-2 py-1 text-[11px]" onClick={() => openEditCp(entry)}>
                      Edit
                    </BtnSecondary>
                    <BtnDanger
                      className="px-2 py-1 text-[11px]"
                      onClick={() =>
                        setPricingState((prev) => ({
                          ...prev,
                          commodityPrices: prev.commodityPrices.filter((item) => item.id !== entry.id),
                        }))
                      }
                    >
                      Delete
                    </BtnDanger>
                  </span>
                </>
              );
            }}
            renderMobile={(entry) => {
              const commodity = commodities.find((item) => item.id === entry.commodityId);
              const type = commodityTypes.find((item) => item.id === commodity?.commodityTypeId);
              return (
                <>
                  <InfoRow
                    label="Commodity"
                    value={
                      commodity
                        ? `${commodity.description || commodity.commodityCode} (${type?.name || ""})`
                        : `Commodity #${entry.commodityId}`
                    }
                    highlight
                  />
                  <div className="flex flex-wrap gap-3">
                    <InfoRow label="Size" value={entry.containerSize} />
                    <InfoRow label="Price" value={Number(entry.price).toFixed(2)} highlight />
                  </div>
                  <div className="mt-1 flex gap-2">
                    <BtnSecondary className="flex-1 justify-center" onClick={() => openEditCp(entry)}>
                      Edit
                    </BtnSecondary>
                    <BtnDanger
                      className="flex-1 justify-center"
                      onClick={() =>
                        setPricingState((prev) => ({
                          ...prev,
                          commodityPrices: prev.commodityPrices.filter((item) => item.id !== entry.id),
                        }))
                      }
                    >
                      Delete
                    </BtnDanger>
                  </div>
                </>
              );
            }}
            desktopTemplate="1fr 80px 100px 100px"
          />
        )}
      </SectionCard>

      <SectionCard
        title="3. Commodity Type + Customer price (contract)"
        description="Overrides commodity and default prices for one customer across an entire commodity type."
        isMobile={isMobile}
      >
        <div className="mb-3">
          <BtnPrimary onClick={openAddCtcp} className={cn(isMobile && "w-full justify-center")}>
            + Add commodity type + customer price
          </BtnPrimary>
        </div>
        {commodityTypeCustomerPrices.length === 0 ? (
          <p className="text-[13px] text-slate-400">No commodity type + customer prices yet.</p>
        ) : (
          <ListSection
            isMobile={isMobile}
            entries={commodityTypeCustomerPrices}
            columns={["Customer", "Commodity Type", "Size", "Price", "Actions"]}
            renderDesktop={(entry) => {
              const customer = customers.find((item) => item.id === entry.customerId);
              const type = commodityTypes.find((item) => item.id === entry.commodityTypeId);
              return (
                <>
                  <span className="font-medium text-slate-800">{customer?.name || `Customer #${entry.customerId}`}</span>
                  <span className="text-slate-600">{type?.name || `Type #${entry.commodityTypeId}`}</span>
                  <span className="text-slate-600">{entry.containerSize}</span>
                  <span className="font-semibold text-blue-700">{Number(entry.price).toFixed(2)}</span>
                  <span className="flex gap-1">
                    <BtnSecondary className="px-2 py-1 text-[11px]" onClick={() => openEditCtcp(entry)}>
                      Edit
                    </BtnSecondary>
                    <BtnDanger
                      className="px-2 py-1 text-[11px]"
                      onClick={() =>
                        setPricingState((prev) => ({
                          ...prev,
                          commodityTypeCustomerPrices: prev.commodityTypeCustomerPrices.filter((item) => item.id !== entry.id),
                        }))
                      }
                    >
                      Delete
                    </BtnDanger>
                  </span>
                </>
              );
            }}
            renderMobile={(entry) => {
              const customer = customers.find((item) => item.id === entry.customerId);
              const type = commodityTypes.find((item) => item.id === entry.commodityTypeId);
              return (
                <>
                  <InfoRow label="Customer" value={customer?.name || `Customer #${entry.customerId}`} highlight />
                  <InfoRow label="Commodity type" value={type?.name || `Type #${entry.commodityTypeId}`} />
                  <div className="flex flex-wrap gap-3">
                    <InfoRow label="Size" value={entry.containerSize} />
                    <InfoRow label="Price" value={Number(entry.price).toFixed(2)} highlight />
                  </div>
                  <div className="mt-1 flex gap-2">
                    <BtnSecondary className="flex-1 justify-center" onClick={() => openEditCtcp(entry)}>
                      Edit
                    </BtnSecondary>
                    <BtnDanger
                      className="flex-1 justify-center"
                      onClick={() =>
                        setPricingState((prev) => ({
                          ...prev,
                          commodityTypeCustomerPrices: prev.commodityTypeCustomerPrices.filter((item) => item.id !== entry.id),
                        }))
                      }
                    >
                      Delete
                    </BtnDanger>
                  </div>
                </>
              );
            }}
            desktopTemplate="1fr 1fr 80px 100px 100px"
          />
        )}
      </SectionCard>

      <SectionCard
        title="4. Commodity + Customer price (contract)"
        description="Most specific contract price. Overrides every other level for that customer, commodity, and container size."
        isMobile={isMobile}
      >
        <div className="mb-3">
          <BtnPrimary onClick={openAddCcp} className={cn(isMobile && "w-full justify-center")}>
            + Add commodity + customer price
          </BtnPrimary>
        </div>
        {commodityCustomerPrices.length === 0 ? (
          <p className="text-[13px] text-slate-400">No commodity + customer prices yet.</p>
        ) : (
          <ListSection
            isMobile={isMobile}
            entries={commodityCustomerPrices}
            columns={["Customer", "Commodity", "Size", "Price", "Actions"]}
            renderDesktop={(entry) => {
              const customer = customers.find((item) => item.id === entry.customerId);
              const commodity = commodities.find((item) => item.id === entry.commodityId);
              const type = commodityTypes.find((item) => item.id === commodity?.commodityTypeId);
              return (
                <>
                  <span className="font-medium text-slate-800">{customer?.name || `Customer #${entry.customerId}`}</span>
                  <span className="text-slate-600">
                    {commodity
                      ? `${commodity.description || commodity.commodityCode} (${type?.name || ""})`
                      : `Commodity #${entry.commodityId}`}
                  </span>
                  <span className="text-slate-600">{entry.containerSize}</span>
                  <span className="font-semibold text-blue-700">{Number(entry.price).toFixed(2)}</span>
                  <span className="flex gap-1">
                    <BtnSecondary className="px-2 py-1 text-[11px]" onClick={() => openEditCcp(entry)}>
                      Edit
                    </BtnSecondary>
                    <BtnDanger
                      className="px-2 py-1 text-[11px]"
                      onClick={() =>
                        setPricingState((prev) => ({
                          ...prev,
                          commodityCustomerPrices: prev.commodityCustomerPrices.filter((item) => item.id !== entry.id),
                        }))
                      }
                    >
                      Delete
                    </BtnDanger>
                  </span>
                </>
              );
            }}
            renderMobile={(entry) => {
              const customer = customers.find((item) => item.id === entry.customerId);
              const commodity = commodities.find((item) => item.id === entry.commodityId);
              const type = commodityTypes.find((item) => item.id === commodity?.commodityTypeId);
              return (
                <>
                  <InfoRow label="Customer" value={customer?.name || `Customer #${entry.customerId}`} highlight />
                  <InfoRow
                    label="Commodity"
                    value={
                      commodity
                        ? `${commodity.description || commodity.commodityCode} (${type?.name || ""})`
                        : `Commodity #${entry.commodityId}`
                    }
                  />
                  <div className="flex flex-wrap gap-3">
                    <InfoRow label="Size" value={entry.containerSize} />
                    <InfoRow label="Price" value={Number(entry.price).toFixed(2)} highlight />
                  </div>
                  <div className="mt-1 flex gap-2">
                    <BtnSecondary className="flex-1 justify-center" onClick={() => openEditCcp(entry)}>
                      Edit
                    </BtnSecondary>
                    <BtnDanger
                      className="flex-1 justify-center"
                      onClick={() =>
                        setPricingState((prev) => ({
                          ...prev,
                          commodityCustomerPrices: prev.commodityCustomerPrices.filter((item) => item.id !== entry.id),
                        }))
                      }
                    >
                      Delete
                    </BtnDanger>
                  </div>
                </>
              );
            }}
            desktopTemplate="1fr 1fr 80px 100px 100px"
          />
        )}
      </SectionCard>

      <PriceModal
        open={cpModalOpen}
        title={cpEditId ? "Edit commodity price" : "Add commodity price"}
        onClose={() => setCpModalOpen(false)}
        onSave={saveCp}
      >
        <FormRow label="Commodity" required>
          <select className={inputClass} value={cpForm.commodityId} onChange={(event) => setCpForm({ ...cpForm, commodityId: event.target.value })}>
            <option value="">Select commodity</option>
            {commodities.map((item) => {
              const type = commodityTypes.find((typeItem) => typeItem.id === item.commodityTypeId);
              return (
                <option key={item.id} value={item.id}>
                  {item.description || item.commodityCode} ({type?.name || "Unknown"})
                </option>
              );
            })}
          </select>
        </FormRow>
        <FormRow label="Container size" required>
          <select className={inputClass} value={cpForm.containerSize} onChange={(event) => setCpForm({ ...cpForm, containerSize: event.target.value })}>
            {containerSizes.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </FormRow>
        <FormRow label="Price" required>
          <input
            className={inputClass}
            type="number"
            min={0}
            step={0.01}
            value={cpForm.price}
            onWheel={(event) => event.currentTarget.blur()}
            onChange={(event) => setCpForm({ ...cpForm, price: event.target.value })}
            placeholder="0"
          />
        </FormRow>
      </PriceModal>

      <PriceModal
        open={ctcpModalOpen}
        title={ctcpEditId ? "Edit commodity type + customer price" : "Add commodity type + customer price"}
        onClose={() => setCtcpModalOpen(false)}
        onSave={saveCtcp}
      >
        <FormRow label="Customer" required>
          <select className={inputClass} value={ctcpForm.customerId} onChange={(event) => setCtcpForm({ ...ctcpForm, customerId: event.target.value })}>
            <option value="">Select customer</option>
            {customers.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} ({item.code})
              </option>
            ))}
          </select>
        </FormRow>
        <FormRow label="Commodity type" required>
          <select
            className={inputClass}
            value={ctcpForm.commodityTypeId}
            onChange={(event) => setCtcpForm({ ...ctcpForm, commodityTypeId: event.target.value })}
          >
            <option value="">Select commodity type</option>
            {commodityTypes.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </FormRow>
        <FormRow label="Container size" required>
          <select className={inputClass} value={ctcpForm.containerSize} onChange={(event) => setCtcpForm({ ...ctcpForm, containerSize: event.target.value })}>
            {containerSizes.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </FormRow>
        <FormRow label="Price" required>
          <input
            className={inputClass}
            type="number"
            min={0}
            step={0.01}
            value={ctcpForm.price}
            onWheel={(event) => event.currentTarget.blur()}
            onChange={(event) => setCtcpForm({ ...ctcpForm, price: event.target.value })}
            placeholder="0"
          />
        </FormRow>
      </PriceModal>

      <PriceModal
        open={ccpModalOpen}
        title={ccpEditId ? "Edit commodity + customer price" : "Add commodity + customer price"}
        onClose={() => setCcpModalOpen(false)}
        onSave={saveCcp}
      >
        <FormRow label="Customer" required>
          <select className={inputClass} value={ccpForm.customerId} onChange={(event) => setCcpForm({ ...ccpForm, customerId: event.target.value })}>
            <option value="">Select customer</option>
            {customers.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} ({item.code})
              </option>
            ))}
          </select>
        </FormRow>
        <FormRow label="Commodity" required>
          <select className={inputClass} value={ccpForm.commodityId} onChange={(event) => setCcpForm({ ...ccpForm, commodityId: event.target.value })}>
            <option value="">Select commodity</option>
            {commodities.map((item) => {
              const type = commodityTypes.find((typeItem) => typeItem.id === item.commodityTypeId);
              return (
                <option key={item.id} value={item.id}>
                  {item.description || item.commodityCode} ({type?.name || "Unknown"})
                </option>
              );
            })}
          </select>
        </FormRow>
        <FormRow label="Container size" required>
          <select className={inputClass} value={ccpForm.containerSize} onChange={(event) => setCcpForm({ ...ccpForm, containerSize: event.target.value })}>
            {containerSizes.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </FormRow>
        <FormRow label="Price" required>
          <input
            className={inputClass}
            type="number"
            min={0}
            step={0.01}
            value={ccpForm.price}
            onWheel={(event) => event.currentTarget.blur()}
            onChange={(event) => setCcpForm({ ...ccpForm, price: event.target.value })}
            placeholder="0"
          />
        </FormRow>
      </PriceModal>
    </div>
  );
}

function ListSection({ isMobile, entries, columns, renderDesktop, renderMobile, desktopTemplate }) {
  if (isMobile) {
    return (
      <div className="space-y-2.5">
        {entries.map((entry) => (
          <div key={entry.id} className="space-y-2.5 rounded-[10px] border border-slate-200 bg-white p-3">
            {renderMobile(entry)}
          </div>
        ))}
      </div>
    );
  }

  return (
    <>
      <div
        className="mb-2 grid items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500"
        style={{ gridTemplateColumns: desktopTemplate }}
      >
        {columns.map((column) => (
          <span key={column}>{column}</span>
        ))}
      </div>
      {entries.map((entry) => (
        <div
          key={entry.id}
          className="grid items-center gap-2 border-b border-slate-100 py-2 text-[13px] last:border-b-0"
          style={{ gridTemplateColumns: desktopTemplate }}
        >
          {renderDesktop(entry)}
        </div>
      ))}
    </>
  );
}

function PriceModal({ open, title, onClose, onSave, children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button type="button" className="absolute inset-0 bg-black/40" aria-label="Close dialog" onClick={onClose} />
      <div className="relative w-full max-w-[440px] rounded-xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
          <button type="button" className="rounded px-2 py-1 text-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800" onClick={onClose}>
            x
          </button>
        </div>
        <div className="space-y-3 p-4">{children}</div>
        <div className="flex justify-end gap-2 border-t border-slate-100 px-4 py-3">
          <BtnSecondary onClick={onClose}>Cancel</BtnSecondary>
          <BtnPrimary onClick={onSave}>Save</BtnPrimary>
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

function BtnDanger({ className, ...props }) {
  return (
    <button
      className={cn(
        "inline-flex items-center rounded-md bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  );
}
