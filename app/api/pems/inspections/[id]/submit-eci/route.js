import { proxyToBackend } from "@/lib/pems/server-proxy";

export async function POST(request, { params }) {
  const { id } = await params;
  return proxyToBackend(request, `inspections/${encodeURIComponent(id)}/submit-eci`, { method: "POST" });
}
