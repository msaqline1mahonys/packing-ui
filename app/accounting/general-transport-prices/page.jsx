"use client";

import { useEffect, useMemo, useState } from "react";

import { DEFAULT_CONTAINER_SIZES, GENERAL_TRANSPORT_PRICE_ROWS, TRANSPORTER_MASTER_ROWS } from "@/lib/Data";
import { cn } from "@/lib/utils";

const MOBILE_BREAKPOINT = 900;
const CONTAINER_SIZES = DEFAULT_CONTAINER_SIZES.map((size) => size.toLowerCase());

const inputClass =
  "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-blue-100 placeholder:text-slate-400 focus:border-blue-500 focus:ring-2";
const filterInputClass =
  "w-full rounded-md border border-slate-200/90 bg-white px-2 py-1 text-xs text-slate-800 outline-none placeholder:text-slate-400 focus:border-brand/35 focus:ring-1 focus:ring-brand/25";

const initialTransportPrices = GENERAL_TRANSPORT_PRICE_ROWS;

function nextId(items) {
  return Math.max(0, ...items.map((item) => Number(item.id) || 0)) + 1;
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

export default function GeneralTransportPricesPage() {
  const [rows, setRows] = useState(initialTransportPrices);
  const [search, setSearch] = useState("");
  const [colFilters, setColFilters] = useState({
    transporter: "",
    containerSize: "",
    lineItemDescription: "",
    price: "",
  });
  const [selectedId, setSelectedId] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [formData, setFormData] = useState({
    transporterId: "",
    containerSize: "10ft",
    lineItemDescription: "",
    price: "0",
  });

  const transporterOptions = useMemo(
    () =>
      TRANSPORTER_MASTER_ROWS.map((item) => ({
        id: item.id,
        label: item.name,
      })),
    []
  );

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const handler = () => setIsMobile(mq.matches);
    handler();
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const filtered = useMemo(() => {
    return rows
      .filter((row) => {
        const transporter = transporterOptions.find((item) => item.id === row.transporterId);
        const q = search.trim().toLowerCase();
        if (q) {
          const text = `${transporter?.label || ""} ${row.containerSize || ""} ${row.lineItemDescription || ""} ${row.price || ""}`.toLowerCase();
          if (!text.includes(q)) return false;
        }

        const matchers = {
          transporter: transporter?.label || "",
          containerSize: row.containerSize || "",
          lineItemDescription: row.lineItemDescription || "",
          price: row.price ?? "",
        };

        for (const key of Object.keys(colFilters)) {
          const value = colFilters[key].trim().toLowerCase();
          if (!value) continue;
          if (!String(matchers[key]).toLowerCase().includes(value)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const aName = transporterOptions.find((item) => item.id === a.transporterId)?.label || "";
        const bName = transporterOptions.find((item) => item.id === b.transporterId)?.label || "";
        return aName.localeCompare(bName);
      });
  }, [rows, search, colFilters, transporterOptions]);

  const selected = filtered.find((row) => row.id === selectedId) || null;

  function openCreateModal() {
    setEditMode(false);
    setFormData({
      transporterId: "",
      containerSize: "10ft",
      lineItemDescription: "",
      price: "0",
    });
    setModalOpen(true);
  }

  function openEditModal() {
    if (!selected) return;
    setEditMode(true);
    setFormData({
      transporterId: String(selected.transporterId),
      containerSize: selected.containerSize || "10ft",
      lineItemDescription: selected.lineItemDescription || "",
      price: selected.price != null ? String(selected.price) : "0",
    });
    setModalOpen(true);
  }

  function handleSubmit() {
    if (!formData.transporterId) {
      window.alert("Transporter is required");
      return;
    }
    if (!formData.containerSize) {
      window.alert("Container size is required");
      return;
    }
    const parsedPrice = Number.parseFloat(formData.price);
    if (!Number.isFinite(parsedPrice) || parsedPrice < 0) {
      window.alert("Price must be a valid number greater than or equal to 0");
      return;
    }

    const payload = {
      transporterId: Number(formData.transporterId),
      containerSize: formData.containerSize,
      lineItemDescription: formData.lineItemDescription.trim(),
      price: parsedPrice,
    };

    setRows((prev) => {
      if (editMode && selected) {
        return prev.map((item) => (item.id === selected.id ? { ...item, ...payload } : item));
      }
      return [{ id: nextId(prev), ...payload }, ...prev];
    });

    setModalOpen(false);
  }

  function handleDelete() {
    if (!selected) return;
    const transporterName = transporterOptions.find((item) => item.id === selected.transporterId)?.label || "this transport price";
    if (window.confirm(`Delete "${transporterName}" transport price permanently?`)) {
      setRows((prev) => prev.filter((item) => item.id !== selected.id));
      setSelectedId(null);
    }
  }

  return (
    <div className="space-y-4 md:space-y-5">
      <div className="space-y-1">
        <p className="text-xs text-slate-500">Accounting / General Transport Prices</p>
        <h1 className="text-2xl font-semibold tracking-tight text-[#0f1e3d] md:text-[1.65rem]">General Transport Prices</h1>
        {!isMobile ? (
          <p className="text-xs leading-relaxed text-slate-500">Manage transporter transport prices by container size.</p>
        ) : null}
      </div>

      <div
        className={cn(
          "flex flex-wrap items-center justify-between gap-3 rounded-[10px] border border-slate-200 bg-white",
          isMobile ? "flex-col px-[14px] py-3" : "px-[18px] py-[14px]"
        )}
      >
        <div className={cn("relative", isMobile ? "w-full" : "max-w-[400px] flex-[1_1_220px]")}>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search transport prices..."
            className={inputClass}
          />
        </div>

        <div className={cn("flex gap-1.5", isMobile && "w-full")}>
          <BtnPrimary onClick={openCreateModal} className={cn(isMobile && "flex-1 justify-center")}>
            + Add Price
          </BtnPrimary>
          {isMobile && selected ? (
            <BtnPrimary onClick={openEditModal} className="flex-1 justify-center">
              View / Edit
            </BtnPrimary>
          ) : (
            <BtnSecondary onClick={openEditModal} disabled={!selected} className={cn(isMobile && "flex-1 justify-center")}>
              Edit
            </BtnSecondary>
          )}
          <BtnDanger onClick={handleDelete} disabled={!selected} className={cn(isMobile && "flex-1 justify-center")}>
            Delete
          </BtnDanger>
        </div>
      </div>

      <div className={cn("flex gap-4", isMobile && "flex-col")}>
        <div className="min-w-0 flex-1 overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/95">
                  <th className="px-3 py-2.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">Transporter</th>
                  <th className="px-3 py-2.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">Container Size</th>
                  <th className="px-3 py-2.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">Line-item Description</th>
                  <th className="px-3 py-2.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">Price</th>
                </tr>
                <tr className="border-b border-slate-200 bg-white">
                  <th className="px-2 py-1.5">
                    <input
                      className={filterInputClass}
                      placeholder="Filter..."
                      value={colFilters.transporter}
                      onChange={(event) => setColFilters((prev) => ({ ...prev, transporter: event.target.value }))}
                      aria-label="Filter transporter"
                    />
                  </th>
                  <th className="px-2 py-1.5">
                    <input
                      className={filterInputClass}
                      placeholder="Filter..."
                      value={colFilters.containerSize}
                      onChange={(event) => setColFilters((prev) => ({ ...prev, containerSize: event.target.value }))}
                      aria-label="Filter container size"
                    />
                  </th>
                  <th className="px-2 py-1.5">
                    <input
                      className={filterInputClass}
                      placeholder="Filter..."
                      value={colFilters.lineItemDescription}
                      onChange={(event) => setColFilters((prev) => ({ ...prev, lineItemDescription: event.target.value }))}
                      aria-label="Filter line-item description"
                    />
                  </th>
                  <th className="px-2 py-1.5">
                    <input
                      className={filterInputClass}
                      placeholder="Filter..."
                      value={colFilters.price}
                      onChange={(event) => setColFilters((prev) => ({ ...prev, price: event.target.value }))}
                      aria-label="Filter price"
                    />
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-14 text-center text-sm text-slate-400">
                      {search ? "No transport prices match your search." : "No transport prices yet. Add your first one!"}
                    </td>
                  </tr>
                ) : (
                  filtered.map((row) => {
                    const transporter = transporterOptions.find((item) => item.id === row.transporterId);
                    const isSelected = row.id === selectedId;
                    return (
                      <tr
                        key={row.id}
                        onClick={() => setSelectedId((prev) => (prev === row.id ? null : row.id))}
                        className={cn(
                          "cursor-pointer border-b border-slate-100 transition-colors last:border-0",
                          isSelected ? "bg-brand/[0.07]" : "hover:bg-slate-50/90"
                        )}
                      >
                        <td className="px-3 py-2.5 text-slate-700">{transporter?.label || "—"}</td>
                        <td className="px-3 py-2.5 text-slate-700">{row.containerSize || "—"}</td>
                        <td className="px-3 py-2.5 text-slate-700">{row.lineItemDescription || "—"}</td>
                        <td className="px-3 py-2.5 text-slate-700">{row.price != null ? Number(row.price) : "—"}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {!isMobile ? (
          <div className="max-h-[600px] w-[360px] min-w-0 flex-[0_0_360px] overflow-y-auto rounded-[10px] border border-slate-200 bg-white p-[18px]">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-[13px] font-bold text-[#0f1e3d]">Transport Price Details</span>
              {selected ? (
                <button
                  type="button"
                  onClick={() => setSelectedId(null)}
                  title="Clear selection"
                  aria-label="Clear selection"
                  className="rounded px-1 text-lg leading-none text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                >
                  ×
                </button>
              ) : null}
            </div>
            {selected ? (
              <div className="space-y-3.5">
                <InfoRow
                  label="Transporter"
                  value={transporterOptions.find((item) => item.id === selected.transporterId)?.label || "-"}
                  highlight
                />
                <InfoRow label="Container size" value={selected.containerSize || "-"} />
                <InfoRow label="Line-item description" value={selected.lineItemDescription || "-"} />
                <InfoRow label="Price" value={selected.price != null ? String(selected.price) : "-"} />
                <div className="mt-3 border-t border-slate-100 pt-3.5">
                  <BtnSecondary onClick={openEditModal} className="mb-2 w-full justify-center">
                    Edit
                  </BtnSecondary>
                  <BtnDanger onClick={handleDelete} className="w-full justify-center">
                    Delete
                  </BtnDanger>
                </div>
              </div>
            ) : (
              <div className="pt-5 text-center text-[12.5px] text-slate-400">Select a transport price to view details</div>
            )}
          </div>
        ) : null}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editMode ? "Edit transporter transport price" : "Add transporter transport price"} width={520}>
        <FormRow label="Transporter" required>
          <Select
            value={formData.transporterId}
            onChange={(event) => setFormData({ ...formData, transporterId: event.target.value })}
          >
            <option value="">Select transporter</option>
            {transporterOptions.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </Select>
        </FormRow>

        <FormRow label="Container size" required>
          <Select
            value={formData.containerSize}
            onChange={(event) => setFormData({ ...formData, containerSize: event.target.value })}
          >
            {CONTAINER_SIZES.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </Select>
        </FormRow>

        <FormRow label="Line-item description">
          <Input
            value={formData.lineItemDescription}
            onChange={(event) => setFormData({ ...formData, lineItemDescription: event.target.value })}
            placeholder="e.g. Transport - 20ft"
          />
        </FormRow>

        <FormRow label="Price" required>
          <Input
            type="number"
            min={0}
            step={0.01}
            value={formData.price}
            onWheel={(event) => event.currentTarget.blur()}
            onChange={(event) => setFormData({ ...formData, price: event.target.value })}
            placeholder="0"
          />
        </FormRow>

        <div className="mt-5 flex justify-end gap-2">
          <BtnSecondary onClick={() => setModalOpen(false)}>Cancel</BtnSecondary>
          <BtnPrimary onClick={handleSubmit}>{editMode ? "Save" : "Add"}</BtnPrimary>
        </div>
      </Modal>
    </div>
  );
}

function Modal({ open, title, onClose, width, children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button type="button" className="absolute inset-0 bg-black/40" aria-label="Close dialog" onClick={onClose} />
      <div className="relative w-full rounded-xl border border-slate-300 bg-white shadow-xl" style={{ maxWidth: `${width}px` }}>
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 className="text-sm font-bold text-[#20314d]">{title}</h2>
          <button type="button" onClick={onClose} className="rounded px-1 text-xl leading-none text-slate-500 hover:bg-slate-100 hover:text-slate-700">
            ×
          </button>
        </div>
        <div className="space-y-3 px-6 py-4">{children}</div>
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

function Input({ className, ...props }) {
  return <input className={cn(inputClass, className)} {...props} />;
}

function Select({ className, ...props }) {
  return <select className={cn(inputClass, className)} {...props} />;
}

function BtnPrimary({ className, ...props }) {
  return (
    <button
      className={cn(
        "inline-flex items-center rounded-md bg-[#2563eb] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#1d4ed8] disabled:cursor-not-allowed disabled:opacity-50",
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
        "inline-flex items-center rounded-md border border-blue-200 bg-white px-4 py-2 text-sm font-semibold text-[#1d4ed8] transition-colors hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50",
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
        "inline-flex items-center rounded-md bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  );
}
