"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { Grid } from "@/components/clutch-table";
import ClutchSelect from "@/components/custom/ClutchSelect";
import { Button } from "@/components/ui/button";
import { notifyAuthSessionChanged } from "@/lib/auth-session";
import { refreshAuthPayload } from "@/lib/site-switch";
import { cn } from "@/lib/utils";
import { numberInputProps } from "@/lib/number-input";

const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api"
).replace(/\/+$/, "");
const SITES_ENDPOINT = `${API_BASE_URL}/sites`;

const inputClass =
  "w-full rounded-lg border border-slate-200/95 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-brand/15 placeholder:text-slate-400 focus:border-brand/35 focus:ring-2";

const STATE_OPTIONS = [
  { value: "", label: "Select state…" },
  { value: "VIC", label: "VIC" },
  { value: "NSW", label: "NSW" },
  { value: "QLD", label: "QLD" },
  { value: "SA", label: "SA" },
  { value: "WA", label: "WA" },
  { value: "TAS", label: "TAS" },
  { value: "NT", label: "NT" },
  { value: "ACT", label: "ACT" },
];

const STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
];

const HEAD_OFFICE_OPTIONS = [
  { value: "false", label: "No" },
  { value: "true", label: "Yes" },
];

const gridColumns = [
  { key: "name", header: "Site Name", type: "text", sortable: true, filterable: true, resizable: true },
  { key: "code", header: "Code", type: "text", sortable: true, filterable: true, resizable: true },
  {
    key: "status",
    header: "Status",
    type: "text",
    sortable: true,
    filterable: true,
    resizable: true,
    renderCell: ({ value }) => {
      const isActive = (value || "").toLowerCase() === "active";
      return (
        <span
          className={cn(
            "inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize",
            isActive
              ? "bg-emerald-50 text-emerald-900 ring-1 ring-emerald-200"
              : "bg-slate-100 text-slate-700 ring-1 ring-slate-200"
          )}
        >
          {value || "—"}
        </span>
      );
    },
  },
  { key: "email", header: "Email", type: "text", sortable: true, filterable: true, resizable: true },
  { key: "phone", header: "Phone", type: "text", sortable: true, filterable: true, resizable: true },
  { key: "treatmentProviderId", header: "Treatment Provider ID", type: "text", sortable: true, filterable: true, resizable: true },
  {
    key: "isHeadOffice",
    header: "Head Office",
    type: "text",
    sortable: true,
    filterable: true,
    resizable: true,
    renderCell: ({ value }) => (
      <span
        className={cn(
          "inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold",
          value === true
            ? "bg-blue-50 text-blue-800 ring-1 ring-blue-200"
            : "bg-slate-50 text-slate-500 ring-1 ring-slate-200"
        )}
      >
        {value === true ? "Yes" : "No"}
      </span>
    ),
  },
];

const detailFields = [
  { key: "name", label: "Site Name" },
  { key: "code", label: "Code" },
  { key: "status", label: "Status" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
  { key: "address", label: "Address" },
  { key: "treatmentProviderId", label: "Treatment Provider ID" },
  { key: "isHeadOffice", label: "Head Office", format: (v) => (v === true ? "Yes" : "No") },
  { key: "establishmentNumber", label: "Establishment Number" },
  { key: "yardId", label: "Yard ID" },
  { key: "addressLine1", label: "Address Line 1" },
  { key: "addressLine2", label: "Address Line 2" },
  { key: "suburb", label: "Suburb" },
  { key: "stateCode", label: "State" },
  { key: "postcode", label: "Postcode" },
  { key: "ticketInPrefix", label: "Incoming Ticket Prefix" },
  { key: "ticketOutPrefix", label: "Outgoing Ticket Prefix" },
];

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
  };
}

function extractApiError(result, fallback) {
  if (result?.errors) return Object.values(result.errors).flat().join(", ");
  return result?.message || fallback;
}

