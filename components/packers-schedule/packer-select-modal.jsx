"use client";

import { useMemo, useState } from "react";

import ClutchSelect from "@/components/custom/ClutchSelect";
import { Button } from "@/components/ui/button";

export default function PackerSelectModal({ open, packLabel = "", packers = [], onConfirm, onClose }) {
  const options = useMemo(
    () =>
      (packers || [])
        .filter((packer) => String(packer.status ?? "active").toLowerCase() === "active")
        .map((packer) => ({
          value: String(packer.id),
          label: packer.name ?? "",
        }))
        .filter((option) => option.value && option.label),
    [packers]
  );

  const [selectedId, setSelectedId] = useState("");
  const activeId = selectedId || (options.length === 1 ? options[0].value : "");

  if (!open) return null;

  const selectedOption = options.find((option) => option.value === activeId) ?? null;

  function handleConfirm() {
    if (!selectedOption) return;
    onConfirm?.({
      packerId: selectedOption.value,
      packerName: selectedOption.label,
    });
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <button type="button" className="absolute inset-0 bg-black/40" aria-label="Close dialog" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="packer-select-title"
        className="relative w-full max-w-md overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"
      >
        <div className="border-b border-slate-100 px-4 py-3">
          <h2 id="packer-select-title" className="text-sm font-semibold text-slate-900">
            Select your packer
          </h2>
          <p className="mt-1 text-xs text-slate-600">
            {packLabel
              ? `Choose which assigned packer you are for ${packLabel}. This prefills draft containers until you save them.`
              : "Choose which assigned packer you are. This prefills draft containers until you save them."}
          </p>
        </div>

        <div className="space-y-3 px-4 py-4">
          {options.length ? (
            <ClutchSelect
              options={options}
              value={selectedOption}
              onChange={(option) => setSelectedId(option ? option.value : "")}
              placeholder="- Select packer -"
              isClearable={false}
            />
          ) : (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              No assigned packers are configured on this pack in the packing schedule.
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-100 px-4 py-3">
          <Button type="button" size="sm" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" size="sm" disabled={!selectedOption} onClick={handleConfirm}>
            Continue
          </Button>
        </div>
      </div>
    </div>
  );
}
