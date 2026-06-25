"use client";

export function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function addDays(isoDate, days) {
  const d = new Date(`${isoDate}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function stripTicketDate(value) {
  if (value == null) return "";
  const str = String(value).trim();
  if (!str) return "";
  const match = str.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : "";
}

export function defaultTurnaroundDateRange() {
  const dateTo = todayIso();
  return { dateFrom: addDays(dateTo, -6), dateTo };
}

export const TURNAROUND_RANGE_PRESETS = [
  { id: "7d", label: "Last 7 days", days: 6 },
  { id: "30d", label: "Last 30 days", days: 29 },
  { id: "all", label: "All time", days: null },
];

export function presetToDateRange(presetId) {
  const preset = TURNAROUND_RANGE_PRESETS.find((p) => p.id === presetId);
  if (!preset || preset.days == null) {
    return { dateFrom: null, dateTo: null };
  }
  const dateTo = todayIso();
  return { dateFrom: addDays(dateTo, -preset.days), dateTo };
}

export function ticketDateInRange(ticket, dateFrom, dateTo) {
  const d = stripTicketDate(ticket.date);
  if (!d) return false;
  if (dateFrom && d < dateFrom) return false;
  if (dateTo && d > dateTo) return false;
  return true;
}

export function formatDateRangeLabel(dateFrom, dateTo) {
  if (!dateFrom && !dateTo) return "All time";
  if (dateFrom && dateTo) {
    if (dateFrom === dateTo) return dateFrom;
    return `${dateFrom} – ${dateTo}`;
  }
  if (dateFrom) return `From ${dateFrom}`;
  return `Until ${dateTo}`;
}

export const EMPTY_TURNAROUND_METRICS = {
  avgMinutesToday: null,
  avgMinutesInRange: null,
  trucksOnSiteCount: 0,
  avgOnSiteMinutes: null,
  completedToday: [],
  completedInRange: [],
  onSiteNow: [],
  exportRows: [],
  dateFrom: null,
  dateTo: null,
};

export function formatTurnaroundMinutes(minutes) {
  const n = Number(minutes);
  if (!Number.isFinite(n) || n < 0) return "—";
  if (n < 60) return `${Math.round(n)}m`;
  const hours = Math.floor(n / 60);
  const mins = Math.round(n % 60);
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

export function formatWeighDatetime(value) {
  if (!value) return "—";
  const str = String(value).trim();
  if (!str) return "—";
  const match = str.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/);
  if (!match) return str;
  const [, datePart, timePart] = match;
  const [year, month, day] = datePart.split("-").map(Number);
  const [hour, minute] = timePart.split(":").map(Number);
  const d = new Date(year, month - 1, day, hour, minute);
  if (Number.isNaN(d.getTime())) return str;
  return d.toLocaleString("en-AU", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export function ticketDirectionLabel(type) {
  return type === "out" ? "Out" : "In";
}

export function ticketTruckLabel(ticket) {
  if (typeof ticket.truck === "string" && ticket.truck.trim()) return ticket.truck.trim();
  return ticket.truckDisplay || ticket.truck?.name || "—";
}

export function buildTurnaroundRow(ticket, { includeOnSite = false } = {}) {
  const minutes = includeOnSite
    ? ticket.truckOnSiteMinutes ?? ticket.truck_on_site_minutes
    : ticket.truckTurnaroundMinutes ?? ticket.truck_turnaround_minutes;

  return {
    id: ticket.id,
    ticketReference: ticket.ticketReference ?? ticket.ticket_reference ?? "",
    type: ticket.type ?? "in",
    direction: ticketDirectionLabel(ticket.type),
    truck: ticketTruckLabel(ticket),
    arrivedAt: ticket.truckArrivedAt ?? ticket.truck_arrived_at ?? null,
    departedAt: ticket.truckDepartedAt ?? ticket.truck_departed_at ?? null,
    turnaroundMinutes: minutes != null ? Number(minutes) : null,
    turnaroundLabel: formatTurnaroundMinutes(minutes),
    notes: ticket.notes ?? "",
    date: ticket.date ?? "",
    status: ticket.status ?? "",
  };
}

export function buildTurnaroundExportRows(tickets, { onSite = false } = {}) {
  return (tickets || []).map((ticket) => {
    const row = buildTurnaroundRow(ticket, { includeOnSite: onSite });
    return {
      ticket: row.ticketReference,
      direction: row.direction,
      truck: row.truck,
      arrived: formatWeighDatetime(row.arrivedAt),
      departed: onSite ? "—" : formatWeighDatetime(row.departedAt),
      turnaround: row.turnaroundLabel,
      notes: row.notes,
      date: row.date,
    };
  });
}

export const TURNAROUND_EXPORT_COLUMNS = [
  { key: "ticket", header: "Ticket" },
  { key: "direction", header: "In/Out" },
  { key: "truck", header: "Truck" },
  { key: "arrived", header: "Arrived" },
  { key: "departed", header: "Departed" },
  { key: "turnaround", header: "Turnaround" },
  { key: "notes", header: "Notes" },
  { key: "date", header: "Date" },
];

export function averageMinutes(values) {
  const nums = values.filter((v) => Number.isFinite(v) && v >= 0);
  if (!nums.length) return null;
  return Math.round(nums.reduce((sum, v) => sum + v, 0) / nums.length);
}
