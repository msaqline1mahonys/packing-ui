"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { hasComparableWeights } from "@/lib/ticket-duplicate-check";
import { lookupTruckWeightDuplicateTickets } from "@/lib/ticketing-api";

function hasDuplicateLookupInputs(ticket, ticketType) {
  const truckId = ticket?.truckId || ticket?.truck?.id;
  const date = String(ticket?.date ?? "").trim();
  return Boolean(truckId && date && ticketType && hasComparableWeights(ticket));
}

/**
 * Warns when another ticket on the same day uses the same truck with identical gross/tare totals.
 * Non-blocking — duplicates do not prevent save or completion.
 */
export function useTicketDuplicateCheck(ticket, { ticketType = "in", excludeId, enabled = true } = {}) {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(false);

  const lookupKey = useMemo(() => {
    const truckId = ticket?.truckId || ticket?.truck?.id || "";
    const date = String(ticket?.date ?? "").slice(0, 10);
    return `${ticketType}|${truckId}|${date}`;
  }, [ticket?.truckId, ticket?.truck?.id, ticket?.date, ticketType]);

  const comparisonKey = useMemo(
    () =>
      JSON.stringify({
        grossWeights: ticket?.grossWeights,
        tareWeights: ticket?.tareWeights,
      }),
    [ticket?.grossWeights, ticket?.tareWeights]
  );

  const refresh = useCallback(async () => {
    if (!enabled || !hasDuplicateLookupInputs(ticket, ticketType)) {
      setMatches([]);
      return [];
    }

    setLoading(true);
    try {
      const found = await lookupTruckWeightDuplicateTickets(ticket, { ticketType, excludeId });
      setMatches(found);
      return found;
    } catch {
      setMatches([]);
      return [];
    } finally {
      setLoading(false);
    }
  }, [enabled, ticket, ticketType, excludeId]);

  useEffect(() => {
    if (!enabled || !hasDuplicateLookupInputs(ticket, ticketType)) {
      setMatches([]);
      setLoading(false);
      return undefined;
    }

    let cancelled = false;
    const timer = setTimeout(() => {
      void (async () => {
        setLoading(true);
        try {
          const found = await lookupTruckWeightDuplicateTickets(ticket, { ticketType, excludeId });
          if (!cancelled) setMatches(found);
        } catch {
          if (!cancelled) setMatches([]);
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [enabled, lookupKey, comparisonKey, ticket, ticketType, excludeId]);

  return {
    matches,
    loading,
    isDuplicate: matches.length > 0,
    refresh,
  };
}
