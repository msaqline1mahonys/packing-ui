"use client";

import { useEffect, useMemo, useState } from "react";

import { Grid } from "@/components/clutch-table";
import { Button } from "@/components/ui/button";
import { createCharge, deleteCharge, listCharges, updateCharge } from "@/lib/api/accounting";
import { CHARGE_CLASSIFICATIONS, CHARGE_TYPES, FEES_AND_CHARGES_ROWS } from "@/lib/Data";
import { cn } from "@/lib/utils";

const MOBILE_BREAKPOINT = 900;

const inputClass =
  "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-blue-100 placeholder:text-slate-400 focus:border-blue-500 focus:ring-2";

function getClassLabel(charge) {
  if (charge.chargeClassification === "revenue") return "Revenue";
  if (charge.chargeClassification === "expense") return "Expense";
  if (charge.chargeClassification === "both") return "Both";
  return "-";
}

const gridColumns = [
  { key: "chargeName", header: "Charge Name", type: "text", sortable: true, filterable: true, resizable: true },
  { key: "chargeDescription", header: "Description", type: "text", sortable: true, filterable: true, resizable: true },
  {
    key: "chargeRate",
    header: "Rate",
    type: "number",
    sortable: true,
    filterable: true,
    resizable: true,
  },
  { key: "chargeType", header: "Type", type: "text", sortable: true, filterable: true, resizable: true },
  {
    key: "chargeClassification",
    header: "Classification",
    type: "text",
    sortable: true,
    filterable: true,
    resizable: true,
    renderCell: (row) => getClassLabel(row),
    valueGetter: (row) => getClassLabel(row),
  },
  { key: "accountCode", header: "Account Code", type: "text", sortable: true, filterable: true, resizable: true },
  {
    key: "applyToAllPacks",
    header: "All Packs",
    type: "text",
    sortable: true,
    filterable: true,
    resizable: true,
    renderCell: (row) => (row.applyToAllPacks ? "Yes" : "No"),
    valueGetter: (row) => (row.applyToAllPacks ? "Yes" : "No"),
  },
];

function nextId(items) {
  return Math.max(0, ...items.map((item) => Number(item.id) || 0)) + 1;
}

