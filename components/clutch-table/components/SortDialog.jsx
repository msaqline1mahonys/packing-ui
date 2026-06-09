'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, IconButton, MenuItem, Select, ToggleButton, ToggleButtonGroup,
  Box, Stack, Typography, Tooltip,
} from '@mui/material'
import Add from '@mui/icons-material/Add'
import DeleteOutlined from '@mui/icons-material/DeleteOutlined'
import ArrowUpward from '@mui/icons-material/ArrowUpward'
import ArrowDownward from '@mui/icons-material/ArrowDownward'
import RestartAlt from '@mui/icons-material/RestartAlt'

/**
 * Excel-style "Sort By → Then By → Then By" dialog.
 *
 * Props:
 *  - open: boolean
 *  - onClose: () => void
 *  - columns: [{ key, header }] — sortable columns shown in dropdowns
 *  - sortModel: [{ key, dir: 'asc' | 'desc' }]
 *  - onApply: (nextSortModel) => void
 */
export function SortDialog({ open, onClose, columns, sortModel, onApply }) {
  const [draft, setDraft] = useState(sortModel ?? [])

  useEffect(() => {
    if (open) setDraft(Array.isArray(sortModel) ? [...sortModel] : [])
  }, [open, sortModel])

  const columnOptions = useMemo(() => columns.map((c) => ({
    key: c.key,
    label: typeof c.header === 'string' ? c.header : c.key,
  })), [columns])

  const usedKeys = useMemo(() => new Set(draft.map((r) => r.key)), [draft])
  const firstAvailableKey = useMemo(
    () => columnOptions.find((c) => !usedKeys.has(c.key))?.key ?? null,
    [columnOptions, usedKeys],
  )

  const addLevel = () => {
    if (!firstAvailableKey) return
    setDraft((prev) => [...prev, { key: firstAvailableKey, dir: 'asc' }])
  }
  const removeLevel = (idx) => {
    setDraft((prev) => prev.filter((_, i) => i !== idx))
  }
  const moveLevel = (idx, delta) => {
    setDraft((prev) => {
      const next = [...prev]
      const target = idx + delta
      if (target < 0 || target >= next.length) return prev
      const [moved] = next.splice(idx, 1)
      next.splice(target, 0, moved)
      return next
    })
  }
  const setKey = (idx, key) => {
    setDraft((prev) => prev.map((row, i) => i === idx ? { ...row, key } : row))
  }
  const setDir = (idx, dir) => {
    if (!dir) return
    setDraft((prev) => prev.map((row, i) => i === idx ? { ...row, dir } : row))
  }
  const clearAll = () => setDraft([])

  const apply = () => {
    const cleaned = draft
      .filter((row) => row && row.key && (row.dir === 'asc' || row.dir === 'desc'))
    onApply(cleaned)
    onClose()
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Sort</DialogTitle>
      <DialogContent dividers>
        {draft.length === 0 ? (
          <Box sx={{ py: 2, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              No sort levels. Click <strong>Add level</strong> to add one.
            </Typography>
          </Box>
        ) : (
          <Stack spacing={1.25}>
            {draft.map((row, idx) => {
              const availableForRow = columnOptions.filter(
                (c) => c.key === row.key || !usedKeys.has(c.key),
              )
              return (
                <Box
                  key={`${row.key}-${idx}`}
                  sx={{
                    display: 'flex', alignItems: 'center', gap: 1,
                    p: 1, border: '1px solid', borderColor: 'divider',
                    borderRadius: 1,
                  }}
                >
                  <Typography variant="caption" sx={{ minWidth: 60, color: 'text.secondary' }}>
                    {idx === 0 ? 'Sort by' : 'Then by'}
                  </Typography>
                  <Select
                    size="small"
                    value={row.key}
                    onChange={(e) => setKey(idx, e.target.value)}
                    sx={{ flex: 1, minWidth: 160 }}
                  >
                    {availableForRow.map((c) => (
                      <MenuItem key={c.key} value={c.key}>{c.label}</MenuItem>
                    ))}
                  </Select>
                  <ToggleButtonGroup
                    size="small"
                    exclusive
                    value={row.dir}
                    onChange={(_, v) => setDir(idx, v)}
                  >
                    <ToggleButton value="asc">A → Z</ToggleButton>
                    <ToggleButton value="desc">Z → A</ToggleButton>
                  </ToggleButtonGroup>
                  <Tooltip title="Move up">
                    <span>
                      <IconButton size="small" onClick={() => moveLevel(idx, -1)} disabled={idx === 0}>
                        <ArrowUpward fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                  <Tooltip title="Move down">
                    <span>
                      <IconButton
                        size="small"
                        onClick={() => moveLevel(idx, 1)}
                        disabled={idx === draft.length - 1}
                      >
                        <ArrowDownward fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                  <Tooltip title="Remove level">
                    <IconButton size="small" onClick={() => removeLevel(idx)}>
                      <DeleteOutlined fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Box>
              )
            })}
          </Stack>
        )}
        <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
          <Button
            startIcon={<Add />}
            size="small"
            onClick={addLevel}
            disabled={!firstAvailableKey}
          >
            Add level
          </Button>
          <Button
            startIcon={<RestartAlt />}
            size="small"
            onClick={clearAll}
            disabled={draft.length === 0}
          >
            Clear all
          </Button>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={apply} variant="contained">OK</Button>
      </DialogActions>
    </Dialog>
  )
}
