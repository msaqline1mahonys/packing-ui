"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Button, buttonVariants } from "@/components/ui/button";
import { loadCmoRows, nextCmoId, saveCmoRows } from "@/lib/cmo-store";
import { cn } from "@/lib/utils";

const inputClass =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-brand/15 focus:border-brand/35 focus:ring-2";
const sectionClass = "rounded-xl border border-slate-200/95 bg-white p-5 shadow-sm";

const DIRECTION_OPTIONS = [
  { value: "incoming", label: "Incoming" },
  { value: "outgoing", label: "Outgoing" },
];
const CUSTOMER_OPTIONS = ["GrainCorp Trading", "Riverina Co-op", "Pacific Charter"];
const COMMODITY_TYPE_OPTIONS = ["Grain", "Oilseeds", "Fertiliser"];
const COMMODITY_OPTIONS = {
  Grain: ["Feed barley", "Wheat"],
  Oilseeds: ["Canola", "Sunflower"],
  Fertiliser: ["UREA", "DAP"],
};
const STATUS_OPTIONS = ["Open", "In Progress", "Completed", "Cancelled"];

function emptyForm() {
  return {
    direction: "incoming",
    customer: "",
    commodityType: "",
    commodity: "",
    status: STATUS_OPTIONS[0],
    estimatedAmount: "0",
    actualAmountDelivered: "0",
    additionalReferenceDraft: "",
    additionalReferences: [],
    attachments: [],
    note: "",
  };
}

