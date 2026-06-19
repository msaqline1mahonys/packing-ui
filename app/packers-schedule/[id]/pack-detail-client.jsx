"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Eye, X } from "lucide-react";
import ClutchSelect from "@/components/custom/ClutchSelect";

import BulkContainerImportDialog from "@/components/packing-schedule/bulk-container-import-dialog";
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
import {
  containerStage,
  loadWorkDrafts,
  saveWorkDrafts,
  syncWorkDrafts,
  toInputNumber,
  toRoundedNumber,
} from "@/lib/packers-work-store";
import { resolvePackRfpRef } from "@/lib/pems-rfp-display";
import { stageBadgeClass } from "@/lib/packing-container-ui";
import {
  attachPemsSubmissionSnapshot,
  GPPIR_RECORD_TYPE,
  ECR_RECORD_TYPE,
} from "@/lib/pems-staging-snapshot";
import PemsTab, { PEMS_TAB_INPUT_CLASS } from "@/components/pems/pems-tab";
import {
  getContainerInspectionRemark,
} from "@/lib/pems-container-fields";
import { ensureReleaseLineOnPack, normalizeReferenceReleaseOption } from "@/lib/container-bulk-import";
import {
  applyContainerPatch,
  getCompletionMissingChecks,
  getOutloadBlockers,
  isContainerOutloadComplete,
  validateContainerForSave,
} from "@/lib/packers-container-validation";
import { updateContainer, updatePrepackChecks, packAssignedPackerOptions } from "@/lib/api/packing";
import { buildContainerApiRecord } from "@/lib/pack-container-payload";
import { fetchPack } from "@/lib/pack-schedule-store";
import { fetchFumigantsNormalized } from "@/lib/api/fumigation";
import { loadFumigants, resolvePackFumigantDisplay } from "@/lib/fumigation-store";
import { useAllPackLookups } from "@/lib/hooks/use-pack-form-data";
import { usePemsInspectionRemarksQuery } from "@/lib/hooks/use-reference-data-queries";
import { useTestsCatalog } from "@/lib/hooks/use-tests-catalog";
import TestResultsSection from "@/components/quality-tests/TestResultsSection";
import { readSiteRows } from "@/lib/site-data";
import { cn } from "@/lib/utils";
import { numberInputProps } from "@/lib/number-input";
import { createPraActionHandlers } from "@/components/pems/container-form-actions";
import ContainerFormSections from "@/components/pems/container-form-sections";
import { hasPermission } from "@/lib/use-user-permissions";
import { isImportPack } from "@/lib/pack-import";

const customerOptions = CUSTOMER_CONTACT_ROWS;
const countryOptions = REFERENCE_COUNTRIES_ROWS.map((row) => row.countryName);
const YES_NO_OPTIONS = ["No", "Yes"];
const INSPECTION_OPTIONS = ["Pending", "Passed", "Failed"];
const PRA_STATUS_OPTIONS = ["Pending", "Accepted", "Rejected", "Error"];
const PRA_TEMPLATE_OPTIONS = ["Original", "Resubmit", "Correction"];
const PACK_DETAIL_TABS = ["Packing", "PEMs"];
const PACK_CHECK_FIELDS = [
  { key: "importDetailsChecked", label: "Import details checked", short: "Import details" },
  { key: "sampleRequirementsChecked", label: "Sample requirements checked", short: "Samples" },
  { key: "rfpDetailsChecked", label: "RFP details checked", short: "RFP" },
  { key: "micorRequirementsChecked", label: "MICOR requirements checked", short: "MICOR" },
];
const IMPORT_PACK_CHECK_FIELDS = PACK_CHECK_FIELDS.filter(
  (field) => field.key === "importDetailsChecked" || field.key === "sampleRequirementsChecked"
);

const inputClass = PEMS_TAB_INPUT_CLASS;
const sectionCardClass = "overflow-hidden rounded-xl border border-slate-200/90 bg-white";
const sectionHeaderClass = "border-b border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-800";

function safeValue(value) {
  if (value == null || String(value).trim() === "") return "—";
  return String(value);
}

function UnsavedChangesBadge({ className }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold text-amber-800 ring-1 ring-amber-300",
        className
      )}
    >
      <AlertCircle className="size-3 shrink-0" aria-hidden />
      Unsaved changes
    </span>
  );
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

function formatYesNo(value) {
  if (value === true) return "Yes";
  if (value === false) return "No";
  return "—";
}

