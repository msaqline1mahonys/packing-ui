"use client";

import { useEffect, useMemo, useState } from "react";

import { CUSTOMER_CONTACT_ROWS } from "@/lib/Data";
import { cn } from "@/lib/utils";

const MOBILE_BREAKPOINT = 900;
const inputClass =
  "w-full rounded-lg border border-slate-200/95 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-brand/15 placeholder:text-slate-400 focus:border-brand/35 focus:ring-2";
const filterInputClass =
  "w-full rounded-md border border-slate-200/90 bg-white px-2 py-1 text-xs text-slate-800 outline-none placeholder:text-slate-400 focus:border-brand/35 focus:ring-1 focus:ring-brand/25";
const textareaClass =
  "w-full rounded-lg border border-slate-200/95 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-brand/15 placeholder:text-slate-400 focus:border-brand/35 focus:ring-2 resize-y";

const columns = [
  { key: "code", label: "Code" },
  { key: "name", label: "Customer Name" },
  { key: "emailsCount", label: "Emails" },
  { key: "contactsCount", label: "Contacts" },
  { key: "warningsCount", label: "Warning(s)" },
];

const initialRows = CUSTOMER_CONTACT_ROWS;

const emptyContact = () => ({ name: "", email: "", phone: "" });
const emptyWarning = () => ({ warningDescription: "", showOnPacks: true });

function normalizeWarnings(warnings) {
  if (!Array.isArray(warnings) || warnings.length === 0) return [emptyWarning()];
  return warnings.map((warning) =>
    typeof warning === "string"
      ? { warningDescription: warning, showOnPacks: true }
      : {
          warningDescription: warning.warningDescription || "",
          showOnPacks: warning.showOnPacks !== false,
        }
  );
}

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

function toDisplayRow(row) {
  const emails = Array.isArray(row.emails) ? row.emails : [];
  const contacts = normalizeContacts(row.contacts).filter((contact) => contact.name || contact.email || contact.phone);
  const warnings = normalizeWarnings(row.warnings).filter((warning) => (warning.warningDescription || "").trim());
  return {
    ...row,
    emails,
    contacts,
    warnings,
    emailsCount: pluralize(emails.length, "email"),
    contactsCount: pluralize(contacts.length, "contact"),
    warningsCount: pluralize(warnings.length, "warning"),
  };
}

function buildFormData(row) {
  if (!row) {
    return {
      code: "",
      name: "",
      emails: "",
      contacts: [emptyContact()],
      addresses: "",
      website: "",
      notes: "",
      invoicingContact: "",
      warnings: [emptyWarning()],
    };
  }

  return {
    code: row.code || "",
    name: row.name || "",
    emails: Array.isArray(row.emails) ? row.emails.join("\n") : "",
    contacts: normalizeContacts(row.contacts),
    addresses: Array.isArray(row.addresses) ? row.addresses.join("\n") : "",
    website: row.website || "",
    notes: row.notes || "",
    invoicingContact: row.invoicingContact || "",
    warnings: normalizeWarnings(row.warnings),
  };
}

