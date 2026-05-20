"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { Grid } from "@/components/clutch-table";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const MOBILE_BREAKPOINT = 900;
const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api"
).replace(/\/+$/, "");
const COMMODITIES_ENDPOINT = `${API_BASE_URL}/reference-data/commodities`;
const COMMODITIES_FORM_DATA_ENDPOINT = `${API_BASE_URL}/reference-data/commodities/form-data`;

const inputClass =
  "w-full rounded-lg border border-slate-200/95 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-brand/15 placeholder:text-slate-400 focus:border-brand/35 focus:ring-2";

const baseConfig = {
  title: "Commodities",
  subtitle: "Manage commodities, classifications, and thresholds.",
  columns: [
    { key: "commodityCode", label: "CODE" },
    { key: "description", label: "DESCRIPTION" },
    { key: "commodityType", label: "TYPE" },
    { key: "status", label: "STATUS" },
    { key: "shrinkAmount", label: "SHRINK" },
  ],
  staticFormFields: [
    { key: "commodityCode", label: "COMMODITY CODE", required: true, placeholder: "e.g., COM-001" },
    { key: "description", label: "DESCRIPTION", required: true, placeholder: "e.g., Australian Hard Wheat" },
    { key: "hsCode", label: "HS CODE", placeholder: "e.g., 1001.99.00" },
    { key: "pemsCode", label: "PEMS CODE", placeholder: "e.g., PEMS-12345" },
    {
      key: "status",
      label: "STATUS",
      type: "select",
      options: ["Active", "Inactive"],
    },
    {
      key: "unitType",
      label: "UNIT TYPE",
      type: "select",
      options: ["kg (Kilograms)", "t (Tonnes)", "lb (Pounds)", "g (Grams)"],
    },
    { key: "testThresholds", label: "TEST THRESHOLDS", type: "testThresholds", wide: true },
    { key: "shrinkAmount", label: "SHRINK AMOUNT", placeholder: "e.g., 2%" },
  ],
};

