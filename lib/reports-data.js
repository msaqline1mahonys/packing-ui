"use client";

/**
 * Collects rows for the five report sections, filtered by date range,
 * commodity and (optionally) a single customer. Each section pulls from its
 * existing source — backend API where one exists, localStorage seed where not.
 *
 * Single entrypoint: `collectReportData({ dateRange, customerId, commodityIds, sections })`.
 *
 * Stock-on-Hand is treated as a point-in-time snapshot "as at" `dateRange.to`
 * (it is not a range — there is no historical balance endpoint).
 */

import { COMMODITY_MASTER_ROWS, CUSTOMER_CONTACT_ROWS, CUSTOMER_MASTER_ROWS } from "@/lib/Data";
import { API_BASE_URL } from "@/lib/api-config";
import { fetchTickets } from "@/lib/ticketing-api";
import { fetchAccountBalances, fetchTransactions } from "@/lib/transactions-api";
import { fetchPackRows, fetchContainerRows } from "@/lib/pack-schedule-store";
import { buildTestPrintRows } from "@/lib/test-thresholds";
import { countPackedContainers, totalNettWeight } from "@/lib/packers-container-validation";
import { containerStage, countAvailableToPackContainers } from "@/lib/packers-work-store";
import { displayContainerStage } from "@/lib/container-status";

export const ALL_SECTIONS = ["tickets", "transactions", "containers", "packs", "stockOnHand"];

export const SECTION_LABELS = {
  tickets: "Tickets",
  transactions: "Transactions",
  containers: "Containers",
  packs: "Packs",
  stockOnHand: "Stock on Hand",
};

/* ------------------------------------------------------------------ */
/* Auth + tenant helpers (same pattern as ticketing-api)               */
/* ------------------------------------------------------------------ */

function readAuthPayload() {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem("authPayload") || "{}");
  } catch {
    return {};
  }
}

