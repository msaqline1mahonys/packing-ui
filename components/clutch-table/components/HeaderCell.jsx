'use client'

import { useRef, useCallback, useState } from 'react'
import { Box, IconButton, Tooltip } from '@mui/material'
import ArrowUpward from '@mui/icons-material/ArrowUpward'
import ArrowDownward from '@mui/icons-material/ArrowDownward'
import FilterAlt from '@mui/icons-material/FilterAlt'
import FilterAltOutlined from '@mui/icons-material/FilterAltOutlined'
import MoreVert from '@mui/icons-material/MoreVert'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

export function HeaderCell({
  column, width, pin, pinLeftOffset, pinRightOffset,
  sortIndex, sortDir, hasFilter, showColumnMenu, enableColumnFilters,
  onSortClick, onFilterClick, onMenuClick, onResizeStart, isDraggable,
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useSortable({
    id: column.key,
    disabled: !isDraggable || pin != null,
  })
  const { role: _dndRole, ...dragAttributes } = attributes
  const ref = useRef(null)
  const [isHovered, setIsHovered] = useState(false)

  const sortable = column.sortable !== false
  const filterable = enableColumnFilters && column.filterable !== false
  const align = column.align ?? (column.type === 'number' ? 'right' : 'left')

  const handleClick = useCallback((e) => {
    if (!sortable) return
    const target = e.target
    if (target.closest('.dg-resize-handle') || target.closest('.dg-header-action')) return
    onSortClick(e)
  }, [sortable, onSortClick])

  const stickyStyles = {}
  if (pin === 'left') {
    stickyStyles.position = 'sticky'
    stickyStyles.left = pinLeftOffset ?? 0
    stickyStyles.zIndex = 3
  } else if (pin === 'right') {
    stickyStyles.position = 'sticky'
    stickyStyles.right = pinRightOffset ?? 0
    stickyStyles.zIndex = 3
  }

  const style = {
    width, minWidth: width, maxWidth: width,
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
    cursor: sortable ? 'pointer' : 'default',
    ...stickyStyles,
  }

  const content = (
    <Box
      ref={(el) => { ref.current = el; setNodeRef(el) }}
      className="dg-header-cell"
      role="columnheader"
      suppressHydrationWarning
      aria-sort={sortDir === 'asc' ? 'ascending' : sortDir === 'desc' ? 'descending' : 'none'}
      style={style}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleClick}
      sx={{
        boxSizing: 'border-box', display: 'flex', alignItems: 'center',
        justifyContent: align === 'right' ? 'flex-end' : align === 'center' ? 'center' : 'flex-start',
        gap: 0.5, px: 1.25, py: 0.75, fontWeight: 600, fontSize: '0.82rem',
        color: 'text.primary', bgcolor: pin ? 'background.paper' : 'transparent',
        borderRight: '1px solid', borderColor: 'divider', userSelect: 'none',
        position: stickyStyles.position ?? 'relative',
        '&:hover': { bgcolor: 'action.hover' },
      }}
      {...(isDraggable && pin == null ? { ...dragAttributes, ...listeners } : {})}
    >
      <Box component="span" sx={{
        flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: align,
      }}>
        {column.header}
      </Box>

      {sortDir && (
        <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.25 }}>
          {sortDir === 'asc' ? (
            <ArrowUpward sx={{ fontSize: 14, color: 'primary.main' }} />
          ) : (
            <ArrowDownward sx={{ fontSize: 14, color: 'primary.main' }} />
          )}
          {sortIndex >= 0 && (
            <Box component="span" sx={{ fontSize: '0.65rem', color: 'primary.main' }}>
              {sortIndex + 1}
            </Box>
          )}
        </Box>
      )}

      {filterable && (
        <Tooltip title={hasFilter ? 'Filter active' : 'Filter column'}>
          <IconButton className="dg-header-action" size="small" onClick={onFilterClick}
            sx={{ p: 0.25, opacity: hasFilter || isHovered ? 1 : 0, transition: 'opacity 120ms' }}>
            {hasFilter ? (
              <FilterAlt sx={{ fontSize: 16, color: 'primary.main' }} />
            ) : (
              <FilterAltOutlined sx={{ fontSize: 16 }} />
            )}
          </IconButton>
        </Tooltip>
      )}

      {showColumnMenu && (
        <IconButton className="dg-header-action" size="small" onClick={onMenuClick}
          sx={{ p: 0.25, opacity: isHovered ? 1 : 0, transition: 'opacity 120ms' }}>
          <MoreVert sx={{ fontSize: 16 }} />
        </IconButton>
      )}

      {column.resizable !== false && (
        <Box className="dg-resize-handle" onMouseDown={onResizeStart}
          onClick={(e) => e.stopPropagation()}
          sx={{
            position: 'absolute', top: 0, right: 0, width: 6, height: '100%',
            cursor: 'col-resize', zIndex: 2,
            '&:hover': { bgcolor: 'primary.main', opacity: 0.3 },
          }}
        />
      )}
    </Box>
  )

  if (column.headerTooltip) {
    return <Tooltip title={column.headerTooltip} placement="top">{content}</Tooltip>
  }
  return content
}
