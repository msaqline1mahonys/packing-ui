import {
  EMPTY_INSPECTION_TO_REF,
  GPPIR_TRADE_DESC_DEFAULTS,
  GRAIN_INSPECTION_TO_REF,
  defaultContainerPemsFields,
  defaultPemsDraftFields,
} from "@/lib/pems/constants";
import { recordTypeToInspectionType } from "@/lib/pems/validation";
import { filterAuthorisedOfficers } from "@/lib/user-classifications";

function resolveSitePemsFields(site) {
  if (!site) return {};
  const establishmentNumber = String(site.establishmentNumber || site.yardNo || "").trim();
  const yardIdRaw = site.yardId ?? site.yard_id ?? establishmentNumber;
  const yardId = yardIdRaw === "" || yardIdRaw == null ? null : Number(yardIdRaw);
  return {
    siteId: site.id,
    establishmentNumber,
    yardId: Number.isFinite(yardId) ? yardId : null,
    establishmentName: site.name || "",
    addressLine1: site.addressLine1 || "",
    addressLine2: site.addressLine2 || "",
    suburb: site.suburb || "",
    stateCode: site.stateCode || "",
    postcode: site.postcode || "",
  };
}

function mapContainerToPayload(container, { isGppir, aoUserId, commodity, lineNumber }) {
  const defaults = defaultContainerPemsFields();
  const containerNumber = String(container.containerNo || container.containerNumber || "").trim();
  const emptyResult =
    container.inspectionResultCode ||
    EMPTY_INSPECTION_TO_REF[container.emptyInspection] ||
    defaults.inspectionResultCode;
  const grainResult =
    container.result || GRAIN_INSPECTION_TO_REF[container.grainInspection] || emptyResult;

  const ecRemarkCode =
    container.ecInspectionRemarkCode || container.inspectionRemarkCode || container.ec_inspection_remark_code || "";
  const ecRemarkText = container.ecInspectionRemark || container.aoInspectionRemark || "";
  const grainRemarkCode =
    container.grainInspectionRemarkCode || container.inspectionRemarkCode || container.grain_inspection_remark_code || "";
  const grainRemarkText = container.grainInspectionRemark || container.aoInspectionRemark || "";

  const base = {
    packContainerId: container.id,
    containerNumber,
    inspectionLevelCode: container.inspectionLevelCode || defaults.inspectionLevelCode,
    inspectionResultCode: isGppir ? grainResult : emptyResult,
    sealNumber: String(container.sealNo || container.sealNumber || "").trim(),
    passedAfterRectification: container.passedAfterRectification || defaults.passedAfterRectification,
    inspectionRemarkCode: isGppir ? grainRemarkCode || grainRemarkText : ecRemarkCode || ecRemarkText,
    inspectedByUserId: aoUserId,
  };

  if (!isGppir) return { ...base, lines: [] };

  return {
    ...base,
    lines: [
      {
        lineNumber: container.lineNumber || lineNumber || defaults.lineNumber,
        commodity: commodity || "",
        source: container.grainLocation || container.source || "",
        packageNumber: container.packageNumber || container.order || 1,
        packageType: container.packageType || defaults.packageType,
        packageUnit: container.packageUnit || defaults.packageUnit,
        weight: Number(container.nettWeight ?? container.weight ?? 0) || 0,
        weightUnit: container.weightUnit || defaults.packageUnit,
        sampled: container.sampled || defaults.sampled,
        result: grainResult,
        inspectionRemarkCode: grainRemarkCode || grainRemarkText,
        inspectedByUserId: aoUserId,
        samplingType: container.samplingType || "",
        inlineSamplingType: container.inlineSamplingType || "",
        comment: container.comment || "",
      },
    ],
  };
}

