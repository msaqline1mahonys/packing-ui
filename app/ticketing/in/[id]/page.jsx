import { notFound } from "next/navigation";

import InTicketForm from "../in-ticket-form";

export default async function EditInTicketPage({ params }) {
  const { id } = await params;
  if (!id) notFound();
  return <InTicketForm mode="edit" ticketId={id} />;
}
