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
import { fetchTickets } from "@/lib/ticketing-api";
import { fetchAccountBalances, fetchTransactions } from "@/lib/transactions-api";
import { fetchPackRows } from "@/lib/pack-schedule-store";

export const ALL_SECTIONS = ["tickets", "transactions", "containers", "packs", "stockOnHand"];

export const SECTION_LABELS = {
  tickets: "Tickets",
  transactions: "Transactions",
  containers: "Containers",
  packs: "Packs",
  stockOnHand: "Stock on Hand",
};

/* ------------------------------------------------------------------ */
/* Customer + commodity reference helpers                              */
/* ------------------------------------------------------------------ */

export function getCustomerDirectory() {
  // CUSTOMER_CONTACT_ROWS holds the rich shape; fall back to MASTER for entries that only exist there.
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

export function getCommodityDirectory() {
  const rows = COMMODITY_MASTER_ROWS.map((r) => ({
    id: Number(r.id),
    description: r.description,
    commodityCode: r.commodityCode,
    commodityTypeName: r.commodityTypeName,
  }));
  return rows.sort((a, b) => String(a.description).localeCompare(String(b.description)));
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
  const customer = dir.find((c) => Number(c.id) === Number(customerId));
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
  const ids = new Set(commodityIds.map(Number));
  const rowId = row.commodityId ?? row.commodity_id;
  if (rowId != null && ids.has(Number(rowId))) return true;
  // Some sources only carry the commodity description string. Resolve via dir.
  const desc = (row.commodity ?? row.commodityName ?? row.commodity_name ?? "").trim().toLowerCase();
  if (!desc) return false;
  for (const id of ids) {
    const entry = commodityDirectory.find((c) => Number(c.id) === id);
    if (entry && entry.description.trim().toLowerCase() === desc) return true;
  }
  return false;
}

function customerMatches(row, customer) {
  if (!customer) return true;
  const rowId = row.customerId ?? row.customer_id ?? row.accountId ?? row.account_id;
  if (rowId != null && Number(rowId) === Number(customer.id)) return true;
  const name = (row.customer ?? row.account ?? row.accountName ?? row.account_name ?? "")
    .toString()
    .trim()
    .toLowerCase();
  if (!name) return false;
  if (customer.name && name === customer.name.toLowerCase()) return true;
  if (customer.code && name === customer.code.toLowerCase()) return true;
  return false;
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

async function getTicketsAll() {
  return safeFetch(() => fetchTickets(), []);
}

async function getTransactionsAll() {
  return safeFetch(() => fetchTransactions(), []);
}

async function getBalancesAll() {
  return safeFetch(() => fetchAccountBalances(), []);
}

async function getPacksAll() {
  try {
    const { rows } = await fetchPackRows();
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

/* ------------------------------------------------------------------ */
/* Public: data collection                                              */
/* ------------------------------------------------------------------ */

/**
 * @param {object} opts
 * @param {{from:string,to:string}} opts.dateRange
 * @param {number|null} [opts.customerId]  resolved to a customer in the directory; null = no customer filter
 * @param {number[]} [opts.commodityIds]
 * @param {string[]} [opts.sections]       which of ALL_SECTIONS to include; defaults to all
 */
export async function collectReportData({ dateRange, customerId = null, commodityIds = [], sections = ALL_SECTIONS } = {}) {
  const includeTickets = sections.includes("tickets");
  const includeTransactions = sections.includes("transactions");
  const includeContainers = sections.includes("containers");
  const includePacks = sections.includes("packs");
  const includeStock = sections.includes("stockOnHand");

  const customer = customerId != null ? getCustomerDirectory().find((c) => Number(c.id) === Number(customerId)) || null : null;
  const commodityDirectory = getCommodityDirectory();
  const range = dateRange && (dateRange.from || dateRange.to) ? dateRange : null;

  const [ticketsAll, txAll, balancesAll] = await Promise.all([
    includeTickets ? getTicketsAll() : Promise.resolve([]),
    includeTransactions ? getTransactionsAll() : Promise.resolve([]),
    includeStock ? getBalancesAll() : Promise.resolve([]),
  ]);
  const packsAll = includePacks || includeContainers || includeTickets ? await getPacksAll() : [];

  /* Tickets — no direct commodity; we filter by linked pack's commodity when commodityIds is set. */
  let tickets = [];
  if (includeTickets) {
    const packById = new Map(packsAll.map((p) => [Number(p.id), p]));
    tickets = ticketsAll
      .filter((t) => dateInRange(t.date, range))
      .filter((t) => customerMatches({ customerId: t.customerId, customer: "" }, customer))
      .filter((t) => {
        if (!commodityIds || commodityIds.length === 0) return true;
        // Tickets may carry commodityId directly (see ticketing-api ticketFromApi).
        if (t.commodityId != null) return new Set(commodityIds.map(Number)).has(Number(t.commodityId));
        // Otherwise inspect the linked pack if any.
        const linkedPackId = t.packId ?? t.pack_id;
        if (!linkedPackId) return false;
        const linkedPack = packById.get(Number(linkedPackId));
        if (!linkedPack) return false;
        return commodityMatches({ commodity: linkedPack.commodity }, commodityIds, commodityDirectory);
      });
  }

  /* Transactions — `commodity` string + `accountId`/`account`. */
  let transactions = [];
  if (includeTransactions) {
    transactions = txAll
      .filter((t) => dateInRange(t.transactionDate, range))
      .filter((t) => customerMatches(t, customer))
      .filter((t) => commodityMatches(t, commodityIds, commodityDirectory));
  }

  /* Packs — `customer` is a name string. Filter by pack date. */
  let packs = [];
  if (includePacks) {
    packs = packsAll
      .filter((p) => dateInRange(p.date, range))
      .filter((p) => customerMatches(p, customer))
      .filter((p) => commodityMatches(p, commodityIds, commodityDirectory));
  }

  /* Containers — flatten from packs that survived the same filter. */
  let containers = [];
  if (includeContainers) {
    const visiblePacks = packsAll
      .filter((p) => dateInRange(p.date, range))
      .filter((p) => customerMatches(p, customer))
      .filter((p) => commodityMatches(p, commodityIds, commodityDirectory));
    for (const p of visiblePacks) {
      for (const c of p.containers || []) {
        containers.push({
          packId: p.id,
          customer: p.customer,
          commodity: p.commodity,
          packDate: p.date || "",
          vessel: p.vessel || "",
          jobReference: p.jobReference || "",
          order: c.order,
          containerNumber: c.containerNumber || "",
          containerCode: c.containerCode || p.containerCode || "",
          isoCode: c.containerIsoCode || "",
          sealNumber: c.sealNumber || "",
          releaseNumber: c.releaseNumber || "",
          status: c.status || "",
          ecrSubmitted: Boolean(c.ecrSubmitted),
        });
      }
    }
  }

  /* Stock on Hand — point-in-time snapshot; we don't replay history. */
  let stockOnHand = [];
  if (includeStock) {
    stockOnHand = balancesAll
      .filter((b) => customerMatches(b, customer))
      .filter((b) => commodityMatches(b, commodityIds, commodityDirectory));
  }

  return {
    range,
    customer,
    tickets,
    transactions,
    containers,
    packs,
    stockOnHand,
    snapshotAsAt: range?.to || new Date().toISOString().slice(0, 10),
  };
}
