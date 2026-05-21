"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const MOBILE_BREAKPOINT = 900;
const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api"
).replace(/\/+$/, "");
const SITES_ENDPOINT = `${API_BASE_URL}/sites`;

const inputClass =
  "w-full rounded-lg border border-slate-200/95 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-brand/15 placeholder:text-slate-400 focus:border-brand/35 focus:ring-2";
const filterInputClass =
  "w-full rounded-md border border-slate-200/90 bg-white px-2 py-1 text-xs text-slate-800 outline-none placeholder:text-slate-400 focus:border-brand/35 focus:ring-1 focus:ring-brand/25";

const config = {
  title: "Site",
  subtitle: "Maintain site records used across operational modules.",
  columns: [
    { key: "name", label: "Site name" },
    { key: "code", label: "Code" },
    { key: "status", label: "Status" },
    { key: "email", label: "Email" },
    { key: "phone", label: "Phone" },
    { key: "treatmentProviderId", label: "Treatment provider ID" },
    { key: "isHeadOffice", label: "Head office" },
  ],
  formFields: [
    { key: "name", label: "Site name", required: true, placeholder: "e.g. Melbourne" },
    { key: "code", label: "Code", placeholder: "Site code" },
    { key: "phone", label: "Phone", placeholder: "+61 …" },
    { key: "email", label: "Email", type: "email", placeholder: "contact@example.com" },
    { key: "treatmentProviderId", label: "Treatment provider ID", placeholder: "ABF/AQIS registration / AEI / AA / ERE" },
    { key: "address", label: "Address", type: "textarea", placeholder: "Street, city…" },
    {
      key: "status",
      label: "Status",
      type: "select",
      options: [
        { value: "active", label: "Active" },
        { value: "inactive", label: "Inactive" },
      ],
    },
    {
      key: "isHeadOffice",
      label: "Head office",
      type: "select",
      options: [
        { value: "false", label: "No" },
        { value: "true", label: "Yes" },
      ],
    },
  ],
};

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
  };
}

function extractApiError(result, fallback) {
  if (result?.errors) {
    return Object.values(result.errors).flat().join(", ");
  }
  return result?.message || fallback;
}

async function siteRequest(path = "", options = {}) {
  const response = await fetch(`${SITES_ENDPOINT}${path}`, {
    ...options,
    headers: {
      ...getAuthHeaders(),
      ...(options.headers || {}),
    },
  });
  const result = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(extractApiError(result, "Site request failed."));
  }
  return result;
}

function fromApiSite(site) {
  if (!site) return null;
  return {
    id: site.id,
    name: site.name ?? "",
    code: site.code ?? "",
    phone: site.phone ?? "",
    email: site.email ?? "",
    address: site.address ?? "",
    status: site.status ?? "",
    treatmentProviderId: site.treatment_provider_id ?? site.treatmentProviderId ?? "",
    isHeadOffice: Boolean(site.is_head_office),
    organizationName: site.organization?.name ?? "",
    organizationId: site.organization_id ?? "",
  };
}

function toApiCreateBody(draft) {
  const { organization_id: orgId } = getTenantPayload();
  return {
    organization_id: orgId,
    name: String(draft.name ?? "").trim(),
    phone: String(draft.phone ?? "").trim() || null,
    email: String(draft.email ?? "").trim() || null,
    address: String(draft.address ?? "").trim() || null,
    code: String(draft.code ?? "").trim() || null,
    status: String(draft.status ?? "active").trim() || "active",
    treatment_provider_id: String(draft.treatmentProviderId ?? "").trim() || null,
    is_head_office: draft.isHeadOffice === "true" || draft.isHeadOffice === true,
  };
}

function toApiUpdateBody(draft) {
  return {
    name: String(draft.name ?? "").trim(),
    phone: String(draft.phone ?? "").trim() || null,
    email: String(draft.email ?? "").trim() || null,
    address: String(draft.address ?? "").trim() || null,
    code: String(draft.code ?? "").trim() || null,
    status: String(draft.status ?? "active").trim() || "active",
    treatment_provider_id: String(draft.treatmentProviderId ?? "").trim() || null,
    is_head_office: draft.isHeadOffice === "true" || draft.isHeadOffice === true,
  };
}

function buildDraft(row) {
  const next = {};
  for (const field of config.formFields) {
    if (field.key === "isHeadOffice") {
      next[field.key] = row?.isHeadOffice ? "true" : "false";
      continue;
    }
    if (field.key === "status") {
      next[field.key] = row?.status ? String(row.status) : "active";
      continue;
    }
    next[field.key] = row?.[field.key] ?? "";
  }
  return next;
}

function formatCell(column, value) {
  if (column.key === "isHeadOffice") {
    return value === true ? "Yes" : value === false ? "No" : "—";
  }
  if (value === null || value === undefined || value === "") return "—";
  return String(value);
}

