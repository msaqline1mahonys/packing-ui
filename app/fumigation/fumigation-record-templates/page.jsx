"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Grid } from "@/components/clutch-table";
import { Button } from "@/components/ui/button";
import FumigationRecordDocument from "@/components/fumigation/fumigation-record-document";
import { RECORD_SECTIONS } from "@/lib/fumigation-fields";
import {
  getTenantPayload,
  listRecordTemplates,
  createRecordTemplate,
  updateRecordTemplate,
  deleteRecordTemplate,
} from "@/lib/api/fumigation";
import { cn } from "@/lib/utils";

const inputClass =
  "w-full rounded-lg border border-slate-200/95 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-brand/15 placeholder:text-slate-400 focus:border-brand/35 focus:ring-2";

const ALL_SECTION_KEYS = RECORD_SECTIONS.map((s) => s.key);

function fromApiRecordTemplate(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name ?? "",
    headerText: row.header_text ?? row.headerText ?? "",
    footerText: row.footer_text ?? row.footerText ?? "",
    body: row.body ?? "",
    sections: Array.isArray(row.sections) ? row.sections : ALL_SECTION_KEYS,
    includeCertificateFields:
      row.include_certificate_fields ?? row.includeCertificateFields ?? true,
    logoDataUrl: row.logo_data_url ?? row.logoDataUrl ?? "",
    footerLogoDataUrl: row.footer_logo_data_url ?? row.footerLogoDataUrl ?? "",
  };
}

function toApiPayload(draft) {
  return {
    name: String(draft.name ?? "").trim(),
    header_text: String(draft.headerText ?? "").trim() || null,
    footer_text: String(draft.footerText ?? "").trim() || null,
    body: String(draft.body ?? "").trim() || null,
    sections: draft.sections ?? ALL_SECTION_KEYS,
    include_certificate_fields: draft.includeCertificateFields !== false,
    logo_data_url: draft.logoDataUrl || null,
    footer_logo_data_url: draft.footerLogoDataUrl || null,
  };
}

function buildDraft(row) {
  return {
    name: row?.name ?? "",
    headerText: row?.headerText ?? "",
    footerText: row?.footerText ?? "",
    body: row?.body ?? "",
    sections: Array.isArray(row?.sections) ? row.sections : ALL_SECTION_KEYS,
    includeCertificateFields: row?.includeCertificateFields !== false,
    logoDataUrl: row?.logoDataUrl ?? "",
    footerLogoDataUrl: row?.footerLogoDataUrl ?? "",
  };
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    if (!file) {
      resolve("");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("read failed"));
    reader.readAsDataURL(file);
  });
}

