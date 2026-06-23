'use client';

import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState, forwardRef } from 'react';
import { Box, Paper, ThemeProvider, createTheme, CssBaseline, IconButton, Button, Typography, Checkbox, Tooltip, CircularProgress, LinearProgress, Menu, MenuItem, ListItemText, Chip, FormControl, Select } from '@mui/material';
import { alpha } from '@mui/material/styles';
import Search from '@mui/icons-material/Search';
import Clear from '@mui/icons-material/Clear';
import Download from '@mui/icons-material/Download';
import ViewColumn from '@mui/icons-material/ViewColumn';
import SortIcon from '@mui/icons-material/Sort';
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
import { SortDialog } from './components/SortDialog';
import { useSavedViews } from './hooks/useSavedViews';
import { clampPage, coerceNumber, devWarn, isFiniteNumber, safeString } from './utils/safe';
import { downloadCsv, rowsToCsv } from './utils/csv';
import { loadPersistedState, savePersistedState, PERSIST_VERSION } from './hooks/usePersistedState';
import { useUserGridPreference } from './hooks/useUserGridPreference';
import { getSessionSearch, setSessionSearch } from './utils/sessionSearch';
const DENSITIES = {
  compact: {
    rowHeight: 32,
    headerHeight: 40
  },
  standard: {
    rowHeight: 40,
    headerHeight: 48
  },
  comfortable: {
    rowHeight: 52,
    headerHeight: 56
  },
  legacy: {
    rowHeight: 26,
    headerHeight: 28
  }
};

const RANGE_DRAG_THRESHOLD_PX = 4;
/** Delay single-click row activate so double-click can cancel it and open instead. */
const ROW_CLICK_DELAY_MS = 250;

/** Solid background for sticky row cells (selection / pinned) so scrolled content does not show through. */
function resolveStickyRowBackground(theme, { isSelected, rowBackgroundColor }) {
  if (rowBackgroundColor) return rowBackgroundColor;
  if (isSelected) return theme.palette.action.selected;
  return theme.palette.background.paper;
}

