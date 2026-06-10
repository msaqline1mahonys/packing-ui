"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CUSTOMER_CONTACT_ROWS, REFERENCE_COUNTRIES_ROWS } from "@/lib/Data";
import { loadContactUsers } from "@/lib/contact-users-store";
import { filterAuthorisedOfficers } from "@/lib/user-classifications";
import {
  buildPemsInspectionPayload,
  isPemsRfpRefreshError,
  pemsRfpRefreshUserMessage,
  submitPemsInspectionFlow,
  validatePemsSubmission,
} from "@/lib/pems";
import { defaultPemsDraftFields } from "@/lib/pems/constants";
import PemsInspectionPanel from "@/components/pems/pems-inspection-panel";
import {
  containerStage,
  loadWorkDrafts,
  saveWorkDrafts,
  syncWorkDrafts,
  toInputNumber,
  toRoundedNumber,
} from "@/lib/packers-work-store";
import { resolvePackRfpRef } from "@/lib/pems-rfp-display";
import {
  attachPemsSubmissionSnapshot,
  downloadPemsSubmissionPdf,
  GPPIR_RECORD_TYPE,
  ECR_RECORD_TYPE,
} from "@/lib/pems-staging-snapshot";
import PemsSubmissionPreviewModal from "@/components/pems/pems-submission-preview-modal";
import {
  CONTAINER_INSPECTION_REMARK_FIELD,
  containerInspectionRemarkPatch,
  getContainerInspectionRemark,
} from "@/lib/pems-container-fields";
import { fetchPack, savePack } from "@/lib/pack-schedule-store";
import { getPackFormData } from "@/lib/api/packing";
import { readSiteRows } from "@/lib/site-data";
import { cn } from "@/lib/utils";
import { createPraActionHandlers } from "@/components/pems/container-form-actions";
import ContainerFormSections from "@/components/pems/container-form-sections";

const customerOptions = CUSTOMER_CONTACT_ROWS;
const countryOptions = REFERENCE_COUNTRIES_ROWS.map((row) => row.countryName);
const YES_NO_OPTIONS = ["No", "Yes"];
const INSPECTION_OPTIONS = ["Pending", "Passed", "Failed"];
const PRA_STATUS_OPTIONS = ["Pending", "Accepted", "Rejected", "Error"];
const PRA_TEMPLATE_OPTIONS = ["Original", "Resubmit", "Correction"];
const PACK_DETAIL_TABS = ["Packing", "PEMs"];
const PEMS_RECORD_OPTIONS = ["Empty Container Inspection Record", "Grain and Plant Product Inspection Record"];
const PACK_CHECK_FIELDS = [
  { key: "importDetailsChecked", label: "Import details checked", short: "Import details" },
  { key: "sampleRequirementsChecked", label: "Sample requirements checked", short: "Samples" },
  { key: "rfpDetailsChecked", label: "RFP details checked", short: "RFP" },
  { key: "micorRequirementsChecked", label: "MICOR requirements checked", short: "MICOR" },
];

const inputClass =
  "h-11 w-full min-w-0 rounded-lg border border-slate-200 bg-white px-2 text-[15px] text-slate-800 outline-none ring-brand/15 placeholder:text-slate-400 focus:border-brand/40 focus:ring-2";
const stagingInputClass = cn(inputClass, "!h-9 py-1.5 text-[13px]");
const stagingGridClass = "grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4";
const stagingGrid6Class = "grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6";
const stagingGrid3Class = "grid gap-4 sm:grid-cols-2 md:grid-cols-3";
const GPPIR_WEIGHT_UNIT = "M/TONS";
const gppirTableCompactCol = "w-12 min-w-[3rem] max-w-[4rem] px-1 py-1.5 whitespace-nowrap text-center";
const gppirTableNarrowCol = "w-16 min-w-[3.5rem] px-1 py-1.5 whitespace-nowrap";
const gppirTableNumCol = "w-[4.5rem] min-w-[4rem] px-1 py-1.5 whitespace-nowrap text-right tabular-nums";
const gppirTableTypeCol = "w-[4.5rem] min-w-[4rem] px-1 py-1.5 whitespace-nowrap";
const gppirTableInspectionLevelCol = "w-[7.5rem] min-w-[7.5rem] px-2 py-2 whitespace-nowrap";
const gppirTableRfpCol = "w-[6.5rem] min-w-[6.5rem] px-2 py-2 whitespace-nowrap";
const gppirTableResultCol = "w-[4.5rem] min-w-[4.5rem] px-2 py-2 whitespace-nowrap";
const gppirTableSealCol = "w-[6rem] min-w-[6rem] px-2 py-2 whitespace-nowrap";
const gppirTableExpiryDateCol = "w-[6.5rem] min-w-[6.5rem] px-2 py-2 whitespace-nowrap text-center";
const gppirTableInspectionAoCol = "w-[9rem] min-w-[9rem] px-2 py-2 whitespace-nowrap";
const gppirTableContainerCol = "w-[7rem] min-w-[7rem] px-2 py-2 whitespace-nowrap";
const gppirTableCellCol = "px-1.5 py-1.5";
const gppirTableRemarksCol = "w-[10rem] min-w-[10rem] px-2 py-2 align-top";
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
    ecrComments: "N/A",
    stagedContainerIds: [],
    ...defaultPemsDraftFields(),
  };
}

function normalizePackAttachmentFiles(items) {
  if (!Array.isArray(items)) return [];
  return items.map((item, index) => {
    if (typeof item === "string") {
      const isPath = item.startsWith("/");
      return {
        id: `legacy-${index}-${item}`,
        name: item.includes("/") ? item.split("/").pop() || item : item,
        size: null,
        type: isPath && item.toLowerCase().endsWith(".pdf") ? "application/pdf" : "",
        file: null,
        url: isPath ? item : null,
      };
    }
    return {
      id: item?.id ?? `file-${index}-${item?.name ?? "unknown"}`,
      name: item?.name ?? "file",
      size: Number.isFinite(item?.size) ? item.size : null,
      type: item?.type ?? "",
      file: item?.file instanceof File ? item.file : null,
      url: typeof item?.url === "string" ? item.url : null,
    };
  });
}

function collectPackAttachments(packRow) {
  if (!packRow) return [];
  const rows = [];
  const add = (files, group) => {
    normalizePackAttachmentFiles(files).forEach((item) => {
      rows.push({ ...item, group, listKey: `${group}-${item.id}` });
    });
  };
  add(packRow.importPermitFiles, "Permit");
  add(packRow.rfpFiles, "RFP");
  add(packRow.packingInstructionFiles, "Instruction");
  add(packRow.additionalDeclarationFiles, "Declaration");
  return rows;
}

