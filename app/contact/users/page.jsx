"use client";

import { useEffect, useMemo, useState } from "react";

import { CONTACT_USER_ROWS } from "@/lib/Data";
import { cn } from "@/lib/utils";

const MOBILE_BREAKPOINT = 900;
const inputClass =
  "w-full rounded-lg border border-slate-200/95 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-brand/15 placeholder:text-slate-400 focus:border-brand/35 focus:ring-2";
const filterInputClass =
  "w-full rounded-md border border-slate-200/90 bg-white px-2 py-1 text-xs text-slate-800 outline-none placeholder:text-slate-400 focus:border-brand/35 focus:ring-1 focus:ring-brand/25";

const columns = [
  { key: "name", label: "Name" },
  { key: "email", label: "Email" },
  { key: "role", label: "Role" },
  { key: "status", label: "Status" },
];

const initialRows = CONTACT_USER_ROWS;

function toDisplayRow(row) {
  return {
    ...row,
    status: row.active ? "Active" : "Inactive",
  };
}

function buildFormData(row) {
  if (!row) {
    return {
      name: "",
      email: "",
      role: "",
      active: true,
      newPassword: "",
      confirmPassword: "",
    };
  }
  return {
    name: row.name || "",
    email: row.email || "",
    role: row.role || "",
    active: row.active !== false,
    newPassword: "",
    confirmPassword: "",
  };
}

