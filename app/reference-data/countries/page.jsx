"use client";

import { useCallback, useEffect, useState } from "react";

import { Grid } from "@/components/clutch-table";
import { Button } from "@/components/ui/button";
import { useInvalidateReferenceData } from "@/lib/hooks/use-reference-data-queries";
import { cn } from "@/lib/utils";

const MOBILE_BREAKPOINT = 900;
const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api"
).replace(/\/+$/, "");
const COUNTRIES_ENDPOINT = `${API_BASE_URL}/reference-data/countries`;

const inputClass =
  "w-full rounded-lg border border-slate-200/95 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-brand/15 placeholder:text-slate-400 focus:border-brand/35 focus:ring-2";

const config = {
  title: "Countries",
  subtitle: "Manage country master records and operational notes.",
  columns: [
    { key: "countryName", label: "Country Name" },
    { key: "countryCode", label: "Code" },
    { key: "notesPreview", label: "Notes" },
    { key: "contacts", label: "Contacts" },
    { key: "warnings", label: "Warnings" },
  ],
  formFields: [
    { key: "countryName", label: "Country Name", required: true, placeholder: "e.g. Australia" },
    { key: "countryCode", label: "Country Code", required: true, placeholder: "e.g. AU" },
    { key: "notesPreview", label: "Notes", type: "textarea", placeholder: "Operational notes" },
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

function createEmptyContact() {
  return { name: "", phone: "", email: "" };
}

function createEmptyWarning() {
  return { description: "", showOnPacks: true };
}

function normalizeContactItems(items) {
  if (!Array.isArray(items)) return [];
  return items.map((item) => ({
    name: String(item?.name ?? ""),
    phone: String(item?.phone ?? ""),
    email: String(item?.email ?? ""),
  }));
}

function normalizeWarningItems(items) {
  if (!Array.isArray(items)) return [];
  return items.map((item) => ({
    description: String(item?.description ?? ""),
    showOnPacks: Boolean(item?.showOnPacks ?? item?.show_on_packs),
  }));
}

function pluralizeCount(count, noun) {
  if (!count) return "";
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
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

async function countryRequest(path = "", options = {}) {
  const response = await fetch(`${COUNTRIES_ENDPOINT}${path}`, {
    ...options,
    headers: {
      ...getAuthHeaders(),
      ...(options.headers || {}),
    },
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || result?.success === false) {
    throw new Error(extractApiError(result, "Country request failed."));
  }
  return result;
}

function fromApiCountry(row) {
  if (!row) return null;
  const rawContacts = row.contact_items ?? row.contactItems ?? [];
  const rawWarnings = row.warning_items ?? row.warningItems ?? [];
  const contactItems = normalizeContactItems(rawContacts);
  const warningItems = normalizeWarningItems(
    rawWarnings.map((w) => ({
      description: w.description ?? "",
      showOnPacks: w.show_on_packs ?? w.showOnPacks ?? true,
    }))
  );
  return {
    id: row.id,
    organizationId: row.organization_id ?? "",
    siteId: row.site_id ?? "",
    countryName: row.country_name ?? "",
    countryCode: row.country_code ?? "",
    notesPreview: row.notes ?? "",
    contactItems,
    warningItems,
    contacts: pluralizeCount(contactItems.length, "contact"),
    warnings: pluralizeCount(warningItems.length, "warning"),
    organizationName: row.organization?.name ?? "",
    siteName: row.site?.name ?? "",
  };
}

function toApiPayload(draft) {
  const tenant = getTenantPayload();
  const contact_items = normalizeContactItems(draft.contactItems)
    .map((item) => ({
      name: item.name.trim(),
      phone: item.phone.trim(),
      email: item.email.trim(),
    }))
    .filter((item) => item.name || item.phone || item.email);

  const warning_items = normalizeWarningItems(draft.warningItems)
    .map((item) => ({
      description: item.description.trim(),
      showOnPacks: Boolean(item.showOnPacks),
    }))
    .filter((item) => item.description);

  return {
    ...tenant,
    country_name: String(draft.countryName ?? "").trim() || null,
    country_code: String(draft.countryCode ?? "").trim() || null,
    notes: String(draft.notesPreview ?? "").trim() || null,
    contact_items,
    warning_items,
  };
}

function buildDraft(row) {
  const next = {
    contactItems: [createEmptyContact()],
    warningItems: [createEmptyWarning()],
  };
  for (const field of config.formFields) {
    next[field.key] = row?.[field.key] ?? "";
  }
  if (row) {
    const rowContacts = normalizeContactItems(row.contactItems);
    const rowWarnings = normalizeWarningItems(row.warningItems);
    next.contactItems = rowContacts.length ? rowContacts : [createEmptyContact()];
    next.warningItems = rowWarnings.length ? rowWarnings : [createEmptyWarning()];
  }
  return next;
}

function parseFieldValue(field, value) {
  if (field.type !== "number") return value;
  if (value === "") return "";
  const parsed = Number(value);
  return Number.isNaN(parsed) ? value : String(parsed);
}

export default function CountriesPage() {
  const invalidateReferenceData = useInvalidateReferenceData();

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

  const loadCountries = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const result = await countryRequest("?per_page=500");
      const pager = result?.data;
      const apiRows = Array.isArray(pager?.data) ? pager.data : Array.isArray(pager) ? pager : [];
      setRows(apiRows.map(fromApiCountry).filter(Boolean));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load countries.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      loadCountries();
    });
    return () => cancelAnimationFrame(frame);
  }, [loadCountries]);

  useEffect(() => {
    const query = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const handleMedia = () => setIsMobile(query.matches);
    handleMedia();
    query.addEventListener("change", handleMedia);
    return () => query.removeEventListener("change", handleMedia);
  }, []);

  useEffect(() => {
    if (!isMobile) {
      return;
    }
    const onScroll = () => setShowGoToTop(window.scrollY > 400);
    onScroll();
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, [isMobile]);

  const selected = selectedId != null ? rows.find((row) => row.id === selectedId) ?? null : null;

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
      setError("Organization and current site are required to save a country.");
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
      const body = toApiPayload({ ...draft, ...normalized });

      if (modalMode === "add") {
        const result = await countryRequest("", {
          method: "POST",
          body: JSON.stringify(body),
        });
        const nextRow = fromApiCountry(result.data);
        if (!nextRow) throw new Error("Invalid response from server.");
        setRows((prev) => [nextRow, ...prev]);
        setSelectedId(nextRow.id);
        setNotice(result.message || "Country created successfully.");
        await invalidateReferenceData("countries");
        setModalMode(null);
        return;
      }

      if (modalMode === "edit" && selected) {
        const result = await countryRequest(`/${selected.id}`, {
          method: "PUT",
          body: JSON.stringify(body),
        });
        const nextRow = fromApiCountry(result.data);
        if (!nextRow) throw new Error("Invalid response from server.");
        setRows((prev) => prev.map((row) => (row.id === selected.id ? nextRow : row)));
        setNotice(result.message || "Country updated successfully.");
        await invalidateReferenceData("countries");
        setModalMode(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save country.");
    } finally {
      setIsSaving(false);
    }
  }

  function updateContact(index, key, value) {
    setDraft((prev) => ({
      ...prev,
      contactItems: prev.contactItems.map((item, itemIndex) => (itemIndex === index ? { ...item, [key]: value } : item)),
    }));
  }

  function addContact() {
    setDraft((prev) => ({ ...prev, contactItems: [...prev.contactItems, createEmptyContact()] }));
  }

  function removeContact(index) {
    setDraft((prev) => {
      const next = prev.contactItems.filter((_, itemIndex) => itemIndex !== index);
      return { ...prev, contactItems: next.length ? next : [createEmptyContact()] };
    });
  }

  function updateWarning(index, key, value) {
    setDraft((prev) => ({
      ...prev,
      warningItems: prev.warningItems.map((item, itemIndex) => (itemIndex === index ? { ...item, [key]: value } : item)),
    }));
  }

  function addWarning() {
    setDraft((prev) => ({ ...prev, warningItems: [...prev.warningItems, createEmptyWarning()] }));
  }

  function removeWarning(index) {
    setDraft((prev) => {
      const next = prev.warningItems.filter((_, itemIndex) => itemIndex !== index);
      return { ...prev, warningItems: next.length ? next : [createEmptyWarning()] };
    });
  }

  async function removeSelected() {
    if (!selected || isDeleting) return;
    const shouldDelete = window.confirm(
      `Delete country "${selected.countryName || selected.countryCode || selected.id}"?`
    );
    if (!shouldDelete) return;

    setIsDeleting(true);
    setError("");
    setNotice("");

    try {
      const result = await countryRequest(`/${selected.id}`, { method: "DELETE" });
      setRows((prev) => prev.filter((row) => row.id !== selected.id));
      setSelectedId(null);
      setNotice(result.message || "Country deleted successfully.");
      await invalidateReferenceData("countries");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete country.");
    } finally {
      setIsDeleting(false);
    }
  }

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

      <div className={cn("grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(240px,320px)] xl:items-start", isMobile && "grid-cols-1")}>
        <div className="overflow-hidden rounded-xl bg-white shadow-sm">
          {isMobile ? (
            <>
              <div className="flex flex-wrap gap-2 border-b border-slate-100 p-3">
                <Button type="button" size="sm" onClick={openAddModal} disabled={isLoading}>
                  + Add
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={loadCountries} disabled={isLoading}>
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
              emptyMessage={isLoading ? "Loading countries..." : "No countries found."}
              onRowClick={(row) => setSelectedId((prev) => (prev === row.id ? null : row.id))}
              onPersistedRowActivate={(row) => setSelectedId(row.id)}
              toolbarActions={
                <div className="flex flex-wrap gap-2">
                  <Button type="button" size="sm" onClick={openAddModal} disabled={isLoading}>
                    + Add
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={loadCountries} disabled={isLoading}>
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
                    {isDeleting ? "Deleting..." : "Delete"}
                  </Button>
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
        <div className="mt-4 space-y-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">Country Contact(s)</p>
            <div className="mt-2 space-y-2">
              {(draft.contactItems ?? []).map((contact, index) => (
                <div key={`contact-${index}`} className="rounded-lg border border-slate-200 bg-slate-50/50 p-2">
                  <div className="mb-1 flex items-center justify-between">
                    <p className="text-xs font-semibold text-slate-600">Contact {index + 1}</p>
                    {(draft.contactItems?.length ?? 0) > 1 ? (
                      <button
                        type="button"
                        className="text-xs font-medium text-rose-600 hover:text-rose-700"
                        onClick={() => removeContact(index)}
                        disabled={isSaving}
                      >
                        Remove
                      </button>
                    ) : null}
                  </div>
                  <div className="space-y-2">
                    <input
                      className={inputClass}
                      value={contact.name}
                      disabled={isSaving}
                      onChange={(event) => updateContact(index, "name", event.target.value)}
                      placeholder="Contact Name"
                    />
                    <input
                      className={inputClass}
                      value={contact.phone}
                      disabled={isSaving}
                      onChange={(event) => updateContact(index, "phone", event.target.value)}
                      placeholder="Contact Phone"
                    />
                    <input
                      className={inputClass}
                      value={contact.email}
                      disabled={isSaving}
                      onChange={(event) => updateContact(index, "email", event.target.value)}
                      placeholder="Contact Email"
                    />
                  </div>
                </div>
              ))}
            </div>
            <Button type="button" variant="outline" size="sm" className="mt-2 w-full justify-start" onClick={addContact} disabled={isSaving}>
              + Add Contact
            </Button>
          </div>

          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">Country Warning(s)</p>
            <div className="mt-2 space-y-2">
              {(draft.warningItems ?? []).map((warning, index) => (
                <div key={`warning-${index}`} className="rounded-lg border border-amber-200/70 bg-amber-50/40 p-2">
                  <div className="mb-1 flex items-center justify-between">
                    <p className="text-xs font-semibold text-slate-600">Warning {index + 1}</p>
                    {(draft.warningItems?.length ?? 0) > 1 ? (
                      <button
                        type="button"
                        className="text-xs font-medium text-rose-600 hover:text-rose-700"
                        onClick={() => removeWarning(index)}
                        disabled={isSaving}
                      >
                        Remove
                      </button>
                    ) : null}
                  </div>
                  <div className="space-y-2">
                    <input
                      className={inputClass}
                      value={warning.description}
                      disabled={isSaving}
                      onChange={(event) => updateWarning(index, "description", event.target.value)}
                      placeholder="Warning Description"
                    />
                    <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        disabled={isSaving}
                        checked={Boolean(warning.showOnPacks)}
                        onChange={(event) => updateWarning(index, "showOnPacks", event.target.checked)}
                      />
                      Show on Packs
                    </label>
                  </div>
                </div>
              ))}
            </div>
            <Button type="button" variant="outline" size="sm" className="mt-2 w-full justify-start" onClick={addWarning} disabled={isSaving}>
              + Add Warning
            </Button>
          </div>
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
          &uarr;
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
          const summary = summaryKeys.map((key) => row[key]).filter(Boolean).join(" \xB7 ");
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
              <p className="mt-1 text-[11px] text-slate-500">{summary}</p>
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
