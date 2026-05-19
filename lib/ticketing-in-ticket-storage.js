const KEY_PREFIX = "ticketing-in-ticket:";

export function inTicketStorageKey(id) {
  return `${KEY_PREFIX}${id}`;
}

export function saveInTicketSnapshot(id, ticket) {
  if (typeof window === "undefined" || id == null) return;
  try {
    window.sessionStorage.setItem(inTicketStorageKey(id), JSON.stringify(ticket));
  } catch {
    /* quota / private mode */
  }
}

export function loadInTicketSnapshot(id) {
  if (typeof window === "undefined" || id == null) return null;
  try {
    const raw = window.sessionStorage.getItem(inTicketStorageKey(id));
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
