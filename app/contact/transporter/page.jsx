"use client";

import { useEffect, useState } from "react";

import { Grid } from "@/components/clutch-table";
import { TRANSPORTER_MASTER_ROWS } from "@/lib/Data";
import { cn } from "@/lib/utils";

const MOBILE_BREAKPOINT = 900;
const inputClass =
  "w-full rounded-lg border border-slate-200/95 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-brand/15 placeholder:text-slate-400 focus:border-brand/35 focus:ring-2";

const columns = [
  { key: "code", label: "Code" },
  { key: "name", label: "Name" },
  { key: "email", label: "Email" },
  { key: "contactsCount", label: "Contacts" },
];

// Column definitions for clutch-table Grid
const gridColumns = columns.map((col) => ({
  key: col.key,
  header: col.label,
  type: "text",
  sortable: true,
  filterable: true,
  resizable: true,
}));

const initialRows = TRANSPORTER_MASTER_ROWS;

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

function toDisplayRow(row) {
  const contacts = normalizeContacts(row.contacts).filter((contact) => contact.name || contact.email || contact.phone);
  return {
    ...row,
    email: row.email || "",
    contacts,
    contactsCount: contacts.length ? `${contacts.length} contact${contacts.length === 1 ? "" : "s"}` : "—",
  };
}

function buildFormData(row) {
  if (!row) {
    return { code: "", name: "", email: "", contacts: [emptyContact()] };
  }
  return {
    code: row.code || "",
    name: row.name || "",
    email: row.email || "",
    contacts: normalizeContacts(row.contacts),
  };
}

export default function TransporterPage() {
  const [rows, setRows] = useState(() => initialRows.map(toDisplayRow));
  const [selectedId, setSelectedId] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState(() => buildFormData());
  const [isMobile, setIsMobile] = useState(false);
  const [showGoToTop, setShowGoToTop] = useState(false);

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

  function openCreateModal() {
    setEditMode(false);
    setFormData(buildFormData());
    setModalOpen(true);
  }

  function openEditModal() {
    if (!selected) return;
    setEditMode(true);
    setFormData(buildFormData(selected));
    setModalOpen(true);
  }

  function handleSubmit() {
    if (!formData.name.trim()) return;
    const nextRow = toDisplayRow({
      id: editMode && selected ? selected.id : Math.max(0, ...rows.map((row) => Number(row.id) || 0)) + 1,
      code: formData.code.trim(),
      name: formData.name.trim(),
      email: formData.email.trim(),
      contacts: (formData.contacts || [])
        .map((contact) => ({
          name: (contact.name || "").trim(),
          email: (contact.email || "").trim(),
          phone: (contact.phone || "").trim(),
        }))
        .filter((contact) => contact.name || contact.email || contact.phone),
    });
    if (editMode && selected) {
      setRows((prev) => prev.map((row) => (row.id === selected.id ? nextRow : row)));
    } else {
      setRows((prev) => [nextRow, ...prev]);
      setSelectedId(nextRow.id);
    }
    setModalOpen(false);
    setFormData(buildFormData());
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

  function removeSelected() {
    if (!selected) return;
    if (!window.confirm(`Delete transporter "${selected.name}" permanently?`)) return;
    setRows((prev) => prev.filter((row) => row.id !== selected.id));
    setSelectedId(null);
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs text-slate-500">Contacts / Transporter</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 md:text-[1.65rem]">Transporter</h1>
        {!isMobile ? <p className="mt-1 text-xs text-slate-500">Manage transporter master records.</p> : null}
      </div>

      <div className={cn("grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(240px,320px)] xl:items-start", isMobile && "grid-cols-1")}>
        <div className="overflow-hidden rounded-xl bg-white shadow-sm">
          {isMobile ? (
            <MobileList rows={rows} selectedId={selectedId} onSelect={setSelectedId} search="" />
          ) : (
            <Grid
              columns={gridColumns}
              rows={rows}
              getRowId={(row) => row.id}
              theme="light"
              density="standard"
              fileName="Transporter"
              visibleRows={12}
              onRowClick={(row) => setSelectedId((prev) => (prev === row.id ? null : row.id))}
              toolbarActions={
                <div className="flex flex-wrap gap-2">
                  <BtnPrimary type="button" onClick={openCreateModal}>+ Add</BtnPrimary>
                  <BtnSecondary type="button" disabled={!selected} onClick={openEditModal}>Edit</BtnSecondary>
                  <BtnDanger type="button" disabled={!selected} onClick={removeSelected}>Delete</BtnDanger>
                </div>
              }
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

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editMode ? "Edit transporter" : "Add transporter"} width={500}>
        <div className="space-y-3">
          <FormRow label="Code (optional)">
            <Input value={formData.code} onChange={(event) => setFormData({ ...formData, code: event.target.value })} placeholder="Short code" />
          </FormRow>

          <FormRow label="Name" required>
            <Input value={formData.name} onChange={(event) => setFormData({ ...formData, name: event.target.value })} placeholder="Company name" />
          </FormRow>

          <FormRow label="Email">
            <Input
              type="email"
              value={formData.email}
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
                className="rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-[11px] font-semibold text-blue-600 hover:bg-blue-100"
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
                    onClick={() => removeContact(index)}
                    className="rounded border border-rose-200 bg-rose-50 px-1.5 py-0.5 text-[11px] text-rose-600 hover:bg-rose-100"
                  >
                    Remove
                  </button>
                </div>
                <Input value={contact.name} onChange={(event) => setContact(index, "name", event.target.value)} placeholder="Contact Name" />
                <Input type="email" value={contact.email} onChange={(event) => setContact(index, "email", event.target.value)} placeholder="Contact Email" />
                <Input type="tel" value={contact.phone} onChange={(event) => setContact(index, "phone", event.target.value)} placeholder="Contact Phone" />
              </div>
            ))}
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2 border-t border-slate-200 pt-4">
          <BtnSecondary type="button" onClick={() => setModalOpen(false)}>
            Cancel
          </BtnSecondary>
          <BtnPrimary type="button" onClick={handleSubmit}>
            {editMode ? "Update" : "Add"}
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

function MobileList({ rows, selectedId, onSelect, search }) {
  const emptyMessage = search ? "No transporter match your search." : "No transporter found. Add your first one!";
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
              className={cn("w-full rounded-xl border-2 px-3 py-3 text-left transition-colors", isSelected ? "border-blue-500 bg-blue-50" : "border-slate-200 bg-white")}
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
          <button type="button" className="rounded-md px-2 py-1 text-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800" onClick={onClose}>
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
  return <input className={cn(inputClass, className)} {...props} />;
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