function buildPreviewModel(draft) {
  return {
    packId: 0,
    packRef: "PREVIEW-000001",
    issuedDate: new Date().toLocaleDateString("en-AU"),
    fumigatorName: "Sample Fumigator",
    fumigatorAccreditationNumber: "FUM-1234",
    treatmentProviderId: "AEI-DEMO-001",
    customerName: "Demo Customer Pty Ltd",
    customerAddress: "12 Sample Street, Melbourne VIC 3000",
    jobIdentificationNumber: "JOB-DEMO-001",
    placeStreet: "12 Example Drive",
    placeSuburb: "Altona",
    placeCountry: "Australia",
    placePostcode: "3018",
    targetOfFumigation: ["commodity"],
    commodityDescription: "Wheat — Premium Grade",
    commodityCode: "WHT-PREM",
    containerNumbers: ["ABCU1234567"],
    enclosureType: "unsheeted-container",
    enclosureOtherText: "",
    enclosureLengthM: "5.9",
    enclosureWidthM: "2.4",
    enclosureHeightM: "2.4",
    volumeM3: "33.2",
    consignmentSuitable: true,
    consignmentRemedialAction: "",
    prescribedDoseRate: "48",
    prescribedDoseUnit: "g/m3",
    prescribedExposure: "24",
    prescribedExposureUnit: "hours",
    prescribedTemperature: "21",
    fumigationType: "ambient",
    minForecastedTemperature: "18",
    minAmbientTemperature: "20",
    actualTemperature: "22",
    dosageValue: "48",
    dosageUnit: "g/m3",
    calculatedDosageValue: "1593.6",
    calculatedDosageUnit: "g",
    actualDosageAppliedValue: "1600",
    actualDosageAppliedUnit: "g",
    chloropicrinUsed: false,
    chloropicrinPercent: "",
    heatersUsed: false,
    exposureTimeValue: "24",
    exposureTimeUnit: "hours",
    monitoringDeviceSerials: "DEV-001, DEV-002",
    dosingFinishAt: new Date().toISOString().slice(0, 16),
    ventilationStartAt: new Date().toISOString().slice(0, 16),
    concentrationReadings: [
      { id: 1, phase: "start", phaseLabel: "Start", date: "01/12", time: "08:00", location1: "48", location2: "47", location3: "47", location4: "", location5: "", equilibriumPercent: "98", standardGm3: "40", fumigatorInitials: "SF" },
      { id: 2, phase: "during", phaseLabel: "During", date: "01/12", time: "16:00", location1: "44", location2: "44", location3: "43", location4: "", location5: "", equilibriumPercent: "98", standardGm3: "40", fumigatorInitials: "SF" },
      { id: 3, phase: "end", phaseLabel: "End", date: "02/12", time: "08:00", location1: "41", location2: "40", location3: "40", location4: "", location5: "", equilibriumPercent: "98", standardGm3: "40", fumigatorInitials: "SF" },
    ],
    finalTlvPpm1: "0.2",
    finalTlvPpm2: "0.1",
    finalTlvPpm3: "",
    topUpEntries: [],
    endPointConcentration: "",
    endPointConcentrationUnit: "g/m3",
    ctRequired: "",
    ctAchieved: "",
    thirdPartySystem: false,
    thirdPartySystemName: "",
    fumigationResult: "pass",
    governmentOfficerName: "",
    governmentOfficerSignature: "",
    fumigant: { name: "Methyl Bromide", code: "MBR", activeConstituent: "Bromomethane", productForm: "Gas" },
    methodology: { name: "MBR container fumigation", version: "v3.0" },
    template: {
      name: draft.name,
      headerText: draft.headerText,
      footerText: draft.footerText,
      body: draft.body,
      sections: draft.sections,
      logoDataUrl: draft.logoDataUrl,
      footerLogoDataUrl: draft.footerLogoDataUrl,
    },
    site: { name: "Mahonys Packing" },
    siteAddress: { line1: "Mahonys Packing Pty Ltd", line2: "Melbourne, VIC", phone: "+61 3 9000 0000", email: "ops@mahonys.local" },
  };
}

