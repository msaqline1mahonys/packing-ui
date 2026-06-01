"use client";

import { useEffect, useState } from "react";

import { Grid } from "@/components/clutch-table";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const MOBILE_BREAKPOINT = 900;
const inputClass =
  "w-full rounded-lg border border-slate-200/95 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-brand/15 placeholder:text-slate-400 focus:border-brand/35 focus:ring-2";

const APPLIES_TO_OPTIONS = ["Incoming Tickets", "Outgoing Tickets", "Outgoing Containers"];
const TEST_TYPES = ["Percentage", "Count", "Group"];

function formatMembers(ids, allRows) {
  if (!Array.isArray(ids) || ids.length === 0) return "";
  const lookup = new Map((allRows ?? []).map((r) => [r.id, r.testName]));
  return ids.map((id) => lookup.get(id) ?? `#${id}`).join(", ");
}

const config = {
  title: "Tests",
  subtitle: "Manage product testing parameters, units, and groups.",
  columns: [
    { key: "testName", label: "TEST NAME" },
    { key: "type", label: "TYPE" },
    { key: "unit", label: "UNIT" },
    {
      key: "members",
      label: "MEMBERS",
      format: (v, row, allRows) => (row.type === "Group" ? formatMembers(v, allRows) : "—"),
    },
    { key: "appliesTo", label: "APPLIES TO", format: (v) => (Array.isArray(v) ? v.join(", ") : (v ?? "")) },
    { key: "status", label: "STATUS" },
  ],
  rows: [
    {
      id: 1,
      testName: "Protein",
      type: "Percentage",
      unit: "%",
      appliesTo: ["Incoming Tickets", "Outgoing Tickets", "Outgoing Containers"],
      status: "Active",
      description: "Measures protein content.",
    },
    {
      id: 2,
      testName: "Moisture",
      type: "Percentage",
      unit: "%",
      appliesTo: ["Incoming Tickets", "Outgoing Tickets", "Outgoing Containers"],
      status: "Active",
      description: "Measures moisture content.",
    },
  ],
  formFields: [
    { key: "testName", label: "TEST NAME", required: true, placeholder: "e.g., Protein, Moisture, Total Defects" },
    {
      key: "type",
      label: "TYPE",
      required: true,
      type: "select",
      options: TEST_TYPES,
    },
    { key: "unit", label: "UNIT", required: true, placeholder: "%" },
    {
      key: "members",
      label: "MEMBER TESTS",
      required: true,
      type: "test-members",
      wide: true,
      showWhen: (draft) => draft.type === "Group",
    },
    {
      key: "appliesTo",
      label: "APPLIES TO",
      required: true,
      type: "checkboxes",
      options: APPLIES_TO_OPTIONS,
      wide: true,
    },
    { key: "description", label: "DESCRIPTION", type: "textarea", placeholder: "Optional description of what this test measures", wide: true },
    {
      key: "status",
      label: "STATUS",
      type: "select",
      options: ["Active", "Inactive"],
    },
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
  const next = {};
  for (const field of config.formFields) {
    if (field.type === "checkboxes" || field.type === "test-members") {
      next[field.key] = Array.isArray(row?.[field.key]) ? [...row[field.key]] : [];
    } else {
      next[field.key] = row?.[field.key] ?? "";
    }
  }
  return next;
}

function parseFieldValue(field, value) {
  if (field.type !== "number") return value;
  if (value === "" || value == null) return "";
  const parsed = Number(value);
  return Number.isNaN(parsed) ? value : parsed;
}

function isFieldVisible(field, draft) {
  return typeof field.showWhen !== "function" || field.showWhen(draft);
}

export default function TestPage() {
  const [rows, setRows] = useState(() => [...config.rows]);
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
    const requiredMissing = config.formFields.some((field) => {
      if (!field.required) return false;
      if (!isFieldVisible(field, draft)) return false;
      const val = draft[field.key];
      if (field.type === "checkboxes" || field.type === "test-members") {
        return !Array.isArray(val) || val.length === 0;
      }
      if (field.type === "number") {
        return val === "" || val == null || Number.isNaN(Number(val));
      }
      return !String(val ?? "").trim();
    });
    if (requiredMissing) return;

    const normalized = {};
    for (const field of config.formFields) {
      if (!isFieldVisible(field, draft)) {
        normalized[field.key] = field.type === "checkboxes" || field.type === "test-members" ? [] : "";
        continue;
      }
      if (field.type === "checkboxes" || field.type === "test-members") {
        normalized[field.key] = Array.isArray(draft[field.key]) ? [...draft[field.key]] : [];
      } else {
        normalized[field.key] = parseFieldValue(field, draft[field.key] ?? "");
      }
    }

    if (modalMode === "add") {
      const nextId = Math.max(0, ...rows.map((row) => Number(row.id) || 0)) + 1;
      const nextRow = { id: nextId, ...normalized };
      setRows((prev) => [nextRow, ...prev]);
      setSelectedId(nextId);
      setModalMode(null);
      return;
    }
    if (modalMode === "edit" && selected) {
      setRows((prev) => prev.map((row) => (row.id === selected.id ? { ...row, ...normalized } : row)));
      setModalMode(null);
    }
  }

  function removeSelected() {
    if (!selected) return;
    setRows((prev) => prev.filter((row) => row.id !== selected.id));
    setSelectedId(null);
  }

  // Build grid rows with the format functions pre-applied for columns that use derived row data
  const rowsWithRefs = rows;

  const visibleFormFields = config.formFields.filter((field) => isFieldVisible(field, draft));

  // Tests available as members (Count type only, excluding self when editing)
  const memberCandidates = rows.filter(
    (r) => r.type === "Count" && (modalMode !== "edit" || r.id !== selected?.id)
  );

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
              rows={rowsWithRefs}
              allRows={rows}
              selectedId={selectedId}
              onSelect={setSelectedId}
              search=""
              title={config.title}
              primaryKey={config.columns[0]?.key}
              secondaryKey={config.columns[2]?.key ?? config.columns[1]?.key}
              summaryColumns={config.columns.slice(1, 4)}
            />
          ) : (
            <Grid
              columns={gridColumns.map((c) => {
                const colDef = config.columns.find((cc) => cc.key === c.key);
                if (colDef?.format) {
                  return { ...c, format: (val, row) => colDef.format(val, row, rows) };
                }
                return c;
              })}
              rows={rowsWithRefs}
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
                {config.columns.map((column) => {
                  const raw = selected[column.key];
                  const display = column.format ? column.format(raw, selected, rows) : raw;
                  return (
                    <DetailItem key={column.key} label={column.label} value={display} highlight={column === config.columns[0]} />
                  );
                })}
              </dl>
            )}
          </aside>
        ) : null}
      </div>

      <Modal open={modalMode != null} title={modalMode === "edit" ? `Edit ${config.title.slice(0, -1)}` : `Add ${config.title.slice(0, -1)}`} onClose={closeModal}>
        <div className="grid gap-3 sm:grid-cols-2">
          {visibleFormFields.map((field) => (
            <FormField
              key={field.key}
              field={field}
              value={draft[field.key] ?? ""}
              onChange={(value) => setDraft((prev) => ({ ...prev, [field.key]: value }))}
              memberCandidates={memberCandidates}
            />
          ))}
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
          ↑
        </button>
      ) : null}
    </div>
  );
}

