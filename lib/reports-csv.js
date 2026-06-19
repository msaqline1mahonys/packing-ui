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
  { key: "ticketReference", label: "Ticket No." },
  { key: "date", label: "Date" },
  { key: "type", label: "Direction", get: (r) => (r.type === "out" ? "Outgoing" : "Incoming") },
  { key: "status", label: "Status" },
  { key: "customerDisplay", label: "Customer", get: (r) => r.customerDisplay || r.customerName || "" },
  { key: "customerCode", label: "Customer Code" },
  { key: "cmoReference", label: "CMO Ref" },
  { key: "commodityDisplay", label: "Commodity Grade", get: (r) => r.commodityDisplay || r.commodityGrade || "" },
  { key: "bookingRef", label: "Booking Ref" },
  { key: "ticketRef", label: "Ticket Ref" },
  { key: "additionalReference", label: "Additional Ref" },
  { key: "ngr", label: "NGR" },
  { key: "season", label: "Season" },
  { key: "netT", label: "Net (T)", get: (r) => (r.netT == null || Number.isNaN(Number(r.netT)) ? "" : Number(r.netT).toFixed(2)) },
  { key: "truckDisplay", label: "Truck" },
  { key: "truckDriver", label: "Driver" },
  { key: "testsFormatted", label: "Test Results" },
  { key: "commodityConfirmed", label: "Commodity Grade Confirmed", get: (r) => (r.commodityConfirmed ? "Yes" : "No") },
  { key: "commodityOverrideReason", label: "Commodity Grade Override Reason" },
  { key: "signoff", label: "Sign-off" },
  { key: "notes", label: "Notes" },
];

const TRANSACTION_COLUMNS = [
  { key: "reference", label: "Reference" },
  { key: "transactionDate", label: "Date", get: (r) => String(r.transactionDate ?? r.transaction_date ?? "").slice(0, 10) },
  { key: "ticketReference", label: "Ticket No.", get: (r) => r.ticketReference ?? r.ticket_reference ?? "" },
  { key: "account", label: "Account" },
  { key: "commodity", label: "Commodity Grade" },
  { key: "location", label: "Location" },
  { key: "ticketType", label: "Ticket Type", get: (r) => String(r.ticketType ?? r.ticket_type ?? "").toUpperCase() },
  {
    key: "transactionType",
    label: "Trans Type",
    get: (r) => {
      const t = String(r.transactionType ?? r.transaction_type ?? "");
      return t ? t.charAt(0).toUpperCase() + t.slice(1) : "";
    },
  },
  {
    key: "quantity",
    label: "Quantity (MT)",
    get: (r) => {
      const qty = Number(r.quantity ?? 0);
      return `${qty >= 0 ? "+" : ""}${qty.toFixed(3)}`;
    },
  },
  { key: "status", label: "Status" },
];

function displayCell(value) {
  if (value == null || value === "") return "";
  if (typeof value === "string") return value;
  if (typeof value === "object") return String(value.name ?? value.description ?? value.label ?? "").trim();
  return String(value);
}

