"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";

import { Grid } from "@/components/clutch-table";
import { Button } from "@/components/ui/button";
import CustomDateRangePicker from "@/components/ui/custom-date-range-picker";
import { usePolling } from "@/lib/use-polling";
import { cn } from "@/lib/utils";

const MOBILE_BREAKPOINT = 900;
const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api"
).replace(/\/+$/, "");
const VOYAGES_ENDPOINT = `${API_BASE_URL}/reference-data/vessel-voyages`;
const VESSELS_ENDPOINT = `${API_BASE_URL}/reference-data/vessels`;
const SHIPPING_LINES_ENDPOINT = `${API_BASE_URL}/reference-data/shipping-lines`;
const TERMINALS_ENDPOINT = `${API_BASE_URL}/reference-data/terminals`;
const PORTS_ENDPOINT = `${API_BASE_URL}/reference-data/ports`;

const inputClass =
  "w-full rounded-lg border border-slate-200/95 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-brand/15 placeholder:text-slate-400 focus:border-brand/35 focus:ring-2";

const config = {
  title: "Vessel Voyage",
  subtitle: "One row per voyage. Auto-updates when the vessel schedule CSV is ingested.",
  columns: [
    { key: "vesselName", label: "Vessel" },
    { key: "lloydsNumber", label: "Lloyds" },
    { key: "voyageNumber", label: "Voyage" },
    { key: "voyageNumberIn", label: "Voyage In" },
    { key: "shippingLine", label: "Shipping Line" },
    { key: "terminal", label: "Terminal" },
    { key: "loadPort", label: "Load Port" },
    { key: "vesselEtaDisplay", label: "ETA" },
    { key: "vesselEtdDisplay", label: "ETD" },
    { key: "vesselCutoffDateDisplay", label: "Cargo Cut-off" },
    { key: "vesselReceivalsOpenDateDisplay", label: "Receivals Open" },
    { key: "actualArrivalDateDisplay", label: "Actual Arrival" },
    { key: "actualDepartDateDisplay", label: "Actual Depart" },
    { key: "firstFreeImportDateDisplay", label: "First Free Import" },
    { key: "vesselFreeDays", label: "Free Days" },
    { key: "lastIngestedAtDisplay", label: "Last Ingested" },
  ],
  formFields: [
    { key: "vesselId", label: "Vessel", required: true, type: "select" },
    { key: "voyageNumber", label: "Voyage Number", required: true },
    { key: "voyageNumberIn", label: "Voyage Number In" },
    { key: "shippingLineId", label: "Shipping Line", type: "select" },
    { key: "terminalId", label: "Terminal", type: "select" },
    { key: "loadPortId", label: "Load Port", type: "select" },
    { key: "vesselEta", label: "ETA", type: "datetime-local" },
    { key: "vesselEtd", label: "ETD", type: "datetime-local" },
    { key: "vesselCutoffDate", label: "Cargo Cut-off", type: "datetime-local" },
    { key: "vesselReeferCutoffDate", label: "Reefer Cut-off", type: "datetime-local" },
    { key: "vesselReceivalsOpenDate", label: "Receivals Open", type: "datetime-local" },
    { key: "actualArrivalDate", label: "Actual Arrival", type: "datetime-local" },
    { key: "actualDepartDate", label: "Actual Depart", type: "datetime-local" },
    { key: "firstFreeImportDate", label: "First Free Import", type: "datetime-local" },
    { key: "importAvailabilityDate", label: "Import Availability", type: "datetime-local" },
    { key: "importStorageStartDate", label: "Import Storage Start", type: "datetime-local" },
    { key: "vesselFreeDays", label: "Free Days", type: "number" },
  ],
};

const gridColumns = config.columns.map((col) => ({
  key: col.key,
  header: col.label,
  type: "text",
  sortable: true,
  filterable: true,
  resizable: true,
}));

