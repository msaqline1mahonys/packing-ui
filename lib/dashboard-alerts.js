"use client";

import { fetchPackRows, fetchContainerRows } from "@/lib/pack-schedule-store";
import { fetchTickets } from "@/lib/ticketing-api";
import { defaultTurnaroundDateRange } from "@/lib/ticket-turnaround";
import { fetchAccountBalances, fetchLocationUtilization } from "@/lib/transactions-api";
import { hasPendingVesselScheduleUpdate } from "@/lib/pack-vessel-sync";
import { containerStage } from "@/lib/packers-work-store";
import { isImportPack } from "@/lib/pack-import";
import { ACTIVE_PACK_STATUSES } from "@/lib/packing-container-ui";
import { hasPermission } from "@/lib/use-user-permissions";
import { buildDashboardMetrics } from "@/lib/dashboard-metrics";

export const SEVERITY_ORDER = { critical: 0, due_soon: 1, info: 2 };
export const SEVERITY_LABELS = {
  critical: "Critical",
  due_soon: "Due soon",
  info: "Open",
};

export const CATEGORY_ORDER = { Packing: 0, Containers: 1, Ticketing: 2 };

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function stripDate(value) {
  if (value == null) return "";
  const str = String(value).trim();
  if (!str) return "";
  const match = str.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : "";
}

