'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  fetchGridPreference,
  saveGridPreference,
  saveGridState,
  hasAuthForGridPreferences,
} from '../../../lib/grid-preferences-api'
import { devWarn } from '../utils/safe'

const SAVE_DEBOUNCE_MS = 800

/**
 * Per-user, DB-backed persistence for grid column state (order / hidden / width / pin)
 * and ambient grid state (sortModel / filters / pageSize).
 *
 * - Fetches once on mount keyed by (current user, persistKey).
 * - Returns initialColumnState / initialGridState (null until loaded) and `loaded`.
 * - `saveColumnState(state)` and `saveGridStateNow(state)` debounce-save to the server.
 * - No localStorage fallback; if there's no auth token or the API fails,
 *   persistence is silently disabled for this session.
 */
export function useUserGridPreference(persistKey) {
  const [initialColumnState, setInitialColumnState] = useState(null)
  const [initialGridState, setInitialGridState] = useState(null)
  const [loaded, setLoaded] = useState(false)
  const colSaveTimerRef = useRef(null)
  const gridSaveTimerRef = useRef(null)
  const lastColPayloadRef = useRef(null)
  const lastGridPayloadRef = useRef(null)
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
      .then((result) => {
        if (cancelled) return
        const colState = result?.columnState ?? null
        const gState = result?.gridState ?? null
        if (colState) lastColPayloadRef.current = JSON.stringify(colState)
        if (gState) lastGridPayloadRef.current = JSON.stringify(gState)
        setInitialColumnState(colState)
        setInitialGridState(gState)
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
      if (colSaveTimerRef.current != null) {
        window.clearTimeout(colSaveTimerRef.current)
        colSaveTimerRef.current = null
      }
      if (gridSaveTimerRef.current != null) {
        window.clearTimeout(gridSaveTimerRef.current)
        gridSaveTimerRef.current = null
      }
    }
  }, [persistKey])

  const saveColumnState = useCallback((columnState) => {
    if (!persistKey || !hasAuthForGridPreferences()) return
    if (!Array.isArray(columnState)) return

    const serialized = JSON.stringify(columnState)
    if (serialized === lastColPayloadRef.current) return
    lastColPayloadRef.current = serialized

    if (colSaveTimerRef.current != null) {
      window.clearTimeout(colSaveTimerRef.current)
    }
    colSaveTimerRef.current = window.setTimeout(() => {
      colSaveTimerRef.current = null
      saveGridPreference(persistKey, columnState).catch((err) => {
        devWarn(`Failed to save column state for "${persistKey}"`, err)
      })
    }, SAVE_DEBOUNCE_MS)
  }, [persistKey])

  const saveGridStateNow = useCallback((gridState) => {
    if (!persistKey || !hasAuthForGridPreferences()) return
    if (!gridState || typeof gridState !== 'object') return

    const serialized = JSON.stringify(gridState)
    if (serialized === lastGridPayloadRef.current) return
    lastGridPayloadRef.current = serialized

    if (gridSaveTimerRef.current != null) {
      window.clearTimeout(gridSaveTimerRef.current)
    }
    gridSaveTimerRef.current = window.setTimeout(() => {
      gridSaveTimerRef.current = null
      saveGridState(persistKey, gridState).catch((err) => {
        devWarn(`Failed to save grid state for "${persistKey}"`, err)
      })
    }, SAVE_DEBOUNCE_MS)
  }, [persistKey])

  return {
    initialColumnState,
    initialGridState,
    loaded,
    save: saveColumnState,
    saveColumnState,
    saveGridState: saveGridStateNow,
  }
}
