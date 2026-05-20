"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { readSiteOptions, SITES_UPDATED_EVENT } from "@/lib/site-data";
import {
  ensureSiteRowsHaveIntegrationScaffold,
  INTEGRATION_SETTINGS_UPDATED_EVENT,
  INTEGRATION_TYPES,
  readSiteIntegrationSettings,
  upsertIntegrationSettings,
} from "@/lib/integration-settings-store";

const tabs = [
  { key: INTEGRATION_TYPES.PEMS, label: "PEMS" },
  { key: INTEGRATION_TYPES.CONTAINER_CHAIN, label: "ContainerChain" },
  { key: INTEGRATION_TYPES.CONTAINER_SPACE, label: "ContainerSpace" },
  { key: INTEGRATION_TYPES.PRA, label: "PRA" },
  { key: INTEGRATION_TYPES.SHARED, label: "Fumigation" },
];

const inputClass =
  "h-9 w-full rounded-lg border border-slate-200/95 bg-white px-3 text-sm text-slate-900 outline-none ring-brand/15 placeholder:text-slate-400 focus:border-brand/35 focus:ring-2";

const pemsAuthFields = ["active", "userId", "vendorToken", "tokenExpiryDate"];
const pemsUrlFields = ["ecrUrl", "gppirUrl", "resubmissionUrl", "fileAttachmentUrl"];
const containerChainFields = ["active", "containerChainId", "containerChainPassword"];
const containerSpaceFields = ["active", "containerSpaceId", "containerSpacePassword"];
const praFields = ["active", "praInformation", "daffSiteId"];
const sharedFields = ["fumigationProviderName", "fumigationProviderLicense"];

function getDraftFromSettings(settings = {}, fields = []) {
  const draft = {};
  for (const key of fields) {
    const value = settings[key];
    draft[key] = typeof value === "string" || typeof value === "boolean" ? value : "";
  }
  return draft;
}

function isValidDate(value) {
  if (!value) return true;
  const date = new Date(value);
  return !Number.isNaN(date.getTime());
}

