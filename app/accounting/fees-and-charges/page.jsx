"use client";

import { useEffect, useMemo, useState } from "react";

import { CHARGE_CLASSIFICATIONS, CHARGE_TYPES, FEES_AND_CHARGES_ROWS } from "@/lib/Data";
import { cn } from "@/lib/utils";

const MOBILE_BREAKPOINT = 900;

const inputClass =
  "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-blue-100 placeholder:text-slate-400 focus:border-blue-500 focus:ring-2";
const filterInputClass =
  "w-full rounded-md border border-slate-200/90 bg-white px-2 py-1 text-xs text-slate-800 outline-none placeholder:text-slate-400 focus:border-brand/35 focus:ring-1 focus:ring-brand/25";

const initialFeesAndCharges = FEES_AND_CHARGES_ROWS;

function getClassLabel(charge) {
  if (charge.chargeClassification === "revenue") return "Revenue";
  if (charge.chargeClassification === "expense") return "Expense";
  if (charge.chargeClassification === "both") return "Both";
  return "-";
}

function InfoRow({ label, value, highlight }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[11px] font-semibold text-slate-500">{label}</span>
      <span className={cn("break-words text-[13px] font-medium text-slate-800", highlight && "font-semibold text-blue-700")}>
        {value ?? "-"}
      </span>
    </div>
  );
}

