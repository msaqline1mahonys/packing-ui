"use client";

import { useCallback, useEffect, useState } from "react";

import { Grid } from "@/components/clutch-table";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const MOBILE_BREAKPOINT = 900;
const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api"
).replace(/\/+$/, "");
const ENDPOINT = `${API_BASE_URL}/product-settings/commodities`;
const FORM_DATA_ENDPOINT = `${ENDPOINT}/form-data`;
const TESTS_ENDPOINT = `${API_BASE_URL}/product-settings/tests`;

const inputClass =
  "w-full rounded-lg border border-slate-200/95 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-brand/15 placeholder:text-slate-400 focus:border-brand/35 focus:ring-2";
"w-full rounded-lg border border-slate-200/95 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-brand/15 placeholder:text-slate-400 focus:border-brand/35 focus:ring-2";

const UNIT_TYPE_OPTIONS = ["kg (Kilograms)", "t (Tonnes)", "lb (Pounds)", "g (Grams)"];

const config = {
  title: "Commodities",
  subtitle: "Manage commodities, classifications, and thresholds.",
  columns: [
    { key: "commodityCode", label: "CODE" },
    { key: "description", label: "DESCRIPTION" },
    { key: "commodityType", label: "TYPE" },
    { key: "status", label: "STATUS" },
    { key: "shrinkAmount", label: "SHRINK" },
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

function buildDraft(row) {
  return {
    commodityTypeId: row?.commodityTypeId ?? "",
    commodityCode: row?.commodityCode ?? "",
    description: row?.description ?? "",
    hsCode: row?.hsCode ?? "",
    pemsCode: row?.pemsCode ?? "",
    status: row?.status ?? "",
    unitType: row?.unitType ?? "",
    testThresholds: row?.testThresholds ?? [],
    shrinkAmount: row?.shrinkAmount ?? "",
  };
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

function fromApi(row) {
  if (!row) return null;
  return {
    id: row.id,
    commodityTypeId: row.commodity_type_id ?? "",
    commodityType: row.commodity_type?.name ?? "",
    commodityCode: row.commodity_code ?? "",
    description: row.description ?? "",
    hsCode: row.hs_code ?? "",
    pemsCode: row.pems_code ?? "",
    status: row.status ?? "",
    unitType: row.unit_type ?? "",
    testThresholds: Array.isArray(row.test_thresholds) ? row.test_thresholds : [],
    shrinkAmount: row.shrink_amount ?? "",
  };
}

function toApiPayload(draft) {
  return {
    ...getTenantPayload(),
    commodity_type_id: draft.commodityTypeId || null,
    commodity_code: String(draft.commodityCode ?? "").trim() || null,
    description: String(draft.description ?? "").trim() || null,
    hs_code: String(draft.hsCode ?? "").trim() || null,
    pems_code: String(draft.pemsCode ?? "").trim() || null,
    status: String(draft.status ?? "").trim() || null,
    unit_type: String(draft.unitType ?? "").trim() || null,
    test_thresholds: (draft.testThresholds || []).filter((t) => t.test),
    shrink_amount: String(draft.shrinkAmount ?? "").trim() || null,
  };
}

export default function CommodityPage() {
  const [rows, setRows] = useState([]);
  const [commodityTypes, setCommodityTypes] = useState([]);
  const [tests, setTests] = useState([]);
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

  const loadRows = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const payload = await apiRequest(`${ENDPOINT}?per_page=100`);
      const apiRows = Array.isArray(payload?.data) ? payload.data : Array.isArray(payload) ? payload : [];
      setRows(apiRows.map(fromApi).filter(Boolean));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load commodities.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadFormData = useCallback(async () => {
    try {
      const [formData, testsPayload] = await Promise.all([
        apiRequest(FORM_DATA_ENDPOINT),
        apiRequest(`${TESTS_ENDPOINT}?per_page=100`),
      ]);
      setCommodityTypes(Array.isArray(formData?.commodity_types) ? formData.commodity_types : []);
      const testRows = Array.isArray(testsPayload?.data) ? testsPayload.data : Array.isArray(testsPayload) ? testsPayload : [];
      setTests(testRows);
    } catch {
      // non-critical — form dropdowns will be empty but page still works
    }
  }, []);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      loadRows();
      loadFormData();
    });
    return () => cancelAnimationFrame(frame);
  }, [loadRows, loadFormData]);

  useEffect(() => {
    const query = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const handleMedia = () => setIsMobile(query.matches);
    handleMedia();
    query.addEventListener("change", handleMedia);
    return () => query.removeEventListener("change", handleMedia);
  }, []);
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
    if (!String(draft.commodityCode ?? "").trim() || !String(draft.description ?? "").trim()) {
      setError("Commodity Code and Description are required.");
      return;
    }

    const tenant = getTenantPayload();
    if (!tenant.organization_id || !tenant.site_id) {
      setError("Organization and current site are required to save a commodity.");
      return;
    }

    setIsSaving(true);
    setError("");
    setNotice("");

    try {
      if (modalMode === "add") {
        const payload = await apiRequest(ENDPOINT, {
          method: "POST",
          body: JSON.stringify(toApiPayload(draft)),
        });
        const nextRow = fromApi(payload);
        if (!nextRow) throw new Error("Invalid response from server.");
        setRows((prev) => [nextRow, ...prev]);
        setSelectedId(nextRow.id);
        setNotice("Commodity created successfully.");
        setModalMode(null);
        return;
      }

      if (modalMode === "edit" && selected) {
        const payload = await apiRequest(`${ENDPOINT}/${selected.id}`, {
          method: "PUT",
          body: JSON.stringify(toApiPayload(draft)),
        });
        const nextRow = fromApi(payload);
        if (!nextRow) throw new Error("Invalid response from server.");
        setRows((prev) => prev.map((row) => (row.id === selected.id ? nextRow : row)));
        setNotice("Commodity updated successfully.");
        setModalMode(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save commodity.");
    } finally {
      setIsSaving(false);
    }
  };

  const removeSelected = async () => {
    if (!selected || isDeleting) return;
    const shouldDelete = window.confirm(`Delete commodity "${selected.commodityCode || selected.id}"?`);
    if (!shouldDelete) return;

    setIsDeleting(true);
    setError("");
    setNotice("");

    try {
      await apiRequest(`${ENDPOINT}/${selected.id}`, { method: "DELETE" });
      setRows((prev) => prev.filter((row) => row.id !== selected.id));
      setSelectedId(null);
      setNotice("Commodity deleted successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete commodity.");
    } finally {
      setIsDeleting(false);
    }
  };

  const modalError = modalMode ? error : "";

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs text-slate-500">Product Settings / {config.title}</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 md:text-[1.65rem]">{config.title}</h1>
        {!isMobile ? <p className="mt-1 text-xs text-slate-500">{config.subtitle}</p> : null}
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
              <div className="flex flex-wrap gap-2 border-b border-slate-100 p-3">
                <Button type="button" size="sm" onClick={openAddModal} disabled={isLoading}>+ Add</Button>
                <Button type="button" variant="outline" size="sm" onClick={loadRows} disabled={isLoading}>Refresh</Button>
                <Button type="button" variant="outline" size="sm" disabled={!selected || isLoading} onClick={openEditModal}>Edit</Button>
                <Button type="button" variant="destructive" size="sm" disabled={!selected || isLoading || isDeleting} onClick={removeSelected}>
                  {isDeleting ? "Deleting…" : "Delete"}
                </Button>
              </div>
              <MobileList
                rows={rows}
                selectedId={selectedId}
                onSelect={setSelectedId}
                search=""
                title={config.title}
                isLoading={isLoading}
                primaryKey={config.columns[0]?.key}
                secondaryKey={config.columns[2]?.key ?? config.columns[1]?.key}
                summaryKeys={config.columns.slice(1, 4).map((column) => column.key)}
              />
            </>
          ) : (
            <Grid
              columns={gridColumns}
              rows={rows}
              getRowId={(row) => row.id}
              theme="light"
              density="standard"
              fileName={config.title}
              visibleRows={10}
              loading={isLoading}
              emptyMessage={isLoading ? "Loading commodities…" : "No commodities found."}
              onRowClick={(row) => setSelectedId((prev) => (prev === row.id ? null : row.id))}
              getRowClassName={({ row }) => row.id === selectedId ? "clutch-row-selected" : undefined}
              toolbarActions={
                <div className="flex flex-wrap gap-2">
                  <Button type="button" size="sm" onClick={openAddModal} disabled={isLoading}>+ Add</Button>
                  <Button type="button" variant="outline" size="sm" onClick={loadRows} disabled={isLoading}>Refresh</Button>
                  <Button type="button" variant="outline" size="sm" disabled={!selected || isLoading} onClick={openEditModal}>Edit</Button>
                  <Button type="button" variant="destructive" size="sm" disabled={!selected || isLoading || isDeleting} onClick={removeSelected}>
                    {isDeleting ? "Deleting…" : "Delete"}
                  </Button>
                </div>
              }
            />
          )}
        </div>

        {!isMobile ? (
          <aside className="rounded-xl border border-slate-200/90 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900">{config.title} Details</h2>
            {!selected ? (
              <p className="mt-4 text-sm leading-relaxed text-slate-500">Select a row to view details.</p>
            ) : (
              <dl className="mt-4 space-y-3 text-sm">
                {config.columns.map((column) => (
                  <DetailItem key={column.key} label={column.label} value={selected[column.key]} highlight={column === config.columns[0]} />
                ))}
              </dl>
            )}
          </aside>
        ) : null}
      </div>

      <Modal open={modalMode != null} title={modalMode === "edit" ? `Edit ${config.title}` : `Add ${config.title}`} onClose={closeModal}>
        {modalError ? (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-600">{modalError}</div>
        ) : null}
        <div className="grid gap-3 sm:grid-cols-2">
          {/* Commodity Type */}
          <FormField
            label="COMMODITY TYPE"
            wide={false}
            required={false}
            disabled={isSaving}
            renderInput={() => (
              <select
                suppressHydrationWarning
                className={inputClass}
                value={draft.commodityTypeId}
                disabled={isSaving}
                onChange={(e) => setDraft((prev) => ({ ...prev, commodityTypeId: e.target.value }))}
              >
                <option value="">Select...</option>
                {commodityTypes.map((ct) => (
                  <option key={ct.id} value={ct.id}>{ct.name}</option>
                ))}
              </select>
            )}
          />
          {/* Commodity Code */}
          <FormField
            label="COMMODITY CODE"
            required
            disabled={isSaving}
            renderInput={() => (
              <input
                suppressHydrationWarning
                type="text"
                className={inputClass}
                value={draft.commodityCode}
                disabled={isSaving}
                onChange={(e) => setDraft((prev) => ({ ...prev, commodityCode: e.target.value }))}
                placeholder="e.g., COM-001"
              />
            )}
          />
          {/* Description */}
          <FormField
            label="DESCRIPTION"
            required
            disabled={isSaving}
            renderInput={() => (
              <input
                suppressHydrationWarning
                type="text"
                className={inputClass}
                value={draft.description}
                disabled={isSaving}
                onChange={(e) => setDraft((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="e.g., Australian Hard Wheat"
              />
            )}
          />
          {/* HS Code */}
          <FormField
            label="HS CODE"
            disabled={isSaving}
            renderInput={() => (
              <input
                suppressHydrationWarning
                type="text"
                className={inputClass}
                value={draft.hsCode}
                disabled={isSaving}
                onChange={(e) => setDraft((prev) => ({ ...prev, hsCode: e.target.value }))}
                placeholder="e.g., 1001.99.00"
              />
            )}
          />
          {/* PEMS Code */}
          <FormField
            label="PEMS CODE"
            disabled={isSaving}
            renderInput={() => (
              <input
                suppressHydrationWarning
                type="text"
                className={inputClass}
                value={draft.pemsCode}
                disabled={isSaving}
                onChange={(e) => setDraft((prev) => ({ ...prev, pemsCode: e.target.value }))}
                placeholder="e.g., PEMS-12345"
              />
            )}
          />
          {/* Status */}
          <FormField
            label="STATUS"
            disabled={isSaving}
            renderInput={() => (
              <select
                suppressHydrationWarning
                className={inputClass}
                value={draft.status}
                disabled={isSaving}
                onChange={(e) => setDraft((prev) => ({ ...prev, status: e.target.value }))}
              >
                <option value="">Select...</option>
                {["Active", "Inactive"].map((opt) => <option key={opt} value={opt}>{opt}</option>)}
              </select>
            )}
          />
          {/* Unit Type */}
          <FormField
            label="UNIT TYPE"
            disabled={isSaving}
            renderInput={() => (
              <select
                suppressHydrationWarning
                className={inputClass}
                value={draft.unitType}
                disabled={isSaving}
                onChange={(e) => setDraft((prev) => ({ ...prev, unitType: e.target.value }))}
              >
                <option value="">Select...</option>
                {UNIT_TYPE_OPTIONS.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
              </select>
            )}
          />
          {/* Shrink Amount */}
          <FormField
            label="SHRINK AMOUNT"
            disabled={isSaving}
            renderInput={() => (
              <input
                suppressHydrationWarning
                type="text"
                className={inputClass}
                value={draft.shrinkAmount}
                disabled={isSaving}
                onChange={(e) => setDraft((prev) => ({ ...prev, shrinkAmount: e.target.value }))}
                placeholder="e.g., 2%"
              />
            )}
          />
          {/* Test Thresholds */}
          <FormField
            label="TEST THRESHOLDS"
            wide
            disabled={isSaving}
            renderInput={() => (
              <div className="space-y-3">
                <div className="rounded-md border border-amber-200 bg-[#fff8e1] p-3 text-xs text-amber-900 shadow-sm">
                  <span className="font-bold text-amber-950">Note:</span> Each commodity IS a specific grade. Tests help identify and confirm the commodity. Example: Create separate commodities for "Wheat Grade 1", "Wheat Grade 2", etc.
                </div>
                <div className="space-y-2">
                  {draft.testThresholds.map((item, index) => (
                    <div key={index} className="flex items-start gap-2 rounded-md border border-slate-200 bg-slate-50/50 p-2 shadow-sm">
                      <div className="flex-1 space-y-1">
                        <label className="text-[10px] font-semibold uppercase text-slate-500">Test</label>
                        <select
                          className={inputClass}
                          value={item.test}
                          disabled={isSaving}
                          onChange={(e) => {
                            const next = [...draft.testThresholds];
                            next[index] = { ...next[index], test: e.target.value };
                            setDraft((prev) => ({ ...prev, testThresholds: next }));
                          }}
                        >
                          <option value="">Select test</option>
                          {tests.map((t) => (
                            <option key={t.id} value={t.test_name ?? t.testName}>{t.test_name ?? t.testName}</option>
                          ))}
                        </select>
                      </div>
                      <div className="w-20 space-y-1">
                        <label className="text-[10px] font-semibold uppercase text-slate-500">Min</label>
                        <input
                          type="number"
                          className={inputClass}
                          value={item.min}
                          disabled={isSaving}
                          onChange={(e) => {
                            const next = [...draft.testThresholds];
                            next[index] = { ...next[index], min: e.target.value };
                            setDraft((prev) => ({ ...prev, testThresholds: next }));
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
                          disabled={isSaving}
                          onChange={(e) => {
                            const next = [...draft.testThresholds];
                            next[index] = { ...next[index], max: e.target.value };
                            setDraft((prev) => ({ ...prev, testThresholds: next }));
                          }}
                          placeholder="100"
                        />
                      </div>
                      <div className="pt-[22px]">
                        <button
                          type="button"
                          disabled={isSaving}
                          className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-md border border-red-200 bg-red-50 text-red-500 transition-colors hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-500/30 disabled:opacity-50"
                          onClick={() => {
                            const next = draft.testThresholds.filter((_, i) => i !== index);
                            setDraft((prev) => ({ ...prev, testThresholds: next }));
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
                  disabled={isSaving}
                  className="w-full bg-blue-500 text-white hover:bg-blue-600 shadow-sm"
                  onClick={() => setDraft((prev) => ({ ...prev, testThresholds: [...prev.testThresholds, { test: "", min: "", max: "" }] }))}
                >
                  + Add Test Threshold
                </Button>
              </div>
            )}
          />
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={closeModal} disabled={isSaving}>Cancel</Button>
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

function FormField({ label, required, wide, disabled, renderInput }) {
  return (
    <div className={cn("space-y-1", wide && "sm:col-span-2")}>
      <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">
        {label}
        {required ? <span className="text-red-500"> *</span> : null}
      </label>
      {renderInput()}
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
      <div className="px-0.5 text-xs font-semibold text-slate-600">{title} ({rows.length})</div>
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
              className={cn("w-full rounded-xl border-2 px-3 py-3 text-left transition-colors", isSelected ? "border-blue-500 bg-blue-50" : "border-slate-200 bg-white")}
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
      <div role="dialog" aria-modal="true" aria-labelledby="modal-title" className="relative max-h-[min(90vh,720px)] w-full max-w-2xl overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-4 py-3">
          <h2 id="modal-title" className="text-sm font-semibold text-slate-900">{title}</h2>
          <button type="button" className="rounded-md px-2 py-1 text-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}
