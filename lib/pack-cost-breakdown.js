import { getPackCostBreakdown } from "@/lib/api/accounting";

function normalizeLineItem(raw, index) {
  if (!raw) return null;
  return {
    id: raw.id ?? `line-${index}`,
    source: raw.source ?? "default",
    label: raw.label ?? "",
    unitPrice: Number(raw.unitPrice ?? raw.unit_price ?? 0),
    quantity: Number(raw.quantity ?? 0),
    unitLabel: raw.unitLabel ?? raw.unit_label ?? "",
    basisText: raw.basisText ?? raw.basis_text ?? "",
  };
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
    lineItems,
    breakdownTotal: Number(breakdownTotal),
  };
}

export async function loadPackCostBreakdown(packId) {
  const pack = await getPackCostBreakdown(packId);
  return normalizePackCostBreakdown(pack);
}
