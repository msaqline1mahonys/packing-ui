"use client";

import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";
import { INSPECTION_REASONS } from "@/lib/pems/constants";

const inputClass =
  "h-9 w-full rounded-lg border border-slate-200/95 bg-white px-3 text-sm text-slate-900 outline-none ring-brand/15 focus:border-brand/35 focus:ring-2";

const REASON_OPTIONS = [
  { value: "", label: "Normal inspection" },
  { value: INSPECTION_REASONS.RE_INSPECTION, label: "Re-inspection (R)" },
  { value: INSPECTION_REASONS.RE_SUBMIT, label: "Re-submit (RS)" },
  { value: INSPECTION_REASONS.SUPPLEMENTARY, label: "Supplementary (S)" },
];

export default function PemsInspectionPanel({ pemsDraft, onChange, className }) {
  const draft = pemsDraft || {};
  const setField = (key, value) => onChange?.({ [key]: value });
  const cancelled = Array.isArray(draft.inspectionsToBeCancelled) ? draft.inspectionsToBeCancelled : [];
  const hasNonDefaultReason = Boolean(String(draft.inspectionReason || "").trim());
  const [showReasonOptions, setShowReasonOptions] = useState(hasNonDefaultReason);

  useEffect(() => {
    if (hasNonDefaultReason) setShowReasonOptions(true);
  }, [hasNonDefaultReason]);

  function hideReasonOptions() {
    setShowReasonOptions(false);
    onChange?.({
      inspectionReason: "",
      parentInspectionId: null,
      inspectionsToBeCancelled: [],
    });
  }

  const reasonToggle = (
    <button
      type="button"
      className="text-xs font-medium text-brand hover:underline"
      onClick={() => (showReasonOptions ? hideReasonOptions() : setShowReasonOptions(true))}
    >
      {showReasonOptions ? "Use normal inspection" : "Change inspection reason…"}
    </button>
  );

  if (!showReasonOptions) {
    return <div className={cn("mt-1", className)}>{reasonToggle}</div>;
  }

  return (
    <div className={cn("space-y-4 rounded-xl border border-slate-200/90 bg-white p-4", className)}>
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Inspection reason</p>
          {reasonToggle}
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Reason">
            <select
              className={inputClass}
              value={draft.inspectionReason || ""}
              onChange={(e) => setField("inspectionReason", e.target.value)}
            >
              {REASON_OPTIONS.map((opt) => (
                <option key={opt.value || "normal"} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </Field>
          {draft.inspectionReason === INSPECTION_REASONS.SUPPLEMENTARY ? (
            <Field label="Parent inspection ID">
              <input
                className={inputClass}
                value={draft.parentInspectionId || ""}
                onChange={(e) => setField("parentInspectionId", e.target.value)}
                placeholder="Prior PEMS inspection ID"
              />
            </Field>
          ) : null}
        </div>
        {draft.inspectionReason === INSPECTION_REASONS.RE_SUBMIT ? (
          <Field label="Inspections to cancel (comma-separated PEMS IDs)">
            <input
              className={inputClass}
              value={cancelled.join(", ")}
              onChange={(e) =>
                setField(
                  "inspectionsToBeCancelled",
                  e.target.value
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean)
                )
              }
              placeholder="PEMS inspection IDs"
            />
          </Field>
        ) : null}
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-slate-600">{label}</label>
      {children}
    </div>
  );
}
