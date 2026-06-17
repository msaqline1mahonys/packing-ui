"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

import FumigationRecordDocument from "@/components/fumigation/fumigation-record-document";
import { resolveFumigationRecordAsync } from "@/lib/fumigation-record-print";
import { certSnapshotHasContent, mergeCertDraftFromPack } from "@/lib/fumigation-detail";
import { getPack } from "@/lib/api/packing";
import {
  loadFumigationRecordSnapshot,
  loadRecordIssue,
} from "@/lib/fumigation-record-storage";

export default function FumigationRecordPrintClient({ packId }) {
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
      const issued = loadRecordIssue(packId, issuedAt);
      if (issued) {
        setModel(issued);
        return;
      }
    }

    let cancelled = false;
    getPack(packId)
      .then(async (row) => {
        if (cancelled || !row) return;
        const fromPack = await resolveFumigationRecordAsync(packId, row);
        const snapshot = loadFumigationRecordSnapshot(packId);
        setModel(
          mergeCertDraftFromPack(
            fromPack,
            certSnapshotHasContent(snapshot) ? snapshot : null
          )
        );
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
    <FumigationRecordDocument
      model={model}
      backHref={`/fumigation/records/${packId}`}
    />
  );
}
