"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ExternalLink, FileText, Loader2, Trash2, Upload } from "lucide-react";

import { Grid } from "@/components/clutch-table";
import { Button } from "@/components/ui/button";
import ClutchSelect from "@/components/packing-schedule/pack-form-clutch-select";
import { ALL_SAMPLE_STATUSES } from "@/lib/Data";
import {
  deletePackSampleResult,
  fetchPackSamples,
  formatSampleDate,
  updatePackSample,
  uploadPackSampleResult,
} from "@/lib/pack-samples-api";
import { validatePackSampleUpdate } from "@/lib/pack-sample-validation";
import { cn } from "@/lib/utils";

const QUEUE_OPTIONS = [
  { key: "all", label: "All samples" },
  { key: "to_send", label: "To send" },
  { key: "awaiting_results", label: "Awaiting results" },
  { key: "completed", label: "Completed" },
];

const STATUS_OPTIONS = ALL_SAMPLE_STATUSES.map((status) => ({ value: status, label: status }));

function statusBadgeClass(status) {
  switch ((status || "").toLowerCase()) {
    case "passed":
      return "bg-emerald-50 text-emerald-900 ring-1 ring-emerald-200";
    case "failed":
      return "bg-rose-50 text-rose-900 ring-1 ring-rose-200";
    case "sent":
      return "bg-sky-50 text-sky-900 ring-1 ring-sky-200";
    case "cancelled":
      return "bg-slate-100 text-slate-600 ring-1 ring-slate-200";
    default:
      return "bg-amber-50 text-amber-900 ring-1 ring-amber-200";
  }
}

function formatDate(value) {
  return formatSampleDate(value);
}

function emptyDraft(row) {
  return {
    status: row?.status ?? "Pending",
    sampleSentDate: row?.sampleSentDate ?? "",
    trackingDetail: row?.trackingDetail ?? "",
    notes: row?.notes ?? "",
  };
}

