"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, X } from "lucide-react";
import { useVirtualizer } from "@tanstack/react-virtual";

import { cn } from "@/lib/utils";

const ROW_HEIGHT = 32;

/**
 * Generic, controlled multi-select combo-box.
 *
 * Collapses to a trigger that shows the current selection as capped chips
 * (up to `maxChips`, then "+N more"), and opens a searchable, virtualized
 * popover with checkbox rows plus Select all / Clear.
 *
 * The popover is portalled to <body> with fixed positioning so it is never
 * clipped by an ancestor's `overflow-hidden` (e.g. the Subscriptions modal).
 *
 * @param {object} props
 * @param {Array} props.options          full option list
 * @param {Array<number|string>} props.value  selected ids
 * @param {(ids:Array)=>void} props.onChange
 * @param {(o:any)=>number|string} [props.getId]
 * @param {(o:any)=>string} [props.getLabel]
 * @param {(o:any)=>string} [props.getMeta]  secondary right-aligned text (e.g. code)
 * @param {string} [props.placeholder]     shown when nothing selected and !emptyMeansAll
 * @param {string} [props.searchPlaceholder]
 * @param {boolean} [props.emptyMeansAll]   when true, empty selection renders `allLabel`
 * @param {string} [props.allLabel]
 * @param {number} [props.maxChips]
 * @param {boolean} [props.disabled]
 */