async function siteRequest(path = "", options = {}) {
  const headers = { ...getAuthHeaders(), ...(options.headers || {}) };
  if (options.body instanceof FormData) {
    delete headers["Content-Type"];
  }
  const response = await fetch(`${SITES_ENDPOINT}${path}`, {
    ...options,
    headers,
  });
  const result = await response.json().catch(() => null);
  if (!response.ok) throw new Error(extractApiError(result, "Site request failed."));
  return result;
}

function appendFormPayload(form, payload) {
  Object.entries(payload).forEach(([key, value]) => {
    if (value == null) return;
    if (typeof value === "boolean") {
      form.append(key, value ? "1" : "0");
      return;
    }
    if (value === "") return;
    form.append(key, String(value));
  });
}

function buildSiteSaveBody(draft) {
  if (draft.ticketPrintLogoFile instanceof File) {
    const form = new FormData();
    const payload = toApiUpdateBody(draft);
    form.append("_method", "PUT");
    appendFormPayload(form, payload);
    form.append("ticketPrintLogo", draft.ticketPrintLogoFile);
    return form;
  }
  return JSON.stringify(toApiUpdateBody(draft));
}

function buildSiteCreateBody(draft) {
  if (draft.ticketPrintLogoFile instanceof File) {
    const form = new FormData();
    const payload = toApiCreateBody(draft);
    appendFormPayload(form, payload);
    form.append("ticketPrintLogo", draft.ticketPrintLogoFile);
    return form;
  }
  return JSON.stringify(toApiCreateBody(draft));
}

function fromApiSite(site) {
  if (!site) return null;
  return {
    id: site.id,
    name: site.name ?? "",
    code: site.code ?? "",
    phone: site.phone ?? "",
    email: site.email ?? "",
    address: site.address ?? "",
    status: site.status ?? "",
    treatmentProviderId: site.treatment_provider_id ?? site.treatmentProviderId ?? "",
    establishmentNumber: site.establishment_number ?? site.establishmentNumber ?? site.yard_no ?? site.yardNo ?? "",
    yardId: site.yard_id ?? site.yardId ?? "",
    addressLine1: site.address_line1 ?? site.addressLine1 ?? "",
    addressLine2: site.address_line2 ?? site.addressLine2 ?? "",
    suburb: site.suburb ?? "",
    stateCode: site.state_code ?? site.stateCode ?? "",
    postcode: site.postcode ?? "",
    isHeadOffice: Boolean(site.is_head_office),
    organizationName: site.organization?.name ?? "",
    organizationId: site.organization_id ?? "",
    ticketInPrefix: site.ticket_in_prefix ?? site.ticketInPrefix ?? "",
    ticketOutPrefix: site.ticket_out_prefix ?? site.ticketOutPrefix ?? "",
    ticketPrintHeader: site.ticket_print_header ?? site.ticketPrintHeader ?? "",
    ticketPrintFooter: site.ticket_print_footer ?? site.ticketPrintFooter ?? "",
    ticketPrintLogo: site.ticket_print_logo ?? site.ticketPrintLogo ?? "",
  };
}

function pemsApiFields(draft) {
  const yardIdRaw = draft.yardId;
  const yardId = yardIdRaw === "" || yardIdRaw == null ? null : Number(yardIdRaw);
  return {
    establishment_number: String(draft.establishmentNumber ?? "").trim() || null,
    yard_id: Number.isFinite(yardId) ? yardId : null,
    address_line1: String(draft.addressLine1 ?? "").trim() || null,
    address_line2: String(draft.addressLine2 ?? "").trim() || null,
    suburb: String(draft.suburb ?? "").trim() || null,
    state_code: String(draft.stateCode ?? "").trim() || null,
    postcode: String(draft.postcode ?? "").trim() || null,
  };
}

