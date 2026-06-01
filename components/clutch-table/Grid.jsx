'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Box, Paper, ThemeProvider, createTheme, CssBaseline, IconButton, Button, Typography, Checkbox, Tooltip, CircularProgress, LinearProgress, Menu, MenuItem, ListItemText, Chip } from '@mui/material';
import Search from '@mui/icons-material/Search';
import Clear from '@mui/icons-material/Clear';
import Download from '@mui/icons-material/Download';
import ViewColumn from '@mui/icons-material/ViewColumn';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, horizontalListSortingStrategy } from '@dnd-kit/sortable';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useColumnState } from './hooks/useColumnState';
import { useGridData } from './hooks/useGridData';
import { useSelection } from './hooks/useSelection';
import { ColumnFilterPopover } from './components/ColumnFilterPopover';
import { ColumnMenu } from './components/ColumnMenu';
import { HeaderCell } from './components/HeaderCell';
import { CellErrorBoundary } from './components/CellErrorBoundary';
import { CellEditor } from './components/CellEditor';
import { ViewMenu } from './components/ViewMenu';
import { useSavedViews } from './hooks/useSavedViews';
import { clampPage, coerceNumber, devWarn, isFiniteNumber, safeString } from './utils/safe';
import { downloadCsv, rowsToCsv } from './utils/csv';
import { loadPersistedState, savePersistedState, PERSIST_VERSION } from './hooks/usePersistedState';
const DENSITIES = {
  compact: {
    rowHeight: 32,
    headerHeight: 36
  },
  standard: {
    rowHeight: 40,
    headerHeight: 44
  },
  comfortable: {
    rowHeight: 52,
    headerHeight: 52
  }
};
export function Grid(props) {
  const {
    columns,
    rows,
    getRowId,
    pageSize = 50,
    enablePagination = true,
    enableVirtualization = true,
    enableGlobalSearch = true,
    enableColumnFilters = true,
    enableSelection = true,
    enableMultiSort = true,
    enableCsvExport = true,
    enableColumnMenu = true,
    enableRangeSelection = true,
    enableSavedViews = true,
    rowHeight,
    headerHeight,
    visibleRows = 15,
    maxBodyHeight,
    density = 'standard',
    theme = 'light',
    emptyMessage = 'No rows to display',
    loading = false,
    onRowClick,
    onRowDoubleClick,
    onSelectionChange,
    onSortChange,
    onFilterChange,
    onCellEdit,
    getRowClassName,
    getRowStyle,
    getCellClassName,
    getCellStyle,
    toolbarActions,
    fileName = 'export',
    persistKey,
    /** When true, column widths grow so the grid uses the full scroll-area width (slack split evenly). */
    fillContainerWidth = true
  } = props;
  const persisted = useMemo(() => loadPersistedState(persistKey), [persistKey]);
  const dndContextId = useMemo(() => {
    const slug = String(persistKey ?? fileName ?? 'default')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    return `clutch-grid-${slug || 'default'}`;
  }, [persistKey, fileName]);
  const dimensions = DENSITIES[density];
  const effectiveRowHeight = rowHeight ?? dimensions.rowHeight;
  const effectiveHeaderHeight = headerHeight ?? dimensions.headerHeight;
  const effectiveMaxBodyHeight = maxBodyHeight ?? effectiveHeaderHeight + Math.max(1, visibleRows) * effectiveRowHeight;
  const muiTheme = useMemo(() => createTheme({
    palette: {
      mode: theme
    }
  }), [theme]);
  const safeRows = useMemo(() => Array.isArray(rows) ? rows : [], [rows]);
  const safeGetRowId = useCallback(row => {
    try {
      const id = getRowId(row);
      if (id == null) throw new Error('nullish id');
      return id;
    } catch {
      devWarn('getRowId threw or returned nullish — falling back to reference id');
      return row.__idx ?? JSON.stringify(row);
    }
  }, [getRowId]);
  const {
    visibleColumns,
    columns: validCols,
    state: colStates,
    setWidth,
    setHidden,
    setPin,
    moveColumn,
    resetState,
    applyState: applyColumnState
  } = useColumnState(columns, persisted?.columnState);
  const [globalSearch, setGlobalSearch] = useState(() => persisted?.globalSearch ?? '');
  const [sortModel, setSortModel] = useState(() => persisted?.sortModel ?? []);
  const [filters, setFilters] = useState(() => persisted?.filters ?? {});
  const [page, setPage] = useState(() => persisted?.page ?? 0);
  const [filterAnchor, setFilterAnchor] = useState(null);
  const [menuAnchor, setMenuAnchor] = useState(null);
  const [activeColumnKey, setActiveColumnKey] = useState(null);
  const [columnsMenuAnchor, setColumnsMenuAnchor] = useState(null);
  const [lastInteractedRowId, setLastInteractedRowId] = useState(() => persisted?.lastInteractedRowId ?? null);
  const resizingRef = useRef(null);
  const cellKey = (r, c) => `${r}:${c}`;
  const [selectedCells, setSelectedCells] = useState(() => new Set());
  const [drag, setDrag] = useState(null);
  const [anchor, setAnchor] = useState(null);
  const [focusedCell, setFocusedCell] = useState(null);
  const [editingCell, setEditingCell] = useState(null);
  const isRangeDragging = drag != null;
  const rectKeys = useCallback((a, b) => {
    const r1 = Math.min(a.r, b.r);
    const r2 = Math.max(a.r, b.r);
    const c1 = Math.min(a.c, b.c);
    const c2 = Math.max(a.c, b.c);
    const out = new Set();
    for (let r = r1; r <= r2; r++) for (let c = c1; c <= c2; c++) out.add(cellKey(r, c));
    return out;
  }, []);

  // Live selection includes in-progress drag
  const liveSelection = useMemo(() => {
    if (!drag) return selectedCells;
    const rect = rectKeys(drag.start, drag.end);
    if (drag.mode === 'replace') return rect;
    const union = new Set(selectedCells);
    for (const k of rect) union.add(k);
    return union;
  }, [drag, selectedCells, rectKeys]);
  useEffect(() => {
    if (onSortChange) onSortChange(sortModel);
  }, [sortModel, onSortChange]);
  useEffect(() => {
    if (onFilterChange) onFilterChange(filters);
  }, [filters, onFilterChange]);
  const activeColumn = useMemo(() => validCols.find(c => c.key === activeColumnKey) ?? null, [validCols, activeColumnKey]);
  const {
    processed,
    filteredCount,
    totalCount
  } = useGridData({
    rows: safeRows,
    columns: validCols,
    globalSearch,
    filters,
    sortModel
  });
  const pageCount = enablePagination ? Math.max(1, Math.ceil(processed.length / Math.max(1, pageSize))) : 1;
  const safePage = clampPage(page, pageCount);
  useEffect(() => {
    if (safePage !== page) setPage(safePage);
  }, [safePage, page]);
  const pagedRows = useMemo(() => {
    if (!enablePagination) return processed;
    const start = safePage * pageSize;
    return processed.slice(start, start + pageSize);
  }, [processed, enablePagination, safePage, pageSize]);

  // Clear cell selection when the underlying data view changes
  useEffect(() => {
    setSelectedCells(new Set());
    setDrag(null);
    setAnchor(null);
  }, [safePage, sortModel, filters, globalSearch]);

  // Commit drag on global mouseup
  useEffect(() => {
    if (!drag) return;
    const onUp = () => {
      setSelectedCells(prev => {
        const rect = rectKeys(drag.start, drag.end);
        if (drag.mode === 'replace') return rect;
        const union = new Set(prev);
        for (const k of rect) union.add(k);
        return union;
      });
      setDrag(null);
    };
    window.addEventListener('mouseup', onUp);
    return () => window.removeEventListener('mouseup', onUp);
  }, [drag, rectKeys]);
  const handleCellMouseDown = useCallback((rowIdx, colIdx, event) => {
    if (event.button !== 0) return;
    const point = {
      r: rowIdx,
      c: colIdx
    };
    setFocusedCell(point);
    if (!enableRangeSelection) return;
    const ctrl = event.ctrlKey || event.metaKey;
    const shift = event.shiftKey;
    if (shift && anchor) {
      // Shift-click: extend a rect from anchor to here. Replace unless ctrl held.
      const rect = rectKeys(anchor, point);
      setSelectedCells(prev => {
        if (ctrl) {
          const union = new Set(prev);
          for (const k of rect) union.add(k);
          return union;
        }
        return rect;
      });
      return;
    }
    if (ctrl) {
      // Ctrl-click: toggle single cell — e.g. "every second cell in a row"
      const k = cellKey(rowIdx, colIdx);
      setSelectedCells(prev => {
        const next = new Set(prev);
        if (next.has(k)) next.delete(k);else next.add(k);
        return next;
      });
      setAnchor(point);
      return;
    }

    // Plain click: start fresh rectangular selection
    setAnchor(point);
    setDrag({
      start: point,
      end: point,
      mode: 'replace'
    });
  }, [enableRangeSelection, anchor, rectKeys]);
  const handleCellMouseEnter = useCallback((rowIdx, colIdx) => {
    if (!enableRangeSelection) return;
    setDrag(prev => prev ? {
      ...prev,
      end: {
        r: rowIdx,
        c: colIdx
      }
    } : prev);
  }, [enableRangeSelection]);
  const clearRange = useCallback(() => {
    setSelectedCells(new Set());
    setDrag(null);
    setAnchor(null);
  }, []);
  const isCellEditable = useCallback((col, row) => {
    if (!col.editable) return false;
    if (typeof col.editable === 'function') {
      try {
        return col.editable(row);
      } catch {
        return false;
      }
    }
    return true;
  }, []);
  const beginEdit = useCallback((r, c, initialChar) => {
    setEditingCell({
      r,
      c,
      initialChar
    });
  }, []);
  const cancelEdit = useCallback(() => {
    setEditingCell(null);
    // Restore focus to the focused cell
    requestAnimationFrame(() => {
      const root = scrollRef.current;
      if (!root || !focusedCell) return;
      const el = root.querySelector(`[data-cell="${focusedCell.r}:${focusedCell.c}"]`);
      el?.focus({
        preventScroll: true
      });
    });
  }, [focusedCell]);
  const commitEdit = useCallback((r, c, newValue, action) => {
    const row = pagedRows[r];
    const col = visibleColumns[c]?.def;
    if (row && col) {
      const oldValue = (() => {
        try {
          return col.valueGetter ? col.valueGetter(row) : row[col.key];
        } catch {
          return undefined;
        }
      })();
      if (!Object.is(oldValue, newValue)) {
        try {
          onCellEdit?.({
            row,
            rowIndex: r,
            column: col,
            oldValue,
            newValue
          });
        } catch (err) {
          devWarn('onCellEdit threw', err);
        }
      }
    }
    setEditingCell(null);

    // Move focus per commit action
    const lastRow = pagedRows.length - 1;
    const lastCol = visibleColumns.length - 1;
    let nextR = r;
    let nextC = c;
    if (action === 'enter') nextR = Math.min(lastRow, r + 1);else if (action === 'tab') nextC = Math.min(lastCol, c + 1);else if (action === 'shift-tab') nextC = Math.max(0, c - 1);
    setFocusedCell({
      r: nextR,
      c: nextC
    });
  }, [pagedRows, visibleColumns, onCellEdit]);

  // Exit edit mode if the underlying view changes underneath us
  useEffect(() => {
    setEditingCell(null);
  }, [safePage, sortModel, filters, globalSearch]);
  const selection = useSelection({
    rows: safeRows,
    getRowId: safeGetRowId,
    onChange: onSelectionChange
  });
  const handleSort = useCallback((key, direction, append) => {
    setSortModel(prev => {
      if (direction == null) {
        return prev.filter(s => s.key !== key);
      }
      if (!enableMultiSort || !append) {
        return [{
          key: key,
          dir: direction
        }];
      }
      const existing = prev.find(s => s.key === key);
      if (existing) {
        return prev.map(s => s.key === key ? {
          ...s,
          dir: direction
        } : s);
      }
      return [...prev, {
        key: key,
        dir: direction
      }];
    });
  }, [enableMultiSort]);
  const cycleSort = useCallback((key, append) => {
    const current = sortModel.find(s => s.key === key);
    if (!current) {
      handleSort(key, 'asc', append);
    } else if (current.dir === 'asc') {
      handleSort(key, 'desc', append);
    } else {
      handleSort(key, null, append);
    }
  }, [sortModel, handleSort]);
  const handleResizeStart = useCallback((key, event) => {
    event.preventDefault();
    event.stopPropagation();
    const colState = colStates.find(c => c.key === key);
    if (!colState) return;
    resizingRef.current = {
      key,
      startX: event.clientX,
      startWidth: colState.width
    };
    const onMove = e => {
      const ctx = resizingRef.current;
      if (!ctx) return;
      const delta = e.clientX - ctx.startX;
      setWidth(ctx.key, ctx.startWidth + delta);
    };
    const onUp = () => {
      resizingRef.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [colStates, setWidth]);
  const handleDragEnd = useCallback(event => {
    const {
      active,
      over
    } = event;
    if (!over || active.id === over.id) return;
    moveColumn(String(active.id), String(over.id));
  }, [moveColumn]);
  const sensors = useSensors(useSensor(PointerSensor, {
    activationConstraint: {
      distance: 8
    }
  }));
  const scrollRef = useRef(null);
  const [bodyClientWidth, setBodyClientWidth] = useState(0);

  useLayoutEffect(() => {
    if (!fillContainerWidth) {
      setBodyClientWidth(0);
      return;
    }
    const el = scrollRef.current;
    if (!el) return;

    /** Ignore tiny width jitter (subpixel + layout during unrelated CSS transitions e.g. navbar). */
    const WIDTH_EPSILON_PX = 2;

    let rafId = null;
    let lastCommitted = -1;

    const commitWidth = (w) => {
      if (lastCommitted !== -1 && Math.abs(w - lastCommitted) < WIDTH_EPSILON_PX) return;
      lastCommitted = w;
      setBodyClientWidth(w);
    };

    const flush = () => {
      rafId = null;
      commitWidth(Math.floor(el.clientWidth));
    };

    const scheduleFlush = () => {
      if (rafId != null) return;
      rafId = requestAnimationFrame(flush);
    };

    flush();

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', scheduleFlush);
      return () => {
        window.removeEventListener('resize', scheduleFlush);
        if (rafId != null) cancelAnimationFrame(rafId);
      };
    }

    const ro = new ResizeObserver(() => scheduleFlush());
    ro.observe(el);
    return () => {
      ro.disconnect();
      if (rafId != null) cancelAnimationFrame(rafId);
    };
  }, [fillContainerWidth, visibleColumns.length]);

  const selectionColumnWidth = enableSelection ? 42 : 0;

  const columnWidthByKey = useMemo(() => {
    const map = new Map();
    const n = visibleColumns.length;
    if (n === 0) return map;

    const bases = visibleColumns.map((c) => c.state.width);

    if (!fillContainerWidth || bodyClientWidth <= selectionColumnWidth) {
      visibleColumns.forEach((c, i) => map.set(c.def.key, bases[i]));
      return map;
    }

    const availForCols = bodyClientWidth - selectionColumnWidth;
    const sumBase = bases.reduce((a, b) => a + b, 0);
    const extra = availForCols - sumBase;

    if (extra <= 0) {
      visibleColumns.forEach((c, i) => map.set(c.def.key, bases[i]));
      return map;
    }

    const addEach = Math.floor(extra / n);
    let remainder = extra - addEach * n;
    visibleColumns.forEach((c, i) => {
      const bump = addEach + (remainder > 0 ? 1 : 0);
      if (remainder > 0) remainder -= 1;
      map.set(c.def.key, bases[i] + bump);
    });
    return map;
  }, [visibleColumns, fillContainerWidth, bodyClientWidth, enableSelection, selectionColumnWidth]);

  const virtualizer = useVirtualizer({
    count: pagedRows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => effectiveRowHeight,
    overscan: 8
  });
  const virtualItems = enableVirtualization ? virtualizer.getVirtualItems() : null;
  const handleCellKeyDown = useCallback((r, c, event) => {
    // If we're already editing this cell, the editor handles its own keys
    if (editingCell && editingCell.r === r && editingCell.c === c) return;
    const lastRow = pagedRows.length - 1;
    const lastCol = visibleColumns.length - 1;
    if (lastRow < 0 || lastCol < 0) return;
    const row = pagedRows[r];
    const col = visibleColumns[c]?.def;
    const editable = row && col ? isCellEditable(col, row) : false;

    // Edit-mode entry shortcuts
    if (editable && (event.key === 'F2' || event.key === 'Enter' && !event.shiftKey)) {
      event.preventDefault();
      beginEdit(r, c);
      return;
    }
    if (event.key === 'Delete' || event.key === 'Backspace') {
      if (editable) {
        event.preventDefault();
        // Type-to-edit with empty initial value
        beginEdit(r, c, '');
        return;
      }
    }
    // Type-to-edit: any printable char with no modifier keys (other than shift)
    const isPrintable = event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey && event.key !== ' ';
    if (editable && isPrintable) {
      event.preventDefault();
      beginEdit(r, c, event.key);
      return;
    }
    let nextR = r;
    let nextC = c;
    let consumed = true;
    switch (event.key) {
      case 'ArrowDown':
        nextR = Math.min(lastRow, r + 1);
        break;
      case 'ArrowUp':
        nextR = Math.max(0, r - 1);
        break;
      case 'ArrowRight':
        nextC = Math.min(lastCol, c + 1);
        break;
      case 'ArrowLeft':
        nextC = Math.max(0, c - 1);
        break;
      case 'Home':
        nextC = 0;
        if (event.ctrlKey || event.metaKey) nextR = 0;
        break;
      case 'End':
        nextC = lastCol;
        if (event.ctrlKey || event.metaKey) nextR = lastRow;
        break;
      case 'PageDown':
        nextR = Math.min(lastRow, r + Math.max(1, visibleRows));
        break;
      case 'PageUp':
        nextR = Math.max(0, r - Math.max(1, visibleRows));
        break;
      case ' ':
        if (enableSelection) {
          const r0 = pagedRows[r];
          if (r0) selection.toggleRow(safeGetRowId(r0));
        }
        event.preventDefault();
        return;
      case 'Enter':
        if (!event.shiftKey) {
          const r0 = pagedRows[r];
          if (r0) {
            setLastInteractedRowId(safeGetRowId(r0));
            onRowClick?.(r0);
          }
          event.preventDefault();
          return;
        }
        nextR = Math.max(0, r - 1);
        break;
      default:
        consumed = false;
    }
    if (!consumed) return;
    event.preventDefault();
    if (nextR === r && nextC === c) return;
    const next = {
      r: nextR,
      c: nextC
    };
    setFocusedCell(next);
    if (event.shiftKey && enableRangeSelection && anchor) {
      setSelectedCells(rectKeys(anchor, next));
    } else {
      setAnchor(next);
      if (enableRangeSelection) setSelectedCells(new Set([cellKey(nextR, nextC)]));
    }
  }, [pagedRows, visibleColumns, visibleRows, enableSelection, enableRangeSelection, selection, safeGetRowId, anchor, rectKeys, onRowClick, editingCell, isCellEditable, beginEdit]);

  // Programmatic focus on cell change. Scrolls the row into view if virtualized,
  // then focuses the DOM node on the next frame so the cell exists.
  useEffect(() => {
    if (!focusedCell) return;
    if (enableVirtualization) {
      try {
        virtualizer.scrollToIndex(focusedCell.r, {
          align: 'auto'
        });
      } catch {/* noop */}
    }
    const id = window.requestAnimationFrame(() => {
      const root = scrollRef.current;
      if (!root) return;
      const sel = `[data-cell="${focusedCell.r}:${focusedCell.c}"]`;
      const el = root.querySelector(sel);
      if (el && document.activeElement !== el) {
        el.focus({
          preventScroll: true
        });
      }
    });
    return () => window.cancelAnimationFrame(id);
  }, [focusedCell, enableVirtualization, virtualizer]);

  // Clamp focused cell when the underlying view changes
  useEffect(() => {
    setFocusedCell(prev => {
      if (!prev) return prev;
      const lastRow = pagedRows.length - 1;
      const lastCol = visibleColumns.length - 1;
      if (lastRow < 0 || lastCol < 0) return null;
      const r = Math.min(prev.r, lastRow);
      const c = Math.min(prev.c, lastCol);
      return r === prev.r && c === prev.c ? prev : {
        r,
        c
      };
    });
  }, [pagedRows.length, visibleColumns.length]);
  const leftPinOffsets = useMemo(() => {
    const offsets = new Map();
    let acc = 0;
    for (const col of visibleColumns) {
      if (col.state.pin !== 'left') continue;
      offsets.set(col.def.key, acc);
      acc += columnWidthByKey.get(col.def.key) ?? col.state.width;
    }
    return offsets;
  }, [visibleColumns, columnWidthByKey]);
  const rightPinOffsets = useMemo(() => {
    const offsets = new Map();
    const rightCols = visibleColumns.filter(c => c.state.pin === 'right');
    let acc = 0;
    for (let i = rightCols.length - 1; i >= 0; i--) {
      offsets.set(rightCols[i].def.key, acc);
      acc += columnWidthByKey.get(rightCols[i].def.key) ?? rightCols[i].state.width;
    }
    return offsets;
  }, [visibleColumns, columnWidthByKey]);
  const allOnPageSelected = pagedRows.length > 0 && pagedRows.every(row => selection.isSelected(safeGetRowId(row)));
  const aggregationRow = useMemo(() => {
    if (!enableSelection || selection.count === 0) return null;
    const sums = {};
    const counts = {};
    const mins = {};
    const maxs = {};
    for (const row of selection.selectedRows) {
      for (const col of validCols) {
        if (!col.aggregation) continue;
        try {
          const raw = col.valueGetter ? col.valueGetter(row) : row[col.key];
          const n = coerceNumber(raw);
          if (n == null) continue;
          counts[col.key] = (counts[col.key] ?? 0) + 1;
          sums[col.key] = (sums[col.key] ?? 0) + n;
          mins[col.key] = mins[col.key] == null ? n : Math.min(mins[col.key], n);
          maxs[col.key] = maxs[col.key] == null ? n : Math.max(maxs[col.key], n);
        } catch {
          // skip
        }
      }
    }
    const result = {};
    for (const col of validCols) {
      if (!col.aggregation) continue;
      const count = counts[col.key] ?? 0;
      if (count === 0) {
        result[col.key] = '';
        continue;
      }
      switch (col.aggregation) {
        case 'sum':
          result[col.key] = sums[col.key];
          break;
        case 'avg':
          result[col.key] = sums[col.key] / count;
          break;
        case 'min':
          result[col.key] = mins[col.key];
          break;
        case 'max':
          result[col.key] = maxs[col.key];
          break;
        case 'count':
          result[col.key] = count;
          break;
      }
    }
    return result;
  }, [enableSelection, selection.count, selection.selectedRows, validCols]);
  const handleCsvExport = useCallback(() => {
    const csv = rowsToCsv(validCols, processed);
    downloadCsv(fileName, csv);
  }, [validCols, processed, fileName]);
  const rangeStats = useMemo(() => {
    if (liveSelection.size === 0) return null;
    let sum = 0;
    let numericCount = 0;
    let cellCount = 0;
    let min = Number.POSITIVE_INFINITY;
    let max = Number.NEGATIVE_INFINITY;
    const rowIdxs = new Set();
    const colIdxs = new Set();
    for (const key of liveSelection) {
      const [rStr, cStr] = key.split(':');
      const r = Number(rStr);
      const c = Number(cStr);
      const row = pagedRows[r];
      if (!row) continue;
      const col = visibleColumns[c];
      if (!col) continue;
      cellCount++;
      rowIdxs.add(r);
      colIdxs.add(c);
      try {
        const value = col.def.valueGetter ? col.def.valueGetter(row) : row[col.def.key];
        const n = coerceNumber(value);
        if (n == null) continue;
        numericCount++;
        sum += n;
        if (n < min) min = n;
        if (n > max) max = n;
      } catch {
        // skip
      }
    }
    return {
      rows: rowIdxs.size,
      cols: colIdxs.size,
      cellCount,
      numericCount,
      sum: numericCount > 0 ? sum : 0,
      avg: numericCount > 0 ? sum / numericCount : 0,
      min: numericCount > 0 ? min : 0,
      max: numericCount > 0 ? max : 0
    };
  }, [liveSelection, pagedRows, visibleColumns]);
  const totalColumnsWidth = visibleColumns.reduce((sum, c) => sum + (columnWidthByKey.get(c.def.key) ?? c.state.width), 0) + selectionColumnWidth;
  const hasActiveFilters = Object.values(filters).some(f => f);
  const isCellInRange = useCallback((rowIdx, colIdx) => liveSelection.has(cellKey(rowIdx, colIdx)), [liveSelection]);

  // Persist state to localStorage (debounced via effect batching)
  useEffect(() => {
    if (!persistKey) return;
    const snapshot = {
      version: PERSIST_VERSION,
      globalSearch,
      sortModel: sortModel,
      filters,
      page: safePage,
      lastInteractedRowId,
      scrollTop: scrollRef.current?.scrollTop ?? 0,
      columnState: colStates
    };
    const handle = window.setTimeout(() => savePersistedState(persistKey, snapshot), 150);
    return () => window.clearTimeout(handle);
  }, [persistKey, globalSearch, sortModel, filters, safePage, lastInteractedRowId, colStates]);

  // Also persist scroll position changes (throttled)
  useEffect(() => {
    if (!persistKey) return;
    const el = scrollRef.current;
    if (!el) return;
    let raf = null;
    const onScroll = () => {
      if (raf != null) return;
      raf = window.requestAnimationFrame(() => {
        raf = null;
        const snapshot = {
          version: PERSIST_VERSION,
          globalSearch,
          sortModel: sortModel,
          filters,
          page: safePage,
          lastInteractedRowId,
          scrollTop: el.scrollTop,
          columnState: colStates
        };
        savePersistedState(persistKey, snapshot);
      });
    };
    el.addEventListener('scroll', onScroll, {
      passive: true
    });
    return () => {
      el.removeEventListener('scroll', onScroll);
      if (raf != null) window.cancelAnimationFrame(raf);
    };
  }, [persistKey, globalSearch, sortModel, filters, safePage, lastInteractedRowId, colStates]);

  // Restore scroll / focus to last interacted row after rows are available
  const didRestoreRef = useRef(false);
  useEffect(() => {
    if (didRestoreRef.current) return;
    if (!persisted || pagedRows.length === 0) return;
    const targetId = persisted.lastInteractedRowId;
    if (targetId != null) {
      const idx = pagedRows.findIndex(r => safeGetRowId(r) === targetId);
      if (idx >= 0 && enableVirtualization) {
        try {
          virtualizer.scrollToIndex(idx, {
            align: 'center'
          });
          didRestoreRef.current = true;
          return;
        } catch {
          // fall through to scrollTop
        }
      }
    }
    if (typeof persisted.scrollTop === 'number' && scrollRef.current) {
      scrollRef.current.scrollTop = persisted.scrollTop;
    }
    didRestoreRef.current = true;
  }, [persisted, pagedRows, safeGetRowId, enableVirtualization, virtualizer]);

  // ---- Saved Views ----
  const showSavedViews = enableSavedViews && Boolean(persistKey);
  const buildSnapshot = useCallback(() => ({
    version: PERSIST_VERSION,
    globalSearch,
    sortModel: sortModel,
    filters,
    page: safePage,
    lastInteractedRowId,
    scrollTop: scrollRef.current?.scrollTop ?? 0,
    columnState: colStates
  }), [globalSearch, sortModel, filters, safePage, lastInteractedRowId, colStates]);
  const views = useSavedViews(persistKey, persisted);
  const applySnapshot = useCallback(snap => {
    setGlobalSearch(snap.globalSearch ?? '');
    setSortModel(snap.sortModel ?? []);
    setFilters(snap.filters ?? {});
    setPage(typeof snap.page === 'number' ? snap.page : 0);
    setLastInteractedRowId(snap.lastInteractedRowId ?? null);
    applyColumnState(snap.columnState ?? null);
    // Defer scroll to next frame so the body has remounted with new data
    requestAnimationFrame(() => {
      if (scrollRef.current && typeof snap.scrollTop === 'number') {
        scrollRef.current.scrollTop = snap.scrollTop;
      }
    });
  }, [applyColumnState]);
  return <ThemeProvider theme={muiTheme}>
      <CssBaseline />
      <Paper elevation={0} variant="outlined" sx={{
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      borderRadius: 2,
      fontFamily: t => t.typography.fontFamily,
      bgcolor: 'background.paper'
    }}>
        <Box sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        p: 1.25,
        borderBottom: '1px solid',
        borderColor: 'divider',
        flexWrap: 'wrap'
      }}>
          {enableGlobalSearch && <Box sx={{
          minWidth: 240,
          display: 'flex',
          alignItems: 'center',
          gap: 0.5,
          px: 1,
          py: 0.25,
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 1,
          bgcolor: 'background.paper'
        }}>
              <Search fontSize="small" color="action" />
              <Box component="input" type="text" placeholder="Search..." value={globalSearch} suppressHydrationWarning onChange={e => {
            setGlobalSearch(e.target.value);
            setPage(0);
          }} sx={{
            flex: 1,
            minWidth: 0,
            border: 'none',
            outline: 'none',
            bgcolor: 'transparent',
            color: 'text.primary',
            fontSize: '0.875rem',
            py: 0.75,
            '&::placeholder': {
              color: 'text.secondary',
              opacity: 1
            }
          }} />
              {globalSearch ? <IconButton size="small" onClick={() => setGlobalSearch('')}>
                  <Clear fontSize="small" />
                </IconButton> : null}
            </Box>}

          {hasActiveFilters && <Chip size="small" label={`${Object.keys(filters).filter(k => filters[k]).length} filter(s)`} onDelete={() => setFilters({})} color="primary" variant="outlined" />}

          {showSavedViews && <ViewMenu views={views.viewsList.map(v => ({
          id: v.id,
          name: v.name
        }))} currentId={views.currentId} defaultId={views.defaultId} onSelect={id => {
          const view = views.setCurrent(id);
          if (view) applySnapshot(view.snapshot);
        }} onSave={() => views.saveCurrent(buildSnapshot())} onSaveAs={name => views.saveAs(name, buildSnapshot())} onRename={(id, name) => views.rename(id, name)} onDelete={id => {
          views.remove(id);
          // After deletion, the hook re-points currentId — apply that view's snapshot
          requestAnimationFrame(() => {
            if (views.currentView) applySnapshot(views.currentView.snapshot);
          });
        }} onSetDefault={id => views.setDefault(id)} />}

          <Box sx={{
          flex: 1
        }} />

          {toolbarActions}

          {enableColumnMenu && <>
              <Tooltip title="Columns">
                <IconButton size="small" onClick={e => setColumnsMenuAnchor(e.currentTarget)}>
                  <ViewColumn fontSize="small" />
                </IconButton>
              </Tooltip>
              <Menu anchorEl={columnsMenuAnchor} open={Boolean(columnsMenuAnchor)} onClose={() => setColumnsMenuAnchor(null)}>
                {validCols.map(col => {
              const st = colStates.find(c => c.key === col.key);
              if (!st) return null;
              return <MenuItem key={col.key} onClick={() => setHidden(col.key, !st.hidden)} dense>
                      <Checkbox size="small" checked={!st.hidden} slotProps={{ input: { suppressHydrationWarning: true } }} />
                      <ListItemText primary={col.header} />
                    </MenuItem>;
            })}
                <MenuItem onClick={() => {
              resetState();
              setColumnsMenuAnchor(null);
            }} dense>
                  <ListItemText primary="Reset columns" />
                </MenuItem>
              </Menu>
            </>}

          {enableCsvExport && <Tooltip title="Export CSV">
              <IconButton size="small" onClick={handleCsvExport}>
                <Download fontSize="small" />
              </IconButton>
            </Tooltip>}
        </Box>

        {loading && <LinearProgress />}

        <Box ref={scrollRef} sx={{
        position: 'relative',
        overflow: 'auto',
        maxHeight: effectiveMaxBodyHeight,
        minHeight: 160,
        outline: 'none'
      }} tabIndex={focusedCell ? -1 : 0} onFocus={e => {
        // Tab into the grid: move focus to the first cell (or last focused cell)
        if (e.target !== e.currentTarget) return;
        if (!focusedCell && pagedRows.length > 0 && visibleColumns.length > 0) {
          setFocusedCell({
            r: 0,
            c: 0
          });
        }
      }} role="grid" aria-rowcount={pagedRows.length} aria-colcount={visibleColumns.length + (enableSelection ? 1 : 0)}>
          <Box sx={{
          minWidth: totalColumnsWidth,
          display: 'flex',
          flexDirection: 'column'
        }}>
            <DndContext id={dndContextId} sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={visibleColumns.filter(c => c.state.pin == null).map(c => c.def.key)} strategy={horizontalListSortingStrategy}>
                <Box role="row" sx={{
                display: 'flex',
                height: effectiveHeaderHeight,
                position: 'sticky',
                top: 0,
                zIndex: 4,
                bgcolor: 'background.paper',
                borderBottom: '2px solid',
                borderColor: 'divider'
              }}>
                  {enableSelection && <Box sx={{
                  width: 42,
                  minWidth: 42,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'sticky',
                  left: 0,
                  zIndex: 5,
                  bgcolor: 'background.paper',
                  borderRight: '1px solid',
                  borderColor: 'divider'
                }}>
                      <Checkbox size="small" checked={allOnPageSelected} indeterminate={!allOnPageSelected && pagedRows.some(r => selection.isSelected(safeGetRowId(r)))} onChange={() => {
                    const ids = pagedRows.map(r => safeGetRowId(r));
                    selection.toggleMany(ids, !allOnPageSelected);
                  }} slotProps={{ input: { suppressHydrationWarning: true } }} />
                    </Box>}

                  {visibleColumns.map(col => {
                  const sortItem = sortModel.find(s => s.key === col.def.key);
                  const sortIdx = sortModel.findIndex(s => s.key === col.def.key);
                  const hasFilter = Boolean(filters[col.def.key]);
                  return <HeaderCell key={col.def.key} column={col.def} width={columnWidthByKey.get(col.def.key) ?? col.state.width} pin={col.state.pin} pinLeftOffset={leftPinOffsets.get(col.def.key) ?? 0 + (enableSelection && col.state.pin === 'left' ? 42 : 0)} pinRightOffset={rightPinOffsets.get(col.def.key) ?? 0} sortIndex={sortIdx} sortDir={sortItem?.dir ?? null} hasFilter={hasFilter} showColumnMenu={enableColumnMenu} enableColumnFilters={enableColumnFilters} isDraggable={col.def.reorderable !== false} onSortClick={e => cycleSort(col.def.key, e.shiftKey)} onFilterClick={e => {
                    e.stopPropagation();
                    setActiveColumnKey(col.def.key);
                    setFilterAnchor(e.currentTarget);
                  }} onMenuClick={e => {
                    e.stopPropagation();
                    setActiveColumnKey(col.def.key);
                    setMenuAnchor(e.currentTarget);
                  }} onResizeStart={e => handleResizeStart(col.def.key, e)} />;
                })}
                </Box>
              </SortableContext>
            </DndContext>

            <Box sx={{
            position: 'relative',
            width: '100%',
            height: enableVirtualization ? virtualizer.getTotalSize() : pagedRows.length * effectiveRowHeight
          }} role="rowgroup">
              {pagedRows.length === 0 && !loading && <Box sx={{
              p: 4,
              textAlign: 'center',
              color: 'text.secondary'
            }}>
                  {emptyMessage}
                </Box>}

              {pagedRows.length === 0 && loading && <Box sx={{
              p: 4,
              textAlign: 'center'
            }}>
                  <CircularProgress size={24} />
                </Box>}

              {(enableVirtualization ? virtualItems ?? [] : pagedRows.map((_, i) => ({
              index: i,
              start: i * effectiveRowHeight,
              size: effectiveRowHeight,
              key: i
            }))).map(vi => {
              const row = pagedRows[vi.index];
              if (!row) return null;
              const rowId = safeGetRowId(row);
              const isSelected = selection.isSelected(rowId);
              let rowClass;
              let rowExtraStyle;
              try {
                rowClass = getRowClassName?.({
                  row,
                  rowIndex: vi.index
                }) ?? undefined;
              } catch (err) {
                devWarn('getRowClassName threw', err);
              }
              try {
                rowExtraStyle = getRowStyle?.({
                  row,
                  rowIndex: vi.index
                }) ?? undefined;
              } catch (err) {
                devWarn('getRowStyle threw', err);
              }
              return <Box key={rowId} role="row" className={rowClass} onClick={() => {
                setLastInteractedRowId(rowId);
                onRowClick?.(row);
              }} onDoubleClick={() => {
                setLastInteractedRowId(rowId);
                onRowDoubleClick?.(row);
              }} style={rowExtraStyle} sx={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                display: 'flex',
                height: effectiveRowHeight,
                transform: `translateY(${vi.start}px)`,
                bgcolor: isSelected ? 'action.selected' : 'transparent',
                borderBottom: '1px solid',
                borderColor: 'divider',
                cursor: onRowClick || onRowDoubleClick ? 'pointer' : 'default',
                outline: 'none',
                '&:hover': {
                  bgcolor: isSelected ? 'action.selected' : 'action.hover'
                },
                '&:focus-visible': {
                  outline: '2px solid',
                  outlineColor: 'primary.main',
                  outlineOffset: '-2px'
                }
              }}>
                      {enableSelection && <Box sx={{
                  width: 42,
                  minWidth: 42,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'sticky',
                  left: 0,
                  zIndex: 2,
                  bgcolor: 'inherit',
                  borderRight: '1px solid',
                  borderColor: 'divider'
                }} onClick={e => e.stopPropagation()}>
                          <Checkbox size="small" checked={isSelected} onChange={() => selection.toggleRow(rowId)} slotProps={{ input: { suppressHydrationWarning: true } }} />
                        </Box>}

                      {visibleColumns.map((col, colIdx) => {
                  const align = col.def.align ?? (col.def.type === 'number' ? 'right' : 'left');
                  let raw;
                  try {
                    raw = col.def.valueGetter ? col.def.valueGetter(row) : row[col.def.key];
                  } catch {
                    raw = undefined;
                  }
                  let rendered;
                  try {
                    if (col.def.renderCell) {
                      rendered = col.def.renderCell({
                        value: raw,
                        row,
                        rowIndex: vi.index
                      });
                    } else if (col.def.format) {
                      rendered = col.def.format(raw, row);
                    } else {
                      rendered = raw == null ? '' : safeString(raw);
                    }
                  } catch {
                    rendered = <span style={{
                      color: '#d32f2f'
                    }}>—</span>;
                  }
                  const pin = col.state.pin;
                  const stickyStyles = {};
                  if (pin === 'left') {
                    const offset = (leftPinOffsets.get(col.def.key) ?? 0) + (enableSelection ? 42 : 0);
                    stickyStyles.position = 'sticky';
                    stickyStyles.left = offset;
                    stickyStyles.zIndex = 2;
                    stickyStyles.bgcolor = 'inherit';
                  } else if (pin === 'right') {
                    stickyStyles.position = 'sticky';
                    stickyStyles.right = rightPinOffsets.get(col.def.key) ?? 0;
                    stickyStyles.zIndex = 2;
                    stickyStyles.bgcolor = 'inherit';
                  }
                  const inRange = isCellInRange(vi.index, colIdx);
                  const styleParams = {
                    row,
                    column: col.def,
                    value: raw,
                    rowIndex: vi.index
                  };
                  let gridCellClass;
                  let colCellClass;
                  let gridCellStyle;
                  let colCellStyle;
                  try {
                    gridCellClass = getCellClassName?.(styleParams) ?? undefined;
                  } catch (err) {
                    devWarn('getCellClassName threw', err);
                  }
                  try {
                    colCellClass = col.def.cellClassName?.(styleParams) ?? undefined;
                  } catch (err) {
                    devWarn('column.cellClassName threw', err);
                  }
                  try {
                    gridCellStyle = getCellStyle?.(styleParams) ?? undefined;
                  } catch (err) {
                    devWarn('getCellStyle threw', err);
                  }
                  try {
                    colCellStyle = col.def.cellStyle?.(styleParams) ?? undefined;
                  } catch (err) {
                    devWarn('column.cellStyle threw', err);
                  }
                  const mergedCellClass = [gridCellClass, colCellClass].filter(Boolean).join(' ') || undefined;
                  const mergedCellStyle = gridCellStyle || colCellStyle ? {
                    ...gridCellStyle,
                    ...colCellStyle
                  } : undefined;
                  const isFocused = focusedCell?.r === vi.index && focusedCell?.c === colIdx;
                  return <Box key={col.def.key} role="gridcell" className={mergedCellClass} data-cell={`${vi.index}:${colIdx}`} tabIndex={isFocused ? 0 : -1} onMouseDown={e => handleCellMouseDown(vi.index, colIdx, e)} onMouseEnter={() => handleCellMouseEnter(vi.index, colIdx)} onDoubleClick={e => {
                    if (isCellEditable(col.def, row)) {
                      e.stopPropagation();
                      beginEdit(vi.index, colIdx);
                    }
                  }} onKeyDown={e => handleCellKeyDown(vi.index, colIdx, e)} onFocus={() => {
                    if (!isFocused) setFocusedCell({
                      r: vi.index,
                      c: colIdx
                    });
                  }} style={mergedCellStyle} sx={{
                    width: columnWidthByKey.get(col.def.key) ?? col.state.width,
                    minWidth: columnWidthByKey.get(col.def.key) ?? col.state.width,
                    maxWidth: columnWidthByKey.get(col.def.key) ?? col.state.width,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: align === 'right' ? 'flex-end' : align === 'center' ? 'center' : 'flex-start',
                    px: 1.25,
                    fontSize: '0.85rem',
                    borderRight: '1px solid',
                    borderColor: 'divider',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    userSelect: isRangeDragging ? 'none' : 'auto',
                    outline: 'none',
                    ...stickyStyles,
                    ...(inRange && {
                      bgcolor: t => t.palette.mode === 'dark' ? 'rgba(144, 202, 249, 0.24)' : 'rgba(25, 118, 210, 0.12)',
                      outline: t => `1px solid ${t.palette.primary.main}`,
                      outlineOffset: '-1px',
                      zIndex: 1
                    }),
                    ...(isFocused && {
                      outline: t => `2px solid ${t.palette.primary.main}`,
                      outlineOffset: '-2px',
                      zIndex: 3
                    })
                  }}>
                            <CellErrorBoundary context={col.def.key}>
                              {editingCell?.r === vi.index && editingCell?.c === colIdx ? <CellEditor value={raw} row={row} column={col.def} initialChar={editingCell.initialChar} onCommit={(next, action) => commitEdit(vi.index, colIdx, next, action)} onCancel={cancelEdit} /> : <Box component="span" sx={{
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}>
                                  {rendered}
                                </Box>}
                            </CellErrorBoundary>
                          </Box>;
                })}
                    </Box>;
            })}
            </Box>
          </Box>
        </Box>

        {aggregationRow && <Box sx={{
        display: 'flex',
        minWidth: totalColumnsWidth,
        bgcolor: 'action.hover',
        borderTop: '2px solid',
        borderColor: 'primary.main',
        fontWeight: 600,
        height: effectiveRowHeight
      }}>
            {enableSelection && <Box sx={{
          width: 42,
          minWidth: 42,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '0.85rem'
        }}>
                Σ
              </Box>}
            {visibleColumns.map(col => {
          const align = col.def.align ?? (col.def.type === 'number' ? 'right' : 'left');
          const agg = aggregationRow[col.def.key];
          let display = '';
          if (agg !== '' && agg !== undefined) {
            if (col.def.format && isFiniteNumber(agg)) {
              try {
                display = col.def.format(agg, {});
              } catch {
                display = agg;
              }
            } else {
              display = agg;
            }
          }
          return <Box key={col.def.key} sx={{
            width: columnWidthByKey.get(col.def.key) ?? col.state.width,
            minWidth: columnWidthByKey.get(col.def.key) ?? col.state.width,
            maxWidth: columnWidthByKey.get(col.def.key) ?? col.state.width,
            display: 'flex',
            alignItems: 'center',
            justifyContent: align === 'right' ? 'flex-end' : align === 'center' ? 'center' : 'flex-start',
            px: 1.25,
            fontSize: '0.85rem',
            borderRight: '1px solid',
            borderColor: 'divider'
          }}>
                  {display}
                </Box>;
        })}
          </Box>}

        {rangeStats && rangeStats.cellCount > 1 && <Box sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        px: 1.5,
        py: 0.75,
        borderTop: '1px solid',
        borderColor: 'divider',
        bgcolor: t => t.palette.mode === 'dark' ? 'rgba(144,202,249,0.12)' : 'rgba(25,118,210,0.06)',
        fontSize: '0.8rem',
        flexWrap: 'wrap'
      }}>
            <Typography variant="caption" sx={{
          fontWeight: 600
        }}>
              {rangeStats.cellCount} cells
              {rangeStats.rows > 0 && ` · ${rangeStats.rows} rows × ${rangeStats.cols} cols`}
            </Typography>
            <Typography variant="caption">
              Sum: <b>{rangeStats.numericCount > 0 ? rangeStats.sum.toLocaleString(undefined, {
              maximumFractionDigits: 4
            }) : '—'}</b>
            </Typography>
            <Typography variant="caption">
              Avg: <b>{rangeStats.numericCount > 0 ? rangeStats.avg.toLocaleString(undefined, {
              maximumFractionDigits: 4
            }) : '—'}</b>
            </Typography>
            <Typography variant="caption">
              Min: <b>{rangeStats.numericCount > 0 ? rangeStats.min.toLocaleString(undefined, {
              maximumFractionDigits: 4
            }) : '—'}</b>
            </Typography>
            <Typography variant="caption">
              Max: <b>{rangeStats.numericCount > 0 ? rangeStats.max.toLocaleString(undefined, {
              maximumFractionDigits: 4
            }) : '—'}</b>
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Numeric: {rangeStats.numericCount}
            </Typography>
            <Box sx={{
          flex: 1
        }} />
            <Button size="small" onClick={clearRange}>Clear range</Button>
          </Box>}

        <Box sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        p: 1.25,
        borderTop: '1px solid',
        borderColor: 'divider',
        gap: 1,
        flexWrap: 'wrap'
      }}>
          <Box sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          flexWrap: 'wrap'
        }}>
            <Typography variant="caption" color="text.secondary">
              {filteredCount.toLocaleString()} {filteredCount === 1 ? 'row' : 'rows'}
              {filteredCount !== totalCount && ` (filtered from ${totalCount.toLocaleString()})`}
            </Typography>
            {enableSelection && selection.count > 0 && <>
                <Chip size="small" label={`${selection.count} selected`} color="primary" variant="outlined" />
                <Button size="small" onClick={selection.clear}>Clear</Button>
              </>}
          </Box>

          {enablePagination && pageCount > 1 && <Box sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1
        }}>
              <Button size="small" disabled={safePage === 0} onClick={() => setPage(0)}>«</Button>
              <Button size="small" disabled={safePage === 0} onClick={() => setPage(p => Math.max(0, p - 1))}>Prev</Button>
              <Typography variant="caption">Page {safePage + 1} of {pageCount}</Typography>
              <Button size="small" disabled={safePage >= pageCount - 1} onClick={() => setPage(p => Math.min(pageCount - 1, p + 1))}>Next</Button>
              <Button size="small" disabled={safePage >= pageCount - 1} onClick={() => setPage(pageCount - 1)}>»</Button>
            </Box>}
        </Box>
      </Paper>

      <ColumnFilterPopover anchorEl={filterAnchor} column={activeColumn} rows={safeRows} currentFilter={activeColumnKey ? filters[activeColumnKey] : undefined} onClose={() => setFilterAnchor(null)} onChange={filter => {
      if (!activeColumnKey) return;
      setFilters(prev => {
        const next = {
          ...prev
        };
        if (!filter) delete next[activeColumnKey];else next[activeColumnKey] = filter;
        return next;
      });
      setPage(0);
    }} />

      <ColumnMenu anchorEl={menuAnchor} column={activeColumn} currentPin={colStates.find(c => c.key === activeColumnKey)?.pin ?? null} onClose={() => setMenuAnchor(null)} onSort={dir => {
      if (!activeColumnKey) return;
      handleSort(activeColumnKey, dir, false);
    }} onHide={() => {
      if (!activeColumnKey) return;
      setHidden(activeColumnKey, true);
    }} onPin={pin => {
      if (!activeColumnKey) return;
      setPin(activeColumnKey, pin);
    }} />
    </ThemeProvider>;
}
export default Grid;
