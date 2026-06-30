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
  readTenantIds,
  summarizeVesselIngestSync,
} from "@/lib/api/integrations";
import { readAuthPayload } from "@/lib/auth-session";
import { INBOUND_INTEGRATIONS, INBOUND_INTEGRATION_TYPES } from "@/lib/integrations-catalog";
import { cn } from "@/lib/utils";

const inputClass =
  "h-9 w-full rounded-lg border border-slate-200/95 bg-white px-3 text-sm text-slate-900 outline-none ring-brand/15 placeholder:text-slate-400 focus:border-brand/35 focus:ring-2";

function readAllowedSiteOptions() {
  const payload = readAuthPayload();
  const allowed = Array.isArray(payload?.allowed_sites) ? payload.allowed_sites : [];
  if (allowed.length) {
    return allowed
      .map((site) => {
        const id = String(site?.id ?? "").trim();
        if (!id) return null;
        return {
          id,
          label: String(site?.name ?? site?.code ?? id).trim(),
        };
      })
      .filter(Boolean);
  }
  if (payload?.current_site?.id) {
    return [
      {
        id: String(payload.current_site.id),
        label: String(payload.current_site.name ?? payload.current_site.code ?? "Current site"),
      },
    ];
  }
  return [];
}

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

function SyncStatusCard({ title, run }) {
  if (!run) {
    return (
      <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-3">
        <p className="text-xs font-semibold text-slate-700">{title}</p>
        <p className="mt-1 text-sm text-slate-500">No sync recorded yet</p>
      </div>
    );
  }

  const when = run.finished_at || run.created_at;
  const relative = formatRelativeTime(when);

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">
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
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
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
          Copy this key now and store it in your external system. It will not be shown again.
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

function IntegrationCredentialsTable({
  credentials,
  loading,
  onDisable,
  disablingId,
}) {
  if (loading) {
    return <p className="text-sm text-slate-500">Loading keys…</p>;
  }
  if (!credentials.length) {
    return (
      <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-500">
        No active keys for this site. Generate a key to connect an external feed.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200">
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
            <tr key={row.id} className="bg-white">
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

function IntegrationPanel({
  integration,
  organizationId,
  siteId,
  apiBaseUrl,
}) {
  const endpoint = `${apiBaseUrl}${integration.path}`;
  const [credentials, setCredentials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [label, setLabel] = useState("");
  const [creating, setCreating] = useState(false);
  const [disablingId, setDisablingId] = useState("");
  const [revealedKey, setRevealedKey] = useState("");
  const [syncSummary, setSyncSummary] = useState({ lastSchedule: null, lastRotation: null, lastAny: null });
  const [syncLoading, setSyncLoading] = useState(false);

  const showVesselSync = integration.type === INBOUND_INTEGRATION_TYPES.VESSEL_SCHEDULE;

  const headerExamples = useMemo(
    () =>
      integration.standardHeaders.map((header) => {
        let example = header.description;
        if (header.name === "X-Clutch-Organization-Id") example = organizationId || example;
        if (header.name === "X-Clutch-Site-Id") example = siteId || example;
        if (header.name === "X-Clutch-Integration-Type") example = integration.type;
        if (header.name === "Authorization") example = "Bearer clk_…";
        return { ...header, example };
      }),
    [integration, organizationId, siteId]
  );

  const loadCredentials = useCallback(async () => {
    if (!siteId) {
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
  }, [integration.type, siteId]);

  useEffect(() => {
    loadCredentials();
  }, [loadCredentials]);

  const loadSyncStatus = useCallback(async () => {
    if (!siteId || !showVesselSync) {
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
  }, [showVesselSync, siteId]);

  useEffect(() => {
    loadSyncStatus();
  }, [loadSyncStatus]);

  async function handleCreateKey() {
    if (!siteId) return;
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

  return (
    <section className="rounded-xl border border-slate-200/90 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-4 py-4 md:px-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">{integration.name}</h2>
            <p className="mt-1 max-w-3xl text-sm text-slate-600">{integration.summary}</p>
          </div>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 font-mono text-[11px] font-semibold text-slate-600">
            {integration.type}
          </span>
        </div>
      </div>

      <div className="space-y-5 px-4 py-4 md:px-5">
        {error ? (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
        ) : null}

        {showVesselSync ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Last sync</p>
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
            {syncSummary.lastAny ? (
              <p className="text-xs text-slate-500">
                Most recent ingest of any type: {formatDateTime(syncSummary.lastAny.finished_at || syncSummary.lastAny.created_at)}
                {syncSummary.lastAny.source === "integration_api" ? " (API)" : ""}
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Endpoint</p>
            <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
              <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold text-blue-700">
                {integration.method}
              </span>
              <code className="min-w-0 flex-1 break-all text-xs text-slate-800">{endpoint}</code>
              <CopyButton value={endpoint} />
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Payload</p>
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
              {integration.supportsSeparateFiles ? (
                <p className="text-xs leading-relaxed">
                  Schedule and rotation files may be sent in <strong>separate requests</strong>. Send only the file
                  you have in each call.
                </p>
              ) : null}
              <ul className="mt-2 space-y-1.5 text-xs">
                {integration.fileFields.map((field) => (
                  <li key={field.key}>
                    <span className="font-semibold text-slate-800">{field.label}</span>
                    <span className="text-slate-500">
                      {" "}
                      — multipart <code>{field.multipart}</code> or JSON <code>{field.json}</code>
                    </span>
                    <span className="block text-slate-500">{field.description}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Required headers</p>
          <div className="overflow-x-auto rounded-lg border border-slate-200">
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
                  <tr key={header.name} className="bg-white">
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
        </div>

        <div className="space-y-3 border-t border-slate-100 pt-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <KeyRound className="size-4 text-slate-500" />
              <p className="text-sm font-semibold text-slate-900">Integration keys</p>
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-[220px] flex-1">
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Label (optional)
              </label>
              <input
                className={inputClass}
                placeholder="e.g. Carrier schedule feed"
                value={label}
                onChange={(event) => setLabel(event.target.value)}
              />
            </div>
            <Button type="button" size="sm" disabled={creating || !siteId} onClick={handleCreateKey}>
              <Plus className="size-3.5" />
              {creating ? "Generating…" : "Generate key"}
            </Button>
          </div>

          <IntegrationCredentialsTable
            credentials={credentials}
            loading={loading}
            onDisable={handleDisable}
            disablingId={disablingId}
          />
        </div>
      </div>

      <KeyRevealDialog
        open={Boolean(revealedKey)}
        integrationKey={revealedKey}
        onClose={() => setRevealedKey("")}
      />
    </section>
  );
}

export default function IntegrationsPage() {
  const [siteOptions, setSiteOptions] = useState(() => readAllowedSiteOptions());
  const [selectedSiteId, setSelectedSiteId] = useState(() => readAllowedSiteOptions()[0]?.id ?? "");
  const apiBaseUrl = getApiBaseUrl();

  useEffect(() => {
    const refresh = () => {
      const options = readAllowedSiteOptions();
      setSiteOptions(options);
      setSelectedSiteId((current) =>
        options.some((option) => option.id === current) ? current : (options[0]?.id ?? "")
      );
    };
    refresh();
    window.addEventListener("auth-session-changed", refresh);
    return () => window.removeEventListener("auth-session-changed", refresh);
  }, []);

  const { organizationId } = readTenantIds(selectedSiteId);
  const siteLabel = siteOptions.find((option) => option.id === selectedSiteId)?.label || "";

  if (!selectedSiteId) {
    return (
      <div className="space-y-4">
        <div>
          <p className="text-xs text-slate-500">System Settings / Integrations</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 md:text-[1.65rem]">Integrations</h1>
        </div>
        <div className="rounded-xl border border-slate-200/90 bg-white p-6 text-sm text-slate-500 shadow-sm">
          No site context found. Log in again or switch to a site to manage integrations.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs text-slate-500">System Settings / Integrations</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 md:text-[1.65rem]">Integrations</h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-600">
          Connection details for external systems that send data into Mahonys Packing — API endpoints, required
          headers, and site-scoped integration keys.
        </p>
      </div>

      <section className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm">
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="space-y-2">
            <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">Site</label>
            {siteOptions.length > 1 ? (
              <select
                className={cn(inputClass, "w-full")}
                value={selectedSiteId}
                onChange={(event) => setSelectedSiteId(event.target.value)}
              >
                {siteOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            ) : (
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                {siteLabel}
              </div>
            )}
          </div>
          <CopyField label="Organization ID" value={organizationId} />
          <CopyField label="Site ID" value={selectedSiteId} />
        </div>
      </section>

      <div className="space-y-5">
        {INBOUND_INTEGRATIONS.map((integration) => (
          <IntegrationPanel
            key={integration.type}
            integration={integration}
            organizationId={organizationId}
            siteId={selectedSiteId}
            apiBaseUrl={apiBaseUrl}
          />
        ))}
      </div>
    </div>
  );
}
