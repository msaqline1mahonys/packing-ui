"use client";

import { useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";

/**
 * When navigated with ?add=1, opens the page's add/create modal once on mount.
 * Used by quick-add links from the packing schedule form (new tab).
 */
export function useAutoOpenAddModal(openAddModal, enabled = true) {
  const searchParams = useSearchParams();
  const openedRef = useRef(false);

  useEffect(() => {
    if (!enabled || openedRef.current || typeof openAddModal !== "function") return;
    if (searchParams.get("add") !== "1") return;
    openedRef.current = true;
    openAddModal();
  }, [searchParams, openAddModal, enabled]);
}
