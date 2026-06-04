import { useCallback, useEffect, useMemo, useState } from 'react'

export function useSelection({ rows, getRowId, onChange, initialSelectedIds = [] }) {
  const [selected, setSelected] = useState(() => {
    if (!initialSelectedIds?.length) return new Set()
    return new Set(initialSelectedIds.map((id) => String(id)))
  })

  const rowIdMap = useMemo(() => {
    const map = new Map()
    for (const row of rows) {
      try {
        const id = getRowId(row)
        if (id == null) continue
        map.set(String(id), row)
      } catch {
        // skip invalid rows
      }
    }
    return map
  }, [rows, getRowId])

  useEffect(() => {
    setSelected((prev) => {
      if (prev.size === 0) return prev
      const next = new Set()
      for (const id of prev) {
        if (rowIdMap.has(String(id))) next.add(String(id))
      }
      if (next.size === prev.size) return prev
      return next
    })
  }, [rowIdMap])

  const selectedRows = useMemo(() => {
    const result = []
    for (const id of selected) {
      const row = rowIdMap.get(id)
      if (row) result.push(row)
    }
    return result
  }, [selected, rowIdMap])

  useEffect(() => {
    if (onChange) onChange(selectedRows)
  }, [selectedRows, onChange])

  const toggleRow = useCallback((id) => {
    const key = String(id)
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])

  const toggleMany = useCallback((ids, shouldSelect) => {
    setSelected((prev) => {
      const next = new Set(prev)
      for (const id of ids) {
        const key = String(id)
        if (shouldSelect) next.add(key)
        else next.delete(key)
      }
      return next
    })
  }, [])

  const clear = useCallback(() => setSelected(new Set()), [])
  const isSelected = useCallback((id) => selected.has(String(id)), [selected])

  return {
    selected, selectedRows, toggleRow, toggleMany, clear, isSelected,
    count: selected.size,
  }
}
