"use client";

import { useMemo, useState } from "react";
import ClutchSelect from "@/components/custom/ClutchSelect";
import { Button } from "@/components/ui/button";
import PemsInspectionPanel from "@/components/pems/pems-inspection-panel";
import PemsSubmissionPreviewModal from "@/components/pems/pems-submission-preview-modal";
import {
  getEcInspectionRemark,
  getGrainInspectionRemark,
  EC_INSPECTION_REMARK_FIELD,
  GRAIN_INSPECTION_REMARK_FIELD,
} from "@/lib/pems-container-fields";
import { resolvePackRfpRef } from "@/lib/pems-rfp-display";
import {
  GPPIR_RECORD_TYPE,
  ECR_RECORD_TYPE,
  downloadPemsSubmissionPdf,
} from "@/lib/pems-staging-snapshot";
import { normalizePemsContainers } from "@/lib/pems-container-fields";
import { cn } from "@/lib/utils";
import { numberInputProps } from "@/lib/number-input";
import { toRoundedNumber } from "@/lib/packers-work-store";
import {
  PEMS_RECORD_OPTIONS,
  GPPIR_WEIGHT_UNIT,
  stagingGridClass,
  stagingGrid6Class,
  stagingGrid3Class,
  gppirTableCompactCol,
  gppirTableNarrowCol,
  gppirTableNumCol,
  gppirTableTypeCol,
  gppirTableInspectionLevelCol,
  gppirTableRfpCol,
  gppirTableResultCol,
  gppirTableSealCol,
  gppirTableExpiryDateCol,
  gppirTableInspectionAoCol,
  gppirTableContainerCol,
  gppirTableCellCol,
  gppirTableRemarksCol,
  safeValue,
  formatDateTimeValue,
  formatDateTimeInput,
  formatDateDisplay,
  addDaysToDate,
  resolveExporterCustomerId,
} from "@/lib/pems/pems-tab-utils";

const defaultInputClass =
  "h-11 w-full min-w-0 rounded-lg border border-slate-200 bg-white px-2 text-[15px] text-slate-800 outline-none ring-brand/15 placeholder:text-slate-400 focus:border-brand/40 focus:ring-2";

/** Shared input styling for PEMs tab fields (packers + packing schedule). */
export const PEMS_TAB_INPUT_CLASS = defaultInputClass;

function InspectionDateTimeField({ label, value, onChange, inputClass }) {
  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-slate-600">{label}</label>
      <input
        suppressHydrationWarning
        className={cn(inputClass, "block w-full")}
        type="datetime-local"
        value={formatDateTimeInput(value)}
        onChange={(event) => onChange?.(event.target.value)}
      />
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

function PemsStagingFormField({ label, children, labelClassName = "" }) {
  return (
    <div className="min-w-0 space-y-1">
      <div className={cn("text-[11px] font-semibold uppercase tracking-wide text-slate-500", labelClassName)}>{label}</div>
      <div className="w-full min-w-0">{children}</div>
    </div>
  );
}

function LabeledInput({ label, value, onChange, type = "text", readOnly = false, step, placeholder, inputClass }) {
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
        {...numberInputProps(type)}
      />
    </div>
  );
}

function LabeledSelect({ label, value, options, onChange, placeholder = "Select option" }) {
  const opts = options.map((option) => ({ value: option, label: option }));
  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-slate-600">{label}</label>
      <ClutchSelect
        options={opts}
        value={opts.find((o) => o.value === (value ?? "")) ?? null}
        onChange={(option) => onChange(option ? option.value : "")}
        placeholder={options.length ? placeholder : "—"}
        className="w-full"
      />
    </div>
  );
}

