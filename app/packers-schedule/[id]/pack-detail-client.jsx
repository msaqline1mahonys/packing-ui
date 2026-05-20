"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { PACK_FORM_LOOKUPS } from "@/lib/Data";
import { loadContactUsers } from "@/lib/contact-users-store";
import {
  containerStage,
  loadWorkDrafts,
  saveWorkDrafts,
  syncWorkDrafts,
  toInputNumber,
  toRoundedNumber,
} from "@/lib/packers-work-store";
import { loadPackScheduleRows, savePackScheduleRows } from "@/lib/pack-schedule-store";
import { readSiteRows } from "@/lib/site-data";
import { cn } from "@/lib/utils";
import { createPraActionHandlers } from "@/components/pems/container-form-actions";
import ContainerFormSections from "@/components/pems/container-form-sections";

const YES_NO_OPTIONS = ["No", "Yes"];
const INSPECTION_OPTIONS = ["Pending", "Passed", "Failed"];
const PRA_STATUS_OPTIONS = ["Pending", "Accepted", "Rejected", "Error"];
const PRA_TEMPLATE_OPTIONS = ["Original", "Resubmit", "Correction"];
const PACK_DETAIL_TABS = ["Packing", "PEMs"];
const PEMS_RECORD_OPTIONS = ["Empty Container Inspection Record", "Grain and Plant Product Inspection Record"];
const ECR_RECORD_TYPE = "Empty Container Inspection Record";
const GPPIR_RECORD_TYPE = "Grain and Plant Product Inspection Record";
const PACK_CHECK_FIELDS = [
  { key: "importDetailsChecked", label: "Import details checked" },
  { key: "sampleRequirementsChecked", label: "Sample requirements checked" },
  { key: "rfpDetailsChecked", label: "RFP details checked" },
  { key: "micorRequirementsChecked", label: "MICOR requirements checked" },
];

const inputClass =
  "h-11 rounded-lg border border-slate-200 bg-white px-2 text-[15px] text-slate-800 outline-none ring-brand/15 placeholder:text-slate-400 focus:border-brand/40 focus:ring-2";
const sectionCardClass = "overflow-hidden rounded-xl border border-slate-200/90 bg-white";
const sectionHeaderClass = "border-b border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-800";

function safeValue(value) {
  if (value == null || String(value).trim() === "") return "—";
  return String(value);
}

function formatDateTimeValue(value) {
  if (value == null || String(value).trim() === "") return "—";
  const str = String(value).trim();
  if (!str.includes("T")) return str;
  const [datePart, timePart] = str.split("T");
  const hhmm = (timePart || "").slice(0, 5);
  return hhmm ? `${datePart} ${hhmm}` : datePart;
}

