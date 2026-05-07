export const DEFAULT_CONTAINER_SIZES = ["10FT", "20FT", "40FT", "45FT", "48FT", "53FT"];

export const COMMODITY_TYPE_MASTER_ROWS = [
  { id: 1, name: "Wheat", acosCode: "WHT001", testRequired: "No" },
  { id: 2, name: "Barley", acosCode: "BAR002", testRequired: "Yes" },
];

export const COMMODITY_MASTER_ROWS = [
  {
    id: 1,
    commodityCode: "COM-001",
    description: "Australian Hard Wheat",
    commodityTypeId: 1,
    commodityTypeName: "Wheat",
    hsCode: "1001.99.00",
    pemsCode: "PEMS-1001",
    status: "Active",
    unitType: "t (Tonnes)",
    testThresholds: [
      { test: "Protein", min: "11.0", max: "14.5" },
      { test: "Moisture", min: "8.0", max: "12.5" },
    ],
    shrinkAmount: "2%",
  },
  {
    id: 2,
    commodityCode: "COM-002",
    description: "Premium Malt Barley",
    commodityTypeId: 2,
    commodityTypeName: "Barley",
    hsCode: "1003.90.00",
    pemsCode: "PEMS-1003",
    status: "Active",
    unitType: "t (Tonnes)",
    testThresholds: [
      { test: "Protein", min: "9.0", max: "12.5" },
      { test: "Test Weight", min: "62", max: "72" },
    ],
    shrinkAmount: "1.5%",
  },
];

export const COMMODITY_TEST_DEFINITIONS = [
  { id: "protein", code: "PROTEIN", name: "Protein", unit: "%", minValue: 0, maxValue: 100 },
  { id: "moisture", code: "MOISTURE", name: "Moisture", unit: "%", minValue: 0, maxValue: 100 },
  { id: "test-weight", code: "TEST_WEIGHT", name: "Test Weight", unit: "kg/hL", minValue: 0, maxValue: 200 },
];

export const CUSTOMER_MASTER_ROWS = [
  { id: 1, code: "AC001", name: "Agri-Corp Pty Ltd" },
  { id: 2, code: "BN007", name: "BlueNest Foods" },
];

export const TRANSPORTER_MASTER_ROWS = [
  {
    id: 1,
    code: "TR-01",
    name: "Fast Haul Logistics",
    email: "ops@fasthaul.example",
    contacts: [
      { name: "Mia Carter", email: "mia@fasthaul.example", phone: "+61 3 9000 4011" },
      { name: "Dock Team", email: "dock@fasthaul.example", phone: "+61 3 9000 4012" },
    ],
  },
  {
    id: 2,
    code: "TR-02",
    name: "BlueRoad Transport",
    email: "dispatch@blueroad.example",
    contacts: [{ name: "Liam Ford", email: "liam@blueroad.example", phone: "+61 7 4100 2199" }],
  },
];

export const CONTACT_USER_ROWS = [
  { id: 1, name: "Alec Stead", email: "ops@packing.local", role: "Administrator", active: true, password: "", passwordUpdatedAt: "" },
  { id: 2, name: "Jordan Miles", email: "warehouse@packing.local", role: "Warehouse", active: true, password: "", passwordUpdatedAt: "" },
  { id: 3, name: "Sam Rivera", email: "finance@packing.local", role: "Read only", active: false, password: "", passwordUpdatedAt: "" },
];

export const USER_PERMISSION_USER_ROWS = CONTACT_USER_ROWS.map((user) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role,
}));

export const CUSTOMER_CONTACT_ROWS = [
  {
    id: 1,
    code: "AC001",
    name: "Agri-Corp Pty Ltd",
    emails: ["accounts@agricorp.com.au", "admin@agricorp.com.au"],
    contacts: [{ name: "Sarah Miles", email: "sarah@agricorp.com.au", phone: "+61 7 4000 1122" }],
    addresses: ["123 Farm Road, Toowoomba QLD 4350"],
    website: "www.agricorp.com.au",
    notes: "Preferred morning load slots.",
    invoicingContact: "Accounts Team - accounts@agricorp.com.au",
    warnings: [{ warningDescription: "Requires manifest confirmation before dispatch.", showOnPacks: true }],
  },
  {
    id: 2,
    code: "BN007",
    name: "BlueNest Foods",
    emails: ["ops@bluenestfoods.com.au"],
    contacts: [{ name: "Jordan Lee", email: "jordan@bluenestfoods.com.au", phone: "+61 3 9000 2211" }],
    addresses: ["18 Rivergate Ave, Brisbane QLD 4000"],
    website: "",
    notes: "",
    invoicingContact: "",
    warnings: [],
  },
];

