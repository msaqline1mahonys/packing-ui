import { useEffect, useRef } from 'react'
import { devWarn } from '../utils/safe'

const PREFIX = 'clutch-grid:'
const VERSION = 3

export function loadPersistedState(key) {
  if (!key) return null
  if (typeof window === 'undefined' || !window.localStorage) return null
  try {
    const raw = window.localStorage.getItem(PREFIX + key)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || parsed.version !== VERSION) return null
    return parsed
  } catch (err) {
    devWarn(`Failed to load persisted state for "${key}"`, err)
    return null
  }
}

export function savePersistedState(key, snapshot) {
  if (!key) return
  if (typeof window === 'undefined' || !window.localStorage) return
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify(snapshot))
  } catch (err) {
    devWarn(`Failed to persist state for "${key}"`, err)
  }
}

export function clearPersistedState(key) {
  if (!key) return
  if (typeof window === 'undefined' || !window.localStorage) return
  try {
    window.localStorage.removeItem(PREFIX + key)
  } catch {
    // ignore
  }
}

/**
 * Debounced persistence — writes at most once per 250ms to avoid thrashing localStorage.
 */
export function usePersistedWriter(key, snapshotRef, triggers) {
  const timerRef = useRef(null)

  useEffect(() => {
    if (!key) return
    if (timerRef.current != null) window.clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout(() => {
      savePersistedState(key, { ...snapshotRef.current, version: VERSION })
    }, 250)
    return () => {
      if (timerRef.current != null) window.clearTimeout(timerRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, ...triggers])
}

export const PERSIST_VERSION = VERSION
