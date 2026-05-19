"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

import InTicketPrintDocument from "@/components/ticketing/in-ticket-print-document";
import { resolveInTicketForPrint } from "@/lib/in-ticket-print";
import { demoExistingTicket } from "@/lib/demo-in-ticket-data";
import { loadInTicketSnapshot } from "@/lib/ticketing-in-ticket-storage";

export default function InTicketPrintClient({ ticketId }) {
  const searchParams = useSearchParams();
  const autoPrint = searchParams.get("print") === "1";
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  const model = useMemo(() => {
    if (!hydrated) {
      const seeded = demoExistingTicket(ticketId);
      return seeded ? resolveInTicketForPrint(ticketId, seeded) : null;
    }
    const snapshot = loadInTicketSnapshot(ticketId);
    const ticket = snapshot || demoExistingTicket(ticketId);
    if (!ticket) return null;
    return resolveInTicketForPrint(ticketId, ticket);
  }, [hydrated, ticketId]);

  useEffect(() => {
    if (!autoPrint || !model) return;
    const timer = window.setTimeout(() => window.print(), 400);
    return () => window.clearTimeout(timer);
  }, [autoPrint, model]);

  return <InTicketPrintDocument model={model} backHref={`/ticketing/in/${ticketId}`} />;
}
