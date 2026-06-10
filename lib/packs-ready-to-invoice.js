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

export async function loadPacksReadyToInvoice() {
  try {
    const result = await listReadyToInvoice();
    return Array.isArray(result) ? result : [];
  } catch {
    return [];
  }
}

export async function findPackReadyToInvoice(packId) {
  try {
    const pack = await getReadyToInvoicePack(packId);
    return pack ?? null;
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
