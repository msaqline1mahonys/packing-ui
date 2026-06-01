"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

import FumigationCertificateDocument from "@/components/fumigation/fumigation-certificate-document";
import { resolveFumigationCertificate } from "@/lib/fumigation-cert-print";
import {
  loadFumigationCertSnapshot,
  loadCertificateIssue,
} from "@/lib/fumigation-cert-storage";

export default function FumigationCertificatePrintClient({ packId }) {
  const searchParams = useSearchParams();
  const autoPrint = searchParams.get("print") === "1";
  const issuedAt = searchParams.get("issuedAt") || null;
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  const model = useMemo(() => {
    if (!hydrated) {
      // SSR / pre-hydration: resolve from pack rows only (no session/localStorage)
      return resolveFumigationCertificate(packId);
    }

    // If viewing a specific issued copy:
    if (issuedAt) {
      const issued = loadCertificateIssue(packId, issuedAt);
      if (issued) return issued;
    }

    // Otherwise load the draft snapshot, falling back to a fresh resolve
    const snapshot = loadFumigationCertSnapshot(packId);
    if (snapshot) return snapshot;

    return resolveFumigationCertificate(packId);
  }, [hydrated, packId, issuedAt]);

  useEffect(() => {
    if (!autoPrint || !model) return;
    const timer = window.setTimeout(() => window.print(), 400);
    return () => window.clearTimeout(timer);
  }, [autoPrint, model]);

  return (
    <FumigationCertificateDocument
      model={model}
      backHref={`/fumigation/certificates/${packId}`}
    />
  );
}
