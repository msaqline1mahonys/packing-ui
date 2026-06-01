"use client";

import { useCallback, useEffect, useState } from "react";

import { Grid } from "@/components/clutch-table";
import { Button } from "@/components/ui/button";
import { DEFAULT_CONTAINER_SIZES } from "@/lib/Data";
import { cn } from "@/lib/utils";

const MOBILE_BREAKPOINT = 900;
const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api"
).replace(/\/+$/, "");
const CONTAINER_CODES_ENDPOINT = `${API_BASE_URL}/reference-data/container-codes`;

const inputClass =
  "w-full rounded-lg border border-slate-200/95 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-brand/15 placeholder:text-slate-400 focus:border-brand/35 focus:ring-2";

const config = {
  title: "Container Codes",
  subtitle: "Manage container types by ISO code with capacity and weight data.",
  columns: [
    { key: "isoCode", label: "ISO Code" },
    { key: "containerSize", label: "Size" },
    { key: "description", label: "Description" },
    { key: "cubicMeters", label: "M3", numeric: true },
    { key: "averageWeight", label: "Avg (t)", numeric: true },
    { key: "maxWeight", label: "Max (t)", numeric: true },
    { key: "averageEmptyTare", label: "Tare (t)", numeric: true },
  ],
  formFields: [
    { key: "isoCode", label: "ISO Code", required: true, placeholder: "e.g. 22G1" },
    {
      key: "containerSize",
      label: "Container Size",
      required: true,
      type: "select",
      options: DEFAULT_CONTAINER_SIZES,
    },
    { key: "description", label: "Description", placeholder: "Container description" },
    { key: "cubicMeters", label: "Cubic Meters (M3)", type: "number", placeholder: "0.0" },
    { key: "averageWeight", label: "Average Weight (t)", type: "number", placeholder: "0.0" },
    { key: "maxWeight", label: "Max Weight (t)", type: "number", placeholder: "0.0" },
    { key: "averageEmptyTare", label: "Average Empty Tare (t)", type: "number", placeholder: "0.0" },
  ],
};

const gridColumns = config.columns.map((col) => ({
  key: col.key,
  header: col.label,
  type: col.numeric ? "number" : "text",
  sortable: true,
  filterable: true,
  resizable: true,
}));

function readAuthPayload() {
  try {
    return JSON.parse(localStorage.getItem("authPayload") || "{}");
  } catch {
    return {};
  }
}

