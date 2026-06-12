"use client";

import { useCallback, useEffect, useState } from "react";

import { Grid } from "@/components/clutch-table";
import { useInvalidateReferenceData } from "@/lib/hooks/use-reference-data-queries";
import { cn } from "@/lib/utils";

const MOBILE_BREAKPOINT = 900;
const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api"
).replace(/\/+$/, "");
const TRANSPORTERS_ENDPOINT = `${API_BASE_URL}/contacts/transporters`;

const inputClass =
  "w-full rounded-lg border border-slate-200/95 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-brand/15 placeholder:text-slate-400 focus:border-brand/35 focus:ring-2";

const columns = [
  { key: "code", label: "Code" },
  { key: "name", label: "Name" },
  { key: "email", label: "Email" },
  { key: "contactsCount", label: "Contacts" },
];

const gridColumns = columns.map((col) => ({
  key: col.key,
  header: col.label,
  type: "text",
  sortable: true,
  filterable: true,
  resizable: true,
}));

const emptyContact = () => ({ name: "", email: "", phone: "" });

function normalizeContacts(contacts) {
  if (!Array.isArray(contacts) || contacts.length === 0) return [emptyContact()];
  return contacts.map((contact) =>
    typeof contact === "string"
      ? { name: contact, email: "", phone: "" }
      : {
        name: contact.name || "",
        email: contact.email || "",
        phone: contact.phone || "",
      }
  );
}

