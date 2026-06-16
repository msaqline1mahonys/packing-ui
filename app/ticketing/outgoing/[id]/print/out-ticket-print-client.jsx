"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

import InTicketPrintDocument from "@/components/ticketing/in-ticket-print-document";
import { enrichPrintSnapshot, mergeLiveSitePrint, resolveInTicketForPrint } from "@/lib/in-ticket-print";
import { loadInTicketSnapshot } from "@/lib/ticketing-in-ticket-storage";

export default function OutTicketPrintClient({ ticketId }) {
  const searchParams = useSearchParams();
  const autoPrint = searchParams.get("print") === "1";
  const [hydrated, setHydrated] = useState(false);
  const [model, setModel] = useState(null);

  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;

    let cancelled = false;
    async function load() {
      const snapshot = mergeLiveSitePrint(loadInTicketSnapshot(ticketId, "out"));
      if (!snapshot) {
        if (!cancelled) setModel(null);
        return;
      }
      const enriched = await enrichPrintSnapshot(snapshot);
      if (!cancelled) setModel(resolveInTicketForPrint(ticketId, enriched));
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [hydrated, ticketId]);

  useEffect(() => {
    if (!autoPrint || !model) return;
    const timer = window.setTimeout(() => window.print(), 400);
    return () => window.clearTimeout(timer);
  }, [autoPrint, model]);

  return <InTicketPrintDocument model={model} backHref={`/ticketing/outgoing/${ticketId}`} />;
}
