/** Shared container field — "Container inspection remark" in forms, "Remarks" in PEMs staging tables. */
export const CONTAINER_INSPECTION_REMARK_FIELD = "aoInspectionRemark";

export function getContainerInspectionRemark(container) {
  return container?.[CONTAINER_INSPECTION_REMARK_FIELD] ?? "";
}

export function containerInspectionRemarkPatch(value) {
  return { [CONTAINER_INSPECTION_REMARK_FIELD]: value };
}
