"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";

import { Grid } from "@/components/clutch-table";
import { Button } from "@/components/ui/button";
import CustomDateRangePicker from "@/components/ui/custom-date-range-picker";
import {
  RELEASE_STATUSES,
  blankRelease,
  computeReleaseExpiry,
  normalizeRelease,
} from "@/lib/releases-store";
import { deleteRelease, fetchReleases, saveRelease } from "@/lib/releases-api";
import { useInvalidateReferenceData } from "@/lib/hooks/use-reference-data-queries";
import { useAutoOpenAddModal } from "@/lib/hooks/use-auto-open-add-modal";
import { usePolling } from "@/lib/use-polling";
import { cn } from "@/lib/utils";

const MOBILE_BREAKPOINT = 900;
const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api"
).replace(/\/+$/, "");

const inputClass =
  "w-full rounded-lg border border-slate-200/95 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-brand/15 placeholder:text-slate-400 focus:border-brand/35 focus:ring-2";

function getAuthHeaders() {
  const token = typeof window !== "undefined" ? localStorage.getItem("authToken") : "";
  return {
    Accept: "application/json",
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function fetchPaginated(endpoint) {
  const response = await fetch(`${API_BASE_URL}${endpoint}?per_page=500`, {
    headers: getAuthHeaders(),
  });
  if (!response.ok) throw new Error(`Request to ${endpoint} failed.`);
  const json = await response.json().catch(() => null);
  const payload = json?.data;
  return Array.isArray(payload?.data) ? payload.data : Array.isArray(payload) ? payload : [];
}

const STATUS_CLASSES = {
  Open: "bg-blue-100 text-blue-800 border-blue-300",
  "In-progress": "bg-emerald-100 text-emerald-800 border-emerald-300",
  Completed: "bg-violet-100 text-violet-800 border-violet-300",
  Closed: "bg-slate-200 text-slate-700 border-slate-300",
};

const columns = [
  { key: "releaseNumber", label: "Release Number" },
  { key: "statusLabel", label: "Status" },
  { key: "parksSummary", label: "Empty Container Park(s)" },
  { key: "transportersSummary", label: "Transporter(s)" },
  { key: "containerCount", label: "Cap", numeric: true },
  { key: "pickedUpTotal", label: "Picked up", numeric: true },
  { key: "remainingTotal", label: "Remaining", numeric: true },
  { key: "containerCodeIsoCode", label: "Container Type" },
  { key: "releaseAvailableAtDisplay", label: "Available" },
  { key: "freeDays", label: "Free Days", numeric: true },
  { key: "releaseExpiryAtDisplay", label: "Expiry" },
  { key: "pickupByDisplay", label: "Pickup By" },
  { key: "attachmentsSummary", label: "Attachments" },
];

const gridColumns = columns.map((col) => ({
  key: col.key,
  header: col.label,
  type: col.numeric ? "number" : "text",
  sortable: true,
  filterable: true,
  resizable: true,
}));

const DATE_FILTER_FIELDS = [
  { key: "releaseAvailableAt", label: "Available" },
  { key: "releaseExpiryAt", label: "Expiry" },
  { key: "pickupBy", label: "Pickup By" },
];

function lookupName(list, id) {
  if (id === "" || id == null) return "";
  return list.find((item) => String(item.id) === String(id))?.name ?? "";
}

function containerCodeOptionLabel(row) {
  const iso = row.iso_code ?? row.isoCode ?? "";
  const size = row.container_size ?? row.containerSize ?? "";
  const desc = row.description ?? "";
  return [iso, size, desc].filter(Boolean).join(" · ");
}

function containerCodeIsoValue(row) {
  return row.iso_code ?? row.isoCode ?? "";
}

function formatDateTimeDisplay(value) {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  const day = String(parsed.getDate()).padStart(2, "0");
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const year = parsed.getFullYear();
  const hours = String(parsed.getHours()).padStart(2, "0");
  const minutes = String(parsed.getMinutes()).padStart(2, "0");
  return `${day}/${month}/${year} ${hours}:${minutes}`;
}

function decorate(row, containerParks, transporters) {
  const parks = Array.isArray(row.parks) ? row.parks : [];
  const parkNames = parks.map((p) => lookupName(containerParks, p.containerParkId)).filter(Boolean);
  const transporterIds = new Set();
  parks.forEach((p) => (p.transporterIds || []).forEach((id) => transporterIds.add(String(id))));
  const transporterNames = Array.from(transporterIds)
    .map((id) => lookupName(transporters, id))
    .filter(Boolean);
  const attachmentCount = Array.isArray(row.attachments) ? row.attachments.length : 0;
  const pickedUp = row.usage?.pickedUpTotal ?? row.usage?.picked_up_total ?? "";
  const remaining = row.usage?.remainingTotal ?? row.usage?.remaining_total ?? "";
  return {
    ...row,
    statusLabel: row.status || "",
    parksSummary: parkNames.length ? parkNames.join(", ") : "",
    transportersSummary: transporterNames.length ? transporterNames.join(", ") : "",
    pickedUpTotal: pickedUp === "" ? "" : pickedUp,
    remainingTotal: remaining === "" ? "" : remaining,
    releaseAvailableAtDisplay: formatDateTimeDisplay(row.releaseAvailableAt),
    releaseExpiryAtDisplay: formatDateTimeDisplay(row.releaseExpiryAt),
    pickupByDisplay: formatDateTimeDisplay(row.pickupBy),
    attachmentsSummary: attachmentCount
      ? `${attachmentCount} file${attachmentCount === 1 ? "" : "s"}`
      : "",
  };
}

export default function ReleasesPage() {
  const invalidateReferenceData = useInvalidateReferenceData();

  const [rows, setRows] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [modalMode, setModalMode] = useState(null);
  const [draft, setDraft] = useState(() => blankRelease());
  const [isMobile, setIsMobile] = useState(false);
  const [showGoToTop, setShowGoToTop] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [containerParkOptions, setContainerParkOptions] = useState([]);
  const [transporterOptions, setTransporterOptions] = useState([]);
  const [containerCodeOptions, setContainerCodeOptions] = useState([]);
  const [lookupsLoading, setLookupsLoading] = useState(true);
  const [lookupsError, setLookupsError] = useState("");
  const [dateField, setDateField] = useState("releaseAvailableAt");
  const [dateRange, setDateRange] = useState([null, null]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [parks, transporters, codes] = await Promise.all([
          fetchPaginated("/reference-data/container-parks"),
          fetchPaginated("/contacts/transporters"),
          fetchPaginated("/reference-data/container-codes"),
        ]);
        if (cancelled) return;
        setContainerParkOptions(parks.map((p) => ({ id: p.id, name: p.name ?? p.containerParkName ?? "" })));
        setTransporterOptions(transporters.map((t) => ({ id: t.id, name: t.name ?? "" })));
        setContainerCodeOptions(codes);
      } catch (err) {
        if (!cancelled) setLookupsError(err instanceof Error ? err.message : "Unable to load lookups.");
      } finally {
        if (!cancelled) setLookupsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
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

  const decoratedRows = useMemo(
    () => rows.map((row) => decorate(row, containerParkOptions, transporterOptions)),
    [rows, containerParkOptions, transporterOptions],
  );

  const hasDateFilter = Boolean(dateRange[0] || dateRange[1]);
  const filteredRows = useMemo(() => {
    const [fromDate, toDate] = dateRange;
    if (!fromDate && !toDate) return decoratedRows;
    return decoratedRows.filter((row) => {
      const raw = row[dateField];
      if (!raw) return false;
      const d = dayjs(raw);
      if (!d.isValid()) return false;
      if (fromDate && d.isBefore(fromDate, "day")) return false;
      if (toDate && d.isAfter(toDate, "day")) return false;
      return true;
    });
  }, [decoratedRows, dateField, dateRange]);

  const selected = selectedId != null ? decoratedRows.find((row) => row.id === selectedId) ?? null : null;
  const modalError = modalMode ? error : "";

  const loadRows = useCallback(async () => {
    setIsLoading(true);
    try {
      setRows(await fetchReleases());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load releases.");
      setRows([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadRows();
  }, [loadRows]);

  // Live refresh: poll every 60s (paused when the tab is hidden or while the
  // add/edit modal is open so in-progress edits aren't disrupted).
  usePolling(loadRows, { intervalMs: 60000, isBusy: () => modalMode != null });

  function openAddModal() {
    setError("");
    setNotice("");
    setDraft(blankRelease());
    setModalMode("add");
  }

  useAutoOpenAddModal(openAddModal);

  function openEditModal() {
    if (!selected) return;
    setError("");
    setNotice("");
    const original = rows.find((r) => r.id === selected.id);
    setDraft(normalizeRelease(original));
    setModalMode("edit");
  }

  function closeModal() {
    setModalMode(null);
    setError("");
  }

  async function saveModal() {
    if (isSaving) return;
    if (!String(draft.releaseNumber || "").trim()) {
      setError("Release Number is required.");
      return;
    }

    const cleanedParks = (draft.parks || [])
      .map((park) => ({
        containerParkId: park.containerParkId === "" ? "" : park.containerParkId,
        transporterIds: (park.transporterIds || []).filter((id) => id !== "" && id != null),
      }))
      .filter((park) => park.containerParkId !== "" || park.transporterIds.length > 0);

    if (!cleanedParks.length) {
      setError("Add at least one Empty Container Park with a transporter.");
      return;
    }

    const payload = {
      ...draft,
      parks: cleanedParks,
      releaseExpiryAt:
        computeReleaseExpiry(draft.releaseAvailableAt, draft.freeDays) || draft.releaseExpiryAt || "",
    };

    const isAdd = modalMode === "add";
    setIsSaving(true);
    setError("");
    try {
      const saved = await saveRelease(payload);
      await loadRows();
      setSelectedId(saved?.id ?? null);
      setNotice(isAdd ? "Release created successfully." : "Release updated successfully.");
      await invalidateReferenceData("releases");
      setModalMode(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save release.");
    } finally {
      setIsSaving(false);
    }
  }

  async function removeSelected() {
    if (!selected) return;
    if (!window.confirm(`Delete release "${selected.releaseNumber}" permanently?`)) return;
    try {
      await deleteRelease(selected.id);
      await loadRows();
      setSelectedId(null);
      setNotice("Release deleted successfully.");
      await invalidateReferenceData("releases");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete release.");
    }
  }

  function setField(key, value) {
    setDraft((prev) => {
      const next = { ...prev, [key]: value };
      if (key === "releaseAvailableAt" || key === "freeDays") {
        next.releaseExpiryAt = computeReleaseExpiry(
          key === "releaseAvailableAt" ? value : prev.releaseAvailableAt,
          key === "freeDays" ? value : prev.freeDays
        );
      }
      return next;
    });
  }

  function updatePark(index, key, value) {
    setDraft((prev) => ({
      ...prev,
      parks: prev.parks.map((park, idx) => (idx === index ? { ...park, [key]: value } : park)),
    }));
  }

  function addPark() {
    setDraft((prev) => ({
      ...prev,
      parks: [...(prev.parks || []), { containerParkId: "", transporterIds: [] }],
    }));
  }

  function removePark(index) {
    setDraft((prev) => {
      const next = (prev.parks || []).filter((_, idx) => idx !== index);
      return { ...prev, parks: next.length ? next : [{ containerParkId: "", transporterIds: [] }] };
    });
  }

  function toggleParkTransporter(parkIndex, transporterId) {
    setDraft((prev) => ({
      ...prev,
      parks: prev.parks.map((park, idx) => {
        if (idx !== parkIndex) return park;
        const exists = (park.transporterIds || []).some((id) => String(id) === String(transporterId));
        const nextIds = exists
          ? park.transporterIds.filter((id) => String(id) !== String(transporterId))
          : [...(park.transporterIds || []), transporterId];
        return { ...park, transporterIds: nextIds };
      }),
    }));
  }

  async function onAttachmentInput(event) {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;

    const readers = files.map(
      (file) =>
        new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = () =>
            resolve({
              id: `attach-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
              name: file.name,
              size: file.size,
              type: file.type,
              url: typeof reader.result === "string" ? reader.result : "",
            });
          reader.onerror = () => resolve(null);
          reader.readAsDataURL(file);
        })
    );

    const results = (await Promise.all(readers)).filter(Boolean);
    setDraft((prev) => ({
      ...prev,
      attachments: [...(prev.attachments || []), ...results],
    }));
    event.target.value = "";
  }

  function removeAttachment(id) {
    setDraft((prev) => ({
      ...prev,
      attachments: (prev.attachments || []).filter((file) => file.id !== id),
    }));
  }

  const toolbarActions = (
    <div className="flex flex-wrap gap-2">
      <Button type="button" size="sm" onClick={openAddModal}>
        + Add
      </Button>
      <Button type="button" variant="outline" size="sm" disabled={!selected} onClick={openEditModal}>
        Edit
      </Button>
      <Button type="button" variant="destructive" size="sm" disabled={!selected} onClick={removeSelected}>
        Delete
      </Button>
    </div>
  );

  return (
    <div className="space-y-5">
      {!modalMode && error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>
      ) : null}

      {lookupsError ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
          Could not load lookups: {lookupsError}
        </div>
      ) : null}

      {notice ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{notice}</div>
      ) : null}

      <div className="rounded-xl border border-slate-200/90 bg-white p-3 shadow-sm">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-0">
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Date Field</label>
            <select
              suppressHydrationWarning
              className={cn(inputClass, "w-44")}
              value={dateField}
              onChange={(e) => setDateField(e.target.value)}
              aria-label="Date field to filter by"
            >
              {DATE_FILTER_FIELDS.map((opt) => (
                <option key={opt.key} value={opt.key}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div className="min-w-0">
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Date Range</label>
            <div className="w-72">
              <CustomDateRangePicker value={dateRange} onChange={setDateRange} />
            </div>
          </div>
          <span className="ml-auto text-xs text-slate-500">
            {hasDateFilter ? `${filteredRows.length} of ${decoratedRows.length} release(s)` : `${decoratedRows.length} release(s)`}
          </span>
        </div>
      </div>

      <div
        className={cn(
          "grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(280px,360px)] xl:items-start",
          isMobile && "grid-cols-1"
        )}
      >
        <div className="overflow-hidden rounded-xl bg-white shadow-sm">
          {isMobile ? (
            <>
              <div className="flex flex-wrap gap-2 border-b border-slate-100 p-3">{toolbarActions}</div>
              <MobileList
                rows={filteredRows}
                selectedId={selectedId}
                onSelect={setSelectedId}
              />
            </>
          ) : (
            <Grid
              columns={gridColumns}
              rows={filteredRows}
              getRowId={(row) => row.id}
              theme="light"
              density="standard"
              fileName="Releases"
              visibleRows={12}
              emptyMessage={isLoading ? "Loading releases…" : hasDateFilter ? "No releases match the selected date range." : "No releases found."}
              onRowClick={(row) => setSelectedId((prev) => (prev === row.id ? null : row.id))}
              onPersistedRowActivate={(row) => setSelectedId(row.id)}
              toolbarActions={toolbarActions}
            />
          )}
        </div>

        {!isMobile ? (
          <aside className="rounded-xl border border-slate-200/90 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900">Release Details</h2>
            {!selected ? (
              <p className="mt-4 text-sm leading-relaxed text-slate-500">Select a row to view details.</p>
            ) : (
              <ReleaseDetails
                release={selected}
                containerParks={containerParkOptions}
                transporters={transporterOptions}
              />
            )}
          </aside>
        ) : null}
      </div>

      <Modal
        open={modalMode != null}
        title={modalMode === "edit" ? "Edit Release" : "Add Release"}
        onClose={closeModal}
      >
        {modalError ? (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-600">{modalError}</div>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Release Number" required>
            <input
              className={inputClass}
              value={draft.releaseNumber}
              onChange={(e) => setField("releaseNumber", e.target.value)}
              placeholder="e.g. REL-2026-001"
            />
          </Field>

          <Field label="Release Status">
            <select
              className={inputClass}
              value={draft.status}
              onChange={(e) => setField("status", e.target.value)}
            >
              {RELEASE_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Release Available (Date & Time)">
            <input
              type="datetime-local"
              className={inputClass}
              value={draft.releaseAvailableAt}
              onChange={(e) => setField("releaseAvailableAt", e.target.value)}
            />
          </Field>

          <Field label="Number of Free Days">
            <input
              type="number"
              min="0"
              className={inputClass}
              value={draft.freeDays}
              onChange={(e) => setField("freeDays", e.target.value)}
              placeholder="e.g. 7"
            />
          </Field>

          <Field label="Release Expiry (computed)">
            <input
              type="datetime-local"
              className={`${inputClass} bg-slate-50`}
              value={draft.releaseExpiryAt}
              readOnly
              placeholder="—"
            />
          </Field>

          <Field label="Pickup By (Date & Time)">
            <input
              type="datetime-local"
              className={inputClass}
              value={draft.pickupBy}
              onChange={(e) => setField("pickupBy", e.target.value)}
            />
          </Field>

          <Field label="Number of Containers">
            <input
              type="number"
              min="0"
              className={inputClass}
              value={draft.containerCount}
              onChange={(e) => setField("containerCount", e.target.value)}
              placeholder="e.g. 4"
            />
          </Field>

          <Field label="Container Type">
            <select
              className={inputClass}
              value={draft.containerCodeIsoCode}
              onChange={(e) => setField("containerCodeIsoCode", e.target.value)}
            >
              <option value="">
                {lookupsLoading ? "Loading…" : "Select container type..."}
              </option>
              {containerCodeOptions.map((row) => (
                <option key={row.id} value={containerCodeIsoValue(row)}>
                  {containerCodeOptionLabel(row)}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50/40 p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">
              Empty Container Park(s) and Transporter(s)
            </p>
            <Button type="button" size="sm" variant="outline" onClick={addPark}>
              + Add park
            </Button>
          </div>
          <div className="space-y-2">
            {(draft.parks || []).map((park, index) => (
              <div key={`park-${index}`} className="rounded-md border border-slate-200 bg-white p-2.5">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-slate-600">Park {index + 1}</p>
                  {(draft.parks?.length ?? 0) > 1 ? (
                    <button
                      type="button"
                      className="rounded bg-rose-50 px-1.5 py-0.5 text-xs text-rose-600 hover:bg-rose-100"
                      onClick={() => removePark(index)}
                    >
                      Remove
                    </button>
                  ) : null}
                </div>
                <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
                  <select
                    className={inputClass}
                    value={park.containerParkId === "" ? "" : String(park.containerParkId)}
                    onChange={(e) => updatePark(index, "containerParkId", e.target.value || "")}
                  >
                    <option value="">
                      {lookupsLoading ? "Loading…" : "Select empty container park..."}
                    </option>
                    {containerParkOptions.map((parkOpt) => (
                      <option key={parkOpt.id} value={parkOpt.id}>
                        {parkOpt.name}
                      </option>
                    ))}
                  </select>
                  <div className="rounded-md border border-slate-200 bg-white p-2">
                    <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                      Transporters
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {transporterOptions.length === 0 ? (
                        <p className="text-[11px] text-slate-400">
                          {lookupsLoading ? "Loading transporters…" : "No transporters available."}
                        </p>
                      ) : null}
                      {transporterOptions.map((t) => {
                        const checked = (park.transporterIds || []).some(
                          (id) => String(id) === String(t.id)
                        );
                        return (
                          <label
                            key={t.id}
                            className={cn(
                              "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium",
                              checked
                                ? "border-brand bg-brand/10 text-brand-ink"
                                : "border-slate-200 bg-slate-50 text-slate-600"
                            )}
                          >
                            <input
                              type="checkbox"
                              className="h-3 w-3"
                              checked={checked}
                              onChange={() => toggleParkTransporter(index, t.id)}
                            />
                            {t.name}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50/40 p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">
              Release Attachments
            </p>
            <label className="cursor-pointer rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50">
              + Add files
              <input type="file" multiple className="hidden" onChange={onAttachmentInput} />
            </label>
          </div>
          {(draft.attachments || []).length === 0 ? (
            <p className="text-xs text-slate-400">No attachments yet.</p>
          ) : (
            <ul className="space-y-1">
              {draft.attachments.map((file) => (
                <li
                  key={file.id}
                  className="flex items-center justify-between gap-2 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-slate-800">{file.name || "Attachment"}</p>
                    <p className="text-[10px] text-slate-400">
                      {file.type || "file"}
                      {file.size ? ` · ${Math.round(file.size / 1024)} KB` : ""}
                    </p>
                  </div>
                  {file.url ? (
                    <a
                      href={file.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] font-semibold text-brand-ink underline-offset-2 hover:underline"
                    >
                      View
                    </a>
                  ) : null}
                  <button
                    type="button"
                    className="rounded bg-rose-50 px-1.5 py-0.5 text-[11px] text-rose-600 hover:bg-rose-100"
                    onClick={() => removeAttachment(file.id)}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
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

function Field({ label, required, children }) {
  return (
    <div className="space-y-1">
      <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">
        {label}
        {required ? <span className="text-red-500"> *</span> : null}
      </label>
      {children}
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
        aria-labelledby="releases-modal-title"
        className="relative max-h-[min(92vh,820px)] w-full max-w-3xl overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-4 py-3">
          <h2 id="releases-modal-title" className="text-sm font-semibold text-slate-900">
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

function ReleaseDetails({ release, containerParks, transporters }) {
  const parks = Array.isArray(release.parks) ? release.parks : [];

  return (
    <div className="mt-4 space-y-3 text-sm">
      <Detail label="Release Number" value={release.releaseNumber} highlight />
      <Detail
        label="Status"
        value={
          release.status ? (
            <span
              className={cn(
                "inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold",
                STATUS_CLASSES[release.status] || "border-slate-200 bg-slate-50 text-slate-600"
              )}
            >
              {release.status}
            </span>
          ) : (
            ""
          )
        }
      />
      <Detail label="Available" value={release.releaseAvailableAtDisplay} />
      <Detail label="Free Days" value={release.freeDays} />
      <Detail label="Expiry" value={release.releaseExpiryAtDisplay} />
      <Detail label="Pickup By" value={release.pickupByDisplay} />
      <Detail label="Cap (containers)" value={release.containerCount} />
      <Detail label="Picked up (global)" value={release.pickedUpTotal ?? release.usage?.pickedUpTotal ?? "—"} />
      <Detail label="Remaining (global)" value={release.remainingTotal ?? release.usage?.remainingTotal ?? "—"} />
      <Detail label="Container Type" value={release.containerCodeIsoCode} />
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          Parks & Transporters
        </p>
        {parks.length === 0 ? (
          <p className="mt-0.5 text-slate-500"></p>
        ) : (
          <ul className="mt-1 space-y-1">
            {parks.map((park, idx) => {
              const parkName = lookupName(containerParks, park.containerParkId) || "—";
              const parkId = park.containerParkId;
              const tNames = (park.transporterIds || [])
                .map((id) => lookupName(transporters, id))
                .filter(Boolean);
              const comboUsage = (release.usage?.byCombo || []).filter(
                (c) => String(c.containerParkId) === String(parkId)
              );
              return (
                <li key={`detail-park-${idx}`} className="rounded border border-slate-200 bg-slate-50/60 px-2 py-1">
                  <p className="text-xs font-semibold text-slate-700">{parkName}</p>
                  <p className="text-[11px] text-slate-500">
                    {tNames.length ? tNames.join(", ") : "No transporters assigned"}
                  </p>
                  {comboUsage.length ? (
                    <ul className="mt-1 space-y-0.5 text-[10px] text-slate-500">
                      {comboUsage.map((combo, comboIdx) => (
                        <li key={`combo-${idx}-${comboIdx}`}>
                          {lookupName(transporters, combo.transporterId) || "—"}: {combo.pickedUp ?? combo.picked_up ?? 0} picked up
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Attachments</p>
        {(release.attachments || []).length === 0 ? (
          <p className="mt-0.5 text-slate-500"></p>
        ) : (
          <ul className="mt-1 space-y-1">
            {release.attachments.map((file) => (
              <li key={file.id} className="flex items-center justify-between gap-2 text-xs">
                <span className="truncate text-slate-700">{file.name}</span>
                {file.url ? (
                  <a
                    href={file.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] font-semibold text-brand-ink underline-offset-2 hover:underline"
                  >
                    View
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Detail({ label, value, highlight }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className={cn("mt-0.5 text-slate-800", highlight && "font-semibold text-brand")}>
        {value === "" || value == null ? "" : value}
      </dd>
    </div>
  );
}

function MobileList({ rows, selectedId, onSelect }) {
  return (
    <div className="space-y-2 p-3">
      <div className="px-0.5 text-xs font-semibold text-slate-600">Releases ({rows.length})</div>
      {rows.length === 0 ? (
        <div className="py-8 text-center text-sm text-slate-400">No releases found. Add your first one!</div>
      ) : (
        rows.map((row) => {
          const isSelected = row.id === selectedId;
          const summary = [row.parksSummary, row.containerCount ? `${row.containerCount} ctrs` : ""]
            .filter(Boolean)
            .join(" · ");
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
              <p className="text-xs font-bold text-blue-600">{row.releaseNumber || ""}</p>
              <p className="mt-1 text-sm font-semibold text-slate-800">{row.statusLabel || ""}</p>
              <p className="mt-1 text-[11px] text-slate-500">{summary}</p>
            </button>
          );
        })
      )}
    </div>
  );
}
