"use client";

import { useEffect, useState } from "react";

import { checkContainerDuplicate } from "@/lib/api/packing";
import { normalizeContainerNumber, validateContainerNumber } from "@/lib/container-number-validation";
import { isUuid } from "@/lib/pack-schedule-api";

export function resolveEntityId(...candidates) {
  for (const value of candidates) {
    if (isUuid(value)) return String(value);
  }
  return undefined;
}

export function filterDuplicateMatches(matches, { packId, containerId } = {}) {
  const excludePackId = resolveEntityId(packId);
  const excludeContainerId = resolveEntityId(containerId);

  return (matches ?? []).filter((match) => {
    const matchContainerId = String(match.containerId ?? "");
    const matchPackId = String(match.packId ?? "");

    if (excludeContainerId && matchContainerId && matchContainerId === excludeContainerId) {
      return false;
    }
    if (excludePackId && matchPackId && matchPackId === excludePackId) {
      return false;
    }
    return true;
  });
}

function isUnchangedContainerNumber(containerNumber, baselineContainerNumber, containerId) {
  if (!resolveEntityId(containerId)) return false;

  const normalized = normalizeContainerNumber(containerNumber);
  const baseline = normalizeContainerNumber(baselineContainerNumber);

  return Boolean(normalized && baseline && normalized === baseline);
}

/**
 * Debounced lookup for container numbers already used on another pack within the last N months.
 * Returns a warning flag only — duplicates do not block save.
 */
export function useContainerDuplicateCheck(
  containerNumber,
  { packId, containerId, baselineContainerNumber, months = 3, enabled = true } = {}
) {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(false);
  const resolvedPackId = resolveEntityId(packId);
  const resolvedContainerId = resolveEntityId(containerId);

  useEffect(() => {
    const normalized = normalizeContainerNumber(containerNumber);
    if (
      !enabled ||
      !normalized ||
      validateContainerNumber(containerNumber) ||
      isUnchangedContainerNumber(containerNumber, baselineContainerNumber, resolvedContainerId)
    ) {
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
  }, [
    containerNumber,
    resolvedPackId,
    resolvedContainerId,
    baselineContainerNumber,
    months,
    enabled,
  ]);

  return {
    matches,
    loading,
    isDuplicate: matches.length > 0,
  };
}
