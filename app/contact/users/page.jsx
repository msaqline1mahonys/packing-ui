"use client";

import { useCallback, useEffect, useState } from "react";

import { Grid } from "@/components/clutch-table";
import { saveContactUsers, loadDomainData, saveDomainData } from "@/lib/contact-users-store";
import { useInvalidateReferenceData } from "@/lib/hooks/use-reference-data-queries";
import { cn } from "@/lib/utils";
import {
  ALL_CLASSIFICATIONS,
  CLASSIFICATION_LABELS,
  USER_CLASSIFICATIONS,
  classificationsFromLegacyUser,
  legacyFlagsFromClassifications,
  normalizeClassifications,
} from "@/lib/user-classifications";
import { fetchApiUsers, createApiUser, updateApiUser, fetchOrgSites } from "@/lib/users-api";
import { notifyAuthSessionChanged, readAuthPayload } from "@/lib/auth-session";
import { refreshAuthPayload } from "@/lib/site-switch";

const MOBILE_BREAKPOINT = 900;
const inputClass =
  "w-full rounded-lg border border-slate-200/95 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-brand/15 placeholder:text-slate-400 focus:border-brand/35 focus:ring-2";

/**
 * Map classification key -> role display_name as used by the backend.
 */
const CLASSIFICATION_ROLE_NAME = {
  [USER_CLASSIFICATIONS.PACKER]: "Packer",
  [USER_CLASSIFICATIONS.AUTHORISED_OFFICER]: "Authorised Officer",
  [USER_CLASSIFICATIONS.FUMIGATOR]: "Fumigator",
  [USER_CLASSIFICATIONS.WEIGHBRIDGE]: "Weighbridge Operator",
  [USER_CLASSIFICATIONS.SITE_ADMIN]: "Site Admin",
  [USER_CLASSIFICATIONS.ORG_ADMIN]: "Org Admin",
};

// Role IDs are UUIDs — used to drop stale/garbage dropdown role IDs before send.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Given a user's assigned roles, derive which classification keys are active.
 */
function classificationsFromRoles(roles) {
  if (!Array.isArray(roles) || !roles.length) return [];
  const nameToClassification = Object.fromEntries(
    Object.entries(CLASSIFICATION_ROLE_NAME).map(([cls, roleName]) => [roleName, cls])
  );
  const result = new Set();
  for (const role of roles) {
    const displayName = role.display_name || role.name || "";
    const name = String(role.name || "");
    if (nameToClassification[displayName]) result.add(nameToClassification[displayName]);
    // Admin roles have config-driven display_names, so detect them by name pattern.
    if (name.startsWith("admin_")) result.add(USER_CLASSIFICATIONS.SITE_ADMIN);
    if (name.startsWith("org_admin_") || displayName === "Organization Admin") {
      result.add(USER_CLASSIFICATIONS.ORG_ADMIN);
    }
  }
  return Array.from(result);
}