export default function FumigationRecordTemplatesPage() {
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [modalMode, setModalMode] = useState(null);
  const [draft, setDraft] = useState(() => buildDraft());
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const headerFileRef = useRef(null);
  const footerFileRef = useRef(null);
  const modalError = modalMode ? error : "";

  const loadTemplates = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const raw = await listRecordTemplates({ search });
      setRows(raw.map(fromApiRecordTemplate).filter(Boolean));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load record templates.");
    } finally {
      setIsLoading(false);
    }
  }, [search]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      loadTemplates();
    });
    return () => cancelAnimationFrame(frame);
  }, [loadTemplates]);

  const filteredRows = useMemo(() => {
    if (!search.trim()) return rows;
    const needle = search.toLowerCase();
    return rows.filter((row) => `${row.name} ${row.body || ""}`.toLowerCase().includes(needle));
  }, [rows, search]);

  const selected = selectedId != null ? rows.find((row) => row.id === selectedId) ?? null : null;

  const gridColumns = useMemo(
    () => [
      { key: "name", header: "Name", type: "text", sortable: true, filterable: true, resizable: true },
      { key: "headerText", header: "Header", type: "text", sortable: true, filterable: true, resizable: true },
      { key: "footerText", header: "Footer", type: "text", sortable: true, filterable: true, resizable: true },
      {
        key: "sectionsEnabled",
        header: "Sections enabled",
        type: "text",
        sortable: true,
        filterable: true,
        resizable: true,
        valueGetter: (row) => {
          const enabled = Array.isArray(row.sections) ? row.sections : ALL_SECTION_KEYS;
          return `${enabled.length} / ${ALL_SECTION_KEYS.length}`;
        },
      },
      {
        key: "hasLogo",
        header: "Logo",
        type: "text",
        sortable: true,
        filterable: true,
        resizable: true,
        valueGetter: (row) => (row.logoDataUrl ? "Custom" : "Default"),
      },
    ],
    []
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

  function toggleSection(key) {
    setDraft((prev) => {
      const next = new Set(prev.sections ?? []);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return { ...prev, sections: [...next] };
    });
  }

  async function onPickLogo(target, fileList) {
    const file = fileList?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Logo must be an image file.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError("Logo must be 2 MB or smaller.");
      return;
    }
    try {
      const dataUrl = await fileToDataUrl(file);
      setDraft((prev) => ({ ...prev, [target]: dataUrl }));
      setError("");
    } catch {
      setError("Could not read logo file.");
    }
  }

  function clearLogo(target) {
    setDraft((prev) => ({ ...prev, [target]: "" }));
  }

  async function saveModal() {
    if (!draft.name.trim()) {
      setError("Template name is required.");
      return;
    }

    const tenant = getTenantPayload();
    if (!tenant.organization_id || !tenant.site_id) {
      setError("Organization and current site are required to save a template.");
      return;
    }

    setIsSaving(true);
    setError("");
    setNotice("");

    try {
      const body = toApiPayload({ ...draft, name: draft.name.trim() });

      if (modalMode === "add") {
        const result = await createRecordTemplate(body);
        const nextRow = fromApiRecordTemplate(result.data);
        if (!nextRow) throw new Error("Invalid response from server.");
        setRows((prev) => [nextRow, ...prev]);
        setSelectedId(nextRow.id);
        setNotice(result.message || "Record template created successfully.");
        setModalMode(null);
        return;
      }

      if (modalMode === "edit" && selected) {
        const result = await updateRecordTemplate(selected.id, body);
        const nextRow = fromApiRecordTemplate(result.data);
        if (!nextRow) throw new Error("Invalid response from server.");
        setRows((prev) => prev.map((row) => (row.id === selected.id ? nextRow : row)));
        setNotice(result.message || "Record template updated successfully.");
        setModalMode(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save record template.");
    } finally {
      setIsSaving(false);
    }
  }

  async function removeSelected() {
    if (!selected || isDeleting) return;
    if (!window.confirm(`Delete record template "${selected.name}" permanently?`)) return;

    setIsDeleting(true);
    setError("");
    setNotice("");

    try {
      const result = await deleteRecordTemplate(selected.id);
      setRows((prev) => prev.filter((row) => row.id !== selected.id));
      setSelectedId(null);
      setNotice(result.message || "Record template deleted successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete record template.");
    } finally {
      setIsDeleting(false);
    }
  }

  const previewModel = useMemo(() => buildPreviewModel(draft), [draft]);

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs text-slate-500">Fumigation / Record templates</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 md:text-[1.65rem]">
          Fumigation Record Templates
        </h1>
        <p className="mt-1 text-xs text-slate-500">
          Toggle Sections A–E on the printed record of fumigation, upload header/footer logos, and
          set the boilerplate header/footer text.
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
            placeholder="Search record template..."
          />
          <div className="ml-auto flex flex-wrap gap-2">
            <Button type="button" size="sm" onClick={openAdd} disabled={isLoading}>
              + Add
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={loadTemplates} disabled={isLoading}>
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
            loading={isLoading}
            emptyMessage={isLoading ? "Loading record templates…" : "No record templates found."}
            onRowClick={(row) => setSelectedId((prev) => (prev === row.id ? null : row.id))}
            onPersistedRowActivate={(row) => setSelectedId(row.id)}
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
              <DetailItem
                label="Sections enabled"
                value={
                  (Array.isArray(selected.sections) ? selected.sections : ALL_SECTION_KEYS).length
                  + " of " + ALL_SECTION_KEYS.length
                }
              />
              <DetailItem
                label="Disabled sections"
                value={
                  Array.isArray(selected.sections)
                    ? RECORD_SECTIONS.filter((s) => !selected.sections.includes(s.key))
                        .map((s) => s.label)
                        .join(", ") || "—"
                    : "—"
                }
              />
              <DetailItem label="Header logo" value={selected.logoDataUrl ? "Custom uploaded" : "Default (Mahonys)"} />
              <DetailItem label="Footer logo" value={selected.footerLogoDataUrl ? "Custom uploaded" : "None"} />
            </dl>
          )}
        </aside>
      </div>

      <Modal
        open={modalMode != null}
        title={modalMode === "edit" ? "Edit record template" : "Add record template"}
        onClose={closeModal}
      >
        <form
          onSubmit={(event) => {
            event.preventDefault();
            saveModal();
          }}
        >
        {modalError ? (
          <div className="mb-3 rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-600">{modalError}</div>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-[minmax(0,460px)_minmax(0,1fr)]">
          {/* ─── EDITOR ─── */}
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
                  className={cn(inputClass, "min-h-16 resize-y")}
                  rows={2}
                  value={draft.headerText}
                  onChange={(event) => setDraft((prev) => ({ ...prev, headerText: event.target.value }))}
                />
              </FormField>
              <FormField label="Footer text">
                <textarea
                  className={cn(inputClass, "min-h-16 resize-y")}
                  rows={2}
                  value={draft.footerText}
                  onChange={(event) => setDraft((prev) => ({ ...prev, footerText: event.target.value }))}
                />
              </FormField>
              <FormField label="Internal description (not printed)" wide>
                <textarea
                  className={cn(inputClass, "min-h-16 resize-y")}
                  rows={2}
                  value={draft.body}
                  onChange={(event) => setDraft((prev) => ({ ...prev, body: event.target.value }))}
                />
              </FormField>
            </div>

            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                Sections rendered on the record sheet
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Unchecked sections disappear from the printed document.
              </p>
              <div className="mt-2 grid gap-2 rounded-lg border border-slate-200/95 bg-white p-3">
                {RECORD_SECTIONS.map((section) => (
                  <label key={section.key} className="inline-flex items-start gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={(draft.sections ?? []).includes(section.key)}
                      onChange={() => toggleSection(section.key)}
                    />
                    <span>{section.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <LogoUploader
                label="Header logo (override default)"
                value={draft.logoDataUrl}
                inputRef={headerFileRef}
                onPick={(files) => onPickLogo("logoDataUrl", files)}
                onClear={() => clearLogo("logoDataUrl")}
              />
              <LogoUploader
                label="Footer logo (optional)"
                value={draft.footerLogoDataUrl}
                inputRef={footerFileRef}
                onPick={(files) => onPickLogo("footerLogoDataUrl", files)}
                onClear={() => clearLogo("footerLogoDataUrl")}
              />
            </div>
          </div>

          {/* ─── LIVE PREVIEW ─── */}
          <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3 overflow-hidden">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
              Live preview (placeholder data)
            </p>
            <div className="origin-top-left bg-white rounded" style={{ transform: "scale(0.5)", width: "200%", transformOrigin: "top left" }}>
              <FumigationRecordDocument model={previewModel} hideToolbar />
            </div>
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

function LogoUploader({ label, value, inputRef, onPick, onClear }) {
  return (
    <div className="space-y-1">
      <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">{label}</label>
      <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50/50 p-2 flex items-center gap-2 min-h-[64px]">
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt="Logo preview" className="h-12 w-auto object-contain" />
        ) : (
          <span className="text-xs text-slate-400 px-2">No custom logo set</span>
        )}
        <div className="ml-auto flex flex-col gap-1">
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => {
              onPick(event.target.files);
              if (inputRef.current) inputRef.current.value = "";
            }}
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => inputRef.current?.click()}
          >
            {value ? "Replace" : "Upload"}
          </Button>
          {value && (
            <Button type="button" size="sm" variant="ghost" onClick={onClear}>
              Clear
            </Button>
          )}
        </div>
      </div>
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
      <dd className={cn("mt-0.5 break-words text-slate-800", highlight && "font-semibold text-brand")}>{value || "—"}</dd>
    </div>
  );
}

function Modal({ open, title, onClose, children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button type="button" className="absolute inset-0 bg-black/40" aria-label="Close dialog" onClick={onClose} />
      <div className="relative max-h-[min(95vh,920px)] w-full max-w-6xl overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl">
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
