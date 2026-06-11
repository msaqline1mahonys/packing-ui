"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Interval polling that is gentle about when it actually runs.
 *
 * Stopgap for live data until websockets (Pusher) land — swap the interval for a
 * subscription later and the consumer surface (`refresh`) stays the same.
 *
 * Behaviour:
 *  - polls every `intervalMs`
 *  - pauses while the browser tab is hidden (Page Visibility API)
 *  - refreshes immediately when the tab becomes visible again
 *  - skips a tick when `isBusy()` returns true (e.g. the user is mid-edit), so
 *    a background refresh never clobbers in-progress work
 *
 * @param {() => (void | Promise<void>)} callback
 * @param {{ intervalMs?: number, enabled?: boolean, isBusy?: () => boolean }} options
 * @returns {{ refresh: () => Promise<void>, isRefreshing: boolean, lastUpdatedAt: number | null }}
 */
export function usePolling(callback, { intervalMs = 60000, enabled = true, isBusy } = {}) {
  const savedCallback = useRef(callback);
  const savedIsBusy = useRef(isBusy);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null);

  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    savedIsBusy.current = isBusy;
  }, [isBusy]);

  const refresh = useCallback(async ({ force = false } = {}) => {
    if (!force && typeof savedIsBusy.current === "function" && savedIsBusy.current()) {
      return;
    }
    try {
      setIsRefreshing(true);
      await savedCallback.current?.();
      setLastUpdatedAt(Date.now());
    } catch (error) {
      // Polling errors are non-fatal — keep the last good data on screen.
      console.warn("usePolling: refresh failed", error);
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return undefined;

    const tick = () => {
      if (typeof document !== "undefined" && document.hidden) return;
      refresh();
    };

    const id = setInterval(tick, intervalMs);

    const onVisibility = () => {
      if (typeof document !== "undefined" && !document.hidden) {
        refresh();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [enabled, intervalMs, refresh]);

  return { refresh, isRefreshing, lastUpdatedAt };
}