function addDays(isoDate, days) {
  const d = new Date(`${isoDate}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function packLabel(pack) {
  const job = pack.jobReference ?? pack.job_reference ?? "";
  const num = pack.packNumber ?? pack.pack_number ?? "";
  if (job && num) return `${job} (${num})`;
  return job || num || `Pack #${pack.id}`;
}

function containerLabel(c) {
  const num = c.containerNumber ?? c.container_number ?? c.containerNo ?? "";
  return num || `Container on pack ${c.packNumber ?? c.pack_number ?? c.packId ?? ""}`;
}

async function safeFetchRows(fn) {
  try {
    const result = await fn();
    const rows = result?.rows ?? result;
    return { rows: Array.isArray(rows) ? rows : [], error: null };
  } catch (err) {
    return { rows: [], error: err?.message || "Failed to load data." };
  }
}

async function safeFetchTickets() {
  try {
    const { dateFrom, dateTo } = defaultTurnaroundDateRange();
    const rows = await fetchTurnaroundTickets({ dateFrom, dateTo });
    return { rows, error: null };
  } catch (err) {
    return { rows: [], error: err?.message || "Failed to load tickets." };
  }
}

export async function fetchTurnaroundTickets({ dateFrom = null, dateTo = null } = {}) {
  const fetches = [];

  if (dateFrom || dateTo) {
    fetches.push(
      fetchTickets({
        ...(dateFrom ? { dateFrom } : {}),
        ...(dateTo ? { dateTo } : {}),
        perPage: 500,
      }),
    );
  } else {
    fetches.push(fetchTickets({ perPage: 500 }));
  }

  fetches.push(
    fetchTickets({
      status: "booked,processing",
      perPage: 200,
    }),
  );

  const results = await Promise.all(fetches);
  const byId = new Map();
  for (const rows of results) {
    for (const row of rows || []) {
      if (row?.id) byId.set(row.id, row);
    }
  }
  return [...byId.values()];
}

async function safeFetchBalances() {
  try {
    const rows = await fetchAccountBalances({ excludeSystemAccounts: true });
    return { rows: Array.isArray(rows) ? rows : [], error: null };
  } catch (err) {
    return { rows: [], error: err?.message || "Failed to load stock balances." };
  }
}

async function safeFetchLocationUtil() {
  try {
    const rows = await fetchLocationUtilization({ excludeSystemAccounts: true });
    return { rows: Array.isArray(rows) ? rows : [], error: null };
  } catch (err) {
    return { rows: [], error: err?.message || "Failed to load location utilization." };
  }
}

function buildPackAlerts(packs, today) {
  const alerts = [];
  const inThreeDays = addDays(today, 3);
  const activeSet = new Set(ACTIVE_PACK_STATUSES);

  for (const pack of packs) {
    if (!activeSet.has(pack.status)) continue;

    const id = pack.id;
    const label = packLabel(pack);
    const cutoff = stripDate(pack.vesselCutoffDate ?? pack.vessel_cutoff_date);
    const packingStart = stripDate(pack.packingStartDate ?? pack.packing_start_date);
    const packHref = `/packing-schedule/new-pack-form?id=${id}`;
    const packersHref = `/packers-schedule/${id}`;

    if (hasPendingVesselScheduleUpdate(pack)) {
      alerts.push({
        id: `pack-vessel-${id}`,
        severity: "critical",
        category: "Packing",
        title: "Vessel schedule changed",
        detail: `${label} — review and acknowledge the updated schedule`,
        href: "/packing-schedule",
        sortDate: stripDate(getVesselUpdatedAt(pack)) || today,
      });
    }

    if (cutoff && cutoff < today) {
      alerts.push({
        id: `pack-cutoff-past-${id}`,
        severity: "critical",
        category: "Packing",
        title: "Cut-off passed",
        detail: `${label} — cut-off was ${cutoff}`,
        href: "/packing-schedule",
        sortDate: cutoff,
      });
    } else if (cutoff && cutoff >= today && cutoff <= inThreeDays) {
      alerts.push({
        id: `pack-cutoff-soon-${id}`,
        severity: "due_soon",
        category: "Packing",
        title: "Cut-off approaching",
        detail: `${label} — cut-off ${cutoff}`,
        href: "/packing-schedule",
        sortDate: cutoff,
      });
    }

    if (
      packingStart &&
      packingStart < today &&
      (pack.status === "Inprogress" || pack.status === "Pending" || pack.status === "On Hold")
    ) {
      alerts.push({
        id: `pack-start-overdue-${id}`,
        severity: "due_soon",
        category: "Packing",
        title: "Packing start overdue",
        detail: `${label} — was scheduled ${packingStart}`,
        href: packersHref,
        sortDate: packingStart,
      });
    } else if (packingStart === today) {
      alerts.push({
        id: `pack-start-today-${id}`,
        severity: "info",
        category: "Packing",
        title: "Packing starts today",
        detail: label,
        href: packersHref,
        sortDate: packingStart,
      });
    }

    if (pack.status === "Awaiting Approval") {
      alerts.push({
        id: `pack-approval-${id}`,
        severity: "due_soon",
        category: "Packing",
        title: "Awaiting approval",
        detail: label,
        href: packHref,
        sortDate: packingStart || cutoff || today,
      });
    }

    if (pack.status === "Pending Fumigation") {
      alerts.push({
        id: `pack-fumigation-${id}`,
        severity: "due_soon",
        category: "Packing",
        title: "Pending fumigation",
        detail: label,
        href: `/fumigation/records/${id}`,
        sortDate: packingStart || cutoff || today,
      });
    }

    if (pack.blendPending) {
      alerts.push({
        id: `pack-blend-${id}`,
        severity: "due_soon",
        category: "Packing",
        title: "Blend not performed",
        detail: `${label} — blend transfer still pending`,
        href: packHref,
        sortDate: packingStart || today,
      });
    }
  }

  return alerts;
}

function getVesselUpdatedAt(pack) {
  return pack.vesselScheduleUpdatedAt ?? pack.vessel_schedule_updated_at ?? null;
}

function buildContainerAlerts(containers, packsById, today) {
  const alerts = [];

  for (const c of containers) {
    const packId = c.packId ?? c.pack_id;
    const pack = packsById.get(String(packId));
    const packStatus = c.packStatus ?? c.pack_status ?? pack?.status ?? "";
    const isImport = pack ? isImportPack(pack) : false;
    const stage = containerStage(c, isImport);
    const label = containerLabel(c);
    const packLabelStr = pack ? packLabel(pack) : "";

    if (stage === "PRA Failed") {
      alerts.push({
        id: `container-pra-failed-${c.id ?? label}`,
        severity: "critical",
        category: "Containers",
        title: "PRA failed",
        detail: packLabelStr ? `${label} on ${packLabelStr}` : label,
        href: "/packing-schedule/containers",
        sortDate: stripDate(c.startDate ?? c.start_date) || today,
      });
    }

    if (stage === "EC Failed") {
      alerts.push({
        id: `container-ec-failed-${c.id ?? label}`,
        severity: "critical",
        category: "Containers",
        title: "EC failed",
        detail: packLabelStr ? `${label} on ${packLabelStr}` : label,
        href: "/packing-schedule/containers",
        sortDate: stripDate(c.startDate ?? c.start_date) || today,
      });
    }

    const containerNum = String(c.containerNumber ?? c.container_number ?? c.containerNo ?? "").trim();
    if (packStatus === "Inprogress" && containerNum && stage === "Off Site") {
      alerts.push({
        id: `container-offsite-${c.id ?? label}`,
        severity: "due_soon",
        category: "Containers",
        title: "Container not on site",
        detail: packLabelStr ? `${label} on ${packLabelStr}` : label,
        href: "/packing-schedule/containers",
        sortDate: stripDate(c.startDate ?? c.start_date) || today,
      });
    }
  }

  return alerts;
}

function buildTicketAlerts(tickets, today) {
  const alerts = [];

  for (const ticket of tickets) {
    const status = String(ticket.status ?? "").toLowerCase();
    if (status === "completed") continue;

    const id = ticket.id;
    const type = ticket.type === "out" ? "out" : "in";
    const href = type === "out" ? `/ticketing/outgoing/${id}` : `/ticketing/in/${id}`;
    const ref = ticket.ticketReference ?? ticket.ticketRef ?? ticket.bookingRef ?? "";
    const customer = ticket.customerName ?? "";
    const date = stripDate(ticket.date) || today;
    const isDue = date <= today;
    const detail = [ref, customer].filter(Boolean).join(" · ") || `Ticket #${id}`;

    alerts.push({
      id: `ticket-open-${id}`,
      severity: isDue ? "due_soon" : "info",
      category: "Ticketing",
      title: type === "out" ? "Open outgoing ticket" : "Open incoming ticket",
      detail: `${detail}${date ? ` — ${date}` : ""}`,
      href,
      sortDate: date,
    });
  }

  return alerts;
}

export function sortAlerts(alerts) {
  return [...alerts].sort((a, b) => {
    const sev = (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9);
    if (sev !== 0) return sev;
    const cat = (CATEGORY_ORDER[a.category] ?? 9) - (CATEGORY_ORDER[b.category] ?? 9);
    if (cat !== 0) return cat;
    return String(a.sortDate).localeCompare(String(b.sortDate));
  });
}

export function groupAlertsByCategory(alerts) {
  const sorted = sortAlerts(alerts);
  const groups = [];
  let current = null;

  for (const alert of sorted) {
    if (!current || current.category !== alert.category) {
      current = { category: alert.category, items: [] };
      groups.push(current);
    }
    current.items.push(alert);
  }

  return groups;
}

export function countBySeverity(alerts) {
  const counts = { critical: 0, due_soon: 0, info: 0 };
  for (const a of alerts) {
    if (counts[a.severity] != null) counts[a.severity] += 1;
  }
  return counts;
}

/**
 * Fetch operational data, build alerts and dashboard metrics.
 */
export async function fetchDashboard() {
  const canPacking = hasPermission("packing.schedule.view");
  const canTicketing = hasPermission("ticketing.tickets.view");
  const canStock = hasPermission("stock.view");
  const today = todayIso();

  const [
    packResult,
    containerResult,
    ticketResult,
    balanceResult,
    locationResult,
  ] = await Promise.all([
    canPacking
      ? safeFetchRows(() => fetchPackRows({ status: ACTIVE_PACK_STATUSES, perPage: 500 }))
      : Promise.resolve({ rows: [], error: null }),
    canPacking
      ? safeFetchRows(() =>
          fetchContainerRows({ packStatus: ACTIVE_PACK_STATUSES, perPage: 500 }),
        )
      : Promise.resolve({ rows: [], error: null }),
    canTicketing ? safeFetchTickets() : Promise.resolve({ rows: [], error: null }),
    canStock ? safeFetchBalances() : Promise.resolve({ rows: [], error: null }),
    canStock ? safeFetchLocationUtil() : Promise.resolve({ rows: [], error: null }),
  ]);

  const packs = packResult.rows;
  const containers = containerResult.rows;
  const tickets = ticketResult.rows;

  const packsById = new Map(packs.map((p) => [String(p.id), p]));
  const alerts = [];

  if (canPacking) {
    alerts.push(...buildPackAlerts(packs, today));
    alerts.push(...buildContainerAlerts(containers, packsById, today));
  }

  if (canTicketing) {
    alerts.push(...buildTicketAlerts(tickets, today));
  }

  const metrics = buildDashboardMetrics({
    packs,
    containers,
    tickets,
    balances: balanceResult.rows,
    locationUtil: locationResult.rows,
    today,
  });

  return {
    alerts: sortAlerts(alerts),
    metrics,
    errors: {
      packing: packResult.error || containerResult.error || null,
      ticketing: ticketResult.error || null,
      stock: balanceResult.error || locationResult.error || null,
    },
    permissions: { packing: canPacking, ticketing: canTicketing, stock: canStock },
  };
}

/** @deprecated Use fetchDashboard — kept for compatibility */
export async function fetchDashboardAlerts() {
  const result = await fetchDashboard();
  return {
    alerts: result.alerts,
    errors: { packing: result.errors.packing, ticketing: result.errors.ticketing },
    permissions: { packing: result.permissions.packing, ticketing: result.permissions.ticketing },
  };
}