export default function PemsTab({
  containers,
  packerNames,
  selectedContainerId,
  onSelectContainer,
  onOpenContainer,
  openContainerLabel = "Open",
  pemsDraft,
  selectedAoNumber,
  pemsSubmissions,
  siteRow,
  packRow,
  aoNameOptions = [],
  customerOptions = [],
  countryOptions = [],
  submitError,
  isSubmitting,
  canAoSignoff = true,
  onUpdatePemsDraft,
  onToggleStage,
  onStageAll,
  onClearStage,
  onSubmitBatch,
  onUpdatePackRow,
  onUpdateContainer,
  inputClass = defaultInputClass,
}) {
  const stagingInputClass = cn(inputClass, "!h-9 py-1.5 text-[13px]");
  const normalizedContainers = useMemo(() => normalizePemsContainers(containers), [containers]);
  const [pemsContainerSearch, setPemsContainerSearch] = useState("");
  const [previewSubmission, setPreviewSubmission] = useState(null);
  const [downloadingBatchId, setDownloadingBatchId] = useState("");
  const packDisplayRef = String(packRow?.jobReference || packRow?.packNumber || "").trim() || String(packRow?.id ?? "");

  async function handleDownloadSubmission(submission) {
    const batchId = submission?.batchId;
    if (!batchId || downloadingBatchId) return;
    setDownloadingBatchId(batchId);
    try {
      await downloadPemsSubmissionPdf(submission);
    } finally {
      setDownloadingBatchId("");
    }
  }

  const stagedIds = pemsDraft.stagedContainerIds || [];
  const isGppirRecord = pemsDraft.recordType === GPPIR_RECORD_TYPE;
  const stagedContainers = normalizedContainers.filter((container) => stagedIds.includes(container.id));
  const pemsCheckerSections = [
    {
      title: "Establishment",
      ...(!(siteRow?.establishmentNumber || siteRow?.yardNo)
        ? { ok: false, label: "Missing establishment number on site record." }
        : { ok: true, label: `Establishment ${siteRow.establishmentNumber || siteRow.yardNo}` }),
    },
    {
      title: "Yard ID",
      ...(siteRow?.yardId == null && !siteRow?.addressLine1
        ? { ok: false, label: "Configure yard ID or PEMS address on Sites." }
        : { ok: true, label: `Yard ID ${siteRow?.yardId ?? siteRow?.yardNo ?? "—"}` }),
    },
    {
      title: "Place of inspection",
      ...(!siteRow?.name
        ? { ok: false, label: "Missing site name for place of inspection." }
        : { ok: true, label: `Place of inspection resolved (${siteRow.name})` }),
    },
    {
      title: "AO signoff",
      ...(pemsDraft.aoSignoff
        ? selectedAoNumber
          ? { ok: true, label: `AO number resolved for ${pemsDraft.aoSignoff} (${selectedAoNumber})` }
          : { ok: false, label: `AO number missing for selected AO (${pemsDraft.aoSignoff}). Update Users table.` }
        : { ok: false, label: "Select AO signoff to resolve AO number." }),
    },
  ];
  const expiryDate = formatDateDisplay(addDaysToDate(pemsDraft.inspectionEnd || pemsDraft.inspectionStart, isGppirRecord ? 28 : 90));
  const gppirTotalWeight = toRoundedNumber(
    stagedContainers.reduce((sum, container) => sum + (Number.isFinite(Number(container.nettWeight)) ? Number(container.nettWeight) : 0), 0)
  );
  const gppirPassedWeight = toRoundedNumber(
    stagedContainers.reduce((sum, container) => {
      const weight = Number(container.nettWeight);
      if (container.grainInspection !== "Passed" || !Number.isFinite(weight)) return sum;
      return sum + weight;
    }, 0)
  );
  const gppirFailedWeight = toRoundedNumber(
    stagedContainers.reduce((sum, container) => {
      const weight = Number(container.nettWeight);
      if (container.grainInspection !== "Failed" || !Number.isFinite(weight)) return sum;
      return sum + weight;
    }, 0)
  );
  const gppirFlowResult = stagedContainers.length && stagedContainers.every((container) => container.grainInspection === "Passed") ? "Passed" : "Pending";
  const packRfpText = String(packRow?.rfp || "").trim();
  const exporterCustomerId = resolveExporterCustomerId(packRow, customerOptions);

  function setPackField(key, value) {
    onUpdatePackRow?.({ [key]: value });
  }

  function setExporterCustomerId(customerId) {
    const customerName = customerOptions.find((customer) => customer.id === Number(customerId))?.name || "-";
    onUpdatePackRow?.({ exporter: customerName });
  }

  const filteredPemsContainers = useMemo(() => {
    const q = pemsContainerSearch.trim().toLowerCase();
    if (!q) return normalizedContainers;
    return normalizedContainers.filter((c) =>
      [c.order, c.containerNo, c.sealNo, c.releaseNumber, c.id, c.stockBayId, c.grainLocation].some((v) =>
        String(v ?? "")
          .toLowerCase()
          .includes(q)
      )
    );
  }, [normalizedContainers, pemsContainerSearch]);

  const eligibleContainerIds = useMemo(
    () => normalizedContainers.filter((container) => !isGppirRecord || container.ecrSubmitted).map((container) => container.id),
    [normalizedContainers, isGppirRecord]
  );
  const allEligibleStaged = eligibleContainerIds.length > 0 && eligibleContainerIds.every((id) => stagedIds.includes(id));

  return (
    <div className="space-y-3">
      <section className="rounded-lg border border-slate-200/90 bg-white px-2 py-2.5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Submitted PEM</p>
          {pemsSubmissions.length ? (
            <span className="tabular-nums text-[10px] text-slate-400">{pemsSubmissions.length}</span>
          ) : null}
        </div>
        {!pemsSubmissions.length ? (
          <p className="mt-2 text-[11px] text-slate-500">None yet.</p>
        ) : (
          <div className="mt-2 divide-y divide-slate-100 border-t border-slate-100">
            {pemsSubmissions.map((submission) => (
              <div
                key={submission.batchId}
                className="flex flex-col gap-2 py-2.5 text-[11px] leading-snug sm:flex-row sm:items-start sm:gap-4"
              >
                <div className="flex shrink-0 flex-wrap items-center gap-2 sm:w-[10.5rem] sm:flex-col sm:items-start sm:gap-1">
                  <span className="font-semibold text-slate-900">{submission.batchId}</span>
                  <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-emerald-800">
                    {submission.status}
                  </span>
                </div>
                <div className="min-w-0 flex-1 break-words">
                  <p className="text-[10px] text-slate-700">{submission.recordType}</p>
                  <p className="mt-0.5 text-[10px] text-slate-500">
                    {submission.containerIds?.length ?? 0} containers
                    <span className="text-slate-300"> · </span>
                    AO {safeValue(submission.aoSignoff)}
                    {submission.aoNumber ? ` (${safeValue(submission.aoNumber)})` : ""}
                    <span className="text-slate-300"> · </span>
                    Yard {safeValue(submission.yardId)}
                    <span className="text-slate-300"> · </span>
                    {safeValue(submission.placeOfInspection)}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1 sm:flex-col sm:items-end sm:gap-1.5">
                  <span className="text-[10px] whitespace-nowrap text-slate-400">{formatDateTimeValue(submission.submittedAt)}</span>
                  <span className="flex gap-3">
                    <button
                      type="button"
                      className="text-[10px] font-medium text-brand-600 hover:underline"
                      onClick={() => setPreviewSubmission(submission)}
                    >
                      View
                    </button>
                    <button
                      type="button"
                      className="text-[10px] font-medium text-brand-600 hover:underline disabled:opacity-50"
                      disabled={downloadingBatchId === submission.batchId}
                      onClick={() => handleDownloadSubmission(submission)}
                    >
                      {downloadingBatchId === submission.batchId ? "Downloading…" : "Download PDF"}
                    </button>
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-xl border border-slate-200/90 bg-white p-3">
        <div className="mb-2 flex items-center gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Submission setup</p>
          <span className="ms-auto text-xs text-slate-500">Set details once for this staged batch</span>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <LabeledSelect
            label="Record type"
            value={pemsDraft.recordType}
            options={PEMS_RECORD_OPTIONS}
            onChange={(value) =>
              onUpdatePemsDraft({
                recordType: value,
                stagedContainerIds:
                  value === GPPIR_RECORD_TYPE
                    ? stagedIds.filter((id) => {
                        const container = normalizedContainers.find((row) => row.id === id);
                        return Boolean(container?.ecrSubmitted);
                      })
                    : stagedIds,
              })
            }
          />
          <InspectionDateTimeField
            label="Inspection start"
            value={pemsDraft.inspectionStart}
            inputClass={inputClass}
            onChange={(value) => onUpdatePemsDraft({ inspectionStart: value })}
          />
          <InspectionDateTimeField
            label="Inspection end"
            value={pemsDraft.inspectionEnd}
            inputClass={inputClass}
            onChange={(value) => onUpdatePemsDraft({ inspectionEnd: value })}
          />
          <LabeledSelect
            label="AO signoff"
            value={pemsDraft.aoSignoff}
            options={aoNameOptions.length ? aoNameOptions : packerNames}
            onChange={(value) => onUpdatePemsDraft({ aoSignoff: value })}
          />
        </div>
        <PemsInspectionPanel className="mt-3" pemsDraft={pemsDraft} onChange={onUpdatePemsDraft} />
        <div className="mt-2 flex flex-row flex-wrap items-start gap-2 sm:gap-3">
          <div className="min-w-0 flex-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">PEMs checker</p>
            <div className="mt-1 grid auto-rows-auto grid-cols-1 items-start divide-y divide-slate-200 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
              {pemsCheckerSections.map((section) => (
                <div key={section.title} className="py-1 first:pt-0 last:pb-0 sm:px-2 sm:py-1.5 sm:first:pl-0 sm:last:pr-0">
                  <div className="space-y-1">
                    <p className="text-[11px] leading-snug break-words">
                      <span className="text-slate-400">{section.title}: </span>
                      <span className={cn(section.ok ? "text-emerald-700" : "text-amber-700")}>
                        {section.ok ? "OK — " : "Needs attention — "}
                        {section.label}
                      </span>
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          {canAoSignoff ? (
            <Button
              type="button"
              onClick={onSubmitBatch}
              disabled={!stagedContainers.length || isSubmitting}
              className="h-11 shrink-0 self-center sm:min-w-[200px]"
            >
              {isSubmitting ? "Submitting PEMs..." : `Submit ${stagedContainers.length} container(s)`}
            </Button>
          ) : (
            <div className="flex h-11 shrink-0 items-center self-center rounded-lg border border-amber-200 bg-amber-50 px-3 text-xs font-medium text-amber-700 sm:min-w-[200px]">
              Requires Authorised Officer permission
            </div>
          )}
        </div>
        {submitError ? <p className="mt-2 rounded-lg border border-rose-200 bg-rose-50 px-2 py-1.5 text-xs text-rose-700">{submitError}</p> : null}
      </section>

      <div className="grid gap-5 lg:grid-cols-[minmax(300px,380px)_minmax(0,1fr)]">
        <aside className="space-y-4">
          <section className="rounded-xl border border-slate-200/90 bg-white">
            <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-2 py-2">
              <h3 className="text-xs font-semibold tracking-wide text-slate-600">Containers</h3>
              <span className="tabular-nums text-[10px] text-slate-400" aria-live="polite">
                {stagedContainers.length}/{normalizedContainers.length}
              </span>
            </div>
            <div className="border-b border-slate-100 px-2 py-1.5">
              <input
                type="search"
                className={cn(inputClass, "h-9 w-full text-xs")}
                value={pemsContainerSearch}
                onChange={(e) => setPemsContainerSearch(e.target.value)}
                placeholder="Search containers…"
                aria-label="Search containers"
              />
              <p className="mt-0.5 text-[10px] text-slate-500">
                Showing {filteredPemsContainers.length} of {normalizedContainers.length}
              </p>
            </div>
            <div className="border-b border-slate-100 px-2 py-1.5">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="h-7 px-2.5 text-[11px]"
                disabled={!eligibleContainerIds.length}
                onClick={() => (allEligibleStaged ? onClearStage() : onStageAll())}
              >
                {allEligibleStaged ? "Unselect all" : "Select all"}
              </Button>
            </div>
            <div className="max-h-[18rem] space-y-1 overflow-auto px-1.5 pb-1.5 pt-1">
              {!filteredPemsContainers.length ? (
                <div className="rounded-md border border-dashed border-slate-200 bg-slate-50/80 px-2 py-4 text-center text-[11px] text-slate-500">
                  No containers match this search.
                </div>
              ) : null}
              {filteredPemsContainers.map((container) => {
                const checked = stagedIds.includes(container.id);
                const stageEligible = !isGppirRecord || container.ecrSubmitted;
                const stageStatus = container.gppirSubmitted ? "GPPIR" : container.ecrSubmitted ? "ECR" : "No ECR";
                const stageStatusTitle = container.gppirSubmitted
                  ? "GPPIR submitted"
                  : container.ecrSubmitted
                    ? "ECR submitted"
                    : "Awaiting ECR";
                return (
                  <div
                    key={container.id}
                    className={cn(
                      "rounded-md border px-2 py-1.5 text-[11px] leading-snug",
                      selectedContainerId === container.id ? "border-brand/40 bg-brand/5" : "border-slate-200 bg-white"
                    )}
                  >
                    <div className="flex items-center gap-1.5">
                      <input
                        type="checkbox"
                        className="h-4 w-4 shrink-0 rounded border-slate-300"
                        checked={checked}
                        disabled={!stageEligible}
                        onChange={() => {
                          if (!stageEligible) return;
                          onToggleStage(container.id);
                        }}
                      />
                      <button
                        type="button"
                        className="min-w-0 flex-1 truncate text-left font-semibold text-slate-800"
                        onClick={() => onSelectContainer(container.id)}
                      >
                        #{container.order} {container.containerNo || "Draft"}
                      </button>
                      <span
                        title={stageStatusTitle}
                        className={cn(
                          "shrink-0 rounded px-1.5 py-0.5 text-[9px] font-semibold leading-none",
                          container.gppirSubmitted
                            ? "bg-emerald-100 text-emerald-800"
                            : container.ecrSubmitted
                              ? "bg-blue-100 text-blue-800"
                              : "bg-slate-100 text-slate-600"
                        )}
                      >
                        {stageStatus}
                      </span>
                    </div>
                    <div className="mt-1 flex min-h-[1.125rem] items-center justify-between gap-1.5 text-[10px] text-slate-500">
                      <span className="min-w-0 truncate">
                        {safeValue(container.sealNo)} · {safeValue(container.releaseNumber)}
                      </span>
                      <button
                        type="button"
                        className="shrink-0 font-medium text-brand-600 hover:text-brand-700 hover:underline"
                        onClick={() => onOpenContainer(container.id)}
                      >
                        {openContainerLabel}
                      </button>
                    </div>
                    {isGppirRecord && !container.ecrSubmitted ? (
                      <p className="mt-1 text-[10px] leading-snug text-amber-700">ECR required for GPPIR.</p>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </section>
        </aside>

        <section className="min-w-0 space-y-4">
          <div className="rounded-xl border border-slate-200/90 bg-white p-3">
            <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1">
              <h3 className="text-sm font-semibold leading-snug text-slate-900 sm:text-base">
                {isGppirRecord ? `${GPPIR_RECORD_TYPE} (staging)` : `${ECR_RECORD_TYPE} (staging)`}
              </h3>
              <span className="ms-auto shrink-0 text-xs text-slate-500 tabular-nums">Pack #{packDisplayRef}</span>
            </div>
            {!stagedContainers.length ? (
              <div className="rounded-lg border border-dashed border-slate-300 px-3 py-6 text-center text-sm text-slate-500">
                Stage one or more containers to populate this record.
              </div>
            ) : isGppirRecord ? (
              <div className="space-y-4 rounded-lg border border-slate-200 bg-slate-50/50 p-3 text-sm">
                <div className={stagingGridClass}>
                  <PemsStagingFormField label="RFP Number">
                    <input
                      className={stagingInputClass}
                      value={packRow?.rfp || ""}
                      onChange={(e) => setPackField("rfp", e.target.value)}
                      placeholder="RFP reference"
                    />
                  </PemsStagingFormField>
                  <Field label="Establishment Name" value={safeValue(siteRow?.name)} />
                  <Field label="Establishment Number" value={safeValue(siteRow?.yardNo)} />
                  <PemsStagingFormField label="Exporter Name">
                    <ClutchSelect
                      options={customerOptions.map((customer) => ({ value: String(customer.id), label: customer.name }))}
                      value={
                        customerOptions
                          .map((customer) => ({ value: String(customer.id), label: customer.name }))
                          .find((o) => o.value === exporterCustomerId) ?? null
                      }
                      onChange={(option) => setExporterCustomerId(option ? option.value : "")}
                      placeholder="- Select -"
                    />
                  </PemsStagingFormField>
                </div>
                <div className={stagingGrid6Class}>
                  <Field label="Original RFP No." value="N/A" />
                  <Field label="Total Quantity" value={gppirTotalWeight.toFixed(4)} />
                  <Field label="Unit" value={GPPIR_WEIGHT_UNIT} />
                  <Field label="Est. Net Metric Weight" value={`${gppirTotalWeight.toFixed(2)} TONS`} />
                  <Field label="Inspection Start Date and Time" value={formatDateTimeValue(pemsDraft.inspectionStart)} />
                  <Field label="Inspection End Date and Time" value={formatDateTimeValue(pemsDraft.inspectionEnd)} />
                </div>
                <div className={stagingGrid6Class}>
                  <PemsStagingFormField label="Destination Country">
                    <ClutchSelect
                      options={countryOptions.map((country) => ({ value: country, label: country }))}
                      value={
                        countryOptions
                          .map((country) => ({ value: country, label: country }))
                          .find((o) => o.value === (packRow?.destinationCountry || "")) ?? null
                      }
                      onChange={(option) => setPackField("destinationCountry", option ? option.value : "")}
                      placeholder="- Select country -"
                    />
                  </PemsStagingFormField>
                  <PemsStagingFormField label="Import Permit No.">
                    {!packRow?.importPermitRequired ? (
                      <div className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[13px] text-slate-700">N/A</div>
                    ) : (
                      <input
                        className={stagingInputClass}
                        value={packRow?.importPermitNumber || ""}
                        onChange={(e) => setPackField("importPermitNumber", e.target.value)}
                        placeholder="Number"
                      />
                    )}
                  </PemsStagingFormField>
                  <Field label="Flow Path Result" value={gppirFlowResult} />
                  <Field label="Flow path Date and Time" value={formatDateTimeValue(pemsDraft.inspectionStart)} />
                  <Field label="Outcome type" value="Packaged" />
                  <Field label="Expiry Date" value={expiryDate} />
                </div>
                <div className="overflow-x-auto rounded-md border border-slate-200 bg-white">
                  <table className="w-full table-fixed text-left text-xs">
                    <thead className="bg-slate-100 text-slate-700">
                      <tr>
                        <th className={cn(gppirTableCompactCol, "font-semibold")}>RFP Line No</th>
                        <th className={cn(gppirTableCellCol, "font-semibold")}>Container Number</th>
                        <th className={cn(gppirTableCellCol, "font-semibold")}>Source</th>
                        <th className={cn(gppirTableCellCol, "font-semibold")}>Commodity</th>
                        <th className={cn(gppirTableCompactCol, "font-semibold")}>Package Number</th>
                        <th className={cn(gppirTableTypeCol, "font-semibold")}>Type</th>
                        <th className={cn(gppirTableNumCol, "font-semibold")}>Weight</th>
                        <th className={cn(gppirTableNarrowCol, "font-semibold")}>Unit</th>
                        <th className={cn(gppirTableNumCol, "font-semibold")}>Line Weight</th>
                        <th className={cn(gppirTableNarrowCol, "font-semibold")}>Unit</th>
                        <th className={cn(gppirTableCompactCol, "font-semibold")}>Sampled</th>
                        <th className={cn(gppirTableResultCol, "font-semibold")}>Result</th>
                        <th className={cn(gppirTableCellCol, "font-semibold")}>Inspection AO Name</th>
                        <th className={cn(gppirTableRemarksCol, "font-semibold")}>Remarks</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stagedContainers.map((container) => {
                        const containerWeight = toRoundedNumber(container.nettWeight);
                        return (
                          <tr key={container.id} className="border-t border-slate-100 text-slate-700">
                            <td className={cn(gppirTableCompactCol, "text-center")}>1</td>
                            <td className={cn(gppirTableCellCol, "truncate font-medium")}>{safeValue(container.containerNo)}</td>
                            <td className={cn(gppirTableCellCol, "truncate")}>{safeValue(container.grainLocation || container.stockBayId)}</td>
                            <td className={cn(gppirTableCellCol, "truncate")}>{safeValue(packRow?.commodity)}</td>
                            <td className={cn(gppirTableCompactCol, "text-center")}>1</td>
                            <td className={gppirTableTypeCol}>CONTAINER</td>
                            <td className={gppirTableNumCol}>{containerWeight.toFixed(2)}</td>
                            <td className={gppirTableNarrowCol}>{GPPIR_WEIGHT_UNIT}</td>
                            <td className={gppirTableNumCol}>{containerWeight.toFixed(4)}</td>
                            <td className={gppirTableNarrowCol}>{GPPIR_WEIGHT_UNIT}</td>
                            <td className={cn(gppirTableCompactCol, "text-center")}>N/A</td>
                            <td className={gppirTableResultCol}>
                              {container.grainInspection === "Passed"
                                ? "Passed"
                                : container.grainInspection === "Failed"
                                  ? "Failed"
                                  : "Pending"}
                            </td>
                            <td className={cn(gppirTableCellCol, "truncate")}>{safeValue(pemsDraft.aoSignoff)}</td>
                            <td className={gppirTableRemarksCol}>
                              <textarea
                                className={cn(stagingInputClass, "min-h-[2.5rem] resize-y text-xs")}
                                value={getGrainInspectionRemark(container)}
                                onChange={(e) => {
                                  const value = e.target.value;
                                  onUpdateContainer?.(container.id, {
                                    [GRAIN_INSPECTION_REMARK_FIELD]: value,
                                    aoInspectionRemark: value,
                                  });
                                }}
                                placeholder="Remarks"
                                rows={2}
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className={stagingGridClass}>
                  <Field label="Submitted AO Name" value={safeValue(pemsDraft.aoSignoff)} />
                  <Field label="Submitted AO Number" value={safeValue(selectedAoNumber)} />
                </div>
                <div className={stagingGrid3Class}>
                  <PemsStagingFormField label="Additional Declaration">
                    <ClutchSelect
                      options={[
                        { value: "no", label: "N/A" },
                        { value: "yes", label: "Yes" },
                      ]}
                      value={
                        [
                          { value: "no", label: "N/A" },
                          { value: "yes", label: "Yes" },
                        ].find((o) => o.value === (packRow?.rfpAdditionalDeclarationRequired ? "yes" : "no")) ?? null
                      }
                      onChange={(option) => setPackField("rfpAdditionalDeclarationRequired", option?.value === "yes")}
                      isClearable={false}
                    />
                  </PemsStagingFormField>
                  <Field label="Total Passed" value={gppirPassedWeight.toFixed(4)} />
                  <Field label="Unit" value={GPPIR_WEIGHT_UNIT} />
                </div>
                <div className={stagingGrid3Class}>
                  <PemsStagingFormField label="Comments">
                    <input
                      className={stagingInputClass}
                      value={pemsDraft.ecrComments ?? ""}
                      onChange={(e) => onUpdatePemsDraft?.({ ecrComments: e.target.value })}
                      placeholder="N/A"
                    />
                  </PemsStagingFormField>
                  <Field label="Total Failed" value={gppirFailedWeight.toFixed(4)} />
                  <Field label="Unit" value={GPPIR_WEIGHT_UNIT} />
                </div>
              </div>
            ) : (
              <div className="space-y-4 rounded-lg border border-slate-200 bg-slate-50/50 p-3 text-sm">
                <div className={stagingGridClass}>
                  <Field label="Container Yard Id" value={safeValue(siteRow?.yardNo)} />
                  <Field label="Place of Inspection" value={safeValue(siteRow?.name)} />
                  <Field label="Inspection Start Date and Time" value={formatDateTimeValue(pemsDraft.inspectionStart)} />
                  <Field label="Inspection End Date and Time" value={formatDateTimeValue(pemsDraft.inspectionEnd)} />
                </div>
                <div className="overflow-x-auto rounded-md border border-slate-200 bg-white">
                  <table className="w-full table-fixed text-left text-xs [&_th]:leading-snug [&_td]:leading-snug">
                    <thead className="bg-slate-100 text-slate-700">
                      <tr>
                        <th className={cn(gppirTableContainerCol, "font-semibold")}>Container Number</th>
                        <th className={cn(gppirTableInspectionLevelCol, "font-semibold")}>Inspection Level</th>
                        <th className={cn(gppirTableRfpCol, "font-semibold")}>RFP Number</th>
                        <th className={cn(gppirTableResultCol, "font-semibold")}>Result</th>
                        <th className={cn(gppirTableSealCol, "font-semibold")}>Seal Number</th>
                        <th className={cn(gppirTableExpiryDateCol, "font-semibold")}>Expiry Date</th>
                        <th className={cn(gppirTableInspectionAoCol, "font-semibold")}>Inspection AO Name</th>
                        <th className={cn(gppirTableRemarksCol, "font-semibold")}>Remarks</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stagedContainers.map((container) => (
                        <tr key={container.id} className="border-t border-slate-100 text-slate-700">
                          <td className={cn(gppirTableContainerCol, "truncate font-medium")}>{safeValue(container.containerNo)}</td>
                          <td className={gppirTableInspectionLevelCol}>Consumable</td>
                          <td className={cn(gppirTableRfpCol, "truncate")}>{safeValue(packRfpText || container.releaseNumber)}</td>
                          <td className={gppirTableResultCol}>
                            {container.emptyInspection === "Passed"
                              ? "Pass"
                              : container.emptyInspection === "Failed"
                                ? "Fail"
                                : "Pending"}
                          </td>
                          <td className={cn(gppirTableSealCol, "truncate")}>{safeValue(container.sealNo)}</td>
                          <td className={gppirTableExpiryDateCol}>{expiryDate}</td>
                          <td className={cn(gppirTableInspectionAoCol, "truncate")}>{safeValue(pemsDraft.aoSignoff)}</td>
                          <td className={gppirTableRemarksCol}>
                            <textarea
                              className={cn(stagingInputClass, "min-h-[2.5rem] resize-y text-xs")}
                              value={getEcInspectionRemark(container)}
                              onChange={(e) => {
                                const value = e.target.value;
                                onUpdateContainer?.(container.id, {
                                  [EC_INSPECTION_REMARK_FIELD]: value,
                                  aoInspectionRemark: value,
                                });
                              }}
                              placeholder="Remarks"
                              rows={2}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Submitted AO Name" value={safeValue(pemsDraft.aoSignoff)} />
                  <Field label="Submitted AO Number" value={safeValue(selectedAoNumber)} />
                </div>
                <PemsStagingFormField label="Comments">
                  <input
                    className={stagingInputClass}
                    value={pemsDraft.ecrComments ?? ""}
                    onChange={(e) => onUpdatePemsDraft?.({ ecrComments: e.target.value })}
                    placeholder="N/A"
                    required
                  />
                </PemsStagingFormField>
              </div>
            )}
          </div>
        </section>
      </div>
      <PemsSubmissionPreviewModal submission={previewSubmission} onClose={() => setPreviewSubmission(null)} />
    </div>
  );
}
