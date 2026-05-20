"use client";

import { useEffect, useState } from "react";

import { Grid } from "@/components/clutch-table";
import { INTERNAL_ACCOUNT_ROWS } from "@/lib/Data";
import { cn } from "@/lib/utils";

const MOBILE_BREAKPOINT = 900;
const inputClass =
  "w-full rounded-lg border border-slate-200/95 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-brand/15 placeholder:text-slate-400 focus:border-brand/35 focus:ring-2";
const textareaClass =
  "w-full rounded-lg border border-slate-200/95 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-brand/15 placeholder:text-slate-400 focus:border-brand/35 focus:ring-2 resize-y";

const columns = [
  { key: "name", label: "Account Name" },
  { key: "description", label: "Description" },
  { key: "shrinkAppliedLabel", label: "Shrink Applied" },
  { key: "shrinkReceivalLabel", label: "Shrink Receival" },
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

const initialRows = INTERNAL_ACCOUNT_ROWS;

function toDisplayRow(row) {
  return {
    ...row,
    description: row.description || "",
    shrinkApplied: row.shrinkApplied === true,
    shrinkReceivalAccount: row.shrinkReceivalAccount === true,
    shrinkAppliedLabel: row.shrinkApplied ? "Yes" : "No",
    shrinkReceivalLabel: row.shrinkReceivalAccount ? "Yes" : "No",
  };
}

function buildFormData(row) {
  if (!row) {
    return {
      name: "",
      description: "",
      shrinkApplied: "no",
      shrinkReceivalAccount: "no",
    };
  }
  return {
    name: row.name || "",
    description: row.description || "",
    shrinkApplied: row.shrinkApplied ? "yes" : "no",
    shrinkReceivalAccount: row.shrinkReceivalAccount ? "yes" : "no",
  };
}

export default function InternalAccountsPage() {
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
    if (!formData.name.trim()) {
      window.alert("Account Name is required.");
      return;
    }

    const nextRow = toDisplayRow({
      id: editMode && selected ? selected.id : Math.max(0, ...rows.map((row) => Number(row.id) || 0)) + 1,
      name: formData.name.trim(),
      description: formData.description.trim(),
      shrinkApplied: formData.shrinkApplied === "yes",
      shrinkReceivalAccount: formData.shrinkReceivalAccount === "yes",
    });

    if (nextRow.shrinkReceivalAccount) {
      const existing = rows.find((row) => row.shrinkReceivalAccount && row.id !== nextRow.id);
      if (existing) {
        const confirmed = window.confirm(
          `"${existing.name}" is currently set as the shrink receival account. Setting this account as the shrink receival account will remove that designation from "${existing.name}". Continue?`
        );
        if (!confirmed) return;
      }
    }

    setRows((prev) => {
      const withRow = editMode && selected ? prev.map((row) => (row.id === selected.id ? nextRow : row)) : [nextRow, ...prev];
      if (!nextRow.shrinkReceivalAccount) return withRow;
      return withRow.map((row) => (row.id === nextRow.id ? row : { ...row, shrinkReceivalAccount: false, shrinkReceivalLabel: "No" }));
    });

    setModalOpen(false);
    setFormData(buildFormData());
    setSelectedId(nextRow.id);
  }

  function removeSelected() {
    if (!selected) return;
    if (!window.confirm(`Delete internal account "${selected.name}" permanently?`)) return;
    setRows((prev) => prev.filter((row) => row.id !== selected.id));
    setSelectedId(null);
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs text-slate-500">Contacts / Internal Accounts</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 md:text-[1.65rem]">Internal Accounts</h1>
        {!isMobile ? <p className="mt-1 text-xs text-slate-500">Manage internal accounts and shrink handling designations.</p> : null}
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
              fileName="Internal Accounts"
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
            <h2 className="text-sm font-semibold text-slate-900">Internal Account Details</h2>
            {!selected ? (
              <p className="mt-4 text-sm leading-relaxed text-slate-500">Select an internal account to view details.</p>
            ) : (
              <div className="mt-4 space-y-3 text-sm">
                <DetailItem label="Account Name" value={selected.name} highlight />
                <DetailItem label="Description" value={selected.description || "â€”"} />
                <DetailItem label="Shrink Applied" value={selected.shrinkApplied ? "Yes" : "No"} />
                <DetailItem label="Shrink Receival Account" value={selected.shrinkReceivalAccount ? "Yes" : "No"} highlight={selected.shrinkReceivalAccount} />

                {selected.shrinkReceivalAccount ? (
                  <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
                    <span className="me-1 font-bold">*</span>
                    This account is the designated shrink receival account. Only one account can hold this designation.
                  </div>
                ) : null}

                {selected.shrinkApplied ? (
                  <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-medium text-blue-800">
                    Shrink is applied on tickets received for this account.
                  </div>
                ) : null}

                <div className="mt-4 flex gap-2 border-t border-slate-200 pt-4">
                  <BtnSecondary type="button" className="flex-1 justify-center" onClick={openEditModal}>
                    Edit Account
                  </BtnSecondary>
                  <BtnDanger type="button" className="flex-1 justify-center" onClick={removeSelected}>
                    Delete Account
                  </BtnDanger>
                </div>
              </div>
            )}
          </aside>
        ) : null}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editMode ? "Edit Internal Account" : "Add New Internal Account"} width={600}>
        <div className="space-y-3 pe-2">
          <FormRow label="Account Name" required>
            <Input
              value={formData.name}
              onChange={(event) => setFormData({ ...formData, name: event.target.value })}
              placeholder="e.g., Quality Control"
            />
          </FormRow>

          <FormRow label="Account Description">
            <textarea
              value={formData.description}
              onChange={(event) => setFormData({ ...formData, description: event.target.value })}
              placeholder="Enter a description for this internal account"
              rows={3}
              className={textareaClass}
            />
          </FormRow>

          <FormRow label="Shrink Applied?">
            <select
              className={inputClass}
              value={formData.shrinkApplied}
              onChange={(event) => setFormData({ ...formData, shrinkApplied: event.target.value })}
            >
              <option value="no">No</option>
              <option value="yes">Yes</option>
            </select>
            <p className="mt-1 text-[11px] italic text-slate-500">Specifies whether shrink is applied on tickets being received for this account.</p>
          </FormRow>

          <FormRow label="Shrink Receival Account?">
            <select
              className={inputClass}
              value={formData.shrinkReceivalAccount}
              onChange={(event) => setFormData({ ...formData, shrinkReceivalAccount: event.target.value })}
            >
              <option value="no">No</option>
              <option value="yes">Yes</option>
            </select>
            <p className="mt-1 text-[11px] italic text-slate-500">
              Only one internal account can be set as the shrink receival account. Setting this will remove that designation from any other account.
            </p>
          </FormRow>
        </div>

        <div className="mt-5 flex gap-2 border-t border-slate-200 pt-4">
          <BtnPrimary type="button" className="flex-1 justify-center" onClick={handleSubmit}>
            {editMode ? "Update Account" : "Add Account"}
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
  const emptyMessage = search ? "No internal accounts match your search." : "No internal accounts found. Add your first one!";
  return (
    <div className="space-y-2 p-3">
      <div className="px-0.5 text-xs font-semibold text-slate-600">Internal Accounts ({rows.length})</div>
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
                isSelected ? "border-blue-500 bg-blue-50" : row.shrinkReceivalAccount ? "border-amber-200 bg-amber-50/50" : "border-slate-200 bg-white"
              )}
            >
              <p className="text-sm font-semibold text-slate-800">
                {row.shrinkReceivalAccount ? <span className="me-1 text-amber-500">*</span> : null}
                {row.name || "â€”"}
              </p>
              <p className="mt-1 text-xs text-slate-600">{row.description || "â€”"}</p>
              <p className="mt-1 text-[11px] text-slate-500">
                Shrink applied: {row.shrinkApplied ? "Yes" : "No"}
                {row.shrinkReceivalAccount ? " | Shrink receival account" : ""}
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
      <dd className={cn("mt-0.5 break-words text-slate-800", highlight && "font-semibold text-brand")}>{value || "â€”"}</dd>
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
        aria-labelledby="internal-accounts-modal-title"
        className="relative max-h-[min(90vh,760px)] w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl"
        style={{ maxWidth: `${width}px` }}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-4 py-3">
          <h2 id="internal-accounts-modal-title" className="text-sm font-semibold text-slate-900">
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