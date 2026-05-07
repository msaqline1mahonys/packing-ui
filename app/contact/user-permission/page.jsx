"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { PACKING_NAV_MODULES } from "@/components/erp-navbar/packing-defaults";
import { USER_PERMISSION_USER_ROWS } from "@/lib/Data";
import { cn } from "@/lib/utils";

const MOBILE_BREAKPOINT = 900;
const inputClass =
  "w-full rounded-lg border border-slate-200/95 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-brand/15 placeholder:text-slate-400 focus:border-brand/35 focus:ring-2";

function slugify(text) {
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default function UserPermissionPage() {
  const permissionsList = useMemo(() => {
    const items = [];
    for (const module of PACKING_NAV_MODULES) {
      items.push({
        id: `module:${slugify(module.name)}`,
        label: module.name,
        description: `Access to ${module.name}.`,
      });
      for (const child of module.children ?? []) {
        items.push({
          id: `module:${slugify(module.name)}:${slugify(child.name)}`,
          label: child.name,
          description: `Access to ${module.name} / ${child.name}.`,
        });
      }
    }
    return items;
  }, []);

  const allPermissionIds = useMemo(() => permissionsList.map((permission) => permission.id), [permissionsList]);

  const [search, setSearch] = useState("");
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [selectedPermissions, setSelectedPermissions] = useState([]);
  const [hasChanges, setHasChanges] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const selectAllCheckboxRef = useRef(null);

  const [permissionsByUser, setPermissionsByUser] = useState(() => {
    const map = {};
    for (const user of USER_PERMISSION_USER_ROWS) {
      if (user.id === 1) {
        map[user.id] = [...allPermissionIds];
      } else if (user.id === 2) {
        map[user.id] = allPermissionIds.filter((id) => id.includes("packing-schedule") || id.includes("packers-schedule") || id.includes("ticketing"));
      } else {
        map[user.id] = [];
      }
    }
    return map;
  });

  useEffect(() => {
    const query = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const handleMedia = () => setIsMobile(query.matches);
    handleMedia();
    query.addEventListener("change", handleMedia);
    return () => query.removeEventListener("change", handleMedia);
  }, []);

  const filteredUsers = useMemo(() => {
    return USER_PERMISSION_USER_ROWS.filter((user) => {
      if (!search) return true;
      const text = `${user.name} ${user.email} ${user.role}`.toLowerCase();
      return text.includes(search.toLowerCase());
    });
  }, [search]);

  const selected = USER_PERMISSION_USER_ROWS.find((user) => user.id === selectedUserId) || null;

  function getUserPermissions(userId) {
    return permissionsByUser[userId] || [];
  }

  function handleUserSelect(userId) {
    setSelectedUserId(userId);
    setSelectedPermissions(getUserPermissions(userId));
    setHasChanges(false);
  }

  function handlePermissionToggle(permissionId) {
    const nextPermissions = selectedPermissions.includes(permissionId)
      ? selectedPermissions.filter((permission) => permission !== permissionId)
      : [...selectedPermissions, permissionId];
    setSelectedPermissions(nextPermissions);
    setHasChanges(true);
  }

  function handleSave() {
    if (!selectedUserId) return;
    setPermissionsByUser((prev) => ({ ...prev, [selectedUserId]: selectedPermissions }));
    setHasChanges(false);
  }

  function handleCancel() {
    if (!selectedUserId) return;
    setSelectedPermissions(getUserPermissions(selectedUserId));
    setHasChanges(false);
  }

  const allSelected = permissionsList.length > 0 && selectedPermissions.length === permissionsList.length;
  const someSelected = selectedPermissions.length > 0;
  const isIndeterminate = someSelected && !allSelected;

  function handleSelectAll() {
    if (allSelected) {
      setSelectedPermissions([]);
    } else {
      setSelectedPermissions([...allPermissionIds]);
    }
    setHasChanges(true);
  }

  useEffect(() => {
    const element = selectAllCheckboxRef.current;
    if (element) element.indeterminate = isIndeterminate;
  }, [isIndeterminate]);

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs text-slate-500">Contacts / User Permissions</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 md:text-[1.65rem]">User Permissions</h1>
      </div>

      {isMobile ? (
        <div className="space-y-3">
          <section className="rounded-xl border border-slate-200/90 bg-white p-3 shadow-sm">
            <input className={inputClass} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search users..." />
          </section>

          <section className="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-sm">
            <div className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600">Users ({filteredUsers.length})</div>
            <div className="max-h-[260px] space-y-2 overflow-y-auto p-2">
              {filteredUsers.length === 0 ? (
                <div className="py-8 text-center text-sm text-slate-400">{search ? "No users match your search." : "No users found."}</div>
              ) : (
                filteredUsers.map((user) => {
                  const count = getUserPermissions(user.id).length;
                  const active = user.id === selectedUserId;
                  return (
                    <button
                      key={user.id}
                      type="button"
                      onClick={() => handleUserSelect(user.id)}
                      className={cn(
                        "w-full rounded-xl border-2 px-3 py-3 text-left transition-colors",
                        active ? "border-blue-500 bg-blue-50" : "border-slate-200 bg-white"
                      )}
                    >
                      <p className="text-sm font-semibold text-slate-800">{user.name}</p>
                      <p className="mt-1 text-xs text-slate-600">
                        {count} permission{count !== 1 ? "s" : ""}
                        {user.role ? ` - ${user.role}` : ""}
                      </p>
                    </button>
                  );
                })
              )}
            </div>
          </section>

          {selected ? (
            <section className="space-y-3 rounded-xl border border-slate-200/90 bg-white p-3 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">{selected.name}</h3>
                  <p className="text-xs text-slate-500">
                    {selected.email} - {selected.role || "No role"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {hasChanges ? <span className="rounded bg-amber-100 px-2 py-1 text-[10px] font-semibold text-amber-700">Unsaved</span> : null}
                  <BtnPrimary type="button" disabled={!hasChanges} onClick={handleSave}>
                    Save
                  </BtnPrimary>
                  <BtnSecondary type="button" disabled={!hasChanges} onClick={handleCancel}>
                    Cancel
                  </BtnSecondary>
                </div>
              </div>

              <button
                type="button"
                onClick={handleSelectAll}
                className={cn(
                  "flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left",
                  allSelected ? "border-blue-200 bg-blue-50" : "border-slate-200 bg-slate-50"
                )}
              >
                <input ref={selectAllCheckboxRef} type="checkbox" checked={allSelected} onChange={() => {}} />
                <span className="text-sm font-semibold text-slate-800">Select all</span>
              </button>

              <div className="max-h-[320px] space-y-2 overflow-y-auto">
                {permissionsList.map((permission) => {
                  const checked = selectedPermissions.includes(permission.id);
                  return (
                    <button
                      key={permission.id}
                      type="button"
                      onClick={() => handlePermissionToggle(permission.id)}
                      className={cn(
                        "flex w-full items-start gap-3 rounded-lg border p-3 text-left",
                        checked ? "border-blue-200 bg-blue-50" : "border-slate-200 bg-white"
                      )}
                    >
                      <input type="checkbox" checked={checked} onChange={() => {}} className="mt-0.5" />
                      <span>
                        <span className="block text-sm font-semibold text-slate-800">{permission.label}</span>
                        <span className="block text-xs text-slate-500">{permission.description}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          ) : (
            <section className="rounded-xl border border-slate-200/90 bg-white p-8 text-center text-sm text-slate-400 shadow-sm">
              Select a user above to manage their permissions
            </section>
          )}
        </div>
      ) : (
        <div className="grid min-h-[560px] gap-4 lg:grid-cols-[380px_minmax(0,1fr)]">
          <section className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-sm">
            <div className="border-b border-slate-200 p-3">
              <input className={inputClass} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search users..." />
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-2">
              {filteredUsers.length === 0 ? (
                <div className="py-10 text-center text-sm text-slate-400">{search ? "No users match your search." : "No users found."}</div>
              ) : (
                filteredUsers.map((user) => {
                  const count = getUserPermissions(user.id).length;
                  const active = user.id === selectedUserId;
                  return (
                    <button
                      key={user.id}
                      type="button"
                      onClick={() => handleUserSelect(user.id)}
                      className={cn(
                        "mb-2 w-full rounded-xl border-2 px-3 py-3 text-left transition-colors",
                        active ? "border-blue-500 bg-blue-50" : "border-slate-200 bg-white hover:bg-slate-50"
                      )}
                    >
                      <p className="text-sm font-semibold text-slate-800">{user.name}</p>
                      <p className="mt-1 text-xs text-slate-600">
                        {count} permission{count !== 1 ? "s" : ""}
                        {user.role ? ` - ${user.role}` : ""}
                      </p>
                    </button>
                  );
                })
              )}
            </div>
          </section>

          <section className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm">
            {selected ? (
              <>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b-2 border-slate-200 pb-3">
                  <div>
                    <h3 className="text-base font-semibold text-slate-900">{selected.name}</h3>
                    <p className="text-xs text-slate-500">
                      {selected.email} - {selected.role || "No role"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {hasChanges ? <span className="rounded bg-amber-100 px-2 py-1 text-[11px] font-semibold text-amber-700">Unsaved Changes</span> : null}
                    <BtnPrimary type="button" disabled={!hasChanges} onClick={handleSave}>
                      Save Changes
                    </BtnPrimary>
                    <BtnSecondary type="button" disabled={!hasChanges} onClick={handleCancel}>
                      Cancel
                    </BtnSecondary>
                  </div>
                </div>

                <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Permissions</div>

                <button
                  type="button"
                  onClick={handleSelectAll}
                  className={cn(
                    "mb-3 flex items-center gap-2 rounded-lg border px-3 py-2 text-left",
                    allSelected ? "border-blue-200 bg-blue-50" : "border-slate-200 bg-slate-50"
                  )}
                >
                  <input ref={selectAllCheckboxRef} type="checkbox" checked={allSelected} onChange={() => {}} />
                  <span className="text-sm font-semibold text-slate-800">Select all</span>
                </button>

                <div className="min-h-0 flex-1 space-y-2 overflow-y-auto">
                  {permissionsList.map((permission) => {
                    const checked = selectedPermissions.includes(permission.id);
                    return (
                      <button
                        key={permission.id}
                        type="button"
                        onClick={() => handlePermissionToggle(permission.id)}
                        className={cn(
                          "flex w-full items-start gap-3 rounded-lg border p-3 text-left",
                          checked ? "border-blue-200 bg-blue-50" : "border-slate-200 bg-white hover:bg-slate-50"
                        )}
                      >
                        <input type="checkbox" checked={checked} onChange={() => {}} className="mt-0.5" />
                        <span>
                          <span className="block text-sm font-semibold text-slate-800">{permission.label}</span>
                          <span className="block text-xs text-slate-500">{permission.description}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="grid min-h-full place-content-center text-center text-sm text-slate-400">Select a user to manage their permissions</div>
            )}
          </section>
        </div>
      )}
    </div>
  );
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
