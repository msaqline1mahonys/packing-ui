"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function IntegrationsRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/more-settings/integration-settings?tab=comtrac");
  }, [router]);

  return (
    <p className="text-sm text-slate-500">Redirecting to Integration Settings…</p>
  );
}
