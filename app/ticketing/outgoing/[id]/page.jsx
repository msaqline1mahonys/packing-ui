import { notFound } from "next/navigation";
import OutTicketForm from "../out-ticket-form";

export default async function EditOutgoingTicketPage({ params }) {
  const { id } = await params;
  if (!id) notFound();
  return <OutTicketForm mode="edit" ticketId={id} />;
}
