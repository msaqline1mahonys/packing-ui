"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { PACK_FORM_LOOKUPS } from "@/lib/Data";
import {
  containerStage,
  loadWorkDrafts,
  saveWorkDrafts,
  syncWorkDrafts,
  toInputNumber,
  toRoundedNumber,
} from "@/lib/packers-work-store";
import { loadPackScheduleRows, savePackScheduleRows } from "@/lib/pack-schedule-store";
import { cn } from "@/lib/utils";

const YES_NO_OPTIONS = ["No", "Yes"];
const INSPECTION_OPTIONS = ["Pending", "Passed", "Failed"];
const PRA_STATUS_OPTIONS = ["Pending", "Accepted", "Rejected", "Error"];
const PRA_TEMPLATE_OPTIONS = ["Original", "Resubmit", "Correction"];
const PACK_CHECK_FIELDS = [
  { key: "importDetailsChecked", label: "Import details checked" },
  { key: "sampleRequirementsChecked", label: "Sample requirements checked" },
  { key: "rfpDetailsChecked", label: "RFP details checked" },
  { key: "micorRequirementsChecked", label: "MICOR requirements checked" },
];

const inputClass =
  "h-11 rounded-lg border border-slate-200 bg-white px-2 text-[15px] text-slate-800 outline-none ring-brand/15 placeholder:text-slate-400 focus:border-brand/40 focus:ring-2";
const sectionCardClass = "overflow-hidden rounded-xl border border-slate-200/90 bg-white";
const sectionHeaderClass = "border-b border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-800";

function safeValue(value) {
  if (value == null || String(value).trim() === "") return "—";
  return String(value);
}

function formatDateTimeValue(value) {
  if (value == null || String(value).trim() === "") return "—";
  const str = String(value).trim();
  if (!str.includes("T")) return str;
  const [datePart, timePart] = str.split("T");
  const hhmm = (timePart || "").slice(0, 5);
  return hhmm ? `${datePart} ${hhmm}` : datePart;
}

function asDocumentItems(files, group) {
  if (!Array.isArray(files)) return [];
  return files
    .map((item, index) => {
      if (typeof item === "string") {
        return { id: `${group}-${index}-${item}`, name: item, group };
      }
      const name = item?.name;
      if (!name) return null;
      return { id: item?.id ?? `${group}-${index}-${name}`, name, group };
    })
    .filter(Boolean);
}

function stageBadgeClass(stage) {
  switch (stage) {
    case "Complete":
      return "bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200";
    case "PRA Passed":
      return "bg-lime-100 text-lime-800 ring-1 ring-lime-200";
    case "PRA Failed":
      return "bg-rose-100 text-rose-800 ring-1 ring-rose-200";
    case "PRA Submitted":
      return "bg-amber-100 text-amber-900 ring-1 ring-amber-200";
    case "Packing":
      return "bg-blue-100 text-blue-800 ring-1 ring-blue-200";
    default:
      return "bg-slate-100 text-slate-700 ring-1 ring-slate-200";
  }
}

function packContainerFromWorkContainer(container, packRow) {
  return {
    id: container.id,
    packId: packRow.id,
    order: container.order,
    containerNumber: container.containerNo || "",
    containerCode: packRow.containerCode || "",
    containerIsoCode: container.isoCode || "",
    sealNumber: container.sealNo || "",
    releaseNumber: container.releaseNumber || "",
    releasePark: container.releasePark || "",
    transporter: container.transporter || "",
    grainLocation: container.grainLocation || "",
    stockBayId: container.stockBayId || "",
    startDate: container.startDate || "",
    startHour: container.startHour || "",
    startMinute: container.startMinute || "",
    tare: container.tare ?? null,
    grossWeight: container.grossWeight ?? null,
    nettWeight: container.nettWeight ?? null,
    containerTareWeight: container.containerTareWeight ?? null,
    packerSignoff: container.packerSignoff || "",
    outLoaded: container.outLoaded || "No",
    praSubmitted: Boolean(container.praSubmitted),
    praLastStatus: container.praLastStatus || "Pending",
    emptyInspection: container.emptyInspection || "Pending",
    grainInspection: container.grainInspection || "Pending",
    aoSignoff: container.aoSignoff || "",
    status: containerStage(container),
  };
}