export const INTERNAL_ACCOUNT_ROWS = [
  {
    id: 1,
    name: "Quality Control",
    description: "Account used for QA discrepancy adjustments.",
    shrinkApplied: true,
    shrinkReceivalAccount: false,
  },
  {
    id: 2,
    name: "Shrink Reserve",
    description: "Default account for shrink receival workflow.",
    shrinkApplied: false,
    shrinkReceivalAccount: true,
  },
];

export const CHARGE_TYPES = [
  { value: "Per Invoice", label: "Per Invoice" },
  { value: "Per MT", label: "Per MT" },
  { value: "Per Container", label: "Per Container" },
];

export const CHARGE_CLASSIFICATIONS = [
  { value: "revenue", label: "Revenue charge" },
  { value: "expense", label: "Expense charge" },
  { value: "both", label: "Both" },
];

export const FEES_AND_CHARGES_ROWS = [
  {
    id: 1,
    chargeName: "Handling Fee",
    chargeDescription: "Standard handling and administration",
    chargeRate: 22,
    chargeType: "Per Container",
    applyToAllPacks: true,
    chargeClassification: "revenue",
    accountCode: "REV-001",
  },
];

export const GENERAL_TRANSPORT_PRICE_ROWS = [
  {
    id: 1,
    transporterId: 1,
    containerSize: "20ft",
    lineItemDescription: "Transport - 20ft metro route",
    price: 145,
  },
  {
    id: 2,
    transporterId: 2,
    containerSize: "40ft",
    lineItemDescription: "Transport - 40ft regional route",
    price: 238.5,
  },
];

export const GENERAL_PACK_PRICING_STATE = {
  defaultPackingPrices: [
    { id: 1, commodityTypeId: 1, containerSize: "20FT", price: 95 },
    { id: 2, commodityTypeId: 2, containerSize: "20FT", price: 102.5 },
  ],
  commodityPrices: [{ id: 1, commodityId: 1, containerSize: "20FT", price: 99 }],
  commodityTypeCustomerPrices: [{ id: 1, customerId: 1, commodityTypeId: 1, containerSize: "20FT", price: 91.25 }],
  commodityCustomerPrices: [{ id: 1, customerId: 1, commodityId: 1, containerSize: "20FT", price: 88.75 }],
};

export const SHRINK_SETTINGS_DATA = {
  defaultShrinkPercent: 0.5,
  commodityTypeShrinkRules: [
    { id: 1, commodityTypeId: 1, shrinkPct: 0.8 },
    { id: 2, commodityTypeId: 2, shrinkPct: 1.2 },
  ],
  commodityShrinkRules: [{ id: 1, commodityId: 1, shrinkPct: 1.0 }],
  customerCommodityShrinkRules: [{ id: 1, customerId: 1, commodityId: 1, shrinkPct: 0.65 }],
};

export const PACK_STATUSES = [
  "Pending",
  "Inprogress",
  "Awaiting Approval",
  "Pending Fumigation",
  "Approved",
  "Invoiced",
  "Completed",
];

export const SAMPLE_STATUSES = ["Pending", "Sent", "In Lab", "Passed", "Failed"];