function MobileChargeList({ filtered, selectedId, onSelectCharge, search }) {
  const emptyMessage = search ? "No charges match your search." : "No charges yet. Add your first one!";

  return (
    <div className="flex flex-col gap-2">
      <div className="px-0.5 py-1 text-xs font-semibold text-slate-600">Charges ({filtered.length})</div>
      {filtered.length === 0 ? (
        <div className="p-8 text-center text-[13px] text-slate-400">{emptyMessage}</div>
      ) : (
        filtered.map((charge) => {
          const isSelected = charge.id === selectedId;
          return (
            <div
              key={charge.id}
              role="button"
              tabIndex={0}
              onClick={() => onSelectCharge(isSelected ? null : charge.id)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onSelectCharge(isSelected ? null : charge.id);
                }
              }}
              className={cn(
                "min-h-0 cursor-pointer rounded-[10px] border-2 bg-white p-3 transition-all",
                isSelected ? "border-blue-500 bg-blue-50" : "border-slate-200"
              )}
            >
              <div className="mb-1 flex items-start justify-between gap-2">
                <span className="text-xs font-bold text-blue-600">{charge.chargeName || "-"}</span>
                <span className="text-[11px] font-semibold text-slate-500">
                  {charge.chargeType || "-"} · {getClassLabel(charge)}
                </span>
              </div>
              <div className="mb-1 break-words text-[13px] text-slate-500">{charge.chargeDescription || "-"}</div>
              <div className="text-xs font-semibold text-slate-800">
                Rate: {charge.chargeRate != null ? Number(charge.chargeRate) : "-"}
                {charge.accountCode ? ` · ${charge.accountCode}` : ""}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

function nextId(items) {
  return Math.max(0, ...items.map((item) => Number(item.id) || 0)) + 1;
}

export default function FeesAndChargesPage() {
  const [feesAndCharges, setFeesAndCharges] = useState(initialFeesAndCharges);
  const [search, setSearch] = useState("");
  const [colFilters, setColFilters] = useState({
    chargeName: "",
    chargeDescription: "",
    chargeRate: "",
    chargeType: "",
    chargeClassification: "",
    accountCode: "",
    applyToAllPacks: "",
  });
  const [selectedId, setSelectedId] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [formData, setFormData] = useState({
    chargeName: "",
    chargeDescription: "",
    chargeRate: "",
    chargeType: "Per Container",
    applyToAllPacks: true,
    chargeClassification: "revenue",
    accountCode: "",
  });

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const handler = () => setIsMobile(mq.matches);
    handler();
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const filtered = useMemo(() => {
    const columnValue = (charge, key) => {
      if (key === "chargeClassification") return getClassLabel(charge);
      if (key === "applyToAllPacks") return charge.applyToAllPacks ? "Yes" : "No";
      return charge[key] ?? "";
    };

    return feesAndCharges
      .filter((charge) => {
        const q = search.trim().toLowerCase();
        if (q) {
          const text =
            `${charge.chargeName || ""} ${charge.chargeDescription || ""} ${charge.chargeType || ""} ` +
            `${getClassLabel(charge)} ${charge.accountCode || ""} ${charge.chargeRate ?? ""} ${
              charge.applyToAllPacks ? "Yes" : "No"
            }`;
          if (!text.toLowerCase().includes(q)) return false;
        }

        for (const key of Object.keys(colFilters)) {
          const value = colFilters[key].trim().toLowerCase();
          if (!value) continue;
          if (!String(columnValue(charge, key)).toLowerCase().includes(value)) return false;
        }
        return true;
      })
      .sort((a, b) => (a.chargeName || "").localeCompare(b.chargeName || ""));
  }, [feesAndCharges, search, colFilters]);

  const selected = filtered.find((charge) => charge.id === selectedId) || null;

  function openCreateModal() {
    setEditMode(false);
    setFormData({
      chargeName: "",
      chargeDescription: "",
      chargeRate: "",
      chargeType: "Per Container",
      applyToAllPacks: true,
      chargeClassification: "revenue",
      accountCode: "",
    });
    setModalOpen(true);
  }

  function openEditModal() {
    if (!selected) return;
    setEditMode(true);
    setFormData({
      chargeName: selected.chargeName || "",
      chargeDescription: selected.chargeDescription || "",
      chargeRate: selected.chargeRate != null ? String(selected.chargeRate) : "",
      chargeType: selected.chargeType || "Per Container",
      applyToAllPacks: selected.applyToAllPacks !== false,
      chargeClassification: selected.chargeClassification || "revenue",
      accountCode: selected.accountCode || "",
    });
    setModalOpen(true);
  }

  function handleSubmit() {
    if (!formData.chargeName.trim()) {
      window.alert("Charge Name is required");
      return;
    }
    const rate = Number.parseFloat(formData.chargeRate);
    if (formData.chargeRate !== "" && (!Number.isFinite(rate) || rate < 0)) {
      window.alert("Charge Rate must be a valid number greater than or equal to 0");
      return;
    }

    const chargeData = {
      chargeName: formData.chargeName.trim(),
      chargeDescription: formData.chargeDescription.trim(),
      chargeRate: formData.chargeRate === "" ? 0 : rate,
      chargeType: formData.chargeType,
      applyToAllPacks: formData.applyToAllPacks,
      chargeClassification: formData.chargeClassification,
      accountCode: formData.accountCode.trim(),
    };

    setFeesAndCharges((prev) => {
      if (editMode && selected) {
        return prev.map((item) => (item.id === selected.id ? { ...item, ...chargeData } : item));
      }
      return [{ id: nextId(prev), ...chargeData }, ...prev];
    });

    setModalOpen(false);
    setFormData({
      chargeName: "",
      chargeDescription: "",
      chargeRate: "",
      chargeType: "Per Container",
      applyToAllPacks: true,
      chargeClassification: "revenue",
      accountCode: "",
    });
  }

  function handleDelete() {
    if (!selected) return;
    if (window.confirm(`Delete charge "${selected.chargeName}" permanently?`)) {
      setFeesAndCharges((prev) => prev.filter((item) => item.id !== selected.id));
      setSelectedId(null);
    }
  }

  return (
    <div className="space-y-4 md:space-y-5">
      <div className="space-y-1">
        <p className="text-xs text-slate-500">Accounting / Fees and Charges</p>
        <h1 className="text-2xl font-semibold tracking-tight text-[#0f1e3d] md:text-[1.65rem]">Fees and Charges</h1>
        {!isMobile ? (
          <p className="text-xs leading-relaxed text-slate-500">
            Additional fees and charges that can be added to invoices and bills.
          </p>
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
            placeholder="Search charges..."
            className={inputClass}
          />
        </div>

        <div className={cn("flex gap-1.5", isMobile && "w-full")}>
          <BtnPrimary onClick={openCreateModal} className={cn(isMobile && "flex-1 justify-center")}>
            + Add Charge
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
        {isMobile ? (
          <MobileChargeList filtered={filtered} selectedId={selectedId} onSelectCharge={setSelectedId} search={search} />
        ) : (
          <div className="min-w-0 flex-1 overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/95">
                    <th className="px-3 py-2.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">Charge Name</th>
                    <th className="px-3 py-2.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">Description</th>
                    <th className="px-3 py-2.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">Rate</th>
                    <th className="px-3 py-2.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">Type</th>
                    <th className="px-3 py-2.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">Class.</th>
                    <th className="px-3 py-2.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">Account</th>
                    <th className="px-3 py-2.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">All Packs</th>
                  </tr>
                  <tr className="border-b border-slate-200 bg-white">
                    <th className="px-2 py-1.5">
                      <input
                        className={filterInputClass}
                        placeholder="Filter..."
                        value={colFilters.chargeName}
                        onChange={(event) => setColFilters((prev) => ({ ...prev, chargeName: event.target.value }))}
                        aria-label="Filter charge name"
                      />
                    </th>
                    <th className="px-2 py-1.5">
                      <input
                        className={filterInputClass}
                        placeholder="Filter..."
                        value={colFilters.chargeDescription}
                        onChange={(event) => setColFilters((prev) => ({ ...prev, chargeDescription: event.target.value }))}
                        aria-label="Filter description"
                      />
                    </th>
                    <th className="px-2 py-1.5">
                      <input
                        className={filterInputClass}
                        placeholder="Filter..."
                        value={colFilters.chargeRate}
                        onChange={(event) => setColFilters((prev) => ({ ...prev, chargeRate: event.target.value }))}
                        aria-label="Filter rate"
                      />
                    </th>
                    <th className="px-2 py-1.5">
                      <input
                        className={filterInputClass}
                        placeholder="Filter..."
                        value={colFilters.chargeType}
                        onChange={(event) => setColFilters((prev) => ({ ...prev, chargeType: event.target.value }))}
                        aria-label="Filter type"
                      />
                    </th>
                    <th className="px-2 py-1.5">
                      <input
                        className={filterInputClass}
                        placeholder="Filter..."
                        value={colFilters.chargeClassification}
                        onChange={(event) => setColFilters((prev) => ({ ...prev, chargeClassification: event.target.value }))}
                        aria-label="Filter classification"
                      />
                    </th>
                    <th className="px-2 py-1.5">
                      <input
                        className={filterInputClass}
                        placeholder="Filter..."
                        value={colFilters.accountCode}
                        onChange={(event) => setColFilters((prev) => ({ ...prev, accountCode: event.target.value }))}
                        aria-label="Filter account code"
                      />
                    </th>
                    <th className="px-2 py-1.5">
                      <input
                        className={filterInputClass}
                        placeholder="Filter..."
                        value={colFilters.applyToAllPacks}
                        onChange={(event) => setColFilters((prev) => ({ ...prev, applyToAllPacks: event.target.value }))}
                        aria-label="Filter all packs"
                      />
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-3 py-14 text-center text-sm text-slate-400">
                        {search ? "No charges match your search." : "No charges yet. Add your first one!"}
                      </td>
                    </tr>
                  ) : (
                    filtered.map((charge) => {
                      const isSelected = selectedId === charge.id;
                      return (
                        <tr
                          key={charge.id}
                          onClick={() => setSelectedId((prev) => (prev === charge.id ? null : charge.id))}
                          className={cn(
                            "cursor-pointer border-b border-slate-100 transition-colors last:border-0",
                            isSelected ? "bg-brand/[0.07]" : "hover:bg-slate-50/90"
                          )}
                        >
                          <td className="px-3 py-2.5 text-slate-700">{charge.chargeName || "—"}</td>
                          <td className="px-3 py-2.5 text-slate-700">
                            {(charge.chargeDescription || "-").slice(0, 40)}
                            {(charge.chargeDescription || "").length > 40 ? "..." : ""}
                          </td>
                          <td className="px-3 py-2.5 text-slate-700">{charge.chargeRate != null ? Number(charge.chargeRate) : "—"}</td>
                          <td className="px-3 py-2.5 text-slate-700">{charge.chargeType || "—"}</td>
                          <td className="px-3 py-2.5 text-slate-700">{getClassLabel(charge)}</td>
                          <td className="px-3 py-2.5 text-slate-700">{charge.accountCode || "—"}</td>
                          <td className="px-3 py-2.5 text-slate-700">{charge.applyToAllPacks ? "Yes" : "No"}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {!isMobile ? (
          <div className="max-h-[600px] w-[360px] min-w-0 flex-[0_0_360px] overflow-y-auto rounded-[10px] border border-slate-200 bg-white p-[18px]">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-[13px] font-bold text-[#0f1e3d]">Charge Details</span>
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
                <InfoRow label="Charge Name" value={selected.chargeName} highlight />
                <InfoRow label="Charge Description" value={selected.chargeDescription} />
                <InfoRow label="Charge Rate" value={selected.chargeRate != null ? String(selected.chargeRate) : null} />
                <InfoRow label="Charge Type" value={selected.chargeType} />
                <InfoRow
                  label="Revenue / Expense"
                  value={
                    selected.chargeClassification === "revenue"
                      ? "Revenue charge"
                      : selected.chargeClassification === "expense"
                        ? "Expense charge"
                        : selected.chargeClassification === "both"
                          ? "Both"
                          : "-"
                  }
                />
                <InfoRow label="Account code" value={selected.accountCode || "-"} />
                <InfoRow label="Apply to all packs" value={selected.applyToAllPacks ? "Yes" : "No"} />
                <div className="mt-3 border-t border-slate-100 pt-3.5">
                  <BtnSecondary onClick={openEditModal} className="mb-2 w-full justify-center">
                    Edit Charge
                  </BtnSecondary>
                  <BtnDanger onClick={handleDelete} className="w-full justify-center">
                    Delete Charge
                  </BtnDanger>
                </div>
              </div>
            ) : (
              <div className="pt-5 text-center text-[12.5px] text-slate-400">Select a charge to view details</div>
            )}
          </div>
        ) : null}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editMode ? "Edit Charge" : "Add Charge"} width={520}>
        <FormRow label="Charge Name" required>
          <Input
            value={formData.chargeName}
            onChange={(event) => setFormData({ ...formData, chargeName: event.target.value })}
            placeholder="e.g., Handling Fee"
          />
        </FormRow>

        <FormRow label="Charge Description">
          <Input
            value={formData.chargeDescription}
            onChange={(event) => setFormData({ ...formData, chargeDescription: event.target.value })}
            placeholder="e.g., Standard handling and administration"
          />
        </FormRow>

        <FormRow label="Charge Rate">
          <Input
            type="number"
            min={0}
            step={0.01}
            value={formData.chargeRate}
            onWheel={(event) => event.currentTarget.blur()}
            onChange={(event) => setFormData({ ...formData, chargeRate: event.target.value })}
            placeholder="0.00"
          />
        </FormRow>

        <FormRow label="Charge Type">
          <Select value={formData.chargeType} onChange={(event) => setFormData({ ...formData, chargeType: event.target.value })}>
            {CHARGE_TYPES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </FormRow>

        <FormRow label="Revenue / Expense">
          <Select
            value={formData.chargeClassification}
            onChange={(event) => setFormData({ ...formData, chargeClassification: event.target.value })}
          >
            {CHARGE_CLASSIFICATIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </FormRow>

        <FormRow label="Account code">
          <Input
            value={formData.accountCode}
            onChange={(event) => setFormData({ ...formData, accountCode: event.target.value })}
            placeholder="e.g. 4000, REV-001"
          />
        </FormRow>

        <FormRow label="Apply to all packs">
          <Select
            value={formData.applyToAllPacks ? "yes" : "no"}
            onChange={(event) => setFormData({ ...formData, applyToAllPacks: event.target.value === "yes" })}
          >
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </Select>
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
