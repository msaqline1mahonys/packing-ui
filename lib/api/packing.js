import { API_BASE_URL } from "@/lib/api-config";

const API_BASE = API_BASE_URL;

function readAuthPayload() {
  try {
    return JSON.parse(localStorage.getItem("authPayload") || "{}");
  } catch {
    return {};
  }
}

function getAuthHeaders() {
  const token = typeof window !== "undefined" ? localStorage.getItem("authToken") : null;
  return {
    Accept: "application/json",
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export function getTenantPayload() {
  const authPayload = readAuthPayload();
  return {
    ...(authPayload.organization?.id ? { organization_id: authPayload.organization.id } : {}),
    ...(authPayload.current_site?.id ? { site_id: authPayload.current_site.id } : {}),
  };
}

function buildTenantQuery(extra = {}) {
  const tenant = getTenantPayload();
  const params = new URLSearchParams();
  if (tenant.organization_id) params.set("organization_id", tenant.organization_id);
  if (tenant.site_id) params.set("site_id", tenant.site_id);
  for (const [key, value] of Object.entries(extra)) {
    if (value == null || value === "") continue;
    params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

function extractApiError(result, fallback) {
  if (result?.errors) {
    return Object.values(result.errors).flat().join(", ");
  }
  return result?.message || fallback;
}

async function packingRequest(path = "", options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      ...getAuthHeaders(),
      ...(options.headers || {}),
    },
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || result?.success === false) {
    const err = new Error(extractApiError(result, "Packing request failed."));
    err.status = response.status;
    throw err;
  }
  return result?.data ?? result;
}

// ---------------------------------------------------------------------------
// Pack response normalizer — converts API snake_case to the camelCase shape
// the frontend work store and pack detail client expect.
// ---------------------------------------------------------------------------

function normalizeDecimal(value) {
  if (value == null) return null;
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : null;
}

/** Return the YYYY-MM-DD portion of any date/datetime string, or "" if empty. */
function stripToDate(value) {
  if (!value) return "";
  const match = String(value).trim().match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : "";
}

function normalizeContainer(raw) {
  if (!raw) return null;
  return {
    id: raw.id,
    packId: raw.pack_id ?? raw.packId,
    order: raw.order,
    status: raw.status ?? "Draft",
    // Packing Order
    containerNumber: raw.container_number ?? raw.containerNumber ?? "",
    containerNo: raw.container_number ?? raw.containerNumber ?? raw.containerNo ?? "",
    containerCode: raw.container_code?.iso_code ?? raw.containerCode ?? "",
    containerIsoCode: raw.container_iso_code ?? raw.containerIsoCode ?? "",
    isoCode: raw.container_iso_code ?? raw.containerIsoCode ?? raw.isoCode ?? "",
    sealNumber: raw.seal_number ?? raw.sealNumber ?? "",
    sealNo: raw.seal_number ?? raw.sealNumber ?? raw.sealNo ?? "",
    releaseNumber: raw.release_number ?? raw.releaseNumber ?? "",
    emptyContainerParkId: raw.empty_container_park_id ?? raw.emptyContainerParkId ?? null,
    transporterId: raw.transporter_id ?? raw.transporterId ?? null,
    startDate: raw.start_date ?? raw.startDate ?? "",
    startHour: raw.start_hour ?? raw.startHour ?? "",
    startMinute: raw.start_minute ?? raw.startMinute ?? "",
    stockBayId: raw.stock_bay_id ?? raw.stockBayId ?? "",
    packer: raw.packer ?? "",
    grainLocation: raw.grain_location ?? raw.grainLocation ?? "",
    // Weights
    tare: normalizeDecimal(raw.tare),
    grossWeight: normalizeDecimal(raw.gross_weight ?? raw.grossWeight),
    nettWeight: normalizeDecimal(raw.nett_weight ?? raw.nettWeight),
    containerTareWeight: normalizeDecimal(raw.container_tare_weight ?? raw.containerTareWeight),
    // Release Details (display names)
    releasePark: raw.release_park ?? raw.releasePark ?? "",
    transporter: raw.transporter ?? "",
    // Signoff
    packerSignoff: raw.packer_signoff ?? raw.packerSignoff ?? "",
    outLoaded: raw.out_loaded ?? raw.outLoaded ?? "No",
    praSignoff: raw.pra_signoff ?? raw.praSignoff ?? "",
    praTemplate: raw.pra_template ?? raw.praTemplate ?? "",
    praSubmitted: Boolean(raw.pra_submitted ?? raw.praSubmitted),
    // 1-Stop PRA Info
    praLastStatus: raw.pra_last_status ?? raw.praLastStatus ?? "Pending",
    praLastSubmittedTime: raw.pra_last_submitted_at ?? raw.praLastSubmittedTime ?? "",
    praLastError: raw.pra_last_error ?? raw.praLastError ?? "",
    // AO Inspection
    emptyInspection: raw.empty_inspection ?? raw.emptyInspection ?? "Pending",
    grainInspection: raw.grain_inspection ?? raw.grainInspection ?? "Pending",
    inspectionLevelCode: raw.inspection_level_code ?? raw.inspectionLevelCode ?? "Consumable",
    passedAfterRectification: raw.passed_after_rectification ?? raw.passedAfterRectification ?? "N",
    inspectionRemarkCode: raw.inspection_remark_code ?? raw.inspectionRemarkCode ?? "",
    aoInspectionRemark: raw.ao_inspection_remark ?? raw.aoInspectionRemark ?? "",
    aoSignoff: raw.ao_signoff ?? raw.aoSignoff ?? "",
    // Packers note
    packerNotes: raw.packer_notes ?? raw.packerNotes ?? "",
    containerNotes: raw.container_notes ?? raw.containerNotes ?? "",
    // ECR / GPPIR tracking
    ecrSubmitted: Boolean(raw.ecr_submitted ?? raw.ecrSubmitted ?? raw.pemsSubmitted),
    ecrLastSubmittedAt: raw.ecr_last_submitted_at ?? raw.ecrLastSubmittedAt ?? raw.pemsLastSubmittedAt ?? "",
    ecrLastBatchId: raw.ecr_last_batch_id ?? raw.ecrLastBatchId ?? raw.pemsLastBatchId ?? "",
    gppirSubmitted: Boolean(raw.gppir_submitted ?? raw.gppirSubmitted),
    gppirLastSubmittedAt: raw.gppir_last_submitted_at ?? raw.gppirLastSubmittedAt ?? "",
    gppirLastBatchId: raw.gppir_last_batch_id ?? raw.gppirLastBatchId ?? "",
    // PEMS
    inspectionResultCode: raw.inspection_result_code ?? raw.inspectionResultCode ?? "",
  };
}

function normalizeRelease(raw) {
  if (!raw) return null;
  return {
    id: raw.id,
    releaseRef: raw.release_ref ?? raw.releaseRef ?? "",
    emptyContainerParkId: raw.empty_container_park_id ?? raw.emptyContainerParkId ?? null,
    transporterId: raw.transporter_id ?? raw.transporterId ?? null,
    emptyContainerPark: raw.empty_container_park ?? raw.emptyContainerPark ?? null,
    transporter: raw.transporter ?? null,
  };
}

function normalizeFiles(files, category) {
  if (!Array.isArray(files)) return [];
  return files
    .filter((f) => (f?.category ?? "") === category)
    .map((f) => ({
      id: f.id ?? `file-${f.name}`,
      name: f.name ?? "",
      url: f.url ?? null,
      type: f.mime ?? f.type ?? "",
      size: f.size ?? null,
    }));
}

function normalizePack(raw) {
  if (!raw) return null;

  const releases = Array.isArray(raw.releases) ? raw.releases.map(normalizeRelease) : [];
  const containers = Array.isArray(raw.containers) ? raw.containers.map(normalizeContainer) : [];
  const files = Array.isArray(raw.files) ? raw.files : [];
  const packerAssignments = Array.isArray(raw.packer_assignments)
    ? raw.packer_assignments
    : Array.isArray(raw.packerAssignments)
      ? raw.packerAssignments
      : [];

  // Resolve customer / commodity — API returns nested objects
  const customerName = raw.customer?.name ?? (typeof raw.customer === "string" ? raw.customer : "");
  const exporterName = raw.exporter?.name ?? (typeof raw.exporter === "string" ? raw.exporter : "");
  const commodityDesc = raw.commodity?.description ?? (typeof raw.commodity === "string" ? raw.commodity : "");

  // Fumigation display: prefer timing string, fall back to required flag
  const fumigationDisplay =
    raw.fumigation_timing ?? raw.fumigationTiming ?? (raw.fumigation_required ? "Required" : "") ?? raw.fumigation ?? "";

  return {
    // Identity
    id: raw.id,
    status: raw.status,
    packType: raw.pack_type ?? raw.packType,
    importExport: raw.import_export ?? raw.importExport,
    jobReference: raw.job_reference ?? raw.jobReference ?? "",
    date: raw.date,

    // Entity IDs — preserved so rowToPack can set form selects without name lookup
    customerId: raw.customer_id ?? raw.customerId ?? null,
    exporterId: raw.exporter_id ?? raw.exporterId ?? null,
    commodityId: raw.commodity_id ?? raw.commodityId ?? null,
    commodityTypeId: raw.commodity_type_id ?? raw.commodityTypeId ?? null,
    vesselVoyageId: raw.vessel_voyage_id ?? raw.vesselVoyageId ?? null,
    terminalId: raw.terminal_id ?? raw.terminalId ?? null,
    shippingLineId: raw.shipping_line_id ?? raw.shippingLineId ?? null,
    containerCodeId: raw.container_code?.id ?? raw.container_code_id ?? raw.containerCodeId ?? null,

    // Customer / Commodity (string display values)
    customer: customerName,
    exporter: exporterName,
    commodity: commodityDesc,
    commodityType: raw.commodity_type?.name ?? raw.commodityType ?? "",

    // Container planning
    containersRequired: raw.containers_required ?? raw.containersRequired ?? 0,
    containerCode: raw.container_code?.iso_code ?? raw.containerCode ?? "",
    mtTotal: raw.mt_total ?? raw.mtTotal ?? null,

    // Vessel / shipping
    vesselCutoffDate: stripToDate(raw.vessel_cutoff_date ?? raw.vesselCutoffDate),
    etd: stripToDate(raw.etd),
    vessel: raw.vessel_voyage?.vessel?.vessel_name ?? raw.vessel ?? "",
    vesselVoyage: raw.vessel_voyage ?? raw.vesselVoyage ?? null,

    // Packing dates / schedule fields — strip time component so date inputs get YYYY-MM-DD
    packingStartDate: stripToDate(raw.packing_start_date ?? raw.packingStartDate),
    packConfirmed: Boolean(raw.pack_confirmed ?? raw.packConfirmed),
    quantityPerContainer: raw.quantity_per_container ?? raw.quantityPerContainer ?? null,
    maxQtyPerContainer: raw.max_qty_per_container ?? raw.maxQtyPerContainer ?? null,
    jobNotes: raw.job_notes ?? raw.jobNotes ?? "",
    packingNote: raw.packing_note ?? raw.packingNote ?? "",
    fumigation: fumigationDisplay,
    fumigationRequired: raw.fumigation_required ?? raw.fumigationRequired ?? false,

    // Import permit
    importPermitRequired: raw.import_permit_required ?? raw.importPermitRequired ?? false,
    importPermitNumber: raw.import_permit_number ?? raw.importPermitNumber ?? "",
    importPermitDate: stripToDate(raw.import_permit_date ?? raw.importPermitDate),

    // Shipping / destination
    transshipmentPort: raw.transshipment_port ?? raw.transshipmentPort ?? "",
    transshipmentPortCode: raw.transshipment_port_code ?? raw.transshipmentPortCode ?? "",
    destinationPort: raw.destination_port ?? raw.destinationPort ?? "",
    portOfLoading: raw.port_of_loading ?? raw.portOfLoading ?? "",

    // RFP / PEMS
    rfp: raw.rfp ?? "",
    rfpAdditionalDeclarationRequired: raw.rfp_additional_declaration_required ?? raw.rfpAdditionalDeclarationRequired ?? false,
    rfpComment: raw.rfp_comment ?? raw.rfpComment ?? "",
    rfpExpiry: stripToDate(raw.rfp_expiry ?? raw.rfpExpiry),
    rfpCommodityCode: raw.rfp_commodity_code ?? raw.rfpCommodityCode ?? "",
    rfpPackType: raw.rfp_pack_type ?? raw.rfpPackType ?? "",
    rfpTotalQuantity: raw.rfp_total_quantity ?? raw.rfpTotalQuantity ?? null,
    rfpQuantityUnit: raw.rfp_quantity_unit ?? raw.rfpQuantityUnit ?? "M/TONS",
    rfpFlowPath: raw.rfp_flow_path ?? raw.rfpFlowPath ?? "",
    originalRfpNumber: raw.original_rfp_number ?? raw.originalRfpNumber ?? "",
    destinationCountry: raw.destination_country ?? raw.destinationCountry ?? "",
    releaseNumber: raw.release_number ?? raw.releaseNumber ?? "",
    releaseNumbers: raw.release_numbers ?? raw.releaseNumbers ?? [],

    // Voyage / vessel details
    voyageNumber: raw.voyage_number ?? raw.voyageNumber ?? "",
    lloydId: raw.lloyd_id ?? raw.lloydId ?? "",
    fumigationTiming: raw.fumigation_timing ?? raw.fumigationTiming ?? "",
    fumigantId: raw.fumigant_id ?? raw.fumigantId ?? null,
    methodologyId: raw.methodology_id ?? raw.methodologyId ?? null,
    certificateTemplateId: raw.certificate_template_id ?? raw.certificateTemplateId ?? null,
    recordTemplateId: raw.record_template_id ?? raw.recordTemplateId ?? null,
    daffPermission: raw.daff_permission ?? raw.daffPermission ?? "N/A",
    edn: raw.edn ?? "",
    packWarningRequired: Boolean(raw.pack_warning_required ?? raw.packWarningRequired),
    packWarning: raw.pack_warning ?? raw.packWarning ?? "",
    testRequired: Boolean(raw.test_required ?? raw.testRequired),
    shrinkTaken: Boolean(raw.shrink_taken ?? raw.shrinkTaken),
    sampleRequired: Boolean(raw.sample_required ?? raw.sampleRequired),
    commodityCountryOfOrigin: raw.commodity_country_of_origin ?? raw.commodityCountryOfOrigin ?? "Australia",
    treatmentProviderId: raw.treatment_provider_id ?? raw.treatmentProviderId ?? "",
    fumigatorAccreditationNumber: raw.fumigator_accreditation_number ?? raw.fumigatorAccreditationNumber ?? "",

    // Tenant
    siteId: raw.site_id ?? raw.siteId ?? null,
    organizationId: raw.organization_id ?? raw.organizationId ?? null,

    // Related arrays (normalized)
    releaseDetails: releases,
    releases: releases,
    containers,
    packerAssignments,
    packer_assignments: packerAssignments,
    assignedPackerIds: packerAssignments
      .map((a) => String(a.packer_id ?? a.packerId ?? a.packer?.id ?? ""))
      .filter(Boolean),

    // File arrays split by category
    importPermitFiles: normalizeFiles(files, "importPermit"),
    rfpFiles: normalizeFiles(files, "rfp"),
    packingInstructionFiles: normalizeFiles(files, "packingInstruction"),
    additionalDeclarationFiles: normalizeFiles(files, "additionalDeclaration"),

    // PEMS
    pemsSubmissions: Array.isArray(raw.pems_submissions ?? raw.pemsSubmissions) ? (raw.pems_submissions ?? raw.pemsSubmissions) : [],
    pemsDraft: raw.pems_draft ?? raw.pemsDraft ?? null,
  };
}

// ---------------------------------------------------------------------------

export async function listPacks(params = {}) {
  const { status, importExport, dateField, from, to, on, search, page, perPage } = params;
  const qs = new URLSearchParams();
  if (Array.isArray(status) && status.length) {
    status.forEach((s) => qs.append("status[]", s));
  } else if (typeof status === "string" && status) {
    qs.append("status[]", status);
  }
  if (importExport && importExport !== "all") qs.set("import_export", importExport);
  if (dateField) qs.set("date_field", dateField);
  if (from) qs.set("from", from);
  if (to) qs.set("to", to);
  if (on) qs.set("on", on);
  if (search) qs.set("search", search);
  if (page) qs.set("page", String(page));
  if (perPage) qs.set("per_page", String(perPage));
  const query = qs.toString();
  const data = await packingRequest(`/packing/packs${query ? `?${query}` : ""}`);
  const items = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
  const pagination = data && !Array.isArray(data) ? {
    currentPage: data.current_page ?? 1,
    lastPage: data.last_page ?? 1,
    perPage: data.per_page ?? items.length,
    total: data.total ?? items.length,
  } : null;
  return { rows: items, pagination };
}

export async function getPack(id) {
  const raw = await packingRequest(`/packing/packs/${id}`);
  return normalizePack(raw);
}

export async function createPack(payload) {
  return packingRequest("/packing/packs", {
    method: "POST",
    body: JSON.stringify({ ...getTenantPayload(), ...payload }),
  });
}

export async function updatePack(id, payload) {
  return packingRequest(`/packing/packs/${id}`, {
    method: "PUT",
    body: JSON.stringify({ ...getTenantPayload(), ...payload }),
  });
}

export async function deletePack(id) {
  return packingRequest(`/packing/packs/${id}`, { method: "DELETE" });
}

export async function updateContainer(packId, containerId, payload) {
  const raw = await packingRequest(`/packing/packs/${packId}/containers/${containerId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
  return normalizeContainer(raw);
}

export async function getPackFormData() {
  return packingRequest(`/packing/packs/form-data${buildTenantQuery()}`);
}

export async function fetchUsersForSelect() {
  const raw = await packingRequest("/users-for-select");
  const list = Array.isArray(raw) ? raw : Array.isArray(raw?.data) ? raw.data : [];
  return list.map((u) => ({ id: u.id, name: u.name ?? "", email: u.email ?? "" }));
}

export async function fetchStockLocations() {
  const raw = await packingRequest("/reference-data/stock-locations?per_page=200&status=Active");
  const list = Array.isArray(raw?.data) ? raw.data : Array.isArray(raw) ? raw : [];
  return list.map((s) => ({ id: s.id, name: s.name ?? "", locationType: s.location_type ?? "" }));
}

export async function fetchPackers() {
  const raw = await packingRequest(`/reference-data/packers${buildTenantQuery({ per_page: 500 })}`);
  const list = Array.isArray(raw?.data) ? raw.data : Array.isArray(raw) ? raw : [];
  return list.map((p) => ({
    id: p.id,
    name: p.name ?? "",
    status: p.status ?? "Active",
  }));
}

export function activePackerNames(packers) {
  return (packers || [])
    .filter((p) => String(p.status ?? "active").toLowerCase() === "active")
    .map((p) => p.name)
    .filter(Boolean);
}
