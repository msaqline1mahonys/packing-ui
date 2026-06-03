'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  fetchGridPreference,
  saveGridPreference,
  hasAuthForGridPreferences,
} from '../../../lib/grid-preferences-api'
import { devWarn } from '../utils/safe'

const SAVE_DEBOUNCE_MS = 800

/**
 * Per-user, DB-backed persistence for grid column state (order / hidden / width / pin).
 *
 * - Fetches once on mount keyed by (current user, persistKey).
 * - Exposes `initialColumnState` (null until loaded) and `loaded`.
 * - `save(state)` debounce-saves the latest state to the server.
 * - No localStorage fallback; if there's no auth token or the API fails,
 *   persistence is silently disabled for this session.
 */
export function useUserGridPreference(persistKey) {
  const [initialColumnState, setInitialColumnState] = useState(null)
  const [loaded, setLoaded] = useState(false)
  const saveTimerRef = useRef(null)
  const lastPayloadRef = useRef(null)
  const abortFetchRef = useRef(null)

  useEffect(() => {
    if (!persistKey || !hasAuthForGridPreferences()) {
      setLoaded(true)
      return
    }
    const controller = new AbortController()
    abortFetchRef.current = controller
    let cancelled = false

    fetchGridPreference(persistKey, { signal: controller.signal })
      .then((state) => {
        if (cancelled) return
        // Seed the dedup ref so the first re-save (triggered by applying this
        // state into useColumnState) is recognized as a no-op when unchanged.
        if (state) lastPayloadRef.current = JSON.stringify(state)
        setInitialColumnState(state)
      })
      .catch((err) => {
        if (err?.name === 'AbortError') return
        devWarn(`Failed to load grid preference for "${persistKey}"`, err)
      })
      .finally(() => {
        if (!cancelled) setLoaded(true)
      })

    return () => {
      cancelled = true
      controller.abort()
      if (saveTimerRef.current != null) {
        window.clearTimeout(saveTimerRef.current)
        saveTimerRef.current = null
      }
    }
  }, [persistKey])

  const save = useCallback((columnState) => {
    if (!persistKey || !hasAuthForGridPreferences()) return
    if (!Array.isArray(columnState)) return

    const serialized = JSON.stringify(columnState)
    if (serialized === lastPayloadRef.current) return
    lastPayloadRef.current = serialized

    if (saveTimerRef.current != null) {
      window.clearTimeout(saveTimerRef.current)
    }
    saveTimerRef.current = window.setTimeout(() => {
      saveTimerRef.current = null
      saveGridPreference(persistKey, columnState).catch((err) => {
        devWarn(`Failed to save grid preference for "${persistKey}"`, err)
      })
    }, SAVE_DEBOUNCE_MS)
  }, [persistKey])

  return { initialColumnState, loaded, save }
}