function daysUntil(dateValue) {
  if (!dateValue) return null;
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return null;
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

function isValidUrl(value) {
  if (!value) return true;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function panelIsConfigured(draft, fields) {
  return fields.some((key) => {
    const value = draft[key];
    if (typeof value === "boolean") return value;
    return String(value ?? "").trim() !== "";
  });
}

function saveButtonClass(disabled) {
  return cn(
    "inline-flex h-7 items-center rounded-md px-3 text-xs font-semibold transition-colors",
    disabled ? "cursor-not-allowed bg-blue-300 text-white" : "bg-blue-600 text-white hover:bg-blue-700"
  );
}

export default function IntegrationSettingsPage() {
  const [siteOptions, setSiteOptions] = useState(() => readSiteOptions());
  const [selectedSiteId, setSelectedSiteId] = useState(() => readSiteOptions()[0]?.id ?? "");
  const [activeTab, setActiveTab] = useState(INTEGRATION_TYPES.PEMS);
  const [settingsByType, setSettingsByType] = useState({});
  const [errors, setErrors] = useState({});
  const [showPemsToken, setShowPemsToken] = useState(false);
  const [showContainerChainPassword, setShowContainerChainPassword] = useState(false);
  const [showContainerSpacePassword, setShowContainerSpacePassword] = useState(false);

  const [pemsAuthDraft, setPemsAuthDraft] = useState({});
  const [pemsUrlDraft, setPemsUrlDraft] = useState({});
  const [containerChainDraft, setContainerChainDraft] = useState({});
  const [containerSpaceDraft, setContainerSpaceDraft] = useState({});
  const [praDraft, setPraDraft] = useState({});
  const [sharedDraft, setSharedDraft] = useState({});

  const siteLabel = useMemo(
    () => siteOptions.find((option) => option.id === selectedSiteId)?.label || "â€”",
    [siteOptions, selectedSiteId]
  );

  useEffect(() => {
    ensureSiteRowsHaveIntegrationScaffold();
    const refreshSites = () => {
      const options = readSiteOptions();
      setSiteOptions(options);
      if (!options.some((option) => option.id === selectedSiteId)) {
        setSelectedSiteId(options[0]?.id ?? "");
      }
    };
    refreshSites();
    window.addEventListener(SITES_UPDATED_EVENT, refreshSites);
    return () => window.removeEventListener(SITES_UPDATED_EVENT, refreshSites);
  }, [selectedSiteId]);

  useEffect(() => {
    const refreshSettings = () => {
      if (!selectedSiteId) {
        setSettingsByType({});
        return;
      }
      setSettingsByType(readSiteIntegrationSettings(selectedSiteId));
    };
    refreshSettings();
    window.addEventListener(INTEGRATION_SETTINGS_UPDATED_EVENT, refreshSettings);
    return () => window.removeEventListener(INTEGRATION_SETTINGS_UPDATED_EVENT, refreshSettings);
  }, [selectedSiteId]);

  useEffect(() => {
    setPemsAuthDraft(getDraftFromSettings(settingsByType[INTEGRATION_TYPES.PEMS], pemsAuthFields));
    setPemsUrlDraft(getDraftFromSettings(settingsByType[INTEGRATION_TYPES.PEMS], pemsUrlFields));
    setContainerChainDraft(
      getDraftFromSettings(settingsByType[INTEGRATION_TYPES.CONTAINER_CHAIN], containerChainFields)
    );
    setContainerSpaceDraft(
      getDraftFromSettings(settingsByType[INTEGRATION_TYPES.CONTAINER_SPACE], containerSpaceFields)
    );
    setPraDraft(getDraftFromSettings(settingsByType[INTEGRATION_TYPES.PRA], praFields));
    setSharedDraft(getDraftFromSettings(settingsByType[INTEGRATION_TYPES.SHARED], sharedFields));
    setErrors({});
  }, [settingsByType]);

  const expiryDays = daysUntil(pemsAuthDraft.tokenExpiryDate);

  const pemsExpiryStatus = useMemo(() => {
    if (!pemsAuthDraft.tokenExpiryDate || expiryDays == null) return null;
    if (expiryDays < 0) return { tone: "critical", text: "Token expired" };
    if (expiryDays <= 30) return { tone: "warning", text: `Token expires in ${expiryDays} day${expiryDays === 1 ? "" : "s"}` };
    return { tone: "ok", text: `Token valid for ${expiryDays} days` };
  }, [expiryDays, pemsAuthDraft.tokenExpiryDate]);

  function setFieldError(key, message) {
    setErrors((prev) => ({ ...prev, [key]: message }));
  }

  function clearFieldError(key) {
    setErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  function clearPanelErrors(panelPrefix) {
    setErrors((prev) => {
      const next = {};
      for (const [key, value] of Object.entries(prev)) {
        if (!key.startsWith(panelPrefix)) next[key] = value;
      }
      return next;
    });
  }

  function savePemsAuth() {
    clearPanelErrors("pems-auth");
    if (!isValidDate(pemsAuthDraft.tokenExpiryDate)) {
      setFieldError("pems-auth-tokenExpiryDate", "Please enter a valid date.");
      return;
    }
    if (pemsAuthDraft.active) {
      if (!String(pemsAuthDraft.userId ?? "").trim()) {
        setFieldError("pems-auth-userId", "User ID is required when PEMS is active.");
        return;
      }
      if (!String(pemsAuthDraft.vendorToken ?? "").trim()) {
        setFieldError("pems-auth-vendorToken", "Vendor Token is required when PEMS is active.");
        return;
      }
    }
    upsertIntegrationSettings(selectedSiteId, INTEGRATION_TYPES.PEMS, {
      active: Boolean(pemsAuthDraft.active),
      userId: String(pemsAuthDraft.userId ?? "").trim(),
      vendorToken: String(pemsAuthDraft.vendorToken ?? "").trim(),
      tokenExpiryDate: String(pemsAuthDraft.tokenExpiryDate ?? "").trim(),
    });
  }

  function savePemsUrlField(fieldKey) {
    clearFieldError(`pems-url-${fieldKey}`);
    const value = String(pemsUrlDraft[fieldKey] ?? "").trim();
    if (!isValidUrl(value)) {
      setFieldError(`pems-url-${fieldKey}`, "Please enter a valid URL.");
      return;
    }
    upsertIntegrationSettings(selectedSiteId, INTEGRATION_TYPES.PEMS, { [fieldKey]: value });
  }

  function saveContainerChain() {
    clearPanelErrors("container-chain");
    if (containerChainDraft.active && !String(containerChainDraft.containerChainPassword ?? "").trim()) {
      setFieldError("container-chain-password", "Password is required when ContainerChain is active.");
      return;
    }
    upsertIntegrationSettings(selectedSiteId, INTEGRATION_TYPES.CONTAINER_CHAIN, {
      active: Boolean(containerChainDraft.active),
      containerChainId: String(containerChainDraft.containerChainId ?? "").trim(),
      containerChainPassword: String(containerChainDraft.containerChainPassword ?? "").trim(),
    });
  }

  function saveContainerSpace() {
    clearPanelErrors("container-space");
    if (containerSpaceDraft.active && !String(containerSpaceDraft.containerSpacePassword ?? "").trim()) {
      setFieldError("container-space-password", "Password is required when ContainerSpace is active.");
      return;
    }
    upsertIntegrationSettings(selectedSiteId, INTEGRATION_TYPES.CONTAINER_SPACE, {
      active: Boolean(containerSpaceDraft.active),
      containerSpaceId: String(containerSpaceDraft.containerSpaceId ?? "").trim(),
      containerSpacePassword: String(containerSpaceDraft.containerSpacePassword ?? "").trim(),
    });
  }

  function savePra() {
    clearPanelErrors("pra");
    upsertIntegrationSettings(selectedSiteId, INTEGRATION_TYPES.PRA, {
      active: Boolean(praDraft.active),
      praInformation: String(praDraft.praInformation ?? "").trim(),
      daffSiteId: String(praDraft.daffSiteId ?? "").trim(),
    });
  }

  function saveSharedDefaults() {
    clearPanelErrors("shared");
    upsertIntegrationSettings(selectedSiteId, INTEGRATION_TYPES.SHARED, {
      fumigationProviderName: String(sharedDraft.fumigationProviderName ?? "").trim(),
      fumigationProviderLicense: String(sharedDraft.fumigationProviderLicense ?? "").trim(),
    });
  }

  if (!selectedSiteId) {
    return (
      <div className="space-y-4">
        <div>
          <p className="text-xs text-slate-500">System Settings / Integration Settings</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 md:text-[1.65rem]">Integration Settings</h1>
        </div>
        <div className="rounded-xl border border-slate-200/90 bg-white p-6 text-sm text-slate-500 shadow-sm">
          No sites found. Add a site first to configure integration settings.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs text-slate-500">System Settings / Integration Settings</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 md:text-[1.65rem]">
          Integration Settings
        </h1>
        <p className="mt-1 text-xs text-slate-500">
          Configure site-level credentials and endpoint URLs for operational integrations.
        </p>
      </div>

      <section className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">Site</label>
          {siteOptions.length > 1 ? (
            <select
              className={cn(inputClass, "w-[260px]")}
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
            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
              {siteLabel}
            </div>
          )}
        </div>
      </section>

      <section className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm">
        <div className="mb-4 flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                "inline-flex h-8 items-center rounded-md border px-3 text-xs font-semibold transition-colors",
                activeTab === tab.key
                  ? "border-blue-200 bg-blue-50 text-blue-700"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === INTEGRATION_TYPES.PEMS ? (
          <div className="grid gap-4 xl:grid-cols-2">
            <Panel
              title="PEMS Production Environment Settings"
              notConfigured={!panelIsConfigured(pemsAuthDraft, pemsAuthFields)}
              action={<Button type="button" size="sm" variant="secondary" disabled>Test Connection</Button>}
            >
              <ToggleRow
                checked={Boolean(pemsAuthDraft.active)}
                onChange={(value) => setPemsAuthDraft((prev) => ({ ...prev, active: value }))}
                label="Integration active"
              />
              <LabeledInput
                label="User ID"
                value={pemsAuthDraft.userId ?? ""}
                onChange={(value) => setPemsAuthDraft((prev) => ({ ...prev, userId: value }))}
                error={errors["pems-auth-userId"]}
              />
              <LabeledInput
                label="Vendor Token"
                type={showPemsToken ? "text" : "password"}
                value={pemsAuthDraft.vendorToken ?? ""}
                onChange={(value) => setPemsAuthDraft((prev) => ({ ...prev, vendorToken: value }))}
                error={errors["pems-auth-vendorToken"]}
                trailingButton={
                  <button
                    type="button"
                    className="rounded border border-slate-200 px-2 py-1 text-[10px] font-semibold text-slate-600 hover:bg-slate-50"
                    onClick={() => setShowPemsToken((prev) => !prev)}
                  >
                    {showPemsToken ? "Hide" : "Show"}
                  </button>
                }
              />
              <LabeledInput
                label="Token Expiry Date"
                type="date"
                value={pemsAuthDraft.tokenExpiryDate ?? ""}
                onChange={(value) => setPemsAuthDraft((prev) => ({ ...prev, tokenExpiryDate: value }))}
                error={errors["pems-auth-tokenExpiryDate"]}
              />
              {pemsExpiryStatus ? (
                <div
                  className={cn(
                    "rounded-md border px-2.5 py-2 text-xs",
                    pemsExpiryStatus.tone === "critical"
                      ? "border-rose-200 bg-rose-50 text-rose-700"
                      : pemsExpiryStatus.tone === "warning"
                        ? "border-amber-200 bg-amber-50 text-amber-700"
                        : "border-emerald-200 bg-emerald-50 text-emerald-700"
                  )}
                >
                  {pemsExpiryStatus.text}
                </div>
              ) : null}
              <PanelActions
                onCancel={() =>
                  setPemsAuthDraft(getDraftFromSettings(settingsByType[INTEGRATION_TYPES.PEMS], pemsAuthFields))
                }
                onSave={savePemsAuth}
              />
            </Panel>

            <Panel
              title="PEMS URLs"
              notConfigured={!panelIsConfigured(pemsUrlDraft, pemsUrlFields)}
            >
              <UrlFieldCard
                label="ECR URL (Empty Container Inspection)"
                value={pemsUrlDraft.ecrUrl ?? ""}
                error={errors["pems-url-ecrUrl"]}
                onChange={(value) => setPemsUrlDraft((prev) => ({ ...prev, ecrUrl: value }))}
                onCancel={() =>
                  setPemsUrlDraft((prev) => ({
                    ...prev,
                    ecrUrl: String(settingsByType[INTEGRATION_TYPES.PEMS]?.ecrUrl ?? ""),
                  }))
                }
                onSave={() => savePemsUrlField("ecrUrl")}
              />
              <UrlFieldCard
                label="GPPIR URL (Grain Inspection)"
                value={pemsUrlDraft.gppirUrl ?? ""}
                error={errors["pems-url-gppirUrl"]}
                onChange={(value) => setPemsUrlDraft((prev) => ({ ...prev, gppirUrl: value }))}
                onCancel={() =>
                  setPemsUrlDraft((prev) => ({
                    ...prev,
                    gppirUrl: String(settingsByType[INTEGRATION_TYPES.PEMS]?.gppirUrl ?? ""),
                  }))
                }
                onSave={() => savePemsUrlField("gppirUrl")}
              />
              <UrlFieldCard
                label="Re-Submission URL"
                value={pemsUrlDraft.resubmissionUrl ?? ""}
                error={errors["pems-url-resubmissionUrl"]}
                onChange={(value) => setPemsUrlDraft((prev) => ({ ...prev, resubmissionUrl: value }))}
                onCancel={() =>
                  setPemsUrlDraft((prev) => ({
                    ...prev,
                    resubmissionUrl: String(settingsByType[INTEGRATION_TYPES.PEMS]?.resubmissionUrl ?? ""),
                  }))
                }
                onSave={() => savePemsUrlField("resubmissionUrl")}
              />
              <UrlFieldCard
                label="File Attachment URL"
                value={pemsUrlDraft.fileAttachmentUrl ?? ""}
                error={errors["pems-url-fileAttachmentUrl"]}
                onChange={(value) => setPemsUrlDraft((prev) => ({ ...prev, fileAttachmentUrl: value }))}
                onCancel={() =>
                  setPemsUrlDraft((prev) => ({
                    ...prev,
                    fileAttachmentUrl: String(settingsByType[INTEGRATION_TYPES.PEMS]?.fileAttachmentUrl ?? ""),
                  }))
                }
                onSave={() => savePemsUrlField("fileAttachmentUrl")}
              />
            </Panel>
          </div>
        ) : null}

        {activeTab === INTEGRATION_TYPES.CONTAINER_CHAIN ? (
          <div className="grid gap-4">
            <Panel
              title="ContainerChain Settings"
              notConfigured={!panelIsConfigured(containerChainDraft, containerChainFields)}
              action={<Button type="button" size="sm" variant="secondary" disabled>Test Connection</Button>}
            >
              <ToggleRow
                checked={Boolean(containerChainDraft.active)}
                onChange={(value) => setContainerChainDraft((prev) => ({ ...prev, active: value }))}
                label="Integration active"
              />
              <LabeledInput
                label="ContainerChain ID"
                value={containerChainDraft.containerChainId ?? ""}
                onChange={(value) => setContainerChainDraft((prev) => ({ ...prev, containerChainId: value }))}
              />
              <LabeledInput
                label="ContainerChain Password"
                type={showContainerChainPassword ? "text" : "password"}
                value={containerChainDraft.containerChainPassword ?? ""}
                onChange={(value) =>
                  setContainerChainDraft((prev) => ({ ...prev, containerChainPassword: value }))
                }
                error={errors["container-chain-password"]}
                trailingButton={
                  <button
                    type="button"
                    className="rounded border border-slate-200 px-2 py-1 text-[10px] font-semibold text-slate-600 hover:bg-slate-50"
                    onClick={() => setShowContainerChainPassword((prev) => !prev)}
                  >
                    {showContainerChainPassword ? "Hide" : "Show"}
                  </button>
                }
              />
              <PanelActions
                onCancel={() =>
                  setContainerChainDraft(
                    getDraftFromSettings(settingsByType[INTEGRATION_TYPES.CONTAINER_CHAIN], containerChainFields)
                  )
                }
                onSave={saveContainerChain}
              />
            </Panel>
          </div>
        ) : null}

        {activeTab === INTEGRATION_TYPES.CONTAINER_SPACE ? (
          <div className="grid gap-4">
            <Panel
              title="ContainerSpace Settings"
              notConfigured={!panelIsConfigured(containerSpaceDraft, containerSpaceFields)}
              action={<Button type="button" size="sm" variant="secondary" disabled>Test Connection</Button>}
            >
              <ToggleRow
                checked={Boolean(containerSpaceDraft.active)}
                onChange={(value) => setContainerSpaceDraft((prev) => ({ ...prev, active: value }))}
                label="Integration active"
              />
              <LabeledInput
                label="ContainerSpace ID"
                value={containerSpaceDraft.containerSpaceId ?? ""}
                onChange={(value) => setContainerSpaceDraft((prev) => ({ ...prev, containerSpaceId: value }))}
              />
              <LabeledInput
                label="ContainerSpace Password"
                type={showContainerSpacePassword ? "text" : "password"}
                value={containerSpaceDraft.containerSpacePassword ?? ""}
                onChange={(value) =>
                  setContainerSpaceDraft((prev) => ({ ...prev, containerSpacePassword: value }))
                }
                error={errors["container-space-password"]}
                trailingButton={
                  <button
                    type="button"
                    className="rounded border border-slate-200 px-2 py-1 text-[10px] font-semibold text-slate-600 hover:bg-slate-50"
                    onClick={() => setShowContainerSpacePassword((prev) => !prev)}
                  >
                    {showContainerSpacePassword ? "Hide" : "Show"}
                  </button>
                }
              />
              <PanelActions
                onCancel={() =>
                  setContainerSpaceDraft(
                    getDraftFromSettings(settingsByType[INTEGRATION_TYPES.CONTAINER_SPACE], containerSpaceFields)
                  )
                }
                onSave={saveContainerSpace}
              />
            </Panel>
          </div>
        ) : null}

        {activeTab === INTEGRATION_TYPES.PRA ? (
          <div className="grid gap-4">
            <Panel
              title="PRA Settings"
              notConfigured={!panelIsConfigured(praDraft, praFields)}
              action={<Button type="button" size="sm" variant="secondary" disabled>Test Connection</Button>}
            >
              <ToggleRow
                checked={Boolean(praDraft.active)}
                onChange={(value) => setPraDraft((prev) => ({ ...prev, active: value }))}
                label="Integration active"
              />
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                  PRA Information
                </label>
                <textarea
                  className={cn(inputClass, "min-h-24 resize-y py-2")}
                  value={praDraft.praInformation ?? ""}
                  onChange={(event) => setPraDraft((prev) => ({ ...prev, praInformation: event.target.value }))}
                  placeholder="Optional details or structured notes for PRA configuration."
                />
              </div>
              <LabeledInput
                label="DAFF Site ID"
                value={praDraft.daffSiteId ?? ""}
                onChange={(value) => setPraDraft((prev) => ({ ...prev, daffSiteId: value }))}
              />
              <PanelActions
                onCancel={() =>
                  setPraDraft(getDraftFromSettings(settingsByType[INTEGRATION_TYPES.PRA], praFields))
                }
                onSave={savePra}
              />
            </Panel>
          </div>
        ) : null}
        {activeTab === INTEGRATION_TYPES.SHARED ? (
          <div className="grid gap-4">
            <Panel
              title="Fumigation Settings"
              notConfigured={!panelIsConfigured(sharedDraft, sharedFields)}
            >
              <LabeledInput
                label="Fumigation Service Provider Entity Name"
                value={sharedDraft.fumigationProviderName ?? ""}
                onChange={(value) =>
                  setSharedDraft((prev) => ({ ...prev, fumigationProviderName: value }))
                }
              />
              <LabeledInput
                label="Fumigation Service Provider Entity License"
                value={sharedDraft.fumigationProviderLicense ?? ""}
                onChange={(value) =>
                  setSharedDraft((prev) => ({ ...prev, fumigationProviderLicense: value }))
                }
              />
              <PanelActions
                onCancel={() =>
                  setSharedDraft(getDraftFromSettings(settingsByType[INTEGRATION_TYPES.SHARED], sharedFields))
                }
                onSave={saveSharedDefaults}
              />
            </Panel>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function Panel({ title, action, children, notConfigured }) {
  return (
    <section className="rounded-xl border border-slate-200/90 bg-slate-50/80 p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        {action ? <div className="ms-auto">{action}</div> : null}
      </div>
      {notConfigured ? <p className="mb-3 text-xs text-slate-400">Not configured yet.</p> : null}
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function ToggleRow({ label, checked, onChange }) {
  return (
    <label className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700">
      <input suppressHydrationWarning type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      {label}
    </label>
  );
}

function LabeledInput({ label, value, onChange, type = "text", error, trailingButton }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">{label}</label>
      <div className="flex items-center gap-2">
        <input
          type={type}
          className={inputClass}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Not configured"
        />
        {trailingButton ? trailingButton : null}
      </div>
      {error ? <p className="text-xs text-rose-600">{error}</p> : null}
    </div>
  );
}

function PanelActions({ className, onSave, onCancel }) {
  return (
    <div className={cn("flex items-center justify-end gap-2", className)}>
      <button type="button" className="inline-flex h-7 items-center rounded-md border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50" onClick={onCancel}>
        Cancel
      </button>
      <button type="button" className={saveButtonClass(false)} onClick={onSave}>
        Save
      </button>
    </div>
  );
}

function UrlFieldCard({ label, value, onChange, onSave, onCancel, error }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="mb-1 flex items-center gap-2">
        <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">{label}</label>
        <span
          className={cn(
            "ms-auto rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1",
            value ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-slate-100 text-slate-500 ring-slate-200"
          )}
        >
          {value ? "Configured" : "Not configured"}
        </span>
      </div>
      <input
        type="text"
        className={inputClass}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="https://example.com"
      />
      {error ? <p className="mt-1 text-xs text-rose-600">{error}</p> : null}
      <div className="mt-2 flex justify-end gap-2">
        <button
          type="button"
          className="inline-flex h-7 items-center rounded-md border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          onClick={onCancel}
        >
          Cancel
        </button>
        <button type="button" className={saveButtonClass(false)} onClick={onSave}>
          Save
        </button>
      </div>
    </div>
  );
}