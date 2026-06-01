"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

import InTicketPrintDocument from "@/components/ticketing/in-ticket-print-document";
import { resolveInTicketForPrint } from "@/lib/in-ticket-print";
import { loadInTicketSnapshot } from "@/lib/ticketing-in-ticket-storage";

export default function OutTicketPrintClient({ ticketId }) {
  const searchParams = useSearchParams();
  const autoPrint = searchParams.get("print") === "1";
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  const model = useMemo(() => {
    if (!hydrated) return null;
    const snapshot = loadInTicketSnapshot(ticketId, "out");
    if (!snapshot) return null;
    return resolveInTicketForPrint(ticketId, snapshot);
  }, [hydrated, ticketId]);

  useEffect(() => {
    if (!autoPrint || !model) return;
    const timer = window.setTimeout(() => window.print(), 400);
    return () => window.clearTimeout(timer);
  }, [autoPrint, model]);

  return <InTicketPrintDocument model={model} backHref={`/ticketing/outgoing/${ticketId}`} />;
}
