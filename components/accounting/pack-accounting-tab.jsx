"use client";

import { useEffect, useMemo, useState } from "react";

import PackInvoiceBreakdownEditor from "@/components/accounting/pack-invoice-breakdown-editor";
import { loadPackCostBreakdown } from "@/lib/pack-cost-breakdown";

export default function PackAccountingTab({ packId, packStatus, refreshKey = 0, isActive = true }) {
  const [fetchResult, setFetchResult] = useState({ key: "", breakdown: null, error: "" });

  const resolvedPackId = useMemo(() => String(packId || "").trim(), [packId]);
  const isApproved = String(packStatus || "").toLowerCase() === "approved";
  const shouldLoad = Boolean(isActive && resolvedPackId);
  const fetchKey = `${resolvedPackId}:${refreshKey}`;

  useEffect(() => {
    if (!shouldLoad) return;

    let cancelled = false;

    loadPackCostBreakdown(resolvedPackId)
      .then((data) => {
        if (cancelled) return;
        setFetchResult({ key: fetchKey, breakdown: data, error: "" });
      })
      .catch((err) => {
        if (cancelled) return;
        setFetchResult({
          key: fetchKey,
          breakdown: null,
          error: err?.message || "Failed to load cost breakdown.",
        });
      });

    return () => {
      cancelled = true;
    };
  }, [fetchKey, resolvedPackId, shouldLoad]);

  const isCurrentFetch = fetchResult.key === fetchKey;
  const loading = shouldLoad && !isCurrentFetch;
  const breakdown = shouldLoad && isCurrentFetch ? fetchResult.breakdown : null;
  const errorText = shouldLoad && isCurrentFetch ? fetchResult.error : "";

  function handleSaved(nextBreakdown) {
    if (!nextBreakdown) return;
    setFetchResult((prev) => ({ ...prev, breakdown: nextBreakdown }));
  }

  return (
    <section className="rounded-[10px] border border-slate-200 bg-white p-3 md:p-[18px]" aria-label="Accounting">
      <PackInvoiceBreakdownEditor
        breakdown={breakdown}
        loading={loading}
        errorText={errorText}
        emptyText="Save the pack to view the cost breakdown."
        showProgressCards
        showReadyToInvoiceLink={isApproved && Boolean(resolvedPackId)}
        readyToInvoiceHref={
          resolvedPackId ? `/accounting/packs-ready-to-invoice/${encodeURIComponent(resolvedPackId)}` : ""
        }
        onSaved={handleSaved}
      />
    </section>
  );
}
