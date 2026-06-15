import { listReadyToInvoice, getReadyToInvoicePack } from "@/lib/api/accounting";

export function getPackingStartDate(row) {
  return row?.packingStartDate || row?.date || "";
}

export function getDateOnlyValue(rawValue) {
  if (rawValue == null) return "";
  const value = String(rawValue).trim();
  if (!value) return "";
  const isoMatch = value.match(/^(\d{4}-\d{2}-\d{2})/);
  if (isoMatch) return isoMatch[1];
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toISOString().slice(0, 10);
}

export function packScheduleEditPath(packId) {
  return `/packing-schedule/new-pack-form?mode=edit&id=${encodeURIComponent(String(packId ?? ""))}`;
}

export function packDisplayRef(pack) {
  const ref = String(pack?.jobReference ?? pack?.job_reference ?? "").trim();
  return ref || String(pack?.id ?? "");
}

function normalizeCharge(raw) {
  if (!raw) return null;
  return {
    id: String(raw.id ?? ""),
    chargeName: raw.chargeName ?? raw.charge_name ?? "",
    chargeDescription: raw.chargeDescription ?? raw.charge_description ?? "",
    chargeRate: Number(raw.chargeRate ?? raw.charge_rate ?? 0),
    chargeType: raw.chargeType ?? raw.charge_type ?? "",
    applyToAllPacks: Boolean(raw.applyToAllPacks ?? raw.apply_to_all_packs),
    chargeClassification: raw.chargeClassification ?? raw.charge_classification ?? "",
    accountCode: raw.accountCode ?? raw.account_code ?? "",
  };
}

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
    chargeId: raw.chargeId ?? raw.charge_id ?? null,
  };
}

export function normalizeReadyToInvoicePack(raw) {
  if (!raw) return null;

  const lineItems = (Array.isArray(raw.lineItems) ? raw.lineItems : Array.isArray(raw.line_items) ? raw.line_items : [])
    .map((item, index) => normalizeLineItem(item, index))
    .filter(Boolean);

  const invoiceTotal =
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
    lineItems,
    invoiceTotal: Number(invoiceTotal),
    charges: (Array.isArray(raw.charges) ? raw.charges : []).map(normalizeCharge).filter(Boolean),
  };
}

export async function loadPacksReadyToInvoice() {
  const result = await listReadyToInvoice();
  const list = Array.isArray(result) ? result : [];
  return list.map(normalizeReadyToInvoicePack).filter(Boolean);
}

export async function findPackReadyToInvoice(packId) {
  try {
    const pack = await getReadyToInvoicePack(packId);
    return normalizeReadyToInvoicePack(pack);
  } catch {
    return null;
  }
}

export function matchesPackingStartDateFilter(pack, { dateFilterMode, specificDate, dateFrom, dateTo }) {
  if (dateFilterMode === "all") return true;

  const rowDate = getDateOnlyValue(pack.packingStartDate);
  if (!rowDate) return false;

  if (dateFilterMode === "specific") {
    if (!specificDate) return true;
    return rowDate === specificDate;
  }

  if (!dateFrom && !dateTo) return true;
  if (dateFrom && !dateTo) return rowDate >= dateFrom;
  if (!dateFrom && dateTo) return rowDate <= dateTo;
  if (dateFrom && rowDate < dateFrom) return false;
  if (dateTo && rowDate > dateTo) return false;
  return true;
}
