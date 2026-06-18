"use client";

import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import {
  fetchHoldingsAtLocation,
  fetchStockByLocationForAccount,
} from "@/lib/stock-transfers-api";

function qtyColor(q) {
  return q < 0 ? "text-red-600" : "text-emerald-700";
}

function HoldingsTable({ rows, highlightAccountId, title, loading, emptyMessage }) {
  if (loading) {
    return <p className="py-3 text-center text-xs text-slate-400">Loading holdings…</p>;
  }

  if (!rows.length) {
    return <p className="py-3 text-center text-xs text-slate-400">{emptyMessage}</p>;
  }

  const total = rows.reduce((sum, r) => sum + (r.quantity ?? r.available ?? 0), 0);

  return (
    <div className="space-y-1.5">
      {title ? (
        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{title}</p>
      ) : null}
      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="min-w-full text-xs">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="px-2.5 py-1.5 text-left font-semibold uppercase tracking-wide text-slate-500">
                Account
              </th>
              <th className="px-2.5 py-1.5 text-right font-semibold uppercase tracking-wide text-slate-500">
                Qty (t)
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => {
              const qty = row.quantity ?? row.available ?? 0;
              const highlighted =
                highlightAccountId && String(row.accountId) === String(highlightAccountId);
              return (
                <tr
                  key={`${row.accountId}-${row.accountName}`}
                  className={cn(highlighted && "bg-brand/5")}
                >
                  <td className="px-2.5 py-1.5 font-medium text-slate-800">
                    {row.accountName || "—"}
                    {highlighted ? (
                      <span className="ml-1.5 rounded bg-brand/15 px-1 py-0.5 text-[9px] font-bold uppercase text-brand-ink">
                        From
                      </span>
                    ) : null}
                  </td>
                  <td className={cn("px-2.5 py-1.5 text-right tabular-nums font-semibold", qtyColor(qty))}>
                    {qty.toFixed(2)}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t border-slate-200 bg-slate-50">
              <td className="px-2.5 py-1.5 text-[10px] font-semibold uppercase text-slate-500">Total</td>
              <td className={cn("px-2.5 py-1.5 text-right text-sm font-bold tabular-nums", qtyColor(total))}>
                {total.toFixed(2)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

function LocationBreakdown({ rows, selectedLocationId, loading }) {
  if (loading) {
    return <p className="text-xs text-slate-400">Loading location breakdown…</p>;
  }

  if (!rows.length) {
    return <p className="text-xs text-slate-400">No stock found for this account and commodity.</p>;
  }

  const total = rows.reduce((sum, r) => sum + r.quantity, 0);

  return (
    <div className="space-y-1.5">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        Stock by location
      </p>
      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="min-w-full text-xs">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="px-2.5 py-1.5 text-left font-semibold uppercase tracking-wide text-slate-500">
                Location
              </th>
              <th className="px-2.5 py-1.5 text-right font-semibold uppercase tracking-wide text-slate-500">
                Qty (t)
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => {
              const selected = String(row.locationId) === String(selectedLocationId ?? "");
              return (
                <tr key={String(row.locationId)} className={cn(selected && "bg-brand/5")}>
                  <td className="px-2.5 py-1.5 font-medium text-slate-800">
                    {row.locationName}
                    {selected ? (
                      <span className="ml-1.5 rounded bg-brand/15 px-1 py-0.5 text-[9px] font-bold uppercase text-brand-ink">
                        Selected
                      </span>
                    ) : null}
                  </td>
                  <td className={cn("px-2.5 py-1.5 text-right tabular-nums font-semibold", qtyColor(row.quantity))}>
                    {row.quantity.toFixed(2)}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t border-slate-200 bg-slate-50">
              <td className="px-2.5 py-1.5 text-[10px] font-semibold uppercase text-slate-500">Total</td>
              <td className={cn("px-2.5 py-1.5 text-right text-sm font-bold tabular-nums", qtyColor(total))}>
                {total.toFixed(2)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

export default function StockVisibilityPanel({
  transferType,
  customers,
  commodities,
  locations,
  context,
}) {
  const [locationStock, setLocationStock] = useState([]);
  const [locationStockLoading, setLocationStockLoading] = useState(false);
  const [holdingsAtLocation, setHoldingsAtLocation] = useState([]);
  const [holdingsLoading, setHoldingsLoading] = useState(false);
  const [destHoldings, setDestHoldings] = useState([]);
  const [destLoading, setDestLoading] = useState(false);

  const customerName = useMemo(() => {
    const id = context?.accountId ?? context?.fromCustomerId ?? context?.customerId;
    if (!id) return "";
    const c = (customers ?? []).find((x) => String(x.id) === String(id));
    return c ? `${c.name}${c.code ? ` (${c.code})` : ""}` : "";
  }, [context, customers]);

  const commodityName = useMemo(() => {
    const id = context?.commodityId ?? context?.fromCommodityId;
    if (!id) return "";
    const c = (commodities ?? []).find((x) => String(x.id) === String(id));
    return c?.description || c?.commodityCode || "";
  }, [context, commodities]);

  const locationName = useMemo(() => {
    const id = context?.locationId ?? context?.fromLocationId;
    if (!id) return "";
    const l = (locations ?? []).find((x) => String(x.id) === String(id));
    return l?.name ?? "";
  }, [context, locations]);

  const toLocationName = useMemo(() => {
    const id = context?.toLocationId;
    if (!id) return "";
    const l = (locations ?? []).find((x) => String(x.id) === String(id));
    return l?.name ?? "";
  }, [context, locations]);

  const accountId = context?.accountId ?? context?.fromCustomerId ?? context?.customerId;
  const commodityId = context?.commodityId ?? context?.fromCommodityId;
  const locationId = context?.locationId ?? context?.fromLocationId;

  // Stock by location for account + commodity
  useEffect(() => {
    if (!accountId || !commodityId || transferType === "location") {
      setLocationStock([]);
      setLocationStockLoading(false);
      return undefined;
    }

    let cancelled = false;
    setLocationStockLoading(true);
    fetchStockByLocationForAccount({ accountId, commodityId })
      .then((rows) => {
        if (!cancelled) setLocationStock(rows);
      })
      .catch(() => {
        if (!cancelled) setLocationStock([]);
      })
      .finally(() => {
        if (!cancelled) setLocationStockLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [accountId, commodityId, transferType]);

  // Holdings at from-location + commodity
  useEffect(() => {
    if (!locationId || !commodityId) {
      setHoldingsAtLocation([]);
      setHoldingsLoading(false);
      return undefined;
    }

    let cancelled = false;
    setHoldingsLoading(true);
    fetchHoldingsAtLocation({ locationId, commodityId })
      .then((rows) => {
        if (!cancelled) {
          setHoldingsAtLocation(
            rows.map((r) => ({
              accountId: r.accountId,
              accountName: r.accountName,
              quantity: r.available,
            }))
          );
        }
      })
      .catch(() => {
        if (!cancelled) setHoldingsAtLocation([]);
      })
      .finally(() => {
        if (!cancelled) setHoldingsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [locationId, commodityId]);

  // Destination location holdings (location transfer only)
  useEffect(() => {
    if (transferType !== "location" || !context?.toLocationId || !commodityId) {
      setDestHoldings([]);
      setDestLoading(false);
      return undefined;
    }

    let cancelled = false;
    setDestLoading(true);
    fetchHoldingsAtLocation({ locationId: context.toLocationId, commodityId })
      .then((rows) => {
        if (!cancelled) {
          setDestHoldings(
            rows.map((r) => ({
              accountId: r.accountId,
              accountName: r.accountName,
              quantity: r.available,
            }))
          );
        }
      })
      .catch(() => {
        if (!cancelled) setDestHoldings([]);
      })
      .finally(() => {
        if (!cancelled) setDestLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [transferType, context?.toLocationId, commodityId]);

  const hasContext = Boolean(accountId || commodityId || locationId);
  const showAccountBreakdown = Boolean(accountId && commodityId && transferType !== "location");
  const showLocationHoldings = Boolean(locationId && commodityId);
  const showDestHoldings = Boolean(transferType === "location" && context?.toLocationId && commodityId);

  if (!transferType || !hasContext) {
    return (
      <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Stock on Hand</h2>
        <p className="mt-2 text-xs leading-relaxed text-slate-500">
          Select a customer, commodity, or location in the transfer form to see live stock balances here —
          no need to switch to Account Balances.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200/90 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-4 py-2.5">
        <h2 className="text-sm font-semibold text-slate-900">Stock on Hand</h2>
        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-slate-500">
          {customerName ? <span>Account: <strong className="text-slate-700">{customerName}</strong></span> : null}
          {commodityName ? <span>Commodity: <strong className="text-slate-700">{commodityName}</strong></span> : null}
          {locationName ? <span>Location: <strong className="text-slate-700">{locationName}</strong></span> : null}
        </div>
      </div>

      <div className="max-h-[280px] space-y-4 overflow-y-auto p-4">
        {showAccountBreakdown ? (
          <LocationBreakdown
            rows={locationStock}
            selectedLocationId={locationId}
            loading={locationStockLoading}
          />
        ) : null}

        {showLocationHoldings ? (
          <HoldingsTable
            rows={holdingsAtLocation}
            highlightAccountId={accountId}
            title={showAccountBreakdown ? `All accounts at ${locationName}` : `Accounts at ${locationName}`}
            loading={holdingsLoading}
            emptyMessage="No stock held at this location for the selected commodity."
          />
        ) : null}

        {showDestHoldings ? (
          <HoldingsTable
            rows={destHoldings}
            title={`Already at ${toLocationName} (destination)`}
            loading={destLoading}
            emptyMessage="No existing stock at the destination location."
          />
        ) : null}
      </div>
    </div>
  );
}