export default function PackSamplesPage() {
  const [rows, setRows] = useState([]);
  const [activeQueue, setActiveQueue] = useState("all");
  const [selectedId, setSelectedId] = useState(null);
  const [draft, setDraft] = useState(emptyDraft());
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef(null);

  const loadRows = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const filters = activeQueue === "all" ? {} : { queue: activeQueue };
      const data = await fetchPackSamples(filters);
      setRows(data);
      setSelectedId((current) => (current != null && !data.some((row) => row.id === current) ? null : current));
    } catch (err) {
      setError(err.message || "Failed to load pack samples.");
      setRows([]);
    } finally {
      setIsLoading(false);
    }
  }, [activeQueue]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadRows();
  }, [loadRows]);

  const selected = useMemo(() => rows.find((row) => row.id === selectedId) || null, [rows, selectedId]);

  const handleSelectRow = (row) => {
    setSelectedId(row.id);
    setDraft(emptyDraft(row));
  };

  const columns = useMemo(
    () => [
      { key: "jobReference", header: "Job ref", type: "text", sortable: true, filterable: true, resizable: true },
      { key: "customerName", header: "Customer", type: "text", sortable: true, filterable: true, resizable: true },
      { key: "commodityName", header: "Commodity", type: "text", sortable: true, filterable: true, resizable: true },
      { key: "type", header: "Type", type: "text", sortable: true, filterable: true, resizable: true },
      { key: "sampleLocation", header: "Location", type: "text", sortable: true, filterable: true, resizable: true },
      {
        key: "status",
        header: "Status",
        type: "text",
        sortable: true,
        filterable: true,
        resizable: true,
        renderCell: ({ value }) => (
          <span className={cn("inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold", statusBadgeClass(value))}>
            {value || "—"}
          </span>
        ),
      },
      {
        key: "requestedDate",
        header: "Requested",
        type: "text",
        sortable: true,
        filterable: true,
        resizable: true,
        renderCell: ({ value }) => formatDate(value),
      },
      {
        key: "sampleSentDate",
        header: "Sent",
        type: "text",
        sortable: true,
        filterable: true,
        resizable: true,
        renderCell: ({ value }) => formatDate(value),
      },
      { key: "trackingDetail", header: "Tracking", type: "text", sortable: true, filterable: true, resizable: true },
      { key: "notes", header: "Notes", type: "text", sortable: true, filterable: true, resizable: true },
      {
        key: "resultFileUrl",
        header: "Result",
        type: "text",
        sortable: false,
        filterable: false,
        resizable: false,
        renderCell: ({ row }) =>
          row.resultFileUrl ? (
            <a
              href={row.resultFileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex text-brand-ink hover:text-brand"
              aria-label="View sample result"
              onClick={(event) => event.stopPropagation()}
            >
              <FileText className="size-4" />
            </a>
          ) : (
            <span className="text-slate-300">—</span>
          ),
      },
    ],
    []
  );

  const saveSelected = async () => {
    if (!selected || isSaving) return;

    const validation = validatePackSampleUpdate({
      status: draft.status,
      trackingDetail: draft.trackingDetail,
    });
    if (!validation.ok) {
      setError(validation.message);
      return;
    }

    setIsSaving(true);
    setError("");
    try {
      const updated = await updatePackSample(selected.id, {
        status: draft.status,
        sampleSentDate: draft.sampleSentDate || null,
        trackingDetail: draft.trackingDetail,
        notes: draft.notes,
      });
      setRows((prev) => prev.map((row) => (row.id === updated.id ? updated : row)));
      setDraft(emptyDraft(updated));
    } catch (err) {
      setError(err.message || "Failed to update sample.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpload = async (fileList) => {
    if (!selected || !fileList?.length || isUploading) return;
    const file = fileList[0];
    if (!file) return;

    setIsUploading(true);
    setError("");
    try {
      const updated = await uploadPackSampleResult(selected.id, file);
      setRows((prev) => prev.map((row) => (row.id === updated.id ? updated : row)));
    } catch (err) {
      setError(err.message || "Failed to upload sample result.");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDeleteResult = async () => {
    if (!selected?.resultFileUrl || isUploading) return;
    if (!window.confirm("Remove the attached sample result PDF?")) return;

    setIsUploading(true);
    setError("");
    try {
      const updated = await deletePackSampleResult(selected.id);
      setRows((prev) => prev.map((row) => (row.id === updated.id ? updated : row)));
    } catch (err) {
      setError(err.message || "Failed to remove sample result.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs text-slate-500">Operations / Pack samples</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 md:text-[1.65rem]">Pack samples</h1>
        <p className="mt-1 text-xs text-slate-500">
          Track samples created on packs, record lab dispatch details, and attach result PDFs.
        </p>
      </div>

      {error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</div>
      ) : null}

      <section className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Queue</p>
          <div className="flex flex-1 flex-wrap items-center gap-2">
            {QUEUE_OPTIONS.map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => setActiveQueue(option.key)}
                className={cn(
                  "inline-flex h-7 items-center rounded-md border px-2.5 text-[11px] font-medium transition-colors",
                  activeQueue === option.key
                    ? "border-brand/30 bg-brand/15 text-brand-ink shadow-sm"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-800"
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(280px,360px)] xl:items-start">
        <div className="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-sm">
          {isLoading ? (
            <div className="flex h-64 items-center justify-center gap-2 text-sm text-slate-500">
              <Loader2 className="size-4 animate-spin" />
              Loading samples…
            </div>
          ) : (
            <Grid
              columns={columns}
              rows={rows}
              getRowId={(row) => row.id}
              theme="light"
              density="standard"
              fileName="Pack Samples"
              persistKey="ticketing-pack-samples-grid"
              visibleRows={14}
              enableSelection={false}
              onRowClick={handleSelectRow}
              rowClassName={(row) => (row.id === selectedId ? "bg-brand/5" : undefined)}
            />
          )}
        </div>

        <aside className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm">
          {!selected ? (
            <p className="text-sm text-slate-500">Select a sample to update dispatch details or attach a result PDF.</p>
          ) : (
            <div className="space-y-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Pack</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{selected.jobReference || "—"}</p>
                <p className="text-xs text-slate-500">
                  {selected.customerName || "—"}
                  {selected.commodityName ? ` · ${selected.commodityName}` : ""}
                </p>
                {selected.packId ? (
                  <Link
                    href={`/packing-schedule/new-pack-form?id=${selected.packId}`}
                    className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-brand-ink hover:text-brand"
                  >
                    Open pack
                    <ExternalLink className="size-3.5" />
                  </Link>
                ) : null}
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <DetailItem label="Type" value={selected.type || "—"} />
                <DetailItem label="Location" value={selected.sampleLocation || "—"} />
                <DetailItem label="Requested" value={formatDate(selected.requestedDate)} />
                <DetailItem label="Sent" value={formatDate(selected.sampleSentDate)} />
              </div>

              <div className="space-y-3 border-t border-slate-100 pt-4">
                <Field label="Status">
                  <ClutchSelect
                    isClearable={false}
                    options={STATUS_OPTIONS}
                    value={STATUS_OPTIONS.find((option) => option.value === draft.status) ?? null}
                    onChange={(option) => setDraft((prev) => ({ ...prev, status: option?.value ?? "Pending" }))}
                  />
                </Field>

                <Field label="Sent date">
                  <input
                    type="date"
                    className="h-8 w-full rounded-md border border-slate-200 px-2 text-xs text-slate-800"
                    value={draft.sampleSentDate || ""}
                    onChange={(event) => setDraft((prev) => ({ ...prev, sampleSentDate: event.target.value }))}
                  />
                </Field>

                <Field label={draft.status === "Passed" ? "Tracking detail *" : "Tracking detail"}>
                  <input
                    className="h-8 w-full rounded-md border border-slate-200 px-2 text-xs text-slate-800"
                    value={draft.trackingDetail}
                    placeholder="Courier / consignment / lab ref"
                    onChange={(event) => setDraft((prev) => ({ ...prev, trackingDetail: event.target.value }))}
                  />
                </Field>

                <Field label="Notes">
                  <textarea
                    className="min-h-20 w-full rounded-md border border-slate-200 px-2 py-1.5 text-xs text-slate-800"
                    value={draft.notes}
                    onChange={(event) => setDraft((prev) => ({ ...prev, notes: event.target.value }))}
                  />
                </Field>

                <Button type="button" className="w-full" disabled={isSaving} onClick={saveSelected}>
                  {isSaving ? "Saving…" : "Save sample"}
                </Button>
              </div>

              <div className="space-y-2 border-t border-slate-100 pt-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Result PDF</p>
                {selected.resultFileUrl ? (
                  <div className="flex items-center justify-between gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                    <a
                      href={selected.resultFileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-w-0 items-center gap-2 text-xs font-medium text-brand-ink hover:text-brand"
                    >
                      <FileText className="size-4 shrink-0" />
                      <span className="truncate">{selected.resultFileName || "Sample result.pdf"}</span>
                    </a>
                    <button
                      type="button"
                      className="inline-flex size-7 items-center justify-center rounded-md border border-slate-200 text-slate-500 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
                      aria-label="Remove result PDF"
                      disabled={isUploading}
                      onClick={handleDeleteResult}
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">No result attached yet.</p>
                )}

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf,.pdf"
                  className="hidden"
                  onChange={(event) => handleUpload(event.target.files)}
                />
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  disabled={isUploading}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="mr-2 size-4 animate-spin" />
                      Uploading…
                    </>
                  ) : (
                    <>
                      <Upload className="mr-2 size-4" />
                      {selected.resultFileUrl ? "Replace result PDF" : "Upload result PDF"}
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div className="space-y-1">
      <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</label>
      {children}
    </div>
  );
}

function DetailItem({ label, value }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-0.5 text-sm text-slate-800">{value}</p>
    </div>
  );
}