function getAuthHeaders() {
  const token = typeof window !== "undefined" ? window.localStorage.getItem("authToken") : null;
  return {
    Accept: "application/json",
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function getTenantQuery() {
  const authPayload = readAuthPayload();
  const params = new URLSearchParams();
  if (authPayload.organization?.id) params.set("organization_id", authPayload.organization.id);
  if (authPayload.current_site?.id) params.set("site_id", authPayload.current_site.id);
  params.set("per_page", "500");
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

function unwrapList(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  return [];
}

/** Compare ids that may be numeric (seed data) or UUID strings (API). */
export function sameId(a, b) {
  if (a == null || b == null) return false;
  return String(a) === String(b);
}

function idSet(ids) {
  return new Set((ids || []).map(String));
}

/* ------------------------------------------------------------------ */
/* Customer + commodity reference helpers                              */
/* ------------------------------------------------------------------ */

// In-memory cache so we don't re-fetch on every component mount
let _customerCache = null;
let _commodityCache = null;

/** Static fallback — only used when the API is unreachable. */
function _getCustomerDirectoryStatic() {
  const byId = new Map();
  for (const row of CUSTOMER_MASTER_ROWS) {
    byId.set(Number(row.id), { id: Number(row.id), code: row.code, name: row.name, emails: [], contacts: [] });
  }
  for (const row of CUSTOMER_CONTACT_ROWS) {
    const existing = byId.get(Number(row.id)) || { id: Number(row.id), code: row.code, name: row.name };
    byId.set(Number(row.id), {
      ...existing,
      code: row.code || existing.code,
      name: row.name || existing.name,
      emails: Array.isArray(row.emails) ? row.emails : [],
      contacts: Array.isArray(row.contacts) ? row.contacts : [],
      addresses: row.addresses || [],
      website: row.website || "",
      notes: row.notes || "",
    });
  }
  return Array.from(byId.values()).sort((a, b) => String(a.name).localeCompare(String(b.name)));
}

/** Static fallback — only used when the API is unreachable. */
function _getCommodityDirectoryStatic() {
  const rows = COMMODITY_MASTER_ROWS.map((r) => ({
    id: Number(r.id),
    description: r.description,
    commodityCode: r.commodityCode,
    commodityTypeName: r.commodityTypeName,
  }));
  return rows.sort((a, b) => String(a.description).localeCompare(String(b.description)));
}

/**
 * Fetch real customers from the backend API.
 * Falls back to static data if the API call fails.
 */
export async function fetchCustomerDirectory() {
  if (_customerCache) return _customerCache;
  try {
    const response = await fetch(`${API_BASE_URL}/reference-data/customers${getTenantQuery()}`, {
      headers: getAuthHeaders(),
    });
    if (!response.ok) throw new Error("Failed to fetch customers");
    const result = await response.json();
    const rows = unwrapList(result?.data ?? result);
    const customers = rows
      .filter((c) => !(c.is_shrink ?? c.isShrink ?? c.is_write_off ?? c.isWriteOff))
      .map((c) => ({
        id: c.id,
        code: c.code ?? c.customer_code ?? "",
        name: c.name ?? "",
        emails: Array.isArray(c.emails) ? c.emails : c.email ? [c.email] : [],
        contacts: Array.isArray(c.contacts) ? c.contacts : [],
        addresses: Array.isArray(c.addresses) ? c.addresses : [],
        website: c.website ?? "",
        notes: c.notes ?? "",
      }))
      .sort((a, b) => String(a.name).localeCompare(String(b.name)));
    _customerCache = customers;
    return customers;
  } catch {
    return _getCustomerDirectoryStatic();
  }
}

/**
 * Fetch real commodities from the backend API.
 * Falls back to static data if the API call fails.
 */
export async function fetchCommodityDirectory() {
  if (_commodityCache) return _commodityCache;
  try {
    const response = await fetch(`${API_BASE_URL}/product-settings/commodities${getTenantQuery()}`, {
      headers: getAuthHeaders(),
    });
    if (!response.ok) throw new Error("Failed to fetch commodities");
    const result = await response.json();
    const rows = unwrapList(result?.data ?? result);
    const commodities = rows
      .map((c) => ({
        id: c.id,
        description: c.description ?? c.commodity_code ?? "",
        commodityCode: c.commodity_code ?? c.commodityCode ?? "",
        commodityTypeName: c.commodity_type?.name ?? c.commodityTypeName ?? "",
      }))
      .sort((a, b) => String(a.description).localeCompare(String(b.description)));
    _commodityCache = commodities;
    return commodities;
  } catch {
    return _getCommodityDirectoryStatic();
  }
}

/** Sync fallback (kept for backward compat where sync is required). */
export function getCustomerDirectory() {
  if (_customerCache) return _customerCache;
  return _getCustomerDirectoryStatic();
}

/** Sync fallback (kept for backward compat where sync is required). */
export function getCommodityDirectory() {
  if (_commodityCache) return _commodityCache;
  return _getCommodityDirectoryStatic();
}

/** Invalidate the in-memory cache (e.g. on site/org switch). */
export function clearDirectoryCache() {
  _customerCache = null;
  _commodityCache = null;
}

function recipientEmailsForCustomer(customer) {
  if (!customer) return [];
  const set = new Set();
  for (const email of customer.emails || []) {
    if (email) set.add(String(email).trim().toLowerCase());
  }
  for (const c of customer.contacts || []) {
    if (c?.email) set.add(String(c.email).trim().toLowerCase());
  }
  return Array.from(set);
}

export function getRecipientChoicesForCustomer(customerId) {
  const dir = getCustomerDirectory();
  const customer = dir.find((c) => sameId(c.id, customerId));
  if (!customer) return { customer: null, emails: [] };
  const seen = new Set();
  const choices = [];
  for (const email of customer.emails || []) {
    const lower = String(email).trim().toLowerCase();
    if (!lower || seen.has(lower)) continue;
    seen.add(lower);
    choices.push({ email, source: "customer", label: "Customer email" });
  }
  for (const c of customer.contacts || []) {
    if (!c?.email) continue;
    const lower = String(c.email).trim().toLowerCase();
    if (seen.has(lower)) continue;
    seen.add(lower);
    choices.push({ email: c.email, source: "contact", label: c.name || "Contact" });
  }
  return { customer, emails: choices };
}

/** Merge recipient choices across several customers (for combined reports). */
export function getRecipientChoicesForCustomers(customerIds = []) {
  const seen = new Set();
  const choices = [];
  const customers = [];
  for (const id of customerIds) {
    const { customer, emails } = getRecipientChoicesForCustomer(id);
    if (customer) customers.push(customer);
    for (const entry of emails) {
      const lower = String(entry.email).trim().toLowerCase();
      if (!lower || seen.has(lower)) continue;
      seen.add(lower);
      choices.push({
        ...entry,
        label: customer ? `${entry.label} · ${customer.name}` : entry.label,
      });
    }
  }
  return { customers, emails: choices };
}

/* ------------------------------------------------------------------ */
/* Matchers                                                             */
/* ------------------------------------------------------------------ */

function dateInRange(value, range) {
  if (!range?.from && !range?.to) return true;
  if (!value) return false;
  const iso = String(value).slice(0, 10);
  if (range.from && iso < range.from) return false;
  if (range.to && iso > range.to) return false;
  return true;
}

function commodityMatches(row, commodityIds, commodityDirectory) {
  if (!commodityIds || commodityIds.length === 0) return true;
  const ids = idSet(commodityIds);
  const rowId = row.commodityId ?? row.commodity_id;
  if (rowId != null && ids.has(String(rowId))) return true;
  // Some sources only carry the commodity description string. Resolve via dir.
  const desc = displayName(row.commodity ?? row.commodityName ?? row.commodity_name).toLowerCase();
  if (!desc) return false;
  for (const id of ids) {
    const entry = commodityDirectory.find((c) => sameId(c.id, id));
    if (!entry) continue;
    if (entry.description.trim().toLowerCase() === desc) return true;
    const code = String(entry.commodityCode ?? "").trim().toLowerCase();
    if (code && code === desc) return true;
  }
  return false;
}

function displayName(value) {
  if (value == null || value === "") return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "object") {
    return String(value.name ?? value.description ?? value.label ?? "").trim();
  }
  return String(value).trim();
}

function customerMatches(row, customer) {
  if (!customer) return true;
  const rowId = row.customerId ?? row.customer_id ?? row.accountId ?? row.account_id;
  if (rowId != null && sameId(rowId, customer.id)) return true;
  const name = displayName(row.customer ?? row.account ?? row.accountName ?? row.account_name).toLowerCase();
  if (!name) return false;
  if (customer.name && name === customer.name.toLowerCase()) return true;
  if (customer.code && name === customer.code.toLowerCase()) return true;
  return false;
}

/** Resolve the customer label shown on ticket list rows ("Name / CMO-123" → "Name"). */
function ticketCustomerLabel(ticket) {
  const raw = ticket?.customerCmo ?? ticket?.customer_cmo ?? "";
  if (!raw) return "";
  const text = String(raw);
  const sep = text.indexOf(" / ");
  return (sep >= 0 ? text.slice(0, sep) : text).trim();
}

function ticketMatchesCustomer(ticket, customer) {
  if (!customer) return true;
  return customerMatches(
    {
      customerId: ticket.customerId ?? ticket.customer_id,
      customer: ticketCustomerLabel(ticket),
    },
    customer
  );
}

function ticketMatchesCommodity(ticket, commodityIds, commodityDirectory, packById) {
  if (!commodityIds || commodityIds.length === 0) return true;
  if (ticket.commodityId != null && idSet(commodityIds).has(String(ticket.commodityId))) return true;
  const grade = ticket.commodityGrade ?? ticket.commodity_grade ?? "";
  if (grade && commodityMatches({ commodity: grade }, commodityIds, commodityDirectory)) return true;
  const linkedPackId = ticket.packId ?? ticket.pack_id;
  if (!linkedPackId) return false;
  const linkedPack = packById.get(String(linkedPackId));
  if (!linkedPack) return false;
  return commodityMatches({ commodity: linkedPack.commodity }, commodityIds, commodityDirectory);
}

function ticketMatchesAnyCustomer(ticket, customers) {
  if (!customers || customers.length === 0) return true;
  return customers.some((c) => ticketMatchesCustomer(ticket, c));
}

function customerMatchesAny(row, customers) {
  if (!customers || customers.length === 0) return true;
  return customers.some((c) => customerMatches(row, c));
}

function buildReportLabel({ customer, customers, commodity }) {
  if (commodity) {
    const customerName = customer?.name || "Customer";
    const commodityName = commodity.description || commodity.commodityCode || "Commodity Grade";
    return `${customerName} · ${commodityName}`;
  }
  if (customers?.length > 1 || customer?.id === "combined") {
    const count = customers?.length ?? 0;
    return `Combined (${count} customer${count === 1 ? "" : "s"})`;
  }
  if (customer?.code) return `${customer.name} (${customer.code})`;
  return customer?.name || "All customers";
}

export const REPORT_LAYOUT_SPLIT = "split";
export const REPORT_LAYOUT_COMBINED = "combined";

/** True when the user has picked more than one customer or commodity. */
export function needsReportLayoutChoice(customerIds = [], commodityIds = []) {
  return customerIds.length > 1 || commodityIds.length > 1;
}

/** Short hint for the split layout option label. */
export function splitLayoutHint(customerIds = [], commodityIds = []) {
  if (customerIds.length > 1) return "One separate report per selected customer.";
  if (commodityIds.length > 1) return "One separate report per selected commodity.";
  return "";
}

/* ------------------------------------------------------------------ */
/* Per-section fetchers (with localStorage fallback when API absent)    */
/* ------------------------------------------------------------------ */

async function safeFetch(fn, fallback) {
  try {
    const out = await fn();
    return Array.isArray(out) ? out : fallback;
  } catch {
    return fallback;
  }
}

let _testsCache = null;

async function fetchTestsCatalog() {
  if (_testsCache) return _testsCache;
  try {
    const response = await fetch(`${API_BASE_URL}/product-settings/tests${getTenantQuery()}`, {
      headers: getAuthHeaders(),
    });
    if (!response.ok) throw new Error("Failed to fetch tests");
    const result = await response.json();
    const rows = unwrapList(result?.data ?? result);
    _testsCache = rows.map((t) => ({
      id: t.id,
      name: t.testName ?? t.test_name ?? t.name ?? "",
      type: t.type ?? "",
      unit: t.unit ?? "",
      appliesTo: Array.isArray(t.appliesTo ?? t.applies_to) ? (t.appliesTo ?? t.applies_to) : [],
      members: t.members ?? [],
      status: t.status ?? "",
    }));
    return _testsCache;
  } catch {
    return [];
  }
}

function parseCmoReferenceFromCustomerCmo(customerCmo) {
  const text = String(customerCmo || "");
  const sep = text.indexOf(" / ");
  return sep >= 0 ? text.slice(sep + 3).trim() : "";
}

function formatTicketTestsForReport(ticket, commodity, testsCatalog) {
  const rows = buildTestPrintRows(ticket.tests || {}, commodity, testsCatalog);
  if (!rows.length) return "";
  return rows
    .map((r) => {
      const unit = r.unit ? ` ${r.unit}` : "";
      const suffix = r.isGroupTotal ? " (total)" : "";
      return `${r.name}: ${r.value}${unit}${suffix}`;
    })
    .join("; ");
}

function enrichReportTicket(ticket, { customerDirectory, commodityDirectory, testsCatalog }) {
  let customerName = ticket.customerName ?? "";
  let customerCode = ticket.customerCode ?? "";
  if (ticket.customerId) {
    const customer = customerDirectory.find((c) => sameId(c.id, ticket.customerId));
    if (customer) {
      if (!customerName) customerName = customer.name;
      if (!customerCode) customerCode = customer.code;
    }
  }
  if (!customerName) customerName = ticketCustomerLabel(ticket);

  let commodityDisplay =
    ticket.commodityDescription ?? ticket.commodityGrade ?? ticket.commodity_grade ?? "";
  const commodity =
    ticket.commodityId != null
      ? commodityDirectory.find((c) => sameId(c.id, ticket.commodityId)) || null
      : null;
  if (commodity) {
    commodityDisplay = commodity.description || commodity.commodityCode || commodityDisplay;
  }

  const cmoReference =
    ticket.cmoReference ?? ticket.cmo_reference ?? parseCmoReferenceFromCustomerCmo(ticket.customerCmo);

  const truckName =
    typeof ticket.truck === "string"
      ? ticket.truck
      : ticket.truck?.name || ticket.truckDisplay || "";
  const truckDriver = ticket.truckDriver ?? ticket.truck?.driver ?? "";

  return {
    ...ticket,
    customerName,
    customerCode,
    customerDisplay: customerCode ? `${customerName} (${customerCode})` : customerName,
    commodityDisplay,
    cmoReference,
    testsFormatted: formatTicketTestsForReport(ticket, commodity, testsCatalog),
    truckDisplay: truckName,
    truckDriver,
  };
}

function enrichReportTickets(tickets, ctx) {
  return tickets.map((t) => enrichReportTicket(t, ctx));
}

async function getTicketsAll() {
  return safeFetch(() => fetchTickets({ perPage: 500 }), []);
}

async function getTransactionsAll() {
  return safeFetch(() => fetchTransactions(), []);
}

async function getBalancesAll() {
  return safeFetch(() => fetchAccountBalances(), []);
}

async function getPacksAll() {
  try {
    const { rows } = await fetchPackRows({ perPage: 500 });
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

async function getContainersAll() {
  try {
    const { rows } = await fetchContainerRows({ perPage: 500, includeCompleted: true });
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

function dedupeRowsById(rows) {
  const seen = new Set();
  return rows.filter((row) => {
    const id = row?.id;
    if (id == null || id === "") return true;
    const key = String(id);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function reportDateMatches(pack, container, range) {
  if (!range?.from && !range?.to) return true;
  const candidates = [];
  if (pack) {
    candidates.push(pack.date, pack.packingStartDate, pack.packing_start_date, pack.etd, pack.vesselCutoffDate);
  }
  if (container) {
    candidates.push(container.packingStartDate, container.packDate, container.startDate);
  }
  return candidates.some((value) => value && dateInRange(value, range));
}

function packEmptyPark(pack) {
  const releases = pack?.releases ?? pack?.releaseDetails ?? pack?.release_details ?? [];
  const names = [];
  const seen = new Set();
  for (const r of releases) {
    const name =
      r?.emptyContainerPark?.name ??
      r?.empty_container_park?.name ??
      r?.emptyContainerParkName ??
      "";
    if (name && !seen.has(name)) {
      seen.add(name);
      names.push(name);
    }
  }
  return names.join(", ");
}

function packAssignedPackers(pack) {
  const packers = pack?.assignedPackers ?? pack?.assigned_packers ?? [];
  return packers.map((p) => p?.name).filter(Boolean).join(", ");
}

function enrichReportPack(pack, customerDirectory, commodityDirectory) {
  let customerName = packCustomerLabel(pack);
  let customerCode = "";
  if (pack.customerId != null) {
    const customer = customerDirectory.find((c) => sameId(c.id, pack.customerId));
    if (customer) {
      customerName = customer.name || customerName;
      customerCode = customer.code || "";
    }
  }

  let commodityDisplay = packCommodityLabel(pack);
  if (pack.commodityId != null) {
    const commodity = commodityDirectory.find((c) => sameId(c.id, pack.commodityId));
    if (commodity) {
      commodityDisplay = commodity.description || commodity.commodityCode || commodityDisplay;
    }
  }

  const containers = Array.isArray(pack.containers) ? pack.containers : [];

  return {
    ...pack,
    customerName,
    customerCode,
    customerDisplay: customerCode ? `${customerName} (${customerCode})` : customerName,
    commodityDisplay,
    emptyPark: packEmptyPark(pack),
    assignedPackersDisplay: packAssignedPackers(pack),
    containersPacked: countPackedContainers(containers),
    actualPackedMt: totalNettWeight(containers),
    availableToPackContainers: countAvailableToPackContainers(
      containers,
      String(pack.importExport ?? pack.import_export ?? "").toLowerCase() === "import",
    ),
  };
}

function containerLocationDisplay(container) {
  const grain = String(container.grainLocation ?? container.grain_location ?? "").trim();
  const bay = String(container.stockBayId ?? container.stock_bay_id ?? "").trim();
  if (grain && bay) return grain === bay ? grain : `${grain} · ${bay}`;
  return grain || bay;
}

function containerStageDisplay(container, importExport) {
  const isImport = String(importExport || "").toLowerCase() === "import";
  return displayContainerStage(container, isImport, containerStage);
}

function containerPemsDisplay(container) {
  const ecr = container.ecrSubmitted ? "ECR" : "No ECR";
  const gppir = container.gppirSubmitted ? "GPPIR" : "No GPPIR";
  return `${ecr} / ${gppir}`;
}

function containerReportRowFromList(container, pack) {
  const importExport = container.importExport ?? pack?.importExport ?? "";
  const nett = container.nettWeight ?? container.nett_weight;

  return {
    packNumber: container.packNumber ?? pack?.packNumber ?? "",
    packDate: pack?.date ?? container.packingStartDate ?? "",
    jobReference: container.jobReference ?? packJobReference(pack ?? {}),
    customer: container.customerName ?? packCustomerLabel(pack ?? {}),
    commodity: container.commodityName ?? packCommodityLabel(pack ?? {}),
    importExport,
    vessel: container.vessel ?? pack?.vessel ?? "",
    etd: container.etd ?? pack?.etd ?? "",
    vesselCutoffDate: container.vesselCutoffDate ?? pack?.vesselCutoffDate ?? "",
    order: container.order ?? "",
    containerNumber: container.containerNumber ?? container.containerNo ?? "",
    containerSize: container.containerSize || containerSizeLabel(container, pack),
    isoCode: container.containerIsoCode ?? container.isoCode ?? containerIsoLabel(container),
    sealNumber: containerSealLabel(container),
    releaseNumber: container.releaseNumber ?? "",
    emptyPark: container.emptyContainerParkName ?? container.releasePark ?? "",
    transporter: container.transporterName ?? container.transporter ?? "",
    location: containerLocationDisplay(container),
    packer: container.packer ?? "",
    stage: containerStageDisplay(container, importExport),
    emptyInspection: container.emptyInspection ?? "",
    grainInspection: container.grainInspection ?? "",
    praStatus: container.praLastStatus ?? "",
    pems: containerPemsDisplay(container),
    outLoaded: container.outLoaded ?? "",
    nettWeight: nett != null && nett !== "" ? Number(nett).toFixed(3) : "",
    startDate: container.startDate ?? "",
    replacesContainerNumber: container.replacesContainerNumber ?? "",
    replacedByContainerNumber: container.replacedByContainerNumber ?? "",
    status: container.status ?? "",
    packStatus: container.packStatus ?? pack?.status ?? "",
    packerSignoff: container.packerSignoff ?? "",
    aoSignoff: container.aoSignoff ?? "",
    packerNotes: container.packerNotes ?? "",
    reportKey: `${container.packId ?? pack?.id ?? ""}-${container.order ?? ""}-${container.containerNumber ?? container.containerNo ?? ""}`,
  };
}

function containerMatchesReportFilters(container, pack, customers, commodityIds, commodityDirectory, range) {
  if (!reportDateMatches(pack, container, range)) return false;
  if (pack) {
    return customerMatchesAny(pack, customers) && commodityMatches(pack, commodityIds, commodityDirectory);
  }
  return (
    customerMatchesAny({ customer: container.customerName }, customers) &&
    commodityMatches({ commodity: container.commodityName }, commodityIds, commodityDirectory)
  );
}

function packCustomerLabel(pack) {
  return displayName(pack?.customer ?? pack?.customer_name ?? pack?.customerName);
}

function packCommodityLabel(pack) {
  return displayName(pack?.commodity ?? pack?.commodity_description ?? pack?.commodityName);
}

function packJobReference(pack) {
  return String(pack?.jobReference ?? pack?.job_reference ?? "").trim();
}

function containerSizeLabel(container, pack) {
  const size = container.containerSize ?? container.container_size;
  if (size) return String(size).trim();
  const codeRel = container.container_code ?? (typeof container.containerCode === "object" ? container.containerCode : null);
  if (codeRel && typeof codeRel === "object") {
    return String(codeRel.container_size ?? codeRel.containerSize ?? codeRel.iso_code ?? codeRel.isoCode ?? "").trim();
  }
  const code = container.containerCode ?? container.container_code;
  if (typeof code === "string" && code.trim()) return code.trim();
  const packCode = pack?.containerCode;
  return typeof packCode === "string" ? packCode.trim() : "";
}

function containerIsoLabel(container) {
  return String(container.containerIsoCode ?? container.container_iso_code ?? container.isoCode ?? "").trim();
}

function containerSealLabel(container) {
  return String(container.sealNumber ?? container.seal_number ?? container.sealNo ?? "").trim();
}

/* ------------------------------------------------------------------ */
/* Public: data collection                                              */
/* ------------------------------------------------------------------ */

/**
 * @param {object} opts
 * @param {{from:string,to:string}} opts.dateRange
 * @param {number|null} [opts.customerId]       single customer (split layout)
 * @param {number[]} [opts.customerIds]         multiple customers (combined layout)
 * @param {number[]} [opts.commodityIds]
 * @param {string[]} [opts.sections]            which of ALL_SECTIONS to include; defaults to all
 */
export async function collectReportData({
  dateRange,
  customerId = null,
  customerIds = null,
  commodityIds = [],
  sections = ALL_SECTIONS,
} = {}) {
  const includeTickets = sections.includes("tickets");
  const includeTransactions = sections.includes("transactions");
  const includeContainers = sections.includes("containers");
  const includePacks = sections.includes("packs");
  const includeStock = sections.includes("stockOnHand");

  const customerDirectory = await fetchCustomerDirectory();
  const resolvedIds =
    Array.isArray(customerIds) && customerIds.length
      ? customerIds
      : customerId != null
        ? [customerId]
        : [];
  const customers = resolvedIds.map((id) => customerDirectory.find((c) => sameId(c.id, id))).filter(Boolean);
  const customer = customers.length === 1 ? customers[0] : null;
  const reportCustomer =
    customers.length > 1
      ? {
          id: "combined",
          code: "combined",
          name: customers.map((c) => c.name).join(", "),
          emails: [],
          contacts: [],
        }
      : customer;

  const commodityDirectory = await fetchCommodityDirectory();
  const testsCatalog = includeTickets ? await fetchTestsCatalog() : [];
  const range = dateRange && (dateRange.from || dateRange.to) ? dateRange : null;

  const [ticketsAll, txAll, balancesAll] = await Promise.all([
    includeTickets ? getTicketsAll() : Promise.resolve([]),
    includeTransactions ? getTransactionsAll() : Promise.resolve([]),
    includeStock ? getBalancesAll() : Promise.resolve([]),
  ]);
  const packsAll = dedupeRowsById(
    includePacks || includeContainers || includeTickets ? await getPacksAll() : []
  );
  const containersAll = includeContainers ? await getContainersAll() : [];
  const packById = new Map(packsAll.map((p) => [String(p.id), p]));

  /* Tickets — no direct commodity; we filter by linked pack's commodity when commodityIds is set. */
  let tickets = [];
  if (includeTickets) {
    const packById = new Map(packsAll.map((p) => [String(p.id), p]));
    tickets = ticketsAll
      .filter((t) => dateInRange(t.date, range))
      .filter((t) => ticketMatchesAnyCustomer(t, customers))
      .filter((t) => ticketMatchesCommodity(t, commodityIds, commodityDirectory, packById));
    tickets = enrichReportTickets(tickets, {
      customerDirectory,
      commodityDirectory,
      testsCatalog,
    });
  }

  /* Transactions — `commodity` string + `accountId`/`account`. */
  let transactions = [];
  if (includeTransactions) {
    transactions = txAll
      .filter((t) => dateInRange(t.transactionDate, range))
      .filter((t) => customerMatchesAny(t, customers))
      .filter((t) => commodityMatches(t, commodityIds, commodityDirectory));
  }

  /* Packs — `customer` is a name string. Filter by pack date. */
  let packs = [];
  if (includePacks) {
    packs = dedupeRowsById(
      packsAll
        .filter((p) => reportDateMatches(p, null, range))
        .filter((p) => customerMatchesAny(p, customers))
        .filter((p) => commodityMatches(p, commodityIds, commodityDirectory))
        .map((p) => enrichReportPack(p, customerDirectory, commodityDirectory))
    );
  }

  /* Containers — from the cross-pack containers API (same source as the schedule containers view). */
  let containers = [];
  if (includeContainers) {
    containers = containersAll
      .filter((c) => containerMatchesReportFilters(c, packById.get(String(c.packId)), customers, commodityIds, commodityDirectory, range))
      .map((c) => containerReportRowFromList(c, packById.get(String(c.packId))));
  }

  /* Stock on Hand — point-in-time snapshot; we don't replay history. */
  let stockOnHand = [];
  if (includeStock) {
    stockOnHand = balancesAll
      .filter((b) => customerMatchesAny(b, customers))
      .filter((b) => commodityMatches(b, commodityIds, commodityDirectory));
  }

  const reportLabel = buildReportLabel({ customer: reportCustomer, customers, commodity: null });
  const reportKey = customers.length > 1 ? "combined" : customer?.id ?? "all";

  return {
    range,
    customer: reportCustomer,
    customers: customers.length > 1 ? customers : undefined,
    reportLayout: customers.length > 1 ? REPORT_LAYOUT_COMBINED : REPORT_LAYOUT_SPLIT,
    reportLabel,
    reportKey,
    tickets,
    transactions,
    containers,
    packs,
    stockOnHand,
    snapshotAsAt: range?.to || new Date().toISOString().slice(0, 10),
  };
}

/**
 * Build one or more report payloads depending on layout.
 * Split: one report per customer (multi-customer) or per commodity (multi-commodity, single customer).
 * Combined: a single cumulative report across all selected customers and commodities.
 */
export async function collectReports({
  dateRange,
  customerIds = [],
  commodityIds = [],
  sections = ALL_SECTIONS,
  layout = REPORT_LAYOUT_SPLIT,
} = {}) {
  if (!customerIds.length) return [];

  if (layout === REPORT_LAYOUT_COMBINED || !needsReportLayoutChoice(customerIds, commodityIds)) {
    return [
      await collectReportData({
        dateRange,
        customerIds,
        commodityIds,
        sections,
      }),
    ];
  }

  if (customerIds.length > 1) {
    const reports = [];
    for (const cid of customerIds) {
      const report = await collectReportData({
        dateRange,
        customerId: cid,
        commodityIds,
        sections,
      });
      reports.push({
        ...report,
        reportLayout: REPORT_LAYOUT_SPLIT,
        reportKey: cid,
        reportLabel: buildReportLabel({ customer: report.customer, customers: null, commodity: null }),
      });
    }
    return reports;
  }

  const commodityDirectory = await fetchCommodityDirectory();
  const reports = [];
  for (const commodityId of commodityIds) {
    const commodity = commodityDirectory.find((c) => sameId(c.id, commodityId)) || null;
    const report = await collectReportData({
      dateRange,
      customerId: customerIds[0],
      commodityIds: [commodityId],
      sections,
    });
    reports.push({
      ...report,
      commodity,
      reportLayout: REPORT_LAYOUT_SPLIT,
      reportKey: `${customerIds[0]}-${commodityId}`,
      reportLabel: buildReportLabel({ customer: report.customer, customers: null, commodity }),
    });
  }
  return reports;
}