function attachmentCanQuickLook(item) {
  if (item?.file instanceof File) return true;
  const u = typeof item?.url === "string" ? item.url.trim() : "";
  if (!u) return false;
  if (/^https?:\/\//i.test(u)) return true;
  if (u.startsWith("/")) return true;
  return false;
}

/** Absolute URL for iframe / new tab (client). */
function resolvePackAttachmentViewUrl(item) {
  const u = typeof item?.url === "string" ? item.url.trim() : "";
  if (!u) return null;
  if (/^https?:\/\//i.test(u)) return u;
  if (typeof window !== "undefined" && u.startsWith("/")) {
    try {
      return new URL(u, window.location.origin).href;
    } catch {
      return u;
    }
  }
  return null;
}

function previewKindForFileItem(item) {
  const name = String(item?.name || "").toLowerCase();
  const url = String(item?.url || "").toLowerCase();
  const mime = String(item?.type || (item?.file instanceof File ? item.file.type : "") || "");
  if (mime.startsWith("image/") || /\.(png|jpe?g|gif|webp|bmp|svg)$/.test(name) || /\.(png|jpe?g|gif|webp|svg)(\?|$)/.test(url))
    return "image";
  if (mime === "application/pdf" || name.endsWith(".pdf") || url.includes(".pdf")) return "pdf";
  return "generic";
}

const ATTACHMENT_GROUP_STYLES = {
  Permit: { pill: "bg-emerald-500/10 text-emerald-800 ring-emerald-500/20" },
  RFP: { pill: "bg-sky-500/10 text-sky-900 ring-sky-500/20" },
  Instruction: { pill: "bg-amber-500/10 text-amber-900 ring-amber-500/25" },
  Declaration: { pill: "bg-violet-500/10 text-violet-900 ring-violet-500/20" },
};

function attachmentGroupStyles(group) {
  return ATTACHMENT_GROUP_STYLES[group] || ATTACHMENT_GROUP_STYLES.Instruction;
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
    aoInspectionRemark: getContainerInspectionRemark(container),
    packerNotes: container.packerNotes || "",
    status: containerStage(container),
  };
}

function resolveExporterCustomerId(packRow) {
  if (!packRow) return "";
  const byExporter = customerOptions.find((customer) => customer.name === packRow.exporter)?.id;
  if (byExporter != null) return String(byExporter);
  const byCustomer = customerOptions.find((customer) => customer.name === packRow.customer)?.id;
  return byCustomer != null ? String(byCustomer) : "";
}

export default function PackDetailClient({ packId }) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("Packing");
  const [packRow, setPackRow] = useState(null);
  const [workByPack, setWorkByPack] = useState({});
  const [selectedContainerId, setSelectedContainerId] = useState(null);
  const [containerSearch, setContainerSearch] = useState("");
  const [isSubmittingPems, setIsSubmittingPems] = useState(false);
  const [pemsSubmitError, setPemsSubmitError] = useState("");
  const [filePreview, setFilePreview] = useState(null);
  const [lookups, setLookups] = useState({});
  const previewRevokeRef = useRef(null);

  const packerNames = useMemo(
    () => (lookups.packers || []).filter((p) => String(p.status ?? "active").toLowerCase() === "active").map((p) => p.name),
    [lookups]
  );
  const contactUsers = useMemo(() => loadContactUsers(), []);
  const authorisedOfficers = useMemo(() => filterAuthorisedOfficers(contactUsers), [contactUsers]);
  const aoNumberByName = useMemo(() => {
    const map = new Map();
    authorisedOfficers.forEach((row) => {
      const name = String(row.name || "").trim();
      if (!name) return;
      map.set(name, String(row.aoNumber || ""));
    });
    return map;
  }, [authorisedOfficers]);
  const aoNameOptions = useMemo(() => authorisedOfficers.map((u) => u.name).filter(Boolean), [authorisedOfficers]);

  useEffect(() => {
    if (!packId) return;
    Promise.all([fetchPack(packId), getPackFormData().catch(() => ({}))]).then(([row, fd]) => {
      setLookups(fd || {});
      setPackRow(row || null);
      if (row) setWorkByPack((prev) => syncWorkDrafts([row], { ...loadWorkDrafts(), ...prev }, fd || {}));
    }).catch(() => {});
  }, [packId]);

  useEffect(() => {
    saveWorkDrafts(workByPack);
    if (!packRow || !workByPack[packRow.id]) return;
    const draft = workByPack[packRow.id];
    const containers = (draft.containers || []).map((container) => packContainerFromWorkContainer(container, packRow));
    const pemsSubmissions = Array.isArray(draft.pemsSubmissions) ? draft.pemsSubmissions : [];
    savePack({ ...packRow, containers, pemsSubmissions }).catch(() => {});
  }, [workByPack, packRow]);

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

  function updateContainerById(containerId, patch) {
    if (!packRow) return;
    updateSelectedPack((current) => ({
      ...current,
      containers: current.containers.map((container) => {
        if (container.id !== containerId) return container;
        const next = typeof patch === "function" ? patch(container) : { ...container, ...patch };
        const tare = toRoundedNumber(next.tare);
        const grossWeight = toRoundedNumber(next.grossWeight);
        const normalized = { ...next, tare, grossWeight, nettWeight: toRoundedNumber(Math.max(grossWeight - tare, 0)) };
        return { ...normalized, status: containerStage(normalized) };
      }),
    }));
  }

  function updateSelectedContainer(patch) {
    if (!packRow || !selectedContainer) return;
    updateContainerById(selectedContainer.id, patch);
  }

  function persistPackRowToStore(nextRow, workDraft) {
    const containers = (workDraft?.containers || []).map((container) => packContainerFromWorkContainer(container, nextRow));
    savePack({ ...nextRow, containers }).catch(() => {});
  }

  function updatePackRow(patch) {
    if (!packRow) return;
    setPackRow((prev) => {
      if (!prev) return prev;
      const nextRow = { ...prev, ...patch };
      setWorkByPack((workPrev) => {
        persistPackRowToStore(nextRow, workPrev[prev.id]);
        return workPrev;
      });
      return nextRow;
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

  function setPackCheck(checkKey, value) {
    updateSelectedPack((current) => ({
      ...current,
      packChecks: {
        ...(current.packChecks || {}),
        [checkKey]: value,
      },
    }));
  }

  const closeFilePreview = useCallback(() => {
    if (previewRevokeRef.current) {
      previewRevokeRef.current();
      previewRevokeRef.current = null;
    }
    setFilePreview(null);
  }, []);

  function openAttachmentQuickLook(item) {
    const viewUrl = resolvePackAttachmentViewUrl(item);
    if (viewUrl) {
      closeFilePreview();
      const kind = previewKindForFileItem(item);
      previewRevokeRef.current = null;
      setFilePreview({ src: viewUrl, title: item.name || "Attachment", kind });
      return;
    }
    if (!(item?.file instanceof File)) return;
    closeFilePreview();
    const kind = previewKindForFileItem(item);
    const src = URL.createObjectURL(item.file);
    previewRevokeRef.current = () => URL.revokeObjectURL(src);
    setFilePreview({ src, title: item.name || "Attachment", kind });
  }

  useEffect(() => {
    if (!filePreview) return undefined;
    function onKey(event) {
      if (event.key === "Escape") closeFilePreview();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [filePreview, closeFilePreview]);

  useEffect(
    () => () => {
      if (previewRevokeRef.current) previewRevokeRef.current();
    },
    []
  );

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
    } else if (!String(pemsDraft.ecrComments ?? "").trim()) {
      setPemsSubmitError("Enter comments before submitting the empty container inspection record.");
      return;
    }

    setIsSubmittingPems(true);
    setPemsSubmitError("");
    try {
      const payload = buildPemsInspectionPayload({
        pack: packRow,
        site: siteRow,
        recordType: pemsDraft.recordType,
        pemsDraft,
        containers: containersForBatch,
        contactUsers,
      });

      const validationErrors = validatePemsSubmission({
        recordType: pemsDraft.recordType,
        pack: packRow,
        site: siteRow,
        containers: payload.containers,
        lines: payload.lines,
        timeEntries: payload.timeEntries,
        pemsDraft,
      });
      if (validationErrors.length) {
        throw new Error(validationErrors[0]);
      }

      const data = await submitPemsInspectionFlow({
        recordType: pemsDraft.recordType,
        payload,
        isGppir,
      });

      const batchId = data?.submissionId || data?.pemsInspectionId || data?.id || `PEMS-${Date.now()}`;
      const submittedAt = data?.submittedAt || new Date().toISOString();
      const stagedIds = new Set(containersForBatch.map((container) => container.id));
      const nextSubmission = attachPemsSubmissionSnapshot({
        batchId,
        submittedAt,
        status: data?.status || data?.pemsStatus || "Accepted",
        pemsInspectionId: data?.pemsInspectionId || data?.id || "",
        recordType: pemsDraft.recordType,
        packId: packRow.id,
        jobReference: packRow.jobReference || "",
        rfp: String(packRow.rfp || "").trim(),
        exporter: packRow.exporter || packRow.customer || "",
        destinationCountry: packRow.destinationCountry || "",
        importPermitRequired: Boolean(packRow.importPermitRequired),
        importPermitNumber: packRow.importPermitNumber || "",
        rfpAdditionalDeclarationRequired: Boolean(packRow.rfpAdditionalDeclarationRequired),
        establishmentName: siteRow?.name || "",
        establishmentNumber: siteRow?.establishmentNumber || siteRow?.yardNo || "",
        commodity: packRow.commodity || "",
        aoSignoff: pemsDraft.aoSignoff,
        aoNumber: selectedAoNumber,
        inspectionStart: pemsDraft.inspectionStart,
        inspectionEnd: pemsDraft.inspectionEnd,
        ecrComments: pemsDraft.ecrComments || "N/A",
        yardId: siteRow?.yardId ?? siteRow?.yardNo ?? "",
        placeOfInspection: siteRow?.name || "",
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
          aoInspectionRemark: getContainerInspectionRemark(container),
          inspectionLevelCode: container.inspectionLevelCode,
          passedAfterRectification: container.passedAfterRectification,
        })),
      });
      updateSelectedPack((current) => {
        const draft = { ...defaultPemsDraft(), ...(current.pemsDraft || {}) };
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
      setPemsSubmitError(isPemsRfpRefreshError(error) ? pemsRfpRefreshUserMessage() : error?.message || "PEMs submission failed.");
    } finally {
      setIsSubmittingPems(false);
    }
  }

  function refreshPack() {
    fetchPack(packId).then((row) => {
      setPackRow(row || null);
      if (row) setWorkByPack((prev) => syncWorkDrafts([row], prev, lookups));
    }).catch(() => {});
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

  const packAttachments = useMemo(() => collectPackAttachments(packRow), [packRow]);
  const permitNumberLine = String(packRow.importPermitNumber || "").trim();
  const permitDateLine = packRow.importPermitDate ? formatDateDisplay(packRow.importPermitDate) : "";
  const permitMetaLine = [permitNumberLine, permitDateLine].filter(Boolean).join(" · ");
  const packingNoteText = String(packRow.jobNotes || packRow.packingNote || "").trim();
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
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 flex-wrap items-center gap-y-1">
            <h2 className="shrink-0 text-lg font-semibold text-slate-900">Pack #{packRow.id}</h2>
            <span className="min-w-0 border-l border-slate-200 pl-3 text-sm text-slate-600 sm:ml-1">
              PRA {packSummary.submitted}/{packRow.containersRequired} · Complete {packSummary.complete} · Nett total{" "}
              {aggregateNettWeight.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MT
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button variant="secondary" size="sm" type="button" onClick={refreshPack}>
              Refresh
            </Button>
            <Button variant="secondary" size="sm" type="button" onClick={() => router.push("/packers-schedule")}>
              Back
            </Button>
          </div>
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
        <div className="mt-3 overflow-hidden rounded-lg border border-amber-300/90 bg-gradient-to-r from-amber-50 via-amber-50 to-amber-100/60 shadow-sm shadow-amber-200/30">
          <div className="border-b border-amber-200/70 bg-amber-100/50 px-3 py-1.5">
            <p className="text-[10px] font-bold uppercase tracking-wide text-amber-900">Packing note</p>
          </div>
          <p className="whitespace-pre-wrap px-3 py-2.5 text-sm font-medium leading-snug text-amber-950">
            {safeValue(packRow.jobNotes || packRow.packingNote)}
          </p>
        </div>
        <div
          id="pack-prepack-review"
          className="mt-3 overflow-hidden rounded-xl border border-slate-200/90 bg-gradient-to-b from-white via-slate-50/40 to-slate-50/80 shadow-[0_1px_2px_rgba(15,23,42,0.05)]"
        >
          <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-200/80 bg-white/90 px-2.5 py-2">
            <div className="min-w-0 flex-1">
              <h3 className="text-[13px] font-semibold leading-tight tracking-tight text-slate-900">Pack attachments and pre-pack checks</h3>
            </div>
            <span
              className={cn(
                "inline-flex shrink-0 items-center self-start rounded-full px-1.5 py-0.5 text-[9px] font-semibold ring-1",
                allPackChecksComplete ? "bg-emerald-100 text-emerald-900 ring-emerald-200/90" : "bg-amber-100 text-amber-900 ring-amber-200/80"
              )}
            >
              Checks {packChecksCompleteCount}/{PACK_CHECK_FIELDS.length}
            </span>
          </div>

          {/* Pack documents */}
          <div className="px-2.5 pb-2.5 pt-2">
            {(packRow.importPermitRequired || permitMetaLine) && (
              <div className="mb-1.5 flex flex-wrap items-center gap-1 rounded-md border border-slate-200/80 bg-white/90 px-2 py-1">
                <span className="text-[9px] font-semibold uppercase tracking-wide text-slate-500">Import permit</span>
                {!packRow.importPermitRequired ? (
                  <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">Not required</span>
                ) : null}
                {permitMetaLine ? (
                  <span className="text-xs font-medium text-slate-900">{permitMetaLine}</span>
                ) : packRow.importPermitRequired ? (
                  <span className="text-[11px] text-slate-500">Number or date not set on pack — update in pack schedule.</span>
                ) : (
                  <span className="text-[11px] text-slate-500">—</span>
                )}
              </div>
            )}

            {packAttachments.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-300/90 bg-white/60 px-3 py-6 text-center">
                <p className="text-xs font-semibold text-slate-800">No documents on this pack yet</p>
                <p className="mx-auto mt-1.5 max-w-md text-[11px] leading-relaxed text-slate-600">
                  Attach permits, RFPs, packing instructions, or declarations from the pack schedule. You can still complete the checks below if
                  those documents are managed outside the system.
                </p>
              </div>
            ) : (
              <div className="relative">
                <div className="flex flex-nowrap gap-1.5 overflow-x-auto overflow-y-visible scroll-smooth py-0.5 pb-1 [scrollbar-width:thin]">
                  {packAttachments.map((doc) => {
                    const gs = attachmentGroupStyles(doc.group);
                    const canLook = attachmentCanQuickLook(doc);
                    return (
                      <div
                        key={doc.listKey}
                        className="group flex w-44 shrink-0 flex-col rounded-md border border-slate-200/80 bg-white p-1.5 shadow-sm transition-colors hover:border-slate-300/90 hover:bg-slate-50/50"
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span
                            className={cn(
                              "min-w-0 truncate rounded px-1 py-px text-[8px] font-bold uppercase tracking-wide ring-1",
                              gs.pill
                            )}
                          >
                            {doc.group}
                          </span>
                          {canLook ? (
                            <button
                              type="button"
                              title={`Quick look: ${doc.name}`}
                              onClick={() => openAttachmentQuickLook(doc)}
                              className="inline-flex size-5 shrink-0 items-center justify-center rounded border border-slate-200/90 bg-white text-slate-500 transition-colors hover:border-brand/30 hover:bg-brand/5 hover:text-brand-700"
                            >
                              <Eye className="size-2.5" aria-hidden />
                              <span className="sr-only">Quick look {doc.name}</span>
                            </button>
                          ) : (
                            <span
                              title="Preview needs an uploaded file or URL"
                              className="shrink-0 rounded border border-dashed border-slate-200 bg-slate-50 px-0.5 py-px text-[7px] font-medium leading-none text-slate-400"
                            >
                              —
                            </span>
                          )}
                        </div>
                        <p className="mt-1 line-clamp-2 text-[10px] font-medium leading-snug text-slate-800" title={doc.name}>
                          {doc.name}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent" />

          <div className="bg-white/95 px-2.5 py-2">
            <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-4" role="group" aria-label="Pre-pack checks">
              {PACK_CHECK_FIELDS.map((field) => {
                const checked = Boolean(packChecks[field.key]);
                return (
                  <label
                    key={field.key}
                    className={cn(
                      "relative flex cursor-pointer items-start gap-2 rounded-lg border px-2.5 py-2 transition-colors duration-200",
                      checked
                        ? "border-emerald-400/90 bg-emerald-50 ring-1 ring-emerald-200/90"
                        : "border-slate-200/90 bg-white ring-1 ring-slate-100 hover:border-amber-200/80 hover:bg-amber-50/40"
                    )}
                  >
                    <input
                      type="checkbox"
                      className="mt-0.5 size-4 shrink-0 rounded border-slate-300 text-emerald-600 focus:ring-2 focus:ring-brand/25"
                      checked={checked}
                      onChange={(event) => setPackCheck(field.key, event.target.checked)}
                    />
                    <span className="min-w-0 flex-1">
                      <span
                        className={cn(
                          "block text-[12px] font-semibold leading-snug",
                          checked ? "text-emerald-950" : "text-slate-800"
                        )}
                      >
                        <span className="sm:hidden">{field.short}</span>
                        <span className="hidden sm:inline">{field.label}</span>
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
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
            <span className="ms-auto text-sm text-slate-600">{stagedContainers.length} staged</span>
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
              <div className="grid gap-2 sm:grid-cols-2">
                <Button type="button" className="h-9 text-sm" variant="destructive" onClick={() => runBulkAction("cancel-pra")}>
                  Bulk Cancel PRA
                </Button>
                <Button type="button" className="h-9 text-sm" onClick={() => runBulkAction("pra-all")}>
                  PRA All Containers
                </Button>
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
            <div className="overflow-hidden rounded-xl border border-slate-200/90 bg-white">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3 py-2.5">
                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-xs font-semibold text-slate-500">#{selectedContainer.order}</span>
                  <span className="text-base font-semibold text-slate-900">
                    {selectedContainer.containerNo || "Draft container"}
                  </span>
                </div>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold",
                    stageBadgeClass(containerStage(selectedContainer))
                  )}
                >
                  {containerStage(selectedContainer)}
                </span>
              </div>
              <div className="border-t border-amber-300/80 bg-gradient-to-r from-amber-50 via-amber-50/95 to-amber-100/70 px-3 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]">
                <div className="flex flex-wrap items-start gap-2">
                  <span className="shrink-0 rounded-md bg-amber-200/70 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-950 ring-1 ring-amber-300/60">
                    Packing note
                  </span>
                  <p className="min-w-0 flex-1 text-sm font-medium leading-snug text-amber-950">{safeValue(packingNoteText)}</p>
                </div>
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
              showPackersNote
              onResetContainer={selectedContainerActions?.onResetContainer}
              onMarkPacked={selectedContainerActions?.onMarkPacked}
              onSubmitPra={selectedContainerActions?.onSubmitPra}
            />

            <div className={cn("rounded-xl border px-3 py-2 text-sm", missingChecks.length ? "border-rose-300 bg-rose-50 text-rose-900" : "border-emerald-300 bg-emerald-50 text-emerald-800")}>
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
          authorisedOfficers={authorisedOfficers}
          aoNameOptions={aoNameOptions}
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
          onUpdatePackRow={updatePackRow}
          onUpdateContainer={updateContainerById}
        />
      )}
      {filePreview ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-3 backdrop-blur-[1px]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="file-preview-title"
          onClick={closeFilePreview}
        >
          <div
            className="relative flex max-h-[min(90vh,900px)] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-3 py-2">
              <p id="file-preview-title" className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-900">
                {filePreview.title}
              </p>
              <div className="flex shrink-0 items-center gap-2">
                <a
                  href={filePreview.src}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-semibold text-brand-ink underline-offset-2 hover:underline"
                >
                  Open in new tab
                </a>
                <Button type="button" variant="secondary" size="sm" className="h-8 shrink-0 px-2" onClick={closeFilePreview} aria-label="Close preview">
                  <X className="size-4" aria-hidden />
                </Button>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-auto bg-slate-50">
              {filePreview.kind === "image" ? (
                <img src={filePreview.src} alt="" className="mx-auto max-h-[80vh] max-w-full object-contain p-2" />
              ) : null}
              {filePreview.kind === "pdf" ? (
                <iframe title={filePreview.title} src={filePreview.src} className="min-h-[70vh] w-full bg-white" />
              ) : null}
              {filePreview.kind === "generic" ? (
                <div className="p-8 text-center text-sm text-slate-600">
                  <p className="mb-3">Inline preview is not available for this file type.</p>
                  <a
                    href={filePreview.src}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-brand-600 underline-offset-2 hover:underline"
                  >
                    Open in new tab
                  </a>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
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

function PemsStagingFormField({ label, children, labelClassName = "" }) {
  return (
    <div className="min-w-0 space-y-1">
      <div className={cn("text-[11px] font-semibold uppercase tracking-wide text-slate-500", labelClassName)}>{label}</div>
      <div className="w-full min-w-0">{children}</div>
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
  authorisedOfficers = [],
  aoNameOptions = [],
  submitError,
  isSubmitting,
  onUpdatePemsDraft,
  onToggleStage,
  onStageAll,
  onClearStage,
  onSubmitBatch,
  onUpdatePackRow,
  onUpdateContainer,
}) {
  const [pemsContainerSearch, setPemsContainerSearch] = useState("");
  const [previewSubmission, setPreviewSubmission] = useState(null);
  const [downloadingBatchId, setDownloadingBatchId] = useState("");

  async function handleDownloadSubmission(submission) {
    const batchId = submission?.batchId;
    if (!batchId || downloadingBatchId) return;
    setDownloadingBatchId(batchId);
    try {
      await downloadPemsSubmissionPdf(submission);
    } finally {
      setDownloadingBatchId("");
    }
  }
  const stagedIds = pemsDraft.stagedContainerIds || [];
  const isGppirRecord = pemsDraft.recordType === GPPIR_RECORD_TYPE;
  const stagedContainers = containers.filter((container) => stagedIds.includes(container.id));
  const pemsCheckerSections = [
    {
      title: "Establishment",
      ...(!(siteRow?.establishmentNumber || siteRow?.yardNo)
        ? { ok: false, label: "Missing establishment number on site record." }
        : { ok: true, label: `Establishment ${siteRow.establishmentNumber || siteRow.yardNo}` }),
    },
    {
      title: "Yard ID",
      ...(siteRow?.yardId == null && !siteRow?.addressLine1
        ? { ok: false, label: "Configure yard ID or PEMS address on Sites." }
        : { ok: true, label: `Yard ID ${siteRow?.yardId ?? siteRow?.yardNo ?? "—"}` }),
    },
    {
      title: "Place of inspection",
      ...(!siteRow?.name
        ? { ok: false, label: "Missing site name for place of inspection." }
        : { ok: true, label: `Place of inspection resolved (${siteRow.name})` }),
    },
    {
      title: "AO signoff",
      ...(pemsDraft.aoSignoff
        ? selectedAoNumber
          ? { ok: true, label: `AO number resolved for ${pemsDraft.aoSignoff} (${selectedAoNumber})` }
          : { ok: false, label: `AO number missing for selected AO (${pemsDraft.aoSignoff}). Update Users table.` }
        : { ok: false, label: "Select AO signoff to resolve AO number." }),
    },
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
  const packRfpText = String(packRow?.rfp || "").trim();
  const exporterCustomerId = resolveExporterCustomerId(packRow);
  const rfpSummary = resolvePackRfpRef({
    packRfp: packRow?.rfp,
    stagedContainers,
    allContainers: containers,
    releaseRefs: packRow?.releaseNumbers,
    packReleaseNumber: packRow?.releaseNumber,
  });

  function setPackField(key, value) {
    onUpdatePackRow?.({ [key]: value });
  }

  function setExporterCustomerId(customerId) {
    const customerName = customerOptions.find((customer) => customer.id === Number(customerId))?.name || "-";
    onUpdatePackRow?.({ exporter: customerName });
  }

  const filteredPemsContainers = useMemo(() => {
    const q = pemsContainerSearch.trim().toLowerCase();
    if (!q) return containers;
    return containers.filter((c) =>
      [c.order, c.containerNo, c.sealNo, c.releaseNumber, c.id, c.stockBayId, c.grainLocation].some((v) =>
        String(v ?? "")
          .toLowerCase()
          .includes(q)
      )
    );
  }, [containers, pemsContainerSearch]);

  const eligibleContainerIds = useMemo(
    () => containers.filter((container) => !isGppirRecord || container.ecrSubmitted).map((container) => container.id),
    [containers, isGppirRecord]
  );
  const allEligibleStaged =
    eligibleContainerIds.length > 0 && eligibleContainerIds.every((id) => stagedIds.includes(id));

  return (
    <div className="space-y-3">
      <section className="rounded-lg border border-slate-200/90 bg-white px-2 py-2.5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Submitted PEM</p>
          {pemsSubmissions.length ? (
            <span className="tabular-nums text-[10px] text-slate-400">{pemsSubmissions.length}</span>
          ) : null}
        </div>
        {!pemsSubmissions.length ? (
          <p className="mt-2 text-[11px] text-slate-500">None yet.</p>
        ) : (
          <div className="mt-2 divide-y divide-slate-100 border-t border-slate-100">
            {pemsSubmissions.map((submission) => (
              <div
                key={submission.batchId}
                className="flex flex-col gap-2 py-2.5 text-[11px] leading-snug sm:flex-row sm:items-start sm:gap-4"
              >
                <div className="flex shrink-0 flex-wrap items-center gap-2 sm:w-[10.5rem] sm:flex-col sm:items-start sm:gap-1">
                  <span className="font-semibold text-slate-900">{submission.batchId}</span>
                  <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-emerald-800">
                    {submission.status}
                  </span>
                </div>
                <div className="min-w-0 flex-1 break-words">
                  <p className="text-[10px] text-slate-700">{submission.recordType}</p>
                  <p className="mt-0.5 text-[10px] text-slate-500">
                    {submission.containerIds?.length ?? 0} containers
                    <span className="text-slate-300"> · </span>
                    AO {safeValue(submission.aoSignoff)}
                    {submission.aoNumber ? ` (${safeValue(submission.aoNumber)})` : ""}
                    <span className="text-slate-300"> · </span>
                    Yard {safeValue(submission.yardId)}
                    <span className="text-slate-300"> · </span>
                    {safeValue(submission.placeOfInspection)}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1 sm:flex-col sm:items-end sm:gap-1.5">
                  <span className="text-[10px] whitespace-nowrap text-slate-400">{formatDateTimeValue(submission.submittedAt)}</span>
                  <span className="flex gap-3">
                    <button
                      type="button"
                      className="text-[10px] font-medium text-brand-600 hover:underline"
                      onClick={() => setPreviewSubmission(submission)}
                    >
                      View
                    </button>
                    <button
                      type="button"
                      className="text-[10px] font-medium text-brand-600 hover:underline disabled:opacity-50"
                      disabled={downloadingBatchId === submission.batchId}
                      onClick={() => handleDownloadSubmission(submission)}
                    >
                      {downloadingBatchId === submission.batchId ? "Downloading…" : "Download PDF"}
                    </button>
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

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
            options={aoNameOptions.length ? aoNameOptions : packerNames}
            onChange={(value) => onUpdatePemsDraft({ aoSignoff: value })}
          />
        </div>
        <PemsInspectionPanel
          className="mt-3"
          pemsDraft={pemsDraft}
          onChange={onUpdatePemsDraft}
        />
        <div className="mt-2 flex flex-row flex-wrap items-start gap-2 sm:gap-3">
          <div className="min-w-0 flex-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">PEMs checker</p>
            <div className="mt-1 grid auto-rows-auto grid-cols-1 items-start divide-y divide-slate-200 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
              {pemsCheckerSections.map((section) => (
                <div key={section.title} className="py-1 first:pt-0 last:pb-0 sm:px-2 sm:py-1.5 sm:first:pl-0 sm:last:pr-0">
                  <div className="space-y-1">
                    <p className="text-[11px] leading-snug break-words">
                      <span className="text-slate-400">{section.title}: </span>
                      <span className={cn(section.ok ? "text-emerald-700" : "text-amber-700")}>
                        {section.ok ? "OK — " : "Needs attention — "}
                        {section.label}
                      </span>
                    </p>
                    {section.lines?.length
                      ? section.lines.map((line, i) => (
                          <p key={i} className="text-[11px] leading-snug break-words text-slate-600">
                            {line}
                          </p>
                        ))
                      : null}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <Button
            type="button"
            onClick={onSubmitBatch}
            disabled={!stagedContainers.length || isSubmitting}
            className="h-11 shrink-0 self-center sm:min-w-[200px]"
          >
            {isSubmitting ? "Submitting PEMs..." : `Submit ${stagedContainers.length} container(s)`}
          </Button>
        </div>
        {submitError ? <p className="mt-2 rounded-lg border border-rose-200 bg-rose-50 px-2 py-1.5 text-xs text-rose-700">{submitError}</p> : null}
      </section>

      <div className="grid gap-5 lg:grid-cols-[minmax(300px,380px)_minmax(0,1fr)]">
        <aside className="space-y-4">
        <section className="rounded-xl border border-slate-200/90 bg-white">
          <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-2 py-2">
            <h3 className="text-xs font-semibold tracking-wide text-slate-600">Containers</h3>
            <span className="tabular-nums text-[10px] text-slate-400" aria-live="polite">
              {stagedContainers.length}/{containers.length}
            </span>
          </div>
          <div className="border-b border-slate-100 px-2 py-1.5">
            <input
              type="search"
              className={cn(inputClass, "h-9 w-full text-xs")}
              value={pemsContainerSearch}
              onChange={(e) => setPemsContainerSearch(e.target.value)}
              placeholder="Search containers…"
              aria-label="Search containers"
            />
            <p className="mt-0.5 text-[10px] text-slate-500">
              Showing {filteredPemsContainers.length} of {containers.length}
            </p>
          </div>
          <div className="border-b border-slate-100 px-2 py-1.5">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="h-7 px-2.5 text-[11px]"
              disabled={!eligibleContainerIds.length}
              onClick={() => (allEligibleStaged ? onClearStage() : onStageAll())}
            >
              {allEligibleStaged ? "Unselect all" : "Select all"}
            </Button>
          </div>
          <div className="max-h-[18rem] space-y-1 overflow-auto px-1.5 pb-1.5 pt-1">
            {!filteredPemsContainers.length ? (
              <div className="rounded-md border border-dashed border-slate-200 bg-slate-50/80 px-2 py-4 text-center text-[11px] text-slate-500">
                No containers match this search.
              </div>
            ) : null}
            {filteredPemsContainers.map((container) => {
              const checked = stagedIds.includes(container.id);
              const stageEligible = !isGppirRecord || container.ecrSubmitted;
              const stageStatus = container.gppirSubmitted
                ? "GPPIR"
                : container.ecrSubmitted
                  ? "ECR"
                  : "No ECR";
              const stageStatusTitle = container.gppirSubmitted
                ? "GPPIR submitted"
                : container.ecrSubmitted
                  ? "ECR submitted"
                  : "Awaiting ECR";
              return (
                <div
                  key={container.id}
                  className={cn(
                    "rounded-md border px-2 py-1.5 text-[11px] leading-snug",
                    selectedContainerId === container.id ? "border-brand/40 bg-brand/5" : "border-slate-200 bg-white"
                  )}
                >
                  <div className="flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      className="h-4 w-4 shrink-0 rounded border-slate-300"
                      checked={checked}
                      disabled={!stageEligible}
                      onChange={() => {
                        if (!stageEligible) return;
                        onToggleStage(container.id);
                      }}
                    />
                    <button
                      type="button"
                      className="min-w-0 flex-1 truncate text-left font-semibold text-slate-800"
                      onClick={() => onSelectContainer(container.id)}
                    >
                      #{container.order} {container.containerNo || "Draft"}
                    </button>
                    <span
                      title={stageStatusTitle}
                      className={cn(
                        "shrink-0 rounded px-1.5 py-0.5 text-[9px] font-semibold leading-none",
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
                  <div className="mt-1 flex min-h-[1.125rem] items-center justify-between gap-1.5 text-[10px] text-slate-500">
                    <span className="min-w-0 truncate">
                      {safeValue(container.sealNo)} · {safeValue(container.releaseNumber)}
                    </span>
                    <button
                      type="button"
                      className="shrink-0 font-medium text-brand-600 hover:text-brand-700 hover:underline"
                      onClick={() => onOpenContainer(container.id)}
                    >
                      Open
                    </button>
                  </div>
                  {isGppirRecord && !container.ecrSubmitted ? (
                    <p className="mt-1 text-[10px] leading-snug text-amber-700">ECR required for GPPIR.</p>
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>
        </aside>

        <section className="space-y-4 min-w-0">
        <div className="rounded-xl border border-slate-200/90 bg-white p-3">
          <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1">
            <h3 className="text-sm font-semibold leading-snug text-slate-900 sm:text-base">
              {isGppirRecord ? `${GPPIR_RECORD_TYPE} (staging)` : `${ECR_RECORD_TYPE} (staging)`}
            </h3>
            <span className="ms-auto shrink-0 text-xs text-slate-500 tabular-nums">Pack #{packRow.id}</span>
          </div>
          {!stagedContainers.length ? (
            <div className="rounded-lg border border-dashed border-slate-300 px-3 py-6 text-center text-sm text-slate-500">
              Stage one or more containers to populate this record.
            </div>
          ) : isGppirRecord ? (
            <div className="space-y-4 rounded-lg border border-slate-200 bg-slate-50/50 p-3 text-sm">
              <div className={stagingGridClass}>
                <PemsStagingFormField label="RFP Number">
                  <input
                    className={stagingInputClass}
                    value={packRow?.rfp || ""}
                    onChange={(e) => setPackField("rfp", e.target.value)}
                    placeholder="RFP reference"
                  />
                </PemsStagingFormField>
                <Field label="Establishment Name" value={safeValue(siteRow?.name)} />
                <Field label="Establishment Number" value={safeValue(siteRow?.yardNo)} />
                <PemsStagingFormField label="Exporter Name">
                  <select className={stagingInputClass} value={exporterCustomerId} onChange={(e) => setExporterCustomerId(e.target.value)}>
                    <option value="">- Select -</option>
                    {customerOptions.map((customer) => (
                      <option key={customer.id} value={customer.id}>
                        {customer.name}
                      </option>
                    ))}
                  </select>
                </PemsStagingFormField>
              </div>
              <div className={stagingGrid6Class}>
                <Field label="Original RFP No." value="N/A" />
                <Field label="Total Quantity" value={gppirTotalWeight.toFixed(4)} />
                <Field label="Unit" value={GPPIR_WEIGHT_UNIT} />
                <Field label="Est. Net Metric Weight" value={`${gppirTotalWeight.toFixed(2)} TONS`} />
                <Field label="Inspection Start Date and Time" value={formatDateTimeValue(pemsDraft.inspectionStart)} />
                <Field label="Inspection End Date and Time" value={formatDateTimeValue(pemsDraft.inspectionEnd)} />
              </div>
              <div className={stagingGrid6Class}>
                <PemsStagingFormField label="Destination Country">
                  <select
                    className={stagingInputClass}
                    value={packRow?.destinationCountry || ""}
                    onChange={(e) => setPackField("destinationCountry", e.target.value)}
                  >
                    <option value="">- Select country -</option>
                    {countryOptions.map((country) => (
                      <option key={country} value={country}>
                        {country}
                      </option>
                    ))}
                  </select>
                </PemsStagingFormField>
                <PemsStagingFormField label="Import Permit No.">
                  {!packRow?.importPermitRequired ? (
                    <div className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[13px] text-slate-700">N/A</div>
                  ) : (
                    <input
                      className={stagingInputClass}
                      value={packRow?.importPermitNumber || ""}
                      onChange={(e) => setPackField("importPermitNumber", e.target.value)}
                      placeholder="Number"
                    />
                  )}
                </PemsStagingFormField>
                <Field label="Flow Path Result" value={gppirFlowResult} />
                <Field label="Flow path Date and Time" value={formatDateTimeValue(pemsDraft.inspectionStart)} />
                <Field label="Outcome type" value="Packaged" />
                <Field label="Expiry Date" value={expiryDate} />
              </div>
              <div className="overflow-x-auto rounded-md border border-slate-200 bg-white">
                <table className="w-full table-fixed text-left text-xs">
                  <thead className="bg-slate-100 text-slate-700">
                    <tr>
                      <th className={cn(gppirTableCompactCol, "font-semibold")}>RFP Line No</th>
                      <th className={cn(gppirTableCellCol, "font-semibold")}>Container Number</th>
                      <th className={cn(gppirTableCellCol, "font-semibold")}>Source</th>
                      <th className={cn(gppirTableCellCol, "font-semibold")}>Commodity</th>
                      <th className={cn(gppirTableCompactCol, "font-semibold")}>Package Number</th>
                      <th className={cn(gppirTableTypeCol, "font-semibold")}>Type</th>
                      <th className={cn(gppirTableNumCol, "font-semibold")}>Weight</th>
                      <th className={cn(gppirTableNarrowCol, "font-semibold")}>Unit</th>
                      <th className={cn(gppirTableNumCol, "font-semibold")}>Line Weight</th>
                      <th className={cn(gppirTableNarrowCol, "font-semibold")}>Unit</th>
                      <th className={cn(gppirTableCompactCol, "font-semibold")}>Sampled</th>
                      <th className={cn(gppirTableResultCol, "font-semibold")}>Result</th>
                      <th className={cn(gppirTableCellCol, "font-semibold")}>Inspection AO Name</th>
                      <th className={cn(gppirTableRemarksCol, "font-semibold")}>Remarks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stagedContainers.map((container) => {
                      const containerWeight = toRoundedNumber(container.nettWeight);
                      return (
                      <tr key={container.id} className="border-t border-slate-100 text-slate-700">
                        <td className={cn(gppirTableCompactCol, "text-center")}>1</td>
                        <td className={cn(gppirTableCellCol, "truncate font-medium")}>{safeValue(container.containerNo)}</td>
                        <td className={cn(gppirTableCellCol, "truncate")}>{safeValue(container.grainLocation || container.stockBayId)}</td>
                        <td className={cn(gppirTableCellCol, "truncate")}>{safeValue(packRow.commodity)}</td>
                        <td className={cn(gppirTableCompactCol, "text-center")}>1</td>
                        <td className={gppirTableTypeCol}>CONTAINER</td>
                        <td className={gppirTableNumCol}>{containerWeight.toFixed(2)}</td>
                        <td className={gppirTableNarrowCol}>{GPPIR_WEIGHT_UNIT}</td>
                        <td className={gppirTableNumCol}>{containerWeight.toFixed(4)}</td>
                        <td className={gppirTableNarrowCol}>{GPPIR_WEIGHT_UNIT}</td>
                        <td className={cn(gppirTableCompactCol, "text-center")}>N/A</td>
                        <td className={gppirTableResultCol}>
                          {container.grainInspection === "Passed" ? "Passed" : container.grainInspection === "Failed" ? "Failed" : "Pending"}
                        </td>
                        <td className={cn(gppirTableCellCol, "truncate")}>{safeValue(pemsDraft.aoSignoff)}</td>
                        <td className={gppirTableRemarksCol}>
                          <textarea
                            className={cn(stagingInputClass, "min-h-[2.5rem] resize-y")}
                            value={getContainerInspectionRemark(container)}
                            onChange={(e) => onUpdateContainer?.(container.id, containerInspectionRemarkPatch(e.target.value))}
                            placeholder="Remarks"
                            rows={2}
                          />
                        </td>
                      </tr>
                    );
                    })}
                  </tbody>
                </table>
              </div>
              <div className={stagingGridClass}>
                <Field label="Submitted AO Name" value={safeValue(pemsDraft.aoSignoff)} />
                <Field label="Submitted AO Number" value={safeValue(selectedAoNumber)} />
              </div>
              <div className={stagingGrid3Class}>
                <PemsStagingFormField label="Additional Declaration">
                  <select
                    className={stagingInputClass}
                    value={packRow?.rfpAdditionalDeclarationRequired ? "yes" : "no"}
                    onChange={(e) => setPackField("rfpAdditionalDeclarationRequired", e.target.value === "yes")}
                  >
                    <option value="no">N/A</option>
                    <option value="yes">Yes</option>
                  </select>
                </PemsStagingFormField>
                <Field label="Total Passed" value={gppirPassedWeight.toFixed(4)} />
                <Field label="Unit" value={GPPIR_WEIGHT_UNIT} />
              </div>
              <div className={stagingGrid3Class}>
                <PemsStagingFormField label="Comments">
                  <input
                    className={stagingInputClass}
                    value={pemsDraft.ecrComments ?? ""}
                    onChange={(e) => onUpdatePemsDraft?.({ ecrComments: e.target.value })}
                    placeholder="N/A"
                  />
                </PemsStagingFormField>
                <Field label="Total Failed" value={gppirFailedWeight.toFixed(4)} />
                <Field label="Unit" value={GPPIR_WEIGHT_UNIT} />
              </div>
            </div>
          ) : (
            <div className="space-y-4 rounded-lg border border-slate-200 bg-slate-50/50 p-3 text-sm">
              <div className={stagingGridClass}>
                <Field label="Container Yard Id" value={safeValue(siteRow?.yardNo)} />
                <Field label="Place of Inspection" value={safeValue(siteRow?.name)} />
                <Field label="Inspection Start Date and Time" value={formatDateTimeValue(pemsDraft.inspectionStart)} />
                <Field label="Inspection End Date and Time" value={formatDateTimeValue(pemsDraft.inspectionEnd)} />
              </div>
              <div className="overflow-x-auto rounded-md border border-slate-200 bg-white">
                <table className="w-full table-fixed text-left text-xs [&_th]:leading-snug [&_td]:leading-snug">
                  <thead className="bg-slate-100 text-slate-700">
                    <tr>
                      <th className={cn(gppirTableContainerCol, "font-semibold")}>Container Number</th>
                      <th className={cn(gppirTableInspectionLevelCol, "font-semibold")}>Inspection Level</th>
                      <th className={cn(gppirTableRfpCol, "font-semibold")}>RFP Number</th>
                      <th className={cn(gppirTableResultCol, "font-semibold")}>Result</th>
                      <th className={cn(gppirTableSealCol, "font-semibold")}>Seal Number</th>
                      <th className={cn(gppirTableExpiryDateCol, "font-semibold")}>Expiry Date</th>
                      <th className={cn(gppirTableInspectionAoCol, "font-semibold")}>Inspection AO Name</th>
                      <th className={cn(gppirTableRemarksCol, "font-semibold")}>Remarks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stagedContainers.map((container) => (
                      <tr key={container.id} className="border-t border-slate-100 text-slate-700">
                        <td className={cn(gppirTableContainerCol, "truncate font-medium")}>{safeValue(container.containerNo)}</td>
                        <td className={gppirTableInspectionLevelCol}>Consumable</td>
                        <td className={cn(gppirTableRfpCol, "truncate")}>{safeValue(packRfpText || container.releaseNumber)}</td>
                        <td className={gppirTableResultCol}>{container.emptyInspection === "Passed" ? "Pass" : container.emptyInspection === "Failed" ? "Fail" : "Pending"}</td>
                        <td className={cn(gppirTableSealCol, "truncate")}>{safeValue(container.sealNo)}</td>
                        <td className={gppirTableExpiryDateCol}>{expiryDate}</td>
                        <td className={cn(gppirTableInspectionAoCol, "truncate")}>{safeValue(pemsDraft.aoSignoff)}</td>
                        <td className={gppirTableRemarksCol}>
                          <textarea
                            className={cn(stagingInputClass, "min-h-[2.5rem] resize-y")}
                            value={getContainerInspectionRemark(container)}
                            onChange={(e) => onUpdateContainer?.(container.id, containerInspectionRemarkPatch(e.target.value))}
                            placeholder="Remarks"
                            rows={2}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Submitted AO Name" value={safeValue(pemsDraft.aoSignoff)} />
                <Field label="Submitted AO Number" value={safeValue(selectedAoNumber)} />
              </div>
              <PemsStagingFormField label="Comments">
                <input
                  className={stagingInputClass}
                  value={pemsDraft.ecrComments ?? ""}
                  onChange={(e) => onUpdatePemsDraft?.({ ecrComments: e.target.value })}
                  placeholder="N/A"
                  required
                />
              </PemsStagingFormField>
            </div>
          )}
        </div>
        </section>
      </div>
      <PemsSubmissionPreviewModal submission={previewSubmission} onClose={() => setPreviewSubmission(null)} />
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

