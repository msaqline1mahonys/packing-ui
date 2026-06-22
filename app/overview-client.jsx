"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Calendar,
  Container,
  Package,
  RefreshCw,
  Scale,
  Ticket,
  Warehouse,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { readAuthPayload } from "@/lib/auth-session";
import {
  countBySeverity,
  fetchDashboard,
  groupAlertsByCategory,
  SEVERITY_LABELS,
} from "@/lib/dashboard-alerts";
import { formatMt } from "@/lib/dashboard-metrics";
import { stageBadgeClass } from "@/lib/packing-container-ui";
import { SITE_CHANGED_EVENT } from "@/lib/site-switch";
import { cn } from "@/lib/utils";

const QUICK_LINKS = [
  { title: "Packing schedule", href: "/packing-schedule" },
  { title: "Packers schedule", href: "/packers-schedule" },
  { title: "Ticketing", href: "/ticketing" },
  { title: "Packing", href: "/packing" },
  { title: "Transactions", href: "/stock-management/all-transactions" },
  { title: "Fumigation", href: "/fumigation" },
];

const EMPTY_METRICS = {
  today: "",
  flow: {
    tonsInToday: 0,
    tonsOutTicketsToday: 0,
    tonsPackedToday: 0,
    openTicketsIn: 0,
    openTicketsOut: 0,
    openTonsIn: 0,
    openTonsOut: 0,
  },
  throughput: {
    ticketsCompletedToday: 0,
    ticketsOpenToday: 0,
    containersPackedToday: 0,
    containersInPipeline: 0,
    containersWithNumber: 0,
    containersByStage: {},
    pipelinePackedCount: 0,
    pipelinePackedMt: 0,
    activePackCount: 0,
    activePackMt: 0,
  },
  stock: {
    totalStockMt: 0,
    negativeBalanceCount: 0,
    negativeCustomerCount: 0,
    negativeCommodityCount: 0,
    negativeAccounts: [],
    negativeCommodities: [],
    topLocations: [],
  },
};

function severityBadgeClass(severity) {
  switch (severity) {
    case "critical":
      return "bg-rose-100 text-rose-800 ring-1 ring-rose-200";
    case "due_soon":
      return "bg-amber-100 text-amber-900 ring-1 ring-amber-200";
    default:
      return "bg-slate-100 text-slate-700 ring-1 ring-slate-200";
  }
}

function formatToday() {
  return new Date().toLocaleDateString("en-AU", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function readSiteName() {
  const payload = readAuthPayload();
  return (
    payload?.current_site?.name ??
    payload?.currentSite?.name ??
    payload?.organization?.name ??
    ""
  );
}

function qtyColor(qty) {
  return qty < 0 ? "text-rose-700" : "text-emerald-700";
}

function MetricCard({ label, value, sub, href, loading, valueClassName }) {
  const inner = (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className={cn("mt-1 text-2xl font-bold tabular-nums text-slate-900", valueClassName)}>
        {loading ? "—" : value}
      </p>
      {sub ? <p className="mt-1 text-xs text-slate-500">{sub}</p> : null}
    </div>
  );

  if (!href || loading) return inner;
  return (
    <Link href={href} className="block transition-colors hover:border-brand/30">
      {inner}
    </Link>
  );
}

function FlowBar({ inMt, outMt, loading }) {
  const total = inMt + outMt;
  const inPct = total > 0 ? (inMt / total) * 100 : 50;
  const outPct = total > 0 ? (outMt / total) * 100 : 50;

  return (
    <div className="space-y-3">
      <div className="flex h-3 overflow-hidden rounded-full bg-slate-100">
        {!loading && total > 0 ? (
          <>
            <div className="bg-emerald-500 transition-all" style={{ width: `${inPct}%` }} />
            <div className="bg-blue-500 transition-all" style={{ width: `${outPct}%` }} />
          </>
        ) : (
          <div className="w-full animate-pulse bg-slate-200" />
        )}
      </div>
      <div className="flex flex-wrap justify-between gap-3 text-sm">
        <div className="flex items-center gap-2">
          <span className="size-2.5 rounded-full bg-emerald-500" />
          <span className="text-slate-600">
            Received{" "}
            <span className="font-semibold text-slate-900">
              {loading ? "—" : `${formatMt(inMt)} MT`}
            </span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="size-2.5 rounded-full bg-blue-500" />
          <span className="text-slate-600">
            Packed out{" "}
            <span className="font-semibold text-slate-900">
              {loading ? "—" : `${formatMt(outMt)} MT`}
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}

function SummaryStrip({ counts, loading }) {
  const items = [
    { key: "critical", label: SEVERITY_LABELS.critical, className: "text-rose-700" },
    { key: "due_soon", label: SEVERITY_LABELS.due_soon, className: "text-amber-800" },
    { key: "info", label: SEVERITY_LABELS.info, className: "text-slate-700" },
  ];

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {items.map((item) => (
        <div
          key={item.key}
          className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
        >
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            {item.label}
          </p>
          <p className={cn("mt-1 text-2xl font-bold tabular-nums", item.className)}>
            {loading ? "—" : counts[item.key]}
          </p>
        </div>
      ))}
    </div>
  );
}

function AlertRow({ alert }) {
  return (
    <Link
      href={alert.href}
      className="group flex items-start justify-between gap-4 rounded-lg border border-slate-100 bg-slate-50/60 px-4 py-3 transition-colors hover:border-brand/30 hover:bg-white"
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
              severityBadgeClass(alert.severity),
            )}
          >
            {SEVERITY_LABELS[alert.severity] ?? alert.severity}
          </span>
          <span className="text-sm font-medium text-slate-900">{alert.title}</span>
        </div>
        <p className="mt-1 text-sm text-slate-600">{alert.detail}</p>
      </div>
      <ArrowRight className="mt-0.5 size-4 shrink-0 text-slate-400 transition-colors group-hover:text-brand" />
    </Link>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3, 4].map((n) => (
        <div
          key={n}
          className="h-16 animate-pulse rounded-lg border border-slate-100 bg-slate-100/80"
        />
      ))}
    </div>
  );
}

