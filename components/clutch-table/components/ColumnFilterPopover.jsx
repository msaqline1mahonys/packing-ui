'use client'

import { useState, useMemo } from 'react'
import {
  Popover, Box, TextField, MenuItem, Button, Stack, Typography,
  FormControl, InputLabel, Select, Checkbox, FormControlLabel, Divider,
} from '@mui/material'
import { safeString } from '../utils/safe'
import { onNumberInputWheel } from '@/lib/number-input'

const TEXT_OPS = [
  { value: 'contains', label: 'Contains' },
  { value: 'equals', label: 'Equals' },
  { value: 'startsWith', label: 'Starts with' },
  { value: 'endsWith', label: 'Ends with' },
  { value: 'empty', label: 'Is empty' },
  { value: 'notEmpty', label: 'Is not empty' },
]

const NUMBER_OPS = [
  { value: 'equals', label: '=' },
  { value: 'gt', label: '>' },
  { value: 'gte', label: 'â‰¥' },
  { value: 'lt', label: '<' },
  { value: 'lte', label: 'â‰¤' },
  { value: 'between', label: 'Between' },
  { value: 'empty', label: 'Is empty' },
  { value: 'notEmpty', label: 'Is not empty' },
]

const DATE_OPS = [
  { value: 'equals', label: 'On' },
  { value: 'gt', label: 'After' },
  { value: 'lt', label: 'Before' },
  { value: 'between', label: 'Between' },
  { value: 'empty', label: 'Is empty' },
  { value: 'notEmpty', label: 'Is not empty' },
]

export function ColumnFilterPopover({ anchorEl, onClose, column, rows, currentFilter, onChange }) {
  const [operator, setOperator] = useState(currentFilter?.operator ?? 'contains')
  const [value, setValue] = useState(safeString(currentFilter?.value ?? ''))
  const [value2, setValue2] = useState(safeString(currentFilter?.value2 ?? ''))
  const [setValues, setSetValues] = useState(() => {
    if (Array.isArray(currentFilter?.value)) {
      return new Set(currentFilter.value.map(safeString))
    }
    return new Set()
  })

  const colType = column?.type ?? 'text'

  const ops = useMemo(() => {
    if (colType === 'number') return NUMBER_OPS
    if (colType === 'date') return DATE_OPS
    return TEXT_OPS
  }, [colType])

  const distinctValues = useMemo(() => {
    if (!column || colType !== 'set') return []
    if (column.setOptions) return column.setOptions.map((o) => safeString(o.value))
    const set = new Set()
    for (const row of rows) {
      try {
        const v = column.valueGetter ? column.valueGetter(row) : row[column.key]
        set.add(safeString(v))
      } catch { /* skip */ }
    }
    return Array.from(set).sort()
  }, [column, rows, colType])

  if (!column) return null

  const needsValue = operator !== 'empty' && operator !== 'notEmpty'
  const needsSecondValue = operator === 'between'

  const handleApply = () => {
    if (!needsValue) { onChange({ operator, value: null }); onClose(); return }
    if (colType === 'set') {
      onChange({ operator: 'in', value: Array.from(setValues) })
    } else {
      onChange({ operator, value, value2: needsSecondValue ? value2 : undefined })
    }
    onClose()
  }

  const handleClear = () => {
    onChange(undefined); setValue(''); setValue2(''); setSetValues(new Set()); onClose()
  }

  return (
    <Popover open={Boolean(anchorEl)} anchorEl={anchorEl} onClose={onClose}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}>
      <Box sx={{ p: 2, minWidth: 260 }}>
        <Typography variant="subtitle2" sx={{ mb: 1.5 }}>Filter: {column.header}</Typography>

        {colType === 'set' ? (
          <Stack spacing={0.5} sx={{ maxHeight: 260, overflow: 'auto' }}>
            {distinctValues.length === 0 && (
              <Typography variant="caption" color="text.secondary">No values</Typography>
            )}
            {distinctValues.map((v) => (
              <FormControlLabel key={v}
                control={
                  <Checkbox size="small" checked={setValues.has(v)}
                    onChange={(e) => {
                      setSetValues((prev) => {
                        const next = new Set(prev)
                        if (e.target.checked) next.add(v); else next.delete(v)
                        return next
                      })
                    }}
                  />
                }
                label={<Typography variant="body2">{v || '(blank)'}</Typography>}
              />
            ))}
          </Stack>
        ) : (
          <>
            <FormControl fullWidth size="small" sx={{ mb: 1.5 }}>
              <InputLabel>Operator</InputLabel>
              <Select label="Operator" value={operator} inputProps={{ suppressHydrationWarning: true }}
                onChange={(e) => setOperator(e.target.value)}>
                {ops.map((op) => (
                  <MenuItem key={op.value} value={op.value}>{op.label}</MenuItem>
                ))}
              </Select>
            </FormControl>

            {needsValue && (
              <TextField fullWidth size="small" label="Value"
                type={colType === 'number' ? 'number' : colType === 'date' ? 'date' : 'text'}
                value={value} onChange={(e) => setValue(e.target.value)}
                onWheel={colType === 'number' ? onNumberInputWheel : undefined}
                InputLabelProps={colType === 'date' ? { shrink: true } : undefined}
                sx={{ mb: needsSecondValue ? 1.5 : 0 }} autoFocus
              />
            )}

            {needsSecondValue && (
              <TextField fullWidth size="small" label="To"
                type={colType === 'number' ? 'number' : colType === 'date' ? 'date' : 'text'}
                value={value2} onChange={(e) => setValue2(e.target.value)}
                onWheel={colType === 'number' ? onNumberInputWheel : undefined}
                InputLabelProps={colType === 'date' ? { shrink: true } : undefined}
              />
            )}
          </>
        )}

        <Divider sx={{ my: 1.5 }} />
        <Stack direction="row" spacing={1} justifyContent="flex-end">
          <Button size="small" onClick={handleClear}>Clear</Button>
          <Button size="small" variant="contained" onClick={handleApply}>Apply</Button>
        </Stack>
      </Box>
    </Popover>
  )
}