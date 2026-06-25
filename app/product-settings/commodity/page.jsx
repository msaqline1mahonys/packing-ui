"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { Grid } from "@/components/clutch-table";
import { Button } from "@/components/ui/button";
import ClutchFormField from "@/components/form/clutch-form-field";
import { useInvalidateReferenceData } from "@/lib/hooks/use-reference-data-queries";
import { useAutoOpenAddModal } from "@/lib/hooks/use-auto-open-add-modal";
import { buildRequiredFieldErrorsFromRules, clearFieldError } from "@/lib/form-validation";
import { formLabelClass, formLabelErrorClass, formFieldErrorTextClass, inputClassName } from "@/lib/form-styles";
import { cn } from "@/lib/utils";
import { numberInputWheelProps } from "@/lib/number-input";

const REQUIRED_FIELD_RULES = [
  { key: "commodityTypeId", required: true },
  { key: "commodityCode", required: true },
  { key: "description", required: true },
];

const MOBILE_BREAKPOINT = 900;
const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api"
).replace(/\/+$/, "");
const ENDPOINT = `${API_BASE_URL}/product-settings/commodities`;
const FORM_DATA_ENDPOINT = `${ENDPOINT}/form-data`;
const TESTS_ENDPOINT = `${API_BASE_URL}/product-settings/tests`;

const UNIT_TYPE_OPTIONS = ["kg (Kilograms)", "t (Tonnes)", "lb (Pounds)", "g (Grams)"];

