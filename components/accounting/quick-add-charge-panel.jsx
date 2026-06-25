"use client";

import { useState } from "react";

import ClutchSelect from "@/components/custom/ClutchSelect";
import { Button } from "@/components/ui/button";
import { createCharge } from "@/lib/api/accounting";
import { CHARGE_TYPES } from "@/lib/Data";
import { inputClassName, formLabelErrorClass } from "@/lib/form-styles";
import { normalizeChargeFromApi } from "@/lib/pack-invoice-breakdown";
import { cn } from "@/lib/utils";

const inputClass =
  "h-8 w-full rounded-md border border-slate-300 bg-white px-2.5 text-xs text-slate-800 outline-none focus:border-brand/40 focus:ring-2 focus:ring-brand/20";

const EMPTY_FORM = {
  chargeName: "",
  chargeRate: "",
  chargeType: "Per Invoice",
};

export default function QuickAddChargePanel({ disabled = false, onCreated }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState("");
  const [nameError, setNameError] = useState(false);
  const [saving, setSaving] = useState(false);

  function resetForm() {
    setForm(EMPTY_FORM);
    setError("");
    setNameError(false);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (disabled || saving) return;

    const chargeName = form.chargeName.trim();
    if (!chargeName) {
      setNameError(true);
      setError("Charge name is required.");
      return;
    }
    setNameError(false);

    const rate = form.chargeRate === "" ? 0 : Number.parseFloat(form.chargeRate);
    if (form.chargeRate !== "" && (!Number.isFinite(rate) || rate < 0)) {
      setError("Charge rate must be zero or greater.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const created = await createCharge({
        chargeName,
        chargeDescription: "",
        chargeRate: rate,
        chargeType: form.chargeType,
        applyToAllPacks: false,
        chargeClassification: "revenue",
        accountCode: "",
      });

      const charge = normalizeChargeFromApi(created);
      if (!charge) {
        throw new Error("Charge was created but could not be loaded.");
      }

      onCreated?.(charge);
      resetForm();
      setOpen(false);
    } catch (err) {
      setError(err?.message || "Failed to create charge.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="secondary"
        disabled={disabled}
        onClick={() => {
          setOpen((prev) => !prev);
          setError("");
          setNameError(false);
        }}
        className="h-7 shrink-0 px-2.5 text-[11px]"
      >
        {open ? "Hide quick add" : "Quick add fee/charge"}
      </Button>

      {open ? (
        <form
          onSubmit={handleSubmit}
          className="w-full basis-full rounded-lg border border-slate-200 bg-slate-50 p-3"
        >
          <p className="text-[11px] text-slate-600">
            Create a new fee or charge and add it to this breakdown in one step.
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(160px,1fr)_120px_170px_auto] sm:items-end">
            <label className="block space-y-1">
              <span className={cn("text-[10px] font-semibold uppercase tracking-wide", nameError ? formLabelErrorClass : "text-slate-500")}>Name</span>
              <input
                className={inputClassName(nameError, "h-8 text-xs")}
                value={form.chargeName}
                onChange={(event) => {
                  setNameError(false);
                  setForm((prev) => ({ ...prev, chargeName: event.target.value }));
                }}
                placeholder="e.g. Handling fee"
                disabled={saving}
              />
            </label>
            <label className="block space-y-1">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Rate</span>
              <input
                className={inputClass}
                type="number"
                min={0}
                step={0.01}
                value={form.chargeRate}
                onWheel={(event) => event.currentTarget.blur()}
                onChange={(event) => setForm((prev) => ({ ...prev, chargeRate: event.target.value }))}
                placeholder="0.00"
                disabled={saving}
              />
            </label>
            <label className="block space-y-1">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Type</span>
              <ClutchSelect
                className="text-xs"
                options={CHARGE_TYPES}
                value={CHARGE_TYPES.find((option) => option.value === form.chargeType) ?? null}
                onChange={(option) =>
                  setForm((prev) => ({ ...prev, chargeType: option ? option.value : "Per Invoice" }))
                }
                isClearable={false}
                isDisabled={saving}
                placeholder="Select type"
              />
            </label>
            <Button type="submit" size="sm" disabled={saving} className="h-8 px-3 text-[11px] sm:mb-0">
              {saving ? "Creating…" : "Create & add"}
            </Button>
          </div>
          {error ? <p className="mt-2 text-xs text-rose-700">{error}</p> : null}
        </form>
      ) : null}
    </>
  );
}
