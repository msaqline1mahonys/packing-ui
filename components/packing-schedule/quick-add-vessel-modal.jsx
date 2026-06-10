"use client";

import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { createVessel, createVesselVoyage } from "@/lib/api/shipping";
import { cn } from "@/lib/utils";

const inputClass =
  "w-full rounded-lg border border-slate-200/95 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-brand/15 placeholder:text-slate-400 focus:border-brand/35 focus:ring-2";

// Vessel hull fields — mirrors Shipping Details › Vessel.
const VESSEL_FIELDS = [
  { key: "vesselName", label: "Vessel Name", required: true },
  { key: "lloydsNumber", label: "Lloyds / IMO Number" },
  { key: "vesselType", label: "Vessel Type" },
  { key: "shippingLineId", label: "Default Shipping Line", type: "select", optionsKey: "shippingLines" },
];

// Voyage fields — mirrors Shipping Details › Vessel Voyage (export-relevant subset).
const VOYAGE_FIELDS = [
  { key: "voyageNumber", label: "Voyage Number", required: true },
  { key: "voyageNumberIn", label: "Voyage Number In" },
  { key: "shippingLineId", label: "Shipping Line", type: "select", optionsKey: "shippingLines" },
  { key: "terminalId", label: "Terminal", type: "select", optionsKey: "terminals" },
  { key: "loadPortId", label: "Load Port", type: "select", optionsKey: "ports" },
  { key: "vesselEta", label: "ETA", type: "datetime-local" },
  { key: "vesselEtd", label: "ETD", type: "datetime-local" },
  { key: "vesselCutoffDate", label: "Cargo Cut-off", type: "datetime-local" },
  { key: "vesselReeferCutoffDate", label: "Reefer Cut-off", type: "datetime-local" },
  { key: "vesselReceivalsOpenDate", label: "Receivals Open", type: "datetime-local" },
  { key: "vesselFreeDays", label: "Free Days", type: "number" },
];

function blankDraft() {
  const draft = {};
  for (const field of [...VESSEL_FIELDS, ...VOYAGE_FIELDS]) {
    if (!(field.key in draft)) draft[field.key] = "";
  }
  return draft;
}

function FormField({ field, value, onChange, disabled }) {
  return (
    <div className="space-y-1">
      <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">
        {field.label}
        {field.required ? <span className="text-red-500"> *</span> : null}
      </label>
      {field.type === "select" ? (
        <select className={inputClass} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)}>
          <option value="">Select...</option>
          {(field.options || []).map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      ) : (
        <input
          type={field.type || "text"}
          className={inputClass}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </div>
  );
}

/**
 * Quick-add a Vessel + Vessel Voyage from inside the pack form. Persists both to
 * reference data (same endpoints as Shipping Details), then hands the created
 * voyage back via onCreated so the pack form can select it.
 */
export default function QuickAddVesselModal({
  open,
  onClose,
  onCreated,
  shippingLineOptions = [],
  terminalOptions = [],
  portOptions = [],
}) {
  const [draft, setDraft] = useState(() => blankDraft());
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDraft(blankDraft());
    setError("");
    setIsSaving(false);
  }, [open]);

  const optionLists = useMemo(
    () => ({
      shippingLines: shippingLineOptions.map((s) => ({ value: s.id, label: s.code ? `${s.name} (${s.code})` : s.name })),
      terminals: terminalOptions.map((t) => {
        const name = t.name ?? t.terminal_name ?? t.terminalName ?? "";
        const code = t.code ?? t.terminal_code ?? t.terminalCode ?? "";
        return { value: t.id, label: code && name ? `${name} (${code})` : name || code };
      }),
      ports: portOptions.map((p) => ({ value: p.id, label: p.code && p.name ? `${p.name} (${p.code})` : p.name || p.code })),
    }),
    [shippingLineOptions, terminalOptions, portOptions]
  );

  const setField = (key, value) => setDraft((prev) => ({ ...prev, [key]: value }));

  function withOptions(field) {
    return field.optionsKey ? { ...field, options: optionLists[field.optionsKey] } : field;
  }

  async function handleSave() {
    if (!String(draft.vesselName || "").trim()) {
      setError("Vessel Name is required.");
      return;
    }
    if (!String(draft.voyageNumber || "").trim()) {
      setError("Voyage Number is required.");
      return;
    }
    setIsSaving(true);
    setError("");
    try {
      const vessel = await createVessel(draft);
      const vesselId = vessel?.id;
      if (!vesselId) throw new Error("Vessel was created but no id was returned.");
      const voyage = await createVesselVoyage({ ...draft, vesselId });
      const option = {
        id: voyage?.id,
        voyage_number: voyage?.voyage_number ?? draft.voyageNumber,
        vessel_cutoff_date: voyage?.vessel_cutoff_date ?? draft.vesselCutoffDate,
        vessel_etd: voyage?.vessel_etd ?? draft.vesselEtd,
        vessel: {
          id: vesselId,
          vessel_name: vessel?.vessel_name ?? draft.vesselName,
          lloyds_number: vessel?.lloyds_number ?? draft.lloydsNumber,
        },
      };
      onCreated?.(option);
      onClose?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create vessel / voyage.");
    } finally {
      setIsSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <button type="button" className="absolute inset-0 bg-black/40" aria-label="Close dialog" onClick={() => !isSaving && onClose?.()} />
      <div role="dialog" aria-modal="true" className="relative max-h-[min(90vh,760px)] w-full max-w-2xl overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-900">Quick add Vessel &amp; Schedule</h2>
          <button type="button" className="rounded-md px-2 py-1 text-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800" onClick={() => !isSaving && onClose?.()}>
            x
          </button>
        </div>
        <div className="space-y-4 p-4">
          {error ? <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-600">{error}</div> : null}

          <section>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Vessel</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {VESSEL_FIELDS.map((field) => {
                const f = withOptions(field);
                return <FormField key={`v-${f.key}`} field={f} value={draft[f.key] ?? ""} disabled={isSaving} onChange={(value) => setField(f.key, value)} />;
              })}
            </div>
          </section>

          <section className={cn("rounded-lg border border-slate-200 bg-slate-50/40 p-3")}>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Vessel schedule (voyage)</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {VOYAGE_FIELDS.map((field) => {
                const f = withOptions(field);
                return <FormField key={`y-${f.key}`} field={f} value={draft[f.key] ?? ""} disabled={isSaving} onChange={(value) => setField(f.key, value)} />;
              })}
            </div>
          </section>
        </div>
        <div className="sticky bottom-0 flex justify-end gap-2 border-t border-slate-100 bg-white px-4 py-3">
          <Button type="button" variant="ghost" size="sm" onClick={() => onClose?.()} disabled={isSaving}>
            Cancel
          </Button>
          <Button type="button" size="sm" onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Saving..." : "Save & select"}
          </Button>
        </div>
      </div>
    </div>
  );
}
