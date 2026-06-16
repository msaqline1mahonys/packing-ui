"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

import InTicketPrintDocument from "@/components/ticketing/in-ticket-print-document";
import { enrichPrintSnapshot, mergeLiveSitePrint, resolveInTicketForPrint } from "@/lib/in-ticket-print";
import { demoExistingTicket } from "@/lib/demo-in-ticket-data";
import { loadInTicketSnapshot } from "@/lib/ticketing-in-ticket-storage";

export default function InTicketPrintClient({ ticketId }) {
  const searchParams = useSearchParams();
  const autoPrint = searchParams.get("print") === "1";
  const [hydrated, setHydrated] = useState(false);
  const [model, setModel] = useState(null);

  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) {
      const seeded = demoExistingTicket(ticketId);
      setModel(seeded ? resolveInTicketForPrint(ticketId, seeded) : null);
      return;
    }

    let cancelled = false;
    async function load() {
      const snapshot = mergeLiveSitePrint(loadInTicketSnapshot(ticketId, "in") || demoExistingTicket(ticketId));
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

  return <InTicketPrintDocument model={model} backHref={`/ticketing/in/${ticketId}`} />;
}
