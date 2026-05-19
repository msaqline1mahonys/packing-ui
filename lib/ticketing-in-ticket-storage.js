const KEY_PREFIX = "ticketing-ticket:";

export function ticketStorageKey(id, direction = "in") {
  return `${KEY_PREFIX}${direction}:${id}`;
}

export function saveInTicketSnapshot(id, ticket, direction = "in") {
  if (typeof window === "undefined" || id == null) return;
  try {
    window.sessionStorage.setItem(ticketStorageKey(id, direction), JSON.stringify(ticket));
  } catch {
    /* quota / private mode */
  }
}

export function loadInTicketSnapshot(id, direction = "in") {
  if (typeof window === "undefined" || id == null) return null;
  try {
    const raw = window.sessionStorage.getItem(ticketStorageKey(id, direction));
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