function buildDefaultTimeEntries({ pemsDraft, containers, submittedByUserId, inspectionStart, inspectionEnd }) {
  if (Array.isArray(pemsDraft?.timeEntries) && pemsDraft.timeEntries.length) {
    return pemsDraft.timeEntries.map((entry) => ({
      userId: entry.userId || submittedByUserId,
      activityDate: entry.activityDate,
      startTime: entry.startTime,
      endTime: entry.endTime,
      activityTypeCode: entry.activityTypeCode || "INSPECTION",
      comment: entry.comment || "",
    }));
  }

  const start = inspectionStart ? new Date(inspectionStart) : new Date();
  const end = inspectionEnd ? new Date(inspectionEnd) : start;
  const pad = (n) => String(n).padStart(2, "0");
  const activityDate = start.toISOString().slice(0, 10);
  const startTime = `${pad(start.getHours())}:${pad(start.getMinutes())}`;
  const endTime = `${pad(end.getHours())}:${pad(end.getMinutes())}`;

  return [
    {
      userId: submittedByUserId,
      activityDate,
      startTime,
      endTime,
      activityTypeCode: "INSPECTION",
      comment: containers?.length ? `${containers.length} container(s)` : "",
    },
  ];
}

export function buildPemsInspectionPayload({
  pack,
  site,
  recordType,
  pemsDraft,
  containers,
  contactUsers,
}) {
  const draft = { ...defaultPemsDraftFields(), ...(pemsDraft || {}) };
  const isGppir = recordType?.includes("Grain");
  const inspectionType = recordTypeToInspectionType(recordType);
  const siteFields = resolveSitePemsFields(site);

  const aoName = String(draft.aoSignoff || "").trim();
  const aoUser = (contactUsers || []).find((u) => String(u.name || "").trim() === aoName);
  const submittedByUserId = aoUser?.id ?? null;

  const mappedContainers = (containers || []).map((container, index) =>
    mapContainerToPayload(container, {
      isGppir,
      aoUserId: submittedByUserId,
      commodity: pack?.commodity || "",
      lineNumber: index + 1,
    })
  );

  const lines = isGppir ? mappedContainers.flatMap((c) => c.lines || []) : [];

  return {
    packId: pack?.id,
    siteId: siteFields.siteId,
    inspectionType,
    inspectionReason: draft.inspectionReason || "",
    parentInspectionId: draft.parentInspectionId || null,
    inspectionsToBeCancelled: draft.inspectionsToBeCancelled || [],
    submittedByUserId,
    inspectionStartDatetime: draft.inspectionStart,
    inspectionEndDatetime: draft.inspectionEnd,
    additionalDeclaration: draft.ecrComments || draft.additionalDeclaration || "",
    tradeDescRequiredForGoods: isGppir
      ? draft.tradeDescRequiredForGoods || GPPIR_TRADE_DESC_DEFAULTS.tradeDescRequiredForGoods
      : null,
    tradeDescPhysicallyApplied: isGppir
      ? draft.tradeDescPhysicallyApplied || GPPIR_TRADE_DESC_DEFAULTS.tradeDescPhysicallyApplied
      : null,
    tradeDescRequirementMeet: isGppir
      ? draft.tradeDescRequirementMeet || GPPIR_TRADE_DESC_DEFAULTS.tradeDescRequirementMeet
      : null,
    associatedUserIds: draft.associatedAoUserIds || [],
    timeEntries: buildDefaultTimeEntries({
      pemsDraft: draft,
      containers,
      submittedByUserId,
      inspectionStart: draft.inspectionStart,
      inspectionEnd: draft.inspectionEnd,
    }),
    containers: mappedContainers.map(({ lines: _lines, ...rest }) => rest),
    lines,
    site: siteFields,
    pack: {
      rfp: pack?.rfp || "",
      destinationCountry: pack?.destinationCountry || "",
      importPermitNumber: pack?.importPermitNumber || "",
      commodity: pack?.commodity || "",
      exporter: pack?.exporter || pack?.customer || "",
      rfpPackType: pack?.rfpPackType || "",
      rfpTotalQuantity: pack?.rfpTotalQuantity ?? null,
      rfpQuantityUnit: pack?.rfpQuantityUnit || "M/TONS",
      rfpFlowPath: pack?.rfpFlowPath || "",
      originalRfpNumber: pack?.originalRfpNumber || "",
    },
  };
}

export function listAuthorisedOfficerOptions(contactUsers) {
  return filterAuthorisedOfficers(contactUsers).map((u) => ({
    id: u.id,
    name: u.name,
    aoNumber: u.aoNumber || "",
  }));
}
