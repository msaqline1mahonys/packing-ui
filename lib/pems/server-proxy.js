import { NextResponse } from "next/server";

import { FALLBACK_REFERENCE_DATA } from "@/lib/pems/constants";

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api").replace(/\/+$/, "");

export function getBackendPemsUrl(path = "") {
  const suffix = String(path || "").replace(/^\/+/, "");
  return `${API_BASE_URL}/pems/${suffix}`;
}

export async function proxyToBackend(request, path, options = {}) {
  const url = getBackendPemsUrl(path);
  const headers = new Headers(options.headers || {});
  const auth = request.headers.get("authorization");
  if (auth) headers.set("Authorization", auth);
  if (!headers.has("Accept")) headers.set("Accept", "application/json");
  if (options.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");

  try {
    const response = await fetch(url, {
      method: options.method || request.method,
      headers,
      body: options.body,
    });
    const text = await response.text();
    let data;
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { error: text || "Invalid backend response." };
    }
    return NextResponse.json(data, { status: response.status });
  } catch {
    return NextResponse.json(
      { error: "PEMS backend is not available. Start the API server or check NEXT_PUBLIC_API_URL." },
      { status: 503 }
    );
  }
}

export function fallbackReferenceData(refType) {
  return { items: FALLBACK_REFERENCE_DATA[refType] || [] };
}

export { API_BASE_URL };