const gridColumns = baseConfig.columns.map((col) => ({
  key: col.key,
  header: col.label,
  type: col.numeric ? "number" : "text",
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

async function commodityRequest(path = "", options = {}) {
  const response = await fetch(`${COMMODITIES_ENDPOINT}${path}`, {
    ...options,
    headers: {
      ...getAuthHeaders(),
      ...(options.headers || {}),
    },
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || result?.success === false) {
    throw new Error(extractApiError(result, "Commodity request failed."));
  }
  return result;
}

async function loadFormData() {
  const tenant = getTenantPayload();
  const query = new URLSearchParams(tenant).toString();
  const response = await fetch(`${COMMODITIES_FORM_DATA_ENDPOINT}${query ? `?${query}` : ""}`, {
    headers: getAuthHeaders(),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || result?.success === false) {
    throw new Error(extractApiError(result, "Unable to load commodity form data."));
  }
  return result?.data ?? {};
}

function normalizeTestThresholds(items) {
  if (!Array.isArray(items)) return [];
  return items.map((item) => ({
    test: String(item?.test ?? ""),
    min: item?.min != null ? String(item.min) : "",
    max: item?.max != null ? String(item.max) : "",
  }));
}

function fromApiCommodity(row) {
  if (!row) return null;
  return {
    id: row.id,
    commodityTypeId: row.commodity_type_id ?? row.commodityTypeId ?? "",
    commodityType: row.commodity_type?.name ?? row.commodityTypeName ?? "",
    commodityCode: row.commodity_code ?? row.commodityCode ?? "",
    description: row.description ?? "",
    hsCode: row.hs_code ?? row.hsCode ?? "",
    pemsCode: row.pems_code ?? row.pemsCode ?? "",
    status: row.status ?? "Active",
    unitType: row.unit_type ?? row.unitType ?? "",
    testThresholds: normalizeTestThresholds(row.test_thresholds ?? row.testThresholds),
    shrinkAmount: row.shrink_amount ?? row.shrinkAmount ?? "",
  };
}

function toApiPayload(draft, commodityTypes) {
  const tenant = getTenantPayload();
  const selectedType = commodityTypes.find((type) => type.name === draft.commodityType);

  return {
    ...tenant,
    commodity_type_id: selectedType?.id ?? draft.commodityTypeId ?? null,
    commodityType: draft.commodityType,
    commodity_code: String(draft.commodityCode ?? "").trim(),
    description: String(draft.description ?? "").trim(),
    hs_code: String(draft.hsCode ?? "").trim() || null,
    pems_code: String(draft.pemsCode ?? "").trim() || null,
    status: draft.status || "Active",
    unit_type: draft.unitType || null,
    shrink_amount: String(draft.shrinkAmount ?? "").trim() || null,
    test_thresholds: normalizeTestThresholds(draft.testThresholds).filter((item) => item.test),
  };
}

function buildDraft(row) {
  const next = {
    commodityType: "",
    commodityCode: "",
    description: "",
    hsCode: "",
    pemsCode: "",
    status: "Active",
    unitType: "",
    testThresholds: [],
    shrinkAmount: "",
  };

  if (!row) return next;

  return {
    ...next,
    commodityType: row.commodityType ?? "",
    commodityTypeId: row.commodityTypeId ?? "",
    commodityCode: row.commodityCode ?? "",
    description: row.description ?? "",
    hsCode: row.hsCode ?? "",
    pemsCode: row.pemsCode ?? "",
    status: row.status ?? "Active",
    unitType: row.unitType ?? "",
    testThresholds: normalizeTestThresholds(row.testThresholds),
    shrinkAmount: row.shrinkAmount ?? "",
  };
}

function parseFieldValue(field, value) {
  if (field.type === "testThresholds") return value;
  if (field.type !== "number") return value;
  if (value === "") return "";
  const parsed = Number(value);
  return Number.isNaN(parsed) ? value : String(parsed);
}

export default function CommodityPage() {
  const [rows, setRows] = useState([]);
  const [commodityTypes, setCommodityTypes] = useState([]);
  const [testDefinitions, setTestDefinitions] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [modalMode, setModalMode] = useState(null);
  const [draft, setDraft] = useState(() => buildDraft());
  const [isMobile, setIsMobile] = useState(false);
  const [showGoToTop, setShowGoToTop] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const formFields = useMemo(() => {
    const typeNames = commodityTypes.map((type) => type.name).filter(Boolean);
    return [
      {
        key: "commodityType",
        label: "COMMODITY TYPE",
        required: true,
        type: "select",
        options: typeNames,
      },
      ...baseConfig.staticFormFields,
    ];
  }, [commodityTypes]);

  const loadCommodities = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const [listResult, formData] = await Promise.all([
        commodityRequest("?per_page=500"),
        loadFormData(),
      ]);

      const pager = listResult?.data;
      const apiRows = Array.isArray(pager?.data) ? pager.data : Array.isArray(pager) ? pager : [];
      setRows(apiRows.map(fromApiCommodity).filter(Boolean));
      setCommodityTypes(Array.isArray(formData.commodity_types) ? formData.commodity_types : []);
      setTestDefinitions(Array.isArray(formData.tests) ? formData.tests : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load commodities.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      loadCommodities();
    });
    return () => cancelAnimationFrame(frame);
  }, [loadCommodities]);

  useEffect(() => {
    const query = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const handleMedia = () => setIsMobile(query.matches);
    handleMedia();
    query.addEventListener("change", handleMedia);
    return () => query.removeEventListener("change", handleMedia);
  }, []);

  useEffect(() => {
    if (!isMobile) {
      return;
    }
    const onScroll = () => setShowGoToTop(window.scrollY > 400);
    onScroll();
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, [isMobile]);

  const selected = selectedId != null ? rows.find((row) => row.id === selectedId) ?? null : null;
  const modalError = modalMode ? error : "";

  function openAddModal() {
    setError("");
    setNotice("");
    setDraft(buildDraft());
    setModalMode("add");
  }

  function openEditModal() {
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
    const requiredMissing = formFields.some((field) => {
      if (!field.required) return false;
      if (field.type === "testThresholds") return false;
      return !String(draft[field.key] ?? "").trim();
    });

    if (requiredMissing) {
      setError("Please fill all required fields.");
      return;
    }

    const tenant = getTenantPayload();
    if (!tenant.organization_id || !tenant.site_id) {
      setError("Organization and current site are required to save a commodity.");
      return;
    }

    const normalized = {};
    for (const field of formFields) {
      normalized[field.key] = parseFieldValue(field, draft[field.key] ?? "");
    }

    setIsSaving(true);
    setError("");
    setNotice("");

    try {
      const body = toApiPayload({ ...draft, ...normalized }, commodityTypes);

      if (modalMode === "add") {
        const result = await commodityRequest("", {
          method: "POST",
          body: JSON.stringify(body),
        });
        const nextRow = fromApiCommodity(result.data);
        if (!nextRow) throw new Error("Invalid response from server.");
        setRows((prev) => [nextRow, ...prev]);
        setSelectedId(nextRow.id);
        setNotice(result.message || "Commodity created successfully.");
        setModalMode(null);
        return;
      }

      if (modalMode === "edit" && selected) {
        const result = await commodityRequest(`/${selected.id}`, {
          method: "PUT",
          body: JSON.stringify(body),
        });
        const nextRow = fromApiCommodity(result.data);
        if (!nextRow) throw new Error("Invalid response from server.");
        setRows((prev) => prev.map((row) => (row.id === selected.id ? nextRow : row)));
        setNotice(result.message || "Commodity updated successfully.");
        setModalMode(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save commodity.");
    } finally {
      setIsSaving(false);
    }
  }

  async function removeSelected() {
    if (!selected || isDeleting) return;
    if (!window.confirm(`Delete commodity "${selected.description || selected.commodityCode}"?`)) return;

    setIsDeleting(true);
    setError("");
    setNotice("");

    try {
      const result = await commodityRequest(`/${selected.id}`, { method: "DELETE" });
      setRows((prev) => prev.filter((row) => row.id !== selected.id));
      setSelectedId(null);
      setNotice(result.message || "Commodity deleted successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete commodity.");
    } finally {
      setIsDeleting(false);
    }
  }

  const toolbarActions = (
    <div className="flex flex-wrap gap-2">
      <Button type="button" size="sm" onClick={openAddModal} disabled={isLoading}>
        + Add
      </Button>
      <Button type="button" variant="outline" size="sm" onClick={loadCommodities} disabled={isLoading}>
        Refresh
      </Button>
      <Button type="button" variant="outline" size="sm" disabled={!selected || isLoading} onClick={openEditModal}>
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
  );

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs text-slate-500">Product Settings / {baseConfig.title}</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 md:text-[1.65rem]">{baseConfig.title}</h1>
        {!isMobile ? <p className="mt-1 text-xs text-slate-500">{baseConfig.subtitle}</p> : null}
      </div>

      {!modalMode && error ? (
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
              <MobileList
                rows={rows}
                selectedId={selectedId}
                onSelect={setSelectedId}
                search=""
                title={baseConfig.title}
                isLoading={isLoading}
                primaryKey={baseConfig.columns[0]?.key}
                secondaryKey={baseConfig.columns[2]?.key ?? baseConfig.columns[1]?.key}
                summaryKeys={baseConfig.columns.slice(1, 4).map((column) => column.key)}
              />
            </>
          ) : (
            <Grid
              columns={gridColumns}
              rows={rows}
              getRowId={(row) => row.id}
              theme="light"
              density="standard"
              fileName={baseConfig.title}
              visibleRows={10}
              loading={isLoading}
              emptyMessage={isLoading ? "Loading commodities…" : "No commodities found."}
              onRowClick={(row) => setSelectedId((prev) => (prev === row.id ? null : row.id))}
              getRowClassName={({ row }) => (row.id === selectedId ? "clutch-row-selected" : undefined)}
              toolbarActions={toolbarActions}
            />
          )}
        </div>

        {!isMobile ? (
          <aside className="rounded-xl border border-slate-200/90 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900">{baseConfig.title} Details</h2>
            {!selected ? (
              <p className="mt-4 text-sm leading-relaxed text-slate-500">Select a row to view details.</p>
            ) : (
              <dl className="mt-4 space-y-3 text-sm">
                {baseConfig.columns.map((column) => (
                  <DetailItem
                    key={column.key}
                    label={column.label}
                    value={selected[column.key]}
                    highlight={column === baseConfig.columns[0]}
                  />
                ))}
              </dl>
            )}
          </aside>
        ) : null}
      </div>

      <Modal
        open={modalMode != null}
        title={modalMode === "edit" ? `Edit ${baseConfig.title}` : `Add ${baseConfig.title}`}
        onClose={closeModal}
      >
        {modalError ? (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-600">{modalError}</div>
        ) : null}
        <div className="grid gap-3 sm:grid-cols-2">
          {formFields.map((field) => (
            <FormField
              key={field.key}
              field={field}
              value={draft[field.key] ?? (field.type === "testThresholds" ? [] : "")}
              disabled={isSaving}
              testDefinitions={testDefinitions}
              onChange={(value) => setDraft((prev) => ({ ...prev, [field.key]: value }))}
            />
          ))}
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

      {isMobile && showGoToTop ? (
        <button
          type="button"
          aria-label="Go to top"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="fixed bottom-5 right-5 z-50 flex size-12 items-center justify-center rounded-full bg-gradient-to-br from-brand to-blue-500 text-xl text-white shadow-lg shadow-blue-500/30"
        >
          ↑
        </button>
      ) : null}
    </div>
  );
}

function FormField({ field, value, onChange, disabled, testDefinitions }) {
  return (
    <div className={cn("space-y-1", field.wide && "sm:col-span-2", field.type === "textarea" && "sm:col-span-2")}>
      <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">
        {field.label}
        {field.required ? <span className="text-red-500"> *</span> : null}
      </label>
      {field.type === "select" ? (
        <select
          className={inputClass}
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
        >
          <option value="">Select...</option>
          {field.options?.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      ) : field.type === "textarea" ? (
        <textarea
          className={cn(inputClass, "min-h-20 resize-y")}
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          placeholder={field.placeholder}
          rows={3}
        />
      ) : field.type === "testThresholds" ? (
        <div className="space-y-3">
          <div className="rounded-md border border-amber-200 bg-[#fff8e1] p-3 text-xs text-amber-900 shadow-sm">
            <span className="font-bold text-amber-950">Note:</span> Each commodity IS a specific grade. Tests help identify
            and confirm the commodity. Example: Create separate commodities for &quot;Wheat Grade 1&quot;, &quot;Wheat Grade 2&quot;, etc.
          </div>

          <div className="space-y-2">
            {(value || []).map((item, index) => (
              <div
                key={index}
                className="flex items-start gap-2 rounded-md border border-slate-200 bg-slate-50/50 p-2 shadow-sm"
              >
                <div className="flex-1 space-y-1">
                  <label className="text-[10px] font-semibold uppercase text-slate-500">Test</label>
                  <select
                    className={inputClass}
                    value={item.test}
                    disabled={disabled}
                    onChange={(e) => {
                      const next = [...value];
                      next[index] = { ...next[index], test: e.target.value };
                      onChange(next);
                    }}
                  >
                    <option value="">Select test</option>
                    {testDefinitions.map((test) => (
                      <option key={test.id} value={test.name}>
                        {test.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="w-20 space-y-1">
                  <label className="text-[10px] font-semibold uppercase text-slate-500">Min</label>
                  <input
                    type="number"
                    className={inputClass}
                    value={item.min}
                    disabled={disabled}
                    onChange={(e) => {
                      const next = [...value];
                      next[index] = { ...next[index], min: e.target.value };
                      onChange(next);
                    }}
                    placeholder="0"
                  />
                </div>
                <div className="w-20 space-y-1">
                  <label className="text-[10px] font-semibold uppercase text-slate-500">Max</label>
                  <input
                    type="number"
                    className={inputClass}
                    value={item.max}
                    disabled={disabled}
                    onChange={(e) => {
                      const next = [...value];
                      next[index] = { ...next[index], max: e.target.value };
                      onChange(next);
                    }}
                    placeholder="100"
                  />
                </div>
                <div className="pt-[22px]">
                  <button
                    type="button"
                    disabled={disabled}
                    className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-md border border-red-200 bg-red-50 text-red-500 transition-colors hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-500/30 disabled:opacity-50"
                    onClick={() => {
                      const next = [...value];
                      next.splice(index, 1);
                      onChange(next);
                    }}
                  >
                    ×
                  </button>
                </div>
              </div>
            ))}
          </div>

          <Button
            type="button"
            variant="default"
            disabled={disabled}
            className="w-full bg-blue-500 text-white shadow-sm hover:bg-blue-600"
            onClick={() => {
              onChange([...(value || []), { test: "", min: "", max: "" }]);
            }}
          >
            + Add Test Threshold
          </Button>
        </div>
      ) : (
        <input
          type={field.type || "text"}
          className={inputClass}
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          placeholder={field.placeholder}
        />
      )}
    </div>
  );
}

function MobileList({ rows, selectedId, onSelect, search, title, primaryKey, secondaryKey, summaryKeys, isLoading }) {
  const emptyMessage = isLoading
    ? `Loading ${title.toLowerCase()}…`
    : search
      ? `No ${title.toLowerCase()} match your search.`
      : `No ${title.toLowerCase()} found. Add your first one!`;
  return (
    <div className="space-y-2 p-3">
      <div className="px-0.5 text-xs font-semibold text-slate-600">
        {title} ({rows.length})
      </div>
      {rows.length === 0 ? (
        <div className="py-8 text-center text-sm text-slate-400">{emptyMessage}</div>
      ) : (
        rows.map((row) => {
          const isSelected = row.id === selectedId;
          const summary = summaryKeys.map((key) => row[key]).filter(Boolean).join(" · ");
          return (
            <button
              key={row.id}
              type="button"
              onClick={() => onSelect(isSelected ? null : row.id)}
              className={cn(
                "w-full rounded-xl border-2 px-3 py-3 text-left transition-colors",
                isSelected ? "border-blue-500 bg-blue-50" : "border-slate-200 bg-white"
              )}
            >
              <p className="text-xs font-bold text-blue-600">{row[primaryKey] || "—"}</p>
              <p className="mt-1 text-sm font-semibold text-slate-800">{row[secondaryKey] || "—"}</p>
              <p className="mt-1 text-[11px] text-slate-500">{summary || "—"}</p>
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
      <dd className={cn("mt-0.5 text-slate-800", highlight && "font-semibold text-brand")}>{value || "—"}</dd>
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
        aria-labelledby="reference-data-modal-title"
        className="relative max-h-[min(90vh,720px)] w-full max-w-2xl overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-4 py-3">
          <h2 id="reference-data-modal-title" className="text-sm font-semibold text-slate-900">
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
