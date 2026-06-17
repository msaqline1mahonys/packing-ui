"use client";

import { useEffect, useState } from "react";

import { AdHocBuilder } from "@/components/reports/ad-hoc-builder";
import { HistoryTable } from "@/components/reports/history-table";
import { SubscriptionsTab } from "@/components/reports/subscriptions-tab";
import { canManageSubscriptions, canRunAdHocReports, canViewReports } from "@/lib/reports-permissions";
import { loadHistory } from "@/lib/reports-store";
import { startSchedulerSimulator } from "@/lib/reports-scheduler-sim";
import { cn } from "@/lib/utils";

const TABS = [
  { key: "build", label: "Build", description: "Run an ad-hoc report for a date range." },
  { key: "subscriptions", label: "Subscriptions", description: "Customers enrolled in daily, weekly, monthly or yearly reports." },
  { key: "history", label: "History", description: "Every ad-hoc and scheduled run." },
];

export default function ReportsClient() {
  const [activeTab, setActiveTab] = useState("build");
  const [history, setHistory] = useState([]);
  const [permsChecked, setPermsChecked] = useState(false);
  const [allowed, setAllowed] = useState({ view: true, run: true, manage: true });

  function refreshHistory() {
    setHistory(loadHistory());
  }

  useEffect(() => {
    const nextAllowed = {
      view: canViewReports(),
      run: canRunAdHocReports(),
      manage: canManageSubscriptions(),
    };
    setAllowed(nextAllowed);
    setPermsChecked(true);
    refreshHistory();

    const nextVisible = TABS.filter((tab) => {
      if (tab.key === "build") return nextAllowed.run;
      if (tab.key === "subscriptions") return nextAllowed.manage;
      return nextAllowed.view;
    });
    if (nextVisible.length > 0) {
      setActiveTab((current) =>
        nextVisible.some((tab) => tab.key === current) ? current : nextVisible[0].key
      );
    }

    const cleanup = startSchedulerSimulator({ onTick: () => refreshHistory() });
    return cleanup;
  }, []);

  useEffect(() => {
    if (activeTab === "history") refreshHistory();
  }, [activeTab]);

  if (permsChecked && !allowed.view) {
    return (
      <div className="space-y-3">
        <p className="text-xs text-slate-500">Operations / Reports</p>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Reports</h1>
        <div className="rounded-xl border border-dashed border-slate-200 bg-white p-8 text-center">
          <p className="text-sm font-medium text-slate-800">You don&apos;t have access to Reports</p>
          <p className="mt-1 text-[11px] text-slate-500">Ask an administrator to grant the <span className="font-mono">reports.view</span> permission.</p>
        </div>
      </div>
    );
  }

  const visibleTabs = TABS.filter((tab) => {
    if (tab.key === "build") return allowed.run;
    if (tab.key === "subscriptions") return allowed.manage;
    return allowed.view;
  });

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs text-slate-500">Operations / Reports</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 md:text-[1.65rem]">Reports</h1>
        <p className="mt-1 text-xs text-slate-500">Build customer reports on demand, or enrol customers in scheduled daily, weekly, monthly or yearly bundles.</p>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200">
        {visibleTabs.map((tab) => {
          const active = tab.key === activeTab;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                "relative h-9 cursor-pointer rounded-t-md px-3 text-[12px] font-medium transition-colors",
                active
                  ? "bg-white text-slate-900 ring-1 ring-slate-200 ring-b-0"
                  : "text-slate-500 hover:text-slate-800"
              )}
            >
              {tab.label}
              {active ? <span className="absolute inset-x-1 -bottom-px h-px bg-white" /> : null}
            </button>
          );
        })}
      </div>

      {activeTab === "build" && allowed.run ? <AdHocBuilder onRanComplete={refreshHistory} /> : null}
      {activeTab === "subscriptions" && allowed.manage ? <SubscriptionsTab /> : null}
      {activeTab === "history" ? <HistoryTable rows={history} /> : null}
    </div>
  );
}
