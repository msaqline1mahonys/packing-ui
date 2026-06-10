const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api").replace(/\/+$/, "");

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

function extractApiError(result, fallback) {
  if (result?.errors) {
    return Object.values(result.errors).flat().join(", ");
  }
  return result?.message || fallback;
}

async function referenceRequest(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { ...getAuthHeaders(), ...(options.headers || {}) },
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || result?.success === false) {
    throw new Error(extractApiError(result, "Reference data request failed."));
  }
  return result?.data ?? result;
}

/** Create a Vessel hull. Mirrors the Shipping Details › Vessel form payload. */
export async function createVessel(draft) {
  return referenceRequest("/reference-data/vessels", {
    method: "POST",
    body: JSON.stringify({
      ...getTenantPayload(),
      vessel_name: draft.vesselName?.trim() || null,
      lloyds_number: draft.lloydsNumber?.trim() || null,
      vessel_type: draft.vesselType?.trim() || null,
      shipping_line_id: draft.shippingLineId || null,
    }),
  });
}

/** Create a Vessel Voyage. Mirrors the Shipping Details › Vessel Voyage form payload. */
export async function createVesselVoyage(draft) {
  return referenceRequest("/reference-data/vessel-voyages", {
    method: "POST",
    body: JSON.stringify({
      ...getTenantPayload(),
      vessel_id: draft.vesselId || null,
      voyage_number: draft.voyageNumber?.trim() || null,
      voyage_number_in: draft.voyageNumberIn?.trim() || null,
      shipping_line_id: draft.shippingLineId || null,
      terminal_id: draft.terminalId || null,
      load_port_id: draft.loadPortId || null,
      vessel_eta: draft.vesselEta || null,
      vessel_etd: draft.vesselEtd || null,
      vessel_cutoff_date: draft.vesselCutoffDate || null,
      vessel_reefer_cutoff_date: draft.vesselReeferCutoffDate || null,
      vessel_receivals_open_date: draft.vesselReceivalsOpenDate || null,
      vessel_free_days: draft.vesselFreeDays === "" || draft.vesselFreeDays == null ? null : Number(draft.vesselFreeDays),
    }),
  });
}