function formatDateTimeInput(value) {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  const hours = String(parsed.getHours()).padStart(2, "0");
  const minutes = String(parsed.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function formatDateDisplay(value) {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  const day = String(parsed.getDate()).padStart(2, "0");
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const year = parsed.getFullYear();
  return `${day}/${month}/${year}`;
}

function addDaysToDate(value, days) {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  parsed.setDate(parsed.getDate() + days);
  return parsed.toISOString();
}

function defaultPemsDraft() {
  return {
    recordType: ECR_RECORD_TYPE,
    inspectionStart: "",
    inspectionEnd: "",
    aoSignoff: "",
    aoNumber: "",
    stagedContainerIds: [],
  };
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function buildSubmissionSnapshotHtml(submission) {
  const rows = Array.isArray(submission?.containers) ? submission.containers : [];
  const isGppir = submission?.recordType === GPPIR_RECORD_TYPE;
  const inspectionStart = formatDateTimeValue(submission?.inspectionStart);
  const inspectionEnd = formatDateTimeValue(submission?.inspectionEnd);
  const submittedAt = formatDateTimeValue(submission?.submittedAt);
  const expiryDate = formatDateDisplay(addDaysToDate(submission?.inspectionEnd || submission?.inspectionStart, isGppir ? 28 : 90));
  const totalWeight = toRoundedNumber(rows.reduce((sum, row) => sum + (Number(row?.nettWeight) || 0), 0));
  const passedWeight = toRoundedNumber(
    rows.reduce((sum, row) => {
      const isPassed = isGppir ? row?.grainInspection === "Passed" : row?.emptyInspection === "Passed";
      return isPassed ? sum + (Number(row?.nettWeight) || 0) : sum;
    }, 0)
  );
  const failedWeight = toRoundedNumber(
    rows.reduce((sum, row) => {
      const isFailed = isGppir ? row?.grainInspection === "Failed" : row?.emptyInspection === "Failed";
      return isFailed ? sum + (Number(row?.nettWeight) || 0) : sum;
    }, 0)
  );

  const tableBody = rows
    .map((row) => {
      if (isGppir) {
        return `<tr>
          <td>1</td>
          <td>${escapeHtml(row?.containerNo || "")}</td>
          <td>${escapeHtml(row?.grainLocation || row?.stockBayId || "")}</td>
          <td>${escapeHtml(submission?.commodity || "")}</td>
          <td>1</td>
          <td>CONTAINER</td>
          <td>${escapeHtml(toRoundedNumber(row?.nettWeight).toFixed(4))}</td>
          <td>M/TONS</td>
          <td>N/A</td>
          <td>${escapeHtml(row?.grainInspection === "Passed" ? "Passed" : row?.grainInspection === "Failed" ? "Failed" : "Pending")}</td>
          <td>${escapeHtml(submission?.aoSignoff || "")}</td>
          <td>${escapeHtml(row?.aoInspectionRemark || "N/A")}</td>
        </tr>`;
      }
      return `<tr>
        <td>${escapeHtml(row?.containerNo || "")}</td>
        <td>Consumable</td>
        <td>${escapeHtml(row?.releaseNumber || "")}</td>
        <td>${escapeHtml(row?.emptyInspection === "Passed" ? "Pass" : row?.emptyInspection === "Failed" ? "Fail" : "Pending")}</td>
        <td>${escapeHtml(row?.sealNo || "")}</td>
        <td>${escapeHtml(expiryDate)}</td>
        <td>${escapeHtml(submission?.aoSignoff || "")}</td>
        <td>${escapeHtml(row?.aoInspectionRemark || "N/A")}</td>
      </tr>`;
    })
    .join("");

  const columns = isGppir
    ? "<th>RFP Line</th><th>Container Number</th><th>Source</th><th>Commodity</th><th>Package Number</th><th>Type</th><th>Weight</th><th>Unit</th><th>Sampled</th><th>Result</th><th>Inspection AO Name</th><th>Remarks</th>"
    : "<th>Container Number</th><th>Inspection Level</th><th>RFP Number</th><th>Result</th><th>Seal Number</th><th>Expiry Date</th><th>Inspection AO Name</th><th>Remarks</th>";

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(submission?.recordType || "PEMs Record")} - ${escapeHtml(submission?.batchId || "")}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; color: #0f172a; }
    h1 { font-size: 20px; margin-bottom: 4px; }
    .meta { font-size: 12px; margin-bottom: 12px; color: #334155; }
    .grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; margin-bottom: 12px; }
    .box { border: 1px solid #cbd5e1; padding: 6px 8px; border-radius: 4px; font-size: 12px; }
    .label { font-size: 10px; text-transform: uppercase; color: #475569; margin-bottom: 4px; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    th, td { border: 1px solid #cbd5e1; padding: 6px; text-align: left; vertical-align: top; }
    thead { background: #f1f5f9; }
    .footer { margin-top: 12px; font-size: 12px; }
  </style>
</head>
<body>
  <h1>${escapeHtml(submission?.recordType || "PEMs Record")}</h1>
  <div class="meta">Batch ${escapeHtml(submission?.batchId || "")} · Submitted ${escapeHtml(submittedAt)} · Status ${escapeHtml(submission?.status || "")}</div>
  <div class="grid">
    <div class="box"><div class="label">Pack Id</div>${escapeHtml(submission?.packId || "")}</div>
    <div class="box"><div class="label">Yard Id</div>${escapeHtml(submission?.yardId || "")}</div>
    <div class="box"><div class="label">Place of Inspection</div>${escapeHtml(submission?.placeOfInspection || "")}</div>
    <div class="box"><div class="label">Inspection Window</div>${escapeHtml(inspectionStart)} to ${escapeHtml(inspectionEnd)}</div>
    <div class="box"><div class="label">AO Name</div>${escapeHtml(submission?.aoSignoff || "")}</div>
    <div class="box"><div class="label">AO Number</div>${escapeHtml(submission?.aoNumber || "")}</div>
    <div class="box"><div class="label">Containers</div>${escapeHtml(rows.length)}</div>
    <div class="box"><div class="label">Expiry Date</div>${escapeHtml(expiryDate)}</div>
  </div>
  <table>
    <thead><tr>${columns}</tr></thead>
    <tbody>${tableBody || "<tr><td colspan='12'>No container rows</td></tr>"}</tbody>
  </table>
  <div class="footer">
    <strong>Total:</strong> ${escapeHtml(totalWeight.toFixed(4))} M/TONS &nbsp; 
    <strong>Passed:</strong> ${escapeHtml(passedWeight.toFixed(4))} M/TONS &nbsp; 
    <strong>Failed:</strong> ${escapeHtml(failedWeight.toFixed(4))} M/TONS
  </div>
</body>
</html>`;
}

function openSubmissionSnapshot(submission, autoPrint = false) {
  if (typeof window === "undefined") return;
  const snapshotHtml = submission?.snapshotHtml || buildSubmissionSnapshotHtml(submission);
  const previewWindow = window.open("", "_blank", "noopener,noreferrer");
  if (!previewWindow) return;
  previewWindow.document.open();
  previewWindow.document.write(snapshotHtml);
  previewWindow.document.close();
  if (autoPrint) {
    previewWindow.focus();
    window.setTimeout(() => previewWindow.print(), 300);
  }
}

function asDocumentItems(files, group) {
  if (!Array.isArray(files)) return [];
  return files
    .map((item, index) => {
      if (typeof item === "string") {
        return { id: `${group}-${index}-${item}`, name: item, group };
      }
      const name = item?.name;
      if (!name) return null;
      return { id: item?.id ?? `${group}-${index}-${name}`, name, group };
    })
    .filter(Boolean);
}

function stageBadgeClass(stage) {
  switch (stage) {
    case "Complete":
      return "bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200";
    case "PRA Passed":
      return "bg-lime-100 text-lime-800 ring-1 ring-lime-200";
    case "PRA Failed":
      return "bg-rose-100 text-rose-800 ring-1 ring-rose-200";
    case "PRA Submitted":
      return "bg-amber-100 text-amber-900 ring-1 ring-amber-200";
    case "Packing":
      return "bg-blue-100 text-blue-800 ring-1 ring-blue-200";
    default:
      return "bg-slate-100 text-slate-700 ring-1 ring-slate-200";
  }
}

function packContainerFromWorkContainer(container, packRow) {
  return {
    id: container.id,
    packId: packRow.id,
    order: container.order,
    containerNumber: container.containerNo || "",
    containerCode: packRow.containerCode || "",
    containerIsoCode: container.isoCode || "",
    sealNumber: container.sealNo || "",
    releaseNumber: container.releaseNumber || "",
    releasePark: container.releasePark || "",
    transporter: container.transporter || "",
    grainLocation: container.grainLocation || "",
    stockBayId: container.stockBayId || "",
    startDate: container.startDate || "",
    startHour: container.startHour || "",
    startMinute: container.startMinute || "",
    tare: container.tare ?? null,
    grossWeight: container.grossWeight ?? null,
    nettWeight: container.nettWeight ?? null,
    containerTareWeight: container.containerTareWeight ?? null,
    packerSignoff: container.packerSignoff || "",
    outLoaded: container.outLoaded || "No",
    praSubmitted: Boolean(container.praSubmitted),
    praLastStatus: container.praLastStatus || "Pending",
    emptyInspection: container.emptyInspection || "Pending",
    grainInspection: container.grainInspection || "Pending",
    aoSignoff: container.aoSignoff || "",
    ecrSubmitted: Boolean(container.ecrSubmitted ?? container.pemsSubmitted),
    ecrLastSubmittedAt: container.ecrLastSubmittedAt || container.pemsLastSubmittedAt || "",
    ecrLastBatchId: container.ecrLastBatchId || container.pemsLastBatchId || "",
    gppirSubmitted: Boolean(container.gppirSubmitted),
    gppirLastSubmittedAt: container.gppirLastSubmittedAt || "",
    gppirLastBatchId: container.gppirLastBatchId || "",
    status: containerStage(container),
  };
}

export default function PackDetailClient({ packId }) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("Packing");
  const [packRow, setPackRow] = useState(() => loadPackScheduleRows().find((row) => Number(row.id) === Number(packId)) || null);
  const [workByPack, setWorkByPack] = useState(() => {
    const row = loadPackScheduleRows().find((item) => Number(item.id) === Number(packId));
    if (!row) return {};
    return syncWorkDrafts([row], loadWorkDrafts());
  });
  const [selectedContainerId, setSelectedContainerId] = useState(null);
  const [containerSearch, setContainerSearch] = useState("");
  const [isSubmittingPems, setIsSubmittingPems] = useState(false);
  const [pemsSubmitError, setPemsSubmitError] = useState("");

  const packerNames = useMemo(
    () => (PACK_FORM_LOOKUPS.packers || []).filter((p) => String(p.status).toLowerCase() === "active").map((p) => p.name),
    []
  );
  const aoNumberByName = useMemo(() => {
    const map = new Map();
    loadContactUsers().forEach((row) => {
      if (!row?.aoActive) return;
      const name = String(row.name || "").trim();
      if (!name) return;
      map.set(name, String(row.aoNumber || ""));
    });
    return map;
  }, []);

  useEffect(() => {
    const row = loadPackScheduleRows().find((item) => Number(item.id) === Number(packId)) || null;
    setPackRow(row);
    if (row) setWorkByPack((prev) => syncWorkDrafts([row], { ...loadWorkDrafts(), ...prev }));
  }, [packId]);

  useEffect(() => {
    saveWorkDrafts(workByPack);
    if (!packRow || !workByPack[packRow.id]) return;
    const containers = (workByPack[packRow.id].containers || []).map((container) =>
      packContainerFromWorkContainer(container, packRow)
    );
    const rows = loadPackScheduleRows();
    savePackScheduleRows(
      rows.map((row) => (Number(row.id) === Number(packRow.id) ? { ...row, containers } : row))
    );
  }, [workByPack]);

  const selectedPackDraft = packRow ? workByPack[packRow.id] : null;
  const containerRows = selectedPackDraft?.containers || [];
  const pemsDraft = useMemo(
    () => ({ ...defaultPemsDraft(), ...(selectedPackDraft?.pemsDraft || {}) }),
    [selectedPackDraft?.pemsDraft]
  );
  const pemsSubmissions = selectedPackDraft?.pemsSubmissions || [];
  const siteRow = useMemo(() => {
    if (!packRow) return null;
    const sites = readSiteRows();
    const byId = sites.find((site) => Number(site.id) === Number(packRow.siteId));
    return byId || sites[0] || null;
  }, [packRow]);
  const filteredContainerRows = useMemo(() => {
    const q = containerSearch.trim().toLowerCase();
    if (!q) return containerRows;
    return containerRows.filter((container) => String(container.containerNo || "").toLowerCase().includes(q));
  }, [containerRows, containerSearch]);

  useEffect(() => {
    if (!filteredContainerRows.length) {
      setSelectedContainerId(null);
      return;
    }
    if (!selectedContainerId || !filteredContainerRows.some((container) => container.id === selectedContainerId)) {
      setSelectedContainerId(filteredContainerRows[0].id);
    }
  }, [filteredContainerRows, selectedContainerId]);

  const selectedContainer = useMemo(
    () => filteredContainerRows.find((container) => container.id === selectedContainerId) || null,
    [filteredContainerRows, selectedContainerId]
  );
  const selectedContainerActions = useMemo(() => {
    if (!selectedContainer) return null;
    return createPraActionHandlers({
      container: selectedContainer,
      applyPatch: updateSelectedContainer,
      fallbackPacker: packerNames[0] || "",
    });
  }, [selectedContainer, packerNames]);
  const stagedContainers = useMemo(
    () => containerRows.filter((container) => pemsDraft.stagedContainerIds.includes(container.id)),
    [containerRows, pemsDraft.stagedContainerIds]
  );
  const selectedAoNumber = useMemo(() => aoNumberByName.get(String(pemsDraft.aoSignoff || "").trim()) || "", [aoNumberByName, pemsDraft.aoSignoff]);

  const packSummary = useMemo(() => {
    if (!packRow || !selectedPackDraft) return { total: 0, submitted: 0, complete: 0 };
    const total = selectedPackDraft.containers.length;
    const submitted = selectedPackDraft.containers.filter((container) => container.praSubmitted).length;
    const complete = selectedPackDraft.containers.filter((container) => containerStage(container) === "Complete").length;
    return { total, submitted, complete };
  }, [packRow, selectedPackDraft]);

  function updateSelectedPack(updater) {
    if (!packRow) return;
    setWorkByPack((prev) => {
      const current = prev[packRow.id];
      if (!current) return prev;
      const nextPack = typeof updater === "function" ? updater(current) : updater;
      return { ...prev, [packRow.id]: nextPack };
    });
  }

  function updateSelectedContainer(patch) {
    if (!packRow || !selectedContainer) return;
    updateSelectedPack((current) => {
      const nextContainers = current.containers.map((container) => {
        if (container.id !== selectedContainer.id) return container;
        const next = typeof patch === "function" ? patch(container) : { ...container, ...patch };
        const tare = toRoundedNumber(next.tare);
        const grossWeight = toRoundedNumber(next.grossWeight);
        const normalized = { ...next, tare, grossWeight, nettWeight: toRoundedNumber(Math.max(grossWeight - tare, 0)) };
        return { ...normalized, status: containerStage(normalized) };
      });
      return { ...current, containers: nextContainers };
    });
  }

  function runBulkAction(action) {
    updateSelectedPack((current) => {
      if (action === "pra-all") {
        return {
          ...current,
          containers: current.containers.map((container) => ({
            ...container,
            praSubmitted: true,
            praLastStatus: "Accepted",
            praLastSubmittedTime: new Date().toLocaleString(),
            praLastError: "ERA0100-Message received without error",
          })),
        };
      }
      if (action === "cancel-pra") {
        return {
          ...current,
          containers: current.containers.map((container) => ({
            ...container,
            praSubmitted: false,
            praLastStatus: "Pending",
            praLastSubmittedTime: "",
            praLastError: "",
          })),
        };
      }
      return current;
    });
  }

  function setBulkField(field, value) {
    updateSelectedPack((current) => ({ ...current, [field]: value }));
  }

  function setPackCheck(checkKey, value) {
    updateSelectedPack((current) => ({
      ...current,
      packChecks: {
        ...(current.packChecks || {}),
        [checkKey]: value,
      },
    }));
  }

  function updatePemsDraft(patch) {
    updateSelectedPack((current) => {
      const base = { ...defaultPemsDraft(), ...(current.pemsDraft || {}) };
      const nextPatch = typeof patch === "function" ? patch(base) : patch;
      return {
        ...current,
        pemsDraft: { ...base, ...nextPatch },
      };
    });
  }

  function togglePemsContainer(containerId) {
    updatePemsDraft((current) => {
      const exists = current.stagedContainerIds.includes(containerId);
      return {
        ...current,
        stagedContainerIds: exists
          ? current.stagedContainerIds.filter((id) => id !== containerId)
          : [...current.stagedContainerIds, containerId],
      };
    });
  }

  async function submitPemsBatch() {
    if (!packRow) return;
    const ids = pemsDraft.stagedContainerIds || [];
    const containersForBatch = containerRows.filter((container) => ids.includes(container.id));
    const isGppir = pemsDraft.recordType === GPPIR_RECORD_TYPE;
    if (!containersForBatch.length || !pemsDraft.inspectionStart || !pemsDraft.inspectionEnd || !pemsDraft.aoSignoff) {
      setPemsSubmitError("Select containers and complete inspection start/end plus AO before submitting.");
      return;
    }
    if (isGppir) {
      const missingEcr = containersForBatch.filter((container) => !container.ecrSubmitted);
      if (missingEcr.length) {
        setPemsSubmitError(
          `Submit ECR first for: ${missingEcr.map((container) => container.containerNo || `#${container.order}`).join(", ")}.`
        );
        return;
      }
    }

    setIsSubmittingPems(true);
    setPemsSubmitError("");
    try {
      const payload = {
        packId: packRow.id,
        jobReference: packRow.jobReference || "",
        recordType: pemsDraft.recordType,
        aoSignoff: pemsDraft.aoSignoff,
        aoNumber: selectedAoNumber,
        inspectionStart: pemsDraft.inspectionStart,
        inspectionEnd: pemsDraft.inspectionEnd,
        yardId: siteRow?.yardNo || "",
        placeOfInspection: siteRow?.name || "",
        containers: containersForBatch.map((container) => ({
          id: container.id,
          order: container.order,
          containerNo: container.containerNo || "",
          sealNo: container.sealNo || "",
          isoCode: container.isoCode || "",
          releaseNumber: container.releaseNumber || "",
          releasePark: container.releasePark || "",
          transporter: container.transporter || "",
          grainLocation: container.grainLocation || "",
          stockBayId: container.stockBayId || "",
          tare: toRoundedNumber(container.tare),
          grossWeight: toRoundedNumber(container.grossWeight),
          nettWeight: toRoundedNumber(container.nettWeight),
          emptyInspection: container.emptyInspection || "Pending",
          grainInspection: container.grainInspection || "Pending",
          aoInspectionRemark: container.aoInspectionRemark || "",
        })),
      };

      const response = await fetch("/api/pems/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "PEMs submission failed.");
      }

      const batchId = data?.submissionId || `PEMS-${Date.now()}`;
      const submittedAt = data?.submittedAt || new Date().toISOString();
      const stagedIds = new Set(containersForBatch.map((container) => container.id));
      updateSelectedPack((current) => {
        const draft = { ...defaultPemsDraft(), ...(current.pemsDraft || {}) };
        const nextSubmission = {
          batchId,
          submittedAt,
          status: data?.status || "Accepted",
          recordType: draft.recordType,
          commodity: packRow.commodity || "",
          aoSignoff: draft.aoSignoff,
          aoNumber: selectedAoNumber,
          inspectionStart: draft.inspectionStart,
          inspectionEnd: draft.inspectionEnd,
          yardId: siteRow?.yardNo || "",
          placeOfInspection: siteRow?.name || "",
          packId: packRow.id,
          containerIds: containersForBatch.map((container) => container.id),
          containers: containersForBatch.map((container) => ({
            id: container.id,
            order: container.order,
            containerNo: container.containerNo || "",
            sealNo: container.sealNo || "",
            isoCode: container.isoCode || "",
            releaseNumber: container.releaseNumber || "",
            releasePark: container.releasePark || "",
            transporter: container.transporter || "",
            grainLocation: container.grainLocation || "",
            stockBayId: container.stockBayId || "",
            tare: toRoundedNumber(container.tare),
            grossWeight: toRoundedNumber(container.grossWeight),
            nettWeight: toRoundedNumber(container.nettWeight),
            emptyInspection: container.emptyInspection || "Pending",
            grainInspection: container.grainInspection || "Pending",
          })),
        };
        nextSubmission.snapshotHtml = buildSubmissionSnapshotHtml(nextSubmission);
        return {
          ...current,
          pemsDraft: { ...draft, stagedContainerIds: [] },
          pemsSubmissions: [nextSubmission, ...(Array.isArray(current.pemsSubmissions) ? current.pemsSubmissions : [])],
          containers: current.containers.map((container) =>
            stagedIds.has(container.id)
              ? {
                  ...container,
                  ...(isGppir
                    ? {
                        gppirSubmitted: true,
                        gppirLastSubmittedAt: submittedAt,
                        gppirLastBatchId: batchId,
                      }
                    : {
                        ecrSubmitted: true,
                        ecrLastSubmittedAt: submittedAt,
                        ecrLastBatchId: batchId,
                      }),
                }
              : container
          ),
        };
      });
    } catch (error) {
      setPemsSubmitError(error?.message || "PEMs submission failed.");
    } finally {
      setIsSubmittingPems(false);
    }
  }

  function refreshPack() {
    const row = loadPackScheduleRows().find((item) => Number(item.id) === Number(packId)) || null;
    setPackRow(row);
    if (row) setWorkByPack((prev) => syncWorkDrafts([row], prev));
  }

  if (!packRow) {
    return (
      <div className="space-y-4">
        <Button variant="secondary" size="sm" type="button" onClick={() => router.push("/packers-schedule")}>
          Back to Packers Schedule
        </Button>
        <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-sm text-slate-500">
          Pack was not found. It may have been removed from the queue.
        </div>
      </div>
    );
  }

  const packDocuments = [...asDocumentItems(packRow.rfpFiles, "RFP"), ...asDocumentItems(packRow.packingInstructionFiles, "Instruction")];
  const releaseRefsSummary = useMemo(() => {
    const refs = Array.from(
      new Set(
        (Array.isArray(packRow?.releaseDetails) ? packRow.releaseDetails : [])
          .map((release) => String(release?.releaseRef || "").trim())
          .filter(Boolean)
      )
    );
    if (!refs.length) return "—";
    return refs.join(", ");
  }, [packRow?.releaseDetails]);
  const aggregateNettWeight = useMemo(() => {
    const total = (selectedPackDraft?.containers || []).reduce((sum, container) => {
      const nett = Number(container?.nettWeight);
      return Number.isFinite(nett) ? sum + nett : sum;
    }, 0);
    return toRoundedNumber(total);
  }, [selectedPackDraft?.containers]);
  const weightPerContainer = useMemo(() => {
    const total = Number(packRow?.mtTotal);
    const count = Number(packRow?.containersRequired);
    if (!Number.isFinite(total) || !Number.isFinite(count) || count <= 0) return null;
    return toRoundedNumber(total / count);
  }, [packRow?.mtTotal, packRow?.containersRequired]);
  const missingChecks = selectedContainer
    ? [
        selectedContainer.packerSignoff ? null : "Packer signoff",
        selectedContainer.outLoaded === "Yes" ? null : "Out-loaded confirmation",
        selectedContainer.emptyInspection === "Passed" ? null : "Empty container inspection",
        selectedContainer.grainInspection === "Passed" ? null : "Grain inspection",
        selectedContainer.aoSignoff ? null : "AO signoff",
      ].filter(Boolean)
    : [];
  const packChecks = selectedPackDraft?.packChecks || {};
  const packChecksCompleteCount = PACK_CHECK_FIELDS.filter((field) => Boolean(packChecks[field.key])).length;
  const allPackChecksComplete = packChecksCompleteCount === PACK_CHECK_FIELDS.length;

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-slate-200/90 bg-white p-4 md:p-5">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" size="sm" type="button" onClick={() => router.push("/packers-schedule")}>
            Back
          </Button>
          <h2 className="text-lg font-semibold text-slate-900">Pack #{packRow.id}</h2>
          <span className="rounded-full bg-brand/15 px-2 py-0.5 text-xs font-semibold text-brand-ink">{packRow.status}</span>
          <span className="ms-auto text-sm text-slate-600">
            PRA {packSummary.submitted}/{packRow.containersRequired} · Complete {packSummary.complete} · Nett total{" "}
            {aggregateNettWeight.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MT
          </span>
          <Button variant="secondary" size="sm" type="button" onClick={refreshPack}>
            Refresh
          </Button>
        </div>
        <div className="mt-2 grid gap-3 text-xs sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Customer" value={safeValue(packRow.customer)} />
          <Field label="Releases" value={releaseRefsSummary} />
          <Field label="Cut-off" value={formatDateTimeValue(packRow.vesselCutoffDate)} />
          <Field
            label="Fumigation"
            value={safeValue(packRow.fumigation)}
            labelClassName="text-purple-700"
            valueClassName="border-purple-200 bg-purple-50 text-purple-900"
          />
        </div>
        <div className="mt-3 grid gap-2 md:grid-cols-3">
          <PriorityField label="Commodity" value={safeValue(packRow.commodity)} />
          <PriorityField label="Weight per container" value={weightPerContainer == null ? "—" : `${weightPerContainer} MT`} />
          <PriorityField label="Job Ref" value={safeValue(packRow.jobReference)} />
        </div>
        <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-800">Packing note</p>
          <p className="mt-1 whitespace-pre-wrap text-sm text-amber-900">{safeValue(packRow.jobNotes || packRow.packingNote)}</p>
        </div>
        <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50/60 p-2.5">
          <div className="mb-2 flex items-center gap-2">
            <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">Pre-pack checks</p>
            <span
              className={cn(
                "ms-auto rounded-full px-2.5 py-1 text-xs font-semibold ring-1",
                allPackChecksComplete ? "bg-emerald-100 text-emerald-800 ring-emerald-200" : "bg-amber-100 text-amber-800 ring-amber-200"
              )}
            >
              {packChecksCompleteCount}/{PACK_CHECK_FIELDS.length} complete
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {PACK_CHECK_FIELDS.map((field) => {
              const checked = Boolean(packChecks[field.key]);
              return (
                <div key={field.key} className="flex min-w-[280px] flex-1 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2">
                  <span className="flex-1 text-[13px] text-slate-700">{field.label}</span>
                  <div className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 p-0.5">
                    <button
                      type="button"
                      onClick={() => setPackCheck(field.key, false)}
                      className={cn(
                        "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                        !checked ? "bg-slate-700 text-white shadow-sm" : "text-slate-500 hover:text-slate-700"
                      )}
                    >
                      Pending
                    </button>
                    <button
                      type="button"
                      onClick={() => setPackCheck(field.key, true)}
                      className={cn(
                        "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                        checked ? "bg-emerald-600 text-white shadow-sm" : "text-slate-500 hover:text-slate-700"
                      )}
                    >
                      Checked
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200/90 bg-white p-2">
        <div className="flex flex-wrap items-center gap-2">
          {PACK_DETAIL_TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={cn(
                "rounded-lg px-3 py-2 text-sm font-semibold transition-colors",
                activeTab === tab ? "bg-brand text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              )}
            >
              {tab}
            </button>
          ))}
          {activeTab === "PEMs" ? (
            <span className="ms-auto text-sm text-slate-600">
              Staged {stagedContainers.length} · Submitted batches {pemsSubmissions.length}
            </span>
          ) : null}
        </div>
      </section>

      {activeTab === "Packing" ? (
        <div className="grid gap-5 lg:grid-cols-[minmax(300px,360px)_minmax(0,1fr)]">
        <aside className="space-y-4">
          <section className={cn(sectionCardClass, "border-slate-200/90 bg-slate-50/30")}>
            <div className="flex items-center gap-2 border-b border-slate-200 px-3 py-3">
              <h3 className="text-sm font-semibold text-slate-900">Container queue</h3>
              <span className="ms-auto text-sm font-medium text-slate-600">
                Pack progress {packSummary.submitted}/{packRow.containersRequired}
              </span>
            </div>
            <div className="border-b border-slate-200 px-2 py-2">
              <input
                className={cn(inputClass, "h-10 text-sm")}
                value={containerSearch}
                onChange={(event) => setContainerSearch(event.target.value)}
                placeholder="Search container number..."
              />
              <p className="mt-1 text-[11px] text-slate-500">
                Showing {filteredContainerRows.length} of {containerRows.length} containers
              </p>
            </div>
            <div className="max-h-[560px] space-y-2 overflow-auto p-2">
              {!filteredContainerRows.length ? (
                <div className="rounded-lg border border-dashed border-slate-300 bg-white px-3 py-5 text-center text-xs text-slate-500">
                  No containers match this search.
                </div>
              ) : null}
              {filteredContainerRows.map((container) => {
                const stage = containerStage(container);
                return (
                  <button
                    key={container.id}
                    type="button"
                    onClick={() => setSelectedContainerId(container.id)}
                    className={cn(
                      "w-full rounded-lg border px-3 py-3 text-left transition-colors",
                      selectedContainerId === container.id
                        ? "border-brand/40 bg-brand/10"
                        : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-slate-700">#{container.order}</span>
                      <span className="text-[15px] font-semibold text-slate-900">{container.containerNo || "Draft container"}</span>
                      <span className={cn("ms-auto rounded-full px-2.5 py-1 text-xs font-semibold", stageBadgeClass(stage))}>{stage}</span>
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      Seal {safeValue(container.sealNo)} · Net {toInputNumber(container.nettWeight)} MT
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
          <section className={cn(sectionCardClass, "border-slate-200/90 bg-slate-50/30")}>
            <div className={cn(sectionHeaderClass, "border-slate-200 bg-slate-100 text-slate-800")}>Pack-level controls</div>
            <div className="grid gap-3 p-3">
              <LabeledSelect
                label="Sample collection required"
                value={selectedPackDraft?.bulkSampleCollectionRequired || "No"}
                options={YES_NO_OPTIONS}
                onChange={(value) => setBulkField("bulkSampleCollectionRequired", value)}
              />
              <LabeledSelect
                label="Sample required"
                value={selectedPackDraft?.bulkSampleRequired || "No"}
                options={YES_NO_OPTIONS}
                onChange={(value) => setBulkField("bulkSampleRequired", value)}
              />
              <div className="grid gap-2 sm:grid-cols-2">
                <Button type="button" className="h-9 text-sm" variant="destructive" onClick={() => runBulkAction("cancel-pra")}>
                  Bulk Cancel PRA
                </Button>
                <Button type="button" className="h-9 text-sm" onClick={() => runBulkAction("pra-all")}>
                  PRA All Containers
                </Button>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white/80 p-2.5">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Pack documents</p>
                {!packDocuments.length ? (
                  <p className="mt-1 text-sm text-slate-500">No documents attached to this pack.</p>
                ) : (
                  <details className="mt-1">
                    <summary className="cursor-pointer text-sm font-medium text-slate-700">Quick look ({packDocuments.length})</summary>
                    <ul className="mt-2 space-y-1.5">
                      {packDocuments.map((document) => (
                        <li key={document.id} className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-700">
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">{document.group}</span>
                          <span className="truncate">{document.name}</span>
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
            </div>
          </section>
          <section className="rounded-xl border border-slate-200/90 bg-white p-3">
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Container list</label>
            <textarea suppressHydrationWarning className={`${inputClass} min-h-[84px] w-full resize-y font-mono text-[12px]`} readOnly value={filteredContainerRows.map((container) => container.containerNo).join("\n")} />
          </section>
        </aside>

        {!selectedContainer ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-sm text-slate-500">
            Select a container to enter details.
          </div>
        ) : (
          <section className="space-y-4 rounded-xl border-2 border-brand/25 bg-brand/5 p-3">
            <div className="rounded-xl border border-slate-200/90 bg-white p-3">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <h3 className="text-base font-semibold text-slate-900">Container #{selectedContainer.order}</h3>
                <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", stageBadgeClass(containerStage(selectedContainer)))}>
                  {containerStage(selectedContainer)}
                </span>
              </div>
            </div>

            <ContainerFormSections
              container={selectedContainer}
              onChange={updateSelectedContainer}
              packerNames={packerNames}
              yesNoOptions={YES_NO_OPTIONS}
              inspectionOptions={INSPECTION_OPTIONS}
              praTemplateOptions={PRA_TEMPLATE_OPTIONS}
              praStatusOptions={PRA_STATUS_OPTIONS}
              isoOptions={["22G1", "42G1", "45G1", "L5G1"]}
              stockBayOptions={["Silo 1", "Silo 2", "Silo 3", "Bay 12", "Shed C"]}
              inputClass={inputClass}
              sectionCardClass={sectionCardClass}
              sectionHeaderClass={sectionHeaderClass}
              onResetContainer={selectedContainerActions?.onResetContainer}
              onMarkPacked={selectedContainerActions?.onMarkPacked}
              onSubmitPra={selectedContainerActions?.onSubmitPra}
            />

            <div className={cn("rounded-xl border px-3 py-2 text-sm", missingChecks.length ? "border-amber-300 bg-amber-50 text-amber-900" : "border-emerald-300 bg-emerald-50 text-emerald-800")}>
              {missingChecks.length ? `Missing checks before completion: ${missingChecks.join(", ")}.` : "All mandatory checks complete for this container."}
            </div>
          </section>
        )}
        </div>
      ) : (
        <PemsTab
          containers={containerRows}
          packerNames={packerNames}
          selectedContainerId={selectedContainerId}
          onSelectContainer={setSelectedContainerId}
          onOpenContainer={(containerId) => {
            setSelectedContainerId(containerId);
            setActiveTab("Packing");
          }}
          pemsDraft={pemsDraft}
          selectedAoNumber={selectedAoNumber}
          pemsSubmissions={pemsSubmissions}
          siteRow={siteRow}
          packRow={packRow}
          submitError={pemsSubmitError}
          isSubmitting={isSubmittingPems}
          onUpdatePemsDraft={updatePemsDraft}
          onToggleStage={togglePemsContainer}
          onStageAll={() =>
            updatePemsDraft({
              stagedContainerIds:
                pemsDraft.recordType === GPPIR_RECORD_TYPE
                  ? containerRows.filter((container) => container.ecrSubmitted).map((container) => container.id)
                  : containerRows.map((container) => container.id),
            })
          }
          onClearStage={() => updatePemsDraft({ stagedContainerIds: [] })}
          onSubmitBatch={submitPemsBatch}
        />
      )}
    </div>
  );
}

function Field({ label, value, labelClassName = "", valueClassName = "" }) {
  return (
    <div className="space-y-1">
      <div className={cn("text-[11px] font-semibold uppercase tracking-wide text-slate-500", labelClassName)}>{label}</div>
      <div className={cn("rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[13px] text-slate-700", valueClassName)}>{value}</div>
    </div>
  );
}

function PemsTab({
  containers,
  packerNames,
  selectedContainerId,
  onSelectContainer,
  onOpenContainer,
  pemsDraft,
  selectedAoNumber,
  pemsSubmissions,
  siteRow,
  packRow,
  submitError,
  isSubmitting,
  onUpdatePemsDraft,
  onToggleStage,
  onStageAll,
  onClearStage,
  onSubmitBatch,
}) {
  const stagedIds = pemsDraft.stagedContainerIds || [];
  const isGppirRecord = pemsDraft.recordType === GPPIR_RECORD_TYPE;
  const stagedContainers = containers.filter((container) => stagedIds.includes(container.id));
  const pemsChecks = [
    siteRow?.yardNo ? { ok: true, label: `Yard number resolved (${siteRow.yardNo})` } : { ok: false, label: "Missing yard number in selected site record." },
    siteRow?.name ? { ok: true, label: `Place of inspection resolved (${siteRow.name})` } : { ok: false, label: "Missing site name for place of inspection." },
    pemsDraft.aoSignoff
      ? selectedAoNumber
        ? { ok: true, label: `AO number resolved for ${pemsDraft.aoSignoff} (${selectedAoNumber})` }
        : { ok: false, label: `AO number missing for selected AO (${pemsDraft.aoSignoff}). Update Users table.` }
      : { ok: false, label: "Select AO signoff to resolve AO number." },
  ];
  const expiryDate = formatDateDisplay(addDaysToDate(pemsDraft.inspectionEnd || pemsDraft.inspectionStart, isGppirRecord ? 28 : 90));
  const gppirTotalWeight = toRoundedNumber(
    stagedContainers.reduce((sum, container) => sum + (Number.isFinite(Number(container.nettWeight)) ? Number(container.nettWeight) : 0), 0)
  );
  const gppirPassedWeight = toRoundedNumber(
    stagedContainers.reduce((sum, container) => {
      const weight = Number(container.nettWeight);
      if (container.grainInspection !== "Passed" || !Number.isFinite(weight)) return sum;
      return sum + weight;
    }, 0)
  );
  const gppirFailedWeight = toRoundedNumber(
    stagedContainers.reduce((sum, container) => {
      const weight = Number(container.nettWeight);
      if (container.grainInspection !== "Failed" || !Number.isFinite(weight)) return sum;
      return sum + weight;
    }, 0)
  );
  const gppirFlowResult = stagedContainers.length && stagedContainers.every((container) => container.grainInspection === "Passed") ? "Passed" : "Pending";
  const rfpNumber = safeValue(stagedContainers[0]?.releaseNumber || packRow.releaseNumber || "N/A");

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-slate-200/90 bg-white p-3">
        <div className="mb-2 flex items-center gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Submission setup</p>
          <span className="ms-auto text-xs text-slate-500">Set details once for this staged batch</span>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <LabeledSelect
            label="Record type"
            value={pemsDraft.recordType}
            options={PEMS_RECORD_OPTIONS}
            onChange={(value) =>
              onUpdatePemsDraft({
                recordType: value,
                stagedContainerIds:
                  value === GPPIR_RECORD_TYPE
                    ? stagedIds.filter((id) => {
                        const container = containers.find((row) => row.id === id);
                        return Boolean(container?.ecrSubmitted);
                      })
                    : stagedIds,
              })
            }
          />
          <LabeledInput
            label="Inspection start"
            type="datetime-local"
            value={formatDateTimeInput(pemsDraft.inspectionStart)}
            onChange={(value) => onUpdatePemsDraft({ inspectionStart: value })}
          />
          <LabeledInput
            label="Inspection end"
            type="datetime-local"
            value={formatDateTimeInput(pemsDraft.inspectionEnd)}
            onChange={(value) => onUpdatePemsDraft({ inspectionEnd: value })}
          />
          <LabeledSelect
            label="AO signoff"
            value={pemsDraft.aoSignoff}
            options={packerNames}
            onChange={(value) => onUpdatePemsDraft({ aoSignoff: value })}
          />
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 md:col-span-2 xl:col-span-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">PEMs checker</p>
            <div className="mt-1 space-y-1">
              {pemsChecks.map((check) => (
                <p key={check.label} className={cn("text-xs", check.ok ? "text-emerald-700" : "text-amber-700")}>
                  {check.ok ? "OK - " : "Needs attention - "}
                  {check.label}
                </p>
              ))}
            </div>
          </div>
          <div className="flex items-end">
            <Button type="button" onClick={onSubmitBatch} disabled={!stagedContainers.length || isSubmitting} className="h-11 w-full">
              {isSubmitting ? "Submitting PEMs..." : `Submit ${stagedContainers.length} container(s)`}
            </Button>
          </div>
        </div>
        {submitError ? <p className="mt-2 rounded-lg border border-rose-200 bg-rose-50 px-2 py-1.5 text-xs text-rose-700">{submitError}</p> : null}
      </section>

      <div className="grid gap-5 lg:grid-cols-[minmax(300px,380px)_minmax(0,1fr)]">
        <aside className="space-y-4">
        <section className="rounded-xl border border-slate-200/90 bg-white">
          <div className="border-b border-slate-200 px-3 py-3">
            <h3 className="text-sm font-semibold text-slate-900">PEMs container staging</h3>
            <p className="mt-1 text-xs text-slate-500">Stage any containers for submission in this batch.</p>
          </div>
          <div className="flex items-center gap-1.5 border-b border-slate-200 px-2 py-1.5">
            <Button type="button" variant="secondary" size="sm" className="h-7 px-2 text-[11px]" onClick={onStageAll}>
              Stage all
            </Button>
            <Button type="button" variant="secondary" size="sm" className="h-7 px-2 text-[11px]" onClick={onClearStage}>
              Clear stage
            </Button>
            <span className="ms-auto text-[11px] font-semibold text-slate-600">{stagedContainers.length} staged</span>
          </div>
          <div className="max-h-[480px] space-y-1 overflow-auto p-1">
            {containers.map((container) => {
              const checked = stagedIds.includes(container.id);
              const stageEligible = !isGppirRecord || container.ecrSubmitted;
              const stageStatus = container.gppirSubmitted
                ? "GPPIR Submitted"
                : container.ecrSubmitted
                  ? "ECR Submitted"
                  : "Awaiting ECR";
              return (
                <div
                  key={container.id}
                  className={cn(
                    "rounded-md border px-2 py-1",
                    selectedContainerId === container.id ? "border-brand/40 bg-brand/5" : "border-slate-200 bg-white"
                  )}
                >
                  <div className="flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={!stageEligible}
                      onChange={() => {
                        if (!stageEligible) return;
                        onToggleStage(container.id);
                      }}
                    />
                    <button type="button" className="text-left text-xs font-semibold text-slate-800" onClick={() => onSelectContainer(container.id)}>
                      #{container.order} {container.containerNo || "Draft container"}
                    </button>
                    <span
                      className={cn(
                        "ms-auto rounded-full px-1.5 py-0.5 text-[9px] font-semibold",
                        container.gppirSubmitted
                          ? "bg-emerald-100 text-emerald-800"
                          : container.ecrSubmitted
                            ? "bg-blue-100 text-blue-800"
                            : "bg-slate-100 text-slate-600"
                      )}
                    >
                      {stageStatus}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[10px] text-slate-500">Seal {safeValue(container.sealNo)} · Release {safeValue(container.releaseNumber)}</p>
                  {isGppirRecord && !container.ecrSubmitted ? (
                    <p className="mt-0.5 text-[10px] text-amber-700">Submit ECR first to include in GPPIR.</p>
                  ) : null}
                  <Button type="button" variant="ghost" size="sm" className="mt-0.5 h-5 px-1 text-[10px]" onClick={() => onOpenContainer(container.id)}>
                    Open container form
                  </Button>
                </div>
              );
            })}
          </div>
        </section>
        </aside>

        <section className="space-y-4">
        <div className="rounded-xl border border-slate-200/90 bg-white p-3">
          <div className="mb-3 flex items-center gap-2">
            <h3 className="text-base font-semibold text-slate-900">
              {isGppirRecord ? "Grain and Plant Product Inspection Record (staging)" : "Empty Container Inspection Record (staging)"}
            </h3>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{pemsDraft.recordType}</span>
            <span className="ms-auto text-xs text-slate-500">Pack #{packRow.id}</span>
          </div>
          {!stagedContainers.length ? (
            <div className="rounded-lg border border-dashed border-slate-300 px-3 py-6 text-center text-sm text-slate-500">Stage one or more containers to populate this record.</div>
          ) : isGppirRecord ? (
            <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50/50 p-3 text-sm">
              <div className="grid gap-2 md:grid-cols-4">
                <Field label="RFP Number" value={rfpNumber} />
                <Field label="Establishment Name" value={safeValue(siteRow?.name)} />
                <Field label="Establishment Number" value={safeValue(siteRow?.yardNo)} />
                <Field label="Exporter Name" value={safeValue(packRow.exporter || packRow.customer)} />
              </div>
              <div className="grid gap-2 md:grid-cols-4">
                <Field label="Total Quantity" value={`${gppirTotalWeight.toFixed(4)} M/TONS`} />
                <Field label="Estimated Net Metric Weight and Unit" value={`${gppirTotalWeight.toFixed(2)} TONS`} />
                <Field label="Inspection Start Date and Time" value={formatDateTimeValue(pemsDraft.inspectionStart)} />
                <Field label="Inspection End Date and Time" value={formatDateTimeValue(pemsDraft.inspectionEnd)} />
              </div>
              <div className="grid gap-2 md:grid-cols-5">
                <Field label="Destination Country" value={safeValue(packRow.destinationCountry)} />
                <Field label="Import Permit No." value="N/A" />
                <Field label="Flow Path Result" value={gppirFlowResult} />
                <Field label="Flow path Date and Time" value={formatDateTimeValue(pemsDraft.inspectionStart)} />
                <Field label="Expiry Date" value={expiryDate} />
              </div>
              <div className="overflow-x-auto rounded-md border border-slate-200 bg-white">
                <table className="w-full min-w-[1200px] text-left text-xs">
                  <thead className="bg-slate-100 text-slate-700">
                    <tr>
                      <th className="px-2 py-2 font-semibold">RFP Line No</th>
                      <th className="px-2 py-2 font-semibold">Container Number</th>
                      <th className="px-2 py-2 font-semibold">Source</th>
                      <th className="px-2 py-2 font-semibold">Commodity</th>
                      <th className="px-2 py-2 font-semibold">Package Number</th>
                      <th className="px-2 py-2 font-semibold">Type</th>
                      <th className="px-2 py-2 font-semibold">Weight</th>
                      <th className="px-2 py-2 font-semibold">Unit</th>
                      <th className="px-2 py-2 font-semibold">Sampled</th>
                      <th className="px-2 py-2 font-semibold">Result</th>
                      <th className="px-2 py-2 font-semibold">Inspection AO Name</th>
                      <th className="px-2 py-2 font-semibold">Remarks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stagedContainers.map((container) => (
                      <tr key={container.id} className="border-t border-slate-100 text-slate-700">
                        <td className="px-2 py-2">1</td>
                        <td className="px-2 py-2 font-medium">{safeValue(container.containerNo)}</td>
                        <td className="px-2 py-2">{safeValue(container.grainLocation || container.stockBayId)}</td>
                        <td className="px-2 py-2">{safeValue(packRow.commodity)}</td>
                        <td className="px-2 py-2">1</td>
                        <td className="px-2 py-2">CONTAINER</td>
                        <td className="px-2 py-2">{toRoundedNumber(container.nettWeight).toFixed(4)}</td>
                        <td className="px-2 py-2">M/TONS</td>
                        <td className="px-2 py-2">N/A</td>
                        <td className="px-2 py-2">
                          {container.grainInspection === "Passed" ? "Passed" : container.grainInspection === "Failed" ? "Failed" : "Pending"}
                        </td>
                        <td className="px-2 py-2">{safeValue(pemsDraft.aoSignoff)}</td>
                        <td className="px-2 py-2">{safeValue(container.aoInspectionRemark || "N/A")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="grid gap-2 md:grid-cols-5">
                <Field label="Submitted AO Name" value={safeValue(pemsDraft.aoSignoff)} />
                <Field label="Submitted AO Number" value={safeValue(selectedAoNumber)} />
                <Field label="Additional Declaration" value="N/A" />
                <Field label="Total Passed" value={`${gppirPassedWeight.toFixed(4)} M/TONS`} />
                <Field label="Total Failed" value={`${gppirFailedWeight.toFixed(4)} M/TONS`} />
              </div>
            </div>
          ) : (
            <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50/50 p-3 text-sm">
              <div className="grid gap-2 md:grid-cols-4">
                <Field label="Container Yard Id" value={safeValue(siteRow?.yardNo)} />
                <Field label="Place of Inspection" value={safeValue(siteRow?.name)} />
                <Field label="Inspection Start Date and Time" value={formatDateTimeValue(pemsDraft.inspectionStart)} />
                <Field label="Inspection End Date and Time" value={formatDateTimeValue(pemsDraft.inspectionEnd)} />
              </div>
              <div className="overflow-x-auto rounded-md border border-slate-200 bg-white">
                <table className="w-full min-w-[980px] text-left text-xs">
                  <thead className="bg-slate-100 text-slate-700">
                    <tr>
                      <th className="px-2 py-2 font-semibold">Container Number</th>
                      <th className="px-2 py-2 font-semibold">Inspection Level</th>
                      <th className="px-2 py-2 font-semibold">RFP Number</th>
                      <th className="px-2 py-2 font-semibold">Result</th>
                      <th className="px-2 py-2 font-semibold">Seal Number</th>
                      <th className="px-2 py-2 font-semibold">Expiry Date</th>
                      <th className="px-2 py-2 font-semibold">Inspection AO Name</th>
                      <th className="px-2 py-2 font-semibold">Remarks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stagedContainers.map((container) => (
                      <tr key={container.id} className="border-t border-slate-100 text-slate-700">
                        <td className="px-2 py-2 font-medium">{safeValue(container.containerNo)}</td>
                        <td className="px-2 py-2">Consumable</td>
                        <td className="px-2 py-2">{safeValue(container.releaseNumber)}</td>
                        <td className="px-2 py-2">{container.emptyInspection === "Passed" ? "Pass" : container.emptyInspection === "Failed" ? "Fail" : "Pending"}</td>
                        <td className="px-2 py-2">{safeValue(container.sealNo)}</td>
                        <td className="px-2 py-2">{expiryDate}</td>
                        <td className="px-2 py-2">{safeValue(pemsDraft.aoSignoff)}</td>
                        <td className="px-2 py-2">{safeValue(container.aoInspectionRemark || "N/A")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="grid gap-2 md:grid-cols-4">
                <Field label="Submitted AO Name" value={safeValue(pemsDraft.aoSignoff)} />
                <Field label="Submitted AO Number" value={safeValue(selectedAoNumber)} />
                <Field label="Pack Reference" value={safeValue(packRow.jobReference)} />
                <Field label="Containers in batch" value={String(stagedContainers.length)} />
              </div>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-slate-200/90 bg-white p-3">
          <h3 className="text-sm font-semibold text-slate-900">Submitted PEM records</h3>
          {!pemsSubmissions.length ? (
            <p className="mt-2 text-sm text-slate-500">No PEM batches submitted yet for this pack.</p>
          ) : (
            <div className="mt-2 space-y-2">
              {pemsSubmissions.map((submission) => (
                <div key={submission.batchId} className="relative w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 pr-44">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-semibold text-slate-900">{submission.batchId}</span>
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">{submission.status}</span>
                  </div>
                  <div className="absolute right-3 top-2 flex flex-col items-end">
                    <span className="text-[10px] font-medium tracking-wide text-slate-400">{formatDateTimeValue(submission.submittedAt)}</span>
                    <div className="mt-2 flex flex-wrap justify-end gap-1">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-6 rounded-md border border-slate-200 bg-white px-1.5 text-[10px] font-medium text-slate-600 hover:bg-slate-100"
                        onClick={() => openSubmissionSnapshot(submission, false)}
                      >
                        Quick look
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-6 rounded-md border border-brand/25 bg-brand/5 px-1.5 text-[10px] font-medium text-brand-ink hover:bg-brand/10"
                        onClick={() => openSubmissionSnapshot(submission, true)}
                      >
                        Print / Save PDF
                      </Button>
                    </div>
                  </div>
                  <p className="mt-1 text-xs text-slate-600">
                    {submission.recordType} · AO {safeValue(submission.aoSignoff)} ({safeValue(submission.aoNumber)}) · Containers {submission.containerIds?.length || 0}
                  </p>
                  <p className="text-xs text-slate-500">
                    Yard {safeValue(submission.yardId)} · Place {safeValue(submission.placeOfInspection)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
        </section>
      </div>
    </div>
  );
}

function PriorityField({ label, value }) {
  return (
    <div className="rounded-lg border border-emerald-300 bg-emerald-100/80 px-3 py-2.5 text-emerald-900">
      <p className="text-[11px] font-semibold uppercase tracking-wide">{label}</p>
      <p className="mt-1 text-base font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function LabeledInput({ label, value, onChange, type = "text", readOnly = false, step, placeholder }) {
  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-slate-600">{label}</label>
      <input
        className={cn(inputClass, "block w-full", readOnly ? "cursor-default bg-slate-50 text-slate-700" : "")}
        value={value ?? ""}
        type={type}
        onChange={(event) => onChange?.(event.target.value)}
        readOnly={readOnly}
        step={step}
        placeholder={placeholder}
      />
    </div>
  );
}

function LabeledSelect({ label, value, options, onChange, placeholder = "Select option" }) {
  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-slate-600">{label}</label>
      <select suppressHydrationWarning className={cn(inputClass, "block w-full")} value={value ?? ""} onChange={(event) => onChange(event.target.value)}>
        <option value="">{options.length ? placeholder : "—"}</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );
}

