import { readAuthPayload } from "@/lib/auth-session";
import { API_BASE_URL } from "@/lib/api-config";
import {
  DEMO_CMOS,
  DEMO_COMMODITIES,
  DEMO_COMMODITY_TYPES,
  DEMO_CUSTOMERS,
  DEMO_INTERNAL_ACCOUNTS,
  DEMO_SITE_ADDRESS,
  DEMO_STOCK_LOCATIONS,
  DEMO_TESTS,
  DEMO_TRUCKS,
  demoExistingTicket,
  getDemoTransactionsByTicket,
} from "@/lib/demo-in-ticket-data";
import { formatWeightFromStorageKg } from "@/lib/weight-units";
import { buildTestPrintRows } from "@/lib/test-thresholds";
import { computeTransactionTotals, fetchTransactions } from "@/lib/transactions-api";

export function resolveLogoSrc(logoUrl) {
  if (!logoUrl) return "/mahonys-logo.png";
  if (
    logoUrl.startsWith("http://") ||
    logoUrl.startsWith("https://") ||
    logoUrl.startsWith("/") ||
    logoUrl.startsWith("blob:") ||
    logoUrl.startsWith("data:")
  ) {
    return logoUrl;
  }
  const apiBase = API_BASE_URL.replace(/\/api\/?$/, "");
  return `${apiBase}/${logoUrl.replace(/^\/+/, "")}`;
}

export function mergeLiveSitePrint(snapshot) {
  if (!snapshot) return snapshot;
  const payload = readAuthPayload();
  const site = payload?.current_site ?? payload?.currentSite;
  if (!site) return snapshot;
  return {
    ...snapshot,
    sitePrint: {
      name: site.name ?? "",
      phone: site.phone ?? "",
      email: site.email ?? "",
      ticketPrintHeader: site.ticket_print_header ?? site.ticketPrintHeader ?? "",
      ticketPrintFooter: site.ticket_print_footer ?? site.ticketPrintFooter ?? "",
      ticketPrintLogo: site.ticket_print_logo ?? site.ticketPrintLogo ?? "",
    },
  };
}

export function buildTicketPrintPreviewModel(draft, { direction = "incoming", logoPreviewUrl = "" } = {}) {
  const demo = demoExistingTicket(10421);
  if (!demo) return null;

  const sitePrint = {
    name: draft.name || "Site Name",
    phone: draft.phone || "",
    email: draft.email || "",
    ticketPrintHeader: draft.ticketPrintHeader || "",
    ticketPrintFooter: draft.ticketPrintFooter || "",
    ticketPrintLogo: logoPreviewUrl || draft.ticketPrintLogo || "",
  };

  return resolveInTicketForPrint("preview", {
    ...demo,
    type: direction === "outgoing" ? "out" : "in",
    sitePrint,
  });
}

export async function enrichPrintSnapshot(snapshot) {
  if (!snapshot?.id || snapshot.status !== "completed") return snapshot;
  if (Array.isArray(snapshot.transactions) && snapshot.transactions.length > 0) return snapshot;
  try {
    const transactions = await fetchTransactions({ ticketId: snapshot.id });
    return { ...snapshot, transactions };
  } catch {
    return snapshot;
  }
}

function safe(value) {
  if (value == null || String(value).trim() === "") return "—";
  return String(value);
}