function siteApiFields(draft) {
  return {
    treatment_provider_id: String(draft.treatmentProviderId ?? "").trim() || null,
    ...pemsApiFields(draft),
    ticket_in_prefix: String(draft.ticketInPrefix ?? "").trim() || null,
    ticket_out_prefix: String(draft.ticketOutPrefix ?? "").trim() || null,
    ticket_print_header: String(draft.ticketPrintHeader ?? "").trim() || null,
    ticket_print_footer: String(draft.ticketPrintFooter ?? "").trim() || null,
    ticket_print_logo: String(draft.ticketPrintLogo ?? "").trim() || null,
  };
}

function toApiCreateBody(draft) {
  const { organization_id: orgId } = getTenantPayload();
  return {
    organization_id: orgId,
    name: String(draft.name ?? "").trim(),
    phone: String(draft.phone ?? "").trim() || null,
    email: String(draft.email ?? "").trim() || null,
    address: String(draft.address ?? "").trim() || null,
    code: String(draft.code ?? "").trim() || null,
    status: String(draft.status ?? "active").trim() || "active",
    is_head_office: draft.isHeadOffice === "true" || draft.isHeadOffice === true,
    ...siteApiFields(draft),
  };
}

function toApiUpdateBody(draft) {
  return {
    name: String(draft.name ?? "").trim(),
    phone: String(draft.phone ?? "").trim() || null,
    email: String(draft.email ?? "").trim() || null,
    address: String(draft.address ?? "").trim() || null,
    code: String(draft.code ?? "").trim() || null,
    status: String(draft.status ?? "active").trim() || "active",
    is_head_office: draft.isHeadOffice === "true" || draft.isHeadOffice === true,
    ...siteApiFields(draft),
  };
}

function buildDraft(row) {
  return {
    name: row?.name ?? "",
    code: row?.code ?? "",
    phone: row?.phone ?? "",
    email: row?.email ?? "",
    address: row?.address ?? "",
    status: row?.status ? String(row.status) : "active",
    treatmentProviderId: row?.treatmentProviderId ?? "",
    isHeadOffice: row?.isHeadOffice ? "true" : "false",
    establishmentNumber: row?.establishmentNumber ?? "",
    yardId: row?.yardId ?? "",
    addressLine1: row?.addressLine1 ?? "",
    addressLine2: row?.addressLine2 ?? "",
    suburb: row?.suburb ?? "",
    stateCode: row?.stateCode ?? "",
    postcode: row?.postcode ?? "",
    ticketInPrefix: row?.ticketInPrefix ?? "",
    ticketOutPrefix: row?.ticketOutPrefix ?? "",
    ticketPrintHeader: row?.ticketPrintHeader ?? "",
    ticketPrintFooter: row?.ticketPrintFooter ?? "",
    ticketPrintLogo: row?.ticketPrintLogo ?? "",
    ticketPrintLogoFile: null,
  };
}

