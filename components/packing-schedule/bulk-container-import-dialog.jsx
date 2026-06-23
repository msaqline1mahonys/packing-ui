"use client";

import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  applyBulkImport,
  buildBulkImportReleaseOptions,
  comboKey,
  countContainersForCombo,
  getReleaseRef,
  isValidCombo,
  planBulkImport,
  prefillParkTransporterFromRelease,
} from "@/lib/container-bulk-import";
import { enrichReleaseFromCatalog, fetchReleaseById, getValidCombos, normalizeReleaseParks } from "@/lib/releases-api";
import { cn } from "@/lib/utils";

const fieldClass =
  "w-full rounded-lg border border-slate-200/95 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-brand/15 placeholder:text-slate-400 focus:border-brand/35 focus:ring-2 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400";

const STATUS_LABELS = {
  ready: "Ready",
  blocked: "Blocked",
  invalid_format: "Invalid format",
  conflict_skip: "Conflict — skipped",
  conflict_overwrite: "Overwrite existing slot",
  duplicate_paste: "Duplicate in paste",
};

function statusClass(status) {
  if (status === "ready" || status === "conflict_overwrite") return "text-emerald-700";
  if (status === "blocked" || status === "invalid_format") return "text-red-700";
  if (status === "conflict_skip") return "text-amber-700";
  return "text-slate-500";
}

