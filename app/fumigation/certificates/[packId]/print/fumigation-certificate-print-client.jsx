"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

import FumigationCertificateDocument from "@/components/fumigation/fumigation-certificate-document";
import { resolveFumigationCertificate } from "@/lib/fumigation-cert-print";
import { getPack } from "@/lib/api/packing";
import {
  loadFumigationCertSnapshot,
  loadCertificateIssue,
} from "@/lib/fumigation-cert-storage";

export default function FumigationCertificatePrintClient({ packId }) {
  const searchParams = useSearchParams();
  const autoPrint = searchParams.get("print") === "1";
  const issuedAt = searchParams.get("issuedAt") || null;
  const [hydrated, setHydrated] = useState(false);
  const [fetchedModel, setFetchedModel] = useState(null);

  useEffect(() => {
    setHydrated(true);
  }, []);

  // Stored copy: issued audit-trail entry first, else current draft snapshot
  const storedModel = useMemo(() => {
    if (!hydrated) return null;
    if (issuedAt) {
      const issued = loadCertificateIssue(packId, issuedAt);
      if (issued) return issued;
    }
    return loadFumigationCertSnapshot(packId);
  }, [hydrated, packId, issuedAt]);

  // No stored copy — resolve fresh from the backend pack
  useEffect(() => {
    if (!hydrated || storedModel) return;
    let cancelled = false;
    getPack(packId)
      .then((row) => {
        if (cancelled || !row) return;
        setFetchedModel(resolveFumigationCertificate(packId, row));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [hydrated, storedModel, packId]);

  const model = storedModel ?? fetchedModel;

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
