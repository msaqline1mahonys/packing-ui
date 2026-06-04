import { Suspense } from "react";
import { notFound } from "next/navigation";

import InTicketPrintClient from "./in-ticket-print-client";

export const metadata = {
  title: "Print In-Ticket | Packing ERP",
};

export default async function InTicketPrintPage({ params }) {
  const { id } = await params;
  if (!id) notFound();

  return (
    <Suspense fallback={<div className="px-6 py-12 text-center text-sm text-slate-500">Loading print preview…</div>}>
      <InTicketPrintClient ticketId={id} />
    </Suspense>
  );
}