export default function SitePage() {
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState("");
  const [colFilters, setColFilters] = useState(() =>
    Object.fromEntries(config.columns.map((column) => [column.key, ""]))
  );
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

  const loadSites = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const result = await siteRequest("?per_page=100");
      const pager = result?.sites;
      const apiRows = Array.isArray(pager?.data) ? pager.data : Array.isArray(pager) ? pager : [];
      setRows(apiRows.map(fromApiSite).filter(Boolean));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load sites.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      loadSites();
    });
    return () => cancelAnimationFrame(frame);
  }, [loadSites]);

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

  const filteredRows = useMemo(
    () =>
      rows.filter((row) => {
        const q = search.trim().toLowerCase();
        if (q) {
          const blob = config.columns
            .map((column) => formatCell(column, row[column.key]))
            .join(" ")
            .toLowerCase();
          if (!blob.includes(q)) return false;
        }
        for (const column of config.columns) {
          const filterVal = (colFilters[column.key] || "").trim().toLowerCase();
          if (!filterVal) continue;
          const hay = formatCell(column, row[column.key]).toLowerCase();
          if (!hay.includes(filterVal)) return false;
        }
        return true;
      }),
    [rows, search, colFilters]
  );

  const selected =
    selectedId != null ? filteredRows.find((row) => row.id === selectedId) ?? null : null;

  const openAddModal = () => {
    setError("");
    setNotice("");
    setDraft(buildDraft());
    setModalMode("add");
  };

  const openEditModal = () => {
    if (!selected) return;
    setError("");
    setNotice("");
    setDraft(buildDraft(selected));
    setModalMode("edit");
  };

  const closeModal = () => {
    if (isSaving) return;
    setModalMode(null);
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
    if (modalMode === "add" && !tenant.organization_id) {
      setError("Your account has no organization; cannot create a site.");
      return;
    }

    setIsSaving(true);
    setError("");
    setNotice("");

    try {
      if (modalMode === "add") {
        const result = await siteRequest("", {
          method: "POST",
          body: JSON.stringify(toApiCreateBody(draft)),
        });
        const nextRow = fromApiSite(result.site);
        if (!nextRow) throw new Error("Invalid response from server.");
        setRows((prev) => [nextRow, ...prev]);
        setSelectedId(nextRow.id);
        setNotice(result.message || "Site created successfully.");
        setModalMode(null);
        return;
      }

      if (modalMode === "edit" && selected) {
        const result = await siteRequest(`/${selected.id}`, {
          method: "PUT",
          body: JSON.stringify(toApiUpdateBody(draft)),
        });
        const nextRow = fromApiSite(result.site);
        if (!nextRow) throw new Error("Invalid response from server.");
        setRows((prev) => prev.map((row) => (row.id === selected.id ? nextRow : row)));
        setNotice(result.message || "Site updated successfully.");
        setModalMode(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save site.");
    } finally {
      setIsSaving(false);
    }
  };

  const removeSelected = async () => {
    if (!selected || isDeleting) return;
    const shouldDelete = window.confirm(
      `Delete site "${selected.name || selected.id}"? Head office sites cannot be deleted.`
    );
    if (!shouldDelete) return;

    setIsDeleting(true);
    setError("");
    setNotice("");

    try {
      const result = await siteRequest(`/${selected.id}`, { method: "DELETE" });
      setRows((prev) => prev.filter((row) => row.id !== selected.id));
      setSelectedId(null);
      setNotice(result.message || "Site deleted successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete site.");
    } finally {
      setIsDeleting(false);
    }
  };

  const modalError = modalMode ? error : "";

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs text-slate-500">Reference Data / {config.title}</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 md:text-[1.65rem]">
          {config.title}
        </h1>
        {!isMobile ? <p className="mt-1 text-xs text-slate-500">{config.subtitle}</p> : null}
      </div>

      {!modalMode && error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </div>
      ) : null}

      {notice ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {notice}
        </div>
      ) : null}

      <div className="rounded-xl border border-slate-200/90 bg-white p-3 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center">
          <input
            className={cn(inputClass, "lg:min-w-[240px] lg:flex-1", isMobile && "w-full")}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={`Search ${config.title.toLowerCase()}...`}
            aria-label={`Search ${config.title}`}
            disabled={isLoading}
          />
          <div className={cn("flex flex-wrap gap-2 lg:ms-auto", isMobile && "w-full")}>
            <Button type="button" size="sm" onClick={openAddModal} disabled={isLoading}>
              + Add
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={loadSites} disabled={isLoading}>
              Refresh
            </Button>
            {isMobile && selected ? (
              <Button type="button" size="sm" disabled={!selected || isLoading} onClick={openEditModal}>
                View / Edit
              </Button>
            ) : (
              <Button type="button" variant="outline" size="sm" disabled={!selected || isLoading} onClick={openEditModal}>
                Edit
              </Button>
            )}
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
        </div>
      </div>

      <div
        className={cn(
          "grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(240px,320px)] xl:items-start",
          isMobile && "grid-cols-1"
        )}
      >
        <div className="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-sm">
          {isMobile ? (
            <MobileList
              rows={filteredRows}
              selectedId={selectedId}
              onSelect={setSelectedId}
              search={search}
              title={config.title}
              isLoading={isLoading}
              primaryKey={config.columns[0]?.key}
              secondaryKey={config.columns[2]?.key ?? config.columns[1]?.key}
              summaryKeys={config.columns.slice(1, 4).map((column) => column.key)}
              formatCell={formatCell}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[960px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/95">
                    {config.columns.map((column) => (
                      <th
                        key={column.key}
                        className={cn(
                          "whitespace-nowrap px-3 py-2.5 text-[10px] font-bold uppercase tracking-wide text-slate-500",
                          column.numeric && "text-right"
                        )}
                      >
                        {column.label}
                      </th>
                    ))}
                  </tr>
                  <tr className="border-b border-slate-200 bg-white">
                    {config.columns.map((column) => (
                      <th key={`filter-${column.key}`} className="px-2 py-1.5">
                        <input
                          className={filterInputClass}
                          placeholder="Filter…"
                          value={colFilters[column.key]}
                          onChange={(event) =>
                            setColFilters((prev) => ({ ...prev, [column.key]: event.target.value }))
                          }
                          aria-label={`Filter ${column.label}`}
                          disabled={isLoading}
                        />
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr>
                      <td colSpan={config.columns.length} className="px-3 py-14 text-center text-sm text-slate-400">
                        Loading sites…
                      </td>
                    </tr>
                  ) : filteredRows.length === 0 ? (
                    <tr>
                      <td colSpan={config.columns.length} className="px-3 py-14 text-center text-sm text-slate-400">
                        No rows found.
                      </td>
                    </tr>
                  ) : (
                    filteredRows.map((row) => {
                      const isSelected = selectedId === row.id;
                      return (
                        <tr
                          key={row.id}
                          onClick={() => setSelectedId((prev) => (prev === row.id ? null : row.id))}
                          className={cn(
                            "cursor-pointer border-b border-slate-100 transition-colors last:border-0",
                            isSelected ? "bg-brand/[0.07]" : "hover:bg-slate-50/90"
                          )}
                        >
                          {config.columns.map((column) => (
                            <td
                              key={`${row.id}-${column.key}`}
                              className={cn(
                                "max-w-[220px] truncate px-3 py-2.5 text-slate-700",
                                column.numeric && "text-right tabular-nums"
                              )}
                              title={String(row[column.key] ?? "")}
                            >
                              {formatCell(column, row[column.key])}
                            </td>
                          ))}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {!isMobile ? (
          <aside className="rounded-xl border border-slate-200/90 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900">{config.title} details</h2>
            {!selected ? (
              <p className="mt-4 text-sm leading-relaxed text-slate-500">Select a row to view details.</p>
            ) : (
              <dl className="mt-4 space-y-3 text-sm">
                {config.columns.map((column) => (
                  <DetailItem
                    key={column.key}
                    label={column.label}
                    value={formatCell(column, selected[column.key])}
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
          ↑
        </button>
      ) : null}
    </div>
  );
}

function FormField({ field, value, onChange, disabled }) {
  const options = field.options ?? [];
  return (
    <div
      className={cn(
        "space-y-1",
        field.wide && "sm:col-span-2",
        field.type === "textarea" && "sm:col-span-2"
      )}
    >
      <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">
        {field.label}
        {field.required ? <span className="text-red-500"> *</span> : null}
      </label>
      {field.type === "select" ? (
        <select
          className={inputClass}
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
        >
          {options.length && typeof options[0] === "object" ? (
            options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))
          ) : (
            <>
              <option value="">Select…</option>
              {options.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </>
          )}
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

function MobileList({
  rows,
  selectedId,
  onSelect,
  search,
  title,
  primaryKey,
  secondaryKey,
  summaryKeys,
  isLoading,
  formatCell,
}) {
  const emptyMessage = isLoading
    ? `Loading ${title.toLowerCase()}…`
    : search
      ? `No ${title.toLowerCase()} match your search.`
      : `No ${title.toLowerCase()} found. Add your first one!`;
  const columnByKey = Object.fromEntries(config.columns.map((c) => [c.key, c]));
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
          const summary = summaryKeys
            .map((key) => formatCell(columnByKey[key], row[key]))
            .filter((s) => s && s !== "—")
            .join(" · ");
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
              <p className="truncate text-xs font-bold text-blue-600">
                {formatCell(columnByKey[primaryKey], row[primaryKey])}
              </p>
              <p className="mt-1 truncate text-sm font-semibold text-slate-800">
                {formatCell(columnByKey[secondaryKey], row[secondaryKey])}
              </p>
              <p className="mt-1 line-clamp-2 text-[11px] text-slate-500">{summary || "—"}</p>
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
      <dd className={cn("mt-0.5 break-words text-slate-800", highlight && "font-semibold text-brand")}>
        {value || "—"}
      </dd>
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
