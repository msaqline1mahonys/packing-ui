import { notFound } from "next/navigation";
import OutTicketForm from "../out-ticket-form";

export default async function EditOutgoingTicketPage({ params }) {
  const { id } = await params;
  const ticketId = Number(id);
  if (!Number.isFinite(ticketId) || ticketId <= 0) notFound();
  return <OutTicketForm mode="edit" ticketId={ticketId} />;
}
