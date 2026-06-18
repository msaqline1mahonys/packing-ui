export function safeValue(value) {
  if (value == null || String(value).trim() === "") return "—";
  return String(value);
}

export function formatDateTimeValue(value) {
  if (value == null || String(value).trim() === "") return "—";
  const str = String(value).trim();
  if (!str.includes("T")) return str;
  const [datePart, timePart] = str.split("T");
  const hhmm = (timePart || "").slice(0, 5);
  return hhmm ? `${datePart} ${hhmm}` : datePart;
}

export function formatDateTimeInput(value) {
  if (!value) return "";
  const raw = String(value).trim();
  if (!raw) return "";
  // datetime-local values are wall-clock strings — avoid timezone shifts via Date.
  const normalized = raw.includes("T") ? raw : raw.replace(" ", "T");
  const local = normalized.slice(0, 16);
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local)) return local;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return "";
  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  const hours = String(parsed.getHours()).padStart(2, "0");
  const minutes = String(parsed.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export function formatDateDisplay(value) {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  const day = String(parsed.getDate()).padStart(2, "0");
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const year = parsed.getFullYear();
  return `${day}/${month}/${year}`;
}

export function addDaysToDate(value, days) {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  parsed.setDate(parsed.getDate() + days);
  return parsed.toISOString();
}

export const PEMS_RECORD_OPTIONS = ["Empty Container Inspection Record", "Grain and Plant Product Inspection Record"];

export const GPPIR_WEIGHT_UNIT = "M/TONS";

export const stagingGridClass = "grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4";
export const stagingGrid6Class = "grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6";
export const stagingGrid3Class = "grid gap-4 sm:grid-cols-2 md:grid-cols-3";

export const gppirTableCompactCol = "w-12 min-w-[3rem] max-w-[4rem] px-1 py-1.5 whitespace-nowrap text-center";
export const gppirTableNarrowCol = "w-16 min-w-[3.5rem] px-1 py-1.5 whitespace-nowrap";
export const gppirTableNumCol = "w-[4.5rem] min-w-[4rem] px-1 py-1.5 whitespace-nowrap text-right tabular-nums";
export const gppirTableTypeCol = "w-[4.5rem] min-w-[4rem] px-1 py-1.5 whitespace-nowrap";
export const gppirTableInspectionLevelCol = "w-[7.5rem] min-w-[7.5rem] px-2 py-2 whitespace-nowrap";
export const gppirTableRfpCol = "w-[6.5rem] min-w-[6.5rem] px-2 py-2 whitespace-nowrap";
export const gppirTableResultCol = "w-[4.5rem] min-w-[4.5rem] px-2 py-2 whitespace-nowrap";
export const gppirTableSealCol = "w-[6rem] min-w-[6rem] px-2 py-2 whitespace-nowrap";
export const gppirTableExpiryDateCol = "w-[6.5rem] min-w-[6.5rem] px-2 py-2 whitespace-nowrap text-center";
export const gppirTableInspectionAoCol = "w-[9rem] min-w-[9rem] px-2 py-2 whitespace-nowrap";
export const gppirTableContainerCol = "w-[7rem] min-w-[7rem] px-2 py-2 whitespace-nowrap";
export const gppirTableCellCol = "px-1.5 py-1.5";
export const gppirTableRemarksCol = "w-[10rem] min-w-[10rem] px-2 py-2 align-top";

export function resolveExporterCustomerId(packRow, customerOptions) {
  if (!packRow) return "";
  const byExporter = (customerOptions || []).find((customer) => customer.name === packRow.exporter)?.id;
  if (byExporter != null) return String(byExporter);
  const byCustomer = (customerOptions || []).find((customer) => customer.name === packRow.customer)?.id;
  return byCustomer != null ? String(byCustomer) : "";
}