export default function SitePage() {
  const [rows, setRows] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [modalMode, setModalMode] = useState(null);
  const [draft, setDraft] = useState(() => buildDraft());
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadSites = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const result = await siteRequest("?per_page=100");
      const pager = result?.sites ?? result?.data ?? result;
      const apiRows = Array.isArray(pager?.data) ? pager.data : Array.isArray(pager) ? pager : [];
      setRows(apiRows.map(fromApiSite).filter(Boolean));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load sites.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const frame = requestAnimationFrame(() => loadSites());
    return () => cancelAnimationFrame(frame);
  }, [loadSites]);

  const selected = useMemo(
    () => (selectedId != null ? rows.find((row) => row.id === selectedId) ?? null : null),
    [rows, selectedId]
  );

  const openAddModal = () => {
    setError("");
    setNotice("");
    setDraft(buildDraft());
    setModalMode("add");
  };

  const openEditModal = () => {
    if (!selected) return;
    setError("");
    setNotice("");
    setDraft(buildDraft(selected));
    setModalMode("edit");
  };

  const closeModal = () => {
    if (isSaving) return;
    setModalMode(null);
  };

  const saveModal = async () => {
    if (!String(draft.name ?? "").trim()) {
      setError("Site name is required.");
      return;
    }

    const tenant = getTenantPayload();
    if (modalMode === "add" && !tenant.organization_id) {
      setError("Your account has no organization; cannot create a site.");
      return;
    }

    setIsSaving(true);
    setError("");
    setNotice("");

    try {
      if (modalMode === "add") {
        const body = buildSiteCreateBody(draft);
        const result = await siteRequest("", {
          method: "POST",
          body,
        });
        const nextRow = fromApiSite(result.site ?? result.data ?? result);
        if (!nextRow) throw new Error("Invalid response from server.");
        setRows((prev) => [nextRow, ...prev]);
        setSelectedId(nextRow.id);
        setNotice(result.message || "Site created successfully.");
        setModalMode(null);
        try {
          await refreshAuthPayload();
          notifyAuthSessionChanged();
        } catch {
          /* Navbar site list will catch up on next login. */
        }
        return;
      }

      if (modalMode === "edit" && selected) {
        const body = buildSiteSaveBody(draft);
        const result = await siteRequest(`/${selected.id}`, {
          method: body instanceof FormData ? "POST" : "PUT",
          body,
        });
        const nextRow = fromApiSite(result.site ?? result.data ?? result);
        if (!nextRow) throw new Error("Invalid response from server.");
        setRows((prev) => prev.map((row) => (row.id === selected.id ? nextRow : row)));
        setNotice(result.message || "Site updated successfully.");
        setModalMode(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save site.");
    } finally {
      setIsSaving(false);
    }
  };

  const removeSelected = async () => {
    if (!selected || isDeleting) return;
    if (!window.confirm(`Delete site "${selected.name || selected.id}"? Head office sites cannot be deleted.`)) return;

    setIsDeleting(true);
    setError("");
    setNotice("");

    try {
      const result = await siteRequest(`/${selected.id}`, { method: "DELETE" });
      setRows((prev) => prev.filter((row) => row.id !== selected.id));
      setSelectedId(null);
      setNotice(result.message || "Site deleted successfully.");
      try {
        await refreshAuthPayload();
        notifyAuthSessionChanged();
      } catch {
        /* Navbar site list will catch up on next login. */
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete site.");
    } finally {
      setIsDeleting(false);
    }
  };

  const modalError = modalMode ? error : "";

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs text-slate-500">More Settings / Site</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 md:text-[1.65rem]">
          Site Management
        </h1>
        <p className="mt-1 text-xs text-slate-500">
          Maintain site records used across operational modules.
        </p>
      </div>

      {!modalMode && error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>
      ) : null}

      {notice ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{notice}</div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(260px,340px)] xl:items-start">
        <div className="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-sm">
          <Grid
            columns={gridColumns}
            rows={rows}
            getRowId={(row) => row.id}
            theme="light"
            density="standard"
            fileName="Sites"
            persistKey="more-settings-site-grid"
            visibleRows={14}
            loading={isLoading}
            emptyMessage={isLoading ? "Loading sites…" : "No sites found."}
            onRowClick={(row) => setSelectedId((prev) => (prev === row.id ? null : row.id))}
            onPersistedRowActivate={(row) => setSelectedId(row.id)}
            getRowClassName={({ row }) => (row.id === selectedId ? "clutch-row-selected" : undefined)}
            getRowStyle={({ row }) => (row.id === selectedId ? { backgroundColor: "#dbeafe" } : undefined)}
            toolbarActions={
              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" size="sm" onClick={openAddModal} disabled={isLoading} className="h-7 px-2.5 text-[11px]">
                  + Add Site
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={!selected || isLoading}
                  onClick={openEditModal}
                  className="h-7 px-2.5 text-[11px]"
                >
                  Edit
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  disabled={!selected || isLoading || isDeleting}
                  onClick={removeSelected}
                  className="h-7 px-2.5 text-[11px]"
                >
                  {isDeleting ? "Deleting…" : "Delete"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={isLoading}
                  onClick={loadSites}
                  className="h-7 px-2.5 text-[11px]"
                >
                  Refresh
                </Button>
              </div>
            }
          />
        </div>

        <aside className="rounded-xl border border-slate-200/90 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-3 py-3">
            <h2 className="text-sm font-semibold text-slate-900">Site Details</h2>
          </div>
          {selected ? (
            <div className="space-y-3 p-3 text-xs">
              {detailFields.map((f) => (
                <DetailRow
                  key={f.key}
                  label={f.label}
                  value={f.format ? f.format(selected[f.key]) : selected[f.key]}
                  highlight={f.key === "name"}
                />
              ))}
            </div>
          ) : (
            <div className="p-6 text-center text-xs text-slate-400">Select a site to view details</div>
          )}
        </aside>
      </div>

      <Modal
        open={modalMode != null}
        title={modalMode === "edit" ? "Edit Site" : "Add Site"}
        onClose={closeModal}
      >
        {modalError ? (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-600">{modalError}</div>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2">
          <FormInput label="Site Name" required value={draft.name} disabled={isSaving} onChange={(v) => setDraft((p) => ({ ...p, name: v }))} placeholder="e.g. Melbourne" />
          <FormInput label="Code" value={draft.code} disabled={isSaving} onChange={(v) => setDraft((p) => ({ ...p, code: v }))} placeholder="Site code" />
          <FormInput label="Phone" value={draft.phone} disabled={isSaving} onChange={(v) => setDraft((p) => ({ ...p, phone: v }))} placeholder="+61 …" />
          <FormInput label="Email" type="email" value={draft.email} disabled={isSaving} onChange={(v) => setDraft((p) => ({ ...p, email: v }))} placeholder="contact@example.com" />
          <FormInput label="Treatment Provider ID" value={draft.treatmentProviderId} disabled={isSaving} onChange={(v) => setDraft((p) => ({ ...p, treatmentProviderId: v }))} placeholder="ABF/AQIS registration" />
          <FormSelect label="Status" value={draft.status} disabled={isSaving} options={STATUS_OPTIONS} onChange={(v) => setDraft((p) => ({ ...p, status: v }))} />
          <FormSelect label="Head Office" value={draft.isHeadOffice} disabled={isSaving} options={HEAD_OFFICE_OPTIONS} onChange={(v) => setDraft((p) => ({ ...p, isHeadOffice: v }))} />
          <div className="sm:col-span-2">
            <FormTextarea label="Address" value={draft.address} disabled={isSaving} onChange={(v) => setDraft((p) => ({ ...p, address: v }))} placeholder="Street, city…" />
          </div>
        </div>

        <div className="mt-4 border-t border-slate-200 pt-3">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-700">PEMS Establishment</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <FormInput label="Establishment Number" value={draft.establishmentNumber} disabled={isSaving} onChange={(v) => setDraft((p) => ({ ...p, establishmentNumber: v }))} placeholder="e.g. 6851" />
            <FormInput label="Yard ID (integer)" type="number" value={draft.yardId} disabled={isSaving} onChange={(v) => setDraft((p) => ({ ...p, yardId: v }))} placeholder="PEMS yardId for ECI" />
            <div className="sm:col-span-2">
              <FormInput label="Address Line 1" value={draft.addressLine1} disabled={isSaving} onChange={(v) => setDraft((p) => ({ ...p, addressLine1: v }))} placeholder="Street address" />
            </div>
            <div className="sm:col-span-2">
              <FormInput label="Address Line 2" value={draft.addressLine2} disabled={isSaving} onChange={(v) => setDraft((p) => ({ ...p, addressLine2: v }))} placeholder="Optional" />
            </div>
            <FormInput label="Suburb" value={draft.suburb} disabled={isSaving} onChange={(v) => setDraft((p) => ({ ...p, suburb: v }))} />
            <FormSelect label="State" value={draft.stateCode} disabled={isSaving} options={STATE_OPTIONS} onChange={(v) => setDraft((p) => ({ ...p, stateCode: v }))} />
            <FormInput label="Postcode" value={draft.postcode} disabled={isSaving} onChange={(v) => setDraft((p) => ({ ...p, postcode: v }))} />
          </div>
        </div>

        <div className="mt-4 border-t border-slate-200 pt-3">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-700">Ticket Print Settings</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <FormInput
              label="Incoming Ticket Prefix"
              value={draft.ticketInPrefix}
              disabled={isSaving}
              onChange={(v) => setDraft((p) => ({ ...p, ticketInPrefix: v }))}
              placeholder="e.g. MTS (defaults to MTS)"
            />
            <FormInput
              label="Outgoing Ticket Prefix"
              value={draft.ticketOutPrefix}
              disabled={isSaving}
              onChange={(v) => setDraft((p) => ({ ...p, ticketOutPrefix: v }))}
              placeholder="e.g. OT (defaults to OT)"
            />
            <div className="sm:col-span-2">
              <FormTextarea
                label="Print Header"
                value={draft.ticketPrintHeader}
                disabled={isSaving}
                onChange={(v) => setDraft((p) => ({ ...p, ticketPrintHeader: v }))}
                placeholder="Address lines and contact details shown at the top of printed tickets…"
              />
            </div>
            <div className="sm:col-span-2">
              <FormTextarea
                label="Print Footer"
                value={draft.ticketPrintFooter}
                disabled={isSaving}
                onChange={(v) => setDraft((p) => ({ ...p, ticketPrintFooter: v }))}
                placeholder="Disclaimer or footer text shown at the bottom of printed tickets…"
              />
            </div>
            <div className="sm:col-span-2 space-y-2">
              <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">Print Logo</label>
              {draft.ticketPrintLogo ? (
                <p className="text-[11px] text-slate-500">Current: {draft.ticketPrintLogo}</p>
              ) : null}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                disabled={isSaving}
                className="block w-full text-xs text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-slate-700"
                onChange={(e) => {
                  const file = e.target.files?.[0] ?? null;
                  setDraft((p) => ({ ...p, ticketPrintLogoFile: file }));
                }}
              />
            </div>
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={closeModal} disabled={isSaving}>
            Cancel
          </Button>
          <Button type="button" size="sm" onClick={saveModal} disabled={isSaving}>
            {isSaving ? "Saving…" : modalMode === "edit" ? "Save changes" : "Create"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}

function DetailRow({ label, value, highlight }) {
  return (
    <div className="space-y-0.5">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className={cn("rounded border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] text-slate-700", highlight && "font-semibold text-brand")}>
        {value || "—"}
      </div>
    </div>
  );
}

function FormInput({ label, required, value, onChange, disabled, placeholder, type = "text" }) {
  return (
    <div className="space-y-1">
      <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">
        {label}
        {required ? <span className="text-red-500"> *</span> : null}
      </label>
      <input
        type={type}
        className={inputClass}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        {...numberInputProps(type)}
      />
    </div>
  );
}

function FormSelect({ label, required, value, onChange, disabled, options }) {
  return (
    <div className="space-y-1">
      <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">
        {label}
        {required ? <span className="text-red-500"> *</span> : null}
      </label>
      <ClutchSelect
        options={options}
        value={options.find((o) => String(o.value) === String(value)) ?? null}
        onChange={(option) => onChange(option ? option.value : "")}
        isDisabled={disabled}
        isClearable={false}
      />
    </div>
  );
}

function FormTextarea({ label, value, onChange, disabled, placeholder }) {
  return (
    <div className="space-y-1">
      <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">{label}</label>
      <textarea
        className={cn(inputClass, "min-h-20 resize-y")}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={3}
      />
    </div>
  );
}

function Modal({ open, title, onClose, children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button type="button" className="absolute inset-0 bg-black/40" aria-label="Close dialog" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="site-modal-title"
        className="relative max-h-[min(90vh,720px)] w-full max-w-2xl overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-4 py-3">
          <h2 id="site-modal-title" className="text-sm font-semibold text-slate-900">{title}</h2>
          <button
            type="button"
            className="rounded-md px-2 py-1 text-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            onClick={onClose}
          >
            X
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}
