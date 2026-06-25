"use client";

import { useAutoOpenAddModal } from "@/lib/hooks/use-auto-open-add-modal";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Grid } from "@/components/clutch-table";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api"
).replace(/\/+$/, "");
const FUMIGANTS_ENDPOINT = `${API_BASE_URL}/fumigation/fumigants`;

const inputClass =
  "w-full rounded-lg border border-slate-200/95 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-brand/15 placeholder:text-slate-400 focus:border-brand/35 focus:ring-2";

const PRODUCT_FORMS = ["Cylinder", "Tablet", "Liquid", "Gas", "Granule"];
const DOSAGE_UNITS = ["ppm", "g/m3", "mg/L", "%"];

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

async function fumigantRequest(path = "", options = {}) {
  const response = await fetch(`${FUMIGANTS_ENDPOINT}${path}`, {
    ...options,
    headers: {
      ...getAuthHeaders(),
      ...(options.headers || {}),
    },
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || result?.success === false) {
    throw new Error(extractApiError(result, "Fumigant request failed."));
  }
  return result;
}

function fromApiFumigant(row) {
  if (!row) return null;
  return {
    id: row.id,
    code: row.code ?? "",
    name: row.name ?? "",
    chemicalFamily: row.chemical_family ?? row.chemicalFamily ?? "",
    activeConstituent: row.active_constituent ?? row.activeConstituent ?? "",
    productForm: row.product_form ?? row.productForm ?? PRODUCT_FORMS[0],
    reEntryPpm:
      row.re_entry_ppm != null && row.re_entry_ppm !== ""
        ? String(row.re_entry_ppm)
        : row.reEntryPpm != null
          ? String(row.reEntryPpm)
          : "",
    defaultUnit: row.default_unit ?? row.defaultUnit ?? DOSAGE_UNITS[0],
  };
}

function toApiPayload(draft) {
  const tenant = getTenantPayload();
  const reEntryPpm = draft.reEntryPpm === "" ? null : Number(draft.reEntryPpm);

  return {
    ...tenant,
    code: String(draft.code ?? "").trim(),
    name: String(draft.name ?? "").trim(),
    chemical_family: String(draft.chemicalFamily ?? "").trim() || null,
    active_constituent: String(draft.activeConstituent ?? "").trim() || null,
    product_form: draft.productForm || null,
    default_unit: draft.defaultUnit || null,
    re_entry_ppm: reEntryPpm == null || Number.isNaN(reEntryPpm) ? null : reEntryPpm,
  };
}

function buildDraft(row) {
  return {
    code: row?.code ?? "",
    name: row?.name ?? "",
    chemicalFamily: row?.chemicalFamily ?? "",
    activeConstituent: row?.activeConstituent ?? "",
    productForm: row?.productForm ?? PRODUCT_FORMS[0],
    reEntryPpm: row?.reEntryPpm ?? "",
    defaultUnit: row?.defaultUnit ?? DOSAGE_UNITS[0],
  };
}

export default function FumigantsPage() {
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [modalMode, setModalMode] = useState(null);
  const [draft, setDraft] = useState(() => buildDraft());
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadFumigants = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const tenant = getTenantPayload();
      const params = new URLSearchParams({ per_page: "500" });
      if (tenant.organization_id) params.set("organization_id", tenant.organization_id);
      if (tenant.site_id) params.set("site_id", tenant.site_id);

      const result = await fumigantRequest(`?${params.toString()}`);
      const pager = result?.data;
      const apiRows = Array.isArray(pager?.data) ? pager.data : Array.isArray(pager) ? pager : [];
      setRows(apiRows.map(fromApiFumigant).filter(Boolean));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load fumigants.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      loadFumigants();
    });
    return () => cancelAnimationFrame(frame);
  }, [loadFumigants]);

  const filteredRows = useMemo(() => {
    if (!search.trim()) return rows;
    const needle = search.toLowerCase();
    return rows.filter((row) =>
      `${row.code} ${row.name} ${row.chemicalFamily}`.toLowerCase().includes(needle)
    );
  }, [rows, search]);

  const selected = selectedId != null ? rows.find((row) => row.id === selectedId) ?? null : null;
  const modalError = modalMode ? error : "";

  const gridColumns = useMemo(
    () => [
      { key: "code", header: "Code", type: "text", sortable: true, filterable: true, resizable: true },
      { key: "name", header: "Name", type: "text", sortable: true, filterable: true, resizable: true },
      { key: "productForm", header: "Product form", type: "text", sortable: true, filterable: true, resizable: true },
      { key: "defaultUnit", header: "Default unit", type: "text", sortable: true, filterable: true, resizable: true },
      {
        key: "reEntryPpm",
        header: "Re-entry PPM",
        type: "text",
        sortable: true,
        filterable: true,
        resizable: true,
        format: (v) => (v != null && String(v).trim() !== "" ? String(v) : "—"),
      },
    ],
    []
  );

  function openAdd() {
    setError("");
    setNotice("");
    setDraft(buildDraft());
    setModalMode("add");
  }

  useAutoOpenAddModal(openAdd);

  function openEdit() {
    if (!selected) return;
    setError("");
    setNotice("");
    setDraft(buildDraft(selected));
    setModalMode("edit");
  }

  function closeModal() {
    if (isSaving) return;
    setModalMode(null);
    setError("");
  }

  async function saveModal() {
    if (!draft.code.trim() || !draft.name.trim()) {
      setError("Code and name are required.");
      return;
    }

    const tenant = getTenantPayload();
    if (!tenant.organization_id || !tenant.site_id) {
      setError("Organization and current site are required to save a fumigant.");
      return;
    }

    setIsSaving(true);
    setError("");
    setNotice("");

    try {
      const body = toApiPayload(draft);

      if (modalMode === "add") {
        const result = await fumigantRequest("", {
          method: "POST",
          body: JSON.stringify(body),
        });
        const nextRow = fromApiFumigant(result.data);
        if (!nextRow) throw new Error("Invalid response from server.");
        setRows((prev) => [nextRow, ...prev]);
        setSelectedId(nextRow.id);
        setNotice(result.message || "Fumigant created successfully.");
        setModalMode(null);
        return;
      }

      if (modalMode === "edit" && selected) {
        const result = await fumigantRequest(`/${selected.id}`, {
          method: "PUT",
          body: JSON.stringify(body),
        });
        const nextRow = fromApiFumigant(result.data);
        if (!nextRow) throw new Error("Invalid response from server.");
        setRows((prev) => prev.map((row) => (row.id === selected.id ? nextRow : row)));
        setNotice(result.message || "Fumigant updated successfully.");
        setModalMode(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save fumigant.");
    } finally {
      setIsSaving(false);
    }
  }

  async function removeSelected() {
    if (!selected || isDeleting) return;
    const shouldDelete = window.confirm(
      `Delete fumigant "${selected.name || selected.code || selected.id}"?`
    );
    if (!shouldDelete) return;

    setIsDeleting(true);
    setError("");
    setNotice("");

    try {
      const result = await fumigantRequest(`/${selected.id}`, { method: "DELETE" });
      setRows((prev) => prev.filter((row) => row.id !== selected.id));
      setSelectedId(null);
      setNotice(result.message || "Fumigant deleted successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete fumigant.");
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs text-slate-500">Fumigation / Fumigants</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 md:text-[1.65rem]">
          Fumigants
        </h1>
        <p className="mt-1 text-xs text-slate-500">
          Manage fumigant products, re-entry limits, and default dosage units.
        </p>
      </div>

      {!modalMode && error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>
      ) : null}

      {notice ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{notice}</div>
      ) : null}

      <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <input
            className={cn(inputClass, "max-w-md")}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search code, name, or family..."
          />
          <div className="ml-auto flex flex-wrap gap-2">
            <Button type="button" size="sm" onClick={openAdd} disabled={isLoading}>
              + Add
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={loadFumigants} disabled={isLoading}>
              Refresh
            </Button>
            <Button type="button" variant="outline" size="sm" disabled={!selected || isLoading} onClick={openEdit}>
              Edit
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={!selected || isLoading || isDeleting}
              onClick={removeSelected}
            >
              {isDeleting ? "Deleting…" : "Delete"}
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px] xl:items-start">
        <div className="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-sm">
          <Grid
            columns={gridColumns}
            rows={filteredRows}
            getRowId={(row) => row.id}
            theme="light"
            density="standard"
            fileName="Fumigants"
            visibleRows={12}
            persistKey="fumigation-fumigants"
            enableGlobalSearch={false}
            loading={isLoading}
            emptyMessage={isLoading ? "Loading fumigants…" : "No fumigants found."}
            onRowClick={(row) => setSelectedId((prev) => (prev === row.id ? null : row.id))}
            onPersistedRowActivate={(row) => setSelectedId(row.id)}
            getRowClassName={({ row }) => (row.id === selectedId ? "clutch-row-selected" : undefined)}
            getRowStyle={({ row }) => (row.id === selectedId ? { backgroundColor: "#dbeafe" } : undefined)}
          />
        </div>

        <aside className="rounded-xl border border-slate-200/90 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">Fumigant Details</h2>
          {!selected ? (
            <p className="mt-4 text-sm text-slate-500">Select a row to view details.</p>
          ) : (
            <dl className="mt-4 space-y-3 text-sm">
              <DetailItem label="Code" value={selected.code} highlight />
              <DetailItem label="Name" value={selected.name} />
              <DetailItem label="Chemical family" value={selected.chemicalFamily} />
              <DetailItem label="Active constituent" value={selected.activeConstituent} />
              <DetailItem label="Product form" value={selected.productForm} />
              <DetailItem label="Re-entry PPM" value={selected.reEntryPpm} />
              <DetailItem label="Default unit" value={selected.defaultUnit} />
            </dl>
          )}
        </aside>
      </div>

      <Modal
        open={modalMode != null}
        title={modalMode === "edit" ? "Edit fumigant" : "Add fumigant"}
        onClose={closeModal}
      >
        {modalError ? (
          <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{modalError}</div>
        ) : null}
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label="Code *">
            <input
              className={inputClass}
              value={draft.code}
              onChange={(event) => setDraft((prev) => ({ ...prev, code: event.target.value }))}
            />
          </FormField>
          <FormField label="Name *">
            <input
              className={inputClass}
              value={draft.name}
              onChange={(event) => setDraft((prev) => ({ ...prev, name: event.target.value }))}
            />
          </FormField>
          <FormField label="Chemical family">
            <input
              className={inputClass}
              value={draft.chemicalFamily}
              onChange={(event) => setDraft((prev) => ({ ...prev, chemicalFamily: event.target.value }))}
            />
          </FormField>
          <FormField label="Product form">
            <select
              className={inputClass}
              value={draft.productForm}
              onChange={(event) => setDraft((prev) => ({ ...prev, productForm: event.target.value }))}
            >
              {PRODUCT_FORMS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Default unit">
            <select
              className={inputClass}
              value={draft.defaultUnit}
              onChange={(event) => setDraft((prev) => ({ ...prev, defaultUnit: event.target.value }))}
            >
              {DOSAGE_UNITS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Re-entry PPM">
            <input
              className={inputClass}
              type="number"
              step="any"
              value={draft.reEntryPpm}
              onChange={(event) => setDraft((prev) => ({ ...prev, reEntryPpm: event.target.value }))}
            />
          </FormField>
          <FormField label="Active constituent" wide>
            <textarea
              className={cn(inputClass, "min-h-20 resize-y")}
              rows={3}
              value={draft.activeConstituent}
              onChange={(event) => setDraft((prev) => ({ ...prev, activeConstituent: event.target.value }))}
            />
          </FormField>
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

function FormField({ label, wide = false, children }) {
  return (
    <div className={cn("space-y-1", wide && "sm:col-span-2")}>
      <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">{label}</label>
      {children}
    </div>
  );
}

function DetailItem({ label, value, highlight = false }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className={cn("mt-0.5 text-slate-800", highlight && "font-semibold text-brand")}>{value || "—"}</dd>
    </div>
  );
}

function Modal({ open, title, onClose, children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button type="button" className="absolute inset-0 bg-black/40" aria-label="Close dialog" onClick={onClose} />
      <div className="relative max-h-[min(90vh,760px)] w-full max-w-3xl overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
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
