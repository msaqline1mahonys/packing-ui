export function vesselDisplayName(voyage) {
  if (!voyage) return "";
  const vessel = voyage.vessel;
  if (vessel && typeof vessel === "object") return vessel.vessel_name ?? vessel.vesselName ?? "";
  if (typeof vessel === "string") return vessel;
  return voyage.vesselName ?? voyage.vessel_name ?? "";
}

function readTerminalCode(voyage) {
  const terminal = voyage.terminal;
  if (!terminal || typeof terminal !== "object") return "";
  return String(terminal.code ?? terminal.terminal_code ?? "").trim();
}

function readOperatorLabel(voyage) {
  const line = voyage.shippingLine ?? voyage.shipping_line;
  if (!line || typeof line !== "object") return "";
  return String(
    line.shipping_line_code ??
      line.shippingLineCode ??
      line.shipping_line_name ??
      line.shippingLineName ??
      "",
  ).trim();
}

/**
 * Build a react-select option for a vessel voyage row (API or normalized shape).
 * Display: ship name · voyage · operator · terminal code
 */
export function buildVesselVoyageSelectOption(voyage) {
  if (!voyage?.id) return null;

  const name = vesselDisplayName(voyage);
  const voyageNo = voyage.voyage_number ?? voyage.voyageNumber ?? "";
  const operator = readOperatorLabel(voyage);
  const terminalCode = readTerminalCode(voyage);
  const lloyds =
    voyage.vessel?.lloyds_number ??
    voyage.vessel?.lloydsNumber ??
    voyage.lloyds_number ??
    voyage.lloydsNumber ??
    "";

  const parts = [];
  if (name) {
    parts.push(voyageNo ? `${name} (${voyageNo})` : name);
  } else if (voyageNo) {
    parts.push(`(${voyageNo})`);
  }
  if (operator) parts.push(operator);
  if (terminalCode) parts.push(terminalCode);

  const label = parts.join(" · ");

  const searchLabel = [name, voyageNo, operator, terminalCode, lloyds].filter(Boolean).join(" ");

  return {
    value: String(voyage.id),
    label,
    searchLabel,
    voyage,
  };
}
