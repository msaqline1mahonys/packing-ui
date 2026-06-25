function normalizeDate(value) {
  if (!value) return "";
  return String(value).slice(0, 10);
}

export function weightTotal(weights) {
  return (Array.isArray(weights) ? weights : []).reduce((sum, value) => sum + (Number(value) || 0), 0);
}

export function hasComparableWeights(ticket) {
  const gross = weightTotal(ticket?.grossWeights);
  const tare = weightTotal(ticket?.tareWeights);
  return gross > 0 && tare > 0;
}

export function buildTicketDuplicateFingerprint(ticket, { ticketType = "in" } = {}) {
  return {
    type: ticketType,
    date: normalizeDate(ticket?.date),
    truckId: String(ticket?.truckId || ticket?.truck?.id || ""),
    grossTotal: weightTotal(ticket?.grossWeights),
    tareTotal: weightTotal(ticket?.tareWeights),
  };
}

function fingerprintsMatch(left, right) {
  return (
    left.type === right.type &&
    left.date === right.date &&
    left.truckId === right.truckId &&
    left.grossTotal === right.grossTotal &&
    left.tareTotal === right.tareTotal
  );
}

export function findDuplicateTickets(ticket, existingTickets, { ticketType = "in", excludeId } = {}) {
  if (!ticket?.truckId && !ticket?.truck?.id) return [];
  if (!hasComparableWeights(ticket)) return [];

  const fingerprint = buildTicketDuplicateFingerprint(ticket, { ticketType });

  return (existingTickets ?? []).filter((candidate) => {
    if (!candidate) return false;
    if (excludeId && String(candidate.id) === String(excludeId)) return false;
    if (candidate.status === "cancelled") return false;
    if (!hasComparableWeights(candidate)) return false;
    return fingerprintsMatch(fingerprint, buildTicketDuplicateFingerprint(candidate, { ticketType }));
  });
}

export function formatDuplicateTicketLabel(ticket) {
  const ref = ticket.ticketReference || ticket.ticketRef || ticket.id;
  const status = ticket.status ? String(ticket.status).replace(/^\w/, (c) => c.toUpperCase()) : "Ticket";
  return `${ref} (${status})`;
}
