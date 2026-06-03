import { useCallback, useEffect, useMemo, useState } from 'react'
import { devWarn, uniqueBy } from '../utils/safe'

const DEFAULT_WIDTH = 120
const COMPACT_WIDTH = 68
const NARROW_WIDTH = 84
const MEDIUM_WIDTH = 110
const MIN_WIDTH = 44

/** Infer a sensible default width from column metadata (type, header length, flags). */
export function resolveColumnWidth(col) {
  if (typeof col?.width === 'number' && col.width > 0) return col.width
  if (col?.compact === true || col?.numeric === true) return COMPACT_WIDTH
  if (col?.type === 'number' || col?.type === 'boolean') return col?.type === 'boolean' ? COMPACT_WIDTH : NARROW_WIDTH
  if (col?.type === 'date') return NARROW_WIDTH

  const header = String(col?.header ?? col?.label ?? '').trim()
  if (header.length <= 3) return COMPACT_WIDTH
  if (header.length <= 5) return NARROW_WIDTH
  if (header.length <= 10) return MEDIUM_WIDTH

  return DEFAULT_WIDTH
}

function resolveMinWidth(col) {
  if (typeof col?.minWidth === 'number' && col.minWidth > 0) return col.minWidth
  if (col?.compact === true || col?.numeric === true) return MIN_WIDTH
  if (col?.type === 'number' || col?.type === 'boolean' || col?.type === 'date') return MIN_WIDTH
  return 56
}

export function useColumnState(columns, initialState) {
  const validated = useMemo(() => {
    const valid = []
    const seen = new Set()
    for (const col of columns) {
      if (!col || typeof col.key !== 'string' || col.key === '') {
        devWarn('Column missing `key`, skipping', col)
        continue
      }
      if (seen.has(col.key)) {
        devWarn(`Duplicate column key "${col.key}", skipping second occurrence`)
        continue
      }
      seen.add(col.key)
      valid.push(col)
    }
    return valid
  }, [columns])

  const [state, setState] = useState(() =>
    mergeColumnStates(validated, initialState ?? null),
  )

  useEffect(() => {
    setState((prev) => {
      const merged = mergeColumnStates(validated, prev)
      const keySet = new Set(validated.map((c) => c.key))
      return uniqueBy(merged.filter((c) => keySet.has(c.key)), (c) => c.key)
    })
  }, [validated])

  const columnMap = useMemo(() => {
    const map = new Map()
    for (const col of validated) map.set(col.key, col)
    return map
  }, [validated])

  const visibleColumns = useMemo(() => {
    const ordered = [...state].sort((a, b) => a.order - b.order)
    const rows = []
    for (const s of ordered) {
      if (s.hidden) continue
      const def = columnMap.get(s.key)
      if (!def) continue
      rows.push({ def, state: s })
    }
    rows.sort((a, b) => pinOrder(a.state.pin) - pinOrder(b.state.pin))
    return rows
  }, [state, columnMap])

  const setWidth = useCallback((key, width) => {
    setState((prev) =>
      prev.map((c) => {
        if (c.key !== key) return c
        const def = columnMap.get(key)
        const min = resolveMinWidth(def)
        const max = def?.maxWidth ?? 2000
        return {
          ...c,
          width: Math.min(Math.max(width, min), max),
          // Once the user explicitly resizes a column, freeze it from the
          // fillContainerWidth slack distribution so the cursor tracks 1:1.
          userResized: true,
        }
      }),
    )
  }, [columnMap])

  const setHidden = useCallback((key, hidden) => {
    setState((prev) => prev.map((c) => (c.key === key ? { ...c, hidden } : c)))
  }, [])

  const setPin = useCallback((key, pin) => {
    setState((prev) => prev.map((c) => (c.key === key ? { ...c, pin } : c)))
  }, [])

  const moveColumn = useCallback((fromKey, toKey) => {
    setState((prev) => {
      const ordered = [...prev].sort((a, b) => a.order - b.order)
      const fromIdx = ordered.findIndex((c) => c.key === fromKey)
      const toIdx = ordered.findIndex((c) => c.key === toKey)
      if (fromIdx === -1 || toIdx === -1) return prev
      const [moved] = ordered.splice(fromIdx, 1)
      ordered.splice(toIdx, 0, moved)
      return ordered.map((c, idx) => ({ ...c, order: idx }))
    })
  }, [])

  const resetState = useCallback(() => {
    setState(buildInitialState(validated))
  }, [validated])

  /**
   * Imperatively replace the column state from an external source (e.g.
   * applying a saved view's snapshot). Unknown keys are dropped, missing
   * columns are appended with defaults via the same merge logic.
   */
  const applyState = useCallback((seed) => {
    setState(mergeColumnStates(validated, seed ?? null))
  }, [validated])

  return {
    columns: validated,
    visibleColumns,
    state,
    setWidth,
    setHidden,
    setPin,
    moveColumn,
    resetState,
    applyState,
  }
}

function pinOrder(pin) {
  if (pin === 'left') return 0
  if (pin === 'right') return 2
  return 1
}

function buildInitialState(columns) {
  return columns.map((col, idx) => ({
    key: col.key,
    width: resolveColumnWidth(col),
    hidden: col.hidden ?? false,
    pin: col.pin ?? null,
    order: idx,
    userResized: false,
  }))
}

/**
 * Merge a (possibly persisted) prior column state with current column defs.
 * Preserves user-driven width/hidden/pin/order for known keys, and appends
 * newly-introduced columns with a fresh order index after existing entries.
 * Columns absent from `validated` are dropped.
 */
function mergeColumnStates(validated, prior) {
  const priorMap = new Map(
    (prior ?? []).map((c) => [c.key, c]),
  )
  if (priorMap.size === 0) return buildInitialState(validated)

  const maxPriorOrder = (prior ?? []).reduce((m, c) => Math.max(m, c.order), -1)
  let nextNewOrder = maxPriorOrder + 1

  const merged = validated.map((col, idx) => {
    const existing = priorMap.get(col.key)
    if (existing) {
      return {
        key: col.key,
        width: typeof existing.width === 'number' && existing.width > 0
          ? existing.width
          : resolveColumnWidth(col),
        hidden: Boolean(existing.hidden),
        pin: existing.pin === 'left' || existing.pin === 'right' ? existing.pin : null,
        order: typeof existing.order === 'number' ? existing.order : idx,
        userResized: Boolean(existing.userResized),
      }
    }
    return {
      key: col.key,
      width: resolveColumnWidth(col),
      hidden: col.hidden ?? false,
      pin: col.pin ?? null,
      order: nextNewOrder++,
      userResized: false,
    }
  })

  return merged
}
