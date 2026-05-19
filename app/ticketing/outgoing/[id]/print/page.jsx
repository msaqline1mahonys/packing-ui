import { Suspense } from "react";
import { notFound } from "next/navigation";

import OutTicketPrintClient from "./out-ticket-print-client";

export const metadata = {
  title: "Print Out-Ticket | Packing ERP",
};

export default async function OutTicketPrintPage({ params }) {
  const { id } = await params;
  const ticketId = Number(id);
  if (!Number.isFinite(ticketId) || ticketId <= 0) notFound();

  return (
    <Suspense fallback={<div className="px-6 py-12 text-center text-sm text-slate-500">Loading print preview…</div>}>
      <OutTicketPrintClient ticketId={ticketId} />
    </Suspense>
  );
}
