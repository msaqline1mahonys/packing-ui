"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import { Button, buttonVariants } from "@/components/ui/button";
import ClutchSelect from "@/components/custom/ClutchSelect";
import { commodityOptionLabel } from "@/lib/commodity-display";
import { cn } from "@/lib/utils";
import {
  fetchCmo,
  fetchCmoFormData,
  saveCmo,
} from "@/lib/ticketing-api";
import { weightUnitLabel } from "@/lib/weight-units";
import SeasonSelect from "@/components/ticketing/season-select";

const inputClass =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-brand/15 focus:border-brand/35 focus:ring-2";
const sectionClass = "rounded-xl border border-slate-200/95 bg-white p-5 shadow-sm";

const DIRECTION_OPTIONS = [
  { value: "incoming", label: "Incoming" },
  { value: "outgoing", label: "Outgoing" },
];
const STATUS_OPTIONS = ["Open", "In Progress", "Completed", "Cancelled"];

function emptyForm() {
  return {
    cmoReference: "",
    direction: "incoming",
    customerId: "",
    commodityTypeId: "",
    commodityIds: [],
    status: STATUS_OPTIONS[0],
    season: "",
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
  const searchParams = useSearchParams();
  const editId = searchParams.get("edit");
  const isEdit = Boolean(editId);

  const [form, setForm] = useState(() => emptyForm());
  const [customers, setCustomers] = useState([]);
  const [commodityTypes, setCommodityTypes] = useState([]);
  const [commodities, setCommodities] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setIsLoading(true);
      setError("");
      try {
        const formData = await fetchCmoFormData();
        if (cancelled) return;
        setCustomers(formData.customers);
        setCommodityTypes(formData.commodityTypes);
        setCommodities(formData.commodities);

        if (editId) {
          const row = await fetchCmo(editId);
          if (cancelled || !row) return;
          setForm({
            cmoReference: row.cmoReference,
            direction: row.direction,
            customerId: row.customerId,
            commodityTypeId: row.commodityTypeId,
            commodityIds: row.commodityIds?.length
              ? row.commodityIds
              : row.commodityId
                ? [row.commodityId]
                : [],
            status: row.status,
            season: row.season ?? "",
            estimatedAmount: String(row.estimatedAmount),
            actualAmountDelivered: String(row.actualAmountDelivered),
            additionalReferenceDraft: "",
            additionalReferences: row.additionalReferences,
            attachments: row.attachments,
            note: row.note,
          });
        }
      } catch (err) {
        if (!cancelled) setError(err.message || "Failed to load CMO form data.");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [editId]);

  const commodityChoices = useMemo(
    () =>
      commodities.filter(
        (item) =>
          !form.commodityTypeId ||
          (item.commodity_type_id ?? item.commodityTypeId) === form.commodityTypeId
      ),
    [commodities, form.commodityTypeId]
  );

  const selectedCommodityUnit = useMemo(() => {
    const firstId = form.commodityIds[0];
    const comm = firstId ? commodities.find((c) => c.id === firstId) : null;
    return comm?.unitType ?? comm?.unit_type;
  }, [form.commodityIds, commodities]);

  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const toggleCommodityId = (commodityId) => {
    setForm((prev) => ({
      ...prev,
      commodityIds: prev.commodityIds.includes(commodityId)
        ? prev.commodityIds.filter((id) => id !== commodityId)
        : [...prev.commodityIds, commodityId],
    }));
  };

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

  const canSave =
    form.cmoReference.trim() &&
    form.customerId &&
    form.commodityTypeId &&
    form.commodityIds.length > 0 &&
    form.status;

  const handleSave = async () => {
    if (!canSave || isSaving) return;

    setIsSaving(true);
    setError("");
    try {
      await saveCmo({
        ...(isEdit ? { id: editId } : {}),
        cmoReference: form.cmoReference,
        direction: form.direction,
        customerId: form.customerId,
        commodityTypeId: form.commodityTypeId,
        commodityIds: form.commodityIds,
        status: form.status,
        season: form.season || null,
        estimatedAmount: Number(form.estimatedAmount) || 0,
        actualAmountDelivered: Number(form.actualAmountDelivered) || 0,
        additionalReferences: form.additionalReferences,
        attachments: form.attachments,
        note: form.note,
      });
      router.push("/ticketing/cmo");
    } catch (err) {
      setError(err.message || "Failed to save CMO.");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-[min(92rem,calc(100%-2rem))] px-5 py-10 text-sm text-slate-500 sm:px-6 lg:px-8">
        Loading CMO…
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[min(92rem,calc(100%-2rem))] space-y-3 px-5 pt-2 pb-10 sm:px-6 sm:pt-3 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">{isEdit ? "Edit CMO" : "Create CMO"}</h1>
          <p className="mt-1 text-xs text-slate-500">
            {isEdit ? "Update an existing CMO record." : "Create and save a new CMO record."}
          </p>
        </div>
        <Link href="/ticketing/cmo" className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
          Back
        </Link>
      </div>

      {error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</div>
      ) : null}

      <section className={sectionClass}>
        <div className="space-y-4">
          <input suppressHydrationWarning className="h-10 w-full rounded-md border border-slate-200 bg-slate-100 px-3 text-xs font-semibold uppercase tracking-wide text-slate-500" value="CMO reference will be auto-generated" disabled readOnly />
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Field label="CMO Reference" required>
              <input
                className={inputClass}
                value={form.cmoReference}
                onChange={(e) => setField("cmoReference", e.target.value)}
                placeholder="e.g. CMO-0142"
              />
            </Field>

            <Field label="Direction" required>
              <ClutchSelect
                options={DIRECTION_OPTIONS}
                value={DIRECTION_OPTIONS.find((o) => o.value === form.direction) ?? null}
                onChange={(option) => { const v = option ? option.value : ""; setField("direction", v); }}
                isClearable={false}
                placeholder="Select direction..."
              />
            </Field>

            <Field label="Customer / Account" required>
              {(() => {
                const customerOptions = customers.map((c) => ({ value: c.id, label: c.name }));
                return (
                  <ClutchSelect
                    options={customerOptions}
                    value={customerOptions.find((o) => String(o.value) === String(form.customerId)) ?? null}
                    onChange={(option) => { const v = option ? option.value : ""; setField("customerId", v); }}
                    placeholder="Select customer / account..."
                  />
                );
              })()}
            </Field>

            <Field label="Status" required>
              {(() => {
                const statusOptions = STATUS_OPTIONS.map((s) => ({ value: s, label: s }));
                return (
                  <ClutchSelect
                    options={statusOptions}
                    value={statusOptions.find((o) => o.value === form.status) ?? null}
                    onChange={(option) => { const v = option ? option.value : ""; setField("status", v); }}
                    placeholder="Select status..."
                  />
                );
              })()}
            </Field>

            <Field label="Season">
              <SeasonSelect
                value={form.season}
                onChange={(v) => setField("season", v)}
                placeholder="Select season..."
              />
            </Field>

            <Field label="Commodity Type" required>
              {(() => {
                const commodityTypeOptions = commodityTypes.map((ct) => ({ value: ct.id, label: ct.name }));
                return (
                  <ClutchSelect
                    options={commodityTypeOptions}
                    value={commodityTypeOptions.find((o) => String(o.value) === String(form.commodityTypeId)) ?? null}
                    onChange={(option) => {
                      const v = option ? option.value : "";
                      setField("commodityTypeId", v);
                      setField("commodityIds", []);
                    }}
                    placeholder="Select commodity type..."
                  />
                );
              })()}
            </Field>

            <Field label={`Estimated Amount${selectedCommodityUnit ? ` (${weightUnitLabel(selectedCommodityUnit)})` : ""}`}>
              <input suppressHydrationWarning className={inputClass} inputMode="decimal" value={form.estimatedAmount} onChange={(e) => setField("estimatedAmount", e.target.value)} />
            </Field>

            <Field label={`Actual Amount Delivered${selectedCommodityUnit ? ` (${weightUnitLabel(selectedCommodityUnit)})` : ""}`}>
              <input suppressHydrationWarning className={inputClass} inputMode="decimal" value={form.actualAmountDelivered} onChange={(e) => setField("actualAmountDelivered", e.target.value)} />
            </Field>
          </div>

          <Field label="Commodity Grades" required>
            {!form.commodityTypeId ? (
              <p className="text-xs text-slate-500">Select a commodity type first.</p>
            ) : commodityChoices.length === 0 ? (
              <p className="text-xs text-slate-500">No active commodity grades for this type.</p>
            ) : (
              <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50/60 p-3">
                {commodityChoices.map((c) => {
                  const checked = form.commodityIds.includes(c.id);
                  return (
                    <label
                      key={c.id}
                      className={cn(
                        "flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm",
                        checked ? "bg-brand/10 text-brand-ink" : "text-slate-700 hover:bg-white"
                      )}
                    >
                      <input
                        type="checkbox"
                        className="size-4 rounded border-slate-300"
                        checked={checked}
                        onChange={() => toggleCommodityId(c.id)}
                      />
                      <span>{commodityOptionLabel(c)}</span>
                    </label>
                  );
                })}
              </div>
            )}
            {form.commodityIds.length > 0 ? (
              <p className="mt-1.5 text-xs text-slate-500">
                {form.commodityIds.length} commodity grade{form.commodityIds.length === 1 ? "" : "s"} selected. Tickets will finalize one of these grades per load.
              </p>
            ) : null}
          </Field>
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
        <Button type="button" onClick={handleSave} disabled={!canSave || isSaving}>
          {isSaving ? "Saving…" : isEdit ? "Update CMO" : "Create CMO"}
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
