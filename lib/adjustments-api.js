import { API_BASE_URL } from "@/lib/api-config";
import { getAuthHeaders, transactionFromApi } from "@/lib/transactions-api";

const ADJUSTMENTS_ENDPOINT = `${API_BASE_URL}/adjustments`;

function readAuthPayload() {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem("authPayload") || "{}");
  } catch {
    return {};
  }
}

function getTenantPayload() {
  const authPayload = readAuthPayload();
  const payload = {};
  if (authPayload.organization?.id) payload.organization_id = authPayload.organization.id;
  if (authPayload.current_site?.id) payload.site_id = authPayload.current_site.id;
  return payload;
}

function extractApiError(result, fallback) {
  if (result?.errors) return Object.values(result.errors).flat().join(", ");
  return result?.message || result?.msg || fallback;
}

export async function createAdjustment({ customerId, commodityId, locationId, quantity, transactionDate, notes }) {
  const body = {
    ...getTenantPayload(),
    customerId,
    commodityId,
    locationId,
    quantity,
    transactionDate,
    notes,
  };

  const response = await fetch(ADJUSTMENTS_ENDPOINT, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(body),
  });

  const result = await response.json().catch(() => null);
  if (!response.ok || result?.success === false) {
    throw new Error(extractApiError(result, "Failed to create adjustment."));
  }

  const row = result?.output ?? result?.data ?? result;
  return transactionFromApi(row);
}
