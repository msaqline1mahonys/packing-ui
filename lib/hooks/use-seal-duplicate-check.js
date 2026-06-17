"use client";

import { useEffect, useState } from "react";

import { checkSealDuplicate } from "@/lib/api/packing";
import { normalizeSealNumber, validateSealNumber } from "@/lib/container-number-validation";
import {
  filterDuplicateMatches,
  resolveEntityId,
} from "@/lib/hooks/use-container-duplicate-check";

function isUnchangedSealNumber(sealNumber, baselineSealNumber, containerId) {
  if (!resolveEntityId(containerId)) return false;

  const normalized = normalizeSealNumber(sealNumber);
  const baseline = normalizeSealNumber(baselineSealNumber);

  return Boolean(normalized && baseline && normalized === baseline);
}

/**
 * Debounced lookup for seal numbers already used on another pack within the last N months.
 * Returns a warning flag only — duplicates do not block save.
 */
export function useSealDuplicateCheck(
  sealNumber,
  { packId, containerId, baselineSealNumber, months = 3, enabled = true } = {}
) {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(false);
  const resolvedPackId = resolveEntityId(packId);
  const resolvedContainerId = resolveEntityId(containerId);

  useEffect(() => {
    const normalized = normalizeSealNumber(sealNumber);
    if (
      !enabled ||
      !normalized ||
      validateSealNumber(sealNumber) ||
      isUnchangedSealNumber(sealNumber, baselineSealNumber, resolvedContainerId)
    ) {
      setMatches([]);
      setLoading(false);
      return undefined;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const result = await checkSealDuplicate({
          sealNumber: normalized,
          excludePackId: resolvedPackId,
          excludeContainerId: resolvedContainerId,
          months,
        });
        if (!cancelled) {
          setMatches(
            filterDuplicateMatches(result?.matches, {
              packId: resolvedPackId,
              containerId: resolvedContainerId,
            })
          );
        }
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
  }, [sealNumber, resolvedPackId, resolvedContainerId, baselineSealNumber, months, enabled]);

  return {
    matches,
    loading,
    isDuplicate: matches.length > 0,
  };
}