function FormField({ field, value, onChange, memberCandidates }) {
  return (
    <div className={cn("space-y-1", field.wide && "sm:col-span-2", field.type === "textarea" && "sm:col-span-2")}>
      <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">
        {field.label}
        {field.required ? <span className="text-red-500"> *</span> : null}
      </label>
      {field.type === "select" ? (
        <select className={inputClass} value={value} onChange={(event) => onChange(event.target.value)}>
          <option value="">Select...</option>
          {field.options?.map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
      ) : field.type === "checkboxes" ? (
        <div className="flex flex-wrap gap-3 rounded-lg border border-slate-200/95 bg-white px-3 py-2.5">
          {field.options?.map((option) => {
            const selected = Array.isArray(value) ? value.includes(option) : false;
            return (
              <label key={option} className="inline-flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300 accent-blue-600"
                  checked={selected}
                  onChange={(event) => {
                    const arr = Array.isArray(value) ? value : [];
                    onChange(event.target.checked ? [...arr, option] : arr.filter((v) => v !== option));
                  }}
                />
                {option}
              </label>
            );
          })}
        </div>
      ) : field.type === "test-members" ? (
        <div className="rounded-lg border border-slate-200/95 bg-white p-2.5">
          {(memberCandidates ?? []).length === 0 ? (
            <p className="px-1 py-2 text-xs text-slate-400">
              No Count-type tests available. Add Count tests first.
            </p>
          ) : (
            <div className="max-h-44 overflow-y-auto space-y-1">
              {memberCandidates.map((test) => {
                const selected = Array.isArray(value) ? value.includes(test.id) : false;
                return (
                  <label
                    key={test.id}
                    className={cn(
                      "flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
                      selected ? "bg-blue-50" : "hover:bg-slate-50"
                    )}
                  >
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-slate-300 accent-blue-600"
                      checked={selected}
                      onChange={(event) => {
                        const arr = Array.isArray(value) ? value : [];
                        onChange(event.target.checked ? [...arr, test.id] : arr.filter((v) => v !== test.id));
                      }}
                    />
                    <span className={cn(selected && "font-medium text-slate-900")}>{test.testName}</span>
                    {test.unit ? <span className="ml-auto text-[11px] text-slate-400">{test.unit}</span> : null}
                  </label>
                );
              })}
            </div>
          )}
        </div>
      ) : field.type === "textarea" ? (
        <textarea className={cn(inputClass, "min-h-20 resize-y")} value={value} onChange={(event) => onChange(event.target.value)} placeholder={field.placeholder} rows={3} />
      ) : (
        <input type={field.type || "text"} className={inputClass} value={value} onChange={(event) => onChange(event.target.value)} placeholder={field.placeholder} />
      )}
    </div>
  );
}

function MobileList({ rows, allRows, selectedId, onSelect, search, title, primaryKey, secondaryKey, summaryColumns }) {
  const emptyMessage = search ? `No ${title.toLowerCase()} match your search.` : `No ${title.toLowerCase()} found. Add your first one!`;
  return (
    <div className="space-y-2 p-3">
      <div className="px-0.5 text-xs font-semibold text-slate-600">{title} ({rows.length})</div>
      {rows.length === 0 ? (
        <div className="py-8 text-center text-sm text-slate-400">{emptyMessage}</div>
      ) : (
        rows.map((row) => {
          const isSelected = row.id === selectedId;
          const summary = (summaryColumns ?? [])
            .map((col) => {
              const raw = row[col.key];
              const v = col.format ? col.format(raw, row, allRows) : raw;
              return Array.isArray(v) ? v.join(", ") : v;
            })
            .filter((v) => v && v !== "—")
            .join(" · ");
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