function getAuthHeaders() {
  const token = localStorage.getItem("authToken");
  return {
    Accept: "application/json",
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function getTenantPayload() {
  const authPayload = readAuthPayload();
  return {
    ...(authPayload.organization?.id ? { organization_id: authPayload.organization.id } : {}),
    ...(authPayload.current_site?.id ? { site_id: authPayload.current_site.id } : {}),
  };
}

function extractApiError(result, fallback) {
  if (result?.errors) {
    return Object.values(result.errors).flat().join(", ");
  }
  return result?.message || fallback;
}

async function containerCodeRequest(path = "", options = {}) {
  const response = await fetch(`${CONTAINER_CODES_ENDPOINT}${path}`, {
    ...options,
    headers: {
      ...getAuthHeaders(),
      ...(options.headers || {}),
    },
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || result?.success === false) {
    throw new Error(extractApiError(result, "Container code request failed."));
  }
  return result?.data ?? result;
}

function formatDecimal(value) {
  if (value === null || value === undefined || value === "") return "";
  const num = Number(value);
  if (Number.isNaN(num)) return String(value);
  return num.toFixed(2);
}

function fromApiContainerCode(row) {
  if (!row) return null;
  return {
    id: row.id,
    isoCode: row.iso_code ?? row.isoCode ?? "",
    containerSize: row.container_size ?? row.containerSize ?? "",
    description: row.description ?? "",
    cubicMeters: formatDecimal(row.cubic_meters ?? row.cubicMeters),
    averageWeight: formatDecimal(row.average_weight ?? row.averageWeight),
    maxWeight: formatDecimal(row.max_weight ?? row.maxWeight),
    averageEmptyTare: formatDecimal(row.average_empty_tare ?? row.averageEmptyTare),
  };
}

function toNumberOrNull(value) {
  if (value === "" || value == null) return null;
  const n = Number(value);
  return Number.isNaN(n) ? null : n;
}

function toApiPayload(normalized) {
  return {
    ...getTenantPayload(),
    iso_code: String(normalized.isoCode ?? "").trim(),
    container_size: String(normalized.containerSize ?? "").trim(),
    description: String(normalized.description ?? "").trim() || null,
    cubic_meters: toNumberOrNull(normalized.cubicMeters),
    average_weight: toNumberOrNull(normalized.averageWeight),
    max_weight: toNumberOrNull(normalized.maxWeight),
    average_empty_tare: toNumberOrNull(normalized.averageEmptyTare),
  };
}

function buildDraft(row) {
  const next = {};
  for (const field of config.formFields) {
    next[field.key] = row?.[field.key] ?? "";
  }
  return next;
}

function parseFieldValue(field, value) {
  if (field.type !== "number") return value;
  if (value === "") return "";
  const parsed = Number(value);
  return Number.isNaN(parsed) ? value : String(parsed);
}

export default function ContainerCodesPage() {
  const [rows, setRows] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [modalMode, setModalMode] = useState(null);
  const [draft, setDraft] = useState(() => buildDraft());
  const [isMobile, setIsMobile] = useState(false);
  const [showGoToTop, setShowGoToTop] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadContainerCodes = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const payload = await containerCodeRequest("?per_page=500");
      const apiRows = Array.isArray(payload?.data) ? payload.data : Array.isArray(payload) ? payload : [];
      setRows(apiRows.map(fromApiContainerCode).filter(Boolean));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load container codes.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      loadContainerCodes();
    });
    return () => cancelAnimationFrame(frame);
  }, [loadContainerCodes]);

  useEffect(() => {
    const query = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const handleMedia = () => setIsMobile(query.matches);
    handleMedia();
    query.addEventListener("change", handleMedia);
    return () => query.removeEventListener("change", handleMedia);
  }, []);

  useEffect(() => {
    if (!isMobile) return;
    const onScroll = () => setShowGoToTop(window.scrollY > 400);
    onScroll();
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, [isMobile]);

  const selected = selectedId != null ? rows.find((row) => row.id === selectedId) ?? null : null;
  const modalError = modalMode ? error : "";

  function openAddModal() {
    setError("");
    setNotice("");
    setDraft(buildDraft());
    setModalMode("add");
  }

  function openEditModal() {
    if (!selected) return;
    setError("");
    setNotice("");
    setDraft(buildDraft(selected));
    setModalMode("edit");
  }

  function closeModal() {
    if (isSaving) return;
    setModalMode(null);
    setError("");
  }

  async function saveModal() {
    const requiredMissing = config.formFields.some(
      (field) => field.required && !String(draft[field.key] ?? "").trim()
    );
    if (requiredMissing) {
      setError("Please fill all required fields.");
      return;
    }

    const tenant = getTenantPayload();
    if (!tenant.organization_id || !tenant.site_id) {
      setError("Organization and current site are required to save a container code.");
      return;
    }

    const normalized = {};
    for (const field of config.formFields) {
      normalized[field.key] = parseFieldValue(field, draft[field.key] ?? "");
    }

    setIsSaving(true);
    setError("");
    setNotice("");

    try {
      if (modalMode === "add") {
        const payload = await containerCodeRequest("", {
          method: "POST",
          body: JSON.stringify(toApiPayload(normalized)),
        });
        const nextRow = fromApiContainerCode(payload);
        if (!nextRow) throw new Error("Invalid response from server.");
        setRows((prev) => [nextRow, ...prev]);
        setSelectedId(nextRow.id);
        setNotice("Container code created successfully.");
        setModalMode(null);
        return;
      }

      if (modalMode === "edit" && selected) {
        const payload = await containerCodeRequest(`/${selected.id}`, {
          method: "PUT",
          body: JSON.stringify(toApiPayload(normalized)),
        });
        const nextRow = fromApiContainerCode(payload);
        if (!nextRow) throw new Error("Invalid response from server.");
        setRows((prev) => prev.map((row) => (row.id === selected.id ? nextRow : row)));
        setNotice("Container code updated successfully.");
        setModalMode(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save container code.");
    } finally {
      setIsSaving(false);
    }
  }

  async function removeSelected() {
    if (!selected || isDeleting) return;
    if (!window.confirm(`Delete container code "${selected.isoCode}" permanently?`)) return;

    setIsDeleting(true);
    setError("");
    setNotice("");

    try {
      await containerCodeRequest(`/${selected.id}`, { method: "DELETE" });
      setRows((prev) => prev.filter((row) => row.id !== selected.id));
      setSelectedId(null);
      setNotice("Container code deleted successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete container code.");
    } finally {
      setIsDeleting(false);
    }
  }

  const toolbarActions = (
    <div className="flex flex-wrap gap-2">
      <Button type="button" size="sm" onClick={openAddModal} disabled={isLoading}>
        + Add
      </Button>
      <Button type="button" variant="outline" size="sm" onClick={loadContainerCodes} disabled={isLoading}>
        Refresh
      </Button>
      <Button type="button" variant="outline" size="sm" disabled={!selected || isLoading} onClick={openEditModal}>
        Edit
      </Button>
      <Button
        type="button"
        variant="destructive"
        size="sm"
        disabled={!selected || isLoading || isDeleting}
        onClick={removeSelected}
      >
        {isDeleting ? "Deleting…" : "Delete"}
      </Button>
    </div>
  );

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs text-slate-500">Reference Data / {config.title}</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 md:text-[1.65rem]">{config.title}</h1>
        {!isMobile ? <p className="mt-1 text-xs text-slate-500">{config.subtitle}</p> : null}
      </div>

      {!modalMode && error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>
      ) : null}

      {notice ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{notice}</div>
      ) : null}

      <div className={cn("grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(240px,320px)] xl:items-start", isMobile && "grid-cols-1")}>
        <div className="overflow-hidden rounded-xl bg-white shadow-sm">
          {isMobile ? (
            <>
              <div className="flex flex-wrap gap-2 border-b border-slate-100 p-3">{toolbarActions}</div>
              <MobileList
                rows={rows}
                selectedId={selectedId}
                onSelect={setSelectedId}
                title={config.title}
                isLoading={isLoading}
                primaryKey={config.columns[0]?.key}
                secondaryKey={config.columns[2]?.key ?? config.columns[1]?.key}
                summaryKeys={config.columns.slice(1, 4).map((column) => column.key)}
              />
            </>
          ) : (
            <Grid
              columns={gridColumns}
              rows={rows}
              getRowId={(row) => row.id}
              theme="light"
              density="standard"
              fileName={config.title}
              visibleRows={12}
              loading={isLoading}
              emptyMessage={isLoading ? "Loading container codes…" : "No container codes found."}
              onRowClick={(row) => setSelectedId((prev) => (prev === row.id ? null : row.id))}
              toolbarActions={toolbarActions}
            />
          )}
        </div>

        {!isMobile ? (
          <aside className="rounded-xl border border-slate-200/90 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900">{config.title} Details</h2>
            {!selected ? (
              <p className="mt-4 text-sm leading-relaxed text-slate-500">Select a row to view details.</p>
            ) : (
              <dl className="mt-4 space-y-3 text-sm">
                {config.columns.map((column) => (
                  <DetailItem
                    key={column.key}
                    label={column.label}
                    value={selected[column.key]}
                    highlight={column === config.columns[0]}
                  />
                ))}
              </dl>
            )}
          </aside>
        ) : null}
      </div>

      <Modal open={modalMode != null} title={modalMode === "edit" ? `Edit ${config.title}` : `Add ${config.title}`} onClose={closeModal}>
        {modalError ? (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-600">{modalError}</div>
        ) : null}
        <div className="grid gap-3 sm:grid-cols-2">
          {config.formFields.map((field) => (
            <FormField
              key={field.key}
              field={field}
              value={draft[field.key] ?? ""}
              disabled={isSaving}
              onChange={(value) => setDraft((prev) => ({ ...prev, [field.key]: value }))}
            />
          ))}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={closeModal} disabled={isSaving}>
            Cancel
          </Button>
          <Button type="button" size="sm" onClick={saveModal} disabled={isSaving}>
            {isSaving ? "Saving…" : modalMode === "edit" ? "Save changes" : "Create"}
          </Button>
        </div>
      </Modal>

      {isMobile && showGoToTop ? (
        <button
          type="button"
          aria-label="Go to top"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="fixed bottom-5 right-5 z-50 flex size-12 items-center justify-center rounded-full bg-gradient-to-br from-brand to-blue-500 text-xl text-white shadow-lg shadow-blue-500/30"
        >
          â†‘
        </button>
      ) : null}
    </div>
  );
}

