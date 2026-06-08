"use client";

/**
 * Builds a per-customer CSV bundle from the output of `collectReportData`.
 *
 * Each bundle is a single zip containing one .csv per enabled section plus a
 * summary.txt header. Column lists mirror the on-screen Clutch Tables; if a
 * column doesn't exist on a row, the cell is empty.
 */

import JSZip from "jszip";

import { ALL_SECTIONS, SECTION_LABELS } from "@/lib/reports-data";

function escapeCell(value) {
  if (value === null || value === undefined) return "";
  const s = typeof value === "string" ? value : String(value);
  if (s === "") return "";
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toCsv(headers, rows) {
  const headerLine = headers.map((h) => escapeCell(h.label)).join(",");
  const lines = [headerLine];
  for (const row of rows) {
    lines.push(headers.map((h) => escapeCell(h.get ? h.get(row) : row[h.key])).join(","));
  }
  return lines.join("\r\n");
}

/* ------------ Section column definitions ------------ */

const TICKET_COLUMNS = [
  { key: "id", label: "Ticket ID" },
  { key: "date", label: "Date" },
  { key: "type", label: "Direction", get: (r) => (r.type === "out" ? "Outgoing" : "Incoming") },
  { key: "status", label: "Status" },
  { key: "ticketReference", label: "Reference" },
  { key: "customerId", label: "Customer ID" },
  { key: "commodityId", label: "Commodity ID" },
  { key: "netT", label: "Net (T)" },
  { key: "truck", label: "Truck", get: (r) => r.truck?.name || "" },
  { key: "driver", label: "Driver", get: (r) => r.truck?.driver || "" },
  { key: "notes", label: "Notes" },
];

const TRANSACTION_COLUMNS = [
  { key: "id", label: "Transaction ID" },
  { key: "transactionDate", label: "Date", get: (r) => String(r.transactionDate || "").slice(0, 10) },
  { key: "transactionType", label: "Type" },
  { key: "ticketId", label: "Ticket" },
  { key: "account", label: "Account" },
  { key: "accountType", label: "Account Type" },
  { key: "commodity", label: "Commodity" },
  { key: "location", label: "Location" },
  { key: "quantity", label: "Quantity (MT)", get: (r) => Number(r.quantity ?? 0).toFixed(3) },
  { key: "status", label: "Status" },
  { key: "reference", label: "Reference" },
];

const CONTAINER_COLUMNS = [
  { key: "packId", label: "Pack ID" },
  { key: "order", label: "Order" },
  { key: "containerNumber", label: "Container No" },
  { key: "containerCode", label: "Size" },
  { key: "isoCode", label: "ISO" },
  { key: "sealNumber", label: "Seal" },
  { key: "releaseNumber", label: "Release" },
  { key: "status", label: "Status" },
  { key: "ecrSubmitted", label: "ECR Submitted", get: (r) => (r.ecrSubmitted ? "Yes" : "No") },
  { key: "customer", label: "Customer" },
  { key: "commodity", label: "Commodity" },
  { key: "vessel", label: "Vessel" },
  { key: "jobReference", label: "Job Ref" },
  { key: "packDate", label: "Pack Date" },
];

const PACK_COLUMNS = [
  { key: "id", label: "Pack ID" },
  { key: "date", label: "Date" },
  { key: "status", label: "Status" },
  { key: "importExport", label: "I/E" },
  { key: "customer", label: "Customer" },
  { key: "commodity", label: "Commodity" },
  { key: "jobReference", label: "Job Ref" },
  { key: "vessel", label: "Vessel" },
  { key: "etd", label: "ETD" },
  { key: "containerCode", label: "Container" },
  { key: "containersRequired", label: "# Containers" },
  { key: "mtTotal", label: "MT Total" },
];

const STOCK_COLUMNS = [
  { key: "accountId", label: "Account ID" },
  { key: "accountName", label: "Account" },
  { key: "accountType", label: "Account Type" },
  { key: "commodityName", label: "Commodity" },
  { key: "locationName", label: "Location" },
  { key: "quantity", label: "Quantity", get: (r) => Number(r.quantity ?? 0).toFixed(3) },
  { key: "unit", label: "Unit" },
];

export const SECTION_DEFS = {
  tickets: { columns: TICKET_COLUMNS, file: "tickets.csv" },
  transactions: { columns: TRANSACTION_COLUMNS, file: "transactions.csv" },
  containers: { columns: CONTAINER_COLUMNS, file: "containers.csv" },
  packs: { columns: PACK_COLUMNS, file: "packs.csv" },
  stockOnHand: { columns: STOCK_COLUMNS, file: "stock-on-hand.csv" },
};

/* ------------ Bundle builder ------------ */

function safeName(value, fallback) {
  const s = String(value ?? "").replace(/[^A-Za-z0-9._-]+/g, "_").replace(/^_+|_+$/g, "");
  return s || fallback;
}

export function buildBundleFileName(report, { source = "ad-hoc", cadenceLabel = "" } = {}) {
  const code = safeName(report.customer?.code || report.customer?.name, "all");
  const range = report.range?.from && report.range?.to
    ? report.range.from === report.range.to
      ? report.range.from
      : `${report.range.from}_to_${report.range.to}`
    : new Date().toISOString().slice(0, 10);
  const tag = cadenceLabel || source;
  return `${code}_${safeName(tag, "report")}_${range}.zip`;
}

function buildSummary(report, { source, cadenceLabel, ranBy }) {
  const lines = [];
  lines.push("Mahonys Packing — Customer Report");
  lines.push("");
  lines.push(`Customer: ${report.customer ? `${report.customer.name}${report.customer.code ? ` (${report.customer.code})` : ""}` : "All customers"}`);
  lines.push(`Source:   ${cadenceLabel || source || "ad-hoc"}`);
  if (report.range?.from || report.range?.to) {
    lines.push(`Range:    ${report.range?.from || "?"} → ${report.range?.to || "?"}`);
  } else {
    lines.push("Range:    (no range filter)");
  }
  lines.push(`Stock on Hand snapshot: as at ${report.snapshotAsAt || ""}`);
  lines.push(`Generated: ${new Date().toISOString()}`);
  if (ranBy) lines.push(`Generated by: ${ranBy}`);
  lines.push("");
  lines.push("Row counts:");
  for (const key of ALL_SECTIONS) {
    const count = Array.isArray(report[key]) ? report[key].length : 0;
    lines.push(`  ${SECTION_LABELS[key].padEnd(16)} ${count}`);
  }
  return lines.join("\r\n");
}

/**
 * Build a single customer's zip blob.
 *
 * @param {object} report  output from collectReportData
 * @param {object} [opts]
 * @param {string[]} [opts.sections]  which sections to include (defaults: all that have rows)
 * @param {string} [opts.source]      "ad-hoc" | "daily" | "weekly" | "monthly" | "yearly"
 * @param {string} [opts.cadenceLabel]
 * @param {string} [opts.ranBy]
 */
export async function buildCustomerBundle(report, opts = {}) {
  const sections = (opts.sections && opts.sections.length ? opts.sections : ALL_SECTIONS).filter((s) => SECTION_DEFS[s]);
  const zip = new JSZip();
  zip.file("summary.txt", buildSummary(report, opts));
  for (const key of sections) {
    const def = SECTION_DEFS[key];
    const rows = Array.isArray(report[key]) ? report[key] : [];
    zip.file(def.file, toCsv(def.columns, rows));
  }
  const blob = await zip.generateAsync({ type: "blob" });
  return { blob, fileName: buildBundleFileName(report, opts) };
}

/**
 * Build a zip-of-zips when a single run covers many customers (used by ad-hoc
 * download when the user has selected more than one). For a single customer
 * the caller should use `buildCustomerBundle` directly.
 */
export async function buildMultiBundle(reports, opts = {}) {
  const outer = new JSZip();
  for (const report of reports) {
    const { blob, fileName } = await buildCustomerBundle(report, opts);
    const arrayBuffer = await blob.arrayBuffer();
    outer.file(fileName, arrayBuffer);
  }
  const blob = await outer.generateAsync({ type: "blob" });
  const rangePart =
    reports[0]?.range?.from && reports[0]?.range?.to
      ? reports[0].range.from === reports[0].range.to
        ? reports[0].range.from
        : `${reports[0].range.from}_to_${reports[0].range.to}`
      : new Date().toISOString().slice(0, 10);
  const tag = opts.cadenceLabel || opts.source || "ad-hoc";
  return { blob, fileName: `reports_${safeName(tag, "bundle")}_${rangePart}.zip` };
}

/** Triggers a browser download for a blob. */
export function downloadBlob(blob, fileName) {
  if (typeof window === "undefined") return;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Build a filename for an individual CSV file.
 * e.g. "ACME_tickets_2026-01-01_to_2026-01-31.csv"
 */
export function buildCsvFileName(report, sectionKey, { source = "ad-hoc", cadenceLabel = "" } = {}) {
  const code = safeName(report.customer?.code || report.customer?.name, "all");
  const range =
    report.range?.from && report.range?.to
      ? report.range.from === report.range.to
        ? report.range.from
        : `${report.range.from}_to_${report.range.to}`
      : new Date().toISOString().slice(0, 10);
  const tag = cadenceLabel || source;
  return `${code}_${sectionKey}_${safeName(tag, "report")}_${range}.csv`;
}

/**
 * Download every enabled section for a single customer report as separate CSV files.
 * Files are triggered sequentially with a short delay to avoid browser popup blockers.
 */
export async function downloadAllCsvs(report, opts = {}) {
  const sections = (opts.sections && opts.sections.length ? opts.sections : ALL_SECTIONS).filter(
    (s) => SECTION_DEFS[s]
  );
  for (let i = 0; i < sections.length; i++) {
    const key = sections[i];
    const def = SECTION_DEFS[key];
    const rows = Array.isArray(report[key]) ? report[key] : [];
    const csv = toCsv(def.columns, rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const fileName = buildCsvFileName(report, key, opts);
    // Stagger downloads slightly so the browser doesn't suppress them.
    if (i > 0) await new Promise((r) => setTimeout(r, 150));
    downloadBlob(blob, fileName);
  }
}

/**
 * Download all sections for multiple customer reports as individual CSV files.
 * Files are named with the customer code prefix so they sort together.
 */
export async function downloadAllCsvsMulti(reports, opts = {}) {
  for (const report of reports) {
    await downloadAllCsvs(report, opts);
  }
}
