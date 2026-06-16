"use client";

import { useEffect, useMemo, useState } from "react";

import PackCostBreakdownPanel from "@/components/accounting/pack-cost-breakdown-panel";
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

  return (
    <section className="rounded-[10px] border border-slate-200 bg-white p-3 md:p-[18px]" aria-label="Accounting">
      <PackCostBreakdownPanel
        breakdown={breakdown}
        loading={loading}
        errorText={errorText}
        emptyText="Save the pack to view the cost breakdown."
        showReadyToInvoiceLink={isApproved && Boolean(resolvedPackId)}
        readyToInvoiceHref={
          resolvedPackId ? `/accounting/packs-ready-to-invoice/${encodeURIComponent(resolvedPackId)}` : ""
        }
      />
    </section>
  );
}