export function MultiSelectCombobox({
  options = [],
  value = [],
  onChange,
  getId = (o) => o.id,
  getLabel = (o) => o.label,
  getMeta = () => "",
  placeholder = "Select...",
  searchPlaceholder = "Search...",
  emptyMeansAll = false,
  allLabel = "All",
  maxChips = 3,
  disabled = false,
}) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const [mounted, setMounted] = useState(false);
  const [coords, setCoords] = useState({ left: 0, top: 0, width: 0 });

  const triggerRef = useRef(null);
  const popoverRef = useRef(null);
  const searchRef = useRef(null);
  const scrollRef = useRef(null);

  useEffect(() => setMounted(true), []);

  const selectedSet = useMemo(() => new Set(value.map((v) => String(v))), [value]);

  const selectedOptions = useMemo(
    () => options.filter((o) => selectedSet.has(String(getId(o)))),
    [options, selectedSet, getId]
  );

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => `${getLabel(o)} ${getMeta(o) || ""}`.toLowerCase().includes(q));
  }, [options, filter, getLabel, getMeta]);

  const allSelected = options.length > 0 && selectedSet.size === options.length;

  /* ---- positioning ---- */
  const reposition = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setCoords({ left: r.left, top: r.bottom + 4, width: r.width });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    reposition();
    const onScroll = () => reposition();
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", reposition);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", reposition);
    };
  }, [open, reposition]);

  /* ---- outside click + escape ---- */
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e) {
      if (triggerRef.current?.contains(e.target)) return;
      if (popoverRef.current?.contains(e.target)) return;
      setOpen(false);
    }
    function onKeyDown(e) {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (open) {
      const t = setTimeout(() => searchRef.current?.focus(), 0);
      return () => clearTimeout(t);
    }
    setFilter("");
  }, [open]);

  /* ---- virtualization ---- */
  const virtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 8,
  });

  function toggle(id) {
    const key = String(id);
    const next = new Set(selectedSet);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    onChange(options.filter((o) => next.has(String(getId(o)))).map((o) => getId(o)));
  }

  function selectAll() {
    onChange(options.map((o) => getId(o)));
  }

  function clearAll() {
    onChange([]);
  }

  function removeChip(e, id) {
    e.stopPropagation();
    const key = String(id);
    onChange(value.filter((v) => String(v) !== key));
  }

  const shownChips = selectedOptions.slice(0, maxChips);
  const extraCount = selectedOptions.length - shownChips.length;

  return (
    <div className="w-full">
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn(
          "flex min-h-7 w-full items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2 py-1 text-left text-[11px] outline-none transition-colors",
          "focus:border-brand/35 focus:ring-2 focus:ring-brand/15",
          open ? "border-brand/35 ring-2 ring-brand/15" : "hover:border-slate-300",
          disabled && "cursor-not-allowed opacity-60"
        )}
      >
        <span className="flex flex-1 flex-wrap items-center gap-1">
          {selectedOptions.length === 0 ? (
            emptyMeansAll ? (
              <span className="text-slate-500">{allLabel}</span>
            ) : (
              <span className="text-slate-400">{placeholder}</span>
            )
          ) : (
            <>
              {shownChips.map((o) => (
                <span
                  key={String(getId(o))}
                  className="inline-flex items-center gap-1 rounded bg-brand/10 px-1.5 py-0.5 text-[10px] text-brand-ink"
                >
                  <span className="max-w-[140px] truncate">{getLabel(o)}</span>
                  <span
                    role="button"
                    tabIndex={-1}
                    aria-label={`Remove ${getLabel(o)}`}
                    onClick={(e) => removeChip(e, getId(o))}
                    className="rounded-full p-0.5 text-brand-ink/60 hover:bg-brand/20 hover:text-brand-ink"
                  >
                    <X className="h-2.5 w-2.5" />
                  </span>
                </span>
              ))}
              {extraCount > 0 ? (
                <span className="inline-flex items-center rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600">
                  +{extraCount} more
                </span>
              ) : null}
            </>
          )}
        </span>
        <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform", open && "rotate-180")} />
      </button>

      {mounted && open
        ? createPortal(
            <div
              ref={popoverRef}
              role="listbox"
              aria-multiselectable="true"
              style={{ position: "fixed", left: coords.left, top: coords.top, width: coords.width, zIndex: 60 }}
              className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl"
            >
              <div className="flex items-center gap-2 border-b border-slate-100 p-2">
                <input
                  ref={searchRef}
                  type="text"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  placeholder={searchPlaceholder}
                  className="h-7 flex-1 rounded-md border border-slate-200 bg-white px-2 text-[11px] text-slate-800 outline-none focus:border-brand/35 focus:ring-2 focus:ring-brand/15"
                />
                <button
                  type="button"
                  onClick={allSelected ? clearAll : selectAll}
                  className="shrink-0 text-[11px] font-medium text-brand hover:text-brand/80"
                >
                  {allSelected ? "Clear all" : "Select all"}
                </button>
              </div>

              <div ref={scrollRef} className="max-h-60 overflow-y-auto p-1">
                {filtered.length === 0 ? (
                  <p className="px-2 py-3 text-center text-[11px] italic text-slate-400">No matches.</p>
                ) : (
                  <div style={{ height: virtualizer.getTotalSize(), position: "relative", width: "100%" }}>
                    {virtualizer.getVirtualItems().map((vi) => {
                      const o = filtered[vi.index];
                      const id = getId(o);
                      const selected = selectedSet.has(String(id));
                      const meta = getMeta(o);
                      return (
                        <button
                          key={String(id)}
                          type="button"
                          role="option"
                          aria-selected={selected}
                          onClick={() => toggle(id)}
                          style={{
                            position: "absolute",
                            top: 0,
                            left: 0,
                            width: "100%",
                            height: ROW_HEIGHT,
                            transform: `translateY(${vi.start}px)`,
                          }}
                          className={cn(
                            "flex items-center gap-2 rounded-md px-2 text-left text-[11px] transition-colors",
                            selected ? "bg-brand/10 text-brand-ink" : "text-slate-700 hover:bg-slate-50"
                          )}
                        >
                          <span
                            className={cn(
                              "flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border",
                              selected ? "border-brand bg-brand text-white" : "border-slate-300 bg-white"
                            )}
                          >
                            {selected ? <Check className="h-2.5 w-2.5" strokeWidth={3} /> : null}
                          </span>
                          <span className="flex-1 truncate">{getLabel(o)}</span>
                          {meta ? <span className="shrink-0 text-[10px] text-slate-400">{meta}</span> : null}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="border-t border-slate-100 px-2 py-1.5 text-[10px] text-slate-500">
                {selectedSet.size === 0
                  ? emptyMeansAll
                    ? allLabel
                    : "None selected"
                  : allSelected
                  ? `All ${options.length} selected`
                  : `${selectedSet.size} of ${options.length} selected`}
              </div>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
