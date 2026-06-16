"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { fetchAccountBalances, fetchShrinkAccounts } from "@/lib/transactions-api";
import { fetchCommodityTypesList } from "@/lib/api/reference-data";
import ClutchSelect from "@/components/custom/ClutchSelect";

const TABS = [
  { id: "byAccount", label: "By Account" },
  { id: "byCommodity", label: "By Commodity" },
  { id: "byLocation", label: "By Location" },
];

function buildMatrixPivot(rows, { getRowId, getRowName, getRowType, getColId, getColName }) {
  const rowItems = {};
  const rowTypes = {};
  const colItems = {};
  const cells = {};
  const rowTotals = {};
  let total = 0;

  rows.forEach((r) => {
    const rowId = getRowId(r);
    const colId = getColId(r);
    rowItems[rowId] = getRowName(r);
    if (getRowType) rowTypes[rowId] = getRowType(r);
    colItems[colId] = getColName(r);
    const cellKey = `${rowId}|${colId}`;
    cells[cellKey] = (cells[cellKey] || 0) + r.quantity;
    rowTotals[rowId] = (rowTotals[rowId] || 0) + r.quantity;
    total += r.quantity;
  });

  const rowIds = Object.keys(rowItems).sort((a, b) => rowItems[a].localeCompare(rowItems[b]));
  const colIds = Object.keys(colItems).sort((a, b) => colItems[a].localeCompare(colItems[b]));

  return { rowItems, rowTypes, colItems, cells, rowTotals, rowIds, colIds, total };
}

function buildAccountPivot(rows) {
  return buildMatrixPivot(rows, {
    getRowId: (r) => r.commodityId,
    getRowName: (r) => r.commodityName,
    getColId: (r) => r.locationId,
    getColName: (r) => r.locationName,
  });
}

function buildCommodityPivot(rows) {
  return buildMatrixPivot(rows, {
    getRowId: (r) => r.accountKey,
    getRowName: (r) => r.accountName,
    getRowType: (r) => r.accountType,
    getColId: (r) => r.locationId,
    getColName: (r) => r.locationName,
  });
}

function buildCommodityTotals(rows) {
  const map = {};
  let total = 0;
  let unit = "MT";

  rows.forEach((r) => {
    if (!map[r.commodityId]) {
      map[r.commodityId] = { id: r.commodityId, name: r.commodityName, quantity: 0, unit: r.unit || "MT" };
    }
    map[r.commodityId].quantity += r.quantity;
    total += r.quantity;
    unit = r.unit || unit;
  });

  const items = Object.values(map).sort((a, b) => a.name.localeCompare(b.name));
  return { items, total, unit };
}

function mapBalanceRow(row) {
  return {
    key: row.key,
    accountKey: row.accountId,
    accountName: row.accountName,
    accountType: row.accountType,
    commodityId: row.commodityId,
    commodityName: row.commodityName,
    commodityTypeId: row.commodityTypeId,
    commodityTypeName: row.commodityTypeName,
    locationId: row.locationId,
    locationName: row.locationName,
    quantity: row.quantity,
    unit: row.unit || "MT",
  };
}

const qtyColor = (q) => (q < 0 ? "text-red-600" : "text-emerald-600");

