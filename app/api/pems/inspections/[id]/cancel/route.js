import { proxyToBackend } from "@/lib/pems/server-proxy";

export async function POST(request, { params }) {
  const { id } = await params;
  const body = await request.text();
  return proxyToBackend(request, `inspections/${encodeURIComponent(id)}/cancel`, { method: "POST", body });
}
