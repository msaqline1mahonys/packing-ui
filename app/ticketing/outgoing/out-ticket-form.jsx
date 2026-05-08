import InTicketFormClient from "../in/in-ticket-form-client";

export default function OutTicketForm(props) {
  return <InTicketFormClient {...props} direction="outgoing" />;
}
