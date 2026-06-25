"use client";

import { useCallback, useEffect, useState } from "react";

import { Grid } from "@/components/clutch-table";
import ClutchFormField from "@/components/form/clutch-form-field";
import { Button } from "@/components/ui/button";
import { buildRequiredFieldErrors, clearFieldError } from "@/lib/form-validation";
import { useInvalidateReferenceData } from "@/lib/hooks/use-reference-data-queries";
import { useAutoOpenAddModal } from "@/lib/hooks/use-auto-open-add-modal";
import { cn } from "@/lib/utils";

const MOBILE_BREAKPOINT = 900;
const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api"
).replace(/\/+$/, "");
const SHIPPING_LINES_ENDPOINT = `${API_BASE_URL}/reference-data/shipping-lines`;

const inputClass =
  "w-full rounded-lg border border-slate-200/95 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-brand/15 placeholder:text-slate-400 focus:border-brand/35 focus:ring-2";

const config = {
  title: "Shipping Line",
  subtitle: "Manage shipping line details and contact information.",
  columns: [
    { key: "shippingLineCode", label: "Shipping Line Code" },
    { key: "shippingLineName", label: "Shipping Line Name" },
    { key: "website", label: "Website" },
    { key: "shippingLineContactsSummary", label: "Shipping Line Contact(s)" },
  ],
  formFields: [
    { key: "shippingLineCode", label: "Shipping Line Code", placeholder: "e.g., MSC, MAEU" },
    { key: "shippingLineName", label: "Shipping Line Name", placeholder: "e.g., MSC Mediterranean Shipping" },
    { key: "website", label: "Website", type: "url", placeholder: "https://www.example.com" },
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
  return { contactName: "", contactEmail: "", contactPhone: "" };
}

function normalizeContacts(items) {
  if (!Array.isArray(items)) return [];
  return items.map((item) => ({
    contactName: String(item?.contactName ?? item?.name ?? ""),
    contactEmail: String(item?.contactEmail ?? item?.email ?? ""),
    contactPhone: String(item?.contactPhone ?? item?.phone ?? ""),
  }));
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

async function shippingLineRequest(path = "", options = {}) {
  const response = await fetch(`${SHIPPING_LINES_ENDPOINT}${path}`, {
    ...options,
    headers: {
      ...getAuthHeaders(),
      ...(options.headers || {}),
    },
  });
  const result = await response.json().catch(() => null);

  if (!response.ok || result?.success === false) {
    throw new Error(extractApiError(result, "Shipping line request failed."));
  }

  return result;
}

function fromApiShippingLine(row) {
  if (!row) return null;

  let shippingLineContacts = normalizeContacts(row.contacts ?? row.shippingLineContacts ?? []).filter(
    (contact) => contact.contactName || contact.contactEmail || contact.contactPhone
  );

  if (!shippingLineContacts.length && (row.contact_email || row.contact_phone)) {
    shippingLineContacts = normalizeContacts([
      {
        contactName: "",
        contactEmail: row.contact_email ?? "",
        contactPhone: row.contact_phone ?? "",
      },
    ]).filter((contact) => contact.contactName || contact.contactEmail || contact.contactPhone);
  }

  return {
    id: row.id,
    organizationId: row.organization_id ?? "",
    siteId: row.site_id ?? "",
    shippingLineCode: row.shipping_line_code ?? "",
    shippingLineName: row.shipping_line_name ?? "",
    website: row.website ?? "",
    shippingLineContacts,
    shippingLineContactsSummary: shippingLineContacts.length
      ? `${shippingLineContacts.length} contact${shippingLineContacts.length === 1 ? "" : "s"}`
      : "—",
    organizationName: row.organization?.name ?? "",
    siteName: row.site?.name ?? "",
  };
}

function toApiPayload(draft) {
  const shippingLineContacts = normalizeContacts(draft.shippingLineContacts)
    .map((item) => ({
      contactName: item.contactName.trim(),
      contactEmail: item.contactEmail.trim(),
      contactPhone: item.contactPhone.trim(),
    }))
    .filter((item) => item.contactName || item.contactEmail || item.contactPhone);

  return {
    ...getTenantPayload(),
    shipping_line_code: draft.shippingLineCode?.trim() || null,
    shipping_line_name: draft.shippingLineName?.trim() || null,
    website: draft.website?.trim() || null,
    shippingLineContacts,
  };
}

function buildDraft(row) {
  const next = { shippingLineContacts: [createEmptyContact()] };
  for (const field of config.formFields) next[field.key] = row?.[field.key] ?? "";
  if (row) {
    const contacts = normalizeContacts(row.shippingLineContacts);
    next.shippingLineContacts = contacts.length ? contacts : [createEmptyContact()];
  }
  return next;
}

function parseFieldValue(field, value) {
  if (field.type !== "number") return value;
  if (value === "") return "";
  const parsed = Number(value);
  return Number.isNaN(parsed) ? value : String(parsed);
}

export default function ShippingLinePage() {
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
  const [fieldErrors, setFieldErrors] = useState({});

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

  const loadShippingLines = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      const result = await shippingLineRequest("?per_page=500");
      const pager = result?.data;
      const apiRows = Array.isArray(pager?.data) ? pager.data : Array.isArray(pager) ? pager : [];

      setRows(apiRows.map(fromApiShippingLine).filter(Boolean));
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load shipping lines."
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      loadShippingLines();
    });

    return () => cancelAnimationFrame(frame);
  }, [loadShippingLines]);

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
    setModalMode(null);
    setFieldErrors({});
  };

  const saveModal = async () => {
    const nextFieldErrors = buildRequiredFieldErrors(config.formFields, draft);
    if (Object.keys(nextFieldErrors).length) {
      setFieldErrors(nextFieldErrors);
      setError("Please fill all required fields.");
      return;
    }
    setFieldErrors({});

    const normalized = {};
    for (const field of config.formFields) normalized[field.key] = parseFieldValue(field, draft[field.key] ?? "");

    setIsSaving(true);
    setError("");
    setNotice("");

    try {
      const body = toApiPayload({ ...draft, ...normalized });

      if (modalMode === "add") {
        const result = await shippingLineRequest("", {
          method: "POST",
          body: JSON.stringify(body),
        });
        const nextRow = fromApiShippingLine(result.data);
        if (!nextRow) throw new Error("Invalid response from server.");

        setRows((prev) => [nextRow, ...prev]);
        setSelectedId(nextRow.id);
        setNotice(result.message || "Shipping line created successfully.");
        await invalidateReferenceData("shippingLines");
        setModalMode(null);
        return;
      }

      if (modalMode === "edit" && selected) {
        const result = await shippingLineRequest(`/${selected.id}`, {
          method: "PUT",
          body: JSON.stringify(body),
        });
        const nextRow = fromApiShippingLine(result.data);
        if (!nextRow) throw new Error("Invalid response from server.");

        setRows((prev) => prev.map((row) => (row.id === selected.id ? nextRow : row)));
        setNotice(result.message || "Shipping line updated successfully.");
        await invalidateReferenceData("shippingLines");
        setModalMode(null);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to save shipping line."
      );
    } finally {
      setIsSaving(false);
    }
  };

  function updateContact(index, key, value) {
    setDraft((prev) => ({
      ...prev,
      shippingLineContacts: prev.shippingLineContacts.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [key]: value } : item
      ),
    }));
  }

  function addContact() {
    setDraft((prev) => ({ ...prev, shippingLineContacts: [...prev.shippingLineContacts, createEmptyContact()] }));
  }

  function removeContact(index) {
    setDraft((prev) => {
      const next = prev.shippingLineContacts.filter((_, itemIndex) => itemIndex !== index);
      return { ...prev, shippingLineContacts: next.length ? next : [createEmptyContact()] };
    });
  }

  const removeSelected = async () => {
    if (!selected || isDeleting) return;
    const shouldDelete = window.confirm(`Delete ${selected.shippingLineName || selected.shippingLineCode || "this shipping line"}?`);
    if (!shouldDelete) return;

    setIsDeleting(true);
    setError("");
    setNotice("");

    try {
      const result = await shippingLineRequest(`/${selected.id}`, {
        method: "DELETE",
      });

      setRows((prev) => prev.filter((row) => row.id !== selected.id));
      setSelectedId(null);
      setNotice(result.message || "Shipping line deleted successfully.");
      await invalidateReferenceData("shippingLines");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to delete shipping line."
      );
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
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </div>
      ) : null}

      {notice ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {notice}
        </div>
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
              emptyMessage={isLoading ? "Loading shipping lines..." : "No shipping lines found."}
              onRowClick={(row) => setSelectedId((prev) => (prev === row.id ? null : row.id))}
              onPersistedRowActivate={(row) => setSelectedId(row.id)}
              toolbarActions={
                <div className="flex flex-wrap gap-2">
                  <Button type="button" size="sm" onClick={openAddModal} disabled={isLoading}>+ Add</Button>
                  <Button type="button" variant="outline" size="sm" disabled={!selected || isLoading} onClick={openEditModal}>Edit</Button>
                  <Button type="button" variant="destructive" size="sm" disabled={!selected || isLoading || isDeleting} onClick={removeSelected}>
                    {isDeleting ? "Deleting..." : "Delete"}
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={loadShippingLines} disabled={isLoading}>
                    Refresh
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
                  <DetailItem key={column.key} label={column.label} value={selected[column.key]} highlight={column === config.columns[0]} />
                ))}
              </dl>
            )}
          </aside>
        ) : null}
      </div>

      <Modal open={modalMode != null} title={modalMode === "edit" ? `Edit ${config.title}` : `Add ${config.title}`} onClose={closeModal}>
        {modalError ? (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-600">
            {modalError}
          </div>
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
        </div>

        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">Shipping Line Contact(s)</p>
            <Button type="button" size="sm" variant="outline" onClick={addContact} disabled={isSaving}>
              + Add contact
            </Button>
          </div>
          <div className="space-y-2">
            {(draft.shippingLineContacts ?? []).map((contact, index) => (
              <div key={`contact-${index}`} className="rounded-lg border border-slate-200 bg-slate-50/40 p-2">
                <div className="mb-1 flex items-center justify-between">
                  <p className="text-xs font-semibold text-slate-600">Contact {index + 1}</p>
                  {(draft.shippingLineContacts?.length ?? 0) > 1 ? (
                    <button
                      type="button"
                      disabled={isSaving}
                      className="rounded bg-rose-50 px-1.5 py-0.5 text-xs text-rose-600 hover:bg-rose-100 disabled:opacity-50"
                      onClick={() => removeContact(index)}
                    >
                      Remove
                    </button>
                  ) : null}
                </div>
                <div className="space-y-2">
                  <input
                    className={inputClass}
                    value={contact.contactName}
                    disabled={isSaving}
                    onChange={(event) => updateContact(index, "contactName", event.target.value)}
                    placeholder="Contact Name"
                  />
                  <input
                    className={inputClass}
                    value={contact.contactEmail}
                    disabled={isSaving}
                    onChange={(event) => updateContact(index, "contactEmail", event.target.value)}
                    placeholder="Contact Email"
                  />
                  <input
                    className={inputClass}
                    value={contact.contactPhone}
                    disabled={isSaving}
                    onChange={(event) => updateContact(index, "contactPhone", event.target.value)}
                    placeholder="Contact Phone"
                  />
                </div>
              </div>
            ))}
          </div>
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
          ↑
        </button>
      ) : null}
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
      <div className="px-0.5 text-xs font-semibold text-slate-600">{title} ({rows.length})</div>
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
          <button type="button" className="rounded-md px-2 py-1 text-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800" onClick={onClose}>
            x
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}
