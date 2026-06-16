/** Legacy combined remark field — prefer typed EC/grain fields for new data. */
export const CONTAINER_INSPECTION_REMARK_FIELD = "aoInspectionRemark";

export const EC_INSPECTION_REMARK_FIELD = "ecInspectionRemark";
export const GRAIN_INSPECTION_REMARK_FIELD = "grainInspectionRemark";
export const EC_INSPECTION_REMARK_CODE_FIELD = "ecInspectionRemarkCode";
export const GRAIN_INSPECTION_REMARK_CODE_FIELD = "grainInspectionRemarkCode";

export function getEcInspectionRemark(container) {
  const typed = container?.[EC_INSPECTION_REMARK_FIELD];
  if (typed != null && String(typed).trim() !== "") return String(typed);
  return container?.[CONTAINER_INSPECTION_REMARK_FIELD] ?? "";
}

export function getGrainInspectionRemark(container) {
  const typed = container?.[GRAIN_INSPECTION_REMARK_FIELD];
  if (typed != null && String(typed).trim() !== "") return String(typed);
  return container?.[CONTAINER_INSPECTION_REMARK_FIELD] ?? "";
}

/** @deprecated Use getEcInspectionRemark / getGrainInspectionRemark with explicit type. */
export function getContainerInspectionRemark(container, submissionType = "ec") {
  return submissionType === "goods" ? getGrainInspectionRemark(container) : getEcInspectionRemark(container);
}

export function ecInspectionRemarkPatch({ code = "", remark = "" } = {}) {
  return {
    [EC_INSPECTION_REMARK_CODE_FIELD]: code,
    [EC_INSPECTION_REMARK_FIELD]: remark,
    inspectionRemarkCode: code,
    [CONTAINER_INSPECTION_REMARK_FIELD]: remark,
  };
}

export function grainInspectionRemarkPatch({ code = "", remark = "" } = {}) {
  return {
    [GRAIN_INSPECTION_REMARK_CODE_FIELD]: code,
    [GRAIN_INSPECTION_REMARK_FIELD]: remark,
    inspectionRemarkCode: code,
    [CONTAINER_INSPECTION_REMARK_FIELD]: remark,
  };
}

/** @deprecated Prefer ecInspectionRemarkPatch / grainInspectionRemarkPatch. */
export function containerInspectionRemarkPatch(value, submissionType = "ec") {
  if (submissionType === "goods") {
    return grainInspectionRemarkPatch({ remark: value });
  }
  return ecInspectionRemarkPatch({ remark: value });
}

export function getContainerNumber(container) {
  return container?.containerNo ?? container?.containerNumber ?? "";
}

export function getSealNumber(container) {
  return container?.sealNo ?? container?.sealNumber ?? "";
}

export function getNettWeight(container) {
  const value = container?.nettWeight ?? container?.nett;
  return Number.isFinite(Number(value)) ? Number(value) : null;
}

export function normalizePemsContainer(container) {
  if (!container) return container;
  return {
    ...container,
    containerNo: getContainerNumber(container),
    sealNo: getSealNumber(container),
    nettWeight: getNettWeight(container) ?? container?.nettWeight,
  };
}

export function normalizePemsContainers(containers) {
  return (containers || []).map(normalizePemsContainer);
}

export function buildRemarkSelectOptions(remarks) {
  return (remarks || []).map((row) => ({
    value: row.code,
    label: `${row.code} — ${row.name}`,
    name: row.name,
  }));
}

export function resolveRemarkFromCode(code, remarks) {
  if (!code) return null;
  return (remarks || []).find((row) => row.code === code) ?? null;
}
