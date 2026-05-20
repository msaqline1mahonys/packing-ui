"use client";

import { useEffect, useState } from "react";

import { Grid } from "@/components/clutch-table";
import { Button } from "@/components/ui/button";
import { DEMO_COMMODITY_TYPES, DEMO_STOCK_LOCATIONS } from "@/lib/demo-in-ticket-data";
import { cn } from "@/lib/utils";

const MOBILE_BREAKPOINT = 900;
const inputClass =
  "w-full rounded-lg border border-slate-200/95 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-brand/15 placeholder:text-slate-400 focus:border-brand/35 focus:ring-2";

const config = {
  title: "Packer",
  subtitle: "Maintain packer setup, status, and allowed operational scopes.",
  columns: [
    { key: "name", label: "Name" },
    { key: "description", label: "Description" },
    { key: "status", label: "Status" },
    { key: "commodityTypesAllowed", label: "Commodity Types" },
    { key: "stockLocationsAllowed", label: "Stock Locations" },
  ],
  rows: [
    {
      id: 1,
      name: "Dock North A",
      description: "Heavy lift bay",
      status: "Active",
      commodityMode: "all",
      commodityTypeIds: [],
      stockLocationMode: "selected",
      stockLocationIds: [1, 2, 3],
    },
    {
      id: 2,
      name: "Dock South",
      description: "General cargo",
      status: "Under maintenance",
      commodityMode: "selected",
      commodityTypeIds: [1, 2],
      stockLocationMode: "all",
      stockLocationIds: [],
    },
  ],
  formFields: [
    { key: "name", label: "Name", required: true },
    { key: "status", label: "Status", type: "select", options: ["Active", "Under maintenance", "Inactive"] },
    { key: "description", label: "Description", type: "textarea" },
  ],
};

// Column definitions for clutch-table Grid
const gridColumns = config.columns.map((col) => ({
  key: col.key,
  header: col.label,
  type: "text",
  sortable: true,
  filterable: true,
  resizable: true,
}));

const commodityTypeOptions = DEMO_COMMODITY_TYPES.map((item) => ({
  id: Number(item.id),
  name: String(item.name ?? ""),
}));

const commodityTypeMap = new Map(commodityTypeOptions.map((item) => [item.id, item.name]));
const stockLocationOptions = DEMO_STOCK_LOCATIONS.map((item) => ({
  id: Number(item.id),
  name: String(item.name ?? ""),
}));
const stockLocationMap = new Map(stockLocationOptions.map((item) => [item.id, item.name]));

function normalizeCommodityTypeIds(ids) {
  if (!Array.isArray(ids)) return [];
  const uniq = new Set();
  for (const rawId of ids) {
    const id = Number(rawId);
    if (Number.isNaN(id) || !commodityTypeMap.has(id)) continue;
    uniq.add(id);
  }
  return Array.from(uniq);
}

function buildCommoditySummary(mode, ids) {
  if (mode === "all") return "All";
  const selected = normalizeCommodityTypeIds(ids);
  if (!selected.length) return "â€”";
  return `${selected.length} selected`;
}

function normalizeStockLocationIds(ids) {
  if (!Array.isArray(ids)) return [];
  const uniq = new Set();
  for (const rawId of ids) {
    const id = Number(rawId);
    if (Number.isNaN(id) || !stockLocationMap.has(id)) continue;
    uniq.add(id);
  }
  return Array.from(uniq);
}

function buildStockLocationSummary(mode, ids) {
  if (mode === "all") return "All";
  const selected = normalizeStockLocationIds(ids);
  if (!selected.length) return "â€”";
  return `${selected.length} selected`;
}

function toDisplayRow(row) {
  const commodityMode = row?.commodityMode === "selected" ? "selected" : "all";
  const commodityTypeIds = normalizeCommodityTypeIds(row?.commodityTypeIds);
  const stockLocationMode = row?.stockLocationMode === "selected" ? "selected" : "all";
  const stockLocationIds = normalizeStockLocationIds(row?.stockLocationIds);
  return {
    ...row,
    commodityMode,
    commodityTypeIds,
    stockLocationMode,
    stockLocationIds,
    commodityTypesAllowed: buildCommoditySummary(commodityMode, commodityTypeIds),
    stockLocationsAllowed: buildStockLocationSummary(stockLocationMode, stockLocationIds),
  };
}