export default function ContactCustomersPage() {
  const [rows, setRows] = useState(() => initialRows.map(toDisplayRow));
  const [search, setSearch] = useState("");
  const [colFilters, setColFilters] = useState(() => Object.fromEntries(columns.map((column) => [column.key, ""])));
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

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      const query = search.trim().toLowerCase();
      if (query) {
        const blob = [
          row.code,
          row.name,
          row.emails.join(" "),
          row.contacts.map((contact) => [contact.name, contact.email, contact.phone].filter(Boolean).join(" ")).join(" "),
          (row.addresses || []).join(" "),
          row.warnings.map((warning) => warning.warningDescription).join(" "),
        ]
          .join(" ")
          .toLowerCase();
        if (!blob.includes(query)) return false;
      }

      for (const column of columns) {
        const value = (colFilters[column.key] || "").trim().toLowerCase();
        if (!value) continue;
        if (!String(row[column.key] ?? "").toLowerCase().includes(value)) return false;
      }

      return true;
    });
  }, [rows, search, colFilters]);

  const selected = selectedId != null ? filteredRows.find((row) => row.id === selectedId) ?? null : null;

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
    if (!formData.code.trim() || !formData.name.trim()) {
      return;
    }

    const nextRow = toDisplayRow({
      id: editMode && selected ? selected.id : Math.max(0, ...rows.map((row) => Number(row.id) || 0)) + 1,
      code: formData.code.trim(),
      name: formData.name.trim(),
      emails: formData.emails
        .split("\n")
        .map((email) => email.trim())
        .filter(Boolean),
      contacts: (formData.contacts || [])
        .map((contact) => ({
          name: (contact.name || "").trim(),
          email: (contact.email || "").trim(),
          phone: (contact.phone || "").trim(),
        }))
        .filter((contact) => contact.name || contact.email || contact.phone),
      addresses: formData.addresses
        .split("\n")
        .map((address) => address.trim())
        .filter(Boolean),
      website: formData.website.trim(),
      notes: formData.notes.trim(),
      invoicingContact: formData.invoicingContact.trim(),
      warnings: (formData.warnings || [])
        .filter((warning) => (warning.warningDescription || "").trim())
        .map((warning) => ({
          warningDescription: warning.warningDescription.trim(),
          showOnPacks: warning.showOnPacks !== false,
        })),
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

  function removeSelected() {
    if (!selected) return;
    if (!window.confirm(`Delete customer "${selected.name}" permanently?`)) return;
    setRows((prev) => prev.filter((row) => row.id !== selected.id));
    setSelectedId(null);
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

  function updateWarning(index, key, value) {
    setFormData((prev) => ({
      ...prev,
      warnings: (prev.warnings || []).map((warning, itemIndex) => (itemIndex === index ? { ...warning, [key]: value } : warning)),
    }));
  }

  function addWarningRow() {
    setFormData((prev) => ({
      ...prev,
      warnings: [...(prev.warnings || []), emptyWarning()],
    }));
  }

  function removeWarningRow(index) {
    setFormData((prev) => {
      const next = (prev.warnings || []).filter((_, itemIndex) => itemIndex !== index);
      return { ...prev, warnings: next.length ? next : [emptyWarning()] };
    });
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs text-slate-500">Contacts / Customers</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 md:text-[1.65rem]">Customers</h1>
        {!isMobile ? <p className="mt-1 text-xs text-slate-500">Manage customer master records, contacts, and warnings.</p> : null}
      </div>

      <div className="rounded-xl border border-slate-200/90 bg-white p-3 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center">
          <input
            className={cn(inputClass, "lg:min-w-[240px] lg:flex-1", isMobile && "w-full")}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search customers..."
            aria-label="Search customers"
          />
          <div className={cn("flex flex-wrap gap-2 lg:ms-auto", isMobile && "w-full")}>
            <BtnPrimary type="button" onClick={openCreateModal}>
              + Add
            </BtnPrimary>
            {isMobile && selected ? (
              <BtnPrimary type="button" disabled={!selected} onClick={openEditModal}>
                View / Edit
              </BtnPrimary>
            ) : (
              <BtnSecondary type="button" disabled={!selected} onClick={openEditModal}>
                Edit
              </BtnSecondary>
            )}
            <BtnDanger type="button" disabled={!selected} onClick={removeSelected}>
              Delete
            </BtnDanger>
          </div>
        </div>
      </div>

      <div className={cn("grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(240px,320px)] xl:items-start", isMobile && "grid-cols-1")}>
        <div className="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-sm">
          {isMobile ? (
            <MobileList rows={filteredRows} selectedId={selectedId} onSelect={setSelectedId} search={search} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/95">
                    {columns.map((column) => (
                      <th key={column.key} className="whitespace-nowrap px-3 py-2.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                        {column.label}
                      </th>
                    ))}
                  </tr>
                  <tr className="border-b border-slate-200 bg-white">
                    {columns.map((column) => (
                      <th key={`filter-${column.key}`} className="px-2 py-1.5">
                        <input
                          className={filterInputClass}
                          placeholder="Filter..."
                          value={colFilters[column.key]}
                          onChange={(event) => setColFilters((prev) => ({ ...prev, [column.key]: event.target.value }))}
                          aria-label={`Filter ${column.label}`}
                        />
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.length === 0 ? (
                    <tr>
                      <td colSpan={columns.length} className="px-3 py-14 text-center text-sm text-slate-400">
                        No customers found.
                      </td>
                    </tr>
                  ) : (
                    filteredRows.map((row) => {
                      const isSelected = selectedId === row.id;
                      return (
                        <tr
                          key={row.id}
                          onClick={() => setSelectedId((prev) => (prev === row.id ? null : row.id))}
                          className={cn("cursor-pointer border-b border-slate-100 transition-colors last:border-0", isSelected ? "bg-brand/[0.07]" : "hover:bg-slate-50/90")}
                        >
                          <td className="px-3 py-2.5 font-semibold text-blue-600">{row.code || "—"}</td>
                          <td className="px-3 py-2.5 font-semibold text-slate-900">{row.name || "—"}</td>
                          <td className="px-3 py-2.5 text-slate-700">{row.emailsCount}</td>
                          <td className="px-3 py-2.5 text-slate-700">{row.contactsCount}</td>
                          <td className="px-3 py-2.5 text-slate-700">{row.warningsCount}</td>
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
            <h2 className="text-sm font-semibold text-slate-900">Customer Details</h2>
            {!selected ? (
              <p className="mt-4 text-sm leading-relaxed text-slate-500">Select a customer to view details.</p>
            ) : (
              <div className="mt-4 space-y-3 text-sm">
                <DetailItem label="Customer Code" value={selected.code} highlight />
                <DetailItem label="Customer Name" value={selected.name} highlight />
                <DetailItem label="Email(s)" value={selected.emails.length ? selected.emails.join(", ") : "—"} />
                <DetailItem label="Address(es)" value={selected.addresses?.length ? selected.addresses.join(", ") : "—"} />
                <DetailItem label="Website" value={selected.website || "—"} />
                <DetailItem label="Invoicing Contact" value={selected.invoicingContact || "—"} />
                <DetailItem label="Notes" value={selected.notes || "—"} />
                <DetailItem
                  label="Customer Warning(s)"
                  value={
                    selected.warnings.length
                      ? selected.warnings
                          .map((warning) => `${warning.warningDescription} (Show on Packs: ${warning.showOnPacks ? "Yes" : "No"})`)
                          .join(" | ")
                      : "—"
                  }
                />
              </div>
            )}
          </aside>
        ) : null}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editMode ? "Edit Customer" : "Add New Customer"} width={600}>
        <div className="space-y-3 pe-2">
          <FormRow label="Customer Code" required>
            <Input value={formData.code} onChange={(event) => setFormData({ ...formData, code: event.target.value })} placeholder="e.g., AC001" />
          </FormRow>

          <FormRow label="Customer Name" required>
            <Input value={formData.name} onChange={(event) => setFormData({ ...formData, name: event.target.value })} placeholder="e.g., Agri-Corp Pty Ltd" />
          </FormRow>

          <FormRow label="Customer Email(s)">
            <textarea
              value={formData.emails}
              onChange={(event) => setFormData({ ...formData, emails: event.target.value })}
              placeholder={"Enter one email per line\naccounts@company.com.au\nadmin@company.com.au"}
              rows={3}
              className={textareaClass}
            />
          </FormRow>

          <div className="mt-1">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700">Customer Contact(s)</span>
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

          <FormRow label="Customer Address(es)">
            <textarea
              value={formData.addresses}
              onChange={(event) => setFormData({ ...formData, addresses: event.target.value })}
              placeholder={"Enter one address per line\n123 Farm Road, Toowoomba QLD 4350"}
              rows={2}
              className={textareaClass}
            />
          </FormRow>

          <FormRow label="Customer Website">
            <Input value={formData.website} onChange={(event) => setFormData({ ...formData, website: event.target.value })} placeholder="e.g., www.company.com.au" />
          </FormRow>

          <FormRow label="Customer Invoicing Contact">
            <Input
              value={formData.invoicingContact}
              onChange={(event) => setFormData({ ...formData, invoicingContact: event.target.value })}
              placeholder="e.g., John Smith - accounts@company.com.au"
            />
          </FormRow>

          <FormRow label="Notes">
            <textarea
              value={formData.notes}
              onChange={(event) => setFormData({ ...formData, notes: event.target.value })}
              placeholder="Any additional notes about this customer"
              rows={2}
              className={textareaClass}
            />
          </FormRow>

          <FormRow label="Customer Warning(s)">
            <div className="flex flex-col gap-2">
              {(formData.warnings || []).map((warning, index) => (
                <div key={index} className="space-y-2 rounded-md border border-amber-200/70 bg-amber-50/40 p-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-slate-500">Warning {index + 1}</span>
                    {(formData.warnings || []).length > 1 ? (
                      <button type="button" onClick={() => removeWarningRow(index)} className="px-1 text-[11px] text-rose-600 hover:text-rose-700">
                        Remove
                      </button>
                    ) : null}
                  </div>
                  <Input
                    value={warning.warningDescription}
                    onChange={(event) => updateWarning(index, "warningDescription", event.target.value)}
                    placeholder="Warning Description"
                  />
                  <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                    <input type="checkbox" checked={warning.showOnPacks !== false} onChange={(event) => updateWarning(index, "showOnPacks", event.target.checked)} />
                    Show on Packs
                  </label>
                </div>
              ))}
              <BtnSecondary type="button" onClick={addWarningRow}>
                + Add Warning
              </BtnSecondary>
            </div>
          </FormRow>
        </div>

        <div className="mt-5 flex gap-2 border-t border-slate-200 pt-4">
          <BtnPrimary type="button" className="flex-1 justify-center" onClick={handleSubmit}>
            {editMode ? "Update Customer" : "Add Customer"}
          </BtnPrimary>
          <BtnSecondary type="button" className="flex-1 justify-center" onClick={() => setModalOpen(false)}>
            Cancel
          </BtnSecondary>
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
  const emptyMessage = search ? "No customers match your search." : "No customers found. Add your first one!";
  return (
    <div className="space-y-2 p-3">
      <div className="px-0.5 text-xs font-semibold text-slate-600">Customers ({rows.length})</div>
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
              <p className="mt-1 text-[11px] text-slate-500">
                {[row.emailsCount, row.contactsCount, row.warningsCount].filter((value) => value !== "—").join(" | ") || "—"}
              </p>
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
        aria-labelledby="customers-modal-title"
        className="relative max-h-[min(90vh,760px)] w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl"
        style={{ maxWidth: `${width}px` }}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-4 py-3">
          <h2 id="customers-modal-title" className="text-sm font-semibold text-slate-900">
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
