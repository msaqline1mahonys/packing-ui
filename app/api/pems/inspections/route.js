import { proxyToBackend } from "@/lib/pems/server-proxy";

export async function POST(request) {
  const body = await request.text();
  return proxyToBackend(request, "inspections", { method: "POST", body });
}
