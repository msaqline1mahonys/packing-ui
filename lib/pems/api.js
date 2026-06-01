import { FALLBACK_REFERENCE_DATA } from "@/lib/pems/constants";
import { parsePemsApiError } from "@/lib/pems/errors";

function apiBase() {
  if (typeof window !== "undefined") {
    return "";
  }
  return "";
}

function readAuthHeaders() {
  if (typeof window === "undefined") return { "Content-Type": "application/json" };
  const token = localStorage.getItem("authToken");
  return {
    Accept: "application/json",
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function parseJsonResponse(response) {
  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }
  if (!response.ok) {
    throw parsePemsApiError(data, `PEMS request failed (${response.status}).`);
  }
  return data;
}

export async function fetchPemsReferenceData(refType) {
  const type = String(refType || "").trim();
  try {
    const response = await fetch(`${apiBase()}/api/pems/reference-data/${encodeURIComponent(type)}`, {
      headers: readAuthHeaders(),
    });
    if (response.ok) {
      const data = await response.json();
      return Array.isArray(data?.items) ? data.items : [];
    }
  } catch {
    // fall through to static fallback
  }
  return FALLBACK_REFERENCE_DATA[type] || [];
}

export async function createPemsInspection(payload) {
  const response = await fetch(`${apiBase()}/api/pems/inspections`, {
    method: "POST",
    headers: readAuthHeaders(),
    body: JSON.stringify(payload),
  });
  return parseJsonResponse(response);
}

export async function updatePemsInspection(id, payload) {
  const response = await fetch(`${apiBase()}/api/pems/inspections/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: readAuthHeaders(),
    body: JSON.stringify(payload),
  });
  return parseJsonResponse(response);
}

export async function submitPemsEci(inspectionId) {
  const response = await fetch(`${apiBase()}/api/pems/inspections/${encodeURIComponent(inspectionId)}/submit-eci`, {
    method: "POST",
    headers: readAuthHeaders(),
  });
  return parseJsonResponse(response);
}

export async function submitPemsCgi(inspectionId) {
  const response = await fetch(`${apiBase()}/api/pems/inspections/${encodeURIComponent(inspectionId)}/submit-cgi`, {
    method: "POST",
    headers: readAuthHeaders(),
  });
  return parseJsonResponse(response);
}

export async function cancelPemsInspections(inspectionId, payload = {}) {
  const response = await fetch(`${apiBase()}/api/pems/inspections/${encodeURIComponent(inspectionId)}/cancel`, {
    method: "POST",
    headers: readAuthHeaders(),
    body: JSON.stringify(payload),
  });
  return parseJsonResponse(response);
}

export async function submitPemsInspectionFlow({ recordType, payload, isGppir }) {
  try {
    const created = await createPemsInspection(payload);
    const inspectionId = created?.id || created?.inspectionId;
    if (!inspectionId) return created;
    if (isGppir) return submitPemsCgi(inspectionId);
    return submitPemsEci(inspectionId);
  } catch (error) {
    if (error?.message?.includes("fetch") || error?.message?.includes("Failed")) {
      throw new Error("PEMS backend is not available. Configure the API server or try again later.");
    }
    throw error;
  }
}
