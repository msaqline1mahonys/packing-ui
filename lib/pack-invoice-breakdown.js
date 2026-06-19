import { calculateLineItemAmount, formatCurrency } from "@/lib/packs-ready-to-invoice-dummy";

export { calculateLineItemAmount, formatCurrency };

export function normalizeBreakdownLineItem(raw, index) {
  if (!raw) return null;

  return {
    id: raw.id ?? `line-${index}`,
    lineKey: raw.lineKey ?? raw.line_key ?? `line-${index}`,
    source: raw.source ?? "default",
    label: raw.label ?? "",
    unitPrice: Number(raw.unitPrice ?? raw.unit_price ?? 0),
    quantity: Number(raw.quantity ?? 0),
    unitLabel: raw.unitLabel ?? raw.unit_label ?? "",
    basisText: raw.basisText ?? raw.basis_text ?? "",
    chargeId: raw.chargeId ?? raw.charge_id ?? null,
    tracksProgress: Boolean(raw.tracksProgress ?? raw.tracks_progress),
    quantityLocked: Boolean(raw.quantityLocked ?? raw.quantity_locked),
  };
}

export function isCustomBreakdownLine(lineKey) {
  return String(lineKey || "").startsWith("custom:");
}

export function isQuantityEditable(item, breakdown) {
  if (item?.quantityLocked) return false;
  if (item?.tracksProgress && breakdown?.packingInProgress) return false;
  return true;
}

export function createCustomChargeLineItem(charge, breakdown = null) {
  const chargeType = charge?.chargeType ?? charge?.charge_type ?? "";
  const totalContainers = Number(breakdown?.totalContainers ?? 0);
  const totalWeightTon = Number(breakdown?.totalWeightTon ?? 0);
  let quantity = 1;
  let unitLabel = "invoice";
  let basisText = "One charge per invoice";

  if (chargeType === "Per Container") {
    quantity = totalContainers;
    unitLabel = "container";
    basisText = `${totalContainers} containers`;
  } else if (chargeType === "Per MT") {
    quantity = totalWeightTon;
    unitLabel = "MT";
    basisText = `${Number(totalWeightTon || 0).toFixed(1)} MT total weight`;
  }

  const chargeId = String(charge?.id ?? "");
  const suffix = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}`;

  return {
    id: `custom-${chargeId}-${suffix}`,
    lineKey: `custom:${chargeId}:${suffix}`,
    source: "fee",
    chargeId,
    label: charge?.chargeName ?? charge?.charge_name ?? "Additional charge",
    unitPrice: Number(charge?.chargeRate ?? charge?.charge_rate ?? 0),
    quantity,
    unitLabel,
    basisText,
    tracksProgress: false,
    quantityLocked: false,
  };
}

export function buildBreakdownSavePayload(lineItems, excludedLineKeys = []) {
  const payload = lineItems.map((item) => ({
    lineKey: item.lineKey,
    source: item.source,
    label: item.label,
    unitPrice: item.unitPrice,
    quantity: item.quantity,
    unitLabel: item.unitLabel,
    basisText: item.basisText,
    chargeId: item.chargeId ?? null,
    excluded: false,
  }));

  excludedLineKeys.forEach((lineKey) => {
    payload.push({ lineKey, excluded: true });
  });

  return payload;
}

export function serializeLineItemsForCompare(lineItems) {
  return JSON.stringify(
    (lineItems ?? []).map((item) => ({
      lineKey: item.lineKey,
      unitPrice: item.unitPrice,
      quantity: item.quantity,
    }))
  );
}

export function normalizeChargeFromApi(raw) {
  if (!raw) return null;
  const id = String(raw.id ?? "");
  if (!id) return null;

  return {
    id,
    chargeName: raw.chargeName ?? raw.charge_name ?? "",
    chargeDescription: raw.chargeDescription ?? raw.charge_description ?? "",
    chargeRate: Number(raw.chargeRate ?? raw.charge_rate ?? 0),
    chargeType: raw.chargeType ?? raw.charge_type ?? "",
    applyToAllPacks: Boolean(raw.applyToAllPacks ?? raw.apply_to_all_packs),
    chargeClassification: raw.chargeClassification ?? raw.charge_classification ?? "",
    accountCode: raw.accountCode ?? raw.account_code ?? "",
  };
}

export function normalizeCharges(rows) {
  return (Array.isArray(rows) ? rows : []).map(normalizeChargeFromApi).filter(Boolean);
}
