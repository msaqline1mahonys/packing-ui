"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

import FumigationRecordDocument from "@/components/fumigation/fumigation-record-document";
import { resolveFumigationRecord } from "@/lib/fumigation-record-print";
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
  const [fetchedModel, setFetchedModel] = useState(null);

  useEffect(() => {
    setHydrated(true);
  }, []);

  // Stored copy: issued audit-trail entry first, else current session snapshot
  const storedModel = useMemo(() => {
    if (!hydrated) return null;
    if (issuedAt) {
      const issued = loadRecordIssue(packId, issuedAt);
      if (issued) return issued;
    }
    return loadFumigationRecordSnapshot(packId);
  }, [hydrated, packId, issuedAt]);

  // No stored copy — resolve fresh from the backend pack
  useEffect(() => {
    if (!hydrated || storedModel) return;
    let cancelled = false;
    getPack(packId)
      .then((row) => {
        if (cancelled || !row) return;
        setFetchedModel(resolveFumigationRecord(packId, row));
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
    <FumigationRecordDocument
      model={model}
      backHref={`/fumigation/records/${packId}`}
    />
  );
}
