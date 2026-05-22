import { proxyToBackend } from "@/lib/pems/server-proxy";

export async function PATCH(request, { params }) {
  const { id } = await params;
  const body = await request.text();
  return proxyToBackend(request, `inspections/${encodeURIComponent(id)}`, { method: "PATCH", body });
}

export async function GET(request, { params }) {
  const { id } = await params;
  return proxyToBackend(request, `inspections/${encodeURIComponent(id)}`, { method: "GET" });
}