function buildDraft(row) {
  const next = {};
  for (const field of config.formFields) next[field.key] = row?.[field.key] ?? "";
  next.commodityMode = row?.commodityMode === "selected" ? "selected" : "all";
  next.commodityTypeIds = normalizeCommodityTypeIds(row?.commodityTypeIds);
  next.stockLocationMode = row?.stockLocationMode === "selected" ? "selected" : "all";
  next.stockLocationIds = normalizeStockLocationIds(row?.stockLocationIds);
  return next;
}

function parseFieldValue(field, value) {
  if (field.type !== "number") return value;
  if (value === "") return "";
  const parsed = Number(value);
  return Number.isNaN(parsed) ? value : String(parsed);
}

export default function PackerPage() {
  const [rows, setRows] = useState(() => config.rows.map(toDisplayRow));
  const [selectedId, setSelectedId] = useState(null);
  const [modalMode, setModalMode] = useState(null);
  const [draft, setDraft] = useState(() => buildDraft());
  const [isMobile, setIsMobile] = useState(false);
  const [showGoToTop, setShowGoToTop] = useState(false);

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

  function openAddModal() {
    setDraft(buildDraft());
    setModalMode("add");
  }

  function openEditModal() {
    if (!selected) return;
    setDraft(buildDraft(selected));
    setModalMode("edit");
  }

  function closeModal() {
    setModalMode(null);
  }

  function saveModal() {
    const requiredMissing = config.formFields.some((field) => field.required && !String(draft[field.key] ?? "").trim());
    if (requiredMissing) return;
    const normalized = {};
    for (const field of config.formFields) normalized[field.key] = parseFieldValue(field, draft[field.key] ?? "");
    const commodityMode = draft.commodityMode === "selected" ? "selected" : "all";
    const commodityTypeIds = commodityMode === "selected" ? normalizeCommodityTypeIds(draft.commodityTypeIds) : [];
    const stockLocationMode = draft.stockLocationMode === "selected" ? "selected" : "all";
    const stockLocationIds = stockLocationMode === "selected" ? normalizeStockLocationIds(draft.stockLocationIds) : [];
    if (modalMode === "add") {
      const nextId = Math.max(0, ...rows.map((row) => Number(row.id) || 0)) + 1;
      const nextRow = toDisplayRow({ id: nextId, ...normalized, commodityMode, commodityTypeIds, stockLocationMode, stockLocationIds });
      setRows((prev) => [nextRow, ...prev]);
      setSelectedId(nextId);
      setModalMode(null);
      return;
    }
    if (modalMode === "edit" && selected) {
      setRows((prev) =>
        prev.map((row) =>
          row.id === selected.id ? toDisplayRow({ ...row, ...normalized, commodityMode, commodityTypeIds, stockLocationMode, stockLocationIds }) : row
        )
      );
      setModalMode(null);
    }
  }

  function setCommodityMode(mode) {
    setDraft((prev) => ({
      ...prev,
      commodityMode: mode,
      commodityTypeIds: mode === "all" ? [] : prev.commodityTypeIds,
    }));
  }

  function toggleCommodityType(id) {
    setDraft((prev) => {
      const current = normalizeCommodityTypeIds(prev.commodityTypeIds);
      const exists = current.includes(id);
      return {
        ...prev,
        commodityMode: "selected",
        commodityTypeIds: exists ? current.filter((item) => item !== id) : [...current, id],
      };
    });
  }

  function setStockLocationMode(mode) {
    setDraft((prev) => ({
      ...prev,
      stockLocationMode: mode,
      stockLocationIds: mode === "all" ? [] : prev.stockLocationIds,
    }));
  }

  function toggleStockLocation(id) {
    setDraft((prev) => {
      const current = normalizeStockLocationIds(prev.stockLocationIds);
      const exists = current.includes(id);
      return {
        ...prev,
        stockLocationMode: "selected",
        stockLocationIds: exists ? current.filter((item) => item !== id) : [...current, id],
      };
    });
  }

  function removeSelected() {
    if (!selected) return;
    setRows((prev) => prev.filter((row) => row.id !== selected.id));
    setSelectedId(null);
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs text-slate-500">Reference Data / {config.title}</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 md:text-[1.65rem]">{config.title}</h1>
        {!isMobile ? <p className="mt-1 text-xs text-slate-500">{config.subtitle}</p> : null}
      </div>

      <div className={cn("grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(240px,320px)] xl:items-start", isMobile && "grid-cols-1")}>
        <div className="overflow-hidden rounded-xl bg-white shadow-sm">
          {isMobile ? (
            <MobileList
              rows={rows}
              selectedId={selectedId}
              onSelect={setSelectedId}
              search=""
              title={config.title}
              primaryKey={config.columns[0]?.key}
              secondaryKey={config.columns[2]?.key ?? config.columns[1]?.key}
              summaryKeys={config.columns.slice(1, 4).map((column) => column.key)}
            />
          ) : (
            <Grid
              columns={gridColumns}
              rows={rows}
              getRowId={(row) => row.id}
              theme="light"
              density="standard"
              fileName={config.title}
              visibleRows={12}
              onRowClick={(row) => setSelectedId((prev) => (prev === row.id ? null : row.id))}
              toolbarActions={
                <div className="flex flex-wrap gap-2">
                  <Button type="button" size="sm" onClick={openAddModal}>+ Add</Button>
                  <Button type="button" variant="outline" size="sm" disabled={!selected} onClick={openEditModal}>Edit</Button>
                  <Button type="button" variant="destructive" size="sm" disabled={!selected} onClick={removeSelected}>Delete</Button>
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
        <div className="grid gap-3 sm:grid-cols-2">
          {config.formFields.map((field) => (
            <FormField key={field.key} field={field} value={draft[field.key] ?? ""} onChange={(value) => setDraft((prev) => ({ ...prev, [field.key]: value }))} />
          ))}
        </div>
        <div className="mt-4 space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">Commodity Types Allowed</p>
          <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50/50 p-3">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input suppressHydrationWarning type="radio" name="commodity-mode" checked={draft.commodityMode === "all"} onChange={() => setCommodityMode("all")} />
              All
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="radio"
                name="commodity-mode"
                checked={draft.commodityMode === "selected"}
                onChange={() => setCommodityMode("selected")}
              />
              Select commodity types
            </label>
            {draft.commodityMode === "selected" ? (
              commodityTypeOptions.length ? (
                <div className="grid gap-2 pt-1 sm:grid-cols-2">
                  {commodityTypeOptions.map((option) => {
                    const checked = normalizeCommodityTypeIds(draft.commodityTypeIds).includes(option.id);
                    return (
                      <label key={option.id} className="flex items-center gap-2 text-sm text-slate-700">
                        <input suppressHydrationWarning type="checkbox" checked={checked} onChange={() => toggleCommodityType(option.id)} />
                        {option.name}
                      </label>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-slate-500">No commodity types found in the commodity base table.</p>
              )
            ) : null}
          </div>
        </div>
        <div className="mt-4 space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">Stock Locations Allowed</p>
          <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50/50 p-3">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input suppressHydrationWarning type="radio" name="stock-location-mode" checked={draft.stockLocationMode === "all"} onChange={() => setStockLocationMode("all")} />
              All
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="radio"
                name="stock-location-mode"
                checked={draft.stockLocationMode === "selected"}
                onChange={() => setStockLocationMode("selected")}
              />
              Select stock locations
            </label>
            {draft.stockLocationMode === "selected" ? (
              stockLocationOptions.length ? (
                <div className="grid gap-2 pt-1 sm:grid-cols-2">
                  {stockLocationOptions.map((option) => {
                    const checked = normalizeStockLocationIds(draft.stockLocationIds).includes(option.id);
                    return (
                      <label key={option.id} className="flex items-center gap-2 text-sm text-slate-700">
                        <input suppressHydrationWarning type="checkbox" checked={checked} onChange={() => toggleStockLocation(option.id)} />
                        {option.name}
                      </label>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-slate-500">No stock locations found in the stock location base table.</p>
              )
            ) : null}
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={closeModal}>Cancel</Button>
          <Button type="button" size="sm" onClick={saveModal}>{modalMode === "edit" ? "Save changes" : "Create"}</Button>
        </div>
      </Modal>

      {isMobile && showGoToTop ? (
        <button
          type="button"
          aria-label="Go to top"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="fixed bottom-5 right-5 z-50 flex size-12 items-center justify-center rounded-full bg-gradient-to-br from-brand to-blue-500 text-xl text-white shadow-lg shadow-blue-500/30"
        >
          â†‘
        </button>
      ) : null}
    </div>
  );
}

function FormField({ field, value, onChange }) {
  return (
    <div className={cn("space-y-1", field.wide && "sm:col-span-2", field.type === "textarea" && "sm:col-span-2")}>
      <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">
        {field.label}
        {field.required ? <span className="text-red-500"> *</span> : null}
      </label>
      {field.type === "select" ? (
        <select suppressHydrationWarning className={inputClass} value={value} onChange={(event) => onChange(event.target.value)}>
          <option value="">Select...</option>
          {field.options?.map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
      ) : field.type === "textarea" ? (
        <textarea suppressHydrationWarning className={cn(inputClass, "min-h-20 resize-y")} value={value} onChange={(event) => onChange(event.target.value)} placeholder={field.placeholder} rows={3} />
      ) : (
        <input suppressHydrationWarning type={field.type || "text"} className={inputClass} value={value} onChange={(event) => onChange(event.target.value)} placeholder={field.placeholder} />
      )}
    </div>
  );
}

function MobileList({ rows, selectedId, onSelect, search, title, primaryKey, secondaryKey, summaryKeys }) {
  const emptyMessage = search ? `No ${title.toLowerCase()} match your search.` : `No ${title.toLowerCase()} found. Add your first one!`;
  return (
    <div className="space-y-2 p-3">
      <div className="px-0.5 text-xs font-semibold text-slate-600">{title} ({rows.length})</div>
      {rows.length === 0 ? (
        <div className="py-8 text-center text-sm text-slate-400">{emptyMessage}</div>
      ) : (
        rows.map((row) => {
          const isSelected = row.id === selectedId;
          const summary = summaryKeys.map((key) => row[key]).filter(Boolean).join(" Â· ");
          return (
            <button
              key={row.id}
              type="button"
              onClick={() => onSelect(isSelected ? null : row.id)}
              className={cn("w-full rounded-xl border-2 px-3 py-3 text-left transition-colors", isSelected ? "border-blue-500 bg-blue-50" : "border-slate-200 bg-white")}
            >
              <p className="text-xs font-bold text-blue-600">{row[primaryKey] || "â€”"}</p>
              <p className="mt-1 text-sm font-semibold text-slate-800">{row[secondaryKey] || "â€”"}</p>
              <p className="mt-1 text-[11px] text-slate-500">{summary || "â€”"}</p>
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
      <dd className={cn("mt-0.5 text-slate-800", highlight && "font-semibold text-brand")}>{value || "â€”"}</dd>
    </div>
  );
}

function Modal({ open, title, onClose, children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button type="button" className="absolute inset-0 bg-black/40" aria-label="Close dialog" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-labelledby="reference-data-modal-title" className="relative max-h-[min(90vh,720px)] w-full max-w-2xl overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-4 py-3">
          <h2 id="reference-data-modal-title" className="text-sm font-semibold text-slate-900">{title}</h2>
          <button type="button" className="rounded-md px-2 py-1 text-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800" onClick={onClose}>
            x
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}