export default function ContactUsersPage() {
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
        const blob = `${row.name} ${row.email} ${row.role} ${row.status}`.toLowerCase();
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
    if (!formData.name.trim() || !formData.email.trim()) return;
    const nextPassword = (formData.newPassword || "").trim();
    const confirmPassword = (formData.confirmPassword || "").trim();

    if (nextPassword || confirmPassword) {
      if (nextPassword.length < 8) {
        window.alert("Password must be at least 8 characters.");
        return;
      }
      if (nextPassword !== confirmPassword) {
        window.alert("Password confirmation does not match.");
        return;
      }
    }

    const nextRow = toDisplayRow({
      id: editMode && selected ? selected.id : Math.max(0, ...rows.map((row) => Number(row.id) || 0)) + 1,
      name: formData.name.trim(),
      email: formData.email.trim(),
      role: formData.role.trim(),
      active: formData.active,
      password: editMode && selected ? (nextPassword ? nextPassword : selected.password || "") : nextPassword,
      passwordUpdatedAt: editMode && selected ? (nextPassword ? new Date().toISOString() : selected.passwordUpdatedAt || "") : nextPassword ? new Date().toISOString() : "",
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
    if (!window.confirm(`Delete user "${selected.name}" permanently?`)) return;
    setRows((prev) => prev.filter((row) => row.id !== selected.id));
    setSelectedId(null);
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs text-slate-500">Contacts / Users</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 md:text-[1.65rem]">Users</h1>
        {!isMobile ? <p className="mt-1 text-xs text-slate-500">Manage users: name, email, role, and status.</p> : null}
      </div>

      <div className="rounded-xl border border-slate-200/90 bg-white p-3 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center">
          <input
            className={cn(inputClass, "lg:min-w-[240px] lg:flex-1", isMobile && "w-full")}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search users..."
            aria-label="Search users"
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
                        No users found.
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
                          <td className="px-3 py-2.5 font-semibold text-slate-900">{row.name || "—"}</td>
                          <td className="px-3 py-2.5 text-slate-700">{row.email || "—"}</td>
                          <td className="px-3 py-2.5 text-slate-700">{row.role || "—"}</td>
                          <td className="px-3 py-2.5">
                            <span
                              className={cn(
                                "inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1",
                                row.active ? "bg-emerald-50 text-emerald-800 ring-emerald-200" : "bg-rose-50 text-rose-800 ring-rose-200"
                              )}
                            >
                              {row.status}
                            </span>
                          </td>
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
            <h2 className="text-sm font-semibold text-slate-900">User Details</h2>
            {!selected ? (
              <p className="mt-4 text-sm leading-relaxed text-slate-500">Select a user to view details.</p>
            ) : (
              <div className="mt-4 space-y-3 text-sm">
                <DetailItem label="Name" value={selected.name} highlight />
                <DetailItem label="Email" value={selected.email} />
                <DetailItem label="Role" value={selected.role || "—"} />
                <DetailItem label="Status" value={selected.status} />
                <DetailItem
                  label="Password Last Updated"
                  value={selected.passwordUpdatedAt ? new Date(selected.passwordUpdatedAt).toLocaleString() : "Never"}
                />
                <div className="mt-4 flex gap-2 border-t border-slate-200 pt-4">
                  <BtnSecondary type="button" className="flex-1 justify-center" onClick={openEditModal}>
                    Edit User
                  </BtnSecondary>
                  <BtnDanger type="button" className="flex-1 justify-center" onClick={removeSelected}>
                    Delete User
                  </BtnDanger>
                </div>
              </div>
            )}
          </aside>
        ) : null}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editMode ? "Edit User" : "Add New User"} width={500}>
        <div className="space-y-3">
          <FormRow label="Name" required>
            <Input value={formData.name} onChange={(event) => setFormData({ ...formData, name: event.target.value })} placeholder="e.g., J. Mitchell" />
          </FormRow>

          <FormRow label="Email" required>
            <Input
              type="email"
              value={formData.email}
              onChange={(event) => setFormData({ ...formData, email: event.target.value })}
              placeholder="e.g., j.mitchell@mahonys.com.au"
            />
          </FormRow>

          <FormRow label="Role">
            <Input
              value={formData.role}
              onChange={(event) => setFormData({ ...formData, role: event.target.value })}
              placeholder="e.g., Manager, Supervisor, Operator"
            />
          </FormRow>

          <FormRow label="Status">
            <select
              className={inputClass}
              value={formData.active ? "active" : "inactive"}
              onChange={(event) => setFormData({ ...formData, active: event.target.value === "active" })}
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </FormRow>

          {editMode ? (
            <>
              <FormRow label="New Password">
                <Input
                  type="password"
                  value={formData.newPassword}
                  onChange={(event) => setFormData({ ...formData, newPassword: event.target.value })}
                  placeholder="Leave blank to keep current password"
                />
              </FormRow>
              <FormRow label="Confirm New Password">
                <Input
                  type="password"
                  value={formData.confirmPassword}
                  onChange={(event) => setFormData({ ...formData, confirmPassword: event.target.value })}
                  placeholder="Re-enter new password"
                />
              </FormRow>
            </>
          ) : null}
        </div>

        <div className="mt-5 flex gap-2 border-t border-slate-200 pt-4">
          <BtnPrimary type="button" className="flex-1 justify-center" onClick={handleSubmit}>
            {editMode ? "Update User" : "Add User"}
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
  const emptyMessage = search ? "No users match your search." : "No users found. Add your first one!";
  return (
    <div className="space-y-2 p-3">
      <div className="px-0.5 text-xs font-semibold text-slate-600">Users ({rows.length})</div>
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
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-semibold text-slate-800">{row.name || "—"}</p>
                <span
                  className={cn(
                    "inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1",
                    row.active ? "bg-emerald-50 text-emerald-800 ring-emerald-200" : "bg-rose-50 text-rose-800 ring-rose-200"
                  )}
                >
                  {row.status}
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-600">{row.email || "—"}</p>
              <p className="mt-1 text-[11px] text-slate-500">{row.role || "—"}</p>
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
        aria-labelledby="users-modal-title"
        className="relative max-h-[min(90vh,720px)] w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl"
        style={{ maxWidth: `${width}px` }}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-4 py-3">
          <h2 id="users-modal-title" className="text-sm font-semibold text-slate-900">
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