function pluralize(count, noun) {
  if (count === 0) return "—";
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

async function transporterRequest(path = "", options = {}) {
  const response = await fetch(`${TRANSPORTERS_ENDPOINT}${path}`, {
    ...options,
    headers: {
      ...getAuthHeaders(),
      ...(options.headers || {}),
    },
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || result?.success === false) {
    throw new Error(extractApiError(result, "Transporter request failed."));
  }
  return result;
}

function fromApiTransporter(row) {
  if (!row) return null;

  const contacts = normalizeContacts(row.contacts ?? []).filter(
    (contact) => contact.name || contact.email || contact.phone
  );

  return {
    id: row.id,
    code: row.code ?? "",
    name: row.name ?? "",
    email: row.email ?? "",
    contacts,
    contactsCount: pluralize(contacts.length, "contact"),
  };
}

function toApiPayload(formData) {
  const tenant = getTenantPayload();

  const contacts = (formData.contacts || [])
    .map((contact) => ({
      name: (contact.name || "").trim(),
      email: (contact.email || "").trim(),
      phone: (contact.phone || "").trim(),
    }))
    .filter((contact) => contact.name || contact.email || contact.phone);

  return {
    ...tenant,
    code: formData.code.trim() || null,
    name: formData.name.trim(),
    email: formData.email.trim() || null,
    contacts,
    contactsCount: contacts.length ? `${contacts.length} contact${contacts.length === 1 ? "" : "s"}` : "—",
  };
}

function buildFormData(row) {
  if (!row) {
    return { code: "", name: "", email: "", contacts: [emptyContact()] };
  }

  const rowContacts = normalizeContacts(row.contacts);

  return {
    code: row.code || "",
    name: row.name || "",
    email: row.email || "",
    contacts: rowContacts.length ? rowContacts : [emptyContact()],
  };
}

export default function TransporterPage() {
  const invalidateReferenceData = useInvalidateReferenceData();

  const [rows, setRows] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState(() => buildFormData());
  const [isMobile, setIsMobile] = useState(false);
  const [showGoToTop, setShowGoToTop] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadTransporters = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const result = await transporterRequest("?per_page=500");
      const pager = result?.data;
      const apiRows = Array.isArray(pager?.data) ? pager.data : Array.isArray(pager) ? pager : [];
      setRows(apiRows.map(fromApiTransporter).filter(Boolean));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load transporters.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      loadTransporters();
    });
    return () => cancelAnimationFrame(frame);
  }, [loadTransporters]);

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
  const modalError = modalOpen ? error : "";

  function openCreateModal() {
    setError("");
    setNotice("");
    setEditMode(false);
    setFormData(buildFormData());
    setModalOpen(true);
  }

  function openEditModal() {
    if (!selected) return;
    setError("");
    setNotice("");
    setEditMode(true);
    setFormData(buildFormData(selected));
    setModalOpen(true);
  }

  function closeModal() {
    if (isSaving) return;
    setModalOpen(false);
    setError("");
  }

  async function handleSubmit() {
    if (!formData.name.trim()) {
      setError("Transporter name is required.");
      return;
    }

    const tenant = getTenantPayload();
    if (!tenant.organization_id || !tenant.site_id) {
      setError("Organization and current site are required to save a transporter.");
      return;
    }

    setIsSaving(true);
    setError("");
    setNotice("");

    try {
      const body = toApiPayload(formData);

      if (!editMode) {
        const result = await transporterRequest("", {
          method: "POST",
          body: JSON.stringify(body),
        });
        const nextRow = fromApiTransporter(result.data);
        if (!nextRow) throw new Error("Invalid response from server.");
        setRows((prev) => [nextRow, ...prev]);
        setSelectedId(nextRow.id);
        setNotice(result.message || "Transporter created successfully.");
        await invalidateReferenceData("transporters");
        setModalOpen(false);
        setFormData(buildFormData());
        return;
      }

      if (selected) {
        const result = await transporterRequest(`/${selected.id}`, {
          method: "PUT",
          body: JSON.stringify(body),
        });
        const nextRow = fromApiTransporter(result.data);
        if (!nextRow) throw new Error("Invalid response from server.");
        setRows((prev) => prev.map((row) => (row.id === selected.id ? nextRow : row)));
        setNotice(result.message || "Transporter updated successfully.");
        await invalidateReferenceData("transporters");
        setModalOpen(false);
        setFormData(buildFormData());
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save transporter.");
    } finally {
      setIsSaving(false);
    }
  }

  async function removeSelected() {
    if (!selected || isDeleting) return;
    if (!window.confirm(`Delete transporter "${selected.name}" permanently?`)) return;

    setIsDeleting(true);
    setError("");
    setNotice("");

    try {
      const result = await transporterRequest(`/${selected.id}`, { method: "DELETE" });
      setRows((prev) => prev.filter((row) => row.id !== selected.id));
      setSelectedId(null);
      setNotice(result.message || "Transporter deleted successfully.");
      await invalidateReferenceData("transporters");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete transporter.");
    } finally {
      setIsDeleting(false);
    }
  }

  function setContact(index, key, value) {
    setFormData((prev) => {
      const next = [...(prev.contacts || [emptyContact()])];
      if (!next[index]) next[index] = emptyContact();
      next[index] = { ...next[index], [key]: value };
      return { ...prev, contacts: next };
    });
  }

  function addContact() {
    setFormData((prev) => ({ ...prev, contacts: [...(prev.contacts || []), emptyContact()] }));
  }

  function removeContact(index) {
    setFormData((prev) => {
      const next = (prev.contacts || []).filter((_, itemIndex) => itemIndex !== index);
      return { ...prev, contacts: next.length ? next : [emptyContact()] };
    });
  }

  const toolbarActions = (
    <div className="flex flex-wrap gap-2">
      <BtnPrimary type="button" onClick={openCreateModal} disabled={isLoading}>
        + Add
      </BtnPrimary>
      <BtnSecondary type="button" onClick={loadTransporters} disabled={isLoading}>
        Refresh
      </BtnSecondary>
      <BtnSecondary type="button" disabled={!selected || isLoading} onClick={openEditModal}>
        Edit
      </BtnSecondary>
      <BtnDanger type="button" disabled={!selected || isLoading || isDeleting} onClick={removeSelected}>
        {isDeleting ? "Deleting…" : "Delete"}
      </BtnDanger>
    </div>
  );

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs text-slate-500">Contacts / Transporter</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 md:text-[1.65rem]">Transporter</h1>
        {!isMobile ? <p className="mt-1 text-xs text-slate-500">Manage transporter master records.</p> : null}
      </div>

      {!modalOpen && error ? (
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
              <MobileList rows={rows} selectedId={selectedId} onSelect={setSelectedId} search="" isLoading={isLoading} />
            </>
          ) : (
            <Grid
              columns={gridColumns}
              rows={rows}
              getRowId={(row) => row.id}
              theme="light"
              density="standard"
              fileName="Transporter"
              visibleRows={12}
              loading={isLoading}
              emptyMessage={isLoading ? "Loading transporters…" : "No transporters found."}
              onRowClick={(row) => setSelectedId((prev) => (prev === row.id ? null : row.id))}
              onPersistedRowActivate={(row) => setSelectedId(row.id)}
              toolbarActions={toolbarActions}
            />
          )}
        </div>

        {!isMobile ? (
          <aside className="rounded-xl border border-slate-200/90 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900">Transporter Details</h2>
            {!selected ? (
              <p className="mt-4 text-sm leading-relaxed text-slate-500">Select a transporter to view details.</p>
            ) : (
              <div className="mt-4 space-y-3 text-sm">
                <DetailItem label="Code" value={selected.code || "—"} />
                <DetailItem label="Name" value={selected.name} highlight />
                <DetailItem label="Email" value={selected.email || "—"} />
                <DetailItem
                  label="Contact(s)"
                  value={
                    selected.contacts?.length
                      ? selected.contacts.map((contact) => [contact.name, contact.email, contact.phone].filter(Boolean).join(" · ")).join(" | ")
                      : "—"
                  }
                />
              </div>
            )}
          </aside>
        ) : null}
      </div>

      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={editMode ? "Edit transporter" : "Add transporter"}
        width={500}
      >
        {modalError ? (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-600">{modalError}</div>
        ) : null}
        <div className="space-y-3">
          <FormRow label="Code (optional)">
            <Input value={formData.code} disabled={isSaving} onChange={(event) => setFormData({ ...formData, code: event.target.value })} placeholder="Short code" />
          </FormRow>

          <FormRow label="Name" required>
            <Input value={formData.name} disabled={isSaving} onChange={(event) => setFormData({ ...formData, name: event.target.value })} placeholder="Company name" />
          </FormRow>

          <FormRow label="Email">
            <Input
              type="email"
              value={formData.email}
              disabled={isSaving}
              onChange={(event) => setFormData({ ...formData, email: event.target.value })}
              placeholder="dispatcher@company.com"
            />
          </FormRow>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700">Contact(s)</span>
              <button
                type="button"
                onClick={addContact}
                disabled={isSaving}
                className="rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-[11px] font-semibold text-blue-600 hover:bg-blue-100 disabled:opacity-50"
              >
                + Add contact
              </button>
            </div>
            {(formData.contacts || []).map((contact, index) => (
              <div key={index} className="mb-2 space-y-2 rounded-lg border border-slate-200 bg-slate-50/70 p-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-slate-500">Contact {index + 1}</span>
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={() => removeContact(index)}
                    className="rounded border border-rose-200 bg-rose-50 px-1.5 py-0.5 text-[11px] text-rose-600 hover:bg-rose-100 disabled:opacity-50"
                  >
                    Remove
                  </button>
                </div>
                <Input value={contact.name} disabled={isSaving} onChange={(event) => setContact(index, "name", event.target.value)} placeholder="Contact Name" />
                <Input type="email" value={contact.email} disabled={isSaving} onChange={(event) => setContact(index, "email", event.target.value)} placeholder="Contact Email" />
                <Input type="tel" value={contact.phone} disabled={isSaving} onChange={(event) => setContact(index, "phone", event.target.value)} placeholder="Contact Phone" />
              </div>
            ))}
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2 border-t border-slate-200 pt-4">
          <BtnSecondary type="button" onClick={closeModal} disabled={isSaving}>
            Cancel
          </BtnSecondary>
          <BtnPrimary type="button" onClick={handleSubmit} disabled={isSaving}>
            {isSaving ? "Saving…" : editMode ? "Update" : "Add"}
          </BtnPrimary>
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

function MobileList({ rows, selectedId, onSelect, search, isLoading }) {
  const emptyMessage = isLoading
    ? "Loading transporters…"
    : search
      ? "No transporter match your search."
      : "No transporter found. Add your first one!";
  return (
    <div className="space-y-2 p-3">
      <div className="px-0.5 text-xs font-semibold text-slate-600">Transporter ({rows.length})</div>
      {rows.length === 0 ? (
        <div className="py-8 text-center text-sm text-slate-400">{emptyMessage}</div>
      ) : (
        rows.map((row) => {
          const isSelected = row.id === selectedId;
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
              <p className="text-xs font-bold text-blue-600">{row.code || "—"}</p>
              <p className="mt-1 text-sm font-semibold text-slate-800">{row.name || "—"}</p>
              <p className="mt-1 text-xs text-slate-600">{row.email || "—"}</p>
              <p className="mt-1 text-[11px] text-slate-500">{row.contactsCount}</p>
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
      <dd className={cn("mt-0.5 break-words text-slate-800", highlight && "font-semibold text-brand")}>{value || "—"}</dd>
    </div>
  );
}

function Modal({ open, title, onClose, children, width = 640 }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button type="button" className="absolute inset-0 bg-black/40" aria-label="Close dialog" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="transporter-modal-title"
        className="relative max-h-[min(90vh,720px)] w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl"
        style={{ maxWidth: `${width}px` }}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-4 py-3">
          <h2 id="transporter-modal-title" className="text-sm font-semibold text-slate-900">
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

function FormRow({ label, required, children }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">
        {label}
        {required ? <span className="text-red-500"> *</span> : null}
      </label>
      {children}
    </div>
  );
}

function Input({ className, ...props }) {
  return <input suppressHydrationWarning className={cn(inputClass, className)} {...props} />;
}

function BtnPrimary({ className, ...props }) {
  return (
    <button
      className={cn(
        "inline-flex items-center rounded-md bg-brand px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  );
}

function BtnSecondary({ className, ...props }) {
  return (
    <button
      className={cn(
        "inline-flex items-center rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  );
}

function BtnDanger({ className, ...props }) {
  return (
    <button
      className={cn(
        "inline-flex items-center rounded-md bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  );
}