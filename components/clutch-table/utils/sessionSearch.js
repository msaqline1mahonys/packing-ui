// In-memory store for each grid's global search term, keyed by persistKey.
// Persists across client-side navigation within the same tab (the module
// stays loaded), but resets on a full page refresh.
const store = new Map()

export function getSessionSearch(key) {
  if (!key) return ''
  return store.get(key) ?? ''
}

export function setSessionSearch(key, value) {
  if (!key) return
  if (!value) store.delete(key)
  else store.set(key, value)
}
