"use client";

import { useEffect, useState } from "react";

import { Grid } from "@/components/clutch-table";
import { CONTACT_USER_ROWS } from "@/lib/Data";
import { cn } from "@/lib/utils";

const MOBILE_BREAKPOINT = 900;
const inputClass =
  "w-full rounded-lg border border-slate-200/95 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-brand/15 placeholder:text-slate-400 focus:border-brand/35 focus:ring-2";

const columns = [
  { key: "name", label: "Name" },
  { key: "weighbridgeAccessLabel", label: "Weighbridge" },
  { key: "packersAccountAccessLabel", label: "Packers Acc" },
  { key: "status", label: "Status" },
  { key: "aoActiveLabel", label: "AO Active" },
  { key: "aoExpiryLabel", label: "AO Expiry" },
  { key: "aoLicenseNumberLabel", label: "AO License Number" },
  { key: "aoPemsPasswordLabel", label: "AO PEMs Password" },
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

const initialRows = CONTACT_USER_ROWS;

function toDisplayRow(row) {
  return {
    ...row,
    status: row.active ? "Active" : "Inactive",
    weighbridgeAccessLabel: row.weighbridgeAccess ? "Yes" : "No",
    packersAccountAccessLabel: row.packersAccountAccess ? "Yes" : "No",
    aoActiveLabel: row.aoActive ? "Yes" : "No",
    aoExpiryLabel: row.aoExpiry || "—",
    aoLicenseNumberLabel: row.aoLicenseNumber || "—",
    aoPemsPasswordLabel: row.aoPemsPassword ? "••••••••" : "—",
  };
}

function buildFormData(row) {
  if (!row) {
    return {
      name: "",
      email: "",
      role: "",
      active: true,
      weighbridgeAccess: false,
      packersAccountAccess: false,
      aoActive: false,
      aoExpiry: "",
      aoLicenseNumber: "",
      aoPemsUsername: "",
      aoPemsPassword: "",
      aoToken: "",
      signature: "",
      isFumigator: false,
      fumigationExpiry: "",
      fumigatorLicence: "",
      newPassword: "",
      confirmPassword: "",
    };
  }
  return {
    name: row.name || "",
    email: row.email || "",
    role: row.role || "",
    active: row.active !== false,
    weighbridgeAccess: row.weighbridgeAccess === true,
    packersAccountAccess: row.packersAccountAccess === true,
    aoActive: row.aoActive === true,
    aoExpiry: row.aoExpiry || "",
    aoLicenseNumber: row.aoLicenseNumber || "",
    aoPemsUsername: row.aoPemsUsername || "",
    aoPemsPassword: row.aoPemsPassword || "",
    aoToken: row.aoToken || "",
    signature: row.signature || "",
    isFumigator: row.isFumigator === true,
    fumigationExpiry: row.fumigationExpiry || "",
    fumigatorLicence: row.fumigatorLicence || "",
    newPassword: "",
    confirmPassword: "",
  };
}

export default function ContactUsersPage() {
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
    if (!formData.name.trim() || !formData.email.trim()) return;
    const nextPassword = (formData.newPassword || "").trim();
    const confirmPassword = (formData.confirmPassword || "").trim();
    const aoPemsUsername = (formData.aoPemsUsername || "").trim();
    const aoToken = (formData.aoToken || "").trim();
    const aoLicenseNumber = (formData.aoLicenseNumber || "").trim();
    const signature = (formData.signature || "").trim();
    const fumigatorLicence = (formData.fumigatorLicence || "").trim();

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

    if (formData.aoActive) {
      if (!aoPemsUsername) {
        window.alert("AO PEMS Username is required when AO is active.");
        return;
      }
      if (!aoToken) {
        window.alert("AO Token is required when AO is active.");
        return;
      }
    }

    if (formData.isFumigator && !fumigatorLicence) {
      window.alert("Fumigator Licence is required when Fumigator is enabled.");
      return;
    }

    const nextRow = toDisplayRow({
      id: editMode && selected ? selected.id : Math.max(0, ...rows.map((row) => Number(row.id) || 0)) + 1,
      name: formData.name.trim(),
      email: formData.email.trim(),
      role: formData.role.trim(),
      active: formData.active,
      weighbridgeAccess: formData.weighbridgeAccess,
      packersAccountAccess: formData.packersAccountAccess,
      aoActive: formData.aoActive,
      aoExpiry: formData.aoActive ? formData.aoExpiry : "",
      aoLicenseNumber: formData.aoActive ? aoLicenseNumber : "",
      aoPemsUsername: formData.aoActive ? aoPemsUsername : "",
      aoPemsPassword: formData.aoActive ? (formData.aoPemsPassword || "").trim() : "",
      aoToken: formData.aoActive ? aoToken : "",
      signature: formData.aoActive ? signature : "",
      isFumigator: formData.isFumigator,
      fumigationExpiry: formData.isFumigator ? formData.fumigationExpiry : "",
      fumigatorLicence: formData.isFumigator ? fumigatorLicence : "",
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
        {!isMobile ? <p className="mt-1 text-xs text-slate-500">Manage users, AO credentials, and fumigator details in one place.</p> : null}
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
              fileName="Users"
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
            <h2 className="text-sm font-semibold text-slate-900">User Details</h2>
            {!selected ? (
              <p className="mt-4 text-sm leading-relaxed text-slate-500">Select a user to view details.</p>
            ) : (
              <div className="mt-4 space-y-3 text-sm">
                <DetailItem label="Name" value={selected.name} highlight />
                <DetailItem label="Email" value={selected.email} />
                <DetailItem label="Role" value={selected.role || "—"} />
                <DetailItem label="Status" value={selected.status} />
                <DetailItem label="Weighbridge Access" value={selected.weighbridgeAccess ? "Yes" : "No"} />
                <DetailItem label="Packers Account Access" value={selected.packersAccountAccess ? "Yes" : "No"} />
                <DetailItem label="AO Active" value={selected.aoActive ? "Yes" : "No"} />
                {selected.aoActive ? (
                  <>
                    <DetailItem label="AO PEMS Username" value={selected.aoPemsUsername || "—"} />
                    <DetailItem label="AO Token" value={selected.aoToken ? "Configured" : "Not set"} />
                    <DetailItem label="AO Expiry" value={selected.aoExpiry || "—"} />
                    <DetailItem label="AO License Number" value={selected.aoLicenseNumber || "—"} />
                    <DetailItem label="Signature" value={selected.signature || "—"} />
                  </>
                ) : null}
                <DetailItem label="Fumigator" value={selected.isFumigator ? "Yes" : "No"} />
                {selected.isFumigator ? (
                  <>
                    <DetailItem label="Fumigator Licence" value={selected.fumigatorLicence || "—"} />
                    <DetailItem label="Fumigation Expiry" value={selected.fumigationExpiry || "—"} />
                  </>
                ) : null}
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

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editMode ? "Edit User" : "Add New User"} width={760}>
        <div className="space-y-5">
          <SectionTitle title="Basic Details" />
          <div className="grid gap-4">
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
          </div>

          <div className="grid gap-4">
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
          </div>

          <div className="grid gap-4">
            <ToggleField
              label="Weighbridge Access"
              checked={formData.weighbridgeAccess}
              onChange={(checked) => setFormData({ ...formData, weighbridgeAccess: checked })}
            />
            <ToggleField
              label="Packers Account Access"
              checked={formData.packersAccountAccess}
              onChange={(checked) => setFormData({ ...formData, packersAccountAccess: checked })}
            />
          </div>

          <div className="border-t border-slate-200 pt-4">
            <SectionTitle title="AO Details" />
            <ToggleField
              label="AO Active"
              checked={formData.aoActive}
              onChange={(checked) => setFormData({ ...formData, aoActive: checked })}
            />
            {formData.aoActive ? (
              <div className="mt-3 grid gap-4">
                <FormRow label="AO PEMs Username" required>
                  <Input
                    value={formData.aoPemsUsername}
                    onChange={(event) => setFormData({ ...formData, aoPemsUsername: event.target.value })}
                    placeholder="AO PEMs Username"
                  />
                </FormRow>
                <FormRow label="AO PEMs Password">
                  <Input
                    type="password"
                    value={formData.aoPemsPassword}
                    onChange={(event) => setFormData({ ...formData, aoPemsPassword: event.target.value })}
                    placeholder="AO PEMs Password"
                  />
                </FormRow>
                <FormRow label="AO Token" required>
                  <Input value={formData.aoToken} onChange={(event) => setFormData({ ...formData, aoToken: event.target.value })} placeholder="AO Token" />
                </FormRow>
                <FormRow label="AO Expiry">
                  <Input type="date" value={formData.aoExpiry} onChange={(event) => setFormData({ ...formData, aoExpiry: event.target.value })} />
                </FormRow>
                <FormRow label="AO License Number">
                  <Input
                    value={formData.aoLicenseNumber}
                    onChange={(event) => setFormData({ ...formData, aoLicenseNumber: event.target.value })}
                    placeholder="AO License Number"
                  />
                </FormRow>
                <FormRow label="Signature">
                  <Input value={formData.signature} onChange={(event) => setFormData({ ...formData, signature: event.target.value })} placeholder="Signature" />
                </FormRow>
              </div>
            ) : (
              <p className="mt-2 text-xs text-slate-500">Enable AO Active to capture AO credentials and license details.</p>
            )}
          </div>

          <div className="border-t border-slate-200 pt-4">
            <SectionTitle title="Fumigator Details" />
            <ToggleField
              label="Fumigator"
              checked={formData.isFumigator}
              onChange={(checked) => setFormData({ ...formData, isFumigator: checked })}
            />
            {formData.isFumigator ? (
              <div className="mt-3 grid gap-4">
                <FormRow label="Fumigator Licence" required>
                  <Input
                    value={formData.fumigatorLicence}
                    onChange={(event) => setFormData({ ...formData, fumigatorLicence: event.target.value })}
                    placeholder="Fumigator Licence"
                  />
                </FormRow>
                <FormRow label="Fumigation Expiry">
                  <Input
                    type="date"
                    value={formData.fumigationExpiry}
                    onChange={(event) => setFormData({ ...formData, fumigationExpiry: event.target.value })}
                  />
                </FormRow>
              </div>
            ) : (
              <p className="mt-2 text-xs text-slate-500">Enable Fumigator to record fumigator licence and expiry.</p>
            )}
          </div>

          {editMode ? (
            <div className="border-t border-slate-200 pt-4">
              <SectionTitle title="Security" />
              <div className="grid gap-4">
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
              </div>
            </div>
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
              <p className="mt-1 text-[11px] text-slate-500">
                AO: {row.aoActive ? "Yes" : "No"} | Fumigator: {row.isFumigator ? "Yes" : "No"}
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

function SectionTitle({ title }) {
  return <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-700">{title}</h3>;
}

function ToggleField({ label, checked, onChange }) {
  return (
    <label className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
      <span className="text-xs font-medium text-slate-700">{label}</span>
      <button
        type="button"
        aria-pressed={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          "inline-flex h-6 min-w-[58px] items-center justify-center rounded-full px-2 text-[11px] font-semibold transition-colors",
          checked ? "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-300" : "bg-slate-200 text-slate-600 ring-1 ring-slate-300"
        )}
      >
        {checked ? "Enabled" : "Disabled"}
      </button>
    </label>
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
