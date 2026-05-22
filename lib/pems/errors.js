export class PemsRfpRefreshError extends Error {
  constructor(message, details = {}) {
    super(message || "RFP refresh fields changed after first inspection.");
    this.name = "PemsRfpRefreshError";
    this.faultCode = details.faultCode || "30171";
    this.refreshFields = details.refreshFields || [];
  }
}

export function isPemsRfpRefreshError(error) {
  return error instanceof PemsRfpRefreshError || error?.name === "PemsRfpRefreshError" || error?.faultCode === "30171";
}

export function parsePemsApiError(data, fallback = "PEMS request failed.") {
  if (!data || typeof data !== "object") return new Error(fallback);
  if (data.error === "PemsRfpRefreshError" || data.faultCode === "30171") {
    return new PemsRfpRefreshError(data.message || fallback, data);
  }
  return new Error(data.message || data.error || fallback);
}

export function pemsRfpRefreshUserMessage() {
  return "RFP details changed after the first inspection was submitted. Cancel prior inspections in PEMS, then submit fresh inspection records.";
}
