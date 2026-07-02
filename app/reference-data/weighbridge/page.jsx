"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { Grid } from "@/components/clutch-table";
import ClutchFormField from "@/components/form/clutch-form-field";
import ClutchSelect, { toOptions } from "@/components/custom/ClutchSelect";
import { Button } from "@/components/ui/button";
import { buildRequiredFieldErrors, clearFieldError } from "@/lib/form-validation";
import { useInvalidateReferenceData } from "@/lib/hooks/use-reference-data-queries";
import { useAutoOpenAddModal } from "@/lib/hooks/use-auto-open-add-modal";
import { cn } from "@/lib/utils";

const MOBILE_BREAKPOINT = 900;
const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api"
).replace(/\/+$/, "");
const WEIGHBRIDGES_ENDPOINT = `${API_BASE_URL}/reference-data/weighbridges`;

const TYPE_OPTIONS = [
  { value: "container", label: "Container (Packer scale)" },
  { value: "truck", label: "Truck (In / Out)" },
];

const config = {
  title: "Weighbridge",
  subtitle: "Link each scale to its Power Automate connector, and container scales to their packer.",
  columns: [
    { key: "name", label: "Name" },
    { key: "typeLabel", label: "Type" },
    { key: "packerName", label: "Packer" },
    { key: "isDefaultLabel", label: "Site Default" },
    { key: "status", label: "Status" },
  ],
  formFields: [
    { key: "name", label: "Name", required: true },
    { key: "type", label: "Type", type: "select", options: TYPE_OPTIONS },
    { key: "status", label: "Status", type: "select", options: ["Active", "Under maintenance", "Inactive"] },
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

async function weighbridgeRequest(path = "", options = {}) {
  const response = await fetch(`${WEIGHBRIDGES_ENDPOINT}${path}`, {
    ...options,
    headers: {
      ...getAuthHeaders(),
      ...(options.headers || {}),
    },
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || result?.success === false) {
    throw new Error(extractApiError(result, "Weighbridge request failed."));
  }
  return result?.data ?? result;
}

function typeLabel(type) {
  return TYPE_OPTIONS.find((o) => o.value === type)?.label ?? type ?? "";
}

function toDisplayRow(row) {
  const type = row?.type === "truck" ? "truck" : "container";
  const isDefault = Boolean(row?.is_default ?? row?.isDefault);
  const packerName = row?.packer?.name ?? "";

  return {
    id: row.id,
    name: row.name ?? "",
    type,
    typeLabel: typeLabel(type),
    packerId: row?.packer_id ?? row?.packerId ?? "",
    packerName,
    isDefault,
    isDefaultLabel: type === "truck" ? (isDefault ? "Yes" : "No") : "—",
    method: row?.method ?? "POST",
    status: row.status ?? "Active",
    connectorConfigured: Boolean(row?.masked_url ?? row?.maskedUrl),
  };
}

function buildDraft(row) {
  return {
    name: row?.name ?? "",
    type: row?.type ?? "container",
    status: row?.status ?? "Active",
    packerId: row?.packerId ?? "",
    isDefault: Boolean(row?.isDefault),
    url: "", // never prefilled — it's a secret; blank means "keep existing"
  };
}

function toApiPayload(draft, { includeUrl }) {
  const type = draft.type === "truck" ? "truck" : "container";
  const payload = {
    ...getTenantPayload(),
    name: String(draft.name ?? "").trim(),
    type,
    status: String(draft.status ?? "").trim() || "Active",
    packer_id: type === "container" ? draft.packerId || null : null,
    is_default: type === "truck" ? Boolean(draft.isDefault) : false,
  };
  if (includeUrl) {
    payload.url = String(draft.url ?? "").trim();
  }
  return payload;
}

export default function WeighbridgePage() {
  const invalidateReferenceData = useInvalidateReferenceData();

  const [records, setRecords] = useState([]);
  const [packerOptions, setPackerOptions] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [modalMode, setModalMode] = useState(null);
  const [draft, setDraft] = useState(() => buildDraft());
  const [isMobile, setIsMobile] = useState(false);
  const [showGoToTop, setShowGoToTop] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});

  const rows = useMemo(() => records.map((row) => toDisplayRow(row)).filter(Boolean), [records]);

  const formDataQuery = useMemo(() => {
    const tenant = getTenantPayload();
    const params = new URLSearchParams();
    if (tenant.organization_id) params.set("organization_id", tenant.organization_id);
    if (tenant.site_id) params.set("site_id", tenant.site_id);
    return params.toString() ? `?${params.toString()}` : "";
  }, []);

  const applyFormData = useCallback((payload) => {
    const packers = Array.isArray(payload?.packers) ? payload.packers : [];
    setPackerOptions(packers.map((item) => ({ value: String(item.id), label: String(item.name ?? "") })));
  }, []);

  const loadRecords = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const payload = await weighbridgeRequest("?per_page=500");
      const apiRows = Array.isArray(payload?.data) ? payload.data : Array.isArray(payload) ? payload : [];
      setRecords(apiRows);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load weighbridges.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadPageData = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const [formPayload, listPayload] = await Promise.all([
        weighbridgeRequest(`/form-data${formDataQuery}`),
        weighbridgeRequest("?per_page=500"),
      ]);
      applyFormData(formPayload);
      const apiRows = Array.isArray(listPayload?.data)
        ? listPayload.data
        : Array.isArray(listPayload)
          ? listPayload
          : [];
      setRecords(apiRows);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load weighbridge data.");
      setPackerOptions([]);
      setRecords([]);
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
    setFieldErrors({});
    setDraft(buildDraft());
    setModalMode("add");
  }

  useAutoOpenAddModal(openAddModal);

  function openEditModal() {
    if (!selected) return;
    setError("");
    setNotice("");
    setFieldErrors({});
    setDraft(buildDraft(selected));
    setModalMode("edit");
  }

  function closeModal() {
    if (isSaving) return;
    setModalMode(null);
    setError("");
    setFieldErrors({});
  }

  async function saveModal() {
    const nextFieldErrors = buildRequiredFieldErrors(config.formFields, draft);
    if (modalMode === "add" && !String(draft.url ?? "").trim()) {
      nextFieldErrors.url = true;
    }
    if (Object.keys(nextFieldErrors).length) {
      setFieldErrors(nextFieldErrors);
      setError("Please fill all required fields.");
      return;
    }
    setFieldErrors({});

    const tenant = getTenantPayload();
    if (!tenant.organization_id || !tenant.site_id) {
      setError("Organization and current site are required to save a weighbridge.");
      return;
    }

    const hasNewUrl = Boolean(String(draft.url ?? "").trim());
    const body = toApiPayload(draft, { includeUrl: modalMode === "add" || hasNewUrl });

    setIsSaving(true);
    setError("");
    setNotice("");

    try {
      if (modalMode === "add") {
        const payload = await weighbridgeRequest("", { method: "POST", body: JSON.stringify(body) });
        if (!payload?.id) throw new Error("Invalid response from server.");
        setNotice("Weighbridge created successfully.");
        await invalidateReferenceData("weighbridges");
        await loadRecords();
        setSelectedId(payload.id);
        setModalMode(null);
        return;
      }

      if (modalMode === "edit" && selected) {
        const payload = await weighbridgeRequest(`/${selected.id}`, { method: "PUT", body: JSON.stringify(body) });
        if (!payload?.id) throw new Error("Invalid response from server.");
        setNotice("Weighbridge updated successfully.");
        await invalidateReferenceData("weighbridges");
        await loadRecords();
        setModalMode(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save weighbridge.");
    } finally {
      setIsSaving(false);
    }
  }

  async function testConnection() {
    if (!selected || isTesting) return;
    setIsTesting(true);
    setError("");
    setNotice("");
    try {
      const payload = await weighbridgeRequest(`/${selected.id}/read`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      setNotice(`Connection OK — read ${payload?.weight ?? "?"} T.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Test read failed.");
    } finally {
      setIsTesting(false);
    }
  }

  async function removeSelected() {
    if (!selected || isDeleting) return;
    if (!window.confirm(`Delete weighbridge "${selected.name}" permanently?`)) return;

    setIsDeleting(true);
    setError("");
    setNotice("");

    try {
      await weighbridgeRequest(`/${selected.id}`, { method: "DELETE" });
      setRecords((prev) => prev.filter((row) => row.id !== selected.id));
      setSelectedId(null);
      setNotice("Weighbridge deleted successfully.");
      await invalidateReferenceData("weighbridges");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete weighbridge.");
    } finally {
      setIsDeleting(false);
    }
  }

  const toolbarActions = (
    <div className="flex flex-wrap gap-2">
      <Button type="button" size="sm" onClick={openAddModal} disabled={isLoading}>
        + Add
      </Button>
      <Button type="button" variant="outline" size="sm" onClick={loadRecords} disabled={isLoading}>
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
                secondaryKey={config.columns[1]?.key}
                summaryKeys={config.columns.slice(2, 5).map((column) => column.key)}
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
              emptyMessage={isLoading ? "Loading weighbridges…" : "No weighbridges found."}
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
                <DetailItem
                  label="Connector URL"
                  value={selected.connectorConfigured ? "Configured" : "Not set"}
                />
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
            <ClutchFormField
              key={field.key}
              field={field}
              value={draft[field.key] ?? ""}
              disabled={isSaving}
              hasError={Boolean(fieldErrors[field.key])}
              onChange={(value) => {
                setDraft((prev) => ({ ...prev, [field.key]: value }));
                setFieldErrors((prev) => clearFieldError(prev, field.key));
              }}
            />
          ))}

          {draft.type === "container" ? (
            <div className="space-y-1">
              <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">Linked Packer</label>
              <ClutchSelect
                options={toOptions(packerOptions)}
                value={packerOptions.find((o) => String(o.value) === String(draft.packerId)) ?? null}
                onChange={(option) => setDraft((prev) => ({ ...prev, packerId: option ? option.value : "" }))}
                isDisabled={isSaving}
                isClearable
                placeholder="Select packer…"
              />
              <p className="text-[11px] text-slate-500">Container scales pull weights via their packer.</p>
            </div>
          ) : null}
        </div>

        <div className="mt-3 space-y-1">
          <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">
            Connector URL {modalMode === "add" ? <span className="text-red-500">*</span> : null}
          </label>
          <input
            suppressHydrationWarning
            type="password"
            className={cn(
              "w-full rounded-lg border bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-brand/15 placeholder:text-slate-400 focus:ring-2",
              fieldErrors.url ? "border-red-400 focus:border-red-400" : "border-slate-200/95 focus:border-brand/35"
            )}
            value={draft.url ?? ""}
            disabled={isSaving}
            autoComplete="off"
            placeholder={modalMode === "edit" ? "Leave blank to keep current URL" : "Paste the Power Automate connector URL"}
            onChange={(event) => {
              const value = event.target.value;
              setDraft((prev) => ({ ...prev, url: value }));
              setFieldErrors((prev) => clearFieldError(prev, "url"));
            }}
          />
          {modalMode === "edit" && selected?.connectorConfigured ? (
            <p className="text-[11px] text-slate-500">
              A connector URL is already saved. Leave blank to keep it, or paste a new URL to replace it.
            </p>
          ) : (
            <p className="text-[11px] text-slate-500">Stored encrypted; only ever sent to the server.</p>
          )}
        </div>

        {draft.type === "truck" ? (
          <label className="mt-3 flex items-center gap-2 text-sm text-slate-700">
            <input
              suppressHydrationWarning
              type="checkbox"
              checked={Boolean(draft.isDefault)}
              disabled={isSaving}
              onChange={(event) => setDraft((prev) => ({ ...prev, isDefault: event.target.checked }))}
            />
            Set as this site&apos;s default truck weighbridge (used by in / out tickets)
          </label>
        ) : null}

        <div className="mt-5 flex items-center justify-between gap-2">
          <div>
            {modalMode === "edit" && selected ? (
              <Button type="button" variant="outline" size="sm" onClick={testConnection} disabled={isSaving || isTesting}>
                {isTesting ? "Testing…" : "Test connection"}
              </Button>
            ) : null}
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={closeModal} disabled={isSaving}>
              Cancel
            </Button>
            <Button type="button" size="sm" onClick={saveModal} disabled={isSaving}>
              {isSaving ? "Saving…" : modalMode === "edit" ? "Save changes" : "Create"}
            </Button>
          </div>
        </div>
      </Modal>

      {isMobile && showGoToTop ? (
        <button
          type="button"
          aria-label="Go to top"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="fixed bottom-5 right-5 z-50 flex size-12 items-center justify-center rounded-full bg-gradient-to-br from-brand to-blue-500 text-xl text-white shadow-lg shadow-blue-500/30"
        >
          ↑
        </button>
      ) : null}
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
