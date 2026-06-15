'use client'

import { useRef, useState } from 'react'
import { MenuItem, Select, TextField } from '@mui/material'

import { onNumberInputWheel } from '@/lib/number-input'

function resolveEditor(column) {
  if (typeof column.editor === 'function') return 'custom'
  if (typeof column.editor === 'string') return column.editor
  if (column.type === 'set' && (column.setOptions?.length ?? 0) > 0) return 'select'
  if (column.type === 'number') return 'number'
  if (column.type === 'date') return 'date'
  return 'text'
}

function parseValue(raw, column, row) {
  if (column.parseValue && typeof raw === 'string') {
    try { return column.parseValue(raw, row) } catch { return raw }
  }
  if (column.type === 'number' && typeof raw === 'string') {
    const trimmed = raw.trim()
    if (trimmed === '') return null
    const n = Number(trimmed)
    return Number.isFinite(n) ? n : raw
  }
  return raw
}

export function CellEditor({ value, row, column, initialChar, onCommit, onCancel }) {
  const editorType = resolveEditor(column)

  const initialDraft =
    initialChar !== undefined
      ? initialChar
      : value == null
      ? ''
      : typeof value === 'object'
      ? JSON.stringify(value)
      : String(value)

  const [draft, setDraft] = useState(initialDraft)
  const [error, setError] = useState(null)
  const committedRef = useRef(false)

  const runValidate = (v) => {
    try {
      const result = column.validate?.(v, row)
      return result == null ? null : result
    } catch {
      return 'Invalid value'
    }
  }

  const finalize = (action) => {
    if (committedRef.current) return
    const parsed = parseValue(draft, column, row)
    const err = runValidate(parsed)
    if (err) {
      setError(err)
      if (action === 'blur') {
        committedRef.current = true
        onCancel()
      }
      return
    }
    committedRef.current = true
    onCommit(parsed, action)
  }

  // Custom editor
  if (editorType === 'custom' && typeof column.editor === 'function') {
    return (
      <>
        {column.editor({
          value: draft, row, column, error,
          onChange: (next) => { setDraft(next); if (error) setError(null) },
          commit: () => finalize('enter'),
          cancel: () => { committedRef.current = true; onCancel() },
        })}
      </>
    )
  }

  // Select editor
  if (editorType === 'select') {
    const opts = column.setOptions ?? []
    return (
      <Select
        size="small" autoFocus defaultOpen
        value={(draft ?? '')}
        onChange={(e) => {
          const next = e.target.value
          setDraft(next)
          const err = runValidate(next)
          if (err) { setError(err); return }
          committedRef.current = true
          onCommit(next, 'enter')
        }}
        onClose={() => {
          if (!committedRef.current) { committedRef.current = true; onCancel() }
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') { e.stopPropagation(); committedRef.current = true; onCancel() }
        }}
        sx={{
          width: '100%', height: '100%', fontSize: '0.85rem',
          '& .MuiSelect-select': { py: 0.5, px: 1 },
        }}
      >
        {opts.map((o) => (
          <MenuItem key={String(o.value)} value={o.value}>{o.label}</MenuItem>
        ))}
      </Select>
    )
  }

  const inputType = editorType === 'number' ? 'number' : editorType === 'date' ? 'date' : 'text'

  return (
    <TextField
      size="small" autoFocus type={inputType}
      value={(draft ?? '')}
      error={Boolean(error)} title={error ?? undefined}
      onChange={(e) => { setDraft(e.target.value); if (error) setError(null) }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); finalize('enter') }
        else if (e.key === 'Tab') { e.preventDefault(); e.stopPropagation(); finalize(e.shiftKey ? 'shift-tab' : 'tab') }
        else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); committedRef.current = true; onCancel() }
        else { e.stopPropagation() }
      }}
      onFocus={(e) => {
        if (initialChar !== undefined) {
          const el = e.currentTarget
          const len = el.value.length
          try { el.setSelectionRange(len, len) } catch { /* unsupported */ }
        } else { e.currentTarget.select() }
      }}
      onBlur={() => finalize('blur')}
      onWheel={inputType === 'number' ? onNumberInputWheel : undefined}
      sx={{
        width: '100%',
        '& .MuiOutlinedInput-root': { height: '100%', fontSize: '0.85rem', bgcolor: 'background.paper' },
        '& .MuiOutlinedInput-input': { py: 0.5, px: 1 },
      }}
    />
  )
}
