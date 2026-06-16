"use client";

import { useEffect, useState } from "react";

import { checkContainerDuplicate } from "@/lib/api/packing";
import { normalizeContainerNumber, validateContainerNumber } from "@/lib/container-number-validation";

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value ?? "")
  );
}

/**
 * Debounced lookup for container numbers already used on another pack within the last N months.
 * Returns a warning flag only — duplicates do not block save.
 */
export function useContainerDuplicateCheck(
  containerNumber,
  { packId, containerId, months = 3, enabled = true } = {}
) {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const normalized = normalizeContainerNumber(containerNumber);
    if (!enabled || !normalized || validateContainerNumber(containerNumber)) {
      setMatches([]);
      setLoading(false);
      return undefined;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const result = await checkContainerDuplicate({
          containerNumber: normalized,
          excludePackId: isUuid(packId) ? packId : undefined,
          excludeContainerId: isUuid(containerId) ? containerId : undefined,
          months,
        });
        if (!cancelled) setMatches(result?.matches ?? []);
      } catch {
        if (!cancelled) setMatches([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 450);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [containerNumber, packId, containerId, months, enabled]);

  return {
    matches,
    loading,
    isDuplicate: matches.length > 0,
  };
}
