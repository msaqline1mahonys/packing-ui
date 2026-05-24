/** Shared clutch-table column config for transaction ledger grids. */
export const TRANSACTION_GRID_COLUMNS = [
  { key: "reference", header: "Reference", type: "text", sortable: true, filterable: true, resizable: true },
  { key: "date", header: "Date", type: "text", sortable: true, filterable: true, resizable: true },
  { key: "ticketDisplay", header: "Ticket", type: "text", sortable: true, filterable: true, resizable: true },
  { key: "account", header: "Account", type: "text", sortable: true, filterable: true, resizable: true },
  { key: "commodity", header: "Commodity", type: "text", sortable: true, filterable: true, resizable: true },
  { key: "location", header: "Location", type: "text", sortable: true, filterable: true, resizable: true },
  { key: "ticketTypeDisplay", header: "Ticket Type", type: "text", sortable: true, filterable: true, resizable: true },
  { key: "transactionTypeDisplay", header: "Trans Type", type: "text", sortable: true, filterable: true, resizable: true },
  { key: "quantityDisplay", header: "Quantity (MT)", type: "text", sortable: true, filterable: true, resizable: true },
  { key: "status", header: "Status", type: "text", sortable: true, filterable: true, resizable: true },
];

export const TRANSACTION_DETAIL_COLUMNS = [
  { key: "reference", label: "Reference" },
  { key: "date", label: "Date" },
  { key: "ticketDisplay", label: "Ticket" },
  { key: "account", label: "Account" },
  { key: "commodity", label: "Commodity" },
  { key: "location", label: "Location" },
  { key: "ticketTypeDisplay", label: "Ticket Type" },
  { key: "transactionTypeDisplay", label: "Transaction Type" },
  { key: "quantityDisplay", label: "Quantity (MT)" },
  { key: "status", label: "Status" },
  { key: "notes", label: "Notes" },
];
