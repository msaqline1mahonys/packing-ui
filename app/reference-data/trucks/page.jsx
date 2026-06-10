"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Grid } from "@/components/clutch-table";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const MOBILE_BREAKPOINT = 900;
const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api"
).replace(/\/+$/, "");
const TRUCKS_ENDPOINT = `${API_BASE_URL}/reference-data/trucks`;

const inputClass =
  "w-full rounded-lg border border-slate-200/95 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-brand/15 placeholder:text-slate-400 focus:border-brand/35 focus:ring-2";

const config = {
  title: "Trucks",
  subtitle: "Manage truck fleet records used in ticketing and operations.",
  columns: [
    { key: "name", label: "Rego" },
    { key: "driver", label: "Driver" },
    { key: "combination", label: "Combination" },
    { key: "tare", label: "Tare (T)", numeric: true },
  ],
  formFields: [
    { key: "name", label: "Rego", required: true, placeholder: "e.g. MHY-104" },
    { key: "driver", label: "Driver", placeholder: "Driver name" },
    { key: "combination", label: "Combination", placeholder: "e.g. B-Double" },
    { key: "tare", label: "Tare (T)", type: "number", placeholder: "0.00" },
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

function parseFieldValue(field, value) {
  if (field.type !== "number") return value;
  if (value === "") return "";
  const parsed = Number(value);
  return Number.isNaN(parsed) ? value : String(parsed);
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

async function truckRequest(path = "", options = {}) {
  const response = await fetch(`${TRUCKS_ENDPOINT}${path}`, {
    ...options,
    headers: {
      ...getAuthHeaders(),
      ...(options.headers || {}),
    },
  });
  const result = await response.json().catch(() => null);

  if (!response.ok || result?.success === false) {
    throw new Error(extractApiError(result, "Truck request failed."));
  }

  return result?.data ?? result;
}

function fromApiTruck(row) {
  if (!row) return null;
  const tareVal = row.tare;
  const tareStr =
    tareVal === null || tareVal === undefined || tareVal === ""
      ? ""
      : String(tareVal);
  return {
    id: row.id,
    name: row.rego ?? "",
    driver: row.driver ?? "",
    combination: row.combination ?? "",
    tare: tareStr,
    organizationName: row.organization?.name ?? "",
    siteName: row.site?.name ?? "",
  };
}

function toApiPayload(draft) {
  const tareRaw = draft.tare;
  let tare = null;
  if (tareRaw !== "" && tareRaw != null) {
    const n = Number(tareRaw);
    tare = Number.isNaN(n) ? null : n;
  }
  return {
    ...getTenantPayload(),
    rego: String(draft.name ?? "").trim() || null,
    driver: String(draft.driver ?? "").trim() || null,
    combination: String(draft.combination ?? "").trim() || null,
    tare,
  };
}

export default function TrucksPage() {
  return (
    <Suspense fallback={null}>
      <TrucksPageContent />
    </Suspense>
  );
}

function TrucksPageContent() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
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

  const loadTrucks = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const payload = await truckRequest("?per_page=100");
      const apiRows = Array.isArray(payload?.data)
        ? payload.data
        : Array.isArray(payload)
          ? payload
          : [];
      setRows(apiRows.map(fromApiTruck).filter(Boolean));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load trucks.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      loadTrucks();
    });
    return () => cancelAnimationFrame(frame);
  }, [loadTrucks]);

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

  const openAddModal = () => {
    setError("");
    setNotice("");
    setDraft(buildDraft());
    setModalMode("add");
  };

  const openEditModalForRow = useCallback((row) => {
    if (!row) return;
    setError("");
    setNotice("");
    setSelectedId(row.id);
    setDraft(buildDraft(row));
    setModalMode("edit");
  }, []);

  const openEditModal = () => {
    const row = selectedId != null ? rows.find((item) => item.id === selectedId) ?? null : null;
    openEditModalForRow(row);
  };

  const getRowHref = useCallback((row) => {
    if (!row?.id) return null;
    return `${pathname}?edit=${encodeURIComponent(String(row.id))}`;
  }, [pathname]);

  useEffect(() => {
    const editId = searchParams.get("edit");
    if (!editId || isLoading || rows.length === 0 || modalMode != null) return;
    const row = rows.find((item) => String(item.id) === editId);
    if (row) openEditModalForRow(row);
  }, [searchParams, rows, isLoading, modalMode, openEditModalForRow]);

  const finishModal = useCallback(() => {
    setModalMode(null);
    if (searchParams.get("edit")) {
      router.replace(pathname, { scroll: false });
    }
  }, [pathname, router, searchParams]);

  const closeModal = () => {
    if (isSaving) return;
    finishModal();
  };

  const saveModal = async () => {
    const requiredMissing = config.formFields.some(
      (field) => field.required && !String(draft[field.key] ?? "").trim()
    );
    if (requiredMissing) {
      setError("Please fill all required fields.");
      return;
    }

    const tenant = getTenantPayload();
    if (!tenant.organization_id || !tenant.site_id) {
      setError("Organization and current site are required to save a truck.");
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
        const payload = await truckRequest("", {
          method: "POST",
          body: JSON.stringify(toApiPayload(normalized)),
        });
        const nextRow = fromApiTruck(payload);
        if (!nextRow) throw new Error("Invalid response from server.");
        setRows((prev) => [nextRow, ...prev]);
        setSelectedId(nextRow.id);
        setNotice("Truck created successfully.");
        finishModal();
        return;
      }

      if (modalMode === "edit" && selected) {
        const payload = await truckRequest(`/${selected.id}`, {
          method: "PUT",
          body: JSON.stringify(toApiPayload(normalized)),
        });
        const nextRow = fromApiTruck(payload);
        if (!nextRow) throw new Error("Invalid response from server.");
        setRows((prev) => prev.map((row) => (row.id === selected.id ? nextRow : row)));
        setNotice("Truck updated successfully.");
        finishModal();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save truck.");
    } finally {
      setIsSaving(false);
    }
  };

  const removeSelected = async () => {
    if (!selected || isDeleting) return;
    const shouldDelete = window.confirm(`Delete truck "${selected.name || selected.id}"?`);
    if (!shouldDelete) return;

    setIsDeleting(true);
    setError("");
    setNotice("");

    try {
      await truckRequest(`/${selected.id}`, { method: "DELETE" });
      setRows((prev) => prev.filter((row) => row.id !== selected.id));
      setSelectedId(null);
      setNotice("Truck deleted successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete truck.");
    } finally {
      setIsDeleting(false);
    }
  };

  const modalError = modalMode ? error : "";

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

      <div className={cn(
        "grid gap-6 xl:items-start",
        !isMobile && selected ? "xl:grid-cols-[minmax(0,1fr)_minmax(240px,320px)]" : "xl:grid-cols-1",
        isMobile && "grid-cols-1"
      )}>
        <div className="overflow-hidden rounded-xl bg-white shadow-sm">
          {isMobile ? (
            <>
              <div className="flex flex-wrap gap-2 border-b border-slate-100 p-3">
                <Button type="button" size="sm" onClick={openAddModal} disabled={isLoading}>
                  + Add
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={loadTrucks} disabled={isLoading}>
                  Refresh
                </Button>
                <Button type="button" variant="outline" size="sm" disabled={selectedId == null || isLoading} onClick={openEditModal}>
                  Edit
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  disabled={selectedId == null || isLoading || isDeleting}
                  onClick={removeSelected}
                >
                  {isDeleting ? "Deleting..." : "Delete"}
                </Button>
              </div>
              <MobileList
                rows={rows}
                selectedId={selectedId}
                onSelect={setSelectedId}
                search=""
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
              emptyMessage={isLoading ? "Loading trucks..." : "No trucks found."}
              onRowClick={(row) => setSelectedId(row.id)}
              onPersistedRowActivate={(row) => setSelectedId(row.id)}
              onRowDoubleClick={openEditModalForRow}
              getRowHref={getRowHref}
              onSelectionChange={(selectedRows) => {
                if (selectedRows.length > 0) {
                  setSelectedId(selectedRows[selectedRows.length - 1].id);
                } else {
                  setSelectedId(null);
                }
              }}
              toolbarActions={
                <div className="flex flex-wrap gap-2">
                  <Button type="button" size="sm" onClick={openAddModal} disabled={isLoading}>
                    + Add
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={loadTrucks} disabled={isLoading}>
                    Refresh
                  </Button>
                  <Button type="button" variant="outline" size="sm" disabled={selectedId == null || isLoading} onClick={openEditModal}>
                    Edit
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    disabled={selectedId == null || isLoading || isDeleting}
                    onClick={removeSelected}
                  >
                    {isDeleting ? "Deleting..." : "Delete"}
                  </Button>
                </div>
              }
            />
          )}
        </div>

        {!isMobile && selected ? (
          <aside className="rounded-xl border border-slate-200/90 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900">{config.title} Details</h2>
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
        <select suppressHydrationWarning className={inputClass} value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)}>
          <option value="">Select...</option>
          {field.options?.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      ) : field.type === "textarea" ? (
        <textarea
          className={cn(inputClass, "min-h-20 resize-y")}
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          placeholder={field.placeholder}
          rows={3}
        />
      ) : (
        <input
          type={field.type || "text"}
          className={inputClass}
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          placeholder={field.placeholder}
        />
      )}
    </div>
  );
}

function MobileList({ rows, selectedId, onSelect, search, title, primaryKey, secondaryKey, summaryKeys, isLoading }) {
  const emptyMessage = isLoading
    ? `Loading ${title.toLowerCase()}...`
    : search
      ? `No ${title.toLowerCase()} match your search.`
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
          <button type="button" className="rounded-md px-2 py-1 text-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800" onClick={onClose}>
            x
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}