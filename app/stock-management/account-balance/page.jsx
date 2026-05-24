"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import Link from "next/link";
import { Grid } from "@/components/clutch-table";
import { cn } from "@/lib/utils";
import { fetchAccountBalances } from "@/lib/transactions-api";

const inputClass =
  "w-full rounded-lg border border-slate-200/95 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-brand/15 placeholder:text-slate-400 focus:border-brand/35 focus:ring-2";

const TABS = [
  { id: "detail", label: "Detail" },
  { id: "byAccount", label: "By Account" },
  { id: "byCommodity", label: "By Commodity" },
  { id: "byLocation", label: "By Location" },
  { id: "pivot", label: "Pivot" },
];

function mapBalanceRow(row) {
  return {
    key: row.key,
    accountKey: row.accountId,
    accountName: row.accountName,
    accountType: row.accountType,
    commodityId: row.commodityId,
    commodityName: row.commodityName,
    locationId: row.locationId,
    locationName: row.locationName,
    quantity: row.quantity,
    unit: row.unit || "MT",
  };
}

export default function AccountBalancePage() {
  const [stockRows, setStockRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filterAccount, setFilterAccount] = useState("");
  const [filterCommodity, setFilterCommodity] = useState("");
  const [filterLocation, setFilterLocation] = useState("");
  const [showInternal, setShowInternal] = useState(true);
  const [showZeroBalances, setShowZeroBalances] = useState(false);
  const [activeTab, setActiveTab] = useState("detail");
  const [expandedGroups, setExpandedGroups] = useState({});

  const toggleExpanded = (key) => setExpandedGroups((p) => ({ ...p, [key]: !p[key] }));

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

  /* Derived lookup arrays for filters */
  const accounts = useMemo(() => {
    const map = new Map();
    stockRows.forEach((r) => map.set(r.accountKey, { key: r.accountKey, name: r.accountName }));
    return Array.from(map.values());
  }, [stockRows]);
  const commodities = useMemo(() => {
    const map = new Map();
    stockRows.forEach((r) => map.set(r.commodityId, { id: r.commodityId, name: r.commodityName }));
    return Array.from(map.values());
  }, [stockRows]);
  const locations = useMemo(() => {
    const map = new Map();
    stockRows.forEach((r) => map.set(r.locationId, { id: r.locationId, name: r.locationName }));
    return Array.from(map.values());
  }, [stockRows]);

  /* Filter logic */
  const flattenedStock = useMemo(() => {
    return stockRows.filter((r) => {
      if (!showInternal && r.accountType === "internal") return false;
      if (!showZeroBalances && Math.abs(r.quantity) < 0.001) return false;
      if (filterAccount && r.accountKey !== filterAccount) return false;
      if (filterCommodity && String(r.commodityId) !== filterCommodity) return false;
      if (filterLocation && String(r.locationId) !== filterLocation) return false;
      return true;
    });
  }, [stockRows, showInternal, showZeroBalances, filterAccount, filterCommodity, filterLocation]);

  /* Summary Cards */
  const summaryCards = useMemo(() => {
    const totalStock = flattenedStock.reduce((s, r) => s + r.quantity, 0);
    const accountCount = new Set(flattenedStock.map((r) => r.accountKey)).size;
    const commTotals = {};
    flattenedStock.forEach((r) => { commTotals[r.commodityName] = (commTotals[r.commodityName] || 0) + r.quantity; });
    const topComm = Object.entries(commTotals).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))[0];
    return { totalStock, accountCount, topCommodity: topComm ? topComm[0] : "-" };
  }, [flattenedStock]);

  /* Groupings */
  const byAccount = useMemo(() => {
    const map = {};
    flattenedStock.forEach((r) => {
      if (!map[r.accountKey]) map[r.accountKey] = { key: r.accountKey, name: r.accountName, type: r.accountType, total: 0, rows: [] };
      map[r.accountKey].total += r.quantity;
      map[r.accountKey].rows.push(r);
    });
    return Object.values(map).sort((a, b) => a.name.localeCompare(b.name));
  }, [flattenedStock]);

  const byCommodity = useMemo(() => {
    const map = {};
    flattenedStock.forEach((r) => {
      if (!map[r.commodityId]) map[r.commodityId] = { key: `comm-${r.commodityId}`, name: r.commodityName, unit: r.unit, total: 0, rows: [] };
      map[r.commodityId].total += r.quantity;
      map[r.commodityId].rows.push(r);
    });
    return Object.values(map).sort((a, b) => a.name.localeCompare(b.name));
  }, [flattenedStock]);

  const byLocation = useMemo(() => {
    const map = {};
    flattenedStock.forEach((r) => {
      if (!map[r.locationId]) map[r.locationId] = { key: `loc-${r.locationId}`, name: r.locationName, total: 0, rows: [] };
      map[r.locationId].total += r.quantity;
      map[r.locationId].rows.push(r);
    });
    return Object.values(map).sort((a, b) => a.name.localeCompare(b.name));
  }, [flattenedStock]);

  /* Pivot */
  const pivotData = useMemo(() => {
    const accs = [...new Set(flattenedStock.map((r) => r.accountKey))];
    const locs = [...new Set(flattenedStock.map((r) => r.locationId))];
    const accNames = {}; const accTypes = {}; const locNames = {};
    const cells = {}; const rowT = {}; const colT = {}; let grand = 0;

    flattenedStock.forEach((r) => {
      accNames[r.accountKey] = r.accountName;
      accTypes[r.accountKey] = r.accountType;
      locNames[r.locationId] = r.locationName;
      const k = `${r.accountKey}|${r.locationId}`;
      cells[k] = (cells[k] || 0) + r.quantity;
    });

    accs.forEach((a) => {
      rowT[a] = 0;
      locs.forEach((l) => {
        const v = cells[`${a}|${l}`] || 0;
        rowT[a] += v;
        colT[l] = (colT[l] || 0) + v;
        grand += v;
      });
    });

    return { accs, locs, accNames, accTypes, locNames, cells, rowT, colT, grand };
  }, [flattenedStock]);

  /* Grid Columns for Detail View */
  const gridColumns = useMemo(() => [
    { key: "accountDisplay", header: "Account", type: "text", sortable: true, filterable: true, resizable: true },
    { key: "commodityName", header: "Commodity", type: "text", sortable: true, filterable: true, resizable: true },
    { key: "locationName", header: "Location", type: "text", sortable: true, filterable: true, resizable: true },
    { key: "quantityDisplay", header: "Quantity", type: "text", sortable: true, filterable: true, resizable: true },
  ], []);

  const gridRows = useMemo(() => flattenedStock.map((r) => ({
    ...r,
    id: r.key,
    accountDisplay: `${r.accountName} (${r.accountType === 'customer' ? 'CUST' : 'INT'})`,
    quantityDisplay: `${r.quantity.toFixed(3)} ${r.unit}`
  })), [flattenedStock]);

  const qtyColor = (q) => (q < 0 ? "text-red-600" : "text-emerald-600");
  const Badge = ({ type }) => (
    <span className={cn("ml-2 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase", type === "customer" ? "bg-blue-100 text-blue-800" : "bg-purple-100 text-purple-800")}>
      {type === "customer" ? "CUST" : "INT"}
    </span>
  );

  return (
    <div className="space-y-5">
      {/* Header */}
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

      {/* Summary Cards */}
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
          <p className="text-[11px] font-semibold text-slate-500">Top Commodity by Volume</p>
          <p className="mt-1 text-sm font-bold text-slate-900">{summaryCards.topCommodity}</p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <select suppressHydrationWarning className={cn(inputClass, "w-40")} value={filterAccount} onChange={(e) => setFilterAccount(e.target.value)}>
          <option value="">All Accounts</option>
          {accounts.map((c) => <option key={c.key} value={c.key}>{c.name}</option>)}
        </select>
        <select suppressHydrationWarning className={cn(inputClass, "w-40")} value={filterCommodity} onChange={(e) => setFilterCommodity(e.target.value)}>
          <option value="">All Commodities</option>
          {commodities.map((c) => <option key={c.id} value={String(c.id)}>{c.name}</option>)}
        </select>
        <select suppressHydrationWarning className={cn(inputClass, "w-40")} value={filterLocation} onChange={(e) => setFilterLocation(e.target.value)}>
          <option value="">All Locations</option>
          {locations.map((l) => <option key={l.id} value={String(l.id)}>{l.name}</option>)}
        </select>

        <div className="flex items-center gap-4 text-sm">
          <label className="flex cursor-pointer items-center gap-2"><input suppressHydrationWarning type="checkbox" checked={showInternal} onChange={(e) => setShowInternal(e.target.checked)} /> Show Internal</label>
          <label className="flex cursor-pointer items-center gap-2"><input suppressHydrationWarning type="checkbox" checked={showZeroBalances} onChange={(e) => setShowZeroBalances(e.target.checked)} /> Show Zero Balances</label>
        </div>

        <div className="ml-auto text-sm text-slate-500">{flattenedStock.length} record(s) found</div>
      </div>

      {/* Tabs */}
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

      {/* Content */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-auto" style={{ maxHeight: "60vh" }}>
          
          {/* Detail View (Grid) */}
          {activeTab === "detail" && (
            <Grid columns={gridColumns} rows={gridRows} getRowId={(r) => r.id} theme="light" density="standard" fileName="Stock Detail" visibleRows={15} />
          )}

          {/* By Account */}
          {activeTab === "byAccount" && (
            <div className="p-4">
              {byAccount.map((grp) => {
                const isExp = expandedGroups[grp.key];
                return (
                  <div key={grp.key} className="mb-4 overflow-hidden rounded-lg border border-slate-200">
                    <div onClick={() => toggleExpanded(grp.key)} className="flex cursor-pointer items-center justify-between bg-slate-50 p-3 hover:bg-slate-100">
                      <span className="font-semibold text-slate-900"><span className="mr-2 text-[10px] text-slate-500">{isExp ? "â–¼" : "â–¶"}</span>{grp.name} <Badge type={grp.type} /></span>
                      <span className={cn("font-bold", qtyColor(grp.total))}>{grp.total.toFixed(3)} MT</span>
                    </div>
                    {isExp && (
                      <table className="w-full border-t border-slate-200 text-sm">
                        <thead className="bg-slate-50/50 text-left text-[11px] font-semibold uppercase text-slate-500">
                          <tr><th className="px-6 py-2">Commodity</th><th className="px-4 py-2">Location</th><th className="px-4 py-2 text-right">Quantity</th></tr>
                        </thead>
                        <tbody>
                          {grp.rows.map(r => (
                            <tr key={r.key} className="border-t border-slate-100">
                              <td className="px-6 py-2">{r.commodityName}</td>
                              <td className="px-4 py-2">{r.locationName}</td>
                              <td className={cn("px-4 py-2 text-right font-semibold", qtyColor(r.quantity))}>{r.quantity.toFixed(3)} {r.unit}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* By Commodity */}
          {activeTab === "byCommodity" && (
            <div className="p-4">
              {byCommodity.map((grp) => {
                const isExp = expandedGroups[grp.key];
                return (
                  <div key={grp.key} className="mb-4 overflow-hidden rounded-lg border border-slate-200">
                    <div onClick={() => toggleExpanded(grp.key)} className="flex cursor-pointer items-center justify-between bg-slate-50 p-3 hover:bg-slate-100">
                      <span className="font-semibold text-slate-900"><span className="mr-2 text-[10px] text-slate-500">{isExp ? "â–¼" : "â–¶"}</span>{grp.name}</span>
                      <span className={cn("font-bold", qtyColor(grp.total))}>{grp.total.toFixed(3)} {grp.unit}</span>
                    </div>
                    {isExp && (
                      <table className="w-full border-t border-slate-200 text-sm">
                        <thead className="bg-slate-50/50 text-left text-[11px] font-semibold uppercase text-slate-500">
                          <tr><th className="px-6 py-2">Account</th><th className="px-4 py-2">Location</th><th className="px-4 py-2 text-right">Quantity</th></tr>
                        </thead>
                        <tbody>
                          {grp.rows.map(r => (
                            <tr key={r.key} className="border-t border-slate-100">
                              <td className="px-6 py-2 font-medium">{r.accountName} <Badge type={r.accountType} /></td>
                              <td className="px-4 py-2">{r.locationName}</td>
                              <td className={cn("px-4 py-2 text-right font-semibold", qtyColor(r.quantity))}>{r.quantity.toFixed(3)} {r.unit}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* By Location */}
          {activeTab === "byLocation" && (
            <div className="p-4">
              {byLocation.map((grp) => {
                const isExp = expandedGroups[grp.key];
                return (
                  <div key={grp.key} className="mb-4 overflow-hidden rounded-lg border border-slate-200">
                    <div onClick={() => toggleExpanded(grp.key)} className="flex cursor-pointer items-center justify-between bg-slate-50 p-3 hover:bg-slate-100">
                      <span className="font-semibold text-slate-900"><span className="mr-2 text-[10px] text-slate-500">{isExp ? "â–¼" : "â–¶"}</span>{grp.name}</span>
                      <span className={cn("font-bold", qtyColor(grp.total))}>{grp.total.toFixed(3)} MT</span>
                    </div>
                    {isExp && (
                      <table className="w-full border-t border-slate-200 text-sm">
                        <thead className="bg-slate-50/50 text-left text-[11px] font-semibold uppercase text-slate-500">
                          <tr><th className="px-6 py-2">Account</th><th className="px-4 py-2">Commodity</th><th className="px-4 py-2 text-right">Quantity</th></tr>
                        </thead>
                        <tbody>
                          {grp.rows.map(r => (
                            <tr key={r.key} className="border-t border-slate-100">
                              <td className="px-6 py-2 font-medium">{r.accountName} <Badge type={r.accountType} /></td>
                              <td className="px-4 py-2">{r.commodityName}</td>
                              <td className={cn("px-4 py-2 text-right font-semibold", qtyColor(r.quantity))}>{r.quantity.toFixed(3)} {r.unit}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Pivot Matrix */}
          {activeTab === "pivot" && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px] border-collapse text-sm">
                <thead>
                  <tr className="border-b-2 border-slate-200 bg-slate-50 text-left text-[11px] font-bold uppercase text-slate-500">
                    <th className="p-3">Account</th>
                    {pivotData.locs.map(l => <th key={l} className="p-3 text-right">{pivotData.locNames[l]}</th>)}
                    <th className="bg-slate-100 p-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {pivotData.accs.map(a => (
                    <tr key={a} className="border-b border-slate-100">
                      <td className="p-3 font-semibold">{pivotData.accNames[a]} <Badge type={pivotData.accTypes[a]} /></td>
                      {pivotData.locs.map(l => {
                        const v = pivotData.cells[`${a}|${l}`] || 0;
                        return <td key={l} className={cn("p-3 text-right font-medium", qtyColor(v))}>{v ? v.toFixed(2) : "â€”"}</td>;
                      })}
                      <td className={cn("bg-slate-50 p-3 text-right font-bold", qtyColor(pivotData.rowT[a]))}>{pivotData.rowT[a].toFixed(2)}</td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-slate-200 bg-slate-50 font-bold">
                    <td className="p-3">Total</td>
                    {pivotData.locs.map(l => <td key={l} className={cn("p-3 text-right", qtyColor(pivotData.colT[l]))}>{pivotData.colT[l].toFixed(2)}</td>)}
                    <td className={cn("bg-slate-100 p-3 text-right", qtyColor(pivotData.grand))}>{pivotData.grand.toFixed(2)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}