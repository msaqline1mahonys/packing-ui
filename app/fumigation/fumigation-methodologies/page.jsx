"use client";

import { useEffect, useMemo, useState } from "react";

import { Grid } from "@/components/clutch-table";
import { Button } from "@/components/ui/button";
import { loadFumigants, loadMethodologies, saveMethodologies, nextLocalEntityId } from "@/lib/fumigation-store";
import { cn } from "@/lib/utils";

const inputClass =
  "w-full rounded-lg border border-slate-200/95 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-brand/15 placeholder:text-slate-400 focus:border-brand/35 focus:ring-2";

const APPLICATION_METHODS = ["Chamber", "In-container", "Sheeted stack", "Silo", "Vacuum chamber"];
const MIN_EXPOSURE_UNITS = ["hours", "days"];
const DOSAGE_UNITS = ["ppm", "g/m3", "mg/L", "%"];

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

export default function FumigationMethodologiesPage() {
  const [rows, setRows] = useState([]);
  const [fumigants, setFumigants] = useState(() => loadFumigants());
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [modalMode, setModalMode] = useState(null);
  const [draft, setDraft] = useState(() => buildDraft());
  const [error, setError] = useState(null);

  useEffect(() => {
    setRows(loadMethodologies());
  }, []);

  const filteredRows = useMemo(() => {
    if (!search.trim()) return rows;
    const needle = search.toLowerCase();
    return rows.filter((row) => {
      const fumigant = fumigants.find((item) => item.id === Number(row.fumigantId));
      const text = `${row.name} ${row.version} ${fumigant?.name ?? ""}`.toLowerCase();
      return text.includes(needle);
    });
  }, [rows, search, fumigants]);

  const selected = selectedId != null ? rows.find((row) => row.id === selectedId) ?? null : null;

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
        valueGetter: (row) => fumigants.find((item) => item.id === Number(row.fumigantId))?.name ?? "—",
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
    setError(null);
    setDraft(buildDraft());
    setModalMode("add");
  }

  function openEdit() {
    if (!selected) return;
    setError(null);
    setDraft(buildDraft(selected));
    setModalMode("edit");
  }

  function closeModal() {
    setModalMode(null);
    setError(null);
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
          dosageUnit: d.dosageUnit || "g/m³",
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

  function saveModal() {
    setError(null);
    if (!draft.name.trim() || !draft.fumigantId) return;

    // Validate dosage ranges
    let finalDraft = draft;
    if (draft.dosageRanges.length > 0) {
      for (const r of draft.dosageRanges) {
        if (r.minTempC === "" || r.maxTempC === "") {
          setError("All dosage ranges must have Min °C and Max °C values.");
          return;
        }
        if (Number(r.minTempC) >= Number(r.maxTempC)) {
          setError("Each dosage range Min °C must be less than Max °C.");
          return;
        }
      }
      // Sort by minTempC
      const sorted = [...draft.dosageRanges].sort((a, b) => Number(a.minTempC) - Number(b.minTempC));
      // Half-open overlap check: maxTempC of current must be <= minTempC of next
      for (let i = 0; i < sorted.length - 1; i++) {
        if (Number(sorted[i].maxTempC) > Number(sorted[i + 1].minTempC)) {
          setError(`Dosage ranges overlap: band ending at ${sorted[i].maxTempC}°C overlaps band starting at ${sorted[i + 1].minTempC}°C.`);
          return;
        }
      }
      // Store sorted
      finalDraft = { ...draft, dosageRanges: sorted };
    }

    if (modalMode === "add") {
      const nextId = nextLocalEntityId(rows);
      const nextRow = { id: nextId, ...finalDraft, fumigantId: Number(finalDraft.fumigantId) };
      const nextRows = [nextRow, ...rows];
      saveMethodologies(nextRows);
      setRows(nextRows);
      setSelectedId(nextId);
      setModalMode(null);
      return;
    }

    if (modalMode === "edit" && selected) {
      const nextRows = rows.map((row) =>
        row.id === selected.id ? { ...row, ...finalDraft, fumigantId: Number(finalDraft.fumigantId) } : row
      );
      saveMethodologies(nextRows);
      setRows(nextRows);
      setModalMode(null);
    }
  }

  function removeSelected() {
    if (!selected) return;
    const nextRows = rows.filter((row) => row.id !== selected.id);
    saveMethodologies(nextRows);
    setRows(nextRows);
    setSelectedId(null);
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

      <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <input
            className={cn(inputClass, "max-w-md")}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search methodology..."
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
            emptyMessage="No methodologies found."
            onRowClick={(row) => setSelectedId((prev) => (prev === row.id ? null : row.id))}
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
                value={fumigants.find((item) => item.id === Number(selected.fumigantId))?.name}
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

          {/* Dosage Ranges */}
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
                            {["g/m³", "ppm", "mg/L", "%"].map((u) => (
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
            <p className="text-xs text-slate-400">Bands use half-open intervals [Min, Max) — e.g. 15°C falls in [15,20), not [10,15).</p>
          </div>
        </div>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
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
