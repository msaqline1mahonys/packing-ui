"use client";

import { useEffect, useState } from "react";

import { checkJobReferenceDuplicate } from "@/lib/api/packing";
import { resolveEntityId } from "@/lib/hooks/use-container-duplicate-check";

function normalizeJobReference(value) {
  return String(value ?? "").trim();
}

function isUnchangedJobReference(jobReference, baselineJobReference, packId) {
  if (!resolveEntityId(packId)) return false;

  const normalized = normalizeJobReference(jobReference).toUpperCase();
  const baseline = normalizeJobReference(baselineJobReference).toUpperCase();

  return Boolean(normalized && baseline && normalized === baseline);
}

export function filterJobReferenceDuplicateMatches(matches, { packId } = {}) {
  const excludePackId = resolveEntityId(packId);

  return (matches ?? []).filter((match) => {
    const matchPackId = String(match.packId ?? "");
    if (excludePackId && matchPackId && matchPackId === excludePackId) {
      return false;
    }
    return true;
  });
}

/**
 * Debounced lookup for packs that already use the same job reference.
 * Returns a warning flag only — duplicates do not block save.
 */
export function useJobReferenceDuplicateCheck(
  jobReference,
  { packId, baselineJobReference, enabled = true } = {}
) {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(false);
  const resolvedPackId = resolveEntityId(packId);

  useEffect(() => {
    const normalized = normalizeJobReference(jobReference);
    if (
      !enabled ||
      !normalized ||
      isUnchangedJobReference(jobReference, baselineJobReference, resolvedPackId)
    ) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset when lookup is skipped
      setMatches([]);
      setLoading(false);
      return undefined;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const result = await checkJobReferenceDuplicate({
          jobReference: normalized,
          excludePackId: resolvedPackId,
        });
        if (!cancelled) {
          setMatches(
            filterJobReferenceDuplicateMatches(result?.matches, {
              packId: resolvedPackId,
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
  }, [jobReference, resolvedPackId, baselineJobReference, enabled]);

  return {
    matches,
    loading,
    isDuplicate: matches.length > 0,
  };
}
