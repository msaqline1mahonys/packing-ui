import { getContainerInspectionRemark } from "@/lib/pems-container-fields";

/**
 * Maps a container from packers work-store or packing-schedule form shape to the
 * API record used by updateContainer and full-pack saves.
 */
export function buildContainerApiRecord(container, packRow = {}) {
  return {
    id: container.id,
    packId: packRow.id ?? container.packId ?? null,
    order: container.order,
    // Planning
    containerNumber: container.containerNumber ?? container.containerNo ?? "",
    containerCode: packRow.containerCode ?? container.containerCode ?? "",
    containerIsoCode: container.containerIsoCode ?? container.isoCode ?? "",
    sealNumber: container.sealNumber ?? container.sealNo ?? "",
    releaseNumber: container.releaseNumber ?? "",
    releaseId: container.releaseId ?? container.release_id ?? null,
    // Packing Order
    startDate: container.startDate ?? "",
    startHour: container.startHour ?? "",
    startMinute: container.startMinute ?? "",
    stockBayId: container.stockBayId ?? "",
    packer: container.packer ?? "",
    grainLocation: container.grainLocation ?? "",
    // Weights
    tare: container.tare ?? null,
    grossWeight: container.grossWeight ?? null,
    nettWeight: container.nettWeight ?? null,
    containerTareWeight: container.containerTareWeight ?? null,
    // Release Details — store both display names and FK IDs
    emptyContainerParkId: container.emptyContainerParkId ?? null,
    transporterId: container.transporterId ?? null,
    releasePark: container.releasePark ?? "",
    transporter: container.transporter ?? "",
    // Signoff
    packerSignoff: container.packerSignoff ?? "",
    packerEditUnlockReason: container.packerEditUnlockReason ?? "",
    outLoaded: container.outLoaded ?? "No",
    praSignoff: container.praSignoff ?? "",
    praTemplate: container.praTemplate ?? "",
    praSubmitted: Boolean(container.praSubmitted),
    // 1-Stop PRA Info
    praLastStatus: container.praLastStatus ?? "Pending",
    praLastSubmittedTime: container.praLastSubmittedTime ?? "",
    praLastError: container.praLastError ?? "",
    // AO Inspection
    emptyInspection: container.emptyInspection ?? "Pending",
    grainInspection: container.grainInspection ?? "Pending",
    inspectionLevelCode: container.inspectionLevelCode ?? "Consumable",
    passedAfterRectification: container.passedAfterRectification ?? "N",
    inspectionRemarkCode: container.inspectionRemarkCode ?? "",
    ecInspectionRemarkCode: container.ecInspectionRemarkCode ?? "",
    ecInspectionRemark: container.ecInspectionRemark ?? "",
    grainInspectionRemarkCode: container.grainInspectionRemarkCode ?? "",
    grainInspectionRemark: container.grainInspectionRemark ?? "",
    aoSignoff: container.aoSignoff ?? "",
    aoInspectionRemark: getContainerInspectionRemark(container),
    // Packers note
    packerNotes: container.packerNotes ?? "",
    // ECR / GPPIR tracking
    ecrSubmitted: Boolean(container.ecrSubmitted ?? container.pemsSubmitted),
    ecrLastSubmittedAt: container.ecrLastSubmittedAt ?? container.pemsLastSubmittedAt ?? "",
    ecrLastBatchId: container.ecrLastBatchId ?? container.pemsLastBatchId ?? "",
    gppirSubmitted: Boolean(container.gppirSubmitted),
    gppirLastSubmittedAt: container.gppirLastSubmittedAt ?? "",
    gppirLastBatchId: container.gppirLastBatchId ?? "",
    tests: container.tests && typeof container.tests === "object" ? container.tests : {},
  };
}
