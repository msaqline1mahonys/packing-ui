import { notFound } from "next/navigation";

import InTicketForm from "../in-ticket-form";

export default async function EditInTicketPage({ params }) {
  const { id } = await params;
  const ticketId = Number(id);
  if (!Number.isFinite(ticketId) || ticketId <= 0) notFound();
  return <InTicketForm mode="edit" ticketId={ticketId} />;
}
