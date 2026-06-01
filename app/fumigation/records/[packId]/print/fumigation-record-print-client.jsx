"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

import FumigationRecordDocument from "@/components/fumigation/fumigation-record-document";
import { resolveFumigationRecord } from "@/lib/fumigation-record-print";
import {
  loadFumigationRecordSnapshot,
  loadRecordIssue,
} from "@/lib/fumigation-record-storage";

export default function FumigationRecordPrintClient({ packId }) {
  const searchParams = useSearchParams();
  const autoPrint = searchParams.get("print") === "1";
  const issuedAt = searchParams.get("issuedAt") || null;
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  const model = useMemo(() => {
    if (!hydrated) {
      // SSR / pre-hydration: resolve fresh from pack data (no storage access)
      return resolveFumigationRecord(packId);
    }

    // Historical reprint: load from issued copies audit trail
    if (issuedAt) {
      const issued = loadRecordIssue(packId, issuedAt);
      if (issued) return issued;
    }

    // Current session snapshot (draft / just-issued)
    const snapshot = loadFumigationRecordSnapshot(packId);
    if (snapshot) return snapshot;

    // Fallback: resolve fresh from pack data
    return resolveFumigationRecord(packId);
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