function persistKeyFromPathname(pathname) {
  return String(pathname ?? '').replace(/^\/|\/$/g, '').replace(/\//g, '-') || 'home';
}

export const Grid = forwardRef(function Grid(props, ref) {
  const {
    columns,
    rows,
    getRowId,
    pageSize = 200,
    pageSizeOptions = [10, 50, 100, 200, 500, 1000],
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
    onRowContextMenu,
    getRowHref,
    onPersistedRowActivate,
    onSelectionChange,
    onSortChange,
    onFilterChange,
    onPageSizeChange,
    onCellEdit,
    getRowClassName,
    getRowStyle,
    getCellClassName,
    getCellStyle,
    toolbarActions,
    fileName = 'export',
    persistKey,
    skin = 'default',
    className,
    hideToolbar = false,
    searchValue: searchValueProp,
    onSearchChange,
    /** When true, column widths grow so the grid uses the full scroll-area width (slack split evenly). */
    fillContainerWidth = true
  } = props;
  const pathname = usePathname();
  const effectivePersistKey = useMemo(() => {
    if (persistKey === false) return null;
    if (persistKey) return persistKey;
    return persistKeyFromPathname(pathname);
  }, [persistKey, pathname]);
  // localStorage is read after mount so SSR and the first client render match (avoids hydration mismatch).
  const [legacySnapshot, setLegacySnapshot] = useState(null);
  const [persistedInitialSelectedIds, setPersistedInitialSelectedIds] = useState([]);
  const scrollTopRef = useRef(0);
  const pendingScrollRestoreRef = useRef(null);
  const didRestoreScrollRef = useRef(false);
  const dndContextId = useMemo(() => {
    const slug = String(effectivePersistKey ?? fileName ?? 'default')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    return `clutch-grid-${slug || 'default'}`;
  }, [effectivePersistKey, fileName]);
  const isLegacySkin = skin === 'legacy';
  const effectiveDensity = isLegacySkin ? 'legacy' : density;
  const dimensions = DENSITIES[effectiveDensity] ?? DENSITIES.standard;
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
  // Column order / hidden / width / pin and ambient sort/filter/pageSize are
  // persisted per-user in the DB via useUserGridPreference. localStorage
  // (via loadPersistedState) is retained for fast first paint and for state
  // we don't lift to the DB (scroll position, last interacted row, selection).
  const {
    initialColumnState: serverColumnState,
    initialGridState: serverGridState,
    loaded: serverPrefsLoaded,
    save: saveColumnStateToServer,
    saveGridState: saveGridStateToServer
  } = useUserGridPreference(effectivePersistKey);
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
  } = useColumnState(columns, null);
  const appliedServerColumnStateRef = useRef(false);
  useEffect(() => {
    if (appliedServerColumnStateRef.current) return;
    if (!serverPrefsLoaded) return;
    appliedServerColumnStateRef.current = true;
    if (serverColumnState) {
      applyColumnState(serverColumnState);
    }
  }, [serverPrefsLoaded, serverColumnState, applyColumnState]);
  useEffect(() => {
    if (!appliedServerColumnStateRef.current) return;
    saveColumnStateToServer(colStates);
  }, [colStates, saveColumnStateToServer]);
  const [internalGlobalSearch, setInternalGlobalSearch] = useState('');
  const isSearchControlled = searchValueProp !== undefined;
  const [sortModel, setSortModel] = useState([]);
  const [filters, setFilters] = useState({});
  const [page, setPage] = useState(0);
  const globalSearch = isSearchControlled ? (searchValueProp ?? '') : internalGlobalSearch;
  const updateGlobalSearch = useCallback((next, { resetPage = true } = {}) => {
    if (isSearchControlled) {
      onSearchChange?.(next);
    } else {
      setInternalGlobalSearch(next);
    }
    if (resetPage) setPage(0);
  }, [isSearchControlled, onSearchChange]);
  useEffect(() => {
    setSessionSearch(effectivePersistKey, globalSearch);
  }, [effectivePersistKey, globalSearch]);
  const [internalPageSize, setInternalPageSize] = useState(pageSize);
  const [lastInteractedRowId, setLastInteractedRowId] = useState(null);
  useLayoutEffect(() => {
    if (!effectivePersistKey) return;
    const persisted = loadPersistedState(effectivePersistKey);
    setLegacySnapshot(persisted);
    if (!persisted) return;
    const sessionSearch = getSessionSearch(effectivePersistKey);
    if (sessionSearch) updateGlobalSearch(sessionSearch, { resetPage: false });
    else if (persisted.globalSearch) updateGlobalSearch(persisted.globalSearch, { resetPage: false });
    if (Array.isArray(persisted.sortModel) && persisted.sortModel.length > 0) {
      setSortModel(persisted.sortModel);
    }
    if (persisted.filters && typeof persisted.filters === 'object' && Object.keys(persisted.filters).length > 0) {
      setFilters(persisted.filters);
    }
    if (typeof persisted.page === 'number' && persisted.page > 0) {
      setPage(persisted.page);
    }
    if (typeof persisted.pageSize === 'number' && persisted.pageSize > 0) {
      setInternalPageSize(persisted.pageSize);
    }
    if (Array.isArray(persisted.selectedRowIds)) {
      if (persisted.selectedRowIds.length > 0) {
        setPersistedInitialSelectedIds(persisted.selectedRowIds.map(String));
        if (persisted.lastInteractedRowId != null) {
          setLastInteractedRowId(persisted.lastInteractedRowId);
        }
      } else {
        // Explicit clear — do not re-select via lastInteractedRowId; reset scroll to top
        setPersistedInitialSelectedIds([]);
        setLastInteractedRowId(null);
        scrollTopRef.current = 0;
        pendingScrollRestoreRef.current = null;
        didRestoreScrollRef.current = true;
      }
    } else if (persisted.lastInteractedRowId != null) {
      setLastInteractedRowId(persisted.lastInteractedRowId);
      setPersistedInitialSelectedIds([String(persisted.lastInteractedRowId)]);
    }
    const skipScrollRestore = Array.isArray(persisted.selectedRowIds) && persisted.selectedRowIds.length === 0;
    if (!skipScrollRestore && typeof persisted.scrollTop === 'number' && persisted.scrollTop > 0) {
      scrollTopRef.current = persisted.scrollTop;
      pendingScrollRestoreRef.current = persisted.scrollTop;
    }
  }, [effectivePersistKey]);
  // Apply server-backed grid_state once the prefs load resolves. Server wins
  // over localStorage when present so a user logging in elsewhere sees the same
  // sort / filters / page size.
  const appliedServerGridStateRef = useRef(false);
  useEffect(() => {
    if (appliedServerGridStateRef.current) return;
    if (!serverPrefsLoaded) return;
    appliedServerGridStateRef.current = true;
    if (!serverGridState) return;
    if (Array.isArray(serverGridState.sortModel)) setSortModel(serverGridState.sortModel);
    if (serverGridState.filters && typeof serverGridState.filters === 'object') {
      setFilters(serverGridState.filters);
    }
    if (typeof serverGridState.pageSize === 'number' && serverGridState.pageSize > 0) {
      setInternalPageSize(serverGridState.pageSize);
    }
  }, [serverPrefsLoaded, serverGridState]);
  // Persist ambient sort/filter/pageSize to server (debounced inside the hook).
  useEffect(() => {
    if (!appliedServerGridStateRef.current) return;
    saveGridStateToServer({
      sortModel,
      filters,
      pageSize: internalPageSize,
    });
  }, [sortModel, filters, internalPageSize, saveGridStateToServer]);
  const effectivePageSizeOptions = useMemo(() => {
    const options = Array.isArray(pageSizeOptions) && pageSizeOptions.length > 0
      ? pageSizeOptions.filter(n => typeof n === 'number' && n > 0)
      : [10, 25, 50, 100];
    if (!options.includes(internalPageSize)) {
      return [...options, internalPageSize].sort((a, b) => a - b);
    }
    return options;
  }, [pageSizeOptions, internalPageSize]);
  const handlePageSizeChange = useCallback(event => {
    const nextSize = Number(event.target.value);
    if (!Number.isFinite(nextSize) || nextSize <= 0) return;
    setInternalPageSize(nextSize);
    setPage(0);
    onPageSizeChange?.(nextSize);
  }, [onPageSizeChange]);
  const [filterAnchor, setFilterAnchor] = useState(null);
  const [menuAnchor, setMenuAnchor] = useState(null);
  const [activeColumnKey, setActiveColumnKey] = useState(null);
  const [columnsMenuAnchor, setColumnsMenuAnchor] = useState(null);
  const [sortDialogOpen, setSortDialogOpen] = useState(false);
  const resizingRef = useRef(null);
  // Mirrors `columnWidthByKey` so handleResizeStart (declared earlier) can read
  // the latest displayed widths without a TDZ reference.
  const columnWidthByKeyRef = useRef(null);
  const pendingRangeDragRef = useRef(null);
  const rowClickTimerRef = useRef(null);
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
  const pageCount = enablePagination ? Math.max(1, Math.ceil(processed.length / Math.max(1, internalPageSize))) : 1;
  const safePage = clampPage(page, pageCount);
  useEffect(() => {
    if (safePage !== page) setPage(safePage);
  }, [safePage, page]);
  const pagedRows = useMemo(() => {
    if (!enablePagination) return processed;
    const start = safePage * internalPageSize;
    return processed.slice(start, start + internalPageSize);
  }, [processed, enablePagination, safePage, internalPageSize]);

  // Clear cell selection when the underlying data view changes
  useEffect(() => {
    setSelectedCells(new Set());
    setDrag(null);
    setAnchor(null);
    pendingRangeDragRef.current = null;
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

  // Defer plain cell mousedown into a range drag until the pointer moves past a threshold
  useEffect(() => {
    if (!enableRangeSelection) return;
    const onMove = (e) => {
      const pending = pendingRangeDragRef.current;
      if (!pending) return;
      const dx = e.clientX - pending.startX;
      const dy = e.clientY - pending.startY;
      if (Math.hypot(dx, dy) < RANGE_DRAG_THRESHOLD_PX) return;
      setDrag({
        start: pending.start,
        end: pending.start,
        mode: pending.mode,
      });
      pendingRangeDragRef.current = null;
    };
    const onUp = () => {
      pendingRangeDragRef.current = null;
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [enableRangeSelection]);

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
      pendingRangeDragRef.current = null;
      event.stopPropagation();
      return;
    }
    if (ctrl) {
      // Ctrl/Cmd-click: toggle single cell (Excel-style multi-select for sum)
      const k = cellKey(rowIdx, colIdx);
      setSelectedCells(prev => {
        const next = new Set(prev);
        if (next.has(k)) next.delete(k);else next.add(k);
        return next;
      });
      setAnchor(point);
      pendingRangeDragRef.current = null;
      event.stopPropagation();
      return;
    }

    // Plain mousedown: defer drag until pointer movement (avoids 1-cell flash on row click)
    setAnchor(point);
    pendingRangeDragRef.current = {
      start: point,
      startX: event.clientX,
      startY: event.clientY,
      mode: 'replace',
    };
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
    pendingRangeDragRef.current = null;
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
    onChange: onSelectionChange,
    initialSelectedIds: persistedInitialSelectedIds
  });
  const clearRowSelection = useCallback(() => {
    selection.clear();
    setLastInteractedRowId(null);
    scrollTopRef.current = 0;
    pendingScrollRestoreRef.current = null;
    const el = scrollRef.current;
    if (el) el.scrollTop = 0;
  }, [selection]);
  useEffect(() => {
    if (selection.count === 0) {
      setLastInteractedRowId(null);
    }
  }, [selection.count]);
  const handleRowActivate = useCallback((row, rowId, {
    fromCheckbox = false,
    forceSelect = false,
    metaKey = false,
  } = {}) => {
    setLastInteractedRowId(rowId);
    if (enableSelection) {
      const wasSelected = selection.isSelected(rowId);
      if (fromCheckbox) {
        selection.toggleRow(rowId);
      } else if (forceSelect) {
        if (!wasSelected) {
          selection.clear();
          selection.toggleRow(rowId);
        }
      } else if (metaKey) {
        selection.toggleRow(rowId);
      } else if (wasSelected) {
        selection.toggleRow(rowId);
      } else {
        selection.clear();
        selection.toggleRow(rowId);
      }
    }
    if (!fromCheckbox && !metaKey) {
      clearRange();
    }
    onRowClick?.(row);
  }, [enableSelection, selection.isSelected, selection.toggleRow, selection.clear, clearRange, onRowClick]);
  const didRestoreSelectionRef = useRef(false);
  useLayoutEffect(() => {
    if (!effectivePersistKey || didRestoreSelectionRef.current) return;
    if (loading || safeRows.length === 0) return;
    const targetId = persistedInitialSelectedIds.length > 0
      ? persistedInitialSelectedIds[persistedInitialSelectedIds.length - 1]
      : null;
    if (targetId == null) {
      didRestoreSelectionRef.current = true;
      return;
    }
    const row = safeRows.find(r => String(safeGetRowId(r)) === String(targetId));
    if (!row) {
      didRestoreSelectionRef.current = true;
      return;
    }
    const rowId = safeGetRowId(row);
    if (enableSelection && !selection.isSelected(rowId)) {
      selection.clear();
      selection.toggleRow(rowId);
    }
    if (lastInteractedRowId == null) {
      setLastInteractedRowId(rowId);
    }
    onPersistedRowActivate?.(row);
    didRestoreSelectionRef.current = true;
  }, [
    effectivePersistKey,
    loading,
    safeRows,
    persistedInitialSelectedIds,
    safeGetRowId,
    enableSelection,
    selection.isSelected,
    selection.toggleRow,
    selection.clear,
    onPersistedRowActivate
  ]);
  const handleRowDoubleClick = useCallback((row, rowId) => {
    handleRowActivate(row, rowId, { forceSelect: true });
    if (onRowDoubleClick) {
      onRowDoubleClick(row);
      return;
    }
    const href = getRowHref?.(row);
    if (href) window.location.assign(href);
  }, [handleRowActivate, onRowDoubleClick, getRowHref]);
  const scheduleRowClick = useCallback((row, rowId, event) => {
    if (rowClickTimerRef.current) clearTimeout(rowClickTimerRef.current);
    const metaKey = event.ctrlKey || event.metaKey;
    rowClickTimerRef.current = setTimeout(() => {
      rowClickTimerRef.current = null;
      handleRowActivate(row, rowId, { metaKey });
    }, ROW_CLICK_DELAY_MS);
  }, [handleRowActivate]);
  const handleRowDoubleClickEvent = useCallback((row, rowId, event) => {
    event.preventDefault();
    if (rowClickTimerRef.current) {
      clearTimeout(rowClickTimerRef.current);
      rowClickTimerRef.current = null;
    }
    handleRowDoubleClick(row, rowId);
  }, [handleRowDoubleClick]);
  useEffect(() => () => {
    if (rowClickTimerRef.current) clearTimeout(rowClickTimerRef.current);
  }, []);
  const handleRowContextMenu = useCallback((row, rowId, event) => {
    handleRowActivate(row, rowId, { forceSelect: true });
    const href = getRowHref?.(row);
    if (href) {
      event.preventDefault();
      window.open(href, '_blank', 'noopener,noreferrer');
      return;
    }
    onRowContextMenu?.(row, event);
  }, [handleRowActivate, getRowHref, onRowContextMenu]);
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
    // Start from the *displayed* width (which includes any fillContainerWidth
    // slack), so the resize handle tracks the cursor 1:1 even on the first
    // drag. setWidth marks the column as user-sized, which freezes it out of
    // future slack distribution.
    const startWidth = columnWidthByKeyRef.current?.get(key) ?? colState.width;
    resizingRef.current = {
      key,
      startX: event.clientX,
      startWidth
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
  const [scrollContainer, setScrollContainer] = useState(null);
  const attachScrollContainer = useCallback(node => {
    scrollRef.current = node;
    setScrollContainer(node);
  }, []);
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

    // Columns the user has explicitly resized are pinned to their stored width
    // — slack is distributed only across the remaining flex columns so the
    // resize handle tracks the cursor 1:1.
    const flexIdx = [];
    let fixedSum = 0;
    visibleColumns.forEach((c, i) => {
      if (c.state.userResized) fixedSum += bases[i];
      else flexIdx.push(i);
    });

    if (flexIdx.length === 0) {
      visibleColumns.forEach((c, i) => map.set(c.def.key, bases[i]));
      return map;
    }

    const availForCols = bodyClientWidth - selectionColumnWidth;
    const flexSum = flexIdx.reduce((a, i) => a + bases[i], 0);
    const extra = availForCols - fixedSum - flexSum;

    if (extra <= 0) {
      visibleColumns.forEach((c, i) => map.set(c.def.key, bases[i]));
      return map;
    }

    const addEach = Math.floor(extra / flexIdx.length);
    let remainder = extra - addEach * flexIdx.length;
    visibleColumns.forEach((c, i) => map.set(c.def.key, bases[i]));
    for (const i of flexIdx) {
      const bump = addEach + (remainder > 0 ? 1 : 0);
      if (remainder > 0) remainder -= 1;
      map.set(visibleColumns[i].def.key, bases[i] + bump);
    }
    return map;
  }, [visibleColumns, fillContainerWidth, bodyClientWidth, enableSelection, selectionColumnWidth]);
  columnWidthByKeyRef.current = columnWidthByKey;

  const virtualizer = useVirtualizer({
    count: pagedRows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => effectiveRowHeight,
    overscan: 8,
    initialOffset: 0
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
          if (r0) handleRowActivate(r0, safeGetRowId(r0));
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
  }, [pagedRows, visibleColumns, visibleRows, enableSelection, enableRangeSelection, selection, safeGetRowId, anchor, rectKeys, handleRowActivate, editingCell, isCellEditable, beginEdit]);

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
  useImperativeHandle(ref, () => ({
    openColumnsMenu: (anchorEl) => setColumnsMenuAnchor(anchorEl),
    closeColumnsMenu: () => setColumnsMenuAnchor(null),
    resetPage: () => setPage(0),
    exportCsv: () => handleCsvExport(),
  }), [handleCsvExport]);
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

  // columnState is included in the snapshot so saved views can round-trip the
  // column layout. The DB (via useUserGridPreference) — not localStorage — is
  // the source of truth for per-user column order/hidden/width; the load path
  // ignores `persisted.columnState` and waits for the server response instead.
  const buildPersistSnapshot = useCallback(() => ({
    version: PERSIST_VERSION,
    globalSearch,
    sortModel: sortModel,
    filters,
    page: safePage,
    pageSize: internalPageSize,
    lastInteractedRowId,
    selectedRowIds: Array.from(selection.selected),
    scrollTop: scrollTopRef.current,
    columnState: colStates
  }), [globalSearch, sortModel, filters, safePage, internalPageSize, lastInteractedRowId, selection.selected, colStates]);
  const buildPersistSnapshotRef = useRef(buildPersistSnapshot);
  buildPersistSnapshotRef.current = buildPersistSnapshot;

  // Persist grid state to localStorage (debounced; scroll uses scrollTopRef to avoid wiping on mount)
  useEffect(() => {
    if (!effectivePersistKey) return;
    const handle = window.setTimeout(() => {
      const snap = buildPersistSnapshotRef.current();
      if (!didRestoreScrollRef.current && pendingScrollRestoreRef.current != null && pendingScrollRestoreRef.current > 0) {
        snap.scrollTop = pendingScrollRestoreRef.current;
      }
      savePersistedState(effectivePersistKey, snap);
      // Auto-save the snapshot into the currently selected view, if any.
      if (viewsRef.current?.currentId) {
        viewsRef.current.saveCurrent(snap);
      }
    }, 150);
    return () => window.clearTimeout(handle);
  }, [effectivePersistKey, buildPersistSnapshot]);

  // Persist scroll position while scrolling
  useEffect(() => {
    if (!effectivePersistKey || !scrollContainer) return;
    let raf = null;
    const onScroll = () => {
      if (raf != null) return;
      raf = window.requestAnimationFrame(() => {
        raf = null;
        scrollTopRef.current = scrollContainer.scrollTop;
        if (!didRestoreScrollRef.current) return;
        savePersistedState(effectivePersistKey, {
          ...buildPersistSnapshotRef.current(),
          scrollTop: scrollContainer.scrollTop
        });
      });
    };
    scrollContainer.addEventListener('scroll', onScroll, {
      passive: true
    });
    return () => {
      scrollContainer.removeEventListener('scroll', onScroll);
      if (raf != null) window.cancelAnimationFrame(raf);
    };
  }, [effectivePersistKey, scrollContainer]);

  // Flush scroll position when navigating away
  useEffect(() => {
    if (!effectivePersistKey) return;
    return () => {
      const el = scrollRef.current;
      if (el) scrollTopRef.current = el.scrollTop;
      const snap = buildPersistSnapshotRef.current();
      snap.scrollTop = scrollTopRef.current;
      savePersistedState(effectivePersistKey, snap);
    };
  }, [effectivePersistKey]);

  // Restore scroll after rows are loaded (retries until virtualizer has measured)
  useEffect(() => {
    if (!effectivePersistKey || didRestoreScrollRef.current) return;
    const target = pendingScrollRestoreRef.current;
    if (target == null || target <= 0) {
      didRestoreScrollRef.current = true;
      return;
    }
    if (loading || pagedRows.length === 0) return;
    let attempts = 0;
    const maxAttempts = 60;
    let frameId = null;
    const tryRestore = () => {
      attempts += 1;
      const el = scrollRef.current;
      if (!el) {
        if (attempts < maxAttempts) frameId = requestAnimationFrame(tryRestore);
        return;
      }
      const maxScroll = Math.max(0, el.scrollHeight - el.clientHeight);
      const clampedTarget = Math.min(target, maxScroll);
      if (enableVirtualization) {
        try {
          virtualizer.scrollToOffset(clampedTarget, { align: 'start' });
        } catch {
          el.scrollTop = clampedTarget;
        }
      } else {
        el.scrollTop = clampedTarget;
      }
      const applied = el.scrollTop;
      scrollTopRef.current = applied;
      if (Math.abs(applied - clampedTarget) <= 2 || attempts >= maxAttempts) {
        didRestoreScrollRef.current = true;
        pendingScrollRestoreRef.current = null;
        savePersistedState(effectivePersistKey, {
          ...buildPersistSnapshotRef.current(),
          scrollTop: applied
        });
        return;
      }
      frameId = requestAnimationFrame(tryRestore);
    };
    frameId = requestAnimationFrame(tryRestore);
    return () => {
      if (frameId != null) window.cancelAnimationFrame(frameId);
    };
  }, [effectivePersistKey, loading, pagedRows.length, enableVirtualization, virtualizer]);

  // ---- Saved Views ----
  const showSavedViews = enableSavedViews && Boolean(effectivePersistKey);
  const buildSnapshot = buildPersistSnapshot;
  const views = useSavedViews(effectivePersistKey, legacySnapshot);
  const viewsRef = useRef(views);
  useEffect(() => { viewsRef.current = views; }, [views]);
  const applySnapshot = useCallback(snap => {
    updateGlobalSearch(snap.globalSearch ?? '', { resetPage: false });
    setSortModel(snap.sortModel ?? []);
    setFilters(snap.filters ?? {});
    setPage(typeof snap.page === 'number' ? snap.page : 0);
    setInternalPageSize(typeof snap.pageSize === 'number' && snap.pageSize > 0 ? snap.pageSize : pageSize);
    setLastInteractedRowId(snap.lastInteractedRowId ?? null);
    applyColumnState(snap.columnState ?? null);
    if (typeof snap.scrollTop === 'number') {
      scrollTopRef.current = snap.scrollTop;
      pendingScrollRestoreRef.current = snap.scrollTop > 0 ? snap.scrollTop : null;
      didRestoreScrollRef.current = false;
    }
    requestAnimationFrame(() => {
      if (scrollRef.current && typeof snap.scrollTop === 'number') {
        scrollRef.current.scrollTop = snap.scrollTop;
        if (enableVirtualization) {
          try {
            virtualizer.scrollToOffset(snap.scrollTop);
          } catch {
            // ignore
          }
        }
      }
    });
  }, [applyColumnState, enableVirtualization, virtualizer, pageSize, updateGlobalSearch]);
  return <ThemeProvider theme={muiTheme}>
      <CssBaseline />
      <Paper elevation={0} variant="outlined" className={className} sx={{
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      borderRadius: isLegacySkin ? 0 : 2,
      fontFamily: t => t.typography.fontFamily,
      bgcolor: 'background.paper',
      ...(isLegacySkin && {
        border: '1px solid #b8c9b8',
        borderRadius: 0,
      }),
    }}>
        <Box sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        p: isLegacySkin ? 0.75 : 1.25,
        borderBottom: '1px solid',
        borderColor: isLegacySkin ? '#d5e3d5' : 'divider',
        flexWrap: 'wrap',
        bgcolor: isLegacySkin ? '#f4f8f4' : undefined,
        ...(hideToolbar && { display: 'none' }),
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
            updateGlobalSearch(e.target.value);
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
              {globalSearch ? <IconButton size="small" onClick={() => updateGlobalSearch('')}>
                  <Clear fontSize="small" />
                </IconButton> : null}
            </Box>}

          {hasActiveFilters && <Chip size="small" label={`${Object.keys(filters).filter(k => filters[k]).length} filter(s)`} onDelete={() => setFilters({})} color="primary" variant="outlined" />}

          {enableMultiSort && <Tooltip title="Sort">
              <Button size="small" startIcon={<SortIcon fontSize="small" />} onClick={() => setSortDialogOpen(true)} sx={{ textTransform: 'none' }}>
                Sort{sortModel.length > 0 ? ` (${sortModel.length})` : ''}
              </Button>
            </Tooltip>}

          {enableMultiSort && <SortDialog open={sortDialogOpen} onClose={() => setSortDialogOpen(false)} columns={validCols.map(c => ({ key: c.key, header: c.header }))} sortModel={sortModel} onApply={next => { setSortModel(next); setPage(0); }} />}

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

        <Box ref={attachScrollContainer} sx={{
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
                <Box role="row" className={isLegacySkin ? 'dg-legacy-header-row' : undefined} sx={{
                display: 'flex',
                height: effectiveHeaderHeight,
                position: 'sticky',
                top: 0,
                zIndex: 4,
                bgcolor: isLegacySkin ? '#1f4d2e' : (theme) => alpha(theme.palette.primary.main, 0.06),
                borderBottom: '2px solid',
                borderColor: isLegacySkin ? 'rgba(255,255,255,0.14)' : (theme) => alpha(theme.palette.primary.main, 0.18),
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
                  bgcolor: isLegacySkin ? '#1f4d2e' : (theme) => alpha(theme.palette.primary.main, 0.06),
                  borderRight: '1px solid',
                  borderColor: isLegacySkin ? 'rgba(255,255,255,0.14)' : 'divider'
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
                  return <HeaderCell key={col.def.key} column={col.def} width={columnWidthByKey.get(col.def.key) ?? col.state.width} pin={col.state.pin} pinLeftOffset={(leftPinOffsets.get(col.def.key) ?? 0) + (enableSelection && col.state.pin === 'left' ? 42 : 0)} pinRightOffset={rightPinOffsets.get(col.def.key) ?? 0} sortIndex={sortIdx} sortDir={sortItem?.dir ?? null} hasFilter={hasFilter} showColumnMenu={enableColumnMenu} enableColumnFilters={enableColumnFilters} hideActionsUntilHover isLegacySkin={isLegacySkin} isDraggable={col.def.reorderable !== false} onSortClick={e => cycleSort(col.def.key, e.shiftKey)} onFilterClick={e => {
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
              const rowBackgroundColor = rowExtraStyle?.backgroundColor ?? rowExtraStyle?.background ?? null;
              const rowStyleWithoutBg = rowExtraStyle
                ? Object.fromEntries(Object.entries(rowExtraStyle).filter(([key]) => key !== 'backgroundColor' && key !== 'background'))
                : undefined;
              const stickyRowBg = theme => resolveStickyRowBackground(theme, { isSelected, rowBackgroundColor });
              return <Box key={rowId} role="row" className={rowClass} onClick={event => scheduleRowClick(row, rowId, event)} onDoubleClick={event => handleRowDoubleClickEvent(row, rowId, event)} onContextMenu={event => handleRowContextMenu(row, rowId, event)} style={rowStyleWithoutBg} sx={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                display: 'flex',
                height: effectiveRowHeight,
                transform: `translateY(${vi.start}px)`,
                bgcolor: stickyRowBg,
                borderBottom: '1px solid',
                borderColor: isLegacySkin ? '#d5e3d5' : 'divider',
                cursor: enableSelection || onRowClick || onRowDoubleClick || getRowHref ? 'pointer' : 'default',
                outline: 'none',
                ...(!isLegacySkin && {
                  '&:hover': {
                    bgcolor: theme => rowBackgroundColor ?? (isSelected ? theme.palette.action.selected : theme.palette.action.hover),
                    '& .dg-sticky-cell': {
                      bgcolor: theme => rowBackgroundColor ?? (isSelected ? theme.palette.action.selected : theme.palette.action.hover),
                    },
                  },
                }),
                '&:focus-visible': {
                  outline: '2px solid',
                  outlineColor: 'primary.main',
                  outlineOffset: '-2px'
                }
              }}>
                      {enableSelection && <Box className={['dg-sticky-cell', 'dg-selection-cell', rowClass].filter(Boolean).join(' ') || undefined} sx={{
                  width: 42,
                  minWidth: 42,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'sticky',
                  left: 0,
                  zIndex: 3,
                  bgcolor: stickyRowBg,
                  borderRight: '1px solid',
                  borderColor: 'divider'
                }} onClick={e => e.stopPropagation()}>
                          <Checkbox size="small" checked={isSelected} onChange={() => handleRowActivate(row, rowId, { fromCheckbox: true })} slotProps={{ input: { suppressHydrationWarning: true } }} />
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
                    stickyStyles.zIndex = 3;
                  } else if (pin === 'right') {
                    stickyStyles.position = 'sticky';
                    stickyStyles.right = rightPinOffsets.get(col.def.key) ?? 0;
                    stickyStyles.zIndex = 3;
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
                  const mergedCellClass = [gridCellClass, colCellClass, pin ? 'dg-sticky-cell' : null, pin ? rowClass : null].filter(Boolean).join(' ') || undefined;
                  const mergedCellStyle = gridCellStyle || colCellStyle ? {
                    ...gridCellStyle,
                    ...colCellStyle
                  } : undefined;
                  const isFocused = focusedCell?.r === vi.index && focusedCell?.c === colIdx;
                  return <Box key={col.def.key} role="gridcell" className={mergedCellClass} data-cell={`${vi.index}:${colIdx}`} tabIndex={isFocused ? 0 : -1} onMouseDown={e => handleCellMouseDown(vi.index, colIdx, e)} onClick={e => {
                    if (enableRangeSelection && (e.ctrlKey || e.metaKey || e.shiftKey)) {
                      e.stopPropagation();
                    }
                  }} onMouseEnter={() => handleCellMouseEnter(vi.index, colIdx)} onDoubleClick={e => {
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
                    px: isLegacySkin ? 0.75 : 1,
                    fontSize: isLegacySkin ? '11px' : '0.85rem',
                    borderRight: '1px solid',
                    borderColor: isLegacySkin ? '#d5e3d5' : 'divider',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    userSelect: isRangeDragging ? 'none' : 'auto',
                    outline: 'none',
                    ...(pin && { bgcolor: stickyRowBg }),
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
            px: 1,
            fontSize: '0.85rem',
            borderRight: '1px solid',
            borderColor: 'divider'
          }}>
                  {display}
                </Box>;
        })}
          </Box>}

        {rangeStats && rangeStats.cellCount >= 1 && <Box sx={{
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
                <Button size="small" onClick={clearRowSelection}>Clear</Button>
              </>}
          </Box>

          {enablePagination && <Box sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          flexWrap: 'wrap'
        }}>
              <Typography variant="caption" color="text.secondary">Rows per page</Typography>
              <FormControl size="small" sx={{ minWidth: 72 }}>
                <Select
                  value={internalPageSize}
                  onChange={handlePageSizeChange}
                  inputProps={{ suppressHydrationWarning: true }}
                  sx={{
                    fontSize: '0.8125rem',
                    '& .MuiSelect-select': { py: 0.5, px: 1 }
                  }}
                >
                  {effectivePageSizeOptions.map(size => (
                    <MenuItem key={size} value={size} dense>{size}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              {pageCount > 1 && <>
                  <Button size="small" disabled={safePage === 0} onClick={() => setPage(0)}>«</Button>
                  <Button size="small" disabled={safePage === 0} onClick={() => setPage(p => Math.max(0, p - 1))}>Prev</Button>
                  <Typography variant="caption">Page {safePage + 1} of {pageCount}</Typography>
                  <Button size="small" disabled={safePage >= pageCount - 1} onClick={() => setPage(p => Math.min(pageCount - 1, p + 1))}>Next</Button>
                  <Button size="small" disabled={safePage >= pageCount - 1} onClick={() => setPage(pageCount - 1)}>»</Button>
                </>}
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
});
export default Grid;
