"use client";

import TicketListPage from "../ticket-list-page";

export default function OutgoingTicketPage() {
  return (
    <TicketListPage
      ticketType="out"
      title="Outgoing Tickets"
      subtitle="Review and manage outgoing dispatch tickets."
      breadcrumb="Operations / Outgoing"
      createPath="/ticketing/outgoing/new"
      editPathBase="/ticketing/outgoing"
      persistKey="ticket-queue-outgoing"
      queueLabel="Outgoing queue"
      dateFilterName="date-filter-outgoing"
    />
  );
}
