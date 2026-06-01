/** Demo fixtures for the In-Ticket form until AppContext / APIs exist. */

export const DEMO_SITE = 1;

export const DEMO_CUSTOMERS = [
  { id: 1, name: "GrainCorp Trading", code: "GCT" },
  { id: 2, name: "Riverina Co-op", code: "RIV" },
];

export const DEMO_INTERNAL_ACCOUNTS = [{ id: 101, name: "Internal — Screenings" }];

export const DEMO_COMMODITY_TYPES = [
  { id: 1, name: "Grain" },
  { id: 2, name: "Oilseeds" },
];

export const DEMO_COMMODITIES = [
  {
    id: 10,
    commodityTypeId: 1,
    commodityCode: "BARLEY-F1",
    description: "Feed barley F1",
    status: "active",
    unitType: "MT",
    testThresholds: [
      { testName: "Moisture", testId: 1, min: 8, max: 14 },
      { testName: "Protein", testId: 2, min: 9, max: 12 },
    ],
  },
  {
    id: 11,
    commodityTypeId: 1,
    commodityCode: "WHEAT-APW",
    description: "Wheat APW1",
    status: "active",
    unitType: "MT",
    testThresholds: [
      { testName: "Moisture", testId: 1, min: 9, max: 13 },
      { testName: "Protein", testId: 2, min: 10, max: 13 },
    ],
  },
  {
    id: 20,
    commodityTypeId: 2,
    commodityCode: "CANOLA-NGM",
    description: "Canola non-GM",
    status: "active",
    unitType: "MT",
    testThresholds: [{ testName: "Moisture", testId: 1, min: 6, max: 9 }],
  },
];

export const DEMO_TESTS = [
  { id: 1, unit: "%" },
  { id: 2, unit: "%" },
];

export const DEMO_CMOS = [
  {
    id: 1,
    direction: "in",
    cmoReference: "CMO-0142",
    customerId: 1,
    commodityTypeId: 1,
    commodityId: 10,
    status: "Open",
    estimatedAmount: 5200,
  },
  {
    id: 2,
    direction: "in",
    cmoReference: "CMO-0139",
    customerId: 2,
    commodityTypeId: 1,
    commodityId: 11,
    status: "Open",
    estimatedAmount: 3000,
  },
];

export const DEMO_TRUCKS = [
  { id: 1, name: "MHY-104", driver: "Alex Nguyen" },
  { id: 2, name: "MHY-227", driver: "Jamie Cole" },
];

export const DEMO_STOCK_LOCATIONS = [
  { id: 1, name: "Bay 12", locationType: "Bay", status: "active", site: DEMO_SITE },
  { id: 2, name: "Shed C", locationType: "Shed", status: "active", site: DEMO_SITE },
  { id: 3, name: "Laneway 4", locationType: "Lane", status: "active", site: DEMO_SITE },
];

export const DEMO_USERS = [
  { id: 1, name: "Alec Stead", active: true },
  { id: 2, name: "Jordan Miles", active: true },
];

export const DEMO_TICKETS = [];

/** Optional seed when opening /ticketing/in/[id] for demo edit flows */
export const DEMO_BRANCHES = [
  { id: 1, code: "MMB", name: "Melbourne" },
];

export const DEMO_SITE_ADDRESS = {
  line1: "115-117 William Angliss Drive, LAVERTON",
  line2: "NORTH, VIC, 3026",
  phone: "(03) 9371 8700",
  email: "melbourne@mahonystransport.com.au",
  web: "www.mahonystransport.com.au",
};

/** Optional seed when opening /ticketing/in/[id] for demo edit flows */
export function demoExistingTicket(id) {
  if (id !== 10421) return null;
  return {
    id: 10421,
    type: "in",
    site: DEMO_SITE,
    status: "completed",
    cmoId: 1,
    truck: DEMO_TRUCKS[0],
    customerId: 1,
    commodityTypeId: 1,
    commodityId: 10,
    grossWeights: [42800],
    tareWeights: [15200],
    grossWeightDateTimes: ["2026-05-19T08:23"],
    tareWeightDateTimes: ["2026-05-19T09:42"],
    splitLoad: true,
    tests: { Protein: "11.90", Moisture: "10.60" },
    commodityConfirmed: true,
    commodityOverrideReason: "",
    signoff: "Alec Stead",
    unloadedLocation: 1,
    notes: "",
    ticketReference: "IN-DEMO-01",
    additionalReference: "PO-8821",
    bookingRef: "WEB-260513017",
    cmoRef: "CMO-0142",
    containerNo: "",
    branchId: 1,
    shrinkAccount: 0,
    price: 0,
    splitAmount: 56.50,
    um: 0.41,
    date: "2026-05-19",
  };
}

export const DEMO_TRANSACTIONS_BY_TICKET = {};

export function getDemoTransactionsByTicket(ticketId) {
  return DEMO_TRANSACTIONS_BY_TICKET[ticketId] || [];
}
