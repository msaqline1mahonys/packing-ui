import { API_BASE_URL } from "@/lib/api-config";

const TICKETS_ENDPOINT = `${API_BASE_URL}/ticketing/tickets`;
const CMOS_ENDPOINT = `${API_BASE_URL}/ticketing/cmos`;
const TRUCKS_ENDPOINT = `${API_BASE_URL}/reference-data/trucks`;
const CUSTOMERS_ENDPOINT = `${API_BASE_URL}/reference-data/customers`;
const STOCK_LOCATIONS_ENDPOINT = `${API_BASE_URL}/reference-data/stock-locations`;
const COMMODITY_TYPES_ENDPOINT = `${API_BASE_URL}/product-settings/commodity-types`;
const COMMODITIES_ENDPOINT = `${API_BASE_URL}/product-settings/commodities`;

function readAuthPayload() {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem("authPayload") || "{}");
  } catch {
    return {};
  }
}

export function getAuthHeaders() {
  const token = typeof window !== "undefined" ? localStorage.getItem("authToken") : null;
  return {
    Accept: "application/json",
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function getTenantQuery() {
  const authPayload = readAuthPayload();
  const params = new URLSearchParams();
  if (authPayload.organization?.id) params.set("organization_id", authPayload.organization.id);
  if (authPayload.current_site?.id) params.set("site_id", authPayload.current_site.id);
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

function extractApiError(result, fallback) {
  if (result?.errors) return Object.values(result.errors).flat().join(", ");
  return result?.message || result?.msg || fallback;
}

async function ticketingRequest(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { ...getAuthHeaders(), ...(options.headers || {}) },
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || result?.success === false) {
    throw new Error(extractApiError(result, "Ticketing request failed."));
  }
  return result?.output ?? result?.data ?? result;
}

export function ticketDirectionToType(direction) {
  return direction === "outgoing" ? "out" : "in";
}

export function ticketTypeToDirection(type) {
  return type === "out" ? "outgoing" : "incoming";
}

export function cmoFromApi(row) {
  if (!row) return null;
  return {
    id: row.id,
    direction: row.direction ?? "incoming",
    cmoReference: row.cmo_reference ?? row.cmoReference ?? "",
    customerId: row.customer_id ?? row.customerId ?? row.customer?.id ?? "",
    commodityTypeId: row.commodity_type_id ?? row.commodityTypeId ?? row.commodity_type?.id ?? "",
    commodityId: row.commodity_id ?? row.commodityId ?? row.commodity?.id ?? "",
    status: row.status ?? "Open",
    estimatedAmount: Number(row.estimated_amount ?? row.estimatedAmount ?? 0),
    actualAmountDelivered: Number(row.actual_amount_delivered ?? row.actualAmountDelivered ?? 0),
    customer: row.customer?.name ?? "",
    commodityType: row.commodity_type?.name ?? row.commodityType?.name ?? "",
    commodity: row.commodity?.description ?? row.commodity?.commodity_code ?? "",
    bookings: row.bookings ?? 0,
    additionalReferences: Array.isArray(row.additional_references)
      ? row.additional_references
      : Array.isArray(row.additionalReferences)
        ? row.additionalReferences
        : [],
    attachments: Array.isArray(row.attachments) ? row.attachments : [],
    note: row.note ?? "",
  };
}

export function cmoToApi(cmo) {
  return {
    direction: cmo.direction,
    cmo_reference: cmo.cmoReference,
    customer_id: cmo.customerId,
    commodity_type_id: cmo.commodityTypeId,
    commodity_id: cmo.commodityId,
    status: cmo.status || "Open",
    estimated_amount: cmo.estimatedAmount ?? 0,
    actual_amount_delivered: cmo.actualAmountDelivered ?? 0,
    note: cmo.note ?? "",
    additional_references: cmo.additionalReferences ?? [],
    bookings: cmo.bookings ?? 0,
  };
}

export function ticketFromApi(row) {
  if (!row) return null;
  const truck =
    row.truck && typeof row.truck === "object"
      ? truckFromApi(row.truck)
      : null;
  const truckDisplay = typeof row.truck === "string" ? row.truck : truck?.name || truck?.driver || "";
  if (truck && !truck.driver && row.driver_name) truck.driver = row.driver_name;

  const locationId =
    row.type === "out"
      ? row.loading_location_id ?? row.loadingLocationId ?? row.loading_location?.id ?? ""
      : row.unloaded_location_id ?? row.unloadedLocationId ?? row.unloaded_location?.id ?? "";

  return {
    id: row.id,
    type: row.type ?? "in",
    status: row.status ?? "booked",
    site: row.site_id ?? row.site ?? "",
    date: row.date ? String(row.date).slice(0, 10) : new Date().toISOString().slice(0, 10),
    cmoId: row.cmo_id ?? row.cmoId ?? null,
    truckId: row.truck_id ?? row.truckId ?? truck?.id ?? null,
    truck,
    truckDisplay,
    customerId: row.customer_id ?? row.customerId ?? row.cmo?.customer_id ?? null,
    internalAccountId: row.internal_account_id ?? row.internalAccountId ?? null,
    accountType: row.account_type ?? row.accountType ?? "customer",
    commodityTypeId: row.commodity_type_id ?? row.commodityTypeId ?? row.cmo?.commodity_type_id ?? null,
    commodityId: row.commodity_id ?? row.commodityId ?? row.cmo?.commodity_id ?? null,
    grossWeights: Array.isArray(row.gross_weights) ? row.gross_weights.map(Number) : row.grossWeights ?? [],
    tareWeights: Array.isArray(row.tare_weights) ? row.tare_weights.map(Number) : row.tareWeights ?? [],
    grossWeightDateTimes: row.gross_weight_datetimes ?? row.grossWeightDateTimes ?? [],
    tareWeightDateTimes: row.tare_weight_datetimes ?? row.tareWeightDateTimes ?? [],
    splitLoad: Boolean(row.split_load ?? row.splitLoad),
    tests: row.tests && typeof row.tests === "object" ? row.tests : {},
    commodityConfirmed: Boolean(row.commodity_confirmed ?? row.commodityConfirmed),
    commodityOverrideReason: row.commodity_override_reason ?? row.commodityOverrideReason ?? "",
    signoff: row.signoff_user?.name ?? row.signoff ?? "",
    signoffUserId: row.signoff_user_id ?? row.signoffUserId ?? row.signoff_user?.id ?? "",
    unloadedLocation: row.type === "in" ? locationId : "",
    loadingLocation: row.type === "out" ? locationId : "",
    stockLocationId: locationId,
    ticketReference: row.ticket_reference ?? row.ticketReference ?? "",
    additionalReference: row.additional_reference ?? row.additionalReference ?? "",
    notes: row.notes ?? "",
    netT: row.net_t ?? row.netT ?? null,
    customerCmo: row.customer_cmo ?? row.customerCmo ?? "",
    commodityGrade: row.commodity_grade ?? row.commodityGrade ?? "",
  };
}

export function ticketToApi(ticket) {
  const isOut = ticket.type === "out";
  const locationId = isOut
    ? ticket.loadingLocation || ticket.stockLocationId || ticket.unloadedLocation
    : ticket.unloadedLocation || ticket.stockLocationId;

  return {
    type: ticket.type ?? "in",
    status: ticket.status ?? "booked",
    cmo_id: ticket.cmoId || null,
    truck_id: ticket.truckId || ticket.truck?.id || null,
    driver_name: ticket.truck?.driver ?? ticket.driverName ?? null,
    internal_account_id: ticket.accountType === "internal" ? ticket.internalAccountId || null : null,
    customer_id: ticket.accountType === "internal" ? null : ticket.customerId || null,
    account_type: ticket.accountType ?? "customer",
    commodity_type_id: ticket.commodityTypeId || null,
    commodity_id: ticket.commodityId || null,
    unloaded_location_id: isOut ? null : locationId || null,
    loading_location_id: isOut ? locationId || null : null,
    ticket_reference: ticket.ticketReference || null,
    additional_reference: ticket.additionalReference || null,
    date: ticket.date || null,
    split_load: Boolean(ticket.splitLoad),
    gross_weights: ticket.grossWeights ?? [],
    tare_weights: ticket.tareWeights ?? [],
    gross_weight_datetimes: ticket.grossWeightDateTimes ?? [],
    tare_weight_datetimes: ticket.tareWeightDateTimes ?? [],
    tests: ticket.tests ?? {},
    commodity_confirmed: Boolean(ticket.commodityConfirmed),
    commodity_override_reason: ticket.commodityOverrideReason || null,
    signoff_user_id: ticket.signoffUserId || null,
    notes: ticket.notes || null,
  };
}

function unwrapList(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  return [];
}

export async function fetchTickets({ type, status, date } = {}) {
  const params = new URLSearchParams(getTenantQuery().replace("?", ""));
  if (type) params.set("type", type);
  if (status) params.set("status", status);
  if (date) params.set("date", date);
  const qs = params.toString();
  const data = await ticketingRequest(`${TICKETS_ENDPOINT}${qs ? `?${qs}` : ""}`);
  return unwrapList(data).map(ticketFromApi);
}

export async function fetchTicket(id) {
  const data = await ticketingRequest(`${TICKETS_ENDPOINT}/${id}${getTenantQuery()}`);
  return ticketFromApi(data);
}

export async function saveTicket(ticket) {
  const payload = ticketToApi(ticket);
  const tenantQs = getTenantQuery();
  if (ticket.id) {
    const data = await ticketingRequest(`${TICKETS_ENDPOINT}/${ticket.id}${tenantQs}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
    return ticketFromApi(data);
  }
  const data = await ticketingRequest(`${TICKETS_ENDPOINT}${tenantQs}`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return ticketFromApi(data);
}

export async function completeTicket(id) {
  const data = await ticketingRequest(`${TICKETS_ENDPOINT}/${id}/complete${getTenantQuery()}`, {
    method: "POST",
    body: JSON.stringify({}),
  });
  return ticketFromApi(data);
}

export async function overrideTicket(id) {
  const data = await ticketingRequest(`${TICKETS_ENDPOINT}/${id}/override${getTenantQuery()}`, {
    method: "POST",
    body: JSON.stringify({}),
  });
  return ticketFromApi(data);
}

export async function deleteTicket(id) {
  await ticketingRequest(`${TICKETS_ENDPOINT}/${id}${getTenantQuery()}`, { method: "DELETE" });
}

export async function fetchStockLocations() {
  const params = new URLSearchParams(getTenantQuery().replace("?", ""));
  params.set("per_page", "500");
  const response = await fetch(`${STOCK_LOCATIONS_ENDPOINT}?${params.toString()}`, {
    headers: getAuthHeaders(),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(result?.message || "Failed to load stock locations.");
  }
  const payload = result?.data ?? result;
  const rows = Array.isArray(payload?.data)
    ? payload.data
    : Array.isArray(payload)
      ? payload
      : [];
  return rows.map((l) => ({
    id: l.id,
    name: l.name ?? "",
    locationType: l.locationType ?? l.location_type ?? "",
    status: (l.status ?? "active").toLowerCase(),
  }));
}

export async function fetchTicketFormData(direction = "incoming") {
  const params = new URLSearchParams(getTenantQuery().replace("?", ""));
  params.set("direction", direction);
  const [data, stockLocations] = await Promise.all([
    ticketingRequest(`${TICKETS_ENDPOINT}/form-data?${params.toString()}`),
    fetchStockLocations(),
  ]);
  const formStockLocations = data.stockLocations ?? data.stock_locations ?? [];
  return {
    cmos: (data.cmos ?? []).map(cmoFromApi),
    customers: data.customers ?? [],
    internalAccounts: data.internalAccounts ?? data.internal_accounts ?? [],
    commodityTypes: (data.commodityTypes ?? data.commodity_types ?? []).map((t) => ({
      id: t.id,
      name: t.name,
    })),
    commodities: data.commodities ?? [],
    trucks: (data.trucks ?? []).map((t) => ({
      id: t.id,
      name: t.name ?? t.rego,
      driver: t.driver ?? "",
      tare: t.tare,
    })),
    stockLocations: formStockLocations.length > 0
      ? formStockLocations.map((l) => ({
          id: l.id,
          name: l.name,
          locationType: l.locationType ?? l.location_type,
          status: l.status ?? "active",
        }))
      : stockLocations,
    users: data.users ?? [],
    completedTickets: (data.completedTickets ?? data.completed_tickets ?? []).map(ticketFromApi),
  };
}

export async function fetchCmos(direction = "all") {
  const params = new URLSearchParams(getTenantQuery().replace("?", ""));
  if (direction !== "all") params.set("direction", direction);
  const qs = params.toString();
  const data = await ticketingRequest(`${CMOS_ENDPOINT}${qs ? `?${qs}` : ""}`);
  return unwrapList(data).map(cmoFromApi);
}

export async function saveCmo(cmo) {
  const payload = cmoToApi(cmo);
  const tenantQs = getTenantQuery();
  if (cmo.id) {
    const data = await ticketingRequest(`${CMOS_ENDPOINT}/${cmo.id}${tenantQs}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
    return cmoFromApi(data);
  }
  const data = await ticketingRequest(`${CMOS_ENDPOINT}${tenantQs}`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return cmoFromApi(data);
}

export async function deleteCmo(id) {
  await ticketingRequest(`${CMOS_ENDPOINT}/${id}${getTenantQuery()}`, { method: "DELETE" });
}

export function truckFromApi(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.rego ?? row.name ?? "",
    driver: row.driver ?? "",
    tare: row.tare ?? null,
    combination: row.combination ?? "",
  };
}

function truckToApi(truck) {
  const authPayload = readAuthPayload();
  const tareRaw = truck.tare;
  let tare = null;
  if (tareRaw !== "" && tareRaw != null) {
    const n = Number(tareRaw);
    tare = Number.isNaN(n) ? null : n;
  }
  return {
    ...(authPayload.organization?.id ? { organization_id: authPayload.organization.id } : {}),
    ...(authPayload.current_site?.id ? { site_id: authPayload.current_site.id } : {}),
    rego: String(truck.name ?? truck.rego ?? "").trim() || null,
    driver: String(truck.driver ?? "").trim() || null,
    combination: truck.combination ? String(truck.combination).trim() : null,
    tare,
  };
}

export async function saveTruck(truck) {
  const payload = truckToApi(truck);
  const tenantQs = getTenantQuery();
  if (truck.id) {
    const data = await ticketingRequest(`${TRUCKS_ENDPOINT}/${truck.id}${tenantQs}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
    return truckFromApi(data);
  }
  const data = await ticketingRequest(`${TRUCKS_ENDPOINT}${tenantQs}`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return truckFromApi(data);
}

export async function fetchCmo(id) {
  const data = await ticketingRequest(`${CMOS_ENDPOINT}/${id}${getTenantQuery()}`);
  return cmoFromApi(data?.data ?? data);
}

export async function fetchCmoFormData() {
  const params = new URLSearchParams(getTenantQuery().replace("?", ""));
  params.set("per_page", "500");
  const qs = params.toString();
  const [customersResult, typesResult, commoditiesResult] = await Promise.all([
    ticketingRequest(`${CUSTOMERS_ENDPOINT}?${qs}`),
    ticketingRequest(`${COMMODITY_TYPES_ENDPOINT}?${qs}`),
    ticketingRequest(`${COMMODITIES_ENDPOINT}?${qs}`),
  ]);
  return {
    customers: unwrapList(customersResult).filter((c) => !(c.is_shrink ?? c.isShrink)),
    commodityTypes: unwrapList(typesResult),
    commodities: unwrapList(commoditiesResult),
  };
}