const columns = [
  { key: "name", label: "Name" },
  { key: "weighbridgeAccessLabel", label: "Weighbridge" },
  { key: "packersAccountAccessLabel", label: "Packers Acc" },
  { key: "status", label: "Status" },
  { key: "aoActiveLabel", label: "AO Active" },
  { key: "aoExpiryLabel", label: "AO Expiry" },
  { key: "aoNumberLabel", label: "AO Number" },
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

function toDisplayRow(row) {
  return {
    ...row,
    status: row.active ? "Active" : "Inactive",
    weighbridgeAccessLabel: row.weighbridgeAccess ? "Yes" : "No",
    packersAccountAccessLabel: row.packersAccountAccess ? "Yes" : "No",
    aoActiveLabel: row.aoActive ? "Yes" : "No",
    aoExpiryLabel: row.aoExpiry || "—",
    aoNumberLabel: row.aoNumber || "—",
    aoLicenseNumberLabel: row.aoLicenseNumber || "—",
    aoPemsPasswordLabel: row.aoPemsPassword ? "········" : "—",
  };
}

function buildFormData(row, apiUserRaw) {
  if (!row) {
    return {
      name: "",
      email: "",
      role: "",
      roleIds: [],
      siteIds: [],
      active: true,
      userClassifications: [],
      aoExpiry: "",
      aoNumber: "",
      aoLicenseNumber: "",
      aoPemsUsername: "",
      aoPemsPassword: "",
      aoToken: "",
      signature: "",
      fumigationExpiry: "",
      fumigatorLicence: "",
      newPassword: "",
      confirmPassword: "",
    };
  }

  // Hydrate classifications from roles when the raw API user is provided
  const userClassifications =
    apiUserRaw?.roles?.length
      ? classificationsFromRoles(apiUserRaw.roles)
      : classificationsFromLegacyUser(row);

  // Hydrate credential fields from user.profile when available, else fall back
  // to the localStorage domain store values already merged into `row`.
  const profile = apiUserRaw?.profile || {};

  return {
    name: row.name || "",
    email: row.email || "",
    role: row.role || "",
    roleIds: row.roleIds || [],
    siteIds: row.siteIds || [],
    active: row.active !== false,
    userClassifications,
    aoExpiry: profile.ao_expiry ?? profile.aoExpiry ?? row.aoExpiry ?? "",
    aoNumber: profile.ao_number ?? profile.aoNumber ?? row.aoNumber ?? "",
    aoLicenseNumber: profile.ao_license_number ?? profile.aoLicenseNumber ?? row.aoLicenseNumber ?? "",
    aoPemsUsername: profile.ao_pems_username ?? profile.aoPemsUsername ?? row.aoPemsUsername ?? "",
    aoPemsPassword: "",  // always blank on open for security
    aoToken: "",          // always blank on open for security
    signature: profile.signature ?? row.signature ?? "",
    fumigationExpiry: profile.fumigation_expiry ?? profile.fumigationExpiry ?? row.fumigationExpiry ?? "",
    fumigatorLicence: profile.fumigator_licence ?? profile.fumigatorLicence ?? row.fumigatorLicence ?? "",
    newPassword: "",
    confirmPassword: "",
  };
}

function hasClassification(formData, classification) {
  return normalizeClassifications(formData?.userClassifications).includes(classification);
}

export default function ContactUsersPage() {
  const invalidateReferenceData = useInvalidateReferenceData();

  const [rows, setRows] = useState([]);
  // Keep raw API users so we can read user.profile and roles on edit
  const [rawApiUsers, setRawApiUsers] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState(() => buildFormData());
  const [isMobile, setIsMobile] = useState(false);
  const [showGoToTop, setShowGoToTop] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [apiError, setApiError] = useState("");
  const [orgSites, setOrgSites] = useState([]);

  const loadUsers = useCallback(async () => {
    try {
      setLoading(true);
      setApiError("");
      const [apiUsers, sites] = await Promise.all([fetchApiUsers(), fetchOrgSites()]);
      const domainStore = loadDomainData();
      const merged = apiUsers.map((u) => {
        const domain = domainStore[u.id] || {};
        // Derive classifications from roles (backend source of truth) with domain fallback
        const classFromRoles = classificationsFromRoles(u.roles || []);
        const userClassifications = classFromRoles.length ? classFromRoles : (domain.userClassifications || []);
        // Org admins are identified by user_type, not just by role rows.
        if ((u.user_type === "admin") && !userClassifications.includes(USER_CLASSIFICATIONS.ORG_ADMIN)) {
          userClassifications.push(USER_CLASSIFICATIONS.ORG_ADMIN);
        }
        const legacy = legacyFlagsFromClassifications(userClassifications);
        return toDisplayRow({
          id: u.id,
          name: u.name || "",
          email: u.email || "",
          // Merge domain fields (localStorage) but prefer profile fields from API
          ...domain,
          // Override with profile data from backend when present
          ...(u.profile ? {
            signature: u.profile.signature ?? domain.signature ?? "",
            aoActive: u.profile.ao_active ?? legacy.aoActive,
            aoExpiry: u.profile.ao_expiry ?? u.profile.aoExpiry ?? domain.aoExpiry ?? "",
            aoNumber: u.profile.ao_number ?? u.profile.aoNumber ?? domain.aoNumber ?? "",
            aoLicenseNumber: u.profile.ao_license_number ?? u.profile.aoLicenseNumber ?? domain.aoLicenseNumber ?? "",
            aoPemsUsername: u.profile.ao_pems_username ?? u.profile.aoPemsUsername ?? domain.aoPemsUsername ?? "",
            fumigatorLicence: u.profile.fumigator_licence ?? u.profile.fumigatorLicence ?? domain.fumigatorLicence ?? "",
            fumigationExpiry: u.profile.fumigation_expiry ?? u.profile.fumigationExpiry ?? domain.fumigationExpiry ?? "",
          } : {}),
          userClassifications,
          ...legacy,
          // Authoritative identity from the backend — placed AFTER the domain
          // spread so stale localStorage values can never override it.
          role: u.roles?.[0]?.display_name || u.roles?.[0]?.name || "",
          roleIds: (u.roles || []).map((r) => r.id),
          siteIds: (u.accessible_sites ?? u.accessibleSites ?? []).map((s) => String(s.id)),
          active: u.is_active !== false,
          userType: u.user_type ?? u.userType ?? "user",
        });
      });
      setRows(merged);
      setRawApiUsers(apiUsers);
      setOrgSites(sites);
      saveContactUsers(merged);
    } catch (err) {
      setApiError(err.message || "Failed to load users.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

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
    const base = buildFormData();
    // Default new users to the caller's current site for convenience.
    const currentSiteId = readAuthPayload()?.current_site?.id;
    if (currentSiteId && orgSites.some((s) => String(s.id) === String(currentSiteId))) {
      base.siteIds = [String(currentSiteId)];
    }
    setFormData(base);
    setModalOpen(true);
  }

  function openEditModal() {
    if (!selected) return;
    setEditMode(true);
    const rawUser = rawApiUsers.find((u) => u.id === selected.id) || null;
    setFormData(buildFormData(selected, rawUser));
    setModalOpen(true);
  }

  async function handleSubmit() {
    if (!formData.name.trim() || !formData.email.trim()) return;
    const nextPassword = (formData.newPassword || "").trim();
    const confirmPassword = (formData.confirmPassword || "").trim();
    const aoPemsUsername = (formData.aoPemsUsername || "").trim();
    const aoToken = (formData.aoToken || "").trim();
    const aoNumber = (formData.aoNumber || "").trim();
    const aoLicenseNumber = (formData.aoLicenseNumber || "").trim();
    const signature = (formData.signature || "").trim();
    const fumigatorLicence = (formData.fumigatorLicence || "").trim();

    if (editMode) {
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
    } else {
      if (!nextPassword) {
        window.alert("Password is required for new users.");
        return;
      }
      if (nextPassword.length < 8) {
        window.alert("Password must be at least 8 characters.");
        return;
      }
      if (nextPassword !== confirmPassword) {
        window.alert("Password confirmation does not match.");
        return;
      }
    }

    const userClassifications = normalizeClassifications(formData.userClassifications);
    const legacy = legacyFlagsFromClassifications(userClassifications);
    const isAo = legacy.aoActive;
    const isFumigator = legacy.isFumigator;

    // Classifications are sent as backend role display_names; the server resolves
    // the matching site-scoped role for EACH selected site.
    const classificationNames = userClassifications
      .map((c) => CLASSIFICATION_ROLE_NAME[c])
      .filter(Boolean);

    // Any role explicitly picked in the dropdown (applies to its own site).
    const dropdownRoleIds = (formData.roleIds || []).filter((id) => UUID_RE.test(id));

    // Sites this user gets access to (multi-site).
    const siteIds = (formData.siteIds || []).map((id) => String(id)).filter(Boolean);
    // Org Admin is org-wide — the backend grants every site, so no site pick needed.
    const isOrgAdmin = classificationNames.includes("Org Admin");

    if (!isOrgAdmin && siteIds.length === 0) {
      window.alert("Select at least one site for the user.");
      return;
    }
    if (classificationNames.length === 0 && dropdownRoleIds.length === 0) {
      window.alert("Please select at least one classification or role for the user.");
      return;
    }

    const isActivatingAo = isAo && (!editMode || !selected || !selected.aoActive);

    if (isAo && !aoPemsUsername) {
      window.alert("AO PEMS Username is required for Authorised Officer classification.");
      return;
    }

    if (isActivatingAo && !aoToken) {
      window.alert("AO Token is required when enabling Authorised Officer.");
      return;
    }

    if (isFumigator && !fumigatorLicence) {
      window.alert("Fumigator Licence is required for Fumigator classification.");
      return;
    }

    setSaving(true);
    setApiError("");

    // Profile data block (snake_case) for the backend
    const profileData = {
      signature,
      ao_number: isAo ? aoNumber : "",
      ao_license_number: isAo ? aoLicenseNumber : "",
      ao_expiry: isAo ? (formData.aoExpiry || null) : null,
      ao_pems_username: isAo ? aoPemsUsername : "",
      ao_pems_password: isAo ? (formData.aoPemsPassword || "").trim() : "",
      ao_token: isAo ? aoToken : "",
      fumigator_licence: isFumigator ? fumigatorLicence : "",
      fumigation_expiry: isFumigator ? (formData.fumigationExpiry || null) : null,
    };

    try {
      let userId;

      if (editMode && selected) {
        const updateData = {
          name: formData.name.trim(),
          email: formData.email.trim(),
          roles: dropdownRoleIds,
          classifications: classificationNames,
          site_ids: siteIds,
          is_active: formData.active,
          isAo,
          isFumigator,
          profileData,
        };
        if (nextPassword) updateData.password = nextPassword;
        await updateApiUser(selected.id, updateData);
        userId = selected.id;
      } else {
        const created = await createApiUser({
          name: formData.name.trim(),
          email: formData.email.trim(),
          password: nextPassword,
          roles: dropdownRoleIds,
          classifications: classificationNames,
          siteIds,
          isActive: formData.active,
          isAo,
          isFumigator,
          profileData,
        });
        userId = created.id;
      }

      // Belt-and-braces: also write to localStorage domain store
      const domainData = {
        userClassifications,
        weighbridgeAccess: legacy.weighbridgeAccess,
        packersAccountAccess: legacy.packersAccountAccess,
        aoActive: legacy.aoActive,
        aoExpiry: isAo ? formData.aoExpiry : "",
        aoNumber: isAo ? aoNumber : "",
        aoLicenseNumber: isAo ? aoLicenseNumber : "",
        aoPemsUsername: isAo ? aoPemsUsername : "",
        aoPemsPassword: isAo ? (formData.aoPemsPassword || "").trim() : "",
        aoToken: isAo ? aoToken : "",
        signature,
        isFumigator,
        fumigationExpiry: isFumigator ? formData.fumigationExpiry : "",
        fumigatorLicence: isFumigator ? fumigatorLicence : "",
        passwordUpdatedAt: nextPassword ? new Date().toISOString() : (selected?.passwordUpdatedAt || ""),
      };

      const allDomain = loadDomainData();
      allDomain[userId] = domainData;
      saveDomainData(allDomain);

      // Navbar site dropdown reads from cached login payload — refresh when the
      // signed-in user edits their own site memberships.
      const auth = readAuthPayload();
      const authUserId = auth?.user?.id != null ? String(auth.user.id) : "";
      const authEmail = typeof auth?.user?.email === "string" ? auth.user.email.trim().toLowerCase() : "";
      if (authUserId === String(userId) || authEmail === formData.email.trim().toLowerCase()) {
        try {
          await refreshAuthPayload();
          notifyAuthSessionChanged();
        } catch {
          // Non-fatal — user can log out/in to pick up site changes.
        }
      }

      setModalOpen(false);
      setFormData(buildFormData());
      await loadUsers();
      setSelectedId(userId);
      await invalidateReferenceData("users");
    } catch (err) {
      window.alert(err.message || "Failed to save user.");
    } finally {
      setSaving(false);
    }
  }

  const PROTECTED_USER_TYPES = ["admin", "super_admin", "developer", "support"];

  async function toggleSelectedActive() {
    if (!selected) return;
    const isProtected = PROTECTED_USER_TYPES.includes(selected.userType);
    // Users are never deleted — only deactivated. Org admins can't be deactivated.
    if (selected.active && isProtected) {
      window.alert("Organization admin users cannot be made inactive.");
      return;
    }
    const nextActive = !selected.active;
    const verb = nextActive ? "Reactivate" : "Deactivate";
    if (!window.confirm(`${verb} user "${selected.name}"?`)) return;
    try {
      setSaving(true);
      await updateApiUser(selected.id, { is_active: nextActive });
      await loadUsers();
      await invalidateReferenceData("users");
    } catch (err) {
      window.alert(err.message || `Failed to ${verb.toLowerCase()} user.`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs text-slate-500">Contacts / Users</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 md:text-[1.65rem]">Users</h1>
        {!isMobile ? <p className="mt-1 text-xs text-slate-500">Manage users, AO credentials, and fumigator details in one place.</p> : null}
      </div>

      {apiError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{apiError}</div>
      ) : null}

      {loading ? (
        <div className="py-16 text-center text-sm text-slate-400">Loading users...</div>
      ) : (
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
              onPersistedRowActivate={(row) => setSelectedId(row.id)}
              toolbarActions={
                <div className="flex flex-wrap gap-2">
                  <BtnPrimary type="button" onClick={openCreateModal}>+ Add</BtnPrimary>
                  <BtnSecondary type="button" disabled={!selected} onClick={openEditModal}>Edit</BtnSecondary>
                  {selected && !selected.active ? (
                    <BtnSecondary type="button" onClick={toggleSelectedActive}>Activate</BtnSecondary>
                  ) : (
                    <BtnDanger
                      type="button"
                      disabled={!selected || PROTECTED_USER_TYPES.includes(selected?.userType)}
                      onClick={toggleSelectedActive}
                    >
                      Deactivate
                    </BtnDanger>
                  )}
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
                <DetailItem label="Classifications" value={(classificationsFromLegacyUser(selected).map((c) => CLASSIFICATION_LABELS[c]).join(", ")) || "—"} />
                <DetailItem label="Weighbridge Access" value={selected.weighbridgeAccess ? "Yes" : "No"} />
                <DetailItem label="Packers Account Access" value={selected.packersAccountAccess ? "Yes" : "No"} />
                <DetailItem label="AO Active" value={selected.aoActive ? "Yes" : "No"} />
                <DetailItem label="Signature" value={selected.signature || "—"} />
                {selected.aoActive ? (
                  <>
                    <DetailItem label="AO PEMS Username" value={selected.aoPemsUsername || "—"} />
                    <DetailItem label="AO Token" value={selected.aoToken ? "Configured" : "Not set"} />
                    <DetailItem label="AO Expiry" value={selected.aoExpiry || "—"} />
                    <DetailItem label="AO Number" value={selected.aoNumber || "—"} />
                    <DetailItem label="AO License Number" value={selected.aoLicenseNumber || "—"} />
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
                  {selected && !selected.active ? (
                    <BtnSecondary type="button" className="flex-1 justify-center" onClick={toggleSelectedActive}>
                      Activate User
                    </BtnSecondary>
                  ) : (
                    <BtnDanger
                      type="button"
                      className="flex-1 justify-center"
                      disabled={PROTECTED_USER_TYPES.includes(selected?.userType)}
                      onClick={toggleSelectedActive}
                    >
                      Deactivate User
                    </BtnDanger>
                  )}
                </div>
              </div>
            )}
          </aside>
        ) : null}
      </div>
      )}

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
            <FormRow label="Sites (access)">
              <div className="flex flex-wrap gap-2">
                {orgSites.length === 0 ? (
                  <span className="text-xs text-slate-400">No sites available</span>
                ) : (
                  orgSites.map((s) => {
                    const siteId = String(s.id);
                    const selected = (formData.siteIds || []).map((id) => String(id));
                    const on = selected.includes(siteId);
                    return (
                      <button
                        key={siteId}
                        type="button"
                        onClick={() => {
                          const set = new Set(selected);
                          if (set.has(siteId)) set.delete(siteId);
                          else set.add(siteId);
                          setFormData({ ...formData, siteIds: Array.from(set) });
                        }}
                        className={cn(
                          "rounded-full border px-3 py-1 text-xs transition",
                          on
                            ? "border-brand bg-brand/10 text-brand"
                            : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                        )}
                      >
                        {s.name || s.code || s.id}
                      </button>
                    );
                  })
                )}
              </div>
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

            <FormRow label="Signature">
              <Input
                value={formData.signature}
                onChange={(event) => setFormData({ ...formData, signature: event.target.value })}
                placeholder="Type user signature or signing name"
              />
            </FormRow>
          </div>

          <div className="border-t border-slate-200 pt-4">
            <SectionTitle title="User Classifications" />
            <p className="mb-3 text-xs text-slate-500">Select all roles that apply. Classification toggles map directly to site roles on save.</p>
            <ClassificationPicker
              value={formData.userClassifications}
              onChange={(userClassifications) => setFormData({ ...formData, userClassifications })}
            />
          </div>

          <div className="border-t border-slate-200 pt-4">
            <SectionTitle title="Authorised Officer (PEMS)" />
            {hasClassification(formData, USER_CLASSIFICATIONS.AUTHORISED_OFFICER) ? (
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
                <FormRow label="AO Number">
                  <Input
                    value={formData.aoNumber}
                    onChange={(event) => setFormData({ ...formData, aoNumber: event.target.value })}
                    placeholder="AO Number"
                  />
                </FormRow>
                <FormRow label="AO License Number">
                  <Input
                    value={formData.aoLicenseNumber}
                    onChange={(event) => setFormData({ ...formData, aoLicenseNumber: event.target.value })}
                    placeholder="AO License Number"
                  />
                </FormRow>
              </div>
            ) : (
              <p className="mt-2 text-xs text-slate-500">Add the Authorised Officer classification to capture PEMS AO credentials.</p>
            )}
          </div>

          <div className="border-t border-slate-200 pt-4">
            <SectionTitle title="Fumigator" />
            {hasClassification(formData, USER_CLASSIFICATIONS.FUMIGATOR) ? (
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
              <p className="mt-2 text-xs text-slate-500">Add the Fumigator classification to record licence and expiry.</p>
            )}
          </div>

          <div className="border-t border-slate-200 pt-4">
            <SectionTitle title="Security" />
            <div className="grid gap-4">
              <FormRow label={editMode ? "New Password" : "Password"} required={!editMode}>
                <Input
                  type="password"
                  value={formData.newPassword}
                  onChange={(event) => setFormData({ ...formData, newPassword: event.target.value })}
                  placeholder={editMode ? "Leave blank to keep current password" : "Enter password (min 8 characters)"}
                />
              </FormRow>
              <FormRow label="Confirm Password" required={!editMode}>
                <Input
                  type="password"
                  value={formData.confirmPassword}
                  onChange={(event) => setFormData({ ...formData, confirmPassword: event.target.value })}
                  placeholder="Re-enter password"
                />
              </FormRow>
            </div>
          </div>
        </div>

        <div className="mt-5 flex gap-2 border-t border-slate-200 pt-4">
          <BtnPrimary type="button" className="flex-1 justify-center" disabled={saving} onClick={handleSubmit}>
            {saving ? "Saving..." : editMode ? "Update User" : "Add User"}
          </BtnPrimary>
          <BtnSecondary type="button" className="flex-1 justify-center" disabled={saving} onClick={() => setModalOpen(false)}>
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

function ClassificationPicker({ value, onChange }) {
  const selected = new Set(normalizeClassifications(value));
  function toggle(classification) {
    const next = new Set(selected);
    if (next.has(classification)) next.delete(classification);
    else next.add(classification);
    onChange(ALL_CLASSIFICATIONS.filter((c) => next.has(c)));
  }
  return (
    <div className="flex flex-wrap gap-2">
      {ALL_CLASSIFICATIONS.map((classification) => {
        const active = selected.has(classification);
        return (
          <button
            key={classification}
            type="button"
            onClick={() => toggle(classification)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-semibold transition-colors",
              active ? "border-brand bg-brand/10 text-brand" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            )}
          >
            {CLASSIFICATION_LABELS[classification]}
          </button>
        );
      })}
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