const DATE_FILTER_FIELDS = [
  { key: "vesselEta", label: "ETA" },
  { key: "vesselEtd", label: "ETD" },
  { key: "vesselCutoffDate", label: "Cargo Cut-off" },
  { key: "vesselReceivalsOpenDate", label: "Receivals Open" },
  { key: "actualArrivalDate", label: "Actual Arrival" },
  { key: "actualDepartDate", label: "Actual Depart" },
  { key: "firstFreeImportDate", label: "First Free Import" },
  { key: "lastIngestedAt", label: "Last Ingested" },
];

function getDateOnlyValue(rawValue) {
  if (rawValue == null) return "";
  const value = String(rawValue).trim();
  if (!value) return "";
  const isoMatch = value.match(/^(\d{4}-\d{2}-\d{2})/);
  if (isoMatch) return isoMatch[1];
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toISOString().slice(0, 10);
}

function buildDraft(row) {
  const next = {};
  for (const field of config.formFields) next[field.key] = row?.[field.key] ?? "";
  return next;
}

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
  if (result?.errors) return Object.values(result.errors).flat().join(", ");
  return result?.message || fallback;
}

async function apiRequest(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { ...getAuthHeaders(), ...(options.headers || {}) },
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || result?.success === false) {
    throw new Error(extractApiError(result, "Request failed."));
  }
  return result?.data ?? result;
}

function toDateTimeLocal(value) {
  if (!value) return "";
  const normalized = String(value).replace(" ", "T");
  return normalized.slice(0, 16);
}

function formatDateTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString();
}

function fromApiVoyage(row) {
  return {
    id: row.id,
    vesselId: row.vessel_id ?? "",
    vesselName: row.vessel?.vessel_name ?? "",
    lloydsNumber: row.vessel?.lloyds_number ?? "",
    voyageNumber: row.voyage_number ?? "",
    voyageNumberIn: row.voyage_number_in ?? "",
    shippingLineId: row.shipping_line_id ?? "",
    shippingLine: row.shippingLine?.shipping_line_name ?? row.shipping_line?.shipping_line_name ?? "",
    terminalId: row.terminal_id ?? "",
    terminal: row.terminal?.name ?? row.terminal?.code ?? "",
    loadPortId: row.load_port_id ?? "",
    loadPort: row.loadPort?.name ?? row.load_port?.name ?? row.loadPort?.code ?? row.load_port?.code ?? "",
    vesselEta: toDateTimeLocal(row.vessel_eta),
    vesselEtd: toDateTimeLocal(row.vessel_etd),
    vesselCutoffDate: toDateTimeLocal(row.vessel_cutoff_date),
    vesselReeferCutoffDate: toDateTimeLocal(row.vessel_reefer_cutoff_date),
    vesselReceivalsOpenDate: toDateTimeLocal(row.vessel_receivals_open_date),
    actualArrivalDate: toDateTimeLocal(row.actual_arrival_date),
    actualDepartDate: toDateTimeLocal(row.actual_depart_date),
    firstFreeImportDate: toDateTimeLocal(row.first_free_import_date),
    importAvailabilityDate: toDateTimeLocal(row.import_availability_date),
    importStorageStartDate: toDateTimeLocal(row.import_storage_start_date),
    vesselFreeDays: row.vessel_free_days ?? "",
    lastIngestedAt: row.last_ingested_at ?? "",
    vesselEtaDisplay: formatDateTime(row.vessel_eta),
    vesselEtdDisplay: formatDateTime(row.vessel_etd),
    vesselCutoffDateDisplay: formatDateTime(row.vessel_cutoff_date),
    vesselReceivalsOpenDateDisplay: formatDateTime(row.vessel_receivals_open_date),
    actualArrivalDateDisplay: formatDateTime(row.actual_arrival_date),
    actualDepartDateDisplay: formatDateTime(row.actual_depart_date),
    firstFreeImportDateDisplay: formatDateTime(row.first_free_import_date),
    lastIngestedAtDisplay: formatDateTime(row.last_ingested_at),
  };
}