const CONTAINER_COLUMNS = [
  { key: "packNumber", label: "Pack No." },
  { key: "jobReference", label: "Job Ref", get: (r) => displayCell(r.jobReference ?? r.job_reference) },
  { key: "customer", label: "Customer", get: (r) => displayCell(r.customer) },
  { key: "commodity", label: "Commodity Grade", get: (r) => displayCell(r.commodity) },
  { key: "importExport", label: "I/E" },
  { key: "order", label: "Order" },
  { key: "containerNumber", label: "Container No", get: (r) => displayCell(r.containerNumber ?? r.container_number ?? r.containerNo) },
  { key: "containerSize", label: "Size", get: (r) => displayCell(r.containerSize ?? r.containerCode ?? r.container_code) },
  { key: "isoCode", label: "ISO", get: (r) => displayCell(r.isoCode ?? r.containerIsoCode ?? r.container_iso_code) },
  { key: "sealNumber", label: "Seal", get: (r) => displayCell(r.sealNumber ?? r.seal_number ?? r.sealNo) },
  { key: "releaseNumber", label: "Release", get: (r) => displayCell(r.releaseNumber ?? r.release_number) },
  { key: "stage", label: "Stage" },
  { key: "status", label: "Status" },
  { key: "onSite", label: "On Site" },
  { key: "emptyPark", label: "Empty Park" },
  { key: "transporter", label: "Transporter" },
  { key: "location", label: "Location" },
  { key: "packer", label: "Packer" },
  { key: "startDate", label: "Start Date" },
  { key: "nettWeight", label: "Nett MT" },
  { key: "emptyInspection", label: "Empty Insp." },
  { key: "grainInspection", label: "Grain Insp." },
  { key: "praStatus", label: "PRA Status" },
  { key: "pems", label: "ECR / GPPIR" },
  { key: "outLoaded", label: "Out Loaded" },
  { key: "packerSignoff", label: "Packer Sign-off" },
  { key: "aoSignoff", label: "AO Sign-off" },
  { key: "vessel", label: "Vessel" },
  { key: "etd", label: "ETD" },
  { key: "vesselCutoffDate", label: "Cut-off" },
  { key: "packDate", label: "Pack Date" },
  { key: "packStatus", label: "Pack Status" },
  { key: "packerNotes", label: "Packer Notes" },
];

const PACK_COLUMNS = [
  { key: "packNumber", label: "Pack No." },
  { key: "date", label: "Date" },
  { key: "status", label: "Status" },
  { key: "importExport", label: "I/E" },
  { key: "customerDisplay", label: "Customer", get: (r) => r.customerDisplay || displayCell(r.customer) },
  { key: "customerCode", label: "Customer Code" },
  { key: "exporter", label: "Exporter" },
  { key: "commodityDisplay", label: "Commodity Grade", get: (r) => r.commodityDisplay || displayCell(r.commodity) },
  { key: "commodityType", label: "Commodity Type" },
  { key: "jobReference", label: "Job Ref", get: (r) => displayCell(r.jobReference ?? r.job_reference) },
  { key: "vessel", label: "Vessel" },
  { key: "voyageNumber", label: "Voyage" },
  { key: "etd", label: "ETD" },
  { key: "vesselCutoffDate", label: "Cut-off" },
  { key: "packingStartDate", label: "Packing Start" },
  { key: "destinationCountry", label: "Destination Country" },
  { key: "destinationPort", label: "Destination Port" },
  { key: "containerCode", label: "Container Size" },
  { key: "containersRequired", label: "# Containers Req." },
  { key: "containersPacked", label: "Containers Packed" },
  { key: "onSiteContainers", label: "On Site" },
  { key: "mtTotal", label: "MT Total", get: (r) => (r.mtTotal != null && r.mtTotal !== "" ? Number(r.mtTotal).toFixed(1) : "") },
  { key: "actualPackedMt", label: "Actual Packed MT", get: (r) => (Number(r.actualPackedMt) > 0 ? Number(r.actualPackedMt).toFixed(1) : "") },
  { key: "emptyPark", label: "Empty Park" },
  { key: "fumigation", label: "Fumigation" },
  { key: "assignedPackersDisplay", label: "Assigned Packers" },
  { key: "packConfirmed", label: "Pack Confirmed", get: (r) => (r.packConfirmed ? "Yes" : "No") },
  { key: "jobNotes", label: "Job Notes" },
];

const STOCK_COLUMNS = [
  { key: "accountName", label: "Account" },
  { key: "accountType", label: "Account Type" },
  { key: "commodityName", label: "Commodity Grade" },
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
  if (report.customers?.length > 1) {
    lines.push(`Customers: ${report.customers.map((c) => c.name).join(", ")}`);
    lines.push(`Layout:    Combined`);
  } else if (report.commodity) {
    lines.push(`Customer:  ${report.customer ? report.customer.name : "All customers"}`);
    lines.push(`Commodity Grade: ${report.commodity.description || report.commodity.commodityCode || ""}`);
  } else {
    lines.push(`Customer: ${report.customer ? `${report.customer.name}${report.customer.code && report.customer.code !== "combined" ? ` (${report.customer.code})` : ""}` : "All customers"}`);
  }
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