export const PACK_FORM_LOOKUPS = {
  sites: [
    { id: 1, name: "Sydney" },
    { id: 2, name: "Melbourne" },
    { id: 3, name: "Brisbane" },
  ],
  customers: [
    { id: 1, name: "Riverina Co-op" },
    { id: 2, name: "GrainCorp Trading" },
  ],
  commodityTypes: [
    { id: 1, name: "Grains" },
    { id: 2, name: "Pulses" },
  ],
  commodities: [
    { id: 1, commodityTypeId: 1, description: "Feed barley" },
    { id: 2, commodityTypeId: 1, description: "Canola" },
    { id: 3, commodityTypeId: 2, description: "Lentils" },
  ],
  shippingLines: [
    { id: 1, name: "Maersk", code: "MSK" },
    { id: 2, name: "MSC", code: "MSC" },
  ],
  containerParks: [
    { id: 1, name: "Park A" },
    { id: 2, name: "Park B" },
  ],
  transporters: [
    { id: 1, name: "Trans One" },
    { id: 2, name: "Trans Two" },
  ],
  packers: [
    { id: 1, name: "Alex", status: "active" },
    { id: 2, name: "Jordan", status: "active" },
    { id: 3, name: "Casey", status: "inactive" },
  ],
  vesselScheduleCsvRows: [
    { shipName: "Pacific Trader", voyageOut: "VOY-111", cargoCutoffDate: "2026-06-10" },
    { shipName: "Southern Reef", voyageOut: "VOY-222", cargoCutoffDate: "2026-06-13" },
  ],
};

export const PACK_TEMPLATE = {
  packType: "container",
  importExport: "Export",
  customerId: "",
  exporter: "",
  commodityTypeId: "",
  commodityId: "",
  status: "Pending",
  jobReference: "",
  fumigation: "",
  containersRequired: "",
  releaseIds: [],
  releaseDetails: [],
  emptyContainerParkIds: [],
  transporterIds: [],
  assignedPackerIds: [],
  siteId: 1,
  quantityPerContainer: "",
  maxQtyPerContainer: "",
  mtTotal: "",
  destinationCountry: "",
  destinationPort: "",
  transshipmentPort: "",
  transshipmentPortCode: "",
  shippingLineId: "",
  vesselDepartureId: null,
  importPermitRequired: false,
  importPermitNumber: "",
  importPermitDate: "",
  importPermitFiles: [],
  rfp: "",
  rfpAdditionalDeclarationRequired: false,
  additionalDeclarationFiles: [],
  rfpFiles: [],
  rfpComment: "",
  rfpExpiry: "",
  rfpCommodityCode: "",
  sampleRequired: false,
  sampleLocations: [],
  sampleSentDates: [],
  sampleStatuses: [],
  packingInstructionFiles: [],
  jobNotes: "",
  date: new Date().toISOString().split("T")[0],
  testRequired: false,
  shrinkTaken: false,
};

export const PACK_SCHEDULE_ROWS = [
  {
    id: 10442,
    importExport: "Export",
    customer: "Riverina Co-op",
    commodity: "Feed barley",
    status: "Pending",
    jobReference: "JOB-88921",
    containersRequired: 4,
    mtTotal: 102.4,
    exporter: "AusGrain Pty Ltd",
    destinationCountry: "Vietnam",
    vessel: "Pacific Trader",
    jobNotes: "Docs pending PEM signature.",
    date: "2026-05-04",
  },
  {
    id: 10441,
    importExport: "Import",
    customer: "GrainCorp Trading",
    commodity: "Canola",
    status: "Pending Fumigation",
    jobReference: "JOB-88902",
    containersRequired: 2,
    mtTotal: 58.0,
    exporter: "-",
    destinationCountry: "Australia",
    vessel: "Southern Reef",
    jobNotes: "Awaiting fumigation clearance.",
    date: "2026-05-05",
  },
];

export const REFERENCE_COUNTRIES_ROWS = [
  {
    id: 1,
    countryName: "Australia",
    countryCode: "AU",
    notesPreview: "Standard documentation applies",
    contactItems: [
      { name: "Border Ops AU", phone: "+61 2 9132 0011", email: "ops-au@shipflow.example" },
      { name: "Customs Support", phone: "+61 2 9132 0099", email: "customs-au@shipflow.example" },
    ],
    warningItems: [],
  },
  {
    id: 2,
    countryName: "New Zealand",
    countryCode: "NZ",
    notesPreview: "Special treatment timing",
    contactItems: [{ name: "Auckland Desk", phone: "+64 9 700 2340", email: "auckland-desk@shipflow.example" }],
    warningItems: [{ description: "Biosecurity checks can delay release by 1-2 days.", showOnPacks: true }],
  },
];

