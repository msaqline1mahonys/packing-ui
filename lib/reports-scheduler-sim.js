"use client";

/**
 * Client-side simulator. In the UI-only phase subscriptions can't actually
 * fire — there is no cron. This runner inspects every enabled subscription
 * when called and, if the cadence has rolled over since `lastFiredAt`,
 * appends a `simulated` entry to history and marks the subscription fired.
 *
 * It is intentionally low-fidelity: it catches up on missed runs the next
 * time the user opens Reports, rather than tracking exact fire-of-day timing.
 * The backend command in the spec doc is the source of truth for real runs.
 */

import {
  appendHistory,
  loadSubscriptions,
  markSubscriptionFired,
} from "@/lib/reports-store";
import { collectReportData } from "@/lib/reports-data";
import { hasCadenceElapsed, windowForCadence } from "@/lib/reports-windows";

async function fireOnce(subscription, now) {
  const dateRange = windowForCadence(subscription.cadence, now);
  const report = await collectReportData({
    dateRange,
    customerId: subscription.customerId,
    commodityIds: subscription.commodityIds || [],
  });

  appendHistory({
    source: subscription.cadence,
    dateRange,
    recipients: [
      {
        customerId: subscription.customerId,
        emails: subscription.recipientEmails || [],
        deliveredAs: "simulated",
      },
    ],
    artifacts: [
      {
        customerId: subscription.customerId,
        fileName: `${report.customer?.code || report.customer?.name || "customer"}.zip`,
        blobUrl: null,
      },
    ],
    status: "partial",
    notes: "Simulated — backend Reports module not deployed. Cadence window computed; real delivery requires the queued job.",
  });
  markSubscriptionFired(subscription.id, now.toISOString());
}

/**
 * Run one tick. Returns the number of simulated firings recorded.
 * Safe to call frequently — no-ops when nothing has rolled over.
 */
export async function runSchedulerTick(now = new Date()) {
  const subs = loadSubscriptions().filter((s) => s.enabled !== false && s.customerId != null);
  let fired = 0;
  for (const sub of subs) {
    if (hasCadenceElapsed(sub.cadence, sub.lastFiredAt, now)) {
      await fireOnce(sub, now);
      fired += 1;
    }
  }
  return fired;
}

/**
 * Hook helper: kicks off a tick on mount and on a regular interval. Returns
 * a cleanup function. Tick frequency is intentionally generous (60s) since
 * we only care about cadence boundaries.
 */
export function startSchedulerSimulator({ onTick } = {}) {
  let cancelled = false;
  let timer = null;

  async function tick() {
    if (cancelled) return;
    try {
      const count = await runSchedulerTick();
      if (count > 0 && onTick) onTick(count);
    } catch {
      /* simulator should never throw into the UI */
    }
  }

  tick();
  timer = setInterval(tick, 60_000);

  return () => {
    cancelled = true;
    if (timer) clearInterval(timer);
  };
}
