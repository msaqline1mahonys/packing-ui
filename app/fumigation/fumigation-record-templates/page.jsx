"use client";

import { useEffect, useMemo, useState } from "react";

import { Grid } from "@/components/clutch-table";
import { Button } from "@/components/ui/button";
import {
  loadRecordTemplates,
  nextLocalEntityId,
  saveRecordTemplates,
} from "@/lib/fumigation-store";
import { RECORD_FIELDS } from "@/lib/fumigation-fields";
import { cn } from "@/lib/utils";

const inputClass =
  "w-full rounded-lg border border-slate-200/95 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-brand/15 placeholder:text-slate-400 focus:border-brand/35 focus:ring-2";

function buildDraft(row) {
  return {
    name: row?.name ?? "",
    headerText: row?.headerText ?? "",
    footerText: row?.footerText ?? "",
    body: row?.body ?? "",
    includeCertificateFields: row?.includeCertificateFields ?? true,
    fields: row?.fields?.length ? row.fields : RECORD_FIELDS,
  };
}

export default function FumigationRecordTemplatesPage() {
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [modalMode, setModalMode] = useState(null);
  const [draft, setDraft] = useState(() => buildDraft());

  useEffect(() => {
    setRows(loadRecordTemplates());
  }, []);

  const filteredRows = useMemo(() => {
    if (!search.trim()) return rows;
    const needle = search.toLowerCase();
    return rows.filter((row) => `${row.name} ${row.body}`.toLowerCase().includes(needle));
  }, [rows, search]);

  const selected = selectedId != null ? rows.find((row) => row.id === selectedId) ?? null : null;

  const gridColumns = useMemo(
    () => [
      { key: "name", header: "Name", type: "text", sortable: true, filterable: true, resizable: true },
      { key: "headerText", header: "Header", type: "text", sortable: true, filterable: true, resizable: true },
      {
        key: "fieldCount",
        header: "Record fields",
        type: "number",
        sortable: true,
        filterable: true,
        resizable: true,
        valueGetter: (row) => row.fields.length,
      },
      {
        key: "includesCertificateLabel",
        header: "Includes certificate",
        type: "text",
        sortable: true,
        filterable: true,
        resizable: true,
        valueGetter: (row) => (row.includeCertificateFields ? "Yes" : "No"),
      },
    ],
    []
  );

  function openAdd() {
    setDraft(buildDraft());
    setModalMode("add");
  }

  function openEdit() {
    if (!selected) return;
    setDraft(buildDraft(selected));
    setModalMode("edit");
  }

  function closeModal() {
    setModalMode(null);
  }

  function toggleField(label) {
    setDraft((prev) => {
      const next = new Set(prev.fields);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return { ...prev, fields: [...next] };
    });
  }

  function saveModal() {
    if (!draft.name.trim()) return;
    const normalized = { ...draft, name: draft.name.trim() };

    if (modalMode === "add") {
      const nextId = nextLocalEntityId(rows);
      const nextRows = [{ id: nextId, ...normalized }, ...rows];
      setRows(nextRows);
      saveRecordTemplates(nextRows);
      setSelectedId(nextId);
      setModalMode(null);
      return;
    }

    if (modalMode === "edit" && selected) {
      const nextRows = rows.map((row) =>
        row.id === selected.id ? { ...row, ...normalized } : row
      );
      setRows(nextRows);
      saveRecordTemplates(nextRows);
      setModalMode(null);
    }
  }

  function removeSelected() {
    if (!selected) return;
    const nextRows = rows.filter((row) => row.id !== selected.id);
    setRows(nextRows);
    saveRecordTemplates(nextRows);
    setSelectedId(null);
  }

  const previewFields = draft.fields.length ? draft.fields : ["No record fields selected"];

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs text-slate-500">Fumigation / Record templates</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 md:text-[1.65rem]">
          Fumigation Record Templates
        </h1>
        <p className="mt-1 text-xs text-slate-500">
          Configure monitoring record sheet templates used during fumigation operations.
        </p>
      </div>

      <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <input
            className={cn(inputClass, "max-w-md")}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search record template..."
          />
          <div className="ml-auto flex flex-wrap gap-2">
            <Button type="button" size="sm" onClick={openAdd}>
              + Add
            </Button>
            <Button type="button" variant="outline" size="sm" disabled={!selected} onClick={openEdit}>
              Edit
            </Button>
            <Button type="button" variant="destructive" size="sm" disabled={!selected} onClick={removeSelected}>
              Delete
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px] xl:items-start">
        <div className="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-sm">
          <Grid
            columns={gridColumns}
            rows={filteredRows}
            getRowId={(row) => row.id}
            theme="light"
            density="standard"
            fileName="Fumigation Record Templates"
            visibleRows={12}
            persistKey="fumigation-record-templates"
            enableGlobalSearch={false}
            emptyMessage="No record templates found."
            onRowClick={(row) => setSelectedId((prev) => (prev === row.id ? null : row.id))}
            getRowClassName={({ row }) => (row.id === selectedId ? "clutch-row-selected" : undefined)}
            getRowStyle={({ row }) => (row.id === selectedId ? { backgroundColor: "#dbeafe" } : undefined)}
          />
        </div>

        <aside className="rounded-xl border border-slate-200/90 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">Template Details</h2>
          {!selected ? (
            <p className="mt-4 text-sm text-slate-500">Select a row to view details.</p>
          ) : (
            <dl className="mt-4 space-y-3 text-sm">
              <DetailItem label="Template name" value={selected.name} highlight />
              <DetailItem label="Header text" value={selected.headerText} />
              <DetailItem label="Footer text" value={selected.footerText} />
              <DetailItem label="Body" value={selected.body} />
              <DetailItem
                label="Includes certificate fields"
                value={selected.includeCertificateFields ? "Yes" : "No"}
              />
            </dl>
          )}
        </aside>
      </div>

      <Modal
        open={modalMode != null}
        title={modalMode === "edit" ? "Edit record template" : "Add record template"}
        onClose={closeModal}
      >
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="Template name *" wide>
              <input
                className={inputClass}
                value={draft.name}
                onChange={(event) => setDraft((prev) => ({ ...prev, name: event.target.value }))}
              />
            </FormField>
            <FormField label="Header text">
              <textarea
                className={cn(inputClass, "min-h-20 resize-y")}
                rows={3}
                value={draft.headerText}
                onChange={(event) => setDraft((prev) => ({ ...prev, headerText: event.target.value }))}
              />
            </FormField>
            <FormField label="Footer text">
              <textarea
                className={cn(inputClass, "min-h-20 resize-y")}
                rows={3}
                value={draft.footerText}
                onChange={(event) => setDraft((prev) => ({ ...prev, footerText: event.target.value }))}
              />
            </FormField>
            <FormField label="Body" wide>
              <textarea
                className={cn(inputClass, "min-h-24 resize-y")}
                rows={4}
                value={draft.body}
                onChange={(event) => setDraft((prev) => ({ ...prev, body: event.target.value }))}
              />
            </FormField>
          </div>

          <label className="inline-flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={draft.includeCertificateFields}
              onChange={(event) =>
                setDraft((prev) => ({ ...prev, includeCertificateFields: event.target.checked }))
              }
            />
            Include certificate fields before monitoring lines
          </label>

          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">
              Monitoring record fields
            </p>
            <div className="mt-2 grid gap-2 rounded-lg border border-slate-200/95 bg-white p-3 sm:grid-cols-2">
              {RECORD_FIELDS.map((label) => (
                <label key={label} className="inline-flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={draft.fields.includes(label)}
                    onChange={() => toggleField(label)}
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-slate-200/90 bg-slate-50/70 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">Preview</p>
            <div className="mt-2 space-y-2 rounded-md border border-slate-200 bg-white p-3 text-sm">
              <p className="font-semibold text-slate-900">{draft.name || "Record template name"}</p>
              <p className="text-slate-600">{draft.headerText || "Header text"}</p>
              {draft.includeCertificateFields ? (
                <p className="text-xs uppercase tracking-wide text-brand">Certificate fields block enabled</p>
              ) : null}
              <p className="text-slate-700">{draft.body || "Record sheet body"}</p>
              <ul className="list-inside list-disc text-slate-600">
                {previewFields.map((field) => (
                  <li key={field}>{field}</li>
                ))}
              </ul>
              <p className="text-slate-500">{draft.footerText || "Footer text"}</p>
            </div>
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={closeModal}>
            Cancel
          </Button>
          <Button type="button" size="sm" onClick={saveModal}>
            {modalMode === "edit" ? "Save changes" : "Create"}
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
