"use client";

import { useEffect, useMemo, useState } from "react";

import { readAuthPayload } from "@/lib/auth-session";
import { cn } from "@/lib/utils";

const MOBILE_BREAKPOINT = 900;

/**
 * Grouped display of the known permission catalogue, so we can show
 * a tidy grouped list rather than a flat dump.
 */
const PERMISSION_GROUPS = [
  {
    label: "Packing",
    permissions: [
      { name: "packing.schedule.view", description: "View packing schedule" },
      { name: "packing.pack.create", description: "Create packs" },
      { name: "packing.pack.update", description: "Update packs" },
      { name: "packing.container.view", description: "View containers" },
      { name: "packing.container.edit", description: "Edit containers" },
      { name: "packing.container.ao-signoff", description: "Record AO sign-off on containers / submit PEMs batches" },
    ],
  },
  {
    label: "Fumigation",
    permissions: [
      { name: "fumigation.records.view", description: "View fumigation records" },
      { name: "fumigation.records.signoff", description: "Sign off fumigation records" },
      { name: "fumigation.certificate.signoff", description: "Sign off fumigation certificates" },
      { name: "fumigation.masters.view", description: "View fumigation master data" },
    ],
  },
  {
    label: "Ticketing",
    permissions: [
      { name: "ticketing.tickets.view", description: "View tickets" },
      { name: "ticketing.tickets.create", description: "Create tickets" },
      { name: "ticketing.cmo.view", description: "View CMO data" },
    ],
  },
  {
    label: "Stock",
    permissions: [
      { name: "stock.view", description: "View stock management" },
    ],
  },
  {
    label: "Accounting",
    permissions: [
      { name: "accounting.view", description: "View accounting" },
    ],
  },
  {
    label: "Reports",
    permissions: [
      { name: "reports.view", description: "View reports" },
    ],
  },
  {
    label: "Reference & Settings",
    permissions: [
      { name: "reference-data.view", description: "View reference data" },
      { name: "contacts.view", description: "View contacts" },
      { name: "product-settings.view", description: "View product settings" },
    ],
  },
];

function readCurrentPermissions() {
  const payload = readAuthPayload();
  if (!payload) return null;
  const perms = payload.permissions;
  return Array.isArray(perms) ? perms : null;
}

export default function UserPermissionPage() {
  const [isMobile, setIsMobile] = useState(false);
  const [permissions, setPermissions] = useState(() => readCurrentPermissions());

  // Re-read on storage changes (e.g., re-login)
  useEffect(() => {
    function sync() {
      setPermissions(readCurrentPermissions());
    }
    window.addEventListener("storage", sync);
    window.addEventListener("auth-session-changed", sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("auth-session-changed", sync);
    };
  }, []);

  useEffect(() => {
    const query = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const handleMedia = () => setIsMobile(query.matches);
    handleMedia();
    query.addEventListener("change", handleMedia);
    return () => query.removeEventListener("change", handleMedia);
  }, []);

  const permSet = useMemo(() => new Set(permissions || []), [permissions]);
  const isAdmin = permissions === null;

  const totalGranted = isAdmin
    ? PERMISSION_GROUPS.reduce((sum, g) => sum + g.permissions.length, 0)
    : permissions.length;

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs text-slate-500">Contacts / User Permissions</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 md:text-[1.65rem]">My Permissions</h1>
        {!isMobile ? (
          <p className="mt-1 text-xs text-slate-500">
            Your effective permissions are derived from your assigned classifications and roles. To change them, ask an administrator to edit your user record.
          </p>
        ) : null}
      </div>

      <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm">
        {isAdmin ? (
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-200">
              Organisation / Site Administrator
            </span>
            <span className="text-sm text-slate-600">You hold all permissions.</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="rounded-full bg-brand/10 px-3 py-1 text-xs font-semibold text-brand ring-1 ring-brand/20">
              {totalGranted} permission{totalGranted !== 1 ? "s" : ""} granted
            </span>
            <span className="text-sm text-slate-500">
              Permissions are controlled by your classifications and roles — edit via the Users page.
            </span>
          </div>
        )}
      </div>

      <div className={cn("space-y-4", !isMobile && "grid gap-4 grid-cols-2 space-y-0")}>
        {PERMISSION_GROUPS.map((group) => {
          const grantedInGroup = group.permissions.filter(
            (p) => isAdmin || permSet.has(p.name)
          );
          return (
            <section
              key={group.label}
              className="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-sm"
            >
              <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-3 py-2">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-700">{group.label}</h2>
                <span className="text-[10px] font-semibold text-slate-500 tabular-nums">
                  {isAdmin ? group.permissions.length : grantedInGroup.length}/{group.permissions.length}
                </span>
              </div>
              <div className="divide-y divide-slate-100">
                {group.permissions.map((perm) => {
                  const granted = isAdmin || permSet.has(perm.name);
                  return (
                    <div
                      key={perm.name}
                      className={cn(
                        "flex items-start gap-3 px-3 py-2.5",
                        granted ? "bg-white" : "bg-slate-50/60"
                      )}
                    >
                      <span
                        className={cn(
                          "mt-0.5 size-4 shrink-0 rounded-full ring-1",
                          granted
                            ? "bg-emerald-400 ring-emerald-300"
                            : "bg-slate-200 ring-slate-300"
                        )}
                        aria-hidden
                      />
                      <div className="min-w-0 flex-1">
                        <p className={cn("text-xs font-semibold", granted ? "text-slate-800" : "text-slate-400")}>
                          {perm.description}
                        </p>
                        <p className={cn("mt-0.5 font-mono text-[10px]", granted ? "text-slate-500" : "text-slate-300")}>
                          {perm.name}
                        </p>
                      </div>
                      {granted ? (
                        <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[9px] font-semibold text-emerald-700 ring-1 ring-emerald-200">
                          Granted
                        </span>
                      ) : (
                        <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-semibold text-slate-400 ring-1 ring-slate-200">
                          Not granted
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
