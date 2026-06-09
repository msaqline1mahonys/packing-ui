'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  fetchGridViews,
  createGridView,
  updateGridView,
  deleteGridView,
  hasAuthForGridViews,
} from '../../../lib/grid-views-api'
import { devWarn } from '../utils/safe'

const SNAPSHOT_DEBOUNCE_MS = 800

/**
 * DB-backed saved views per (user, grid_key).
 *
 * Return shape mirrors the prior localStorage hook so Grid.jsx callsites are
 * unchanged: { viewsList, currentId, defaultId, currentView, defaultView,
 *              saveCurrent, saveAs, rename, remove, setCurrent, setDefault }.
 *
 * Behaviour:
 *  - Loads views on mount; falls back to empty until the network call resolves.
 *  - `saveCurrent(snapshot)` is debounced and PUTs the current view's snapshot.
 *  - `saveAs / rename / remove / setCurrent / setDefault` apply optimistically
 *    and sync to the server immediately.
 *  - Silent disable when there's no auth token (matches useUserGridPreference).
 */
export function useSavedViews(persistKey, legacySnapshot) {
  const [views, setViews] = useState({})
  const [currentId, setCurrentId] = useState(null)
  const [defaultId, setDefaultId] = useState(null)
  const [loaded, setLoaded] = useState(false)

  const snapshotTimerRef = useRef(null)
  const pendingSnapshotRef = useRef(null)
  const lastSnapshotPayloadRef = useRef(null)
  const currentIdRef = useRef(currentId)
  useEffect(() => { currentIdRef.current = currentId }, [currentId])

  useEffect(() => {
    if (!persistKey || !hasAuthForGridViews()) {
      setLoaded(true)
      return
    }
    let cancelled = false
    fetchGridViews(persistKey)
      .then((result) => {
        if (cancelled || !result) return
        const map = {}
        for (const v of result.views) map[v.id] = v
        setViews(map)
        setCurrentId(result.currentId ?? null)
        setDefaultId(result.defaultId ?? null)
      })
      .catch((err) => devWarn(`Failed to load views for "${persistKey}"`, err))
      .finally(() => { if (!cancelled) setLoaded(true) })

    return () => {
      cancelled = true
      if (snapshotTimerRef.current != null) {
        window.clearTimeout(snapshotTimerRef.current)
        snapshotTimerRef.current = null
      }
    }
  }, [persistKey])

  // First-load seeding: if backend returned no views and a legacy snapshot is
  // available (e.g. from localStorage during the migration window), seed a
  // "Default" view server-side so the user keeps their existing layout.
  const seededRef = useRef(false)
  useEffect(() => {
    if (!loaded || seededRef.current) return
    if (!persistKey || !hasAuthForGridViews()) return
    if (Object.keys(views).length > 0) return
    if (!legacySnapshot) return
    seededRef.current = true
    createGridView(persistKey, {
      name: 'Default',
      snapshot: legacySnapshot,
      isDefault: true,
      isCurrent: true,
    })
      .then((created) => {
        if (!created) return
        setViews((prev) => ({ ...prev, [created.id]: created }))
        setCurrentId(created.id)
        setDefaultId(created.id)
      })
      .catch((err) => devWarn(`Failed to seed default view for "${persistKey}"`, err))
  }, [loaded, persistKey, views, legacySnapshot])

  const flushSnapshotSave = useCallback(() => {
    if (snapshotTimerRef.current != null) {
      window.clearTimeout(snapshotTimerRef.current)
      snapshotTimerRef.current = null
    }
    const id = currentIdRef.current
    const snapshot = pendingSnapshotRef.current
    if (!id || !snapshot) return
    updateGridView(persistKey, id, { snapshot })
      .catch((err) => devWarn(`Failed to update view snapshot for "${persistKey}"`, err))
  }, [persistKey])

  const saveCurrent = useCallback((snapshot) => {
    if (!persistKey || !hasAuthForGridViews()) return
    if (!snapshot || typeof snapshot !== 'object') return
    if (!currentIdRef.current) return

    const serialized = JSON.stringify(snapshot)
    if (serialized === lastSnapshotPayloadRef.current) return
    lastSnapshotPayloadRef.current = serialized
    pendingSnapshotRef.current = snapshot

    // Optimistic local update so re-selecting the view doesn't snap state back.
    setViews((prev) => {
      const v = prev[currentIdRef.current]
      if (!v) return prev
      return { ...prev, [v.id]: { ...v, snapshot } }
    })

    if (snapshotTimerRef.current != null) {
      window.clearTimeout(snapshotTimerRef.current)
    }
    snapshotTimerRef.current = window.setTimeout(flushSnapshotSave, SNAPSHOT_DEBOUNCE_MS)
  }, [persistKey, flushSnapshotSave])

  const saveAs = useCallback(async (name, snapshot) => {
    const trimmed = (name || '').trim() || 'Untitled view'
    if (!persistKey || !hasAuthForGridViews()) return null
    try {
      const created = await createGridView(persistKey, {
        name: trimmed,
        snapshot,
        isDefault: defaultId == null,
        isCurrent: true,
      })
      if (!created) return null
      setViews((prev) => ({ ...prev, [created.id]: created }))
      setCurrentId(created.id)
      if (created.isDefault) setDefaultId(created.id)
      return created.id
    } catch (err) {
      devWarn(`Failed to create view "${trimmed}" for "${persistKey}"`, err)
      return null
    }
  }, [persistKey, defaultId])

  const rename = useCallback(async (id, name) => {
    const trimmed = (name || '').trim()
    if (!trimmed || !persistKey) return
    if (!views[id]) return
    const prevName = views[id].name
    setViews((prev) => ({ ...prev, [id]: { ...prev[id], name: trimmed } }))
    try {
      await updateGridView(persistKey, id, { name: trimmed })
    } catch (err) {
      setViews((prev) => ({ ...prev, [id]: { ...prev[id], name: prevName } }))
      devWarn(`Failed to rename view "${id}" for "${persistKey}"`, err)
    }
  }, [persistKey, views])

  const remove = useCallback(async (id) => {
    if (!persistKey || !views[id]) return
    const snapshotPrev = views
    const newViews = { ...views }
    delete newViews[id]
    const remainingIds = Object.keys(newViews)
    const nextCurrent = currentId === id ? (remainingIds[0] ?? null) : currentId
    const nextDefault = defaultId === id ? (remainingIds[0] ?? null) : defaultId
    setViews(newViews)
    setCurrentId(nextCurrent)
    setDefaultId(nextDefault)
    try {
      await deleteGridView(persistKey, id)
      // Promote nextCurrent / nextDefault flags server-side if we picked them.
      if (nextCurrent && currentId === id) {
        await updateGridView(persistKey, nextCurrent, { isCurrent: true })
      }
      if (nextDefault && defaultId === id) {
        await updateGridView(persistKey, nextDefault, { isDefault: true })
      }
    } catch (err) {
      setViews(snapshotPrev)
      setCurrentId(currentId)
      setDefaultId(defaultId)
      devWarn(`Failed to delete view "${id}" for "${persistKey}"`, err)
    }
  }, [persistKey, views, currentId, defaultId])

  const setCurrent = useCallback((id) => {
    const view = views[id]
    if (!view) return null
    if (currentId === id) return view
    // Flush any pending snapshot save against the old current view first.
    flushSnapshotSave()
    lastSnapshotPayloadRef.current = view.snapshot ? JSON.stringify(view.snapshot) : null
    setCurrentId(id)
    if (persistKey && hasAuthForGridViews()) {
      updateGridView(persistKey, id, { isCurrent: true })
        .catch((err) => devWarn(`Failed to mark current view "${id}" for "${persistKey}"`, err))
    }
    return view
  }, [views, currentId, persistKey, flushSnapshotSave])

  const setDefault = useCallback((id) => {
    if (id != null && !views[id]) return
    setDefaultId(id)
    if (persistKey && hasAuthForGridViews() && id) {
      updateGridView(persistKey, id, { isDefault: true })
        .catch((err) => devWarn(`Failed to mark default view "${id}" for "${persistKey}"`, err))
    }
  }, [views, persistKey])

  const viewsList = useMemo(
    () => Object.values(views).sort((a, b) => a.name.localeCompare(b.name)),
    [views],
  )
  const currentView = currentId ? views[currentId] ?? null : null
  const defaultView = defaultId ? views[defaultId] ?? null : null

  return {
    viewsList,
    currentId,
    defaultId,
    currentView,
    defaultView,
    loaded,
    saveCurrent,
    saveAs,
    rename,
    remove,
    setCurrent,
    setDefault,
  }
}