function collectPackAttachments(packRow) {
  if (!packRow) return [];
  const rows = [];
  const add = (files, group) => {
    normalizePackAttachmentFiles(files).forEach((item) => {
      rows.push({ ...item, group, listKey: `${group}-${item.id}` });
    });
  };
  if (isImportPack(packRow)) {
    add(packRow.importPermitFiles, "Permit");
    add(packRow.importOrderFiles, "Import order");
    add(packRow.importPackingListFiles, "Packing list");
    add(packRow.importAdditionalFiles, "Additional");
    add(packRow.importContainerListFiles, "Container list");
    return rows;
  }
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
  if (u.startsWith("data:")) return true;
  return false;
}

/** Absolute URL for iframe / new tab (client). */
function resolvePackAttachmentViewUrl(item) {
  const u = typeof item?.url === "string" ? item.url.trim() : "";
  if (!u) return null;
  if (/^https?:\/\//i.test(u)) return u;
  if (u.startsWith("data:")) return u;
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
  "Import order": { pill: "bg-teal-500/10 text-teal-900 ring-teal-500/20" },
  "Packing list": { pill: "bg-cyan-500/10 text-cyan-900 ring-cyan-500/20" },
  Additional: { pill: "bg-indigo-500/10 text-indigo-900 ring-indigo-500/20" },
  "Container list": { pill: "bg-fuchsia-500/10 text-fuchsia-900 ring-fuchsia-500/20" },
};

function attachmentGroupStyles(group) {
  return ATTACHMENT_GROUP_STYLES[group] || ATTACHMENT_GROUP_STYLES.Instruction;
}

export default function PackDetailClient({ packId }) {
  const router = useRouter();

  // All reference/lookup data via TanStack Query — globally cached, auto-refetches
  // on window focus so switching back from a tab where reference data was updated
  // (packers, customers, ISO codes, etc.) silently picks up the new options.
  const lookups = useAllPackLookups();
  const testsCatalog = useTestsCatalog();
  const { data: pemsInspectionRemarks = { ecInspectionRemarks: [], goodsInspectionRemarks: [] } } =
    usePemsInspectionRemarksQuery();

  const [activeTab, setActiveTab] = useState("Packing");
  const [packRow, setPackRow] = useState(null);
  const [workByPack, setWorkByPack] = useState({});
  const [selectedContainerId, setSelectedContainerId] = useState(null);
  const [containerSearch, setContainerSearch] = useState("");
  const [isSubmittingPems, setIsSubmittingPems] = useState(false);
  const [pemsSubmitError, setPemsSubmitError] = useState("");
  const [isSavingContainer, setIsSavingContainer] = useState(false);
  const [containerSaveStatus, setContainerSaveStatus] = useState(null);
  const [containerSaveError, setContainerSaveError] = useState("");
  const containerValidationTimerRef = useRef(null);

  const showContainerValidationError = useCallback((message) => {
    if (containerValidationTimerRef.current) {
      clearTimeout(containerValidationTimerRef.current);
      containerValidationTimerRef.current = null;
    }
    setContainerSaveError(message);
    setContainerSaveStatus("error");
  }, []);

  const clearContainerValidationFeedback = useCallback(() => {
    if (containerValidationTimerRef.current) {
      clearTimeout(containerValidationTimerRef.current);
      containerValidationTimerRef.current = null;
    }
    setContainerSaveError("");
    setContainerSaveStatus(null);
  }, []);

  const scheduleContainerFeedbackClear = useCallback((delayMs = 5000) => {
    if (containerValidationTimerRef.current) clearTimeout(containerValidationTimerRef.current);
    containerValidationTimerRef.current = setTimeout(() => {
      clearContainerValidationFeedback();
      containerValidationTimerRef.current = null;
    }, delayMs);
  }, [clearContainerValidationFeedback]);
  const [dirtyContainerIds, setDirtyContainerIds] = useState(() => new Set());

  const markContainerDirty = useCallback((containerId) => {
    if (!containerId) return;
    setDirtyContainerIds((prev) => {
      if (prev.has(containerId)) return prev;
      return new Set(prev).add(containerId);
    });
  }, []);

  const markContainerClean = useCallback((containerId) => {
    if (!containerId) return;
    setDirtyContainerIds((prev) => {
      if (!prev.has(containerId)) return prev;
      const next = new Set(prev);
      next.delete(containerId);
      return next;
    });
  }, []);

  const clearDirtyContainers = useCallback(() => {
    setDirtyContainerIds(new Set());
  }, []);
  const [bulkImportOpen, setBulkImportOpen] = useState(false);
  const [bulkImportApplying, setBulkImportApplying] = useState(false);
  const [bulkImportProgress, setBulkImportProgress] = useState("");
  const [bulkImportError, setBulkImportError] = useState("");
  const [filePreview, setFilePreview] = useState(null);
  const previewRevokeRef = useRef(null);


  const { packerNames, packerSelectOptions: allPackerSelectOptions } = lookups;
  const packPackerSelectOptions = useMemo(
    () => packAssignedPackerOptions(packRow, lookups.referencePackers ?? lookups.packers ?? []),
    [packRow, lookups.referencePackers, lookups.packers]
  );
  const [fumigants, setFumigants] = useState(() => loadFumigants());
  useEffect(() => {
    fetchFumigantsNormalized().then(setFumigants).catch(() => {});
  }, []);
  const fumigantDisplay = useMemo(() => {
    const label = resolvePackFumigantDisplay(packRow, fumigants);
    return label || "—";
  }, [packRow, fumigants]);
  const packReleases = useMemo(() => {
    const details = packRow?.releaseDetails;
    const releases = packRow?.releases;
    if (Array.isArray(details) && details.length) return details;
    if (Array.isArray(releases) && releases.length) return releases;
    return [];
  }, [packRow?.releaseDetails, packRow?.releases]);
  const referenceReleaseOptions = useMemo(
    () => (lookups.releases || []).map(normalizeReferenceReleaseOption).filter((r) => r.releaseRef),
    [lookups.releases]
  );
  const containerParkOptions = useMemo(() => {
    const allParks = (lookups.containerParks || []).map((p) => ({ id: p.id, name: p.name ?? p.containerParkName ?? "" }));
    // Limit to parks actually set on this pack's releases
    const releaseParks = new Set(
      packReleases.map((r) => String(r.emptyContainerParkId ?? "")).filter(Boolean)
    );
    return releaseParks.size > 0 ? allParks.filter((p) => releaseParks.has(String(p.id))) : allParks;
  }, [lookups.containerParks, packReleases]);
  const transporterLookupOptions = useMemo(
    () => (lookups.transporters || []).map((t) => ({ id: t.id, name: t.name ?? "" })),
    [lookups.transporters]
  );
  const stockLocationNames = useMemo(
    () => (lookups.stockLocations || []).map((s) => s.name).filter(Boolean),
    [lookups.stockLocations]
  );
  const isoOptions = useMemo(
    () => (lookups.containerCodes || []).map((c) => c.iso_code ?? c.isoCode).filter(Boolean),
    [lookups.containerCodes]
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
    fetchPack(packId)
      .then((row) => {
        setPackRow(row || null);
        if (row) setWorkByPack((prev) => syncWorkDrafts([row], { ...loadWorkDrafts(), ...prev }, lookups));
      })
      .catch(() => {});
    // lookups intentionally excluded — we only want this to fire on packId change.
    // The syncWorkDrafts call uses the latest lookups snapshot at mount time;
    // subsequent lookup updates (e.g. new packers) are reflected reactively via
    // the TanStack Query cache without re-fetching the pack.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [packId]);

  useEffect(() => {
    return () => {
      if (containerValidationTimerRef.current) clearTimeout(containerValidationTimerRef.current);
    };
  }, []);

  useEffect(() => {
    saveWorkDrafts(workByPack);
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
  const isDirty = selectedContainerId != null && dirtyContainerIds.has(selectedContainerId);

  const packCommodity = useMemo(() => {
    if (!packRow?.commodityId) return null;
    return (lookups.commodities || []).find((c) => String(c.id) === String(packRow.commodityId)) ?? null;
  }, [packRow, lookups.commodities]);

  const packCommodityTypeId = useMemo(
    () => packRow?.commodityTypeId ?? packCommodity?.commodityTypeId ?? packCommodity?.commodity_type_id ?? null,
    [packRow?.commodityTypeId, packCommodity]
  );

  const allowedCommodityIds = useMemo(() => {
    if (!packRow?.commodityId) return null;
    return new Set([packRow.commodityId]);
  }, [packRow?.commodityId]);
  const stagedContainers = useMemo(
    () => containerRows.filter((container) => pemsDraft.stagedContainerIds.includes(container.id)),
    [containerRows, pemsDraft.stagedContainerIds]
  );
  const selectedAoNumber = useMemo(() => aoNumberByName.get(String(pemsDraft.aoSignoff || "").trim()) || "", [aoNumberByName, pemsDraft.aoSignoff]);

  const packSummary = useMemo(() => {
    if (!packRow || !selectedPackDraft) return { total: 0, submitted: 0, complete: 0, progress: 0 };
    const isImport = isImportPack(packRow);
    const total = selectedPackDraft.containers.length;
    const submitted = isImport
      ? selectedPackDraft.containers.filter((container) => container.outLoaded === "Yes").length
      : selectedPackDraft.containers.filter((container) => container.praSubmitted).length;
    const complete = selectedPackDraft.containers.filter((container) => isContainerOutloadComplete(container, { isImport })).length;
    const progress = complete;
    return { total, submitted, complete, progress, isImport };
  }, [packRow, selectedPackDraft]);

  // These must be declared before any early return to satisfy Rules of Hooks
  const packAttachments = useMemo(() => (packRow ? collectPackAttachments(packRow) : []), [packRow]);
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
    const isImport = isImportPack(packRow);
    updateSelectedPack((current) => ({
      ...current,
      containers: current.containers.map((container) => {
        if (container.id !== containerId) return container;
        const next = typeof patch === "function" ? patch(container) : { ...container, ...patch };
        const tare = next.tare != null && next.tare !== "" ? toRoundedNumber(next.tare) : null;
        const grossWeight = next.grossWeight != null && next.grossWeight !== "" ? toRoundedNumber(next.grossWeight) : null;
        const nettWeight = tare != null && grossWeight != null ? toRoundedNumber(Math.max(grossWeight - tare, 0)) : null;
        const normalized = { ...next, tare, grossWeight, nettWeight };
        return { ...normalized, status: containerStage(normalized, isImport) };
      }),
    }));
  }

  function updateSelectedContainer(patch) {
    if (!packRow || !selectedContainer) return;
    const isImport = isImportPack(packRow);
    const result = applyContainerPatch(selectedContainer, patch, { isImport });
    if (!result.ok) {
      showContainerValidationError(result.error);
      return;
    }
    clearContainerValidationFeedback();
    updateContainerById(selectedContainer.id, patch);
    markContainerDirty(selectedContainer.id);
  }

  const selectedContainerActions = useMemo(() => {
    if (!selectedContainer) return null;
    return createPraActionHandlers({
      container: selectedContainer,
      applyPatch: updateSelectedContainer,
      fallbackPacker: packerNames[0] || "",
      onBlocked: showContainerValidationError,
      isImport: isImportPack(packRow),
    });
  }, [selectedContainer, packRow, packerNames, showContainerValidationError]);

  function persistPackRowToStore(nextRow, workDraft) {
    const containers = (workDraft?.containers || []).map((container) => buildContainerApiRecord(container, nextRow));
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
    if (!packRow?.id) return;
    const apiFieldMap = {
      importDetailsChecked: "importDetailsChecked",
      sampleRequirementsChecked: "sampleRequirementsChecked",
      rfpDetailsChecked: "rfpDetailsChecked",
      micorRequirementsChecked: "micorRequirementsChecked",
    };
    const apiField = apiFieldMap[checkKey];
    if (!apiField) return;
    updatePrepackChecks(packRow.id, { [apiField]: value })
      .then((updated) => {
        if (!updated) return;
        setPackRow((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            importDetailsChecked: updated.importDetailsChecked,
            sampleRequirementsChecked: updated.sampleRequirementsChecked,
            rfpDetailsChecked: updated.rfpDetailsChecked,
            micorRequirementsChecked: updated.micorRequirementsChecked,
          };
        });
      })
      .catch(() => {});
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
      if (row) {
        // Pass current lookups so refreshed containers resolve park/transporter
        // names from the latest TanStack Query cache.
        setWorkByPack((prev) => syncWorkDrafts([row], prev, lookups));
        clearDirtyContainers();
      }
    }).catch(() => {});
  }

  async function saveSelectedContainer() {
    if (!packRow || !selectedContainer) return;

    const saveError = validateContainerForSave(selectedContainer, { isImport: isImportPack(packRow) });
    if (saveError) {
      showContainerValidationError(saveError);
      return;
    }

    setIsSavingContainer(true);
    clearContainerValidationFeedback();
    try {
      // Strip id, packId, order — read-only on this endpoint
      const { id: _id, packId: _packId, order: _order, ...payload } = buildContainerApiRecord(selectedContainer, packRow);
      const updated = await updateContainer(packRow.id, selectedContainer.id, payload);
      // Merge server response (includes server-computed nettWeight) back into local state
      if (updated?.id) {
        updateContainerById(updated.id, updated);
      }
      setContainerSaveStatus("saved");
      markContainerClean(selectedContainer.id);
      scheduleContainerFeedbackClear();
    } catch (err) {
      showContainerValidationError(err?.message || "Save failed — check connection.");
      setContainerSaveStatus(err?.status === 404 ? "not-found" : "error");
    } finally {
      setIsSavingContainer(false);
    }
  }

  async function handleBulkImportApply(updatedContainers, appliedRows, logistics) {
    if (!packRow || !appliedRows?.length) return;

    setBulkImportApplying(true);
    setBulkImportError("");
    setBulkImportProgress("");

    updateSelectedPack((current) => ({
      ...current,
      containers: current.containers.map((container) => {
        const next = updatedContainers.find((row) => row.id === container.id);
        if (!next) return container;
        const tare = next.tare != null && next.tare !== "" ? toRoundedNumber(next.tare) : null;
        const grossWeight = next.grossWeight != null && next.grossWeight !== "" ? toRoundedNumber(next.grossWeight) : null;
        const nettWeight =
          tare != null && grossWeight != null ? toRoundedNumber(Math.max(grossWeight - tare, 0)) : null;
        const normalized = { ...container, ...next, tare, grossWeight, nettWeight };
        return { ...normalized, status: containerStage(normalized, isImportPack(packRow)) };
      }),
    }));

    const changedIds = new Set(appliedRows.map((row) => row.targetSlotId));
    const toSave = updatedContainers.filter((container) => changedIds.has(container.id));
    const failures = [];

    for (let index = 0; index < toSave.length; index += 1) {
      const container = toSave[index];
      setBulkImportProgress(`Saving ${index + 1} of ${toSave.length}…`);
      try {
        const { id: _id, packId: _packId, order: _order, ...payload } = buildContainerApiRecord(container, packRow);
        await updateContainer(packRow.id, container.id, payload);
      } catch (err) {
        failures.push({
          order: container.order,
          message: err?.message || "Save failed",
        });
      }
    }

    setBulkImportApplying(false);
    setBulkImportProgress("");

    if (failures.length) {
      setBulkImportError(
        `${failures.length} container${failures.length === 1 ? "" : "s"} failed to save: ${failures
          .map((row) => `#${row.order} (${row.message})`)
          .join("; ")}`
      );
      refreshPack();
      return;
    }

    // Add the release/park/transporter combo used for this import to the pack if it's
    // not already one of the pack's release lines. updatePackRow persists the pack.
    const currentReleases = Array.isArray(packRow.releases)
      ? packRow.releases
      : Array.isArray(packRow.releaseDetails)
        ? packRow.releaseDetails
        : [];
    const nextReleases = ensureReleaseLineOnPack(currentReleases, logistics);
    if (nextReleases !== currentReleases) {
      updatePackRow({ releases: nextReleases });
    }

    setBulkImportOpen(false);
    clearDirtyContainers();
    refreshPack();
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

  const permitNumberLine = String(packRow.importPermitNumber || "").trim();
  const permitDateLine = packRow.importPermitDate ? formatDateDisplay(packRow.importPermitDate) : "";
  const permitMetaLine = [permitNumberLine, permitDateLine].filter(Boolean).join(" · ");
  const packingNoteText = String(packRow.jobNotes || packRow.packingNote || "").trim();
  const importPackNotesText = String(packRow.importPackNotes || "").trim();
  const isImportJob = isImportPack(packRow);
  const packingNoteDisplayText = isImportJob ? importPackNotesText || packingNoteText : packingNoteText;
  const hasPackingNote = Boolean(packingNoteDisplayText);
  const packWarningText =
    packRow.packWarningRequired && String(packRow.packWarning || "").trim()
      ? String(packRow.packWarning).trim()
      : "";
  const packCheckFields = isImportJob ? IMPORT_PACK_CHECK_FIELDS : PACK_CHECK_FIELDS;
  const packDetailTabs = isImportJob ? ["Packing"] : PACK_DETAIL_TABS;
  const missingChecks = selectedContainer ? getCompletionMissingChecks(selectedContainer, { isImport: isImportJob }) : [];
  const outloadBlockers = selectedContainer ? getOutloadBlockers(selectedContainer, { isImport: isImportJob }) : [];
  const packChecks = selectedPackDraft?.packChecks || {};
  const packChecksCompleteCount = packCheckFields.filter((field) => Boolean(packChecks[field.key])).length;
  const allPackChecksComplete = packChecksCompleteCount === packCheckFields.length;
  const packDisplayRef = String(packRow.jobReference || "").trim() || String(packRow.id);

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-slate-200/90 bg-white p-4 md:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 flex-wrap items-center gap-y-1">
            <h2 className="shrink-0 text-lg font-semibold text-slate-900">Pack #{packDisplayRef}</h2>
            <span className="min-w-0 border-l border-slate-200 pl-3 text-sm text-slate-600 sm:ml-1">
              {isImportJob ? (
                <>
                  In-loaded {packSummary.submitted}/{packRow.containersRequired} · Complete {packSummary.complete} · Nett total{" "}
                  {aggregateNettWeight.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MT
                </>
              ) : (
                <>
                  PRA {packSummary.submitted}/{packRow.containersRequired} · Complete {packSummary.complete} · Nett total{" "}
                  {aggregateNettWeight.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MT
                </>
              )}
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
          {isImportJob ? (
            <>
              <Field label="Unloading location" value={safeValue(packRow.unloadingLocation)} />
              <Field label="Import directions" value={formatYesNo(packRow.importDirectionsReceived)} />
              <Field label="Direction code" value={safeValue(packRow.importDirectionCode)} />
            </>
          ) : (
            <>
              <Field label="Releases" value={releaseRefsSummary} />
              <Field label="Cut-off" value={formatDateTimeValue(packRow.vesselCutoffDate)} />
              <Field
                label="Fumigation"
                value={safeValue(fumigantDisplay)}
                labelClassName="text-purple-700"
                valueClassName="border-purple-200 bg-purple-50 text-purple-900"
              />
            </>
          )}
        </div>
        {isImportJob ? (
          <div className="mt-3 grid gap-3 text-xs sm:grid-cols-2 lg:grid-cols-4">
            <Field label="EDO received" value={formatYesNo(packRow.edoReceived)} />
            <Field label="Date collected" value={formatDateTimeValue(packRow.dateCollected)} />
            <Field label="Free days" value={packRow.freeDays != null && packRow.freeDays !== "" ? String(packRow.freeDays) : "—"} />
            <Field label="Dehire by" value={formatDateTimeValue(packRow.dehireByDate)} />
            <Field label="Final dehire" value={formatDateTimeValue(packRow.finalDehireDate)} />
            <Field label="Vessel" value={safeValue(packRow.vessel)} />
            <Field label="ETD" value={formatDateDisplay(packRow.etd)} />
            <Field label="Releases" value={releaseRefsSummary} />
          </div>
        ) : null}
        <div className="mt-3 grid gap-2 md:grid-cols-3">
          <PriorityField label="Commodity Grade" value={safeValue(packRow.commodity)} />
          <PriorityField label="Weight per container" value={weightPerContainer == null ? "—" : `${weightPerContainer} MT`} />
          <PriorityField label="Job Ref" value={safeValue(packRow.jobReference)} />
        </div>
        {hasPackingNote || packWarningText ? (
        <div className="mt-3 overflow-hidden rounded-lg border border-amber-300/90 bg-gradient-to-r from-amber-50 via-amber-50 to-amber-100/60 shadow-sm shadow-amber-200/30">
          {hasPackingNote ? (
            <>
              <div className="border-b border-amber-200/70 bg-amber-100/50 px-3 py-1.5">
                <p className="text-[10px] font-bold uppercase tracking-wide text-amber-900">{isImportJob ? "Import pack notes" : "Packing note"}</p>
              </div>
              <p className="whitespace-pre-wrap px-3 py-2.5 text-sm font-medium leading-snug text-amber-950">
                {packingNoteDisplayText}
              </p>
            </>
          ) : null}
          {packWarningText ? (
            <>
              <div className={cn("border-t border-rose-300/70 bg-rose-100/60 px-3 py-1.5", !hasPackingNote && "border-t-0")}>
                <p className="text-[10px] font-bold uppercase tracking-wide text-rose-900">Pack warning</p>
              </div>
              <p className="whitespace-pre-wrap px-3 py-2.5 text-sm font-medium leading-snug text-rose-950">
                {packWarningText}
              </p>
            </>
          ) : null}
        </div>
        ) : null}
        <div
          id="pack-prepack-review"
          className="mt-3 overflow-hidden rounded-xl border border-slate-200/90 bg-gradient-to-b from-white via-slate-50/40 to-slate-50/80 shadow-[0_1px_2px_rgba(15,23,42,0.05)]"
        >
          <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-200/80 bg-white/90 px-2.5 py-2">
            <div className="min-w-0 flex-1">
              <h3 className="text-[13px] font-semibold leading-tight tracking-tight text-slate-900">
                {isImportJob ? "Import documents and pre-pack checks" : "Pack attachments and pre-pack checks"}
              </h3>
            </div>
            <span
              className={cn(
                "inline-flex shrink-0 items-center self-start rounded-full px-1.5 py-0.5 text-[9px] font-semibold ring-1",
                allPackChecksComplete ? "bg-emerald-100 text-emerald-900 ring-emerald-200/90" : "bg-amber-100 text-amber-900 ring-amber-200/80"
              )}
            >
              Checks {packChecksCompleteCount}/{packCheckFields.length}
            </span>
          </div>

          {/* Pack documents */}
          <div className="px-2.5 pb-2.5 pt-2">
            {(isImportJob || packRow.importPermitRequired || permitMetaLine) && (
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
                  {isImportJob
                    ? "Attach import orders, packing lists, container lists, or permits from the pack schedule. You can still complete the checks below if those documents are managed outside the system."
                    : "Attach permits, RFPs, packing instructions, or declarations from the pack schedule. You can still complete the checks below if those documents are managed outside the system."}
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
            <div className={cn("grid gap-1.5", isImportJob ? "sm:grid-cols-2" : "sm:grid-cols-2 lg:grid-cols-4")} role="group" aria-label="Pre-pack checks">
              {packCheckFields.map((field) => {
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
          {packDetailTabs.map((tab) => (
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
          {!isImportJob && activeTab === "PEMs" ? (
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
                Pack progress {packSummary.progress}/{packRow.containersRequired}
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
                const stage = containerStage(container, isImportJob);
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
                      {dirtyContainerIds.has(container.id) ? (
                        <UnsavedChangesBadge className="ms-auto" />
                      ) : (
                        <span className={cn("ms-auto rounded-full px-2.5 py-1 text-xs font-semibold", stageBadgeClass(stage))}>
                          {stage}
                        </span>
                      )}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      Seal {safeValue(container.sealNo)} · Net {toInputNumber(container.nettWeight)} MT
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
          {!isImportJob ? (
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
          ) : null}
          <section className="rounded-xl border border-slate-200/90 bg-white p-3">
            <div className="mb-1 flex items-center justify-between gap-2">
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Container list</label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 px-2 text-[11px]"
                disabled={!packReleases.some((r) => r.releaseRef) && !referenceReleaseOptions.length}
                onClick={() => {
                  setBulkImportError("");
                  setBulkImportOpen(true);
                }}
              >
                Bulk import
              </Button>
            </div>
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
                    stageBadgeClass(containerStage(selectedContainer, isImportJob))
                  )}
                >
                  {containerStage(selectedContainer, isImportJob)}
                </span>
                <div className="ms-auto flex shrink-0 items-center gap-2">
                  {isDirty ? (
                    <UnsavedChangesBadge />
                  ) : containerSaveStatus === "saved" ? (
                    <span className="text-[11px] font-medium text-emerald-700">Saved</span>
                  ) : null}
                  <Button
                    type="button"
                    size="sm"
                    className="h-8 px-4 text-sm"
                    disabled={isSavingContainer}
                    onClick={saveSelectedContainer}
                  >
                    {isSavingContainer ? "Saving…" : "Save"}
                  </Button>
                </div>
              </div>

              {containerSaveStatus === "not-found" ? (
                <p className="border-t border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">
                  Container not found — use Refresh to reload the pack.
                </p>
              ) : containerSaveStatus === "error" && containerSaveError ? (
                <p className="border-t border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">
                  {containerSaveError}
                </p>
              ) : null}

              {outloadBlockers.length ? (
                <div className="space-y-1 border-t border-amber-200 bg-amber-50 px-3 py-2">
                  {outloadBlockers.map((message) => (
                    <p key={message} className="text-sm font-medium text-amber-900">
                      {message}
                    </p>
                  ))}
                </div>
              ) : null}

              {missingChecks.length === 0 ? (
                <div className="border-t border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                  All mandatory checks complete for this container.
                </div>
              ) : selectedContainer.outLoaded === "Yes" ? (
                <div className="border-t border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900">
                  Missing checks before completion: {missingChecks.join(", ")}.
                </div>
              ) : null}

              {hasPackingNote || packWarningText ? (
              <div className="border-t border-amber-300/80 bg-gradient-to-r from-amber-50 via-amber-50/95 to-amber-100/70 px-3 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]">
                {hasPackingNote ? (
                  <div className="flex flex-wrap items-start gap-2">
                    <span className="shrink-0 rounded-md bg-amber-200/70 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-950 ring-1 ring-amber-300/60">
                      Packing note
                    </span>
                    <p className="min-w-0 flex-1 text-sm font-medium leading-snug text-amber-950">{packingNoteDisplayText}</p>
                  </div>
                ) : null}
                {packWarningText ? (
                  <div className={cn("flex flex-wrap items-start gap-2", hasPackingNote && "mt-2 border-t border-rose-300/60 pt-2")}>
                    <span className="shrink-0 rounded-md bg-rose-200/70 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-rose-950 ring-1 ring-rose-300/60">
                      Pack warning
                    </span>
                    <p className="min-w-0 flex-1 whitespace-pre-wrap text-sm font-medium leading-snug text-rose-950">{packWarningText}</p>
                  </div>
                ) : null}
              </div>
              ) : null}
            </div>

            <ContainerFormSections
              container={selectedContainer}
              onChange={updateSelectedContainer}
              packId={packRow.id}
              containerId={selectedContainer.id}
              packContainers={containerRows}
              packerNames={packerNames}
              packerSelectOptions={packPackerSelectOptions.length ? packPackerSelectOptions : allPackerSelectOptions}
              yesNoOptions={YES_NO_OPTIONS}
              inspectionOptions={INSPECTION_OPTIONS}
              praTemplateOptions={PRA_TEMPLATE_OPTIONS}
              praStatusOptions={PRA_STATUS_OPTIONS}
              isoOptions={isoOptions}
              containerCodes={lookups.containerCodes || []}
              stockBayOptions={stockLocationNames}
              inputClass={inputClass}
              sectionCardClass={sectionCardClass}
              sectionHeaderClass={sectionHeaderClass}
              showPackersNote
              packReleases={packReleases}
              containerParkOptions={containerParkOptions}
              transporterOptions={transporterLookupOptions}
              ecInspectionRemarks={pemsInspectionRemarks.ecInspectionRemarks}
              goodsInspectionRemarks={pemsInspectionRemarks.goodsInspectionRemarks}
              onResetContainer={selectedContainerActions?.onResetContainer}
              onMarkPacked={selectedContainerActions?.onMarkPacked}
              onSubmitPra={selectedContainerActions?.onSubmitPra}
              isImportPack={isImportJob}
            />

            {!isImportJob && packCommodityTypeId ? (
              <div className={cn(sectionCardClass, "mt-4")}>
                <div className={sectionHeaderClass}>Test results</div>
                <div className="p-3">
                  <TestResultsSection
                    commodityTypeId={packCommodityTypeId}
                    commodities={lookups.commodities || []}
                    allowedCommodityIds={allowedCommodityIds}
                    testsCatalog={testsCatalog}
                    surface="Outgoing Containers"
                    testValues={selectedContainer.tests ?? {}}
                    onChange={(name, value) =>
                      updateSelectedContainer({
                        tests: { ...(selectedContainer.tests ?? {}), [name]: value },
                      })
                    }
                    inputClass={inputClass}
                    emptyMessage="No tests are configured for this commodity."
                  />
                </div>
              </div>
            ) : null}
          </section>
        )}
        </div>
      ) : !isImportJob ? (
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
          aoNameOptions={aoNameOptions}
          customerOptions={customerOptions}
          countryOptions={countryOptions}
          submitError={pemsSubmitError}
          isSubmitting={isSubmittingPems}
          canAoSignoff={hasPermission("packing.container.ao-signoff")}
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
          inputClass={inputClass}
        />
      ) : null}
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

      <BulkContainerImportDialog
        key={bulkImportOpen ? "bulk-import-open" : "bulk-import-closed"}
        open={bulkImportOpen}
        onClose={() => !bulkImportApplying && setBulkImportOpen(false)}
        packReleases={packReleases}
        referenceReleases={referenceReleaseOptions}
        containers={containerRows}
        containerNumberField="containerNo"
        containerParkOptions={containerParkOptions}
        transporterOptions={transporterLookupOptions}
        onApply={handleBulkImportApply}
        isApplying={bulkImportApplying}
        applyProgress={bulkImportProgress}
        isLoadingReleases={lookups.isLoading}
      />
      {bulkImportError ? (
        <div className="fixed bottom-4 right-4 z-[70] max-w-md rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 shadow-lg">
          {bulkImportError}
          <button
            type="button"
            className="ml-3 font-medium underline"
            onClick={() => setBulkImportError("")}
          >
            Dismiss
          </button>
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

function PriorityField({ label, value }) {
  return (
    <div className="rounded-lg border border-emerald-300 bg-emerald-100/80 px-3 py-2.5 text-emerald-900">
      <p className="text-[11px] font-semibold uppercase tracking-wide">{label}</p>
      <p className="mt-1 text-base font-semibold text-slate-900">{value}</p>
    </div>
  );
}



