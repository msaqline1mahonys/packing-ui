"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

import FumigationCertificateDocument from "@/components/fumigation/fumigation-certificate-document";
import { resolveFumigationCertificateAsync, previewFumigationCertificateNumber } from "@/lib/fumigation-cert-print";
import { certSnapshotHasContent, mergeCertDraftFromPack, looksLikeUuid } from "@/lib/fumigation-detail";
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
  const [model, setModel] = useState(null);

  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;

    if (issuedAt) {
      const issued = loadCertificateIssue(packId, issuedAt);
      if (issued) {
        setModel(issued);
        return;
      }
    }

    let cancelled = false;
    getPack(packId)
      .then(async (row) => {
        if (cancelled || !row) return;
        const fromPack = await resolveFumigationCertificateAsync(packId, row);
        const snapshot = loadFumigationCertSnapshot(packId);
        const merged = mergeCertDraftFromPack(
          fromPack,
          certSnapshotHasContent(snapshot) ? snapshot : null
        );
        const savedNumber = String(merged?.certificateNumber ?? "").trim();
        if (
          !savedNumber ||
          looksLikeUuid(savedNumber) ||
          (String(packId).length > 10 && savedNumber.includes(String(packId)))
        ) {
          merged.certificateNumber = previewFumigationCertificateNumber(packId, row);
        }
        setModel(merged);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
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
