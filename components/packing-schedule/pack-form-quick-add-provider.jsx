"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import ClutchSelect, { toOptions } from "@/components/custom/ClutchSelect";
import { Button } from "@/components/ui/button";
import { useInvalidateReferenceData } from "@/lib/hooks/use-reference-data-queries";
import { registerPackFormQuickAdd } from "@/lib/pack-form-quick-add";
import { PACK_FORM_QUICK_ADD_CONFIG, getQuickAddLabel } from "@/lib/pack-form-quick-add-config";
import { cn } from "@/lib/utils";
import { numberInputProps } from "@/lib/number-input";

const inputClass =
  "w-full rounded-lg border border-slate-200/95 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-brand/15 placeholder:text-slate-400 focus:border-brand/35 focus:ring-2";

const PackFormQuickAddContext = createContext(null);

export function usePackFormQuickAdd() {
  const ctx = useContext(PackFormQuickAddContext);
  if (!ctx) {
    throw new Error("usePackFormQuickAdd must be used within PackFormQuickAddProvider");
  }
  return ctx;
}

/** Optional hook for components that may render outside the pack form. */
export function usePackFormQuickAddOptional() {
  return useContext(PackFormQuickAddContext);
}

function resolveFieldOptions(field, lookupOptions) {
  if (field.optionsKey && lookupOptions?.[field.optionsKey]) {
    return lookupOptions[field.optionsKey];
  }
  if (Array.isArray(field.options)) {
    return field.options.map((opt) =>
      typeof opt === "string" ? { value: opt, label: opt } : opt,
    );
  }
  return [];
}

function QuickAddFieldInput({ field, value, onChange, disabled, lookupOptions }) {
  const options = resolveFieldOptions(field, lookupOptions);
  return (
    <div className={cn("space-y-1", field.wide && "sm:col-span-2")}>
      <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">
        {field.label}
        {field.required ? <span className="text-red-500"> *</span> : null}
      </label>
      {field.type === "select" ? (
        <ClutchSelect
          placeholder="Select..."
          options={toOptions(options)}
          value={toOptions(options).find((o) => String(o.value) === String(value ?? "")) ?? null}
          isDisabled={disabled}
          onChange={(option) => onChange(option ? option.value : "")}
        />
      ) : (
        <input
          type={field.type || "text"}
          className={inputClass}
          value={value ?? ""}
          disabled={disabled}
          placeholder={field.placeholder}
          onChange={(e) => onChange(e.target.value)}
          {...numberInputProps(field.type)}
        />
      )}
    </div>
  );
}

function PackFormQuickAddDialog({ entityKey, lookupOptions, context, onClose, onSaved }) {
  const config = PACK_FORM_QUICK_ADD_CONFIG[entityKey];
  const invalidateReferenceData = useInvalidateReferenceData();
  const [draft, setDraft] = useState(() => config?.initialValues?.(context) ?? {});
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!config) return;
    setDraft(config.initialValues(context));
    setError("");
    setIsSaving(false);
  }, [entityKey, config, context]);

  if (!config) return null;

  const setField = (key, value) => setDraft((prev) => ({ ...prev, [key]: value }));

  async function handleSave() {
    const validationError = config.validate?.(draft);
    if (validationError) {
      setError(validationError);
      return;
    }
    setIsSaving(true);
    setError("");
    try {
      const created = await config.save(draft, context);
      if (config.invalidateKey) {
        await invalidateReferenceData(config.invalidateKey);
      }
      onSaved?.(created);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <button type="button" className="absolute inset-0 bg-black/40" aria-label="Close dialog" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="pack-quick-add-title"
        className="relative max-h-[min(90vh,720px)] w-full max-w-lg overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-4 py-3">
          <h2 id="pack-quick-add-title" className="text-sm font-semibold text-slate-900">
            Add {config.title}
          </h2>
          <button
            type="button"
            className="rounded-md px-2 py-1 text-lg text-slate-500 hover:bg-slate-100"
            onClick={onClose}
            disabled={isSaving}
          >
            ×
          </button>
        </div>
        <div className="p-4">
          {error ? (
            <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-600">{error}</div>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-2">
            {config.fields.map((field) => (
              <QuickAddFieldInput
                key={field.key}
                field={field}
                value={draft[field.key]}
                disabled={isSaving}
                lookupOptions={lookupOptions}
                onChange={(value) => setField(field.key, value)}
              />
            ))}
          </div>
          <div className="mt-4 flex justify-end gap-2 border-t border-slate-100 pt-3">
            <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={isSaving}>
              Cancel
            </Button>
            <Button type="button" size="sm" onClick={handleSave} disabled={isSaving}>
              {isSaving ? "Saving…" : "Create"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function PackFormQuickAddProvider({
  children,
  customHandlers = {},
  lookupOptions = {},
  context = {},
  onEntityCreated,
}) {
  const [activeEntity, setActiveEntity] = useState(null);
  const [onCreatedRef, setOnCreatedRef] = useState(null);

  const openQuickAdd = useCallback(
    (entityKey, { onCreated } = {}) => {
      if (customHandlers[entityKey]) {
        customHandlers[entityKey]({ onCreated });
        return;
      }
      if (!PACK_FORM_QUICK_ADD_CONFIG[entityKey]) return;
      setOnCreatedRef(() => onCreated ?? null);
      setActiveEntity(entityKey);
    },
    [customHandlers],
  );

  const closeQuickAdd = useCallback(() => {
    setActiveEntity(null);
    setOnCreatedRef(null);
  }, []);

  const value = useMemo(
    () => ({
      openQuickAdd,
      getQuickAddLabel,
    }),
    [openQuickAdd],
  );

  useEffect(() => {
    registerPackFormQuickAdd(openQuickAdd);
    return () => registerPackFormQuickAdd(null);
  }, [openQuickAdd]);

  return (
    <PackFormQuickAddContext.Provider value={value}>
      {children}
      {activeEntity ? (
        <PackFormQuickAddDialog
          entityKey={activeEntity}
          lookupOptions={lookupOptions}
          context={context}
          onClose={closeQuickAdd}
          onSaved={(created) => {
            onEntityCreated?.(activeEntity, created);
            onCreatedRef?.(created);
          }}
        />
      ) : null}
    </PackFormQuickAddContext.Provider>
  );
}

export function packFormQuickAddProps(entityKey, openQuickAdd) {
  if (!entityKey || !openQuickAdd) return {};
  return {
    addNew: {
      label: getQuickAddLabel(entityKey),
      onAddNew: () => openQuickAdd(entityKey),
    },
  };
}