export default function CmoForm() {
  const router = useRouter();
  const [form, setForm] = useState(() => emptyForm());

  const commodityChoices = useMemo(
    () => (form.commodityType ? COMMODITY_OPTIONS[form.commodityType] || [] : []),
    [form.commodityType]
  );

  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const addAdditionalReference = () => {
    const ref = form.additionalReferenceDraft.trim();
    if (!ref) return;
    setForm((prev) => ({
      ...prev,
      additionalReferences: [...prev.additionalReferences, ref],
      additionalReferenceDraft: "",
    }));
  };

  const removeAdditionalReference = (idx) => {
    setForm((prev) => ({
      ...prev,
      additionalReferences: prev.additionalReferences.filter((_, i) => i !== idx),
    }));
  };

  const canSave = form.customer && form.commodityType && form.commodity && form.status;

  const createCmo = () => {
    if (!canSave) return;

    const rows = loadCmoRows();
    const id = nextCmoId(rows);
    const cmoReference = `CMO-${String(id).padStart(4, "0")}`;

    const nextRow = {
      id,
      cmoReference,
      direction: form.direction,
      customer: form.customer,
      commodityType: form.commodityType,
      commodity: form.commodity,
      status: form.status,
      bookings: 0,
      estimatedAmount: form.estimatedAmount || "0",
      actualAmountDelivered: form.actualAmountDelivered || "0",
      additionalReferences: form.additionalReferences,
      attachments: form.attachments,
      note: form.note,
    };

    saveCmoRows([nextRow, ...rows]);
    router.push("/ticketing/cmo");
  };

  return (
    <div className="mx-auto w-full max-w-[min(92rem,calc(100%-2rem))] space-y-3 px-5 pt-2 pb-10 sm:px-6 sm:pt-3 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Create CMO</h1>
          <p className="mt-1 text-xs text-slate-500">Create and save a new CMO record.</p>
        </div>
        <Link href="/ticketing/cmo" className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
          Back
        </Link>
      </div>

      <section className={sectionClass}>
        <div className="space-y-4">
          <input suppressHydrationWarning className="h-10 w-full rounded-md border border-slate-200 bg-slate-100 px-3 text-xs font-semibold uppercase tracking-wide text-slate-500" value="CMO reference will be auto-generated" disabled readOnly />
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Field label="Direction" required>
              <select suppressHydrationWarning className={inputClass} value={form.direction} onChange={(e) => setField("direction", e.target.value)}>
                {DIRECTION_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Customer / Account" required>
              <select suppressHydrationWarning className={inputClass} value={form.customer} onChange={(e) => setField("customer", e.target.value)}>
                <option value="">â€” Select Customer / Account â€”</option>
                {CUSTOMER_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Status" required>
              <select suppressHydrationWarning className={inputClass} value={form.status} onChange={(e) => setField("status", e.target.value)}>
                <option value="">â€” Select Status â€”</option>
                {STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Commodity Type" required>
              <select
                className={inputClass}
                value={form.commodityType}
                onChange={(e) => {
                  setField("commodityType", e.target.value);
                  setField("commodity", "");
                }}
              >
                <option value="">â€” Select Commodity Type â€”</option>
                {COMMODITY_TYPE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Commodity" required>
              <select suppressHydrationWarning className={inputClass} value={form.commodity} onChange={(e) => setField("commodity", e.target.value)} disabled={!form.commodityType}>
                <option value="">â€” Select Commodity â€”</option>
                {commodityChoices.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Estimated Amount (T)">
              <input suppressHydrationWarning className={inputClass} inputMode="decimal" value={form.estimatedAmount} onChange={(e) => setField("estimatedAmount", e.target.value)} />
            </Field>

            <Field label="Actual Amount Delivered (T)">
              <input suppressHydrationWarning className={inputClass} inputMode="decimal" value={form.actualAmountDelivered} onChange={(e) => setField("actualAmountDelivered", e.target.value)} />
            </Field>
          </div>
        </div>
      </section>

      <section className={sectionClass}>
        <div className="grid gap-4 lg:grid-cols-2">
          <Field label="Additional References">
            <div className="flex gap-2">
              <input suppressHydrationWarning className={inputClass} value={form.additionalReferenceDraft} onChange={(e) => setField("additionalReferenceDraft", e.target.value)} placeholder="e.g. REF-2024-001" />
              <Button type="button" variant="secondary" onClick={addAdditionalReference}>
                + Add
              </Button>
            </div>
            {form.additionalReferences.length ? (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {form.additionalReferences.map((ref, index) => (
                  <button
                    key={`${ref}-${index}`}
                    type="button"
                    onClick={() => removeAdditionalReference(index)}
                    className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-700 hover:bg-slate-200"
                    title="Click to remove"
                  >
                    {ref}
                  </button>
                ))}
              </div>
            ) : null}
          </Field>

          <Field label="Attach Files">
            <div className="space-y-2">
              <input
                type="file"
                multiple
                className="block h-9 w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-sm text-slate-700 file:me-3 file:rounded file:border-0 file:bg-brand/10 file:px-2.5 file:py-1 file:text-xs file:font-semibold file:text-brand hover:file:bg-brand/15"
                onChange={(e) => {
                  const files = Array.from(e.target.files || []).map((file) => file.name);
                  setField("attachments", files);
                }}
              />
              {form.attachments.length ? (
                <div className="flex flex-wrap gap-1.5">
                  {form.attachments.map((fileName, index) => (
                    <span key={`${fileName}-${index}`} className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-700">
                      {fileName}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500">No files selected.</p>
              )}
            </div>
          </Field>
        </div>

        <div className="mt-4">
          <Field label="Note">
            <textarea suppressHydrationWarning className={`${inputClass} min-h-[90px] resize-y`} value={form.note} onChange={(e) => setField("note", e.target.value)} />
          </Field>
        </div>
      </section>

      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="ghost" onClick={() => router.push("/ticketing/cmo")}>
          Cancel
        </Button>
        <Button type="button" onClick={createCmo} disabled={!canSave}>
          Create CMO
        </Button>
      </div>
    </div>
  );
}

function Field({ label, required, children }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold uppercase tracking-wide text-slate-600">
        {label} {required ? <span className="text-rose-500">*</span> : null}
      </label>
      {children}
    </div>
  );
}