import { NextResponse } from "next/server";

import { fallbackReferenceData, proxyToBackend } from "@/lib/pems/server-proxy";

export async function GET(request, { params }) {
  const { refType } = await params;
  const proxied = await proxyToBackend(request, `reference-data/${encodeURIComponent(refType)}`, { method: "GET" });
  if (proxied.status === 503 || proxied.status === 404) {
    return NextResponse.json(fallbackReferenceData(refType));
  }
  return proxied;
}
