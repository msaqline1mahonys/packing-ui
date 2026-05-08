import InTicketFormClient from "./in-ticket-form-client";

export default function InTicketForm(props) {
  return <InTicketFormClient {...props} direction="incoming" />;
}