function MobileChargeList({ filtered, selectedId, onSelectCharge, search }) {
  const emptyMessage = search ? "No charges match your search." : "No charges yet. Add your first one!";
  return (
    <div className="space-y-2 p-3">
      <div className="px-0.5 text-xs font-semibold text-slate-600">Charges ({filtered.length})</div>
      {filtered.length === 0 ? (
        <div className="py-8 text-center text-sm text-slate-400">{emptyMessage}</div>
      ) : (
        filtered.map((charge) => {
          const isSelected = charge.id === selectedId;
          return (
            <button
              key={charge.id}
              type="button"
              onClick={() => onSelectCharge(isSelected ? null : charge.id)}
              className={cn(
                "w-full rounded-xl border-2 px-3 py-3 text-left transition-colors",
                isSelected ? "border-blue-500 bg-blue-50" : "border-slate-200 bg-white"
              )}
            >
              <p className="text-xs font-bold text-blue-600">{charge.chargeName || "-"}</p>
              <p className="mt-1 text-sm font-semibold text-slate-800">{charge.chargeType || "-"} · {getClassLabel(charge)}</p>
              <p className="mt-1 text-[11px] text-slate-500">
                Rate: {charge.chargeRate != null ? Number(charge.chargeRate) : "-"}
                {charge.accountCode ? ` · ${charge.accountCode}` : ""}
              </p>
            </button>
          );
        })
      )}
    </div>
  );
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

async function fetchCharges(setFeesAndCharges) {
  try {
    const rows = await listCharges();
    if (Array.isArray(rows)) setFeesAndCharges(rows);
  } catch {
    // keep existing state on error
  }
}

export default function FeesAndChargesPage() {
  const [feesAndCharges, setFeesAndCharges] = useState(FEES_AND_CHARGES_ROWS);
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
    fetchCharges(setFeesAndCharges);
  }, []);

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const handler = () => setIsMobile(mq.matches);
    handler();
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const selected = selectedId != null ? feesAndCharges.find((c) => c.id === selectedId) ?? null : null;

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

  async function handleSubmit() {
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

    try {
      if (editMode && selected) {
        await updateCharge(selected.id, chargeData);
      } else {
        await createCharge(chargeData);
      }
      await fetchCharges(setFeesAndCharges);
    } catch (err) {
      window.alert(err?.message || "Failed to save charge. Please try again.");
      return;
    }

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

  async function handleDelete() {
    if (!selected) return;
    if (window.confirm(`Delete charge "${selected.chargeName}" permanently?`)) {
      try {
        await deleteCharge(selected.id);
        await fetchCharges(setFeesAndCharges);
        setSelectedId(null);
      } catch (err) {
        window.alert(err?.message || "Failed to delete charge. Please try again.");
      }
    }
  }

  const mobileFiltered = useMemo(
    () => [...feesAndCharges].sort((a, b) => (a.chargeName || "").localeCompare(b.chargeName || "")),
    [feesAndCharges]
  );

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs text-slate-500">Accounting / Fees and Charges</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 md:text-[1.65rem]">Fees and Charges</h1>
        {!isMobile ? (
          <p className="mt-1 text-xs text-slate-500">Additional fees and charges that can be added to invoices and bills.</p>
        ) : null}
      </div>

      <div className={cn("grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(240px,320px)] xl:items-start", isMobile && "grid-cols-1")}>
        <div className="overflow-hidden rounded-xl bg-white shadow-sm">
          {isMobile ? (
            <>
              <div className="flex flex-wrap gap-2 border-b border-slate-100 p-3">
                <Button type="button" size="sm" onClick={openCreateModal}>+ Add Charge</Button>
                <Button type="button" variant="outline" size="sm" disabled={!selected} onClick={openEditModal}>Edit</Button>
                <Button type="button" variant="destructive" size="sm" disabled={!selected} onClick={handleDelete}>Delete</Button>
              </div>
              <MobileChargeList
                filtered={mobileFiltered}
                selectedId={selectedId}
                onSelectCharge={setSelectedId}
                search=""
              />
            </>
          ) : (
            <Grid
              columns={gridColumns}
              rows={feesAndCharges}
              getRowId={(row) => row.id}
              theme="light"
              density="standard"
              fileName="Fees and Charges"
              visibleRows={15}
              emptyMessage="No charges yet. Add your first one!"
              onRowClick={(row) => setSelectedId((prev) => (prev === row.id ? null : row.id))}
              onPersistedRowActivate={(row) => setSelectedId(row.id)}
              toolbarActions={
                <div className="flex flex-wrap gap-2">
                  <Button type="button" size="sm" onClick={openCreateModal}>+ Add Charge</Button>
                  <Button type="button" variant="outline" size="sm" disabled={!selected} onClick={openEditModal}>Edit</Button>
                  <Button type="button" variant="destructive" size="sm" disabled={!selected} onClick={handleDelete}>Delete</Button>
                </div>
              }
            />
          )}
        </div>

        {!isMobile ? (
          <aside className="rounded-xl border border-slate-200/90 bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">Charge Details</h2>
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
                <InfoRow label="Account Code" value={selected.accountCode || "-"} />
                <InfoRow label="Apply to all packs" value={selected.applyToAllPacks ? "Yes" : "No"} />
                <div className="mt-3 border-t border-slate-100 pt-3.5 space-y-2">
                  <Button type="button" variant="outline" size="sm" onClick={openEditModal} className="w-full justify-center">
                    Edit Charge
                  </Button>
                  <Button type="button" variant="destructive" size="sm" onClick={handleDelete} className="w-full justify-center">
                    Delete Charge
                  </Button>
                </div>
              </div>
            ) : (
              <p className="pt-5 text-center text-[12.5px] text-slate-400">Select a charge to view details</p>
            )}
          </aside>
        ) : null}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editMode ? "Edit Charge" : "Add Charge"}>
        <div className="grid gap-3 sm:grid-cols-2">
          <FormRow label="Charge Name" required className="sm:col-span-2">
            <Input
              value={formData.chargeName}
              onChange={(event) => setFormData({ ...formData, chargeName: event.target.value })}
              placeholder="e.g., Handling Fee"
            />
          </FormRow>

          <FormRow label="Charge Description" className="sm:col-span-2">
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

          <FormRow label="Account Code">
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
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={() => setModalOpen(false)}>Cancel</Button>
          <Button type="button" size="sm" onClick={handleSubmit}>{editMode ? "Save Changes" : "Add Charge"}</Button>
        </div>
      </Modal>
    </div>
  );
}

function Modal({ open, title, onClose, children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button type="button" className="absolute inset-0 bg-black/40" aria-label="Close dialog" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="fees-modal-title"
        className="relative max-h-[min(90vh,720px)] w-full max-w-2xl overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-4 py-3">
          <h2 id="fees-modal-title" className="text-sm font-semibold text-slate-900">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-2 py-1 text-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800"
          >
            ×
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}

function FormRow({ label, required, className, children }) {
  return (
    <div className={cn("space-y-1", className)}>
      <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">
        {label}
        {required ? <span className="text-red-500"> *</span> : null}
      </label>
      {children}
    </div>
  );
}

function Input({ className, ...props }) {
  return <input suppressHydrationWarning className={cn(inputClass, className)} {...props} />;
}

function Select({ className, ...props }) {
  return <select suppressHydrationWarning className={cn(inputClass, className)} {...props} />;
}
