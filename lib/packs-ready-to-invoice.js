import { fetchPackRows } from "@/lib/pack-schedule-store";

export const READY_TO_INVOICE_STATUS = "Approved";

const DEFAULT_GUIDELINE_RATES = {
  commodityRatePerTon: 31.75,
  fumigationRatePerTon: 12.5,
  emptyParkRatePerContainer: 85,
  terminalRatePerContainer: 115,
};

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

export function scheduleRowToInvoicePack(row) {
  const fumigationRequired = Boolean(row.fumigationRequired);
  return {
    id: String(row.id),
    customer: row.customer || "—",
    commodity: row.commodity || "—",
    vessel: row.vessel || "—",
    totalContainers: Number(row.containersRequired) || 0,
    totalWeightTon: Number(row.mtTotal) || 0,
    packingStartDate: getPackingStartDate(row),
    commodityRatePerTon: DEFAULT_GUIDELINE_RATES.commodityRatePerTon,
    fumigationRequired,
    fumigationRatePerTon: fumigationRequired ? DEFAULT_GUIDELINE_RATES.fumigationRatePerTon : 0,
    emptyParkRatePerContainer: DEFAULT_GUIDELINE_RATES.emptyParkRatePerContainer,
    terminalRatePerContainer: DEFAULT_GUIDELINE_RATES.terminalRatePerContainer,
  };
}

export async function loadPacksReadyToInvoice() {
  try {
    const { rows } = await fetchPackRows({ status: READY_TO_INVOICE_STATUS });
    return (Array.isArray(rows) ? rows : []).map(scheduleRowToInvoicePack);
  } catch {
    return [];
  }
}

export async function findPackReadyToInvoice(packId) {
  const packs = await loadPacksReadyToInvoice();
  return packs.find((pack) => pack.id === String(packId)) || null;
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
