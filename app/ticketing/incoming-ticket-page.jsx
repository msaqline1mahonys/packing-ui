"use client";

import TicketListPage from "./ticket-list-page";

export default function IncomingTicketPage() {
  return (
    <TicketListPage
      ticketType="in"
      title="Incoming Tickets"
      subtitle="Review and manage incoming weighbridge tickets."
      breadcrumb="Operations / Incoming"
      createPath="/ticketing/in/new"
      editPathBase="/ticketing/in"
      persistKey="ticket-queue-incoming"
      queueLabel="Incoming queue"
      dateFilterName="date-filter-incoming"
    />
  );
}