function toApiPayload(draft) {
  return {
    ...getTenantPayload(),
    vessel_id: draft.vesselId || null,
    voyage_number: draft.voyageNumber?.trim() || null,
    voyage_number_in: draft.voyageNumberIn?.trim() || null,
    shipping_line_id: draft.shippingLineId || null,
    terminal_id: draft.terminalId || null,
    load_port_id: draft.loadPortId || null,
    vessel_eta: draft.vesselEta || null,
    vessel_etd: draft.vesselEtd || null,
    vessel_cutoff_date: draft.vesselCutoffDate || null,
    vessel_reefer_cutoff_date: draft.vesselReeferCutoffDate || null,
    vessel_receivals_open_date: draft.vesselReceivalsOpenDate || null,
    actual_arrival_date: draft.actualArrivalDate || null,
    actual_depart_date: draft.actualDepartDate || null,
    first_free_import_date: draft.firstFreeImportDate || null,
    import_availability_date: draft.importAvailabilityDate || null,
    import_storage_start_date: draft.importStorageStartDate || null,
    vessel_free_days: draft.vesselFreeDays === "" ? null : Number(draft.vesselFreeDays),
  };
}

export default function VesselVoyagePage() {
  const [rows, setRows] = useState([]);
  const [vesselOptions, setVesselOptions] = useState([]);
  const [shippingLineOptions, setShippingLineOptions] = useState([]);
  const [terminalOptions, setTerminalOptions] = useState([]);
  const [portOptions, setPortOptions] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [modalMode, setModalMode] = useState(null);
  const [draft, setDraft] = useState(() => buildDraft());
  const [isMobile, setIsMobile] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [dateField, setDateField] = useState("vesselEtd");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  useEffect(() => {
    const query = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const handleMedia = () => setIsMobile(query.matches);
    handleMedia();
    query.addEventListener("change", handleMedia);
    return () => query.removeEventListener("change", handleMedia);
  }, []);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const [voyagePayload, vesselsPayload, shippingPayload, terminalsPayload, portsPayload] = await Promise.all([
        apiRequest(`${VOYAGES_ENDPOINT}?per_page=200`),
        apiRequest(`${VESSELS_ENDPOINT}?per_page=500`),
        apiRequest(`${SHIPPING_LINES_ENDPOINT}?per_page=500`),
        apiRequest(`${TERMINALS_ENDPOINT}?per_page=500`),
        apiRequest(`${PORTS_ENDPOINT}?per_page=500`),
      ]);
      const voyageRows = Array.isArray(voyagePayload?.data) ? voyagePayload.data : voyagePayload || [];
      const vesselRows = Array.isArray(vesselsPayload?.data) ? vesselsPayload.data : vesselsPayload || [];
      const shippingRows = Array.isArray(shippingPayload?.data) ? shippingPayload.data : shippingPayload || [];
      const terminalRows = Array.isArray(terminalsPayload?.data) ? terminalsPayload.data : terminalsPayload || [];
      const portRows = Array.isArray(portsPayload?.data) ? portsPayload.data : portsPayload || [];

      setRows(voyageRows.map(fromApiVoyage));
      setVesselOptions(vesselRows.map((v) => ({
        value: v.id,
        label: `${v.vessel_name}${v.lloyds_number ? ` (${v.lloyds_number})` : ""}`,
      })));
      setShippingLineOptions(shippingRows.map((s) => ({
        value: s.id,
        label: s.shipping_line_name || s.shipping_line_code || "Unnamed",
      })));
      setTerminalOptions(terminalRows.map((t) => ({
        value: t.id,
        label: `${t.name || t.code}${t.code && t.name ? ` (${t.code})` : ""}`,
      })));
      setPortOptions(portRows.map((p) => ({
        value: p.id,
        label: `${p.name || p.code}${p.code && p.name ? ` (${p.code})` : ""}`,
      })));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load voyage data.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      loadData();
    });
    return () => cancelAnimationFrame(frame);
  }, [loadData]);

  // Live refresh: poll every 60s (paused when the tab is hidden or while an
  // add/edit modal is open so in-progress edits aren't disrupted).
  usePolling(loadData, { intervalMs: 60000, isBusy: () => modalMode != null });

  const hasDateFilter = Boolean(dateFrom || dateTo);
  const filteredRows = useMemo(() => {
    if (!hasDateFilter) return rows;
    return rows.filter((row) => {
      const value = getDateOnlyValue(row[dateField]);
      if (!value) return false;
      if (dateFrom && value < dateFrom) return false;
      if (dateTo && value > dateTo) return false;
      return true;
    });
  }, [rows, dateField, dateFrom, dateTo, hasDateFilter]);

  const dateRangeValue = useMemo(
    () => [dateFrom ? dayjs(dateFrom) : null, dateTo ? dayjs(dateTo) : null],
    [dateFrom, dateTo]
  );

  const handleDateRangeChange = useCallback(([start, end]) => {
    setDateFrom(start && start.isValid() ? start.format("YYYY-MM-DD") : "");
    setDateTo(end && end.isValid() ? end.format("YYYY-MM-DD") : "");
  }, []);

  const clearDateFilter = () => {
    setDateFrom("");
    setDateTo("");
  };

  const selected = selectedId != null ? rows.find((row) => row.id === selectedId) ?? null : null;

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
    const requiredMissing = config.formFields.some(
      (field) => field.required && !String(draft[field.key] ?? "").trim()
    );
    if (requiredMissing) {
      setError("Please fill all required fields.");
      return;
    }
    setIsSaving(true);
    setError("");
    setNotice("");
    try {
      if (modalMode === "add") {
        const payload = await apiRequest(VOYAGES_ENDPOINT, {
          method: "POST",
          body: JSON.stringify(toApiPayload(draft)),
        });
        const nextRow = fromApiVoyage(payload);
        setRows((prev) => [nextRow, ...prev]);
        setSelectedId(nextRow.id);
        setNotice("Voyage created successfully.");
        setModalMode(null);
        return;
      }
      if (modalMode === "edit" && selected) {
        const payload = await apiRequest(`${VOYAGES_ENDPOINT}/${selected.id}`, {
          method: "PUT",
          body: JSON.stringify(toApiPayload(draft)),
        });
        const nextRow = fromApiVoyage(payload);
        setRows((prev) => prev.map((row) => (row.id === selected.id ? nextRow : row)));
        setNotice("Voyage updated successfully.");
        setModalMode(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save voyage.");
    } finally {
      setIsSaving(false);
    }
  };

  const removeSelected = async () => {
    if (!selected || isDeleting) return;
    const shouldDelete = window.confirm(
      `Delete voyage ${selected.voyageNumber} of ${selected.vesselName || "this vessel"}?`
    );
    if (!shouldDelete) return;
    setIsDeleting(true);
    setError("");
    setNotice("");
    try {
      await apiRequest(`${VOYAGES_ENDPOINT}/${selected.id}`, { method: "DELETE" });
      setRows((prev) => prev.filter((row) => row.id !== selected.id));
      setSelectedId(null);
      setNotice("Voyage deleted successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete voyage.");
    } finally {
      setIsDeleting(false);
    }
  };

  const formFields = config.formFields.map((field) => {
    if (field.key === "vesselId") return { ...field, options: vesselOptions };
    if (field.key === "shippingLineId") return { ...field, options: shippingLineOptions };
    if (field.key === "terminalId") return { ...field, options: terminalOptions };
    if (field.key === "loadPortId") return { ...field, options: portOptions };
    return field;
  });
  const modalError = modalMode ? error : "";

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs text-slate-500">Shipping Details / {config.title}</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 md:text-[1.65rem]">{config.title}</h1>
        {!isMobile ? <p className="mt-1 text-xs text-slate-500">{config.subtitle}</p> : null}
      </div>

      {!modalMode && error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>
      ) : null}

      {notice ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{notice}</div>
      ) : null}

      <div className="rounded-xl border border-slate-200/90 bg-white p-3 shadow-sm">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-0">
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Date Field</label>
            <select
              suppressHydrationWarning
              className={cn(inputClass, "w-44")}
              value={dateField}
              onChange={(e) => setDateField(e.target.value)}
              aria-label="Date field to filter by"
            >
              {DATE_FILTER_FIELDS.map((opt) => (
                <option key={opt.key} value={opt.key}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div className="min-w-0">
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Date Range</label>
            <div className="w-72">
              <CustomDateRangePicker value={dateRangeValue} onChange={handleDateRangeChange} />
            </div>
          </div>
          {hasDateFilter ? (
            <Button type="button" variant="outline" size="sm" onClick={clearDateFilter}>Clear</Button>
          ) : null}
          <span className="ml-auto text-xs text-slate-500">
            {hasDateFilter ? `${filteredRows.length} of ${rows.length} voyage(s)` : `${rows.length} voyage(s)`}
          </span>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl bg-white shadow-sm">
        <Grid
          columns={gridColumns}
          rows={filteredRows}
          getRowId={(row) => row.id}
          theme="light"
          density="standard"
          fileName={config.title}
          visibleRows={15}
          loading={isLoading}
          emptyMessage={isLoading ? "Loading voyages..." : hasDateFilter ? "No voyages match the selected date range." : "No voyages found."}
          onRowClick={(row) => setSelectedId((prev) => (prev === row.id ? null : row.id))}
          onPersistedRowActivate={(row) => setSelectedId(row.id)}
          toolbarActions={
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" onClick={openAddModal} disabled={isLoading}>+ Add</Button>
              <Button type="button" variant="outline" size="sm" disabled={!selected || isLoading} onClick={openEditModal}>Edit</Button>
              <Button type="button" variant="destructive" size="sm" disabled={!selected || isLoading || isDeleting} onClick={removeSelected}>
                {isDeleting ? "Deleting..." : "Delete"}
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={loadData} disabled={isLoading}>Refresh</Button>
            </div>
          }
        />
      </div>

      <Modal open={modalMode != null} title={modalMode === "edit" ? `Edit ${config.title}` : `Add ${config.title}`} onClose={closeModal}>
        {modalError ? (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-600">{modalError}</div>
        ) : null}
        <div className="grid gap-3 sm:grid-cols-2">
          {formFields.map((field) => (
            <FormField key={field.key} field={field} value={draft[field.key] ?? ""} disabled={isSaving} onChange={(value) => setDraft((prev) => ({ ...prev, [field.key]: value }))} />
          ))}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={closeModal} disabled={isSaving}>Cancel</Button>
          <Button type="button" size="sm" onClick={saveModal} disabled={isSaving}>
            {isSaving ? "Saving..." : modalMode === "edit" ? "Save changes" : "Create"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}

function FormField({ field, value, onChange, disabled }) {
  return (
    <div className={cn("space-y-1", field.wide && "sm:col-span-2")}>
      <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">
        {field.label}
        {field.required ? <span className="text-red-500"> *</span> : null}
      </label>
      {field.type === "select" ? (
        <select suppressHydrationWarning className={inputClass} value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)}>
          <option value="">Select...</option>
          {field.options?.map((option) => (
            <option key={option.value ?? option} value={option.value ?? option}>
              {option.label ?? option}
            </option>
          ))}
        </select>
      ) : (
        <input suppressHydrationWarning type={field.type || "text"} className={inputClass} value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)} placeholder={field.placeholder} />
      )}
    </div>
  );
}

function Modal({ open, title, onClose, children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button type="button" className="absolute inset-0 bg-black/40" aria-label="Close dialog" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-labelledby="vessel-voyage-modal-title" className="relative max-h-[min(90vh,720px)] w-full max-w-2xl overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-4 py-3">
          <h2 id="vessel-voyage-modal-title" className="text-sm font-semibold text-slate-900">{title}</h2>
          <button type="button" className="rounded-md px-2 py-1 text-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800" onClick={onClose}>x</button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}