function FormField({ field, value, onChange, disabled }) {
  return (
    <div className={cn("space-y-1", field.wide && "sm:col-span-2", field.type === "textarea" && "sm:col-span-2")}>
      <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">
        {field.label}
        {field.required ? <span className="text-red-500"> *</span> : null}
      </label>
      {field.type === "select" ? (
        <select suppressHydrationWarning className={inputClass} value={value} onChange={(event) => onChange(event.target.value)}>
          <option value="">Select...</option>
          {field.options?.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      ) : field.type === "textarea" ? (
        <textarea suppressHydrationWarning className={cn(inputClass, "min-h-20 resize-y")} value={value} onChange={(event) => onChange(event.target.value)} placeholder={field.placeholder} rows={3} />
      ) : (
        <input suppressHydrationWarning type={field.type || "text"} className={inputClass} value={value} onChange={(event) => onChange(event.target.value)} placeholder={field.placeholder} />
      )}
    </div>
  );
}

function MobileList({ rows, selectedId, onSelect, title, primaryKey, secondaryKey, summaryKeys, isLoading }) {
  const emptyMessage = isLoading
    ? `Loading ${title.toLowerCase()}…`
    : `No ${title.toLowerCase()} found. Add your first one!`;
  return (
    <div className="space-y-2 p-3">
      <div className="px-0.5 text-xs font-semibold text-slate-600">
        {title} ({rows.length})
      </div>
      {rows.length === 0 ? (
        <div className="py-8 text-center text-sm text-slate-400">{emptyMessage}</div>
      ) : (
        rows.map((row) => {
          const isSelected = row.id === selectedId;
          const summary = summaryKeys.map((key) => row[key]).filter(Boolean).join(" Â· ");
          return (
            <button
              key={row.id}
              type="button"
              onClick={() => onSelect(isSelected ? null : row.id)}
              className={cn(
                "w-full rounded-xl border-2 px-3 py-3 text-left transition-colors",
                isSelected ? "border-blue-500 bg-blue-50" : "border-slate-200 bg-white"
              )}
            >
              <p className="text-xs font-bold text-blue-600">{row[primaryKey] || "â€”"}</p>
              <p className="mt-1 text-sm font-semibold text-slate-800">{row[secondaryKey] || "â€”"}</p>
              <p className="mt-1 text-[11px] text-slate-500">{summary || "â€”"}</p>
            </button>
          );
        })
      )}
    </div>
  );
}

function DetailItem({ label, value, highlight }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className={cn("mt-0.5 text-slate-800", highlight && "font-semibold text-brand")}>{value || "â€”"}</dd>
    </div>
  );
}

function Modal({ open, title, onClose, children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button type="button" className="absolute inset-0 bg-black/40" aria-label="Close dialog" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="reference-data-modal-title"
        className="relative max-h-[min(90vh,720px)] w-full max-w-2xl overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-4 py-3">
          <h2 id="reference-data-modal-title" className="text-sm font-semibold text-slate-900">
            {title}
          </h2>
          <button
            type="button"
            className="rounded-md px-2 py-1 text-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            onClick={onClose}
          >
            x
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}