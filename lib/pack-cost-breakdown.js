import { getPackCostBreakdown } from "@/lib/api/accounting";
import { normalizeBreakdownLineItem } from "@/lib/pack-invoice-breakdown";

function normalizeLineItem(raw, index) {
  return normalizeBreakdownLineItem(raw, index);
}

export function normalizePackCostBreakdown(raw) {
  if (!raw) return null;

  const lineItems = (Array.isArray(raw.lineItems) ? raw.lineItems : Array.isArray(raw.line_items) ? raw.line_items : [])
    .map((item, index) => normalizeLineItem(item, index))
    .filter(Boolean);

  const progressRaw = raw.progress ?? {};
  const breakdownTotal =
    raw.breakdownTotal ??
    raw.breakdown_total ??
    raw.invoiceTotal ??
    raw.invoice_total ??
    lineItems.reduce((total, item) => total + item.unitPrice * item.quantity, 0);

  return {
    id: String(raw.id ?? ""),
    jobReference: raw.jobReference ?? raw.job_reference ?? "",
    status: raw.status ?? "",
    customer: raw.customer ?? "",
    commodity: raw.commodity ?? "",
    vessel: raw.vessel ?? "",
    terminal: raw.terminal ?? "",
    containerPark: raw.containerPark ?? raw.container_park ?? "",
    totalContainers: Number(raw.totalContainers ?? raw.total_containers ?? 0),
    totalWeightTon: Number(raw.totalWeightTon ?? raw.total_weight_ton ?? 0),
    packingStartDate: raw.packingStartDate ?? raw.packing_start_date ?? "",
    fumigationRequired: Boolean(raw.fumigationRequired ?? raw.fumigation_required),
    progress: {
      packedContainers: Number(progressRaw.packedContainers ?? progressRaw.packed_containers ?? 0),
      requiredContainers: Number(progressRaw.requiredContainers ?? progressRaw.required_containers ?? 0),
      packedWeightTon: Number(progressRaw.packedWeightTon ?? progressRaw.packed_weight_ton ?? 0),
      plannedWeightTon: Number(progressRaw.plannedWeightTon ?? progressRaw.planned_weight_ton ?? 0),
    },
    packingInProgress: Boolean(raw.packingInProgress ?? raw.packing_in_progress),
    hasSavedDraft: Boolean(raw.hasSavedDraft ?? raw.has_saved_draft),
    charges: (Array.isArray(raw.charges) ? raw.charges : []).map((charge) => ({
      id: String(charge.id ?? ""),
      chargeName: charge.chargeName ?? charge.charge_name ?? "",
      chargeDescription: charge.chargeDescription ?? charge.charge_description ?? "",
      chargeRate: Number(charge.chargeRate ?? charge.charge_rate ?? 0),
      chargeType: charge.chargeType ?? charge.charge_type ?? "",
      applyToAllPacks: Boolean(charge.applyToAllPacks ?? charge.apply_to_all_packs),
      chargeClassification: charge.chargeClassification ?? charge.charge_classification ?? "",
      accountCode: charge.accountCode ?? charge.account_code ?? "",
    })),
    lineItems,
    breakdownTotal: Number(breakdownTotal),
  };
}

export async function loadPackCostBreakdown(packId) {
  const pack = await getPackCostBreakdown(packId);
  return normalizePackCostBreakdown(pack);
}
