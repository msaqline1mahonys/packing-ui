"use client";

import { useCallback, useEffect, useState } from "react";

import { Grid } from "@/components/clutch-table";
import ClutchFormField from "@/components/form/clutch-form-field";
import { Button } from "@/components/ui/button";
import { VesselIngestDialog } from "@/components/ingest/vessel-ingest-dialog";
import { useAutoOpenAddModal } from "@/lib/hooks/use-auto-open-add-modal";
import {
  buildRequiredFieldErrors,
  clearFieldError,
  hasFieldErrors,
} from "@/lib/form-validation";
import { cn } from "@/lib/utils";

const MOBILE_BREAKPOINT = 900;
const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api"
).replace(/\/+$/, "");
const VESSELS_ENDPOINT = `${API_BASE_URL}/reference-data/vessels`;

const config = {
  title: "Vessel",
  subtitle: "Maintain vessel hulls (one row per ship). Voyages live on the Vessel Voyage screen.",
  columns: [
    { key: "lloydsNumber", label: "Lloyds / IMO" },
    { key: "vesselName", label: "Vessel" },
    { key: "vesselType", label: "Type" },
    { key: "shippingLine", label: "Default Shipping Line" },
    { key: "voyagesCount", label: "Voyages" },
    { key: "autoCreated", label: "Auto-created" },
  ],
  formFields: [
    { key: "vesselName", label: "Vessel Name", required: true },
    { key: "lloydsNumber", label: "Lloyds / IMO Number" },
    { key: "vesselType", label: "Vessel Type" },
    { key: "shippingLineId", label: "Default Shipping Line", type: "select" },
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

function buildDraft(row) {
  const next = {};
  for (const field of config.formFields) next[field.key] = row?.[field.key] ?? "";
  return next;
}

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

async function vesselRequest(path = "", options = {}) {
  const response = await fetch(`${VESSELS_ENDPOINT}${path}`, {
    ...options,
    headers: { ...getAuthHeaders(), ...(options.headers || {}) },
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || result?.success === false) {
    throw new Error(extractApiError(result, "Vessel request failed."));
  }
  return result?.data ?? result;
}

function fromApiVessel(row) {
  const shippingLineName =
    row.shippingLine?.shipping_line_name ||
    row.shipping_line?.shipping_line_name ||
    "";
  return {
    id: row.id,
    organizationId: row.organization_id ?? "",
    siteId: row.site_id ?? "",
    lloydsNumber: row.lloyds_number ?? "",
    vesselName: row.vessel_name ?? "",
    vesselType: row.vessel_type ?? "",
    shippingLineId: row.shipping_line_id ?? "",
    shippingLine: shippingLineName,
    voyagesCount: row.voyages_count ?? 0,
    autoCreated: row.auto_created ? "Yes" : "",
    organizationName: row.organization?.name ?? "",
    siteName: row.site?.name ?? "",
  };
}

function fromApiShippingLine(row) {
  return {
    value: row.id,
    label: row.shipping_line_name || row.shipping_line_code || "Unnamed shipping line",
  };
}

function toApiPayload(draft) {
  return {
    ...getTenantPayload(),
    vessel_name: draft.vesselName?.trim() || null,
    lloyds_number: draft.lloydsNumber?.trim() || null,
    vessel_type: draft.vesselType?.trim() || null,
    shipping_line_id: draft.shippingLineId || null,
  };
}

export default function VesselPage() {
  const [rows, setRows] = useState([]);
  const [shippingLineOptions, setShippingLineOptions] = useState([]);
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
  const [fieldErrors, setFieldErrors] = useState({});
  const [ingestOpen, setIngestOpen] = useState(false);

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

  const loadVesselData = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const [vesselPayload, formPayload] = await Promise.all([
        vesselRequest("?per_page=100"),
        vesselRequest("/form-data"),
      ]);
      const apiRows = Array.isArray(vesselPayload?.data)
        ? vesselPayload.data
        : Array.isArray(vesselPayload)
          ? vesselPayload
          : [];
      const apiShippingLines = Array.isArray(formPayload?.shippingLines)
        ? formPayload.shippingLines
        : [];
      setRows(apiRows.map(fromApiVessel));
      setShippingLineOptions(apiShippingLines.map(fromApiShippingLine));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load vessel data.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      loadVesselData();
    });
    return () => cancelAnimationFrame(frame);
  }, [loadVesselData]);

  const selected = selectedId != null ? rows.find((row) => row.id === selectedId) ?? null : null;

  const openAddModal = () => {
    setError("");
    setNotice("");
    setFieldErrors({});
    setDraft(buildDraft());
    setModalMode("add");
  };

  useAutoOpenAddModal(openAddModal);

  const openEditModal = () => {
    if (!selected) return;
    setError("");
    setNotice("");
    setFieldErrors({});
    setDraft(buildDraft(selected));
    setModalMode("edit");
  };

  const closeModal = () => {
    if (isSaving) return;
    setFieldErrors({});
    setModalMode(null);
  };

  const saveModal = async () => {
    const errors = buildRequiredFieldErrors(config.formFields, draft);
    if (hasFieldErrors(errors)) {
      setFieldErrors(errors);
      setError("Please fill all required fields.");
      return;
    }
    setIsSaving(true);
    setError("");
    setNotice("");
    try {
      if (modalMode === "add") {
        const payload = await vesselRequest("", {
          method: "POST",
          body: JSON.stringify(toApiPayload(draft)),
        });
        const nextRow = fromApiVessel(payload);
        setRows((prev) => [nextRow, ...prev]);
        setSelectedId(nextRow.id);
        setNotice("Vessel created successfully.");
        setModalMode(null);
        return;
      }
      if (modalMode === "edit" && selected) {
        const payload = await vesselRequest(`/${selected.id}`, {
          method: "PUT",
          body: JSON.stringify(toApiPayload(draft)),
        });
        const nextRow = fromApiVessel(payload);
        setRows((prev) => prev.map((row) => (row.id === selected.id ? nextRow : row)));
        setNotice("Vessel updated successfully.");
        setModalMode(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save vessel.");
    } finally {
      setIsSaving(false);
    }
  };

  const removeSelected = async () => {
    if (!selected || isDeleting) return;
    const shouldDelete = window.confirm(
      `Delete ${selected.vesselName || "this vessel"}? This will also delete all its voyages.`
    );
    if (!shouldDelete) return;
    setIsDeleting(true);
    setError("");
    setNotice("");
    try {
      await vesselRequest(`/${selected.id}`, { method: "DELETE" });
      setRows((prev) => prev.filter((row) => row.id !== selected.id));
      setSelectedId(null);
      setNotice("Vessel deleted successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete vessel.");
    } finally {
      setIsDeleting(false);
    }
  };

  const formFields = config.formFields.map((field) =>
    field.key === "shippingLineId" ? { ...field, options: shippingLineOptions } : field
  );
  const modalError = modalMode ? error : "";

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs text-slate-500">Shipping Details / {config.title}</p>
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
              <div className="flex flex-wrap gap-2 border-b border-slate-100 p-3">
                <Button type="button" size="sm" onClick={openAddModal} disabled={isLoading}>+ Add</Button>
                <Button type="button" variant="outline" size="sm" disabled={!selected || isLoading} onClick={openEditModal}>Edit</Button>
                <Button type="button" variant="destructive" size="sm" disabled={!selected || isLoading || isDeleting} onClick={removeSelected}>
                  {isDeleting ? "Deleting..." : "Delete"}
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={loadVesselData} disabled={isLoading}>Refresh</Button>
              </div>
              <MobileList
                rows={rows}
                selectedId={selectedId}
                onSelect={setSelectedId}
                title={config.title}
                isLoading={isLoading}
                primaryKey="vesselName"
                secondaryKey="lloydsNumber"
                summaryKeys={["vesselType", "shippingLine"]}
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
              emptyMessage={isLoading ? "Loading vessels..." : "No vessels found."}
              onRowClick={(row) => setSelectedId((prev) => (prev === row.id ? null : row.id))}
              onPersistedRowActivate={(row) => setSelectedId(row.id)}
              toolbarActions={
                <div className="flex flex-wrap gap-2">
                  <Button type="button" size="sm" onClick={openAddModal} disabled={isLoading}>+ Add</Button>
                  <Button type="button" variant="outline" size="sm" disabled={!selected || isLoading} onClick={openEditModal}>Edit</Button>
                  <Button type="button" variant="destructive" size="sm" disabled={!selected || isLoading || isDeleting} onClick={removeSelected}>
                    {isDeleting ? "Deleting..." : "Delete"}
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={loadVesselData} disabled={isLoading}>Refresh</Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => setIngestOpen(true)} disabled={isLoading}>Import Schedule</Button>
                </div>
              }
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
                  <DetailItem key={column.key} label={column.label} value={selected[column.key]} highlight={column === config.columns[1]} />
                ))}
              </dl>
            )}
          </aside>
        ) : null}
      </div>

      <VesselIngestDialog open={ingestOpen} onClose={() => setIngestOpen(false)} onIngestComplete={loadVesselData} />

      <Modal open={modalMode != null} title={modalMode === "edit" ? `Edit ${config.title}` : `Add ${config.title}`} onClose={closeModal}>
        {modalError ? (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-600">{modalError}</div>
        ) : null}
        <div className="grid gap-3 sm:grid-cols-2">
          {formFields.map((field) => (
            <ClutchFormField
              key={field.key}
              field={field}
              value={draft[field.key] ?? ""}
              disabled={isSaving}
              hasError={Boolean(fieldErrors[field.key])}
              onChange={(value) => {
                setFieldErrors((prev) => clearFieldError(prev, field.key));
                setDraft((prev) => ({ ...prev, [field.key]: value }));
              }}
            />
          ))}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={closeModal} disabled={isSaving}>Cancel</Button>
          <Button type="button" size="sm" onClick={saveModal} disabled={isSaving}>
            {isSaving ? "Saving..." : modalMode === "edit" ? "Save changes" : "Create"}
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
          ^
        </button>
      ) : null}
    </div>
  );
}

