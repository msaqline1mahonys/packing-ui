"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Copy, KeyRound, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  createIntegrationCredential,
  disableIntegrationCredential,
  fetchIntegrationCredentials,
  fetchVesselIngestRuns,
  getApiBaseUrl,
  summarizeVesselIngestSync,
} from "@/lib/api/integrations";
import { getInboundIntegration, INBOUND_INTEGRATION_TYPES } from "@/lib/integrations-catalog";
import { cn } from "@/lib/utils";

const inputClass =
  "h-9 w-full rounded-lg border border-slate-200/95 bg-white px-3 text-sm text-slate-900 outline-none ring-brand/15 placeholder:text-slate-400 focus:border-brand/35 focus:ring-2";

const integration = getInboundIntegration(INBOUND_INTEGRATION_TYPES.VESSEL_SCHEDULE);

function formatDateTime(value) {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toLocaleString();
}

function formatRelativeTime(value) {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  const diffMs = Date.now() - parsed.getTime();
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} hr ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

function statusBadgeClass(status) {
  if (status === "success") return "bg-emerald-100 text-emerald-700";
  if (status === "partial") return "bg-amber-100 text-amber-700";
  return "bg-red-100 text-red-700";
}

function formatSourceLabel(source) {
  if (source === "integration_api") return "API integration";
  if (source === "manual_upload") return "Manual upload";
  return String(source || "Unknown").replaceAll("_", " ");
}

async function copyText(value) {
  if (!value) return false;
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
}

function CopyButton({ value, label = "Copy" }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      className="inline-flex shrink-0 items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-50"
      onClick={async () => {
        const ok = await copyText(value);
        if (!ok) return;
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? <Check className="size-3 text-emerald-600" /> : <Copy className="size-3" />}
      {copied ? "Copied" : label}
    </button>
  );
}

function CopyField({ label, value }) {
  return (
    <div className="space-y-1">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">{label}</p>
      <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
        <code className="min-w-0 flex-1 break-all text-xs text-slate-800">{value || "—"}</code>
        {value ? <CopyButton value={value} /> : null}
      </div>
    </div>
  );
}

function KeyRevealDialog({ open, integrationKey, onClose }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button type="button" className="absolute inset-0 bg-black/40" aria-label="Close" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-lg rounded-xl border border-slate-200 bg-white p-5 shadow-xl"
      >
        <h2 className="text-sm font-semibold text-slate-900">Integration key created</h2>
        <p className="mt-2 text-sm text-slate-600">
          Copy this key now and store it in Power Automate or Comtrac. It will not be shown again.
        </p>
        <div className="mt-4 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
          <code className="min-w-0 flex-1 break-all text-xs font-semibold text-amber-950">{integrationKey}</code>
          <CopyButton value={integrationKey} label="Copy key" />
        </div>
        <div className="mt-4 flex justify-end">
          <Button type="button" size="sm" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </div>
  );
}

function SyncStatusCard({ title, run }) {
  if (!run) {
    return (
      <div className="rounded-lg border border-dashed border-slate-200 bg-white px-3 py-3">
        <p className="text-xs font-semibold text-slate-700">{title}</p>
        <p className="mt-1 text-sm text-slate-500">No sync recorded yet</p>
      </div>
    );
  }

  const when = run.finished_at || run.created_at;
  const relative = formatRelativeTime(when);

  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold text-slate-700">{title}</p>
        <span
          className={cn(
            "rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase",
            statusBadgeClass(run.status)
          )}
        >
          {run.status}
        </span>
      </div>
      <p className="mt-1 text-sm font-medium text-slate-900">{formatDateTime(when)}</p>
      {relative ? <p className="text-xs text-slate-500">{relative}</p> : null}
      <p className="mt-1 text-xs text-slate-500">
        via {formatSourceLabel(run.source)}
        {run.filename_vs || run.filename_vr ? (
          <>
            {" "}
            · {run.filename_vs ? `VS: ${run.filename_vs}` : ""}
            {run.filename_vs && run.filename_vr ? " · " : ""}
            {run.filename_vr ? `VR: ${run.filename_vr}` : ""}
          </>
        ) : null}
      </p>
    </div>
  );
}

