"use client";

import { useEffect, useState } from "react";

import { CADENCES, CADENCE_DESCRIPTIONS, CADENCE_LABELS } from "@/lib/reports-windows";
import {
  deleteSubscription,
  getFireTime,
  loadSubscriptions,
  setSubscriptionEnabled,
  upsertSubscription,
} from "@/lib/reports-store";
import { Button } from "@/components/ui/button";
import { SubscriptionForm } from "@/components/reports/subscription-form";
import { SubscriptionRow } from "@/components/reports/subscription-row";
import { cn } from "@/lib/utils";

export function SubscriptionsTab() {
  const [activeCadence, setActiveCadence] = useState("daily");
  const [subscriptions, setSubscriptions] = useState([]);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [fireTime, setFireTimeState] = useState("06:00");

  function refresh() {
    setSubscriptions(loadSubscriptions());
  }

  useEffect(() => {
    refresh();
    setFireTimeState(getFireTime());
  }, []);

  const rows = subscriptions.filter((s) => s.cadence === activeCadence);

  function handleAdd() {
    setEditing(null);
    setFormOpen(true);
  }

  function handleEdit(sub) {
    setEditing(sub);
    setFormOpen(true);
  }

  function handleSave(input) {
    upsertSubscription(input);
    setFormOpen(false);
    setEditing(null);
    refresh();
  }

  function handleDelete(id) {
    if (!confirm("Delete this subscription? It will no longer be fired by scheduled runs.")) return;
    deleteSubscription(id);
    refresh();
  }

  function handleToggle(id, enabled) {
    setSubscriptionEnabled(id, enabled);
    refresh();
  }

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Scheduled reports</p>
            <p className="text-[11px] text-slate-500">
              {CADENCE_DESCRIPTIONS[activeCadence]} Fire time: <span className="font-mono text-slate-700">{fireTime}</span> site time.
            </p>
          </div>
          <div className="flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 p-1">
            {CADENCES.map((cad) => {
              const count = subscriptions.filter((s) => s.cadence === cad).length;
              const active = cad === activeCadence;
              return (
                <button
                  key={cad}
                  type="button"
                  onClick={() => setActiveCadence(cad)}
                  className={cn(
                    "inline-flex h-6 items-center gap-1.5 rounded px-2 text-[11px] font-medium transition-colors",
                    active ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200" : "text-slate-500 hover:text-slate-700"
                  )}
                >
                  {CADENCE_LABELS[cad]}
                  <span className={cn("rounded-full px-1.5 text-[10px]", active ? "bg-brand/15 text-brand-ink" : "bg-slate-200/70 text-slate-600")}>{count}</span>
                </button>
              );
            })}
          </div>
          <Button type="button" size="sm" onClick={handleAdd} className="h-7 px-2.5 text-[11px]">
            + Add {CADENCE_LABELS[activeCadence]} subscription
          </Button>
        </div>
      </section>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-white p-8 text-center">
          <p className="text-sm font-medium text-slate-800">No {CADENCE_LABELS[activeCadence].toLowerCase()} subscriptions yet</p>
          <p className="mt-1 text-[11px] text-slate-500">Add a subscription to send {CADENCE_LABELS[activeCadence].toLowerCase()} reports to a customer.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((sub) => (
            <SubscriptionRow
              key={sub.id}
              subscription={sub}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onToggle={handleToggle}
            />
          ))}
        </div>
      )}

      <SubscriptionForm
        open={formOpen}
        cadence={activeCadence}
        initial={editing}
        onCancel={() => {
          setFormOpen(false);
          setEditing(null);
        }}
        onSave={handleSave}
      />
    </div>
  );
}