const config = {
  title: "Commodity Grades",
  subtitle: "Manage commodity grades, classifications, and thresholds.",
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

function normaliseThresholds(rows) {
  return (Array.isArray(rows) ? rows : []).map((t) => ({
    test: t?.test ?? "",
    min: t?.min ?? "",
    max: t?.max ?? "",
    parentGroupId: t?.parentGroupId ?? t?.parent_group_id ?? null,
    isGroupRoot: Boolean(t?.isGroupRoot ?? t?.is_group_root ?? false),
  }));
}

function buildDraft(row) {
  return {
    commodityTypeId: row?.commodityTypeId ?? "",
    commodityCode: row?.commodityCode ?? "",
    description: row?.description ?? "",
    hsCode: row?.hsCode ?? "",
    pemsCode: row?.pemsCode ?? "",
    status: row?.status ?? "Active",
    unitType: row?.unitType ?? "t (Tonnes)",
    testThresholds: normaliseThresholds(row?.testThresholds),
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
    testThresholds: normaliseThresholds(row.test_thresholds),
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
    status: String(draft.status ?? "").trim() || "Active",
    unit_type: String(draft.unitType ?? "").trim() || null,
    test_thresholds: (draft.testThresholds || [])
      .filter((t) => t.test)
      .map((t) => ({
        test: t.test,
        min: t.min,
        max: t.max,
        parent_group_id: t.parentGroupId ?? null,
        is_group_root: Boolean(t.isGroupRoot),
      })),
    shrink_amount: String(draft.shrinkAmount ?? "").trim() || null,
  };
}

export default function CommodityPage() {
  const invalidateReferenceData = useInvalidateReferenceData();

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
  const [fieldErrors, setFieldErrors] = useState({});

  const loadRows = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const payload = await apiRequest(`${ENDPOINT}?per_page=100`);
      const apiRows = Array.isArray(payload?.data) ? payload.data : Array.isArray(payload) ? payload : [];
      setRows(apiRows.map(fromApi).filter(Boolean));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load commodity grades.");
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

  const testsById = useMemo(() => {
    const map = new Map();
    for (const t of tests) map.set(t.id, t);
    return map;
  }, [tests]);

  const testsByName = useMemo(() => {
    const map = new Map();
    for (const t of tests) {
      const name = t.test_name ?? t.testName;
      if (name && !map.has(name)) map.set(name, t);
    }
    return map;
  }, [tests]);

  const groupNameFor = useCallback(
    (groupId) => {
      const g = testsById.get(groupId);
      return g?.test_name ?? g?.testName ?? "(unknown group)";
    },
    [testsById]
  );

  const handleTestChange = useCallback(
    (index, newName) => {
      setDraft((prev) => {
        const next = [...prev.testThresholds];
        const picked = testsByName.get(newName);

        if (picked?.type === "Group") {
          next.splice(index, 1);

          const groupAlreadyAdded = next.some(
            (r) => r.parentGroupId === picked.id && r.isGroupRoot
          );
          if (groupAlreadyAdded) {
            return { ...prev, testThresholds: next };
          }

          const groupName = picked.test_name ?? picked.testName ?? "";
          next.push({
            test: groupName,
            min: "",
            max: "",
            parentGroupId: picked.id,
            isGroupRoot: true,
          });

          const existingNames = new Set(
            next.map((r) => String(r.test ?? "").trim()).filter(Boolean)
          );
          const memberIds = Array.isArray(picked.members) ? picked.members : [];
          for (const memberId of memberIds) {
            const member = testsById.get(memberId);
            const memberName = member?.test_name ?? member?.testName;
            if (!memberName || existingNames.has(memberName)) continue;
            next.push({
              test: memberName,
              min: "",
              max: "",
              parentGroupId: picked.id,
              isGroupRoot: false,
            });
            existingNames.add(memberName);
          }
          return { ...prev, testThresholds: next };
        }

        next[index] = { ...next[index], test: newName, parentGroupId: null, isGroupRoot: false };
        return { ...prev, testThresholds: next };
      });
    },
    [testsByName, testsById]
  );

  const removeGroup = useCallback((groupId) => {
    setDraft((prev) => ({
      ...prev,
      testThresholds: prev.testThresholds.filter((r) => r.parentGroupId !== groupId),
    }));
  }, []);

  const updateThresholdField = useCallback((index, field, value) => {
    setDraft((prev) => {
      const next = [...prev.testThresholds];
      next[index] = { ...next[index], [field]: value };
      return { ...prev, testThresholds: next };
    });
  }, []);

  const removeThreshold = useCallback((index) => {
    setDraft((prev) => ({
      ...prev,
      testThresholds: prev.testThresholds.filter((_, i) => i !== index),
    }));
  }, []);

  const openAddModal = () => {
    setError("");
    setNotice("");
    setFieldErrors({});
    setDraft(buildDraft());
    setModalMode("add");
  };

  useAutoOpenAddModal(openAddModal);

  const openEditModal = () => {
    if (!selected) return;
    setError("");
    setNotice("");
    setFieldErrors({});
    setDraft(buildDraft(selected));
    setModalMode("edit");
  };

  const closeModal = () => {
    if (isSaving) return;
    setModalMode(null);
    setFieldErrors({});
  };

  const saveModal = async () => {
    const nextFieldErrors = buildRequiredFieldErrorsFromRules(REQUIRED_FIELD_RULES, draft);
    if (Object.keys(nextFieldErrors).length) {
      setFieldErrors(nextFieldErrors);
      setError("Commodity Type, Commodity Grade Code, and Description are required.");
      return;
    }

    const tenant = getTenantPayload();
    if (!tenant.organization_id || !tenant.site_id) {
      setError("Organization and current site are required to save a commodity grade.");
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
        setNotice("Commodity Grade created successfully.");
        await invalidateReferenceData("commodities");
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
        setNotice("Commodity Grade updated successfully.");
        await invalidateReferenceData("commodities");
        setModalMode(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save commodity grade.");
    } finally {
      setIsSaving(false);
    }
  };

  const removeSelected = async () => {
    if (!selected || isDeleting) return;
    const shouldDelete = window.confirm(`Delete commodity grade "${selected.commodityCode || selected.id}"?`);
    if (!shouldDelete) return;

    setIsDeleting(true);
    setError("");
    setNotice("");

    try {
      await apiRequest(`${ENDPOINT}/${selected.id}`, { method: "DELETE" });
      setRows((prev) => prev.filter((row) => row.id !== selected.id));
      setSelectedId(null);
      setNotice("Commodity Grade deleted successfully.");
      await invalidateReferenceData("commodities");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete commodity grade.");
    } finally {
      setIsDeleting(false);
    }
  };

  const modalError = modalMode ? error : "";

  const commodityTypeField = useMemo(
    () => ({
      key: "commodityTypeId",
      label: "Commodity Type",
      type: "select",
      required: true,
      options: commodityTypes.map((ct) => ({ value: String(ct.id), label: ct.name })),
    }),
    [commodityTypes]
  );

  const commodityCodeField = useMemo(
    () => ({
      key: "commodityCode",
      label: "Commodity Grade Code",
      type: "text",
      required: true,
      placeholder: "e.g., COM-001",
    }),
    []
  );

  const descriptionField = useMemo(
    () => ({
      key: "description",
      label: "Description",
      type: "text",
      required: true,
      placeholder: "e.g., Australian Hard Wheat",
    }),
    []
  );

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
              emptyMessage={isLoading ? "Loading commodity grades…" : "No commodity grades found."}
              onRowClick={(row) => setSelectedId((prev) => (prev === row.id ? null : row.id))}
              onPersistedRowActivate={(row) => setSelectedId(row.id)}
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
              <>
                <dl className="mt-4 space-y-3 text-sm">
                  {config.columns.map((column) => (
                    <DetailItem key={column.key} label={column.label} value={selected[column.key]} highlight={column === config.columns[0]} />
                  ))}
                </dl>
                <DetailTestThresholds
                  thresholds={selected.testThresholds}
                  groupNameFor={groupNameFor}
                />
              </>
            )}
          </aside>
        ) : null}
      </div>

      <Modal open={modalMode != null} title={modalMode === "edit" ? `Edit ${config.title}` : `Add ${config.title}`} onClose={closeModal}>
        {modalError ? (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-600">{modalError}</div>
        ) : null}
        <div className="grid gap-3 sm:grid-cols-2">
          <ClutchFormField
            field={commodityTypeField}
            value={draft.commodityTypeId}
            disabled={isSaving}
            hasError={fieldErrors.commodityTypeId}
            onChange={(value) => {
              setFieldErrors((prev) => clearFieldError(prev, "commodityTypeId"));
              setDraft((prev) => ({ ...prev, commodityTypeId: value }));
            }}
          />
          <ClutchFormField
            field={commodityCodeField}
            value={draft.commodityCode}
            disabled={isSaving}
            hasError={fieldErrors.commodityCode}
            onChange={(value) => {
              setFieldErrors((prev) => clearFieldError(prev, "commodityCode"));
              setDraft((prev) => ({ ...prev, commodityCode: value }));
            }}
          />
          <ClutchFormField
            field={descriptionField}
            value={draft.description}
            disabled={isSaving}
            hasError={fieldErrors.description}
            onChange={(value) => {
              setFieldErrors((prev) => clearFieldError(prev, "description"));
              setDraft((prev) => ({ ...prev, description: value }));
            }}
          />
          {/* HS Code */}
          <FormField
            label="HS CODE"
            disabled={isSaving}
            renderInput={(hasError) => (
              <input
                suppressHydrationWarning
                type="text"
                className={inputClassName(hasError)}
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
            renderInput={(hasError) => (
              <input
                suppressHydrationWarning
                type="text"
                className={inputClassName(hasError)}
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
            renderInput={(hasError) => (
              <select
                suppressHydrationWarning
                className={inputClassName(hasError)}
                value={draft.status}
                disabled={isSaving}
                onChange={(e) => setDraft((prev) => ({ ...prev, status: e.target.value }))}
              >
                {["Active", "Inactive"].map((opt) => <option key={opt} value={opt}>{opt}</option>)}
              </select>
            )}
          />
          {/* Unit Type */}
          <FormField
            label="UNIT TYPE"
            disabled={isSaving}
            renderInput={(hasError) => (
              <select
                suppressHydrationWarning
                className={inputClassName(hasError)}
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
            renderInput={(hasError) => (
              <input
                suppressHydrationWarning
                type="text"
                className={inputClassName(hasError)}
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
                  <span className="font-bold text-amber-950">Note:</span> Each commodity grade is a specific grade. Tests help identify and confirm the commodity grade. Example: Create separate commodity grades for "Wheat Grade 1", "Wheat Grade 2", etc.
                </div>
                <div className="space-y-2">
                  {(() => {
                    const units = [];
                    const seenGroups = new Set();
                    draft.testThresholds.forEach((row, index) => {
                      if (row.parentGroupId) {
                        if (seenGroups.has(row.parentGroupId)) return;
                        seenGroups.add(row.parentGroupId);
                        const members = draft.testThresholds
                          .map((r, i) => ({ row: r, index: i }))
                          .filter(({ row: r }) => r.parentGroupId === row.parentGroupId);
                        units.push({ kind: "group", groupId: row.parentGroupId, members });
                      } else {
                        units.push({ kind: "single", row, index });
                      }
                    });

                    return units.map((unit) => {
                      if (unit.kind === "single") {
                        const item = unit.row;
                        const index = unit.index;
                        return (
                          <ThresholdRow
                            key={`single-${index}`}
                            item={item}
                            tests={tests}
                            isSaving={isSaving}
                            onTestChange={(value) => handleTestChange(index, value)}
                            onFieldChange={(field, value) => updateThresholdField(index, field, value)}
                            onRemove={() => removeThreshold(index)}
                          />
                        );
                      }
                      const rootEntry = unit.members.find(({ row }) => row.isGroupRoot);
                      const memberEntries = unit.members.filter(({ row }) => !row.isGroupRoot);
                      return (
                        <div
                          key={`group-${unit.groupId}`}
                          className="rounded-md border-2 border-blue-300 bg-blue-50/40 p-2.5 shadow-sm"
                        >
                          <div className="mb-2 flex items-center justify-between gap-2">
                            <span className="text-[11px] font-semibold uppercase tracking-wide text-blue-700">
                              Group: {groupNameFor(unit.groupId)}
                            </span>
                            <button
                              type="button"
                              disabled={isSaving}
                              className="text-[11px] font-medium text-red-600 hover:text-red-700 hover:underline disabled:opacity-50"
                              onClick={() => removeGroup(unit.groupId)}
                            >
                              Remove group
                            </button>
                          </div>
                          {rootEntry ? (
                            <div className="mb-2">
                              <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-blue-700/80">
                                Sum threshold
                              </div>
                              <ThresholdRow
                                item={rootEntry.row}
                                tests={tests}
                                isSaving={isSaving}
                                lockTestName
                                onFieldChange={(field, value) =>
                                  updateThresholdField(rootEntry.index, field, value)
                                }
                              />
                            </div>
                          ) : null}
                          {memberEntries.length > 0 ? (
                            <>
                              <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-blue-700/80">
                                Members
                              </div>
                              <div className="space-y-2">
                                {memberEntries.map(({ row, index }) => (
                                  <ThresholdRow
                                    key={`member-${index}`}
                                    item={row}
                                    tests={tests}
                                    isSaving={isSaving}
                                    lockTestName
                                    onFieldChange={(field, value) => updateThresholdField(index, field, value)}
                                  />
                                ))}
                              </div>
                            </>
                          ) : null}
                        </div>
                      );
                    });
                  })()}
                </div>
                <Button
                  type="button"
                  disabled={isSaving}
                  className="w-full bg-blue-500 text-white hover:bg-blue-600 shadow-sm"
                  onClick={() => setDraft((prev) => ({ ...prev, testThresholds: [...prev.testThresholds, { test: "", min: "", max: "", parentGroupId: null }] }))}
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

function ThresholdRow({ item, tests, isSaving, lockTestName = false, onTestChange, onFieldChange, onRemove }) {
  return (
    <div className="flex items-start gap-2 rounded-md border border-slate-200 bg-white p-2 shadow-sm">
      <div className="flex-1 space-y-1">
        <label className="text-[10px] font-semibold uppercase text-slate-500">Test</label>
        {lockTestName ? (
          <div className={cn(inputClassName(false), "bg-slate-50 text-slate-700")}>{item.test}</div>
        ) : (
          <select
            className={inputClassName(false)}
            value={item.test}
            disabled={isSaving}
            onChange={(e) => onTestChange(e.target.value)}
          >
            <option value="">Select test</option>
            {tests.map((t) => {
              const name = t.test_name ?? t.testName;
              const label = t.type === "Group" ? `${name} (Group)` : name;
              return (
                <option key={t.id} value={name}>
                  {label}
                </option>
              );
            })}
          </select>
        )}
      </div>
      <div className="w-20 space-y-1">
        <label className="text-[10px] font-semibold uppercase text-slate-500">Min</label>
        <input
          type="number"
          className={inputClassName(false)}
          {...numberInputWheelProps}
          value={item.min}
          disabled={isSaving}
          onChange={(e) => onFieldChange("min", e.target.value)}
          placeholder="0"
        />
      </div>
      <div className="w-20 space-y-1">
        <label className="text-[10px] font-semibold uppercase text-slate-500">Max</label>
        <input
          type="number"
          className={inputClassName(false)}
          {...numberInputWheelProps}
          value={item.max}
          disabled={isSaving}
          onChange={(e) => onFieldChange("max", e.target.value)}
          placeholder="100"
        />
      </div>
      {lockTestName ? null : (
        <div className="pt-[22px]">
          <button
            type="button"
            disabled={isSaving}
            className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-md border border-red-200 bg-red-50 text-red-500 transition-colors hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-500/30 disabled:opacity-50"
            onClick={onRemove}
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}

function FormField({ label, required, wide, disabled, hasError = false, renderInput }) {
  return (
    <div className={cn("space-y-1", wide && "sm:col-span-2")}>
      <label className={cn(formLabelClass, hasError && formLabelErrorClass)}>
        {label}
        {required ? <span className="text-red-500"> *</span> : null}
      </label>
      {renderInput(hasError)}
      {hasError ? <p className={formFieldErrorTextClass}>Required</p> : null}
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
}

function formatThresholdRange(min, max) {
  const hasMin = min !== "" && min != null;
  const hasMax = max !== "" && max != null;
  if (hasMin && hasMax) return `${min} – ${max}`;
  if (hasMin) return `≥ ${min}`;
  if (hasMax) return `≤ ${max}`;
  return "—";
}

function DetailTestThresholds({ thresholds, groupNameFor }) {
  const rows = Array.isArray(thresholds) ? thresholds.filter((t) => t?.test) : [];
  if (rows.length === 0) {
    return (
      <div className="mt-5 border-t border-slate-100 pt-4">
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Tests</h3>
        <p className="mt-2 text-sm text-slate-500">No tests configured.</p>
      </div>
    );
  }

  const units = [];
  const seenGroups = new Set();
  rows.forEach((row, index) => {
    if (row.parentGroupId) {
      if (seenGroups.has(row.parentGroupId)) return;
      seenGroups.add(row.parentGroupId);
      const members = rows
        .map((r, i) => ({ row: r, index: i }))
        .filter(({ row: r }) => r.parentGroupId === row.parentGroupId);
      units.push({ kind: "group", groupId: row.parentGroupId, members });
    } else {
      units.push({ kind: "single", row, index });
    }
  });

  return (
    <div className="mt-5 border-t border-slate-100 pt-4">
      <h3 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Tests</h3>
      <ul className="mt-2 space-y-2">
        {units.map((unit) => {
          if (unit.kind === "single") {
            return (
              <li
                key={`single-${unit.index}`}
                className="rounded-md border border-slate-200 bg-slate-50/60 px-2.5 py-2 text-sm"
              >
                <div className="font-medium text-slate-800">{unit.row.test}</div>
                <div className="mt-0.5 text-xs text-slate-500">
                  {formatThresholdRange(unit.row.min, unit.row.max)}
                </div>
              </li>
            );
          }

          const rootEntry = unit.members.find(({ row }) => row.isGroupRoot);
          const memberEntries = unit.members.filter(({ row }) => !row.isGroupRoot);

          return (
            <li
              key={`group-${unit.groupId}`}
              className="rounded-md border-2 border-blue-200 bg-blue-50/40 px-2.5 py-2 text-sm"
            >
              <div className="text-[10px] font-semibold uppercase tracking-wide text-blue-700">
                Group: {groupNameFor(unit.groupId)}
              </div>
              {rootEntry ? (
                <div className="mt-2 rounded border border-blue-100 bg-white/70 px-2 py-1.5">
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-blue-700/80">
                    Sum threshold
                  </div>
                  <div className="font-medium text-slate-800">{rootEntry.row.test}</div>
                  <div className="mt-0.5 text-xs text-slate-500">
                    {formatThresholdRange(rootEntry.row.min, rootEntry.row.max)}
                  </div>
                </div>
              ) : null}
              {memberEntries.length > 0 ? (
                <ul className="mt-2 space-y-1.5">
                  {memberEntries.map(({ row, index }) => (
                    <li
                      key={`member-${index}`}
                      className="rounded border border-blue-100 bg-white/70 px-2 py-1.5"
                    >
                      <div className="font-medium text-slate-800">{row.test}</div>
                      <div className="mt-0.5 text-xs text-slate-500">
                        {formatThresholdRange(row.min, row.max)}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          );
        })}
      </ul>
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