function OperationsPanels({ metrics, permissions, loading }) {
  const { flow, throughput, stock } = metrics;
  const showFlow = permissions.ticketing || permissions.packing;
  const showStock = permissions.stock;

  if (!showFlow && !showStock) return null;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {showFlow ? (
        <section className="rounded-2xl border border-slate-200/95 bg-white/90 p-5 shadow-sm sm:p-6">
          <div className="mb-4 flex items-center gap-2">
            <Scale className="size-4 text-brand" strokeWidth={1.5} />
            <h2 className="text-lg font-medium text-slate-900">Today&apos;s grain flow</h2>
          </div>
          <FlowBar
            inMt={flow.tonsInToday}
            outMt={flow.tonsPackedToday}
            loading={loading}
          />
          <div className="mt-5 grid grid-cols-2 gap-3">
            <MetricCard
              label="Tickets completed"
              value={throughput.ticketsCompletedToday}
              sub={`${throughput.ticketsOpenToday} open today`}
              href="/ticketing"
              loading={loading}
            />
            <MetricCard
              label="Containers packed"
              value={throughput.containersPackedToday}
              sub={`${throughput.containersInPipeline} in pipeline`}
              href="/packing-schedule/containers"
              loading={loading}
            />
          </div>
          <div className="mt-4 rounded-lg border border-slate-100 bg-slate-50/70 px-4 py-3 text-sm text-slate-600">
            <span className="font-medium text-slate-800">Open tickets:</span>{" "}
            {loading
              ? "—"
              : `${flow.openTicketsIn} in (${formatMt(flow.openTonsIn)} MT) · ${flow.openTicketsOut} out (${formatMt(flow.openTonsOut)} MT)`}
          </div>
        </section>
      ) : null}

      {permissions.packing ? (
        <section className="rounded-2xl border border-slate-200/95 bg-white/90 p-5 shadow-sm sm:p-6">
          <div className="mb-4 flex items-center gap-2">
            <Container className="size-4 text-brand" strokeWidth={1.5} />
            <h2 className="text-lg font-medium text-slate-900">Packing pipeline</h2>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <MetricCard
              label="Active packs"
              value={throughput.activePackCount}
              sub={`${formatMt(throughput.activePackMt)} MT scheduled`}
              href="/packing-schedule"
              loading={loading}
            />
            <MetricCard
              label="Loaded today"
              value={`${throughput.pipelinePackedCount}/${throughput.containersWithNumber}`}
              sub={`${formatMt(throughput.pipelinePackedMt)} MT packed (in progress)`}
              href="/packers-schedule"
              loading={loading}
            />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {Object.entries(throughput.containersByStage)
              .filter(([, count]) => count > 0)
              .map(([stage, count]) => (
                <span
                  key={stage}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium",
                    stageBadgeClass(stage),
                  )}
                >
                  {stage}
                  <span className="font-bold tabular-nums">{loading ? "—" : count}</span>
                </span>
              ))}
          </div>
        </section>
      ) : null}

      {showStock ? (
        <section className="rounded-2xl border border-slate-200/95 bg-white/90 p-5 shadow-sm sm:p-6 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Warehouse className="size-4 text-brand" strokeWidth={1.5} />
              <h2 className="text-lg font-medium text-slate-900">Stock on hand</h2>
            </div>
            <Link
              href="/stock-management/account-balance"
              className="text-xs font-medium text-brand hover:underline"
            >
              View balances
            </Link>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <MetricCard
              label="Total stock"
              value={`${formatMt(stock.totalStockMt)} MT`}
              href="/stock-management/account-balance"
              loading={loading}
            />
            <MetricCard
              label="Negative customers"
              value={stock.negativeCustomerCount}
              sub={`${stock.negativeBalanceCount} balance lines < 0`}
              href="/stock-management/account-balance"
              loading={loading}
              valueClassName={stock.negativeCustomerCount > 0 ? "text-rose-700" : undefined}
            />
            <MetricCard
              label="Negative commodities"
              value={stock.negativeCommodityCount}
              href="/stock-management/account-balance"
              loading={loading}
              valueClassName={stock.negativeCommodityCount > 0 ? "text-rose-700" : undefined}
            />
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            <div>
              <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Top stock locations
              </h3>
              {loading ? (
                <div className="h-24 animate-pulse rounded-lg bg-slate-100" />
              ) : stock.topLocations.length ? (
                <ul className="space-y-2">
                  {stock.topLocations.map((loc) => (
                    <li
                      key={loc.id}
                      className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 px-3 py-2 text-sm"
                    >
                      <span className="font-medium text-slate-800">{loc.name}</span>
                      <span className="tabular-nums text-slate-600">
                        {formatMt(loc.totalStock)} MT
                        {loc.utilizationPct != null ? (
                          <span className="ml-2 text-xs text-slate-400">
                            ({Math.round(loc.utilizationPct)}% full)
                          </span>
                        ) : null}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-slate-500">No location stock data.</p>
              )}
            </div>

            <div>
              <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Negative balances
              </h3>
              {loading ? (
                <div className="h-24 animate-pulse rounded-lg bg-slate-100" />
              ) : stock.negativeAccounts.length || stock.negativeCommodities.length ? (
                <ul className="space-y-2">
                  {stock.negativeAccounts.slice(0, 5).map((row) => (
                    <li
                      key={`acct-${row.key}`}
                      className="flex items-center justify-between gap-3 rounded-lg border border-rose-100 bg-rose-50/50 px-3 py-2 text-sm"
                    >
                      <span className="text-slate-800">{row.name}</span>
                      <span className={cn("font-semibold tabular-nums", qtyColor(row.quantity))}>
                        {formatMt(row.quantity)} MT
                      </span>
                    </li>
                  ))}
                  {stock.negativeCommodities.slice(0, 3).map((row) => (
                    <li
                      key={`comm-${row.key}`}
                      className="flex items-center justify-between gap-3 rounded-lg border border-rose-100 bg-rose-50/50 px-3 py-2 text-sm"
                    >
                      <span className="text-slate-800">{row.name}</span>
                      <span className={cn("font-semibold tabular-nums", qtyColor(row.quantity))}>
                        {formatMt(row.quantity)} MT
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-emerald-700">No negative balances.</p>
              )}
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}

export default function OverviewClient() {
  const [alerts, setAlerts] = useState([]);
  const [metrics, setMetrics] = useState(EMPTY_METRICS);
  const [errors, setErrors] = useState({ packing: null, ticketing: null, stock: null });
  const [permissions, setPermissions] = useState({
    packing: false,
    ticketing: false,
    stock: false,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [siteName, setSiteName] = useState("");
  const [todayLabel, setTodayLabel] = useState("");

  useEffect(() => {
    const syncHeader = () => {
      setSiteName(readSiteName());
      setTodayLabel(formatToday());
    };
    syncHeader();
    window.addEventListener(SITE_CHANGED_EVENT, syncHeader);
    window.addEventListener("auth-session-changed", syncHeader);
    return () => {
      window.removeEventListener(SITE_CHANGED_EVENT, syncHeader);
      window.removeEventListener("auth-session-changed", syncHeader);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    fetchDashboard()
      .then((result) => {
        if (cancelled) return;
        setAlerts(result.alerts);
        setMetrics(result.metrics ?? EMPTY_METRICS);
        setErrors(result.errors);
        setPermissions(result.permissions);
      })
      .catch(() => {
        if (cancelled) return;
        setAlerts([]);
        setMetrics(EMPTY_METRICS);
        setErrors({ packing: "Failed to load dashboard.", ticketing: null, stock: null });
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
        setRefreshing(false);
      });

    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  useEffect(() => {
    const onSiteChanged = () => {
      setRefreshing(true);
      setRefreshKey((key) => key + 1);
    };
    window.addEventListener(SITE_CHANGED_EVENT, onSiteChanged);
    return () => window.removeEventListener(SITE_CHANGED_EVENT, onSiteChanged);
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    setRefreshKey((key) => key + 1);
  };

  const counts = useMemo(() => countBySeverity(alerts), [alerts]);
  const groups = useMemo(() => groupAlertsByCategory(alerts), [alerts]);
  const hasAnyPermission = permissions.packing || permissions.ticketing || permissions.stock;
  const showEmpty = !loading && alerts.length === 0 && hasAnyPermission;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <p className="font-mono text-xs uppercase tracking-[0.35em] text-brand">Clutch.</p>
          <h1 className="text-balance text-3xl font-semibold tracking-tight text-slate-900 md:text-4xl">
            Operational overview
          </h1>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-600">
            {siteName ? (
              <span>
                Site: <span className="font-medium text-slate-800">{siteName}</span>
              </span>
            ) : null}
            <span className="inline-flex items-center gap-1.5">
              <Calendar className="size-3.5 text-slate-400" />
              {todayLabel || null}
            </span>
          </div>
          <p className="max-w-2xl text-pretty text-slate-600">
            Live snapshot of grain flow, packing progress, stock position, and items needing attention.
          </p>
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="h-8 gap-1.5 text-xs"
          onClick={handleRefresh}
          disabled={loading || refreshing}
        >
          <RefreshCw className={cn("size-3.5", refreshing && "animate-spin")} />
          Refresh
        </Button>
      </header>

      <OperationsPanels metrics={metrics} permissions={permissions} loading={loading} />

      {(permissions.packing || permissions.ticketing) && hasAnyPermission ? (
        <SummaryStrip counts={counts} loading={loading} />
      ) : null}

      {(errors.packing || errors.ticketing || errors.stock) && !loading ? (
        <div className="space-y-2">
          {errors.packing ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              Packing data: {errors.packing}
            </div>
          ) : null}
          {errors.ticketing ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              Ticketing data: {errors.ticketing}
            </div>
          ) : null}
          {errors.stock ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              Stock data: {errors.stock}
            </div>
          ) : null}
        </div>
      ) : null}

      <section className="rounded-2xl border border-slate-200/95 bg-white/90 p-5 shadow-[0_24px_50px_-32px_rgba(0,112,255,0.12)] backdrop-blur-sm sm:p-6">
        <div className="flex items-center gap-2">
          <AlertTriangle className="size-4 text-brand" strokeWidth={1.5} />
          <h2 className="text-lg font-medium text-slate-900">Alerts</h2>
        </div>

        {!hasAnyPermission && !loading ? (
          <p className="mt-4 text-sm text-slate-600">
            You do not have permission to view operational data for this site.
          </p>
        ) : null}

        {loading ? <LoadingSkeleton /> : null}

        {showEmpty ? (
          <div className="mt-4 flex flex-col items-center gap-2 rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-6 py-10 text-center">
            <Package className="size-8 text-emerald-500" strokeWidth={1.5} />
            <p className="text-sm font-medium text-slate-800">No items need attention right now</p>
            <p className="max-w-sm text-sm text-slate-500">
              Active packs, containers, and tickets are all up to date.
            </p>
          </div>
        ) : null}

        {!loading && groups.length > 0 ? (
          <div className="mt-4 space-y-6">
            {groups.map((group) => (
              <div key={group.category}>
                <h3 className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  {group.category === "Ticketing" ? (
                    <Ticket className="size-3" />
                  ) : group.category === "Containers" ? (
                    <Container className="size-3" />
                  ) : (
                    <Package className="size-3" />
                  )}
                  {group.category}
                </h3>
                <div className="space-y-2">
                  {group.items.map((alert) => (
                    <AlertRow key={alert.id} alert={alert} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium text-slate-700">Quick links</h2>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {QUICK_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-lg border border-slate-200/90 bg-white/80 px-4 py-3 text-sm text-slate-700 transition-colors hover:border-brand/35 hover:bg-white hover:text-slate-900"
            >
              {link.title}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