function MobileList({ rows, selectedId, onSelect, title, primaryKey, secondaryKey, summaryKeys, isLoading }) {
  const emptyMessage = isLoading ? `Loading ${title.toLowerCase()}...` : `No ${title.toLowerCase()} found. Add your first one!`;
  return (
    <div className="space-y-2 p-3">
      <div className="px-0.5 text-xs font-semibold text-slate-600">{title} ({rows.length})</div>
      {rows.length === 0 ? (
        <div className="py-8 text-center text-sm text-slate-400">{emptyMessage}</div>
      ) : (
        rows.map((row) => {
          const isSelected = row.id === selectedId;
          const summary = summaryKeys.map((key) => row[key]).filter(Boolean).join(" - ");
          return (
            <button
              key={row.id}
              type="button"
              onClick={() => onSelect(isSelected ? null : row.id)}
              className={cn("w-full rounded-xl border-2 px-3 py-3 text-left transition-colors", isSelected ? "border-blue-500 bg-blue-50" : "border-slate-200 bg-white")}
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
      <div role="dialog" aria-modal="true" aria-labelledby="reference-data-modal-title" className="relative max-h-[min(90vh,720px)] w-full max-w-2xl overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-4 py-3">
          <h2 id="reference-data-modal-title" className="text-sm font-semibold text-slate-900">{title}</h2>
          <button type="button" className="rounded-md px-2 py-1 text-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800" onClick={onClose}>x</button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}