export default function AccountBalancePage() {
  const [stockRows, setStockRows] = useState([]);
  const [shrinkAccounts, setShrinkAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filterAccount, setFilterAccount] = useState("");
  const [filterCommodityType, setFilterCommodityType] = useState("");
  const [filterCommodity, setFilterCommodity] = useState("");
  const [filterLocation, setFilterLocation] = useState("");
  const [commodityTypeOptions, setCommodityTypeOptions] = useState([]);
  const [showInternal, setShowInternal] = useState(true);
  const [showZeroBalances, setShowZeroBalances] = useState(false);
  const [activeTab, setActiveTab] = useState("byAccount");
  const [expandedGroups, setExpandedGroups] = useState({});

  const toggleExpanded = (key, defaultOpen = false) =>
    setExpandedGroups((p) => ({ ...p, [key]: !(p[key] ?? defaultOpen) }));

  const loadBalances = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await fetchAccountBalances();
      setStockRows(data.map(mapBalanceRow));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load balances.");
      setStockRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBalances();
  }, [loadBalances]);

  useEffect(() => {
    fetchShrinkAccounts()
      .then((accts) => setShrinkAccounts(accts))
      .catch(() => setShrinkAccounts([]));
  }, []);

  useEffect(() => {
    fetchCommodityTypesList()
      .then((types) =>
        setCommodityTypeOptions(
          types
            .map((t) => ({ id: String(t.id), name: String(t.name ?? "") }))
            .sort((a, b) => a.name.localeCompare(b.name))
        )
      )
      .catch(() => setCommodityTypeOptions([]));
  }, []);

  const accounts = useMemo(() => {
    const map = new Map();
    stockRows.forEach((r) => map.set(r.accountKey, { key: r.accountKey, name: r.accountName }));
    // Always surface the Shrinkage account so its balance can be viewed even
    // before any shrink transactions appear in the balance data.
    shrinkAccounts.forEach((a) => {
      if (!map.has(a.key)) map.set(a.key, { key: a.key, name: a.name });
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [stockRows, shrinkAccounts]);
  const commodities = useMemo(() => {
    const map = new Map();
    stockRows.forEach((r) => {
      if (filterCommodityType && String(r.commodityTypeId) !== filterCommodityType) return;
      map.set(r.commodityId, { id: r.commodityId, name: r.commodityName });
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [stockRows, filterCommodityType]);
  const locations = useMemo(() => {
    const map = new Map();
    stockRows.forEach((r) => map.set(r.locationId, { id: r.locationId, name: r.locationName }));
    return Array.from(map.values());
  }, [stockRows]);

  const flattenedStock = useMemo(() => {
    return stockRows.filter((r) => {
      if (!showInternal && r.accountType === "internal") return false;
      if (!showZeroBalances && Math.abs(r.quantity) < 0.001) return false;
      if (filterAccount && r.accountKey !== filterAccount) return false;
      if (filterCommodityType && String(r.commodityTypeId) !== filterCommodityType) return false;
      if (filterCommodity && String(r.commodityId) !== filterCommodity) return false;
      if (filterLocation && String(r.locationId) !== filterLocation) return false;
      return true;
    });
  }, [stockRows, showInternal, showZeroBalances, filterAccount, filterCommodityType, filterCommodity, filterLocation]);

  const summaryCards = useMemo(() => {
    const totalStock = flattenedStock.reduce((s, r) => s + r.quantity, 0);
    const accountCount = new Set(flattenedStock.map((r) => r.accountKey)).size;
    const commTotals = {};
    flattenedStock.forEach((r) => { commTotals[r.commodityName] = (commTotals[r.commodityName] || 0) + r.quantity; });
    const topComm = Object.entries(commTotals).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))[0];
    return { totalStock, accountCount, topCommodity: topComm ? topComm[0] : "-" };
  }, [flattenedStock]);

  const hasActiveFilters =
    Boolean(filterAccount || filterCommodityType || filterCommodity || filterLocation || !showInternal || showZeroBalances);

  const clearFilters = () => {
    setFilterAccount("");
    setFilterCommodityType("");
    setFilterCommodity("");
    setFilterLocation("");
    setShowInternal(true);
    setShowZeroBalances(false);
  };

  const filterInsights = useMemo(() => {
    if (!filterAccount && !filterCommodityType && !filterCommodity && !filterLocation) return null;

    const total = flattenedStock.reduce((s, r) => s + r.quantity, 0);
    const accountCount = new Set(flattenedStock.map((r) => r.accountKey)).size;
    const commodityCount = new Set(flattenedStock.map((r) => r.commodityId)).size;

    const topEntry = (map) =>
      Object.entries(map).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))[0];

    if (filterAccount) {
      const name = accounts.find((a) => a.key === filterAccount)?.name ?? "Account";
      const commTotals = {};
      const locTotals = {};
      flattenedStock.forEach((r) => {
        commTotals[r.commodityName] = (commTotals[r.commodityName] || 0) + r.quantity;
        locTotals[r.locationName] = (locTotals[r.locationName] || 0) + r.quantity;
      });
      const topComm = topEntry(commTotals);
      const topLoc = topEntry(locTotals);
      return {
        title: name,
        context: "Account view",
        stats: [
          { label: "Total Stock", value: `${total.toFixed(3)} MT`, color: qtyColor(total) },
          { label: "Commodities", value: String(commodityCount) },
          { label: "Top Commodity", value: topComm ? topComm[0] : "—" },
          { label: "Top Location", value: topLoc ? topLoc[0] : "—" },
        ],
      };
    }

    if (filterCommodity) {
      const name = commodities.find((c) => String(c.id) === filterCommodity)?.name ?? "Commodity";
      const accTotals = {};
      const locTotals = {};
      flattenedStock.forEach((r) => {
        accTotals[r.accountName] = (accTotals[r.accountName] || 0) + r.quantity;
        locTotals[r.locationName] = (locTotals[r.locationName] || 0) + r.quantity;
      });
      const topAcc = topEntry(accTotals);
      const topLoc = topEntry(locTotals);
      return {
        title: name,
        context: "Commodity view",
        stats: [
          { label: "Total Stock", value: `${total.toFixed(3)} MT`, color: qtyColor(total) },
          { label: "Accounts", value: String(accountCount) },
          { label: "Top Account", value: topAcc ? topAcc[0] : "—" },
          { label: "Top Location", value: topLoc ? topLoc[0] : "—" },
        ],
      };
    }

    if (filterCommodityType) {
      const name = commodityTypeOptions.find((t) => t.id === filterCommodityType)?.name ?? "Commodity Type";
      const commTotals = {};
      const accTotals = {};
      flattenedStock.forEach((r) => {
        commTotals[r.commodityName] = (commTotals[r.commodityName] || 0) + r.quantity;
        accTotals[r.accountName] = (accTotals[r.accountName] || 0) + r.quantity;
      });
      const topComm = topEntry(commTotals);
      const topAcc = topEntry(accTotals);
      return {
        title: name,
        context: "Commodity Type view",
        stats: [
          { label: "Total Stock", value: `${total.toFixed(3)} MT`, color: qtyColor(total) },
          { label: "Commodities", value: String(commodityCount) },
          { label: "Top Commodity", value: topComm ? topComm[0] : "—" },
          { label: "Top Account", value: topAcc ? topAcc[0] : "—" },
        ],
      };
    }

    const name = locations.find((l) => String(l.id) === filterLocation)?.name ?? "Location";
    const commTotals = {};
    const accTotals = {};
    flattenedStock.forEach((r) => {
      commTotals[r.commodityName] = (commTotals[r.commodityName] || 0) + r.quantity;
      accTotals[r.accountName] = (accTotals[r.accountName] || 0) + r.quantity;
    });
    const topComm = topEntry(commTotals);
    const topAcc = topEntry(accTotals);
    return {
      title: name,
      context: "Location view",
      stats: [
        { label: "Total Stock", value: `${total.toFixed(3)} MT`, color: qtyColor(total) },
        { label: "Commodities", value: String(commodityCount) },
        { label: "Top Commodity", value: topComm ? topComm[0] : "—" },
        { label: "Top Account", value: topAcc ? topAcc[0] : "—" },
      ],
    };
  }, [flattenedStock, filterAccount, filterCommodityType, filterCommodity, filterLocation, accounts, commodities, commodityTypeOptions, locations]);

  const byAccount = useMemo(() => {
    const map = {};
    flattenedStock.forEach((r) => {
      if (!map[r.accountKey]) {
        map[r.accountKey] = { key: r.accountKey, name: r.accountName, type: r.accountType, rows: [] };
      }
      map[r.accountKey].rows.push(r);
    });
    return Object.values(map)
      .map((grp) => ({ ...grp, pivot: buildAccountPivot(grp.rows) }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [flattenedStock]);

  const byCommodity = useMemo(() => {
    const map = {};
    flattenedStock.forEach((r) => {
      if (!map[r.commodityId]) {
        map[r.commodityId] = { key: `comm-${r.commodityId}`, name: r.commodityName, unit: r.unit, rows: [] };
      }
      map[r.commodityId].rows.push(r);
    });
    return Object.values(map)
      .map((grp) => ({ ...grp, pivot: buildCommodityPivot(grp.rows) }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [flattenedStock]);

  const byLocation = useMemo(() => {
    const map = {};
    flattenedStock.forEach((r) => {
      if (!map[r.locationId]) {
        map[r.locationId] = { key: `loc-${r.locationId}`, name: r.locationName, rows: [] };
      }
      map[r.locationId].rows.push(r);
    });
    return Object.values(map)
      .map((grp) => ({ ...grp, totals: buildCommodityTotals(grp.rows) }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [flattenedStock]);

  const Badge = ({ type }) => (
    <span
      className={cn(
        "ml-1.5 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase",
        type === "customer" ? "bg-blue-50 text-blue-700" : "bg-purple-100 text-purple-800"
      )}
    >
      {type === "customer" ? "CUST" : "INT"}
    </span>
  );

  const MatrixBreakdownTable = ({ pivot, rowHeader, colHeader = "Location", showRowBadge = false }) => (
    <div className="overflow-x-auto border-t border-slate-200">
      <table className="w-full min-w-[480px] border-collapse text-sm">
        <thead>
          <tr className="bg-slate-50/80 text-left text-[11px] font-semibold uppercase text-slate-500">
            <th className="sticky left-0 z-10 bg-slate-50/95 px-3 py-2 text-left">{rowHeader}</th>
            {pivot.colIds.map((colId) => (
              <th key={colId} className="px-3 py-2 text-right whitespace-nowrap">
                {pivot.colItems[colId]}
              </th>
            ))}
            <th className="border-l border-slate-200 bg-slate-50 px-3 py-2 text-right whitespace-nowrap">
              Total
            </th>
          </tr>
        </thead>
        <tbody>
          {pivot.rowIds.map((rowId) => (
            <tr key={rowId} className="border-t border-slate-100">
              <td className="sticky left-0 z-10 bg-white px-3 py-1.5 font-medium text-slate-900">
                {pivot.rowItems[rowId]}
                {showRowBadge && pivot.rowTypes[rowId] ? <Badge type={pivot.rowTypes[rowId]} /> : null}
              </td>
              {pivot.colIds.map((colId) => {
                const v = pivot.cells[`${rowId}|${colId}`] || 0;
                return (
                  <td
                    key={colId}
                    className={cn("px-3 py-1.5 text-right tabular-nums", v ? qtyColor(v) : "text-slate-300")}
                  >
                    {Math.abs(v) >= 0.001 ? v.toFixed(3) : "—"}
                  </td>
                );
              })}
              <td className={cn("border-l border-slate-100 bg-slate-50/50 px-3 py-1.5 text-right font-semibold tabular-nums", qtyColor(pivot.rowTotals[rowId]))}>
                {pivot.rowTotals[rowId].toFixed(3)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const CommodityTotalsTable = ({ items }) => (
    <div className="overflow-x-auto border-t border-slate-200">
      <table className="w-full min-w-[320px] border-collapse text-sm">
        <thead>
          <tr className="bg-slate-50/80 text-left text-[11px] font-semibold uppercase text-slate-500">
            <th className="px-3 py-2">Commodity</th>
            <th className="border-l border-slate-200 bg-slate-50 px-3 py-2 text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} className="border-t border-slate-100">
              <td className="px-3 py-1.5 font-medium text-slate-900">{item.name}</td>
              <td className={cn("border-l border-slate-100 bg-slate-50/50 px-3 py-1.5 text-right font-semibold tabular-nums", qtyColor(item.quantity))}>
                {item.quantity.toFixed(3)} {item.unit}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const GroupCard = ({ groupKey, defaultOpen, title, badge, total, unit = "MT", children }) => {
    const isExp = expandedGroups[groupKey] ?? defaultOpen;
    return (
      <div className="overflow-hidden rounded-md border border-slate-200 bg-white transition-colors hover:border-slate-300">
        <button
          type="button"
          onClick={() => toggleExpanded(groupKey, defaultOpen)}
          className="flex w-full cursor-pointer items-center justify-between gap-3 px-3 py-2.5 text-left transition-colors hover:bg-slate-50/80"
        >
          <span className="flex min-w-0 items-center truncate text-sm font-medium text-slate-900">
            <span className="mr-1.5 shrink-0 text-[10px] text-slate-400">{isExp ? "▼" : "▶"}</span>
            <span className="truncate">{title}</span>
            {badge ? <Badge type={badge} /> : null}
          </span>
          <span className={cn("shrink-0 text-sm font-semibold tabular-nums", qtyColor(total))}>
            {total.toFixed(3)} {unit}
          </span>
        </button>
        {isExp ? children : null}
      </div>
    );
  };

  const EmptyState = () => (
    <p className="py-8 text-center text-sm text-slate-500">No stock balances match the current filters.</p>
  );

  const TabPanel = ({ children }) => <div className="p-3 space-y-2">{children}</div>;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs text-slate-500">Stock Management / Account Balances</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">Stock on Hand</h1>
        </div>
        <Link href="/stock-management/all-transactions" className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50">View Transactions</Link>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>
      ) : null}
      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 shadow-sm">
          Loading account balances...
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-[11px] font-semibold text-slate-500">Total Stock</p>
          <p className={cn("mt-1 text-xl font-bold", qtyColor(summaryCards.totalStock))}>{summaryCards.totalStock.toFixed(2)} MT</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-[11px] font-semibold text-slate-500">Accounts with Stock</p>
          <p className="mt-1 text-xl font-bold text-slate-900">{summaryCards.accountCount}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          {filterInsights ? (
            <>
              <p className="text-[11px] font-semibold text-slate-500">{filterInsights.context}</p>
              <p className="mt-1 truncate text-sm font-bold text-slate-900" title={filterInsights.title}>{filterInsights.title}</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {filterInsights.stats.map((stat) => (
                  <div key={stat.label}>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{stat.label}</p>
                    <p className={cn("mt-0.5 truncate text-sm font-bold tabular-nums", stat.color ?? "text-slate-900")} title={stat.value}>
                      {stat.value}
                    </p>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <>
              <p className="text-[11px] font-semibold text-slate-500">Top Commodity by Volume</p>
              <p className="mt-1 text-sm font-bold text-slate-900">{summaryCards.topCommodity}</p>
            </>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="min-w-0">
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Account</label>
            <ClutchSelect
              options={accounts.map((c) => ({ value: c.key, label: c.name }))}
              value={accounts.map((c) => ({ value: c.key, label: c.name })).find((o) => o.value === filterAccount) ?? null}
              onChange={(option) => setFilterAccount(option ? option.value : "")}
              placeholder="All Accounts"
              className="w-full"
            />
          </div>
          <div className="min-w-0">
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Commodity Type</label>
            <ClutchSelect
              options={commodityTypeOptions.map((t) => ({ value: t.id, label: t.name }))}
              value={commodityTypeOptions.map((t) => ({ value: t.id, label: t.name })).find((o) => o.value === filterCommodityType) ?? null}
              onChange={(option) => {
                const nextType = option ? option.value : "";
                setFilterCommodityType(nextType);
                if (nextType && filterCommodity) {
                  const stillValid = stockRows.some(
                    (r) => String(r.commodityId) === filterCommodity && String(r.commodityTypeId) === nextType
                  );
                  if (!stillValid) setFilterCommodity("");
                }
              }}
              placeholder="All Commodity Types"
              className="w-full"
            />
          </div>
          <div className="min-w-0">
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Commodity</label>
            <ClutchSelect
              options={commodities.map((c) => ({ value: String(c.id), label: c.name }))}
              value={commodities.map((c) => ({ value: String(c.id), label: c.name })).find((o) => o.value === filterCommodity) ?? null}
              onChange={(option) => setFilterCommodity(option ? option.value : "")}
              placeholder="All Commodities"
              className="w-full"
            />
          </div>
          <div className="min-w-0">
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Location</label>
            <ClutchSelect
              options={locations.map((l) => ({ value: String(l.id), label: l.name }))}
              value={locations.map((l) => ({ value: String(l.id), label: l.name })).find((o) => o.value === filterLocation) ?? null}
              onChange={(option) => setFilterLocation(option ? option.value : "")}
              placeholder="All Locations"
              className="w-full"
            />
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-4">
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input suppressHydrationWarning type="checkbox" checked={showInternal} onChange={(e) => setShowInternal(e.target.checked)} />
            Show Internal
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input suppressHydrationWarning type="checkbox" checked={showZeroBalances} onChange={(e) => setShowZeroBalances(e.target.checked)} />
            Show Zero Balances
          </label>
          {hasActiveFilters ? (
            <button
              type="button"
              onClick={clearFilters}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
            >
              Clear Filters
            </button>
          ) : null}
          <span className="ml-auto text-sm text-slate-500">{flattenedStock.length} position(s)</span>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto border-b border-slate-200">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={cn("px-4 py-2 text-sm font-semibold transition-colors", activeTab === t.id ? "border-b-2 border-slate-900 text-slate-900" : "text-slate-500 hover:text-slate-700")}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-auto" style={{ maxHeight: "60vh" }}>

          {activeTab === "byAccount" && (
            <TabPanel>
              {byAccount.length === 0 ? <EmptyState /> : byAccount.map((grp) => (
                <GroupCard
                  key={grp.key}
                  groupKey={grp.key}
                  defaultOpen={grp.type !== "customer"}
                  title={grp.name}
                  badge={grp.type}
                  total={grp.pivot.total}
                >
                  <MatrixBreakdownTable pivot={grp.pivot} rowHeader="Commodity" colHeader="Location" />
                </GroupCard>
              ))}
            </TabPanel>
          )}

          {activeTab === "byCommodity" && (
            <TabPanel>
              {byCommodity.length === 0 ? <EmptyState /> : byCommodity.map((grp) => (
                <GroupCard
                  key={grp.key}
                  groupKey={grp.key}
                  defaultOpen={false}
                  title={grp.name}
                  total={grp.pivot.total}
                  unit={grp.unit}
                >
                  <MatrixBreakdownTable pivot={grp.pivot} rowHeader="Account" colHeader="Location" showRowBadge />
                </GroupCard>
              ))}
            </TabPanel>
          )}

          {activeTab === "byLocation" && (
            <TabPanel>
              {byLocation.length === 0 ? <EmptyState /> : byLocation.map((grp) => (
                <GroupCard
                  key={grp.key}
                  groupKey={grp.key}
                  defaultOpen={false}
                  title={grp.name}
                  total={grp.totals.total}
                  unit={grp.totals.unit}
                >
                  <CommodityTotalsTable items={grp.totals.items} />
                </GroupCard>
              ))}
            </TabPanel>
          )}

        </div>
      </div>
    </div>
  );
}