export const REFERENCE_TRUCK_ROWS = [
  { id: 1, name: "MHY-104", driver: "Alex Nguyen", combination: "B-Double", tare: "8.20" },
  { id: 2, name: "MHY-227", driver: "Jamie Cole", combination: "Semi Trailer", tare: "8.45" },
];

export const REFERENCE_STOCK_LOCATION_ROWS = [
  { id: 1, name: "Bay 12", site: "Melbourne", locationType: "Bay", status: "Active", capacity: "420" },
  { id: 2, name: "Shed C", site: "Melbourne", locationType: "Shed", status: "Active", capacity: "800" },
];

export const REFERENCE_PORT_ROWS = [
  { id: 1, code: "AUMEL", name: "Melbourne", country: "Australia" },
  { id: 2, code: "AUSYD", name: "Sydney", country: "Australia" },
];

export const REFERENCE_SHIPPING_LINE_ROWS = [
  {
    id: 1,
    shippingLineCode: "BSL",
    shippingLineName: "BlueStar Line",
    website: "https://example.com/bluestar",
    shippingLineContactEmail: "schedules@example.com",
    shippingLineContactPhoneNumber: "+61 3 9000 1111",
  },
];

export const REFERENCE_VESSEL_ROWS = [
  {
    id: 1,
    vessel: "Pacific Trader",
    voyageNumber: "PT0426",
    vesselCutoffDate: "2026-05-02T14:00",
    vesselReceivalsOpenDate: "2026-04-28T06:00",
    vesselEta: "2026-05-05T08:00",
    vesselEtd: "2026-05-06T16:00",
    vesselFreeDays: "7",
    shippingLine: "BlueStar Line",
  },
];

export const REFERENCE_TERMINAL_ROWS = [
  {
    id: 1,
    terminalCode: "APT",
    terminalName: "Appleton Terminal",
    terminalContacts: [
      { contactName: "Ops Desk", contactEmail: "ops@appleton.example", contactPhone: "+61 3 9000 1111" },
      { contactName: "Gate Control", contactEmail: "gate@appleton.example", contactPhone: "+61 3 9000 2222" },
    ],
    notes: "Primary export terminal.",
    revenuePrice: "185.00",
    expensePrice: "132.50",
  },
];

export const APP_DATA = {
  productSettings: {
    commodityTypes: COMMODITY_TYPE_MASTER_ROWS,
    commodities: COMMODITY_MASTER_ROWS,
    shrinkSettings: SHRINK_SETTINGS_DATA,
    tests: COMMODITY_TEST_DEFINITIONS,
  },
  packingSchedule: {
    statuses: PACK_STATUSES,
    sampleStatuses: SAMPLE_STATUSES,
    lookups: PACK_FORM_LOOKUPS,
    packTemplate: PACK_TEMPLATE,
    packs: PACK_SCHEDULE_ROWS,
  },
  contacts: {
    customers: CUSTOMER_CONTACT_ROWS,
    users: CONTACT_USER_ROWS,
    userPermissions: USER_PERMISSION_USER_ROWS,
    internalAccounts: INTERNAL_ACCOUNT_ROWS,
    transporters: TRANSPORTER_MASTER_ROWS,
  },
  accounting: {
    containerSizes: DEFAULT_CONTAINER_SIZES,
    feesAndCharges: FEES_AND_CHARGES_ROWS,
    generalTransportPrices: GENERAL_TRANSPORT_PRICE_ROWS,
    generalPackPricing: GENERAL_PACK_PRICING_STATE,
    chargeTypes: CHARGE_TYPES,
    chargeClassifications: CHARGE_CLASSIFICATIONS,
  },
  referenceData: {
    countries: REFERENCE_COUNTRIES_ROWS,
    trucks: REFERENCE_TRUCK_ROWS,
    stockLocations: REFERENCE_STOCK_LOCATION_ROWS,
    ports: REFERENCE_PORT_ROWS,
    vessels: REFERENCE_VESSEL_ROWS,
    shippingLines: REFERENCE_SHIPPING_LINE_ROWS,
    terminals: REFERENCE_TERMINAL_ROWS,
  },
};
