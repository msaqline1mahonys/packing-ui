"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Grid } from "@/components/clutch-table";
import { Button } from "@/components/ui/button";
import { useInvalidateReferenceData } from "@/lib/hooks/use-reference-data-queries";
import { cn } from "@/lib/utils";

const MOBILE_BREAKPOINT = 900;
const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api"
).replace(/\/+$/, "");
const STOCK_LOCATIONS_ENDPOINT = `${API_BASE_URL}/reference-data/stock-locations`;
const LOCATION_UTILIZATION_ENDPOINT = `${API_BASE_URL}/transactions/location-utilization`;

const inputClass =
  "w-full rounded-lg border border-slate-200/95 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-brand/15 placeholder:text-slate-400 focus:border-brand/35 focus:ring-2";

const FORM_FIELDS = [
  { key: "name", label: "Location Name", required: true, placeholder: "e.g. Bay 12" },
  { key: "siteId", label: "Site", required: true },
  {
    key: "locationType",
    label: "Location Type",
    type: "select",
    options: [
      { value: "Bay", label: "Bay" },
      { value: "Pile", label: "Pile" },
      { value: "Silo", label: "Silo" },
    ],
  },
  {
    key: "status",
    label: "Status",
    type: "select",
    options: [
      { value: "Active", label: "Active" },
      { value: "Inactive", label: "Inactive" },
    ],
  },
  { key: "capacity", label: "Capacity (T)", type: "number", placeholder: "0.00" },
];

const DETAIL_COLUMNS = [
  { key: "name", label: "Location", highlight: true },
  { key: "site", label: "Site" },
  { key: "locationType", label: "Type" },
  { key: "status", label: "Status" },
  { key: "capacity", label: "Capacity (T)" },
  { key: "commodityTypesAllowed", label: "Commodity Types" },
];

const gridColumns = [
  { key: "name", header: "Location", type: "text", sortable: true, filterable: true, resizable: true },
  { key: "site", header: "Site", type: "text", sortable: true, filterable: true, resizable: true },
  { key: "locationType", header: "Type", type: "text", sortable: true, filterable: true, resizable: true },
  { key: "status", header: "Status", type: "text", sortable: true, filterable: true, resizable: true },
  { key: "capacity", header: "Capacity (T)", type: "text", sortable: true, filterable: true, resizable: true },
  { key: "utilizationDisplay", header: "Utilization", type: "text", sortable: true, filterable: true, resizable: true },
  { key: "commodityTypesAllowed", header: "Commodity Types", type: "text", sortable: true, filterable: true, resizable: true },
];

/* ─── Auth & tenant helpers ─────────────────────────────────────────────── */

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

/* ─── API helpers ────────────────────────────────────────────────────────── */