function ComboSelectors({
  linkedReleases,
  referenceReleases,
  catalogReleases = [],
  containerParkOptions,
  transporterOptions,
  releaseId,
  parkId,
  transporterId,
  onReleaseChange,
  onParkChange,
  onTransporterChange,
}) {
  const catalog = catalogReleases.length ? catalogReleases : referenceReleases;

  const releaseOptions = useMemo(() => {
    const linked = Array.isArray(linkedReleases) ? linkedReleases : [];
    return linked.map((r) => {
      const enriched = enrichReleaseFromCatalog(r, catalog);
      return {
        value: String(enriched?.releaseId ?? enriched?.id ?? ""),
        label: enriched?.releaseNumber ?? enriched?.releaseRef ?? "Release",
      };
    });
  }, [linkedReleases, catalog]);

  const selectedRelease = useMemo(() => {
    const id = String(releaseId ?? "");
    const linked = Array.isArray(linkedReleases) ? linkedReleases : [];
    const found =
      linked.find((r) => String(r.releaseId ?? r.id ?? "") === id) ||
      (Array.isArray(referenceReleases) ? referenceReleases : []).find(
        (r) => String(r.id ?? r.releaseId ?? "") === id
      ) ||
      null;
    return enrichReleaseFromCatalog(found, catalog);
  }, [linkedReleases, referenceReleases, catalog, releaseId]);

  const parkOptions = useMemo(() => {
    const parks = normalizeReleaseParks(selectedRelease?.parks);
    const fromParks = parks
      .map((p) => {
        const id = p.containerParkId ?? "";
        const name =
          p.containerParkName ||
          containerParkOptions.find((cp) => String(cp.id) === String(id))?.name ||
          id;
        return id ? { value: String(id), label: name } : null;
      })
      .filter(Boolean);

    if (fromParks.length) return fromParks;

    const seen = new Set();
    return getValidCombos(selectedRelease)
      .map((combo) => combo.emptyContainerParkId)
      .filter((id) => {
        if (!id || seen.has(String(id))) return false;
        seen.add(String(id));
        return true;
      })
      .map((id) => ({
        value: String(id),
        label: containerParkOptions.find((cp) => String(cp.id) === String(id))?.name ?? String(id),
      }));
  }, [selectedRelease, containerParkOptions]);

  const transporterOptionsForPark = useMemo(() => {
    const parks = normalizeReleaseParks(selectedRelease?.parks);
    const park = parks.find((p) => String(p.containerParkId) === String(parkId ?? ""));
    if (!park) return [];
    const ids = Array.isArray(park.transporterIds) ? park.transporterIds : [];
    return ids
      .map((id) => {
        const name =
          park.transporters?.find((t) => String(t.id) === String(id))?.name ??
          transporterOptions.find((t) => String(t.id) === String(id))?.name ??
          id;
        return { value: String(id), label: name };
      })
      .filter(Boolean);
  }, [selectedRelease, parkId, transporterOptions]);

  return (
    <div className="grid gap-2 sm:grid-cols-3">
      <div className="space-y-1">
        <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">Release</label>
        <select
          className={fieldClass}
          value={releaseId || ""}
          onChange={(e) => onReleaseChange(e.target.value)}
        >
          <option value="">Select release…</option>
          {releaseOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1">
        <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">Container park</label>
        <select
          className={fieldClass}
          value={parkId || ""}
          disabled={!releaseId}
          onChange={(e) => onParkChange(e.target.value)}
        >
          <option value="">Select park…</option>
          {parkOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1">
        <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">Transporter</label>
        <select
          className={fieldClass}
          value={transporterId || ""}
          disabled={!parkId}
          onChange={(e) => onTransporterChange(e.target.value)}
        >
          <option value="">Select transporter…</option>
          {transporterOptionsForPark.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

/**
 * Modal bulk-import UI with release / park / transporter combo selectors.
 */
export function BulkContainerImportDialog({
  open = false,
  onClose,
  linkedReleases = [],
  packReleases = [],
  referenceReleases = [],
  catalogReleases = [],
  containers = [],
  containerNumberField = "containerNumber",
  containerParkOptions = [],
  transporterOptions = [],
  onApply,
  isApplying = false,
  applyProgress = "",
}) {
  const linked = linkedReleases.length ? linkedReleases : packReleases;
  const catalog = catalogReleases.length ? catalogReleases : referenceReleases;

  const initialCombo = useMemo(() => {
    if (linked.length !== 1) return { releaseId: "", parkId: "", transporterId: "" };
    const enriched = enrichReleaseFromCatalog(linked[0], catalog);
    const { parkId, transporterId } = prefillParkTransporterFromRelease(enriched);
    return {
      releaseId: String(enriched?.releaseId ?? enriched?.id ?? ""),
      parkId,
      transporterId,
    };
  }, [linked, catalog]);

  const [releaseId, setReleaseId] = useState(initialCombo.releaseId);
  const [parkId, setParkId] = useState(initialCombo.parkId);
  const [transporterId, setTransporterId] = useState(initialCombo.transporterId);
  const [pastedText, setPastedText] = useState("");
  const [userActions, setUserActions] = useState({});
  const [fetchedRelease, setFetchedRelease] = useState(null);

  useEffect(() => {
    if (!open || !releaseId) {
      setFetchedRelease(null);
      return undefined;
    }

    const found = linked.find((r) => String(r.releaseId ?? r.id ?? "") === String(releaseId));
    const enriched = enrichReleaseFromCatalog(found, catalog);
    if (normalizeReleaseParks(enriched?.parks).length > 0) {
      setFetchedRelease(null);
      return undefined;
    }

    let cancelled = false;
    fetchReleaseById(releaseId)
      .then((row) => {
        if (!cancelled) setFetchedRelease(row);
      })
      .catch(() => {
        if (!cancelled) setFetchedRelease(null);
      });

    return () => {
      cancelled = true;
    };
  }, [open, releaseId, linked, catalog]);

  const resolvedCatalog = useMemo(() => {
    if (!fetchedRelease) return catalog;
    const list = Array.isArray(catalog) ? [...catalog] : [];
    const idx = list.findIndex((r) => String(r.id) === String(fetchedRelease.id));
    if (idx >= 0) list[idx] = fetchedRelease;
    else list.push(fetchedRelease);
    return list;
  }, [catalog, fetchedRelease]);

  const selectedRelease = useMemo(() => {
    const found = linked.find((r) => String(r.releaseId ?? r.id ?? "") === String(releaseId)) ?? null;
    return enrichReleaseFromCatalog(found, resolvedCatalog);
  }, [linked, resolvedCatalog, releaseId]);

  useEffect(() => {
    if (!open || !releaseId) return undefined;
    const parks = normalizeReleaseParks(selectedRelease?.parks);
    if (!parks.length) return undefined;
    if (parkId) return undefined;
    const { parkId: nextParkId, transporterId: nextTransporterId } =
      prefillParkTransporterFromRelease(selectedRelease);
    if (nextParkId) setParkId(nextParkId);
    if (nextTransporterId && !transporterId) setTransporterId(nextTransporterId);
    return undefined;
  }, [open, releaseId, selectedRelease, parkId, transporterId]);

  const selectedReleaseRef = getReleaseRef(selectedRelease);
  const comboValid = isValidCombo(selectedRelease, parkId, transporterId);

  const packComboCount = useMemo(
    () =>
      countContainersForCombo(containers, {
        releaseId,
        releaseNumber: selectedReleaseRef,
        emptyContainerParkId: parkId,
        transporterId,
      }),
    [containers, releaseId, selectedReleaseRef, parkId, transporterId]
  );

  const plan = useMemo(
    () =>
      planBulkImport({
        pastedText,
        containers,
        selectedReleaseRef,
        selectedReleaseId: releaseId,
        containerNumberField,
        userActions,
      }),
    [pastedText, containers, selectedReleaseRef, releaseId, containerNumberField, userActions]
  );

  const canPaste = Boolean(releaseId && parkId && transporterId && comboValid);

  async function handleApply() {
    if (!canPaste || plan.blocked || plan.toApply === 0 || isApplying) return;

    const logistics = {
      releaseId: releaseId || null,
      releaseRef: selectedReleaseRef,
      releaseNumber: selectedReleaseRef,
      emptyContainerParkId: parkId || null,
      transporterId: transporterId || null,
    };

    const updated = applyBulkImport({
      containers,
      planRows: plan.rows,
      selectedRelease: logistics,
      containerNumberField,
      lookupOptions: { containerParkOptions, transporterOptions },
    });

    const applied = plan.rows.filter((row) => row.action !== "skip" && row.targetSlotId);
    const ok = await onApply?.(updated, applied, logistics);
    if (ok) {
      setPastedText("");
      setUserActions({});
      onClose?.();
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button type="button" className="absolute inset-0 bg-black/40" aria-label="Close" onClick={onClose} />
      <div className="relative max-h-[min(92vh,760px)] w-full max-w-2xl overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-900">Bulk import containers</h2>
          <button type="button" className="rounded-md px-2 py-1 text-lg text-slate-500 hover:bg-slate-100" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="space-y-4 p-4">
          <ComboSelectors
            linkedReleases={linked}
            referenceReleases={referenceReleases}
            catalogReleases={resolvedCatalog}
            containerParkOptions={containerParkOptions}
            transporterOptions={transporterOptions}
            releaseId={releaseId}
            parkId={parkId}
            transporterId={transporterId}
            onReleaseChange={(id) => {
              setReleaseId(id);
              const release = enrichReleaseFromCatalog(
                linked.find((r) => String(r.releaseId ?? r.id) === String(id)),
                resolvedCatalog
              );
              const { parkId: p, transporterId: t } = prefillParkTransporterFromRelease(release);
              setParkId(p);
              setTransporterId(t);
            }}
            onParkChange={(id) => {
              setParkId(id);
              setTransporterId("");
            }}
            onTransporterChange={setTransporterId}
          />

          {releaseId && parkId && transporterId ? (
            <p className="text-xs text-slate-600">
              {comboValid ? (
                <>
                  <span className="font-medium">{packComboCount}</span> container slot
                  {packComboCount === 1 ? "" : "s"} on this pack use this combination.
                </>
              ) : (
                <span className="text-amber-700">This park/transporter combination is not valid for the selected release.</span>
              )}
            </p>
          ) : null}

          <div className="space-y-1">
            <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">Container numbers</label>
            <textarea
              className={cn(fieldClass, "min-h-[120px] font-mono text-xs")}
              placeholder="Paste container numbers (one per line, or comma/tab separated)"
              value={pastedText}
              disabled={!canPaste || isApplying}
              onChange={(e) => setPastedText(e.target.value)}
            />
          </div>

          {plan.rows.length > 0 ? (
            <div className="max-h-48 overflow-auto rounded-md border border-slate-200 text-xs">
              <table className="w-full">
                <thead className="sticky top-0 bg-slate-50 text-left text-[10px] uppercase text-slate-500">
                  <tr>
                    <th className="px-2 py-1">#</th>
                    <th className="px-2 py-1">Number</th>
                    <th className="px-2 py-1">Slot</th>
                    <th className="px-2 py-1">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {plan.rows.map((row) => (
                    <tr key={row.rowKey} className="border-t border-slate-100">
                      <td className="px-2 py-1">{row.importIndex}</td>
                      <td className="px-2 py-1 font-mono">{row.number}</td>
                      <td className="px-2 py-1">{row.targetSlotOrder ?? row.slotOrder ?? "—"}</td>
                      <td className={cn("px-2 py-1", statusClass(row.status))}>{STATUS_LABELS[row.status] ?? row.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          {plan.blocked && plan.blockReason ? (
            <p className="text-xs text-red-700">{plan.blockReason}</p>
          ) : null}

          <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isApplying}>
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={!canPaste || plan.blocked || plan.toApply === 0 || isApplying}
              onClick={handleApply}
            >
              {isApplying ? applyProgress || "Applying…" : `Import ${plan.toApply} container${plan.toApply === 1 ? "" : "s"}`}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** @deprecated Use BulkContainerImportDialog for combo selection. */
export default function BulkContainerImportPanel(props) {
  return <BulkContainerImportDialog open {...props} />;
}
