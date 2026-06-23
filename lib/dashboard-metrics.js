"use client";

import {
  containerHasCompleteChecks,
  countPackedContainers,
  totalPackedNettWeight,
} from "@/lib/packers-container-validation";
import { containerStage } from "@/lib/packers-work-store";
import { isImportPack } from "@/lib/pack-import";

const STAGE_KEYS = [
  "Draft",
  "Off Site",
  "On Site",
  "Packing",
  "EC Failed",
  "PRA Submitted",
  "PRA Passed",
  "PRA Failed",
  "Complete",
];

function stripDate(value) {
  if (value == null) return "";
  const str = String(value).trim();
  if (!str) return "";
  const match = str.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : "";
}

function round2(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

function ticketNetT(ticket) {
  const n = Number(ticket.netT);
  return Number.isFinite(n) ? n : 0;
}

function isCompletedTicket(ticket) {
  return String(ticket.status ?? "").toLowerCase() === "completed";
}

function isTodayTicket(ticket, today) {
  return stripDate(ticket.date) === today;
}

function containerStartDate(container) {
  return stripDate(container.startDate ?? container.start_date);
}

function aggregateNegative(rows, { getKey, getName, getExtra }) {
  const map = new Map();
  for (const row of rows) {
    if (row.quantity >= 0) continue;
    const key = getKey(row);
    const existing = map.get(key) ?? {
      key,
      name: getName(row),
      quantity: 0,
      ...(getExtra ? getExtra(row) : {}),
    };
    existing.quantity += row.quantity;
    map.set(key, existing);
  }
  return [...map.values()]
    .sort((a, b) => a.quantity - b.quantity)
    .map((item) => ({ ...item, quantity: round2(item.quantity) }));
}

function topLocations(locationUtil, limit = 6) {
  return [...(locationUtil || [])]
    .map((row) => ({
      id: row.locationId ?? row.location_id ?? row.id,
      name: row.locationName ?? row.location_name ?? row.name ?? "Location",
      totalStock: round2(row.totalStock ?? row.total_stock ?? 0),
      capacity: round2(row.capacity ?? 0),
      utilizationPct:
        row.utilizationPct ?? row.utilization_pct ?? null,
    }))
    .filter((row) => row.totalStock !== 0 || row.capacity > 0)
    .sort((a, b) => b.totalStock - a.totalStock)
    .slice(0, limit);
}

/**
 * Build operational KPIs from already-fetched dashboard datasets.
 */
export function buildDashboardMetrics({
  packs = [],
  containers = [],
  tickets = [],
  balances = [],
  locationUtil = [],
  today,
}) {
  const packsById = new Map(packs.map((p) => [String(p.id), p]));

  let tonsInToday = 0;
  let tonsOutTicketsToday = 0;
  let ticketsCompletedToday = 0;
  let ticketsOpenToday = 0;
  let openTicketsIn = 0;
  let openTicketsOut = 0;
  let openTonsIn = 0;
  let openTonsOut = 0;

  for (const ticket of tickets) {
    const isToday = isTodayTicket(ticket, today);
    const net = ticketNetT(ticket);
    const isIn = ticket.type !== "out";
    const completed = isCompletedTicket(ticket);

    if (completed && isToday) {
      ticketsCompletedToday += 1;
      if (isIn) tonsInToday += net;
      else tonsOutTicketsToday += net;
    }

    if (!completed) {
      if (isToday) ticketsOpenToday += 1;
      if (isIn) {
        openTicketsIn += 1;
        openTonsIn += net;
      } else {
        openTicketsOut += 1;
        openTonsOut += net;
      }
    }
  }

  const containersByStage = Object.fromEntries(STAGE_KEYS.map((k) => [k, 0]));
  let containersInPipeline = 0;
  let containersPackedToday = 0;
  let tonsPackedToday = 0;
  let containersWithNumber = 0;

  for (const container of containers) {
    const pack = packsById.get(String(container.packId ?? container.pack_id));
    const isImport = pack ? isImportPack(pack) : false;
    const stage = containerStage(container, isImport);
    if (containersByStage[stage] != null) containersByStage[stage] += 1;
    else containersByStage.Packing += 1;

    containersInPipeline += 1;

    const num = String(
      container.containerNumber ?? container.container_number ?? container.containerNo ?? "",
    ).trim();
    if (num) containersWithNumber += 1;

    const packed = containerHasCompleteChecks(container, { isImport });
    if (packed && containerStartDate(container) === today) {
      containersPackedToday += 1;
      const nett = Number(container.nettWeight ?? container.nett_weight);
      if (Number.isFinite(nett)) tonsPackedToday += nett;
    }
  }

  const activePackMt = round2(
    packs.reduce((sum, pack) => {
      const mt = Number(pack.mtTotal ?? pack.mt_total);
      return Number.isFinite(mt) ? sum + mt : sum;
    }, 0),
  );

  const pipelineContainers = containers.filter((c) => {
    const pack = packsById.get(String(c.packId ?? c.pack_id));
    return pack?.status === "Inprogress";
  });
  const pipelinePackedCount = countPackedContainers(pipelineContainers);
  const pipelinePackedMt = round2(totalPackedNettWeight(pipelineContainers));

  const balanceRows = (balances || []).map((row) => ({
    key: row.key,
    accountId: row.accountId,
    accountName: row.accountName ?? "",
    accountType: row.accountType ?? "customer",
    commodityId: row.commodityId,
    commodityName: row.commodityName ?? "",
    locationName: row.locationName ?? "",
    quantity: Number(row.quantity ?? 0),
    unit: row.unit ?? "MT",
  }));

  const totalStockMt = round2(balanceRows.reduce((sum, row) => sum + row.quantity, 0));
  const negativeRows = balanceRows.filter((row) => row.quantity < 0);

  const negativeAccounts = aggregateNegative(balanceRows, {
    getKey: (row) => `${row.accountType}:${row.accountId}`,
    getName: (row) => row.accountName || "Account",
    getExtra: (row) => ({ accountType: row.accountType }),
  });

  const negativeCommodities = aggregateNegative(balanceRows, {
    getKey: (row) => String(row.commodityId),
    getName: (row) => row.commodityName || "Commodity",
  });

  const negativeCustomers = negativeAccounts.filter((row) => row.accountType === "customer");

  return {
    today,
    flow: {
      tonsInToday: round2(tonsInToday),
      tonsOutTicketsToday: round2(tonsOutTicketsToday),
      tonsPackedToday: round2(tonsPackedToday),
      openTicketsIn,
      openTicketsOut,
      openTonsIn: round2(openTonsIn),
      openTonsOut: round2(openTonsOut),
    },
    throughput: {
      ticketsCompletedToday,
      ticketsOpenToday,
      containersPackedToday,
      containersInPipeline,
      containersWithNumber,
      containersByStage,
      pipelinePackedCount,
      pipelinePackedMt,
      activePackCount: packs.length,
      activePackMt,
    },
    stock: {
      totalStockMt,
      negativeBalanceCount: negativeRows.length,
      negativeCustomerCount: negativeCustomers.length,
      negativeCommodityCount: negativeCommodities.length,
      negativeAccounts: negativeAccounts.slice(0, 8),
      negativeCommodities: negativeCommodities.slice(0, 8),
      topLocations: topLocations(locationUtil),
    },
  };
}

export function formatMt(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "0.00";
  return n.toFixed(2);
}