async function stockLocationRequest(path = "", options = {}) {
  const response = await fetch(`${STOCK_LOCATIONS_ENDPOINT}${path}`, {
    ...options,
    headers: { ...getAuthHeaders(), ...(options.headers || {}) },
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || result?.success === false) {
    throw new Error(extractApiError(result, "Stock location request failed."));
  }
  return result?.data ?? result;
}

async function fetchSitesList() {
  const tenant = getTenantPayload();
  const params = new URLSearchParams({ per_page: "100", ...tenant });
  const response = await fetch(`${API_BASE_URL}/sites?${params.toString()}`, {
    headers: getAuthHeaders(),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok) throw new Error(extractApiError(result, "Unable to load sites."));
  const pager = result?.sites ?? result?.data ?? result;
  const rows = Array.isArray(pager?.data) ? pager.data : Array.isArray(pager) ? pager : [];
  return rows;
}

async function fetchLocationUtilization() {
  const tenant = getTenantPayload();
  const params = new URLSearchParams();
  if (tenant.organization_id) params.set("organization_id", tenant.organization_id);
  if (tenant.site_id) params.set("site_id", tenant.site_id);
  const qs = params.toString();
  const response = await fetch(`${LOCATION_UTILIZATION_ENDPOINT}${qs ? `?${qs}` : ""}`, {
    headers: getAuthHeaders(),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || result?.success === false) {
    throw new Error(extractApiError(result, "Unable to load utilization data."));
  }
  const raw = result?.output ?? result?.data ?? result;
  return Array.isArray(raw) ? raw : [];
}

/* ─── Data mappers ───────────────────────────────────────────────────────── */

function normalizeIdList(ids, validIds) {
  if (!Array.isArray(ids)) return [];
  const uniq = new Set();
  for (const rawId of ids) {
    const id = String(rawId ?? "").trim();
    if (!id || !validIds.has(id)) continue;
    uniq.add(id);
  }
  return Array.from(uniq);
}

function buildCommoditySummary(mode, ids) {
  if (mode === "all") return "All";
  if (!Array.isArray(ids) || !ids.length) return "—";
  return `${ids.length} selected`;
}

function fromApiStockLocation(row) {
  if (!row) return null;
  const cap = row.capacity;
  const capacityStr =
    cap === null || cap === undefined || cap === "" ? "" : String(cap);
  const commodityModeRaw = row.commodity_mode ?? row.commodityMode;
  const commodityMode = commodityModeRaw === "selected" ? "selected" : "all";
  const commodityTypeIds = Array.isArray(row.commodity_type_ids ?? row.commodityTypeIds)
    ? (row.commodity_type_ids ?? row.commodityTypeIds).map((id) => String(id))
    : [];
  return {
    id: row.id,
    name: row.name ?? "",
    site: row.site?.name ?? "",
    siteId: row.site_id ? String(row.site_id) : "",
    locationType: row.location_type ?? "",
    status: row.status ?? "",
    capacity: capacityStr,
    organizationName: row.organization?.name ?? "",
    commodityMode,
    commodityTypeIds,
  };
}

function toApiPayload(normalized, validCommodityIds) {
  const tenant = getTenantPayload();
  const cap = normalized.capacity;
  let capacity = null;
  if (cap !== "" && cap != null) {
    const n = Number(cap);
    capacity = Number.isNaN(n) ? null : n;
  }
  const siteId = String(normalized.siteId ?? "").trim() || tenant.site_id;
  const commodityMode = normalized.commodityMode === "selected" ? "selected" : "all";
  const commodityTypeIds =
    commodityMode === "selected"
      ? normalizeIdList(normalized.commodityTypeIds, validCommodityIds)
      : [];
  return {
    organization_id: tenant.organization_id,
    site_id: siteId || undefined,
    name: String(normalized.name ?? "").trim(),
    location_type: String(normalized.locationType ?? "").trim() || null,
    status: String(normalized.status ?? "").trim() || null,
    capacity,
    commodity_mode: commodityMode,
    commodity_type_ids: commodityTypeIds,
  };
}

function buildDraft(row) {
  const auth = readAuthPayload();
  const defaultSiteId = auth.current_site?.id ? String(auth.current_site.id) : "";
  const next = {};
  for (const field of FORM_FIELDS) {
    if (field.key === "siteId") {
      next.siteId = row?.siteId ? String(row.siteId) : defaultSiteId;
      continue;
    }
    next[field.key] = row?.[field.key] ?? "";
  }
  next.commodityMode = row?.commodityMode === "selected" ? "selected" : "all";
  next.commodityTypeIds = Array.isArray(row?.commodityTypeIds) ? [...row.commodityTypeIds] : [];
  return next;
}

function parseFieldValue(field, value) {
  if (field.type !== "number") return value;
  if (value === "") return "";
  const parsed = Number(value);
  return Number.isNaN(parsed) ? value : String(parsed);
}

/* ─── Utilization helpers ────────────────────────────────────────────────── */

function utilizationColor(pct) {
  if (pct >= 90) return { bar: "bg-red-600", text: "text-red-600" };
  if (pct >= 70) return { bar: "bg-amber-500", text: "text-amber-500" };
  return { bar: "bg-emerald-600", text: "text-emerald-600" };
}

/* ─── Page ───────────────────────────────────────────────────────────────── */

export default function StockLocationsPage() {
  const invalidateReferenceData = useInvalidateReferenceData();

  const [apiRows, setApiRows] = useState([]);
  const [siteOptions, setSiteOptions] = useState([]);
  const [commodityTypeOptions, setCommodityTypeOptions] = useState([]);
  const [utilizationData, setUtilizationData] = useState([]);
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

  const commodityTypeMap = useMemo(
    () => new Map(commodityTypeOptions.map((item) => [item.id, item.name])),
    [commodityTypeOptions]
  );

  /* utilization lookup keyed by locationId */
  const utilizationByLocation = useMemo(() => {
    const map = {};
    utilizationData.forEach((u) => {
      map[u.locationId] = u;
    });
    return map;
  }, [utilizationData]);

  const rows = useMemo(() => {
    return apiRows.map((row) => {
      const util = utilizationByLocation[row.id];
      const capacity = Number(row.capacity) || 0;
      const totalStock = util?.totalStock ?? 0;
      const utilizationPct =
        util?.utilizationPct != null
          ? util.utilizationPct
          : capacity > 0
            ? parseFloat(((totalStock / capacity) * 100).toFixed(2))
            : null;

      return {
        ...row,
        commodityTypesAllowed: buildCommoditySummary(
          row.commodityMode,
          normalizeIdList(row.commodityTypeIds, commodityTypeMap)
        ),
        utilizationDisplay: utilizationPct != null ? `${Math.round(utilizationPct)}%` : "—",
        utilizationPct,
        totalStock,
      };
    });
  }, [apiRows, commodityTypeMap, utilizationByLocation]);

  /* ─── Data loaders ─────────────────────────────────────────────────────── */

  const loadSites = useCallback(async () => {
    try {
      const sites = await fetchSitesList();
      setSiteOptions(
        sites.map((s) => ({ value: String(s.id), label: String(s.name ?? s.id) }))
      );
    } catch {
      setSiteOptions([]);
    }
  }, []);

  const loadStockLocations = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const tenant = getTenantPayload();
      const params = new URLSearchParams({ per_page: "100" });
      if (tenant.organization_id) params.set("organization_id", tenant.organization_id);
      if (tenant.site_id) params.set("site_id", tenant.site_id);
      const payload = await stockLocationRequest(`?${params.toString()}`);
      const rawRows = Array.isArray(payload?.data)
        ? payload.data
        : Array.isArray(payload)
          ? payload
          : [];
      setApiRows(rawRows.map(fromApiStockLocation).filter(Boolean));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load stock locations.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadFormData = useCallback(async () => {
    try {
      const tenant = getTenantPayload();
      const params = new URLSearchParams();
      if (tenant.organization_id) params.set("organization_id", tenant.organization_id);
      if (tenant.site_id) params.set("site_id", tenant.site_id);
      const qs = params.toString() ? `?${params.toString()}` : "";
      const payload = await stockLocationRequest(`/form-data${qs}`);
      const commodityTypes = Array.isArray(payload?.commodityTypes) ? payload.commodityTypes : [];
      setCommodityTypeOptions(
        commodityTypes.map((item) => ({ id: String(item.id), name: String(item.name ?? "") }))
      );
    } catch {
      setCommodityTypeOptions([]);
    }
  }, []);

  const loadUtilization = useCallback(async () => {
    try {
      const data = await fetchLocationUtilization();
      setUtilizationData(data);
    } catch {
      setUtilizationData([]);
    }
  }, []);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      loadStockLocations();
      loadSites();
      loadFormData();
      loadUtilization();
    });
    return () => cancelAnimationFrame(frame);
  }, [loadStockLocations, loadSites, loadFormData, loadUtilization]);

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
  const selectedUtil = selected ? utilizationByLocation[selected.id] : null;

  /* ─── Modal handlers ───────────────────────────────────────────────────── */

  const openAddModal = () => {
    setError("");
    setNotice("");
    setDraft(buildDraft());
    setModalMode("add");
    loadSites();
  };

  const openEditModal = () => {
    if (!selected) return;
    setError("");
    setNotice("");
    setDraft(buildDraft(selected));
    setModalMode("edit");
    loadSites();
  };

  const closeModal = () => {
    if (isSaving) return;
    setModalMode(null);
  };

  const saveModal = async () => {
    const requiredMissing = FORM_FIELDS.some(
      (field) => field.required && !String(draft[field.key] ?? "").trim()
    );
    if (requiredMissing) { setError("Please fill all required fields."); return; }

    const tenant = getTenantPayload();
    if (!tenant.organization_id) {
      setError("Organization is required to save a stock location.");
      return;
    }
    if (!String(draft.siteId ?? "").trim() && !tenant.site_id) {
      setError("Select a site or set a current site in your profile.");
      return;
    }

    const normalized = {};
    for (const field of FORM_FIELDS) {
      normalized[field.key] = parseFieldValue(field, draft[field.key] ?? "");
    }
    normalized.commodityMode = draft.commodityMode === "selected" ? "selected" : "all";
    normalized.commodityTypeIds = normalizeIdList(draft.commodityTypeIds, commodityTypeMap);

    setIsSaving(true);
    setError("");
    setNotice("");

    try {
      if (modalMode === "add") {
        const payload = await stockLocationRequest("", {
          method: "POST",
          body: JSON.stringify(toApiPayload(normalized, commodityTypeMap)),
        });
        const nextRow = fromApiStockLocation(payload);
        if (!nextRow) throw new Error("Invalid response from server.");
        setApiRows((prev) => [nextRow, ...prev]);
        setSelectedId(nextRow.id);
        setNotice("Stock location created successfully.");
        await invalidateReferenceData("stockLocations");
        setModalMode(null);
        loadUtilization();
        return;
      }

      if (modalMode === "edit" && selected) {
        const payload = await stockLocationRequest(`/${selected.id}`, {
          method: "PUT",
          body: JSON.stringify(toApiPayload(normalized, commodityTypeMap)),
        });
        const nextRow = fromApiStockLocation(payload);
        if (!nextRow) throw new Error("Invalid response from server.");
        setApiRows((prev) => prev.map((row) => (row.id === selected.id ? nextRow : row)));
        setNotice("Stock location updated successfully.");
        await invalidateReferenceData("stockLocations");
        setModalMode(null);
        loadUtilization();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save stock location.");
    } finally {
      setIsSaving(false);
    }
  };

  const setCommodityMode = (mode) => {
    setDraft((prev) => ({
      ...prev,
      commodityMode: mode,
      commodityTypeIds: mode === "all" ? [] : prev.commodityTypeIds,
    }));
  };

  const toggleCommodityType = (id) => {
    setDraft((prev) => {
      const current = normalizeIdList(prev.commodityTypeIds, commodityTypeMap);
      const exists = current.includes(id);
      return {
        ...prev,
        commodityMode: "selected",
        commodityTypeIds: exists ? current.filter((item) => item !== id) : [...current, id],
      };
    });
  };

  const removeSelected = async () => {
    if (!selected || isDeleting) return;
    const shouldDelete = window.confirm(`Delete stock location "${selected.name || selected.id}"?`);
    if (!shouldDelete) return;
    setIsDeleting(true);
    setError("");
    setNotice("");
    try {
      await stockLocationRequest(`/${selected.id}`, { method: "DELETE" });
      setApiRows((prev) => prev.filter((row) => row.id !== selected.id));
      setSelectedId(null);
      setNotice("Stock location deleted successfully.");
      await invalidateReferenceData("stockLocations");
      loadUtilization();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete stock location.");
    } finally {
      setIsDeleting(false);
    }
  };

  const modalError = modalMode ? error : "";

  /* ─── Render ───────────────────────────────────────────────────────────── */

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs text-slate-500">Stock Management / Stock Locations</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 md:text-[1.65rem]">
          Stock Locations
        </h1>
        {!isMobile && (
          <p className="mt-1 text-xs text-slate-500">
            Manage storage locations, capacities, and view live utilization.
          </p>
        )}
      </div>

      {!modalMode && error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </div>
      ) : null}

      {notice ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {notice}
        </div>
      ) : null}

      <div
        className={cn(
          "grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(280px,340px)] xl:items-start",
          isMobile && "grid-cols-1"
        )}
      >
        {/* ── Grid ──────────────────────────────────────────────────────── */}
        <div className="overflow-hidden rounded-xl bg-white shadow-sm">
          {isMobile ? (
            <>
              <div className="flex flex-wrap gap-2 border-b border-slate-100 p-3">
                <Button type="button" size="sm" onClick={openAddModal} disabled={isLoading}>
                  + Add
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={loadStockLocations} disabled={isLoading}>
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
              <MobileList
                rows={rows}
                selectedId={selectedId}
                onSelect={setSelectedId}
                isLoading={isLoading}
                utilizationByLocation={utilizationByLocation}
              />
            </>
          ) : (
            <Grid
              columns={gridColumns}
              rows={rows}
              getRowId={(row) => row.id}
              theme="light"
              density="standard"
              fileName="Stock Locations"
              visibleRows={12}
              loading={isLoading}
              emptyMessage={isLoading ? "Loading stock locations…" : "No stock locations found."}
              onRowClick={(row) => setSelectedId((prev) => (prev === row.id ? null : row.id))}
              onPersistedRowActivate={(row) => setSelectedId(row.id)}
              toolbarActions={
                <div className="flex flex-wrap gap-2">
                  <Button type="button" size="sm" onClick={openAddModal} disabled={isLoading}>
                    + Add
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => { loadStockLocations(); loadUtilization(); }} disabled={isLoading}>
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
              }
            />
          )}
        </div>

        {/* ── Sidebar ───────────────────────────────────────────────────── */}
        {!isMobile && (
          <aside className="rounded-xl border border-slate-200/90 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900">Location Details</h2>

            {!selected ? (
              <p className="mt-4 text-sm leading-relaxed text-slate-500">
                Select a row to view details and current stock.
              </p>
            ) : (
              <>
                {/* Location fields */}
                <dl className="mt-4 space-y-3 text-sm">
                  {DETAIL_COLUMNS.map((col) => (
                    <DetailItem
                      key={col.key}
                      label={col.label}
                      value={selected[col.key]}
                      highlight={col.highlight}
                    />
                  ))}
                </dl>

                {/* Current Stock section */}
                <div className="mt-5 border-t border-slate-100 pt-5">
                  <span className="mb-3 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Current Stock
                  </span>

                  <CurrentStock
                    selected={selected}
                    util={selectedUtil}
                  />
                </div>
              </>
            )}
          </aside>
        )}
      </div>

      {/* ── Add / Edit Modal ─────────────────────────────────────────────── */}
      <Modal
        open={modalMode != null}
        title={modalMode === "edit" ? "Edit Stock Location" : "Add Stock Location"}
        onClose={closeModal}
      >
        {modalError ? (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-600">
            {modalError}
          </div>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2">
          {FORM_FIELDS.map((field) => (
            <FormField
              key={field.key}
              field={field}
              value={draft[field.key] ?? ""}
              disabled={isSaving}
              siteOptions={field.key === "siteId" ? siteOptions : undefined}
              onChange={(value) => setDraft((prev) => ({ ...prev, [field.key]: value }))}
            />
          ))}
        </div>

        {/* Commodity types */}
        <div className="mt-4 space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">
            Commodity Types Allowed
          </p>
          <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50/50 p-3">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                suppressHydrationWarning
                type="radio"
                name="commodity-mode"
                checked={draft.commodityMode === "all"}
                disabled={isSaving}
                onChange={() => setCommodityMode("all")}
              />
              All
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                suppressHydrationWarning
                type="radio"
                name="commodity-mode"
                checked={draft.commodityMode === "selected"}
                disabled={isSaving}
                onChange={() => setCommodityMode("selected")}
              />
              Select commodity types
            </label>
            {draft.commodityMode === "selected" &&
              (commodityTypeOptions.length ? (
                <div className="grid gap-2 pt-1 sm:grid-cols-2">
                  {commodityTypeOptions.map((option) => {
                    const checked = normalizeIdList(draft.commodityTypeIds, commodityTypeMap).includes(option.id);
                    return (
                      <label key={option.id} className="flex items-center gap-2 text-sm text-slate-700">
                        <input
                          suppressHydrationWarning
                          type="checkbox"
                          checked={checked}
                          disabled={isSaving}
                          onChange={() => toggleCommodityType(option.id)}
                        />
                        {option.name}
                      </label>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-slate-500">No commodity types found.</p>
              ))}
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

      {isMobile && showGoToTop && (
        <button
          type="button"
          aria-label="Go to top"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="fixed bottom-5 right-5 z-50 flex size-12 items-center justify-center rounded-full bg-gradient-to-br from-brand to-blue-500 text-xl text-white shadow-lg shadow-blue-500/30"
        >
          ↑
        </button>
      )}
    </div>
  );
}

/* ─── Current Stock sidebar section ─────────────────────────────────────── */

function CurrentStock({ selected, util }) {
  const capacity = Number(selected?.capacity) || 0;
  const totalStock = util?.totalStock ?? 0;
  const utilizationPct =
    util?.utilizationPct != null
      ? util.utilizationPct
      : capacity > 0
        ? parseFloat(((totalStock / capacity) * 100).toFixed(2))
        : null;
  const commodities = util?.commodities ?? [];
  const colors = utilizationPct != null ? utilizationColor(utilizationPct) : null;

  return (
    <div className="space-y-4">
      {/* Utilization bar */}
      {capacity > 0 && utilizationPct != null && (
        <div>
          <div className="mb-1 flex justify-between text-[10px]">
            <span className="text-slate-500">Utilization</span>
            <span className={cn("font-bold", colors?.text)}>{Math.round(utilizationPct)}%</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className={cn("h-full transition-all duration-300", colors?.bar)}
              style={{ width: `${Math.min(utilizationPct, 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Total stock card */}
      <div className="rounded-lg bg-slate-50 p-3">
        <div className="text-[10px] text-slate-500">Total Stock</div>
        <div className="text-lg font-bold text-brand">
          {totalStock.toFixed(2)}{" "}
          <span className="text-xs font-medium text-slate-500">MT</span>
        </div>
        {capacity > 0 && (
          <div className="mt-0.5 text-[10px] text-slate-400">
            of {Number(capacity).toLocaleString()} T capacity
          </div>
        )}
      </div>

      {/* Commodity breakdown */}
      {commodities.length === 0 ? (
        <p className="py-3 text-center text-xs italic text-slate-400">
          No stock currently stored
        </p>
      ) : (
        <div className="max-h-52 space-y-2 overflow-y-auto">
          {commodities.map((item, idx) => (
            <div key={idx} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="text-xs font-semibold text-slate-900">{item.commodityName}</div>
              <div className="mt-1 text-sm font-bold text-brand">
                {Number(item.total).toFixed(2)}{" "}
                <span className="text-xs font-medium text-slate-500">MT</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Mobile list ────────────────────────────────────────────────────────── */

function MobileList({ rows, selectedId, onSelect, isLoading, utilizationByLocation }) {
  if (isLoading) {
    return (
      <div className="py-8 text-center text-sm text-slate-400">Loading stock locations…</div>
    );
  }
  if (rows.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-slate-400">
        No stock locations found. Add your first one!
      </div>
    );
  }
  return (
    <div className="space-y-2 p-3">
      <div className="px-0.5 text-xs font-semibold text-slate-600">
        Stock Locations ({rows.length})
      </div>
      {rows.map((row) => {
        const isSelected = row.id === selectedId;
        const util = utilizationByLocation[row.id];
        const capacity = Number(row.capacity) || 0;
        const pct =
          util?.utilizationPct != null
            ? util.utilizationPct
            : capacity > 0 && util
              ? parseFloat((((util.totalStock ?? 0) / capacity) * 100).toFixed(1))
              : null;
        const colors = pct != null ? utilizationColor(pct) : null;

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
            <p className="text-xs font-bold text-blue-600">{row.name || "—"}</p>
            <p className="mt-0.5 text-[11px] text-slate-500">
              {[row.site, row.locationType, row.status].filter(Boolean).join(" · ")}
            </p>
            {pct != null && (
              <div className="mt-2">
                <div className="mb-1 flex justify-between text-[10px]">
                  <span className="text-slate-500">Utilization</span>
                  <span className={cn("font-bold", colors?.text)}>{Math.round(pct)}%</span>
                </div>
                <div className="h-1 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={cn("h-full", colors?.bar)}
                    style={{ width: `${Math.min(pct, 100)}%` }}
                  />
                </div>
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}

/* ─── Sub-components ─────────────────────────────────────────────────────── */

function DetailItem({ label, value, highlight }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className={cn("mt-0.5 text-slate-800", highlight && "font-semibold text-brand")}>
        {value || "—"}
      </dd>
    </div>
  );
}

function FormField({ field, value, onChange, disabled, siteOptions }) {
  if (field.key === "siteId" && siteOptions) {
    return (
      <div className="space-y-1">
        <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">
          {field.label}
          {field.required ? <span className="text-red-500"> *</span> : null}
        </label>
        <select
          className={inputClass}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">Select site…</option>
          {siteOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    );
  }

  return (
    <div className={cn("space-y-1", field.type === "textarea" && "sm:col-span-2")}>
      <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">
        {field.label}
        {field.required ? <span className="text-red-500"> *</span> : null}
      </label>
      {field.type === "select" ? (
        <select
          suppressHydrationWarning
          className={inputClass}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">Select…</option>
          {(field.options ?? []).map((opt) =>
            typeof opt === "object" ? (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ) : (
              <option key={opt} value={opt}>
                {opt}
              </option>
            )
          )}
        </select>
      ) : (
        <input
          type={field.type || "text"}
          className={inputClass}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
        />
      )}
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
        className="relative max-h-[min(90vh,720px)] w-full max-w-2xl overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
          <button
            type="button"
            className="rounded-md px-2 py-1 text-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            onClick={onClose}
          >
            ×
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}