function IntegrationCredentialsTable({ credentials, loading, onDisable, disablingId }) {
  if (loading) {
    return <p className="text-sm text-slate-500">Loading keys…</p>;
  }
  if (!credentials.length) {
    return (
      <p className="rounded-lg border border-dashed border-slate-200 bg-white px-3 py-4 text-sm text-slate-500">
        No active keys for this site. Generate a key to connect Comtrac or Power Automate.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-3 py-2">Label</th>
            <th className="px-3 py-2">Key prefix</th>
            <th className="px-3 py-2">Created</th>
            <th className="px-3 py-2">Last used</th>
            <th className="px-3 py-2 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {credentials.map((row) => (
            <tr key={row.id}>
              <td className="px-3 py-2 text-slate-800">{row.label || "—"}</td>
              <td className="px-3 py-2 font-mono text-xs text-slate-600">{row.key_prefix}…</td>
              <td className="px-3 py-2 text-slate-600">{formatDateTime(row.created_at)}</td>
              <td className="px-3 py-2 text-slate-600">{formatDateTime(row.last_used_at)}</td>
              <td className="px-3 py-2 text-right">
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
                  disabled={disablingId === row.id}
                  onClick={() => onDisable(row.id)}
                >
                  <Trash2 className="size-3.5" />
                  Disable
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ComtracIntegrationPanel({ siteId, organizationId }) {
  const apiBaseUrl = getApiBaseUrl();
  const endpoint = integration ? `${apiBaseUrl}${integration.path}` : "";
  const [credentials, setCredentials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [label, setLabel] = useState("");
  const [creating, setCreating] = useState(false);
  const [disablingId, setDisablingId] = useState("");
  const [revealedKey, setRevealedKey] = useState("");
  const [syncSummary, setSyncSummary] = useState({ lastSchedule: null, lastRotation: null, lastAny: null });
  const [syncLoading, setSyncLoading] = useState(false);

  const headerExamples = useMemo(() => {
    if (!integration) return [];
    return integration.standardHeaders.map((header) => {
      let example = header.description;
      if (header.name === "X-Clutch-Organization-Id") example = organizationId || example;
      if (header.name === "X-Clutch-Site-Id") example = siteId || example;
      if (header.name === "X-Clutch-Integration-Type") example = integration.type;
      if (header.name === "Authorization") example = "Bearer clk_…";
      return { ...header, example };
    });
  }, [organizationId, siteId]);

  const loadCredentials = useCallback(async () => {
    if (!siteId || !integration) {
      setCredentials([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const rows = await fetchIntegrationCredentials(siteId, integration.type);
      setCredentials(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load integration keys.");
      setCredentials([]);
    } finally {
      setLoading(false);
    }
  }, [siteId]);

  const loadSyncStatus = useCallback(async () => {
    if (!siteId) {
      setSyncSummary({ lastSchedule: null, lastRotation: null, lastAny: null });
      return;
    }
    setSyncLoading(true);
    try {
      const runs = await fetchVesselIngestRuns(siteId);
      setSyncSummary(summarizeVesselIngestSync(runs));
    } catch {
      setSyncSummary({ lastSchedule: null, lastRotation: null, lastAny: null });
    } finally {
      setSyncLoading(false);
    }
  }, [siteId]);

  useEffect(() => {
    loadCredentials();
    loadSyncStatus();
  }, [loadCredentials, loadSyncStatus]);

  async function handleCreateKey() {
    if (!siteId || !integration) return;
    setCreating(true);
    setError("");
    try {
      const result = await createIntegrationCredential({
        siteId,
        integrationType: integration.type,
        label,
      });
      setRevealedKey(result?.integration_key || "");
      setLabel("");
      await loadCredentials();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create integration key.");
    } finally {
      setCreating(false);
    }
  }

  async function handleDisable(credentialId) {
    if (!siteId) return;
    setDisablingId(credentialId);
    setError("");
    try {
      await disableIntegrationCredential(credentialId, siteId);
      await loadCredentials();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not disable integration key.");
    } finally {
      setDisablingId("");
    }
  }

  if (!integration) return null;

  return (
    <div className="grid gap-4">
      <section className="rounded-xl border border-slate-200/90 bg-slate-50/80 p-4">
        <p className="text-sm text-slate-600">
          Receive Comtrac carrier <strong>VS</strong> (vessel schedule) and <strong>VR</strong> (vessel rotation) files
          via API — e.g. from Power Automate when emails arrive. Schedule and rotation may be sent in separate requests.
          VS creates one voyage per ship + voyage + terminal + load port + operator. VR rows are discharge ports and do not
          create additional voyages.
        </p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <CopyField label="Organization ID" value={organizationId} />
          <CopyField label="Site ID" value={siteId} />
        </div>
      </section>

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      ) : null}

      <section className="rounded-xl border border-slate-200/90 bg-slate-50/80 p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-slate-900">Last sync</h3>
          <button
            type="button"
            className="text-xs font-semibold text-blue-600 hover:text-blue-700"
            onClick={loadSyncStatus}
            disabled={syncLoading}
          >
            {syncLoading ? "Refreshing…" : "Refresh"}
          </button>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <SyncStatusCard title="Vessel schedule (VS)" run={syncSummary.lastSchedule} />
          <SyncStatusCard title="Vessel rotation (VR)" run={syncSummary.lastRotation} />
        </div>
      </section>

      <section className="rounded-xl border border-slate-200/90 bg-slate-50/80 p-4">
        <h3 className="mb-3 text-sm font-semibold text-slate-900">API endpoint</h3>
        <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
          <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold text-blue-700">
            {integration.method}
          </span>
          <code className="min-w-0 flex-1 break-all text-xs text-slate-800">{endpoint}</code>
          <CopyButton value={endpoint} />
        </div>
        <ul className="mt-3 space-y-1.5 text-xs text-slate-600">
          {integration.fileFields.map((field) => (
            <li key={field.key}>
              <span className="font-semibold text-slate-800">{field.label}</span>
              <span>
                {" "}
                — JSON <code>{field.json}</code> or multipart <code>{field.multipart}</code>
              </span>
              <span className="block text-slate-500">{field.description}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-xl border border-slate-200/90 bg-slate-50/80 p-4">
        <h3 className="mb-3 text-sm font-semibold text-slate-900">Required headers</h3>
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2">Header</th>
                <th className="px-3 py-2">Value</th>
                <th className="px-3 py-2 text-right">Copy</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {headerExamples.map((header) => (
                <tr key={header.name}>
                  <td className="px-3 py-2 font-mono text-xs text-slate-800">
                    {header.name}
                    {header.optional ? (
                      <span className="ml-2 text-[10px] font-normal uppercase text-slate-400">optional</span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-600">{header.example}</td>
                  <td className="px-3 py-2 text-right">
                    {!header.optional && header.example && !header.example.includes("…") ? (
                      <CopyButton value={header.example} />
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200/90 bg-slate-50/80 p-4">
        <div className="mb-3 flex items-center gap-2">
          <KeyRound className="size-4 text-slate-500" />
          <h3 className="text-sm font-semibold text-slate-900">Integration keys</h3>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[220px] flex-1">
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-600">
              Label (optional)
            </label>
            <input
              className={inputClass}
              placeholder="e.g. Power Automate mailbox feed"
              value={label}
              onChange={(event) => setLabel(event.target.value)}
            />
          </div>
          <Button type="button" size="sm" disabled={creating || !siteId} onClick={handleCreateKey}>
            <Plus className="size-3.5" />
            {creating ? "Generating…" : "Generate key"}
          </Button>
        </div>
        <div className="mt-3">
          <IntegrationCredentialsTable
            credentials={credentials}
            loading={loading}
            onDisable={handleDisable}
            disablingId={disablingId}
          />
        </div>
      </section>

      <KeyRevealDialog
        open={Boolean(revealedKey)}
        integrationKey={revealedKey}
        onClose={() => setRevealedKey("")}
      />
    </div>
  );
}