export default function PackDetailClient({ packId }) {
  const router = useRouter();
  const [packRow, setPackRow] = useState(() => loadPackScheduleRows().find((row) => Number(row.id) === Number(packId)) || null);
  const [workByPack, setWorkByPack] = useState(() => {
    const row = loadPackScheduleRows().find((item) => Number(item.id) === Number(packId));
    if (!row) return {};
    return syncWorkDrafts([row], loadWorkDrafts());
  });
  const [selectedContainerId, setSelectedContainerId] = useState(null);
  const [containerSearch, setContainerSearch] = useState("");

  const packerNames = useMemo(
    () => (PACK_FORM_LOOKUPS.packers || []).filter((p) => String(p.status).toLowerCase() === "active").map((p) => p.name),
    []
  );

  useEffect(() => {
    const row = loadPackScheduleRows().find((item) => Number(item.id) === Number(packId)) || null;
    setPackRow(row);
    if (row) setWorkByPack((prev) => syncWorkDrafts([row], { ...loadWorkDrafts(), ...prev }));
  }, [packId]);

  useEffect(() => {
    saveWorkDrafts(workByPack);
    if (!packRow || !workByPack[packRow.id]) return;
    const containers = (workByPack[packRow.id].containers || []).map((container) =>
      packContainerFromWorkContainer(container, packRow)
    );
    const rows = loadPackScheduleRows();
    savePackScheduleRows(
      rows.map((row) => (Number(row.id) === Number(packRow.id) ? { ...row, containers } : row))
    );
  }, [workByPack]);

  const selectedPackDraft = packRow ? workByPack[packRow.id] : null;
  const containerRows = selectedPackDraft?.containers || [];
  const filteredContainerRows = useMemo(() => {
    const q = containerSearch.trim().toLowerCase();
    if (!q) return containerRows;
    return containerRows.filter((container) => String(container.containerNo || "").toLowerCase().includes(q));
  }, [containerRows, containerSearch]);

  useEffect(() => {
    if (!filteredContainerRows.length) {
      setSelectedContainerId(null);
      return;
    }
    if (!selectedContainerId || !filteredContainerRows.some((container) => container.id === selectedContainerId)) {
      setSelectedContainerId(filteredContainerRows[0].id);
    }
  }, [filteredContainerRows, selectedContainerId]);

  const selectedContainer = useMemo(
    () => filteredContainerRows.find((container) => container.id === selectedContainerId) || null,
    [filteredContainerRows, selectedContainerId]
  );

  const packSummary = useMemo(() => {
    if (!packRow || !selectedPackDraft) return { total: 0, submitted: 0, complete: 0 };
    const total = selectedPackDraft.containers.length;
    const submitted = selectedPackDraft.containers.filter((container) => container.praSubmitted).length;
    const complete = selectedPackDraft.containers.filter((container) => containerStage(container) === "Complete").length;
    return { total, submitted, complete };
  }, [packRow, selectedPackDraft]);

  function updateSelectedPack(updater) {
    if (!packRow) return;
    setWorkByPack((prev) => {
      const current = prev[packRow.id];
      if (!current) return prev;
      const nextPack = typeof updater === "function" ? updater(current) : updater;
      return { ...prev, [packRow.id]: nextPack };
    });
  }

  function updateSelectedContainer(patch) {
    if (!packRow || !selectedContainer) return;
    updateSelectedPack((current) => {
      const nextContainers = current.containers.map((container) => {
        if (container.id !== selectedContainer.id) return container;
        const next = typeof patch === "function" ? patch(container) : { ...container, ...patch };
        const tare = toRoundedNumber(next.tare);
        const grossWeight = toRoundedNumber(next.grossWeight);
        const normalized = { ...next, tare, grossWeight, nettWeight: toRoundedNumber(Math.max(grossWeight - tare, 0)) };
        return { ...normalized, status: containerStage(normalized) };
      });
      return { ...current, containers: nextContainers };
    });
  }

  function runBulkAction(action) {
    updateSelectedPack((current) => {
      if (action === "pra-all") {
        return {
          ...current,
          containers: current.containers.map((container) => ({
            ...container,
            praSubmitted: true,
            praLastStatus: "Accepted",
            praLastSubmittedTime: new Date().toLocaleString(),
            praLastError: "ERA0100-Message received without error",
          })),
        };
      }
      if (action === "cancel-pra") {
        return {
          ...current,
          containers: current.containers.map((container) => ({
            ...container,
            praSubmitted: false,
            praLastStatus: "Pending",
            praLastSubmittedTime: "",
            praLastError: "",
          })),
        };
      }
      return current;
    });
  }

  function setBulkField(field, value) {
    updateSelectedPack((current) => ({ ...current, [field]: value }));
  }

  function setPackCheck(checkKey, value) {
    updateSelectedPack((current) => ({
      ...current,
      packChecks: {
        ...(current.packChecks || {}),
        [checkKey]: value,
      },
    }));
  }

  function refreshPack() {
    const row = loadPackScheduleRows().find((item) => Number(item.id) === Number(packId)) || null;
    setPackRow(row);
    if (row) setWorkByPack((prev) => syncWorkDrafts([row], prev));
  }

  if (!packRow) {
    return (
      <div className="space-y-4">
        <Button variant="secondary" size="sm" type="button" onClick={() => router.push("/packers-schedule")}>
          Back to Packers Schedule
        </Button>
        <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-sm text-slate-500">
          Pack was not found. It may have been removed from the queue.
        </div>
      </div>
    );
  }

  const packDocuments = [...asDocumentItems(packRow.rfpFiles, "RFP"), ...asDocumentItems(packRow.packingInstructionFiles, "Instruction")];
  const releaseRefsSummary = useMemo(() => {
    const refs = Array.from(
      new Set(
        (Array.isArray(packRow?.releaseDetails) ? packRow.releaseDetails : [])
          .map((release) => String(release?.releaseRef || "").trim())
          .filter(Boolean)
      )
    );
    if (!refs.length) return "—";
    return refs.join(", ");
  }, [packRow?.releaseDetails]);
  const aggregateNettWeight = useMemo(() => {
    const total = (selectedPackDraft?.containers || []).reduce((sum, container) => {
      const nett = Number(container?.nettWeight);
      return Number.isFinite(nett) ? sum + nett : sum;
    }, 0);
    return toRoundedNumber(total);
  }, [selectedPackDraft?.containers]);
  const weightPerContainer = useMemo(() => {
    const total = Number(packRow?.mtTotal);
    const count = Number(packRow?.containersRequired);
    if (!Number.isFinite(total) || !Number.isFinite(count) || count <= 0) return null;
    return toRoundedNumber(total / count);
  }, [packRow?.mtTotal, packRow?.containersRequired]);
  const missingChecks = selectedContainer
    ? [
        selectedContainer.packerSignoff ? null : "Packer signoff",
        selectedContainer.outLoaded === "Yes" ? null : "Out-loaded confirmation",
        selectedContainer.emptyInspection === "Passed" ? null : "Empty container inspection",
        selectedContainer.grainInspection === "Passed" ? null : "Grain inspection",
        selectedContainer.aoSignoff ? null : "AO signoff",
      ].filter(Boolean)
    : [];
  const packChecks = selectedPackDraft?.packChecks || {};
  const packChecksCompleteCount = PACK_CHECK_FIELDS.filter((field) => Boolean(packChecks[field.key])).length;
  const allPackChecksComplete = packChecksCompleteCount === PACK_CHECK_FIELDS.length;

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-slate-200/90 bg-white p-4 md:p-5">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" size="sm" type="button" onClick={() => router.push("/packers-schedule")}>
            Back
          </Button>
          <h2 className="text-lg font-semibold text-slate-900">Pack #{packRow.id}</h2>
          <span className="rounded-full bg-brand/15 px-2 py-0.5 text-xs font-semibold text-brand-ink">{packRow.status}</span>
          <span className="ms-auto text-sm text-slate-600">
            PRA {packSummary.submitted}/{packRow.containersRequired} · Complete {packSummary.complete} · Nett total{" "}
            {aggregateNettWeight.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MT
          </span>
          <Button variant="secondary" size="sm" type="button" onClick={refreshPack}>
            Refresh
          </Button>
        </div>
        <div className="mt-2 grid gap-3 text-xs sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Customer" value={safeValue(packRow.customer)} />
          <Field label="Releases" value={releaseRefsSummary} />
          <Field label="Cut-off" value={formatDateTimeValue(packRow.vesselCutoffDate)} />
          <Field
            label="Fumigation"
            value={safeValue(packRow.fumigation)}
            labelClassName="text-purple-700"
            valueClassName="border-purple-200 bg-purple-50 text-purple-900"
          />
        </div>
        <div className="mt-3 grid gap-2 md:grid-cols-3">
          <PriorityField label="Commodity" value={safeValue(packRow.commodity)} />
          <PriorityField label="Weight per container" value={weightPerContainer == null ? "—" : `${weightPerContainer} MT`} />
          <PriorityField label="Job Ref" value={safeValue(packRow.jobReference)} />
        </div>
        <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-800">Packing note</p>
          <p className="mt-1 whitespace-pre-wrap text-sm text-amber-900">{safeValue(packRow.jobNotes || packRow.packingNote)}</p>
        </div>
        <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50/60 p-2.5">
          <div className="mb-2 flex items-center gap-2">
            <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">Pre-pack checks</p>
            <span
              className={cn(
                "ms-auto rounded-full px-2.5 py-1 text-xs font-semibold ring-1",
                allPackChecksComplete ? "bg-emerald-100 text-emerald-800 ring-emerald-200" : "bg-amber-100 text-amber-800 ring-amber-200"
              )}
            >
              {packChecksCompleteCount}/{PACK_CHECK_FIELDS.length} complete
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {PACK_CHECK_FIELDS.map((field) => {
              const checked = Boolean(packChecks[field.key]);
              return (
                <div key={field.key} className="flex min-w-[280px] flex-1 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2">
                  <span className="flex-1 text-[13px] text-slate-700">{field.label}</span>
                  <div className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 p-0.5">
                    <button
                      type="button"
                      onClick={() => setPackCheck(field.key, false)}
                      className={cn(
                        "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                        !checked ? "bg-slate-700 text-white shadow-sm" : "text-slate-500 hover:text-slate-700"
                      )}
                    >
                      Pending
                    </button>
                    <button
                      type="button"
                      onClick={() => setPackCheck(field.key, true)}
                      className={cn(
                        "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                        checked ? "bg-emerald-600 text-white shadow-sm" : "text-slate-500 hover:text-slate-700"
                      )}
                    >
                      Checked
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-[minmax(300px,360px)_minmax(0,1fr)]">
        <aside className="space-y-4">
          <section className={cn(sectionCardClass, "border-slate-200/90 bg-slate-50/30")}>
            <div className="flex items-center gap-2 border-b border-slate-200 px-3 py-3">
              <h3 className="text-sm font-semibold text-slate-900">Container queue</h3>
              <span className="ms-auto text-sm font-medium text-slate-600">
                Pack progress {packSummary.submitted}/{packRow.containersRequired}
              </span>
            </div>
            <div className="border-b border-slate-200 px-2 py-2">
              <input
                className={cn(inputClass, "h-10 text-sm")}
                value={containerSearch}
                onChange={(event) => setContainerSearch(event.target.value)}
                placeholder="Search container number..."
              />
              <p className="mt-1 text-[11px] text-slate-500">
                Showing {filteredContainerRows.length} of {containerRows.length} containers
              </p>
            </div>
            <div className="max-h-[560px] space-y-2 overflow-auto p-2">
              {!filteredContainerRows.length ? (
                <div className="rounded-lg border border-dashed border-slate-300 bg-white px-3 py-5 text-center text-xs text-slate-500">
                  No containers match this search.
                </div>
              ) : null}
              {filteredContainerRows.map((container) => {
                const stage = containerStage(container);
                return (
                  <button
                    key={container.id}
                    type="button"
                    onClick={() => setSelectedContainerId(container.id)}
                    className={cn(
                      "w-full rounded-lg border px-3 py-3 text-left transition-colors",
                      selectedContainerId === container.id
                        ? "border-brand/40 bg-brand/10"
                        : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-slate-700">#{container.order}</span>
                      <span className="text-[15px] font-semibold text-slate-900">{container.containerNo || "Draft container"}</span>
                      <span className={cn("ms-auto rounded-full px-2.5 py-1 text-xs font-semibold", stageBadgeClass(stage))}>{stage}</span>
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      Seal {safeValue(container.sealNo)} · Net {toInputNumber(container.nettWeight)} MT
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
          <section className={cn(sectionCardClass, "border-slate-200/90 bg-slate-50/30")}>
            <div className={cn(sectionHeaderClass, "border-slate-200 bg-slate-100 text-slate-800")}>Pack-level controls</div>
            <div className="grid gap-3 p-3">
              <LabeledSelect
                label="Sample collection required"
                value={selectedPackDraft?.bulkSampleCollectionRequired || "No"}
                options={YES_NO_OPTIONS}
                onChange={(value) => setBulkField("bulkSampleCollectionRequired", value)}
              />
              <LabeledSelect
                label="Sample required"
                value={selectedPackDraft?.bulkSampleRequired || "No"}
                options={YES_NO_OPTIONS}
                onChange={(value) => setBulkField("bulkSampleRequired", value)}
              />
              <div className="grid gap-2 sm:grid-cols-2">
                <Button type="button" className="h-9 text-sm" variant="destructive" onClick={() => runBulkAction("cancel-pra")}>
                  Bulk Cancel PRA
                </Button>
                <Button type="button" className="h-9 text-sm" onClick={() => runBulkAction("pra-all")}>
                  PRA All Containers
                </Button>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white/80 p-2.5">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Pack documents</p>
                {!packDocuments.length ? (
                  <p className="mt-1 text-sm text-slate-500">No documents attached to this pack.</p>
                ) : (
                  <details className="mt-1">
                    <summary className="cursor-pointer text-sm font-medium text-slate-700">Quick look ({packDocuments.length})</summary>
                    <ul className="mt-2 space-y-1.5">
                      {packDocuments.map((document) => (
                        <li key={document.id} className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-700">
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">{document.group}</span>
                          <span className="truncate">{document.name}</span>
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
            </div>
          </section>
          <section className="rounded-xl border border-slate-200/90 bg-white p-3">
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Container list</label>
            <textarea className={`${inputClass} min-h-[84px] w-full resize-y font-mono text-[12px]`} readOnly value={filteredContainerRows.map((container) => container.containerNo).join("\n")} />
          </section>
        </aside>

        {!selectedContainer ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-sm text-slate-500">
            Select a container to enter details.
          </div>
        ) : (
          <section className="space-y-4 rounded-xl border-2 border-brand/25 bg-brand/5 p-3">
            <div className="rounded-xl border border-slate-200/90 bg-white p-3">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <h3 className="text-base font-semibold text-slate-900">Container #{selectedContainer.order}</h3>
                <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", stageBadgeClass(containerStage(selectedContainer)))}>
                  {containerStage(selectedContainer)}
                </span>
              </div>
            </div>

            <div className={cn(sectionCardClass, "border-blue-200/90 bg-blue-50/30")}>
              <div className={cn(sectionHeaderClass, "border-blue-200 bg-blue-100/80 text-blue-900")}>Packing Order</div>
              <div className="grid gap-3 p-3 md:grid-cols-2 xl:grid-cols-3">
                <LabeledInput
                  label="Container No"
                  value={selectedContainer.containerNo}
                  placeholder="Enter container number"
                  onChange={(value) => updateSelectedContainer({ containerNo: value })}
                />
                <LabeledInput label="Seal No" value={selectedContainer.sealNo} placeholder="Enter seal number" onChange={(value) => updateSelectedContainer({ sealNo: value })} />
                <LabeledSelect
                  label="Container ISO"
                  value={selectedContainer.isoCode}
                  options={["22G1", "42G1", "45G1", "L5G1"]}
                  placeholder="Select ISO code"
                  onChange={(value) => updateSelectedContainer({ isoCode: value })}
                />
                <div className="space-y-1 md:col-span-2 xl:col-span-1">
                  <label className="text-xs font-medium text-slate-600">Start Time (24-hour)</label>
                  <div className="grid grid-cols-[1fr_92px_92px] gap-2">
                    <input className={inputClass} type="date" value={selectedContainer.startDate} onChange={(event) => updateSelectedContainer({ startDate: event.target.value })} />
                    <select className={inputClass} value={selectedContainer.startHour} onChange={(event) => updateSelectedContainer({ startHour: event.target.value })}>
                      <option value="">HH</option>
                      {Array.from({ length: 24 }).map((_, hour) => {
                        const option = String(hour).padStart(2, "0");
                        return (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        );
                      })}
                    </select>
                    <select className={inputClass} value={selectedContainer.startMinute} onChange={(event) => updateSelectedContainer({ startMinute: event.target.value })}>
                      <option value="">MM</option>
                      {["00", "05", "10", "15", "20", "25", "30", "35", "40", "45", "50", "55"].map((minute) => (
                        <option key={minute} value={minute}>
                          {minute}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <LabeledSelect
                  label="Stock/Bay ID"
                  value={selectedContainer.stockBayId}
                  options={["Silo 1", "Silo 2", "Silo 3", "Bay 12", "Shed C"]}
                  placeholder="Select location"
                  onChange={(value) => updateSelectedContainer({ stockBayId: value })}
                />
                <LabeledInput
                  label="Grain location"
                  value={selectedContainer.grainLocation}
                  placeholder="Enter grain location"
                  onChange={(value) => updateSelectedContainer({ grainLocation: value })}
                />
              </div>
            </div>

            <div className={cn(sectionCardClass, "border-slate-200/90 bg-slate-50/30")}>
              <div className={cn(sectionHeaderClass, "border-slate-200 bg-slate-100 text-slate-800")}>Weights</div>
              <div className="grid gap-3 p-3 md:grid-cols-2 xl:grid-cols-4">
                <LabeledInput
                  label="Tare"
                  value={toInputNumber(selectedContainer.tare)}
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  onChange={(value) => updateSelectedContainer({ tare: value })}
                />
                <LabeledInput
                  label="Gross Weight"
                  value={toInputNumber(selectedContainer.grossWeight)}
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  onChange={(value) => updateSelectedContainer({ grossWeight: value })}
                />
                <LabeledInput label="Nett Weight" value={toInputNumber(selectedContainer.nettWeight)} readOnly />
                <LabeledInput
                  label="Container tare weight"
                  value={toInputNumber(selectedContainer.containerTareWeight)}
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  onChange={(value) => updateSelectedContainer({ containerTareWeight: value })}
                />
              </div>
            </div>

            <div className={cn(sectionCardClass, "border-slate-200/90 bg-slate-50/30")}>
              <div className={cn(sectionHeaderClass, "border-slate-200 bg-slate-100 text-slate-800")}>Release Details</div>
              <div className="grid gap-3 p-3 md:grid-cols-3">
                <LabeledInput
                  label="Release Number"
                  value={selectedContainer.releaseNumber}
                  placeholder="Enter release number"
                  onChange={(value) => updateSelectedContainer({ releaseNumber: value })}
                />
                <LabeledInput
                  label="Container Park"
                  value={selectedContainer.releasePark}
                  placeholder="Enter container park"
                  onChange={(value) => updateSelectedContainer({ releasePark: value })}
                />
                <LabeledInput label="Transporter" value={selectedContainer.transporter} placeholder="Enter transporter" onChange={(value) => updateSelectedContainer({ transporter: value })} />
              </div>
            </div>

            <div className={cn(sectionCardClass, "border-slate-200/90 bg-slate-50/30")}>
              <div className={cn(sectionHeaderClass, "border-slate-200 bg-slate-100 text-slate-800")}>Signoff</div>
              <div className="grid gap-3 p-3 md:grid-cols-2 xl:grid-cols-4">
                <LabeledSelect label="Packer signoff" value={selectedContainer.packerSignoff} options={packerNames} onChange={(value) => updateSelectedContainer({ packerSignoff: value })} />
                <LabeledSelect label="Out-loaded?" value={selectedContainer.outLoaded} options={YES_NO_OPTIONS} onChange={(value) => updateSelectedContainer({ outLoaded: value })} />
                <LabeledSelect label="PRA signoff" value={selectedContainer.praSignoff} options={packerNames} onChange={(value) => updateSelectedContainer({ praSignoff: value })} />
                <LabeledSelect
                  label="PRA template"
                  value={selectedContainer.praTemplate}
                  options={PRA_TEMPLATE_OPTIONS}
                  onChange={(value) => updateSelectedContainer({ praTemplate: value })}
                />
              </div>
              <div className="flex flex-wrap items-center gap-2 border-t border-slate-200 px-3 py-3">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() =>
                    updateSelectedContainer({
                      packerSignoff: "",
                      outLoaded: "No",
                      praSignoff: "",
                      praSubmitted: false,
                      praLastStatus: "Pending",
                      praLastSubmittedTime: "",
                      praLastError: "",
                    })
                  }
                >
                  Reset container
                </Button>
                <Button type="button" size="sm" onClick={() => updateSelectedContainer({ outLoaded: "Yes", packerSignoff: selectedContainer.packerSignoff || packerNames[0] || "" })}>
                  Mark packed
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={() =>
                    updateSelectedContainer({
                      praSubmitted: true,
                      praLastStatus: "Accepted",
                      praLastSubmittedTime: new Date().toLocaleString(),
                      praLastError: "ERA0100-Message received without error",
                    })
                  }
                >
                  Submit PRA
                </Button>
                <span className="ms-auto text-sm font-semibold text-rose-600">{selectedContainer.praSubmitted ? "PRA Submitted" : "PRA Pending"}</span>
              </div>
            </div>

            <div className={cn(sectionCardClass, "border-slate-200/90 bg-slate-50/30")}>
              <div className={cn(sectionHeaderClass, "border-slate-200 bg-slate-100 text-slate-800")}>1-Stop PRA Info</div>
              <div className="grid gap-3 p-3 md:grid-cols-3">
                <LabeledSelect
                  label="PRA last status"
                  value={selectedContainer.praLastStatus}
                  options={PRA_STATUS_OPTIONS}
                  onChange={(value) => updateSelectedContainer({ praLastStatus: value })}
                />
                <LabeledInput
                  label="PRA last submitted time"
                  value={selectedContainer.praLastSubmittedTime}
                  onChange={(value) => updateSelectedContainer({ praLastSubmittedTime: value })}
                />
                <LabeledInput label="PRA last error" value={selectedContainer.praLastError} onChange={(value) => updateSelectedContainer({ praLastError: value })} />
              </div>
            </div>

            <div className={cn(sectionCardClass, "border-slate-200/90 bg-slate-50/30")}>
              <div className={cn(sectionHeaderClass, "border-slate-200 bg-slate-100 text-slate-800")}>Authorised Officer Inspection</div>
              <div className="grid gap-3 p-3 md:grid-cols-3">
                <LabeledSelect
                  label="Empty container inspection"
                  value={selectedContainer.emptyInspection}
                  options={INSPECTION_OPTIONS}
                  onChange={(value) => updateSelectedContainer({ emptyInspection: value })}
                />
                <LabeledSelect
                  label="Grain inspection"
                  value={selectedContainer.grainInspection}
                  options={INSPECTION_OPTIONS}
                  onChange={(value) => updateSelectedContainer({ grainInspection: value })}
                />
                <LabeledSelect label="AO signoff" value={selectedContainer.aoSignoff} options={packerNames} onChange={(value) => updateSelectedContainer({ aoSignoff: value })} />
              </div>
              <div className="px-3 pb-3">
                <label className="mb-1 block text-xs font-medium text-slate-600">Container inspection remark</label>
                <textarea className={`${inputClass} min-h-[82px] w-full resize-y`} value={selectedContainer.aoInspectionRemark} onChange={(event) => updateSelectedContainer({ aoInspectionRemark: event.target.value })} />
              </div>
            </div>

            <div className={cn("rounded-xl border px-3 py-2 text-sm", missingChecks.length ? "border-amber-300 bg-amber-50 text-amber-900" : "border-emerald-300 bg-emerald-50 text-emerald-800")}>
              {missingChecks.length ? `Missing checks before completion: ${missingChecks.join(", ")}.` : "All mandatory checks complete for this container."}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function Field({ label, value, labelClassName = "", valueClassName = "" }) {
  return (
    <div className="space-y-1">
      <div className={cn("text-[11px] font-semibold uppercase tracking-wide text-slate-500", labelClassName)}>{label}</div>
      <div className={cn("rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[13px] text-slate-700", valueClassName)}>{value}</div>
    </div>
  );
}

function PriorityField({ label, value }) {
  return (
    <div className="rounded-lg border border-emerald-300 bg-emerald-100/80 px-3 py-2.5 text-emerald-900">
      <p className="text-[11px] font-semibold uppercase tracking-wide">{label}</p>
      <p className="mt-1 text-base font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function LabeledInput({ label, value, onChange, type = "text", readOnly = false, step, placeholder }) {
  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-slate-600">{label}</label>
      <input
        className={cn(inputClass, "block w-full", readOnly ? "cursor-default bg-slate-50 text-slate-700" : "")}
        value={value ?? ""}
        type={type}
        onChange={(event) => onChange?.(event.target.value)}
        readOnly={readOnly}
        step={step}
        placeholder={placeholder}
      />
    </div>
  );
}

function LabeledSelect({ label, value, options, onChange, placeholder = "Select option" }) {
  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-slate-600">{label}</label>
      <select className={cn(inputClass, "block w-full")} value={value ?? ""} onChange={(event) => onChange(event.target.value)}>
        <option value="">{options.length ? placeholder : "—"}</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );
}

