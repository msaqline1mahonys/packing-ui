"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { Grid } from "@/components/clutch-table";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api"
).replace(/\/+$/, "");
const FUMIGANTS_ENDPOINT = `${API_BASE_URL}/fumigation/fumigants`;
const METHODOLOGIES_ENDPOINT = `${API_BASE_URL}/fumigation/methodologies`;

const inputClass =
  "w-full rounded-lg border border-slate-200/95 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-brand/15 placeholder:text-slate-400 focus:border-brand/35 focus:ring-2";

const APPLICATION_METHODS = ["Chamber", "In-container", "Sheeted stack", "Silo", "Vacuum chamber"];
const MIN_EXPOSURE_UNITS = ["hours", "days"];
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

async function apiRequest(endpoint, path = "", options = {}) {
  const response = await fetch(`${endpoint}${path}`, {
    ...options,
    headers: {
      ...getAuthHeaders(),
      ...(options.headers || {}),
    },
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || result?.success === false) {
    throw new Error(extractApiError(result, "Request failed."));
  }
  return result;
}

function normaliseUnit(unit) {
  if (!unit) return unit;
  return String(unit).replace("g/m³", "g/m3");
}

function parseList(result) {
  const pager = result?.data;
  return Array.isArray(pager?.data) ? pager.data : Array.isArray(pager) ? pager : [];
}

function fromApiFumigant(row) {
  if (!row) return null;
  return {
    id: row.id,
    code: row.code ?? "",
    name: row.name ?? "",
  };
}

function fromApiDosageRange(row) {
  if (!row) return null;
  return {
    id: row.id ?? Date.now() + Math.random(),
    minTempC: row.min_temp_c != null ? String(row.min_temp_c) : "",
    maxTempC: row.max_temp_c != null ? String(row.max_temp_c) : "",
    dosageValue: row.dosage_value != null ? String(row.dosage_value) : "",
    dosageUnit: normaliseUnit(row.dosage_unit ?? row.dosageUnit) || "g/m3",
    exposureValue: row.exposure_value != null ? String(row.exposure_value) : "",
    exposureUnit: row.exposure_unit ?? row.exposureUnit ?? "hours",
  };
}

function fromApiMethodology(row) {
  if (!row) return null;
  const dosageRanges = row.dosage_ranges ?? row.dosageRanges ?? [];
  const effectiveDate = row.effective_date ?? row.effectiveDate ?? "";

  return {
    id: row.id,
    name: row.name ?? "",
    version: row.version ?? "",
    effectiveDate: effectiveDate ? String(effectiveDate).slice(0, 10) : "",
    fumigantId: row.fumigant_id ?? row.fumigantId ?? "",
    applicationMethods: row.application_methods ?? row.applicationMethods ?? [],
    minTemperature:
      row.min_temperature != null ? String(row.min_temperature) : row.minTemperature != null ? String(row.minTemperature) : "",
    maxTemperature:
      row.max_temperature != null ? String(row.max_temperature) : row.maxTemperature != null ? String(row.maxTemperature) : "",
    minExposureUnit: row.min_exposure_unit ?? row.minExposureUnit ?? MIN_EXPOSURE_UNITS[0],
    minExposure:
      row.min_exposure != null ? String(row.min_exposure) : row.minExposure != null ? String(row.minExposure) : "",
    dosageUnit: normaliseUnit(row.dosage_unit ?? row.dosageUnit) || DOSAGE_UNITS[0],
    dosageGuide: row.dosage_guide ?? row.dosageGuide ?? "",
    restraint: row.restraint ?? "",
    ventilationPeriod:
      row.ventilation_period != null
        ? String(row.ventilation_period)
        : row.ventilationPeriod != null
          ? String(row.ventilationPeriod)
          : "",
    withholdingPeriod:
      row.withholding_period != null
        ? String(row.withholding_period)
        : row.withholdingPeriod != null
          ? String(row.withholdingPeriod)
          : "",
    reEntryPpm:
      row.re_entry_ppm != null ? String(row.re_entry_ppm) : row.reEntryPpm != null ? String(row.reEntryPpm) : "",
    safetyNotes: row.safety_notes ?? row.safetyNotes ?? "",
    dosageRanges: dosageRanges.map(fromApiDosageRange).filter(Boolean),
  };
}

function toNullableNumber(value) {
  if (value === "" || value == null) return null;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function toApiPayload(draft) {
  const tenant = getTenantPayload();

  return {
    ...tenant,
    name: String(draft.name ?? "").trim(),
    version: String(draft.version ?? "").trim() || null,
    effective_date: draft.effectiveDate || null,
    fumigant_id: draft.fumigantId || null,
    application_methods: draft.applicationMethods ?? [],
    min_temperature: toNullableNumber(draft.minTemperature),
    max_temperature: toNullableNumber(draft.maxTemperature),
    min_exposure_unit: draft.minExposureUnit || null,
    min_exposure: toNullableNumber(draft.minExposure),
    dosage_unit: normaliseUnit(draft.dosageUnit) || null,
    dosage_guide: String(draft.dosageGuide ?? "").trim() || null,
    restraint: String(draft.restraint ?? "").trim() || null,
    ventilation_period: toNullableNumber(draft.ventilationPeriod),
    withholding_period: toNullableNumber(draft.withholdingPeriod),
    re_entry_ppm: toNullableNumber(draft.reEntryPpm),
    safety_notes: String(draft.safetyNotes ?? "").trim() || null,
    dosage_ranges: (draft.dosageRanges ?? []).map((range) => ({
      min_temp_c: toNullableNumber(range.minTempC),
      max_temp_c: toNullableNumber(range.maxTempC),
      dosage_value: toNullableNumber(range.dosageValue),
      dosage_unit: normaliseUnit(range.dosageUnit) || null,
      exposure_value: toNullableNumber(range.exposureValue),
      exposure_unit: range.exposureUnit || null,
    })),
  };
}

function buildDraft(row) {
  return {
    name: row?.name ?? "",
    version: row?.version ?? "",
    effectiveDate: row?.effectiveDate ?? "",
    fumigantId: row?.fumigantId ?? "",
    applicationMethods: row?.applicationMethods ?? [],
    minTemperature: row?.minTemperature ?? "",
    maxTemperature: row?.maxTemperature ?? "",
    minExposureUnit: row?.minExposureUnit ?? MIN_EXPOSURE_UNITS[0],
    minExposure: row?.minExposure ?? "",
    dosageUnit: row?.dosageUnit ?? DOSAGE_UNITS[0],
    dosageGuide: row?.dosageGuide ?? "",
    restraint: row?.restraint ?? "",
    ventilationPeriod: row?.ventilationPeriod ?? "",
    withholdingPeriod: row?.withholdingPeriod ?? "",
    reEntryPpm: row?.reEntryPpm ?? "",
    safetyNotes: row?.safetyNotes ?? "",
    dosageRanges: row?.dosageRanges ?? [],
  };
}

function isEmptyDosageRange(range) {
  return String(range?.minTempC ?? "").trim() === "" && String(range?.maxTempC ?? "").trim() === "";
}

function sanitizeDosageRanges(draft) {
  return {
    ...draft,
    dosageRanges: (draft.dosageRanges ?? []).filter((range) => !isEmptyDosageRange(range)),
  };
}

function validateDosageRanges(draft) {
  const sanitized = sanitizeDosageRanges(draft);
  if (!sanitized.dosageRanges.length) return { ok: true, draft: sanitized };

  for (const range of sanitized.dosageRanges) {
    if (range.minTempC === "" || range.maxTempC === "") {
      return { ok: false, error: "All dosage ranges must have Min °C and Max °C values." };
    }
    if (Number(range.minTempC) >= Number(range.maxTempC)) {
      return { ok: false, error: "Each dosage range Min °C must be less than Max °C." };
    }
  }

  const sorted = [...sanitized.dosageRanges].sort((a, b) => Number(a.minTempC) - Number(b.minTempC));
  for (let i = 0; i < sorted.length - 1; i++) {
    if (Number(sorted[i].maxTempC) > Number(sorted[i + 1].minTempC)) {
      return {
        ok: false,
        error: `Dosage ranges overlap: band ending at ${sorted[i].maxTempC}°C overlaps band starting at ${sorted[i + 1].minTempC}°C.`,
      };
    }
  }

  return { ok: true, draft: { ...sanitized, dosageRanges: sorted } };
}

export default function FumigationMethodologiesPage() {
  const [rows, setRows] = useState([]);
  const [fumigants, setFumigants] = useState([]);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [modalMode, setModalMode] = useState(null);
  const [draft, setDraft] = useState(() => buildDraft());
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadPageData = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const tenant = getTenantPayload();
      const params = new URLSearchParams({ per_page: "500" });
      if (tenant.organization_id) params.set("organization_id", tenant.organization_id);
      if (tenant.site_id) params.set("site_id", tenant.site_id);
      const query = `?${params.toString()}`;

      const [fumigantsResult, methodologiesResult] = await Promise.all([
        apiRequest(FUMIGANTS_ENDPOINT, query),
        apiRequest(METHODOLOGIES_ENDPOINT, query),
      ]);

      setFumigants(parseList(fumigantsResult).map(fromApiFumigant).filter(Boolean));
      setRows(parseList(methodologiesResult).map(fromApiMethodology).filter(Boolean));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load fumigation data.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      loadPageData();
    });
    return () => cancelAnimationFrame(frame);
  }, [loadPageData]);

  const filteredRows = useMemo(() => {
    if (!search.trim()) return rows;
    const needle = search.toLowerCase();
    return rows.filter((row) => {
      const fumigant = fumigants.find((item) => item.id === row.fumigantId);
      const text = `${row.name} ${row.version} ${fumigant?.name ?? ""}`.toLowerCase();
      return text.includes(needle);
    });
  }, [rows, search, fumigants]);

  const selected = selectedId != null ? rows.find((row) => row.id === selectedId) ?? null : null;
  const modalError = modalMode ? error : "";

  const gridColumns = useMemo(
    () => [
      { key: "name", header: "Name", type: "text", sortable: true, filterable: true, resizable: true },
      { key: "version", header: "Version", type: "text", sortable: true, filterable: true, resizable: true },
      {
        key: "fumigantName",
        header: "Fumigant",
        type: "text",
        sortable: true,
        filterable: true,
        resizable: true,
        valueGetter: (row) => fumigants.find((item) => item.id === row.fumigantId)?.name ?? "—",
      },
      { key: "effectiveDate", header: "Effective", type: "date", sortable: true, filterable: true, resizable: true },
      {
        key: "minExposureDisplay",
        header: "Min exposure",
        type: "text",
        sortable: true,
        filterable: true,
        resizable: true,
        valueGetter: (row) =>
          row.minExposure != null && String(row.minExposure).trim() !== ""
            ? `${row.minExposure} ${row.minExposureUnit ?? ""}`.trim()
            : "—",
      },
    ],
    [fumigants]
  );

  function openAdd() {
    setError("");
    setNotice("");
    setDraft(buildDraft());
    setModalMode("add");
  }

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

  function toggleApplicationMethod(value) {
    setDraft((prev) => {
      const next = new Set(prev.applicationMethods);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return { ...prev, applicationMethods: [...next] };
    });
  }

  function addDosageRange() {
    setDraft((d) => ({
      ...d,
      dosageRanges: [
        ...d.dosageRanges,
        {
          id: Date.now() + d.dosageRanges.length,
          minTempC: "",
          maxTempC: "",
          dosageValue: "",
          dosageUnit: normaliseUnit(d.dosageUnit) || "g/m3",
          exposureValue: "",
          exposureUnit: d.minExposureUnit || "hours",
        },
      ],
    }));
  }

  function updateDosageRange(id, patch) {
    setDraft((d) => ({
      ...d,
      dosageRanges: d.dosageRanges.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    }));
  }

  function removeDosageRange(id) {
    setDraft((d) => ({
      ...d,
      dosageRanges: d.dosageRanges.filter((r) => r.id !== id),
    }));
  }

  async function saveModal() {
    setError("");
    if (!draft.name.trim() || !draft.fumigantId) {
      setError("Name and fumigant are required.");
      return;
    }

    const validation = validateDosageRanges(draft);
    if (!validation.ok) {
      setError(validation.error);
      return;
    }

    const tenant = getTenantPayload();
    if (!tenant.organization_id || !tenant.site_id) {
      setError("Organization and current site are required to save a methodology.");
      return;
    }

    setIsSaving(true);
    setNotice("");

    try {
      const body = toApiPayload(validation.draft);

      if (modalMode === "add") {
        const result = await apiRequest(METHODOLOGIES_ENDPOINT, "", {
          method: "POST",
          body: JSON.stringify(body),
        });
        const nextRow = fromApiMethodology(result.data);
        if (!nextRow) throw new Error("Invalid response from server.");
        setRows((prev) => [nextRow, ...prev]);
        setSelectedId(nextRow.id);
        setNotice(result.message || "Methodology created successfully.");
        setModalMode(null);
        return;
      }

      if (modalMode === "edit" && selected) {
        const result = await apiRequest(METHODOLOGIES_ENDPOINT, `/${selected.id}`, {
          method: "PUT",
          body: JSON.stringify(body),
        });
        const nextRow = fromApiMethodology(result.data);
        if (!nextRow) throw new Error("Invalid response from server.");
        setRows((prev) => prev.map((row) => (row.id === selected.id ? nextRow : row)));
        setNotice(result.message || "Methodology updated successfully.");
        setModalMode(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save methodology.");
    } finally {
      setIsSaving(false);
    }
  }

  async function removeSelected() {
    if (!selected || isDeleting) return;
    const shouldDelete = window.confirm(
      `Delete methodology "${selected.name || selected.version || selected.id}"?`
    );
    if (!shouldDelete) return;

    setIsDeleting(true);
    setError("");
    setNotice("");

    try {
      const result = await apiRequest(METHODOLOGIES_ENDPOINT, `/${selected.id}`, { method: "DELETE" });
      setRows((prev) => prev.filter((row) => row.id !== selected.id));
      setSelectedId(null);
      setNotice(result.message || "Methodology deleted successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete methodology.");
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs text-slate-500">Fumigation / Methodologies</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 md:text-[1.65rem]">
          Fumigation Methodologies
        </h1>
        <p className="mt-1 text-xs text-slate-500">
          Define methodology versions per fumigant, including exposure, dosage, and safety parameters.
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
            placeholder="Search methodology..."
          />
          <div className="ml-auto flex flex-wrap gap-2">
            <Button type="button" size="sm" onClick={openAdd} disabled={isLoading}>
              + Add
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={loadPageData} disabled={isLoading}>
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

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-start">
        <div className="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-sm">
          <Grid
            columns={gridColumns}
            rows={filteredRows}
            getRowId={(row) => row.id}
            theme="light"
            density="standard"
            fileName="Fumigation Methodologies"
            visibleRows={12}
            persistKey="fumigation-methodologies"
            enableGlobalSearch={false}
            loading={isLoading}
            emptyMessage={isLoading ? "Loading methodologies…" : "No methodologies found."}
            onRowClick={(row) => setSelectedId((prev) => (prev === row.id ? null : row.id))}
            onPersistedRowActivate={(row) => setSelectedId(row.id)}
            getRowClassName={({ row }) => (row.id === selectedId ? "clutch-row-selected" : undefined)}
            getRowStyle={({ row }) => (row.id === selectedId ? { backgroundColor: "#dbeafe" } : undefined)}
          />
        </div>

        <aside className="rounded-xl border border-slate-200/90 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">Methodology Details</h2>
          {!selected ? (
            <p className="mt-4 text-sm text-slate-500">Select a row to view details.</p>
          ) : (
            <dl className="mt-4 space-y-3 text-sm">
              <DetailItem label="Name" value={selected.name} highlight />
              <DetailItem label="Version" value={selected.version} />
              <DetailItem
                label="Fumigant"
                value={fumigants.find((item) => item.id === selected.fumigantId)?.name}
              />
              <DetailItem label="Methods" value={selected.applicationMethods.join(", ")} />
              <DetailItem label="Dosage" value={`${selected.dosageGuide || "—"} (${selected.dosageUnit})`} />
              <DetailItem label="Safety notes" value={selected.safetyNotes} />
              <DetailItem
                label="Dosage ranges"
                value={`${selected?.dosageRanges?.length ?? 0} band${(selected?.dosageRanges?.length ?? 0) !== 1 ? "s" : ""}`}
              />
            </dl>
          )}
        </aside>
      </div>

      <Modal
        open={modalMode != null}
        title={modalMode === "edit" ? "Edit methodology" : "Add methodology"}
        onClose={closeModal}
      >
        {modalError ? (
          <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{modalError}</div>
        ) : null}
        <form
          onSubmit={(event) => {
            event.preventDefault();
            saveModal();
          }}
        >
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label="Name *">
            <input
              className={inputClass}
              value={draft.name}
              onChange={(event) => setDraft((prev) => ({ ...prev, name: event.target.value }))}
            />
          </FormField>
          <FormField label="Version">
            <input
              className={inputClass}
              value={draft.version}
              onChange={(event) => setDraft((prev) => ({ ...prev, version: event.target.value }))}
            />
          </FormField>
          <FormField label="Effective date">
            <input
              className={inputClass}
              type="date"
              value={draft.effectiveDate}
              onChange={(event) => setDraft((prev) => ({ ...prev, effectiveDate: event.target.value }))}
            />
          </FormField>
          <FormField label="Fumigant *">
            <select
              className={inputClass}
              value={draft.fumigantId}
              onChange={(event) => setDraft((prev) => ({ ...prev, fumigantId: event.target.value }))}
            >
              <option value="">Select...</option>
              {fumigants.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.code} - {item.name}
                </option>
              ))}
            </select>
          </FormField>

          <FormField label="Application methods" wide>
            <div className="flex flex-wrap gap-3 rounded-lg border border-slate-200/95 bg-white p-3">
              {APPLICATION_METHODS.map((value) => (
                <label key={value} className="inline-flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={draft.applicationMethods.includes(value)}
                    onChange={() => toggleApplicationMethod(value)}
                  />
                  {value}
                </label>
              ))}
            </div>
          </FormField>

          <FormField label="Min temperature">
            <input
              className={inputClass}
              type="number"
              step="any"
              value={draft.minTemperature}
              onChange={(event) => setDraft((prev) => ({ ...prev, minTemperature: event.target.value }))}
            />
          </FormField>
          <FormField label="Max temperature">
            <input
              className={inputClass}
              type="number"
              step="any"
              value={draft.maxTemperature}
              onChange={(event) => setDraft((prev) => ({ ...prev, maxTemperature: event.target.value }))}
            />
          </FormField>
          <FormField label="Min exposure unit">
            <select
              className={inputClass}
              value={draft.minExposureUnit}
              onChange={(event) => setDraft((prev) => ({ ...prev, minExposureUnit: event.target.value }))}
            >
              {MIN_EXPOSURE_UNITS.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Min exposure">
            <input
              className={inputClass}
              type="number"
              step="any"
              value={draft.minExposure}
              onChange={(event) => setDraft((prev) => ({ ...prev, minExposure: event.target.value }))}
            />
          </FormField>
          <FormField label="Dosage unit">
            <select
              className={inputClass}
              value={draft.dosageUnit}
              onChange={(event) => setDraft((prev) => ({ ...prev, dosageUnit: event.target.value }))}
            >
              {DOSAGE_UNITS.map((value) => (
                <option key={value} value={value}>
                  {value}
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
          <FormField label="Dosage guide" wide>
            <textarea
              className={cn(inputClass, "min-h-16 resize-y")}
              value={draft.dosageGuide}
              rows={2}
              onChange={(event) => setDraft((prev) => ({ ...prev, dosageGuide: event.target.value }))}
            />
          </FormField>
          <FormField label="Restraint" wide>
            <textarea
              className={cn(inputClass, "min-h-16 resize-y")}
              value={draft.restraint}
              rows={2}
              onChange={(event) => setDraft((prev) => ({ ...prev, restraint: event.target.value }))}
            />
          </FormField>
          <FormField label="Ventilation period">
            <input
              className={inputClass}
              type="number"
              step="any"
              value={draft.ventilationPeriod}
              onChange={(event) => setDraft((prev) => ({ ...prev, ventilationPeriod: event.target.value }))}
            />
          </FormField>
          <FormField label="Withholding period">
            <input
              className={inputClass}
              type="number"
              step="any"
              value={draft.withholdingPeriod}
              onChange={(event) => setDraft((prev) => ({ ...prev, withholdingPeriod: event.target.value }))}
            />
          </FormField>
          <FormField label="General safety / venting notes" wide>
            <textarea
              className={cn(inputClass, "min-h-20 resize-y")}
              rows={3}
              value={draft.safetyNotes}
              onChange={(event) => setDraft((prev) => ({ ...prev, safetyNotes: event.target.value }))}
            />
          </FormField>

          <div className="col-span-2 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-slate-700">Dosage ranges</p>
              <button
                type="button"
                onClick={addDosageRange}
                className="text-xs text-brand hover:underline"
              >
                + Add range
              </button>
            </div>
            {draft.dosageRanges.length > 0 && (
              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-2 py-1.5 text-left font-medium text-slate-600">Min °C</th>
                      <th className="px-2 py-1.5 text-left font-medium text-slate-600">Max °C</th>
                      <th className="px-2 py-1.5 text-left font-medium text-slate-600">Dosage</th>
                      <th className="px-2 py-1.5 text-left font-medium text-slate-600">Unit</th>
                      <th className="px-2 py-1.5 text-left font-medium text-slate-600">Exposure</th>
                      <th className="px-2 py-1.5 text-left font-medium text-slate-600">Unit</th>
                      <th className="px-2 py-1.5"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {draft.dosageRanges.map((r) => (
                      <tr key={r.id} className="border-t border-slate-100">
                        <td className="px-1 py-1">
                          <input
                            type="number"
                            value={r.minTempC}
                            onChange={(e) => updateDosageRange(r.id, { minTempC: e.target.value })}
                            className="w-16 rounded border border-slate-200 px-1.5 py-0.5 text-xs outline-none focus:border-brand/40"
                            placeholder="e.g. 10"
                          />
                        </td>
                        <td className="px-1 py-1">
                          <input
                            type="number"
                            value={r.maxTempC}
                            onChange={(e) => updateDosageRange(r.id, { maxTempC: e.target.value })}
                            className="w-16 rounded border border-slate-200 px-1.5 py-0.5 text-xs outline-none focus:border-brand/40"
                            placeholder="e.g. 15"
                          />
                        </td>
                        <td className="px-1 py-1">
                          <input
                            type="number"
                            value={r.dosageValue}
                            onChange={(e) => updateDosageRange(r.id, { dosageValue: e.target.value })}
                            className="w-16 rounded border border-slate-200 px-1.5 py-0.5 text-xs outline-none focus:border-brand/40"
                            placeholder="e.g. 2.0"
                          />
                        </td>
                        <td className="px-1 py-1">
                          <select
                            value={r.dosageUnit}
                            onChange={(e) => updateDosageRange(r.id, { dosageUnit: e.target.value })}
                            className="rounded border border-slate-200 px-1 py-0.5 text-xs outline-none focus:border-brand/40"
                          >
                            {["g/m3", "ppm", "mg/L", "%"].map((u) => (
                              <option key={u} value={u}>{u}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-1 py-1">
                          <input
                            type="number"
                            value={r.exposureValue}
                            onChange={(e) => updateDosageRange(r.id, { exposureValue: e.target.value })}
                            className="w-16 rounded border border-slate-200 px-1.5 py-0.5 text-xs outline-none focus:border-brand/40"
                            placeholder="e.g. 168"
                          />
                        </td>
                        <td className="px-1 py-1">
                          <select
                            value={r.exposureUnit}
                            onChange={(e) => updateDosageRange(r.id, { exposureUnit: e.target.value })}
                            className="rounded border border-slate-200 px-1 py-0.5 text-xs outline-none focus:border-brand/40"
                          >
                            {["hours", "days"].map((u) => (
                              <option key={u} value={u}>{u}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-1 py-1">
                          <button
                            type="button"
                            onClick={() => removeDosageRange(r.id)}
                            className="text-slate-400 hover:text-red-500"
                            title="Remove"
                          >
                            ×
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {draft.dosageRanges.length === 0 && (
              <p className="text-xs text-slate-400 italic">No dosage ranges defined. Click "+ Add range" to add one.</p>
            )}
            {modalError ? (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{modalError}</div>
            ) : null}
            <p className="text-xs text-slate-400">Bands use half-open intervals [Min, Max) — e.g. 15°C falls in [15,20), not [10,15).</p>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={closeModal} disabled={isSaving}>
            Cancel
          </Button>
          <Button type="submit" size="sm" disabled={isSaving}>
            {isSaving ? "Saving…" : modalMode === "edit" ? "Save changes" : "Create"}
          </Button>
        </div>
        </form>
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
      <div className="relative max-h-[min(90vh,760px)] w-full max-w-4xl overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl">
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
