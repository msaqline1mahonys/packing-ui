function formatDateShort(value) {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  const day = String(parsed.getDate()).padStart(2, "0");
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const year = parsed.getFullYear();
  return `${day}/${month}/${year}`;
}

export function vesselDisplayName(voyage) {
  if (!voyage) return "";
  const vessel = voyage.vessel;
  if (vessel && typeof vessel === "object") return vessel.vessel_name ?? vessel.vesselName ?? "";
  if (typeof vessel === "string") return vessel;
  return voyage.vesselName ?? voyage.vessel_name ?? "";
}

function readRelationName(entity, nameKeys = ["name"], codeKeys = ["code"]) {
  if (!entity || typeof entity !== "object") return "";
  for (const key of nameKeys) {
    const value = entity[key];
    if (value) return String(value);
  }
  for (const key of codeKeys) {
    const value = entity[key];
    if (value) return String(value);
  }
  return "";
}

function readShippingLineLabel(voyage) {
  const line = voyage.shippingLine ?? voyage.shipping_line;
  if (!line || typeof line !== "object") return "";
  return (
    line.shipping_line_name ??
    line.shippingLineName ??
    line.shipping_line_code ??
    line.shippingLineCode ??
    ""
  );
}

/**
 * Build a react-select option for a vessel voyage row (API or normalized shape).
 * @param {object} voyage
 * @param {{ isImportJob?: boolean }} [options]
 */
export function buildVesselVoyageSelectOption(voyage, { isImportJob = false } = {}) {
  if (!voyage?.id) return null;

  const name = vesselDisplayName(voyage);
  const voyageNo = voyage.voyage_number ?? voyage.voyageNumber ?? "";
  const operator = readShippingLineLabel(voyage);
  const terminal = readRelationName(voyage.terminal, ["name"], ["code"]);
  const loadPort = readRelationName(voyage.loadPort ?? voyage.load_port, ["name"], ["code"]);
  const eta = voyage.vessel_eta ?? voyage.vesselEta ?? "";
  const etd = voyage.vessel_etd ?? voyage.vesselEtd ?? "";
  const cutoff = voyage.vessel_cutoff_date ?? voyage.vesselCutoffDate ?? "";
  const lloyds =
    voyage.vessel?.lloyds_number ??
    voyage.vessel?.lloydsNumber ??
    voyage.lloyds_number ??
    voyage.lloydsNumber ??
    "";

  const label = [name, voyageNo ? `(${voyageNo})` : ""].filter(Boolean).join(" ");

  const detailParts = [];
  if (operator) detailParts.push(operator);
  if (terminal) detailParts.push(terminal);
  if (loadPort && loadPort !== terminal) detailParts.push(loadPort);
  if (isImportJob && eta) {
    detailParts.push(`ETA ${formatDateShort(eta)}`);
  } else {
    if (cutoff) detailParts.push(`Cut-off ${formatDateShort(cutoff)}`);
    else if (etd) detailParts.push(`ETD ${formatDateShort(etd)}`);
  }

  const searchLabel = [
    name,
    voyageNo,
    voyage.voyage_number_in ?? voyage.voyageNumberIn,
    operator,
    terminal,
    loadPort,
    lloyds,
  ]
    .filter(Boolean)
    .join(" ");

  return {
    value: String(voyage.id),
    label,
    subLabel: detailParts.join(" · "),
    searchLabel,
    voyage,
  };
}
