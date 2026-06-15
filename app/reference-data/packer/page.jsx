"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { Grid } from "@/components/clutch-table";
import ClutchSelect, { toOptions } from "@/components/custom/ClutchSelect";
import { Button } from "@/components/ui/button";
import { useInvalidateReferenceData } from "@/lib/hooks/use-reference-data-queries";
import { cn } from "@/lib/utils";

const MOBILE_BREAKPOINT = 900;
const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api"
).replace(/\/+$/, "");
const PACKERS_ENDPOINT = `${API_BASE_URL}/reference-data/packers`;

const inputClass =
  "w-full rounded-lg border border-slate-200/95 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-brand/15 placeholder:text-slate-400 focus:border-brand/35 focus:ring-2";

const config = {
  title: "Packer",
  subtitle: "Maintain packer setup, status, and allowed operational scopes.",
  columns: [
    { key: "name", label: "Name" },
    { key: "description", label: "Description" },
    { key: "status", label: "Status" },
    { key: "stockLocationsAllowed", label: "Stock Locations" },
  ],
  formFields: [
    { key: "name", label: "Name", required: true },
    { key: "status", label: "Status", type: "select", options: ["Active", "Under maintenance", "Inactive"] },
    { key: "description", label: "Description", type: "textarea" },
  ],
};