function formatStatus(status) {
  if (!status) return "—";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function formatDate(value) {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  const day = String(parsed.getDate()).padStart(2, "0");
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const year = parsed.getFullYear();
  return `${day}/${month}/${year}`;
}

function formatTime(value) {
  if (!value) return "";
  const str = String(value).trim();
  if (!str.includes("T")) return "";
  const timePart = str.split("T")[1] || "";
  return timePart.slice(0, 5);
}

function formatDateTime(value) {
  if (!value) return "—";
  const str = String(value).trim();
  if (!str.includes("T")) return str;
  const [datePart, timePart] = str.split("T");
  const hhmm = (timePart || "").slice(0, 5);
  return hhmm ? `${datePart} ${hhmm}` : datePart;
}

function formatWeightMT(value) {
  const num = Number(value) || 0;
  if (num <= 0) return "—";
  return `${(num / 1000).toFixed(2)} MT`;
}

function formatWeightKg(value, unitType) {
  const num = Number(value) || 0;
  if (num <= 0) return "—";
  const { formatted, unit } = formatWeightFromStorageKg(num, unitType);
  return `${formatted} ${unit}`;
}

function resolveCustomer(customerId, customers, internalAccounts) {
  if (!customerId) return null;
  return (
    customers.find((c) => c.id === customerId) || internalAccounts.find((a) => a.id === customerId) || null
  );
}

function buildTestRows(ticket, commodity) {
  const catalog = ticket.testsCatalog ?? DEMO_TESTS;
  return buildTestPrintRows(ticket.tests || {}, commodity, catalog);
}

function shrinkTakenFromTransactions(transactions) {
  const rows = Array.isArray(transactions) ? transactions : [];
  if (rows.length === 0) return "—";
  const { shrinkage } = computeTransactionTotals(rows, { activeOnly: true });
  if (shrinkage <= 0) return "—";
  return `${shrinkage.toFixed(2)} MT`;
}

function resolveSitePrint(ticket) {
  const sitePrint = ticket.sitePrint;
  if (sitePrint) {
    const headerLines = String(sitePrint.ticketPrintHeader || "")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    return {
      name: sitePrint.name || "—",
      logoUrl: sitePrint.ticketPrintLogo || "",
      headerLines: headerLines.length ? headerLines : null,
      footerText: sitePrint.ticketPrintFooter || "",
      phone: sitePrint.phone || "",
      email: sitePrint.email || "",
    };
  }
  return {
    name: "—",
    logoUrl: "",
    headerLines: [DEMO_SITE_ADDRESS.line1, DEMO_SITE_ADDRESS.line2],
    footerText: "",
    phone: DEMO_SITE_ADDRESS.phone,
    email: DEMO_SITE_ADDRESS.email,
  };
}

export function resolveInTicketForPrint(ticketId, ticketOverride = null) {
  const ticket =
    ticketOverride ||
    (typeof ticketId === "number" ? demoExistingTicket(ticketId) : null);

  if (!ticket) return null;

  const cmo = ticket.cmo || (ticket.cmoId ? DEMO_CMOS.find((c) => c.id === ticket.cmoId) : null);
  const commodity =
    ticket.commodity || (ticket.commodityId ? DEMO_COMMODITIES.find((c) => c.id === ticket.commodityId) : null);
  const commodityType =
    ticket.commodityType ||
    (ticket.commodityTypeId
      ? DEMO_COMMODITY_TYPES.find((ct) => ct.id === ticket.commodityTypeId)
      : cmo
        ? DEMO_COMMODITY_TYPES.find((ct) => ct.id === cmo.commodityTypeId)
        : null);
  const customer = ticket.customer || resolveCustomer(ticket.customerId, DEMO_CUSTOMERS, DEMO_INTERNAL_ACCOUNTS);
  const truck =
    ticket.truck ||
    (ticket.truckId ? DEMO_TRUCKS.find((t) => t.id === ticket.truckId) : null);
  const locationId = ticket.unloadedLocation || ticket.loadingLocation || ticket.stockLocationId;
  const location =
    ticket.location ||
    (locationId ? DEMO_STOCK_LOCATIONS.find((l) => Number(l.id) === Number(locationId)) : null);
  const unitType = commodity?.unitType || "MT";
  const sitePrint = resolveSitePrint(ticket);

  const grossTotal = (ticket.grossWeights || []).reduce((a, b) => a + (Number(b) || 0), 0);
  const tareTotal = (ticket.tareWeights || []).reduce((a, b) => a + (Number(b) || 0), 0);
  const netTotal = grossTotal - tareTotal;

  const grossRows = (ticket.grossWeights || []).length
    ? ticket.grossWeights.map((w, i) => ({
        index: i + 1,
        weight: formatWeightKg(w, unitType),
        weightMT: formatWeightMT(w),
        date: formatDate((ticket.grossWeightDateTimes || [])[i]),
        time: formatTime((ticket.grossWeightDateTimes || [])[i]),
        at: formatDateTime((ticket.grossWeightDateTimes || [])[i]),
      }))
    : [{ index: 1, weight: "—", weightMT: "—", date: "—", time: "", at: "—" }];

  const tareRows = (ticket.tareWeights || []).length
    ? ticket.tareWeights.map((w, i) => ({
        index: i + 1,
        weight: formatWeightKg(w, unitType),
        weightMT: formatWeightMT(w),
        date: formatDate((ticket.tareWeightDateTimes || [])[i]),
        time: formatTime((ticket.tareWeightDateTimes || [])[i]),
        at: formatDateTime((ticket.tareWeightDateTimes || [])[i]),
      }))
    : [{ index: 1, weight: "—", weightMT: "—", date: "—", time: "", at: "—" }];

  const testRows = buildTestRows(ticket, commodity);
  const transactions = getDemoTransactionsByTicket(ticket.id ?? ticketId);

  const ticketRef = ticket.ticketReference
    ? ticket.ticketReference
    : `TKT-${String(ticket.id ?? ticketId).replace(/-/g, "").slice(0, 8).toUpperCase()}`;

  const commodityCode = commodity?.commodityCode ?? commodity?.commodity_code ?? "";

  return {
    ticket,
    ticketId: ticket.id ?? ticketId,
    direction: ticket.type === "out" ? "outgoing" : "incoming",
    ticketRef,
    sitePrint,
    siteName: sitePrint.name,
    status: formatStatus(ticket.status),
    ticketDate: formatDate(ticket.date),
    cmoRef: safe(ticket.cmoRef || cmo?.cmoReference),
    customerName: safe(customer?.name),
    customerCode: customer?.code ? ` (${customer.code})` : "",
    commodityTypeName: safe(commodityType?.name),
    commodityCode: safe(commodityCode),
    productDisplay: commodityCode ? commodityCode.toUpperCase() : "—",
    commodityConfirmed: ticket.commodityConfirmed ? "Yes" : "No",
    commodityOverrideReason: safe(ticket.commodityOverrideReason),
    ticketRefUser: safe(ticket.ticketRef),
    additionalReference: safe(ticket.additionalReference),
    bookingRef: safe(ticket.bookingRef),
    ngr: safe(ticket.ngr),
    season: safe(ticket.season),
    containerNo: safe(ticket.containerNo || "N/A"),
    truckName: safe(truck?.name),
    truckDriver: safe(truck?.driver),
    shrinkTaken: shrinkTakenFromTransactions(ticket.transactions),
    grossRows,
    tareRows,
    grossTotal: formatWeightKg(grossTotal, unitType),
    grossTotalMT: formatWeightMT(grossTotal),
    tareTotal: formatWeightKg(tareTotal, unitType),
    tareTotalMT: formatWeightMT(tareTotal),
    netTotal: netTotal > 0 ? formatWeightKg(netTotal, unitType) : "—",
    netTotalMT: netTotal > 0 ? formatWeightMT(netTotal) : "—",
    testRows,
    signoff: safe(ticket.signoff),
    unloadedLocation: location ? `${location.name}` : "—",
    unloadedLocationType: location ? location.locationType : "",
    notes: safe(ticket.notes),
    transactions,
  };
}
