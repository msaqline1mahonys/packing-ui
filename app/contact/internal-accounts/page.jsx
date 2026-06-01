"use client";

import { useCallback, useEffect, useState } from "react";

import { Grid } from "@/components/clutch-table";
import { cn } from "@/lib/utils";

const MOBILE_BREAKPOINT = 900;
const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api"
).replace(/\/+$/, "");
const INTERNAL_ACCOUNTS_ENDPOINT = `${API_BASE_URL}/contacts/internal-accounts`;

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

const gridColumns = columns.map((col) => ({
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

async function internalAccountRequest(path = "", options = {}) {
  const response = await fetch(`${INTERNAL_ACCOUNTS_ENDPOINT}${path}`, {
    ...options,
    headers: {
      ...getAuthHeaders(),
      ...(options.headers || {}),
    },
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || result?.success === false) {
    throw new Error(extractApiError(result, "Internal account request failed."));
  }
  return result;
}

function fromApiInternalAccount(row) {
  if (!row) return null;

  const shrinkApplied = Boolean(row.shrink_applied ?? row.shrinkApplied);
  const shrinkReceivalAccount = Boolean(row.shrink_receival_account ?? row.shrinkReceivalAccount);

  return {
    id: row.id,
    name: row.name ?? "",
    description: row.description ?? "",
    shrinkApplied,
    shrinkReceivalAccount,
    shrinkAppliedLabel: shrinkApplied ? "Yes" : "No",
    shrinkReceivalLabel: shrinkReceivalAccount ? "Yes" : "No",
  };
}

function toApiPayload(formData) {
  const tenant = getTenantPayload();

  return {
    ...tenant,
    name: formData.name.trim(),
    description: formData.description.trim() || null,
    shrink_applied: formData.shrinkApplied === "yes",
    shrink_receival_account: formData.shrinkReceivalAccount === "yes",
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

  const loadInternalAccounts = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const result = await internalAccountRequest("?per_page=500");
      const pager = result?.data;
      const apiRows = Array.isArray(pager?.data) ? pager.data : Array.isArray(pager) ? pager : [];
      setRows(apiRows.map(fromApiInternalAccount).filter(Boolean));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load internal accounts.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      loadInternalAccounts();
    });
    return () => cancelAnimationFrame(frame);
  }, [loadInternalAccounts]);

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
      setError("Account name is required.");
      return;
    }

    const tenant = getTenantPayload();
    if (!tenant.organization_id || !tenant.site_id) {
      setError("Organization and current site are required to save an internal account.");
      return;
    }

    if (formData.shrinkReceivalAccount === "yes") {
      const existing = rows.find(
        (row) => row.shrinkReceivalAccount && row.id !== (editMode && selected ? selected.id : null)
      );
      if (existing) {
        const confirmed = window.confirm(
          `"${existing.name}" is currently set as the shrink receival account. Setting this account as the shrink receival account will remove that designation from "${existing.name}". Continue?`
        );
        if (!confirmed) return;
      }
    }

    setIsSaving(true);
    setError("");
    setNotice("");

    try {
      const body = toApiPayload(formData);

      if (!editMode) {
        const result = await internalAccountRequest("", {
          method: "POST",
          body: JSON.stringify(body),
        });
        const nextRow = fromApiInternalAccount(result.data);
        if (!nextRow) throw new Error("Invalid response from server.");
        setRows((prev) => {
          const next = [nextRow, ...prev];
          if (!nextRow.shrinkReceivalAccount) return next;
          return next.map((row) =>
            row.id === nextRow.id ? row : { ...row, shrinkReceivalAccount: false, shrinkReceivalLabel: "No" }
          );
        });
        setSelectedId(nextRow.id);
        setNotice(result.message || "Internal account created successfully.");
        setModalOpen(false);
        setFormData(buildFormData());
        return;
      }

      if (selected) {
        const result = await internalAccountRequest(`/${selected.id}`, {
          method: "PUT",
          body: JSON.stringify(body),
        });
        const nextRow = fromApiInternalAccount(result.data);
        if (!nextRow) throw new Error("Invalid response from server.");
        setRows((prev) => {
          const next = prev.map((row) => (row.id === selected.id ? nextRow : row));
          if (!nextRow.shrinkReceivalAccount) return next;
          return next.map((row) =>
            row.id === nextRow.id ? row : { ...row, shrinkReceivalAccount: false, shrinkReceivalLabel: "No" }
          );
        });
        setNotice(result.message || "Internal account updated successfully.");
        setModalOpen(false);
        setFormData(buildFormData());
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save internal account.");
    } finally {
      setIsSaving(false);
    }
  }

  async function removeSelected() {
    if (!selected || isDeleting) return;
    if (!window.confirm(`Delete internal account "${selected.name}" permanently?`)) return;

    setIsDeleting(true);
    setError("");
    setNotice("");

    try {
      const result = await internalAccountRequest(`/${selected.id}`, { method: "DELETE" });
      setRows((prev) => prev.filter((row) => row.id !== selected.id));
      setSelectedId(null);
      setNotice(result.message || "Internal account deleted successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete internal account.");
    } finally {
      setIsDeleting(false);
    }
  }

  const toolbarActions = (
    <div className="flex flex-wrap gap-2">
      <BtnPrimary type="button" onClick={openCreateModal} disabled={isLoading}>
        + Add
      </BtnPrimary>
      <BtnSecondary type="button" onClick={loadInternalAccounts} disabled={isLoading}>
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
        <p className="text-xs text-slate-500">Contacts / Internal Accounts</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 md:text-[1.65rem]">Internal Accounts</h1>
        {!isMobile ? (
          <p className="mt-1 text-xs text-slate-500">Manage internal accounts and shrink handling designations.</p>
        ) : null}
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
              fileName="Internal Accounts"
              visibleRows={12}
              loading={isLoading}
              emptyMessage={isLoading ? "Loading internal accounts…" : "No internal accounts found."}
              onRowClick={(row) => setSelectedId((prev) => (prev === row.id ? null : row.id))}
              toolbarActions={toolbarActions}
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
                <DetailItem
                  label="Shrink Receival Account"
                  value={selected.shrinkReceivalAccount ? "Yes" : "No"}
                  highlight={selected.shrinkReceivalAccount}
                />

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
                  <BtnSecondary type="button" className="flex-1 justify-center" disabled={isLoading} onClick={openEditModal}>
                    Edit Account
                  </BtnSecondary>
                  <BtnDanger
                    type="button"
                    className="flex-1 justify-center"
                    disabled={isLoading || isDeleting}
                    onClick={removeSelected}
                  >
                    {isDeleting ? "Deleting…" : "Delete Account"}
                  </BtnDanger>
                </div>
              </div>
            )}
          </aside>
        ) : null}
      </div>

      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={editMode ? "Edit Internal Account" : "Add New Internal Account"}
        width={600}
      >
        {modalError ? (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-600">{modalError}</div>
        ) : null}
        <div className="space-y-3 pe-2">
          <FormRow label="Account Name" required>
            <Input
              value={formData.name}
              disabled={isSaving}
              onChange={(event) => setFormData({ ...formData, name: event.target.value })}
              placeholder="e.g., Quality Control"
            />
          </FormRow>

          <FormRow label="Account Description">
            <textarea
              value={formData.description}
              disabled={isSaving}
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
              disabled={isSaving}
              onChange={(event) => setFormData({ ...formData, shrinkApplied: event.target.value })}
            >
              <option value="no">No</option>
              <option value="yes">Yes</option>
            </select>
            <p className="mt-1 text-[11px] italic text-slate-500">
              Specifies whether shrink is applied on tickets being received for this account.
            </p>
          </FormRow>

          <FormRow label="Shrink Receival Account?">
            <select
              className={inputClass}
              value={formData.shrinkReceivalAccount}
              disabled={isSaving}
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
          <BtnPrimary type="button" className="flex-1 justify-center" onClick={handleSubmit} disabled={isSaving}>
            {isSaving ? "Saving…" : editMode ? "Update Account" : "Add Account"}
          </BtnPrimary>
          <BtnSecondary type="button" className="flex-1 justify-center" onClick={closeModal} disabled={isSaving}>
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

function MobileList({ rows, selectedId, onSelect, search, isLoading }) {
  const emptyMessage = isLoading
    ? "Loading internal accounts…"
    : search
      ? "No internal accounts match your search."
      : "No internal accounts found. Add your first one!";
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