const gridColumns = config.columns.map((col) => ({
  key: col.key,
  header: col.label,
  type: "text",
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

async function packerRequest(path = "", options = {}) {
  const response = await fetch(`${PACKERS_ENDPOINT}${path}`, {
    ...options,
    headers: {
      ...getAuthHeaders(),
      ...(options.headers || {}),
    },
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || result?.success === false) {
    throw new Error(extractApiError(result, "Packer request failed."));
  }
  return result?.data ?? result;
}

function normalizeIdList(ids, validIds) {
  if (!Array.isArray(ids)) return [];
  const uniq = new Set();
  for (const rawId of ids) {
    const id = String(rawId ?? "").trim();
    if (!id || !validIds.has(id)) continue;
    uniq.add(id);
  }
  return Array.from(uniq);
}

function buildStockLocationSummary(mode, ids) {
  if (mode === "all") return "All";
  if (!Array.isArray(ids) || !ids.length) return "—";
  return `${ids.length} selected`;
}

function toDisplayRow(row, stockLocationMap) {
  const stockLocationModeRaw = row?.stock_location_mode ?? row?.stockLocationMode;
  const stockLocationMode = stockLocationModeRaw === "selected" ? "selected" : "all";
  const stockLocationIds = normalizeIdList(row?.stock_location_ids ?? row?.stockLocationIds, stockLocationMap);

  return {
    id: row.id,
    name: row.name ?? "",
    description: row.description ?? "",
    status: row.status ?? "Active",
    stockLocationMode,
    stockLocationIds,
    stockLocationsAllowed: buildStockLocationSummary(stockLocationMode, stockLocationIds),
  };
}

function buildDraft(row) {
  const next = {};
  for (const field of config.formFields) next[field.key] = row?.[field.key] ?? "";
  next.stockLocationMode = row?.stockLocationMode === "selected" ? "selected" : "all";
  next.stockLocationIds = Array.isArray(row?.stockLocationIds) ? [...row.stockLocationIds] : [];
  if (!next.status) next.status = "Active";
  return next;
}

function toApiPayload(draft) {
  const stockLocationMode = draft.stockLocationMode === "selected" ? "selected" : "all";

  return {
    ...getTenantPayload(),
    name: String(draft.name ?? "").trim(),
    description: String(draft.description ?? "").trim() || null,
    status: String(draft.status ?? "").trim() || "Active",
    stock_location_mode: stockLocationMode,
    stock_location_ids: stockLocationMode === "selected" ? draft.stockLocationIds : [],
  };
}

export default function PackerPage() {
  const invalidateReferenceData = useInvalidateReferenceData();

  const [packerRecords, setPackerRecords] = useState([]);
  const [stockLocationOptions, setStockLocationOptions] = useState([]);
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

  const stockLocationMap = useMemo(
    () => new Map(stockLocationOptions.map((item) => [item.id, item.name])),
    [stockLocationOptions]
  );

  const rows = useMemo(
    () =>
      packerRecords
        .map((row) => toDisplayRow(row, stockLocationMap))
        .filter(Boolean),
    [packerRecords, stockLocationMap]
  );

  const formDataQuery = useMemo(() => {
    const tenant = getTenantPayload();
    const params = new URLSearchParams();
    if (tenant.organization_id) params.set("organization_id", tenant.organization_id);
    if (tenant.site_id) params.set("site_id", tenant.site_id);
    return params.toString() ? `?${params.toString()}` : "";
  }, []);

  const applyFormData = useCallback((payload) => {
    const stockLocations = Array.isArray(payload?.stockLocations) ? payload.stockLocations : [];
    setStockLocationOptions(
      stockLocations.map((item) => ({ id: String(item.id), name: String(item.name ?? "") }))
    );
  }, []);

  const loadPackers = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const payload = await packerRequest("?per_page=500");
      const apiRows = Array.isArray(payload?.data) ? payload.data : Array.isArray(payload) ? payload : [];
      setPackerRecords(apiRows);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load packers.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadPageData = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const [formPayload, packersPayload] = await Promise.all([
        packerRequest(`/form-data${formDataQuery}`),
        packerRequest("?per_page=500"),
      ]);
      applyFormData(formPayload);
      const apiRows = Array.isArray(packersPayload?.data)
        ? packersPayload.data
        : Array.isArray(packersPayload)
          ? packersPayload
          : [];
      setPackerRecords(apiRows);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load packer data.");
      setStockLocationOptions([]);
      setPackerRecords([]);
    } finally {
      setIsLoading(false);
    }
  }, [applyFormData, formDataQuery]);

  useEffect(() => {
    loadPageData();
  }, [loadPageData]);

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
      setError("Organization and current site are required to save a packer.");
      return;
    }

    const body = toApiPayload({
      ...draft,
      stockLocationIds: normalizeIdList(draft.stockLocationIds, stockLocationMap),
    });

    setIsSaving(true);
    setError("");
    setNotice("");

    try {
      if (modalMode === "add") {
        const payload = await packerRequest("", {
          method: "POST",
          body: JSON.stringify(body),
        });
        if (!payload?.id) throw new Error("Invalid response from server.");
        setPackerRecords((prev) => [payload, ...prev]);
        setSelectedId(payload.id);
        setNotice("Packer created successfully.");
        await invalidateReferenceData("packers");
        setModalMode(null);
        return;
      }

      if (modalMode === "edit" && selected) {
        const payload = await packerRequest(`/${selected.id}`, {
          method: "PUT",
          body: JSON.stringify(body),
        });
        if (!payload?.id) throw new Error("Invalid response from server.");
        setPackerRecords((prev) => prev.map((row) => (row.id === selected.id ? payload : row)));
        setNotice("Packer updated successfully.");
        await invalidateReferenceData("packers");
        setModalMode(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save packer.");
    } finally {
      setIsSaving(false);
    }
  }

  function setStockLocationMode(mode) {
    setDraft((prev) => ({
      ...prev,
      stockLocationMode: mode,
      stockLocationIds: mode === "all" ? [] : prev.stockLocationIds,
    }));
  }

  function toggleStockLocation(id) {
    setDraft((prev) => {
      const current = normalizeIdList(prev.stockLocationIds, stockLocationMap);
      const exists = current.includes(id);
      return {
        ...prev,
        stockLocationMode: "selected",
        stockLocationIds: exists ? current.filter((item) => item !== id) : [...current, id],
      };
    });
  }

  async function removeSelected() {
    if (!selected || isDeleting) return;
    if (!window.confirm(`Delete packer "${selected.name}" permanently?`)) return;

    setIsDeleting(true);
    setError("");
    setNotice("");

    try {
      await packerRequest(`/${selected.id}`, { method: "DELETE" });
      setPackerRecords((prev) => prev.filter((row) => row.id !== selected.id));
      setSelectedId(null);
      setNotice("Packer deleted successfully.");
      await invalidateReferenceData("packers");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete packer.");
    } finally {
      setIsDeleting(false);
    }
  }

  const toolbarActions = (
    <div className="flex flex-wrap gap-2">
      <Button type="button" size="sm" onClick={openAddModal} disabled={isLoading}>
        + Add
      </Button>
      <Button type="button" variant="outline" size="sm" onClick={loadPackers} disabled={isLoading}>
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
              emptyMessage={isLoading ? "Loading packers…" : "No packers found."}
              onRowClick={(row) => setSelectedId((prev) => (prev === row.id ? null : row.id))}
              onPersistedRowActivate={(row) => setSelectedId(row.id)}
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
        <div className="mt-4 space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">Stock Locations Allowed</p>
          <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50/50 p-3">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input suppressHydrationWarning type="radio" name="stock-location-mode" checked={draft.stockLocationMode === "all"} onChange={() => setStockLocationMode("all")} />
              All
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="radio"
                name="stock-location-mode"
                checked={draft.stockLocationMode === "selected"}
                disabled={isSaving}
                onChange={() => setStockLocationMode("selected")}
              />
              Select stock locations
            </label>
            {draft.stockLocationMode === "selected" ? (
              stockLocationOptions.length ? (
                <div className="grid gap-2 pt-1 sm:grid-cols-2">
                  {stockLocationOptions.map((option) => {
                    const checked = normalizeIdList(draft.stockLocationIds, stockLocationMap).includes(option.id);
                    return (
                      <label key={option.id} className="flex items-center gap-2 text-sm text-slate-700">
                        <input suppressHydrationWarning type="checkbox" checked={checked} onChange={() => toggleStockLocation(option.id)} />
                        {option.name}
                      </label>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-slate-500">No stock locations found.</p>
              )
            ) : null}
          </div>
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
        <ClutchSelect
          options={toOptions(field.options ?? [])}
          value={value ? { value, label: value } : null}
          onChange={(option) => onChange(option ? option.value : "")}
          isDisabled={disabled}
          placeholder="Select..."
        />
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
          const summary = summaryKeys.map((key) => row[key]).filter(Boolean).join(" · ");
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
              <p className="text-xs font-bold text-blue-600">{row[primaryKey] || ""}</p>
              <p className="mt-1 text-sm font-semibold text-slate-800">{row[secondaryKey] || ""}</p>
              <p className="mt-1 text-[11px] text-slate-500">{summary || ""}</p>
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
      <dd className={cn("mt-0.5 text-slate-800", highlight && "font-semibold text-brand")}>{value || ""}</dd>
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