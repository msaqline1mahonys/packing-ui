"use client";

import { useMemo, useState } from "react";

import ClutchSelect from "@/components/custom/ClutchSelect";
import { Button } from "@/components/ui/button";

export default function PackerSelectModal({
  open,
  packLabel = "",
  packers = [],
  stockLocations = [],
  initialLocationId = null,
  onConfirm,
  onClose,
}) {
  const packerOptions = useMemo(
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

  const locationOptions = useMemo(
    () =>
      (stockLocations || [])
        .map((location) => ({
          value: String(location.id),
          label: location.name ?? "",
        }))
        .filter((option) => option.value && option.label),
    [stockLocations]
  );

  const [selectedPackerId, setSelectedPackerId] = useState("");
  const [selectedLocationId, setSelectedLocationId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  if (!open) return null;

  const activePackerId = selectedPackerId || (packerOptions.length === 1 ? packerOptions[0].value : "");
  const activeLocationId = selectedLocationId || (initialLocationId ? String(initialLocationId) : "");
  const selectedPackerOption = packerOptions.find((option) => option.value === activePackerId) ?? null;
  const selectedLocationOption =
    locationOptions.find((option) => option.value === String(activeLocationId ?? "")) ?? null;
  const canConfirm = Boolean(selectedPackerOption && selectedLocationOption && !saving);

  async function handleConfirm() {
    if (!canConfirm) return;
    setSaving(true);
    setError("");
    try {
      await onConfirm?.({
        packerId: selectedPackerOption.value,
        packerName: selectedPackerOption.label,
        packingLocationId: selectedLocationOption.value,
        packingLocationName: selectedLocationOption.label,
      });
    } catch (err) {
      setError(err?.message || "Could not save pack details. Please try again.");
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <button type="button" className="absolute inset-0 bg-black/40" aria-label="Close dialog" onClick={onClose} disabled={saving} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="packer-select-title"
        className="relative w-full max-w-md overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"
      >
        <div className="border-b border-slate-100 px-4 py-3">
          <h2 id="packer-select-title" className="text-sm font-semibold text-slate-900">
            Open pack
          </h2>
          <p className="mt-1 text-xs text-slate-600">
            {packLabel
              ? `Choose your packer and packing location for ${packLabel}. These prefills apply to draft containers until you save them.`
              : "Choose your packer and packing location. These prefills apply to draft containers until you save them."}
          </p>
        </div>

        <div className="space-y-4 px-4 py-4">
          {packerOptions.length ? (
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Packer<span className="text-rose-600"> *</span>
              </label>
              <ClutchSelect
                options={packerOptions}
                value={selectedPackerOption}
                onChange={(option) => setSelectedPackerId(option ? option.value : "")}
                placeholder="- Select packer -"
                isClearable={false}
                isDisabled={packerOptions.length === 1 || saving}
              />
            </div>
          ) : (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              No assigned packers are configured on this pack in the packing schedule.
            </p>
          )}

          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Location<span className="text-rose-600"> *</span>
            </label>
            {locationOptions.length ? (
              <ClutchSelect
                options={locationOptions}
                value={selectedLocationOption}
                onChange={(option) => setSelectedLocationId(option ? option.value : "")}
                placeholder="- Select location -"
                isClearable={false}
                isDisabled={saving}
              />
            ) : (
              <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                No stock locations are available. Add locations in reference data first.
              </p>
            )}
          </div>

          {error ? (
            <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">{error}</p>
          ) : null}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-100 px-4 py-3">
          <Button type="button" size="sm" variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="button" size="sm" disabled={!canConfirm} onClick={handleConfirm}>
            {saving ? "Saving…" : "Continue"}
          </Button>
        </div>
      </div>
    </div>
  );
}
