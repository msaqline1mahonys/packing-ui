"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import ClutchSelect, { toOptions } from "@/components/custom/ClutchSelect";
import { Button } from "@/components/ui/button";
import { useInvalidateReferenceData } from "@/lib/hooks/use-reference-data-queries";
import { registerPackFormQuickAdd } from "@/lib/pack-form-quick-add";
import { PACK_FORM_QUICK_ADD_CONFIG, getQuickAddLabel, quickAddCreatedOption } from "@/lib/pack-form-quick-add-config";
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

export function usePackFormQuickAddOptional() {
  return useContext(PackFormQuickAddContext);
}

function resolveFieldOptions(field, lookupOptions, createdOptions) {
  let options = [];
  if (field.optionsKey && lookupOptions?.[field.optionsKey]) {
    options = lookupOptions[field.optionsKey];
  } else if (Array.isArray(field.options)) {
    options = field.options.map((opt) => (typeof opt === "string" ? { value: opt, label: opt } : opt));
  }
  if (field.optionsKey && createdOptions[field.optionsKey]?.length) {
    const seen = new Set(options.map((opt) => String(opt.value)));
    const extra = createdOptions[field.optionsKey].filter((opt) => !seen.has(String(opt.value)));
    options = [...extra, ...options];
  }
  return options;
}

function parentFieldPatch(parentEntityKey, childEntityKey, created) {
  const parentConfig = PACK_FORM_QUICK_ADD_CONFIG[parentEntityKey];
  const field = parentConfig?.fields?.find((f) => f.quickAdd === childEntityKey);
  const option = quickAddCreatedOption(childEntityKey, created);
  if (!field || !option) return null;
  return { field, option };
}

function QuickAddFieldInput({ field, value, onChange, disabled, lookupOptions, createdOptions, openQuickAdd }) {
  const options = resolveFieldOptions(field, lookupOptions, createdOptions);
  const selectOptions = toOptions(options);
  const addNewProps =
    field.quickAdd && openQuickAdd
      ? {
          addNew: {
            label: getQuickAddLabel(field.quickAdd),
            onAddNew: () => openQuickAdd(field.quickAdd),
          },
        }
      : {};

  return (
    <div className={cn("space-y-1", field.wide && "sm:col-span-2")}>
      <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">
        {field.label}
        {field.required ? <span className="text-red-500"> *</span> : null}
      </label>
      {field.type === "select" ? (
        <ClutchSelect
          placeholder="Select..."
          options={selectOptions}
          value={selectOptions.find((o) => String(o.value) === String(value ?? "")) ?? null}
          isDisabled={disabled}
          onChange={(option) => onChange(option ? option.value : "")}
          {...addNewProps}
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

function PackFormQuickAddDialog({
  entry,
  lookupOptions,
  createdOptions,
  openQuickAdd,
  onClose,
  onFieldChange,
  onSave,
  isSaving,
  error,
}) {
  const config = PACK_FORM_QUICK_ADD_CONFIG[entry.entityKey];
  if (!config) return null;

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
                value={entry.draft[field.key]}
                disabled={isSaving}
                lookupOptions={lookupOptions}
                createdOptions={createdOptions}
                openQuickAdd={openQuickAdd}
                onChange={(value) => onFieldChange(field.key, value)}
              />
            ))}
          </div>
          <div className="mt-4 flex justify-end gap-2 border-t border-slate-100 pt-3">
            <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={isSaving}>
              Cancel
            </Button>
            <Button type="button" size="sm" onClick={onSave} disabled={isSaving}>
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
  context: contextProp,
  onEntityCreated,
}) {
  const invalidateReferenceData = useInvalidateReferenceData();
  const [stack, setStack] = useState([]);
  const [createdOptions, setCreatedOptions] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  const context = useMemo(
    () => ({ defaultSiteId: contextProp?.defaultSiteId ?? "" }),
    [contextProp?.defaultSiteId],
  );

  const openQuickAdd = useCallback(
    (entityKey, { onCreated } = {}) => {
      if (customHandlers[entityKey]) {
        customHandlers[entityKey]({ onCreated });
        return;
      }
      const config = PACK_FORM_QUICK_ADD_CONFIG[entityKey];
      if (!config) return;
      setError("");
      setStack((prev) => [
        ...prev,
        { entityKey, draft: config.initialValues(context), onCreated: onCreated ?? null },
      ]);
    },
    [customHandlers, context],
  );

  const closeQuickAdd = useCallback(() => {
    setError("");
    setStack((prev) => prev.slice(0, -1));
  }, []);

  const updateField = useCallback((key, value) => {
    setStack((prev) => {
      if (!prev.length) return prev;
      const next = [...prev];
      const top = next[next.length - 1];
      next[next.length - 1] = { ...top, draft: { ...top.draft, [key]: value } };
      return next;
    });
  }, []);

  const handleSave = useCallback(async () => {
    const top = stack[stack.length - 1];
    const config = top ? PACK_FORM_QUICK_ADD_CONFIG[top.entityKey] : null;
    if (!top || !config) return;

    const validationError = config.validate?.(top.draft);
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSaving(true);
    setError("");
    try {
      const created = await config.save(top.draft, context);
      const option = quickAddCreatedOption(top.entityKey, created);
      top.onCreated?.(created);
      onEntityCreated?.(top.entityKey, created);

      const parent = stack.length > 1 ? stack[stack.length - 2] : null;
      const patch = parent ? parentFieldPatch(parent.entityKey, top.entityKey, created) : null;
      if (patch?.field?.optionsKey && patch.option) {
        const optionsKey = patch.field.optionsKey;
        setCreatedOptions((prev) => ({
          ...prev,
          [optionsKey]: [
            ...(prev[optionsKey] || []).filter((opt) => String(opt.value) !== String(patch.option.value)),
            patch.option,
          ],
        }));
      }

      setStack((prev) => {
        if (prev.length <= 1) return [];
        const next = prev.slice(0, -1);
        const parent = next[next.length - 1];
        const patch = parentFieldPatch(parent.entityKey, top.entityKey, created);
        if (!patch) return next;
        next[next.length - 1] = {
          ...parent,
          draft: { ...parent.draft, [patch.field.key]: patch.option.value },
        };
        return next;
      });

      if (config.invalidateKey) {
        await invalidateReferenceData(config.invalidateKey);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save.");
    } finally {
      setIsSaving(false);
    }
  }, [stack, context, onEntityCreated, invalidateReferenceData]);

  const value = useMemo(() => ({ openQuickAdd, getQuickAddLabel }), [openQuickAdd]);

  useEffect(() => {
    registerPackFormQuickAdd(openQuickAdd);
    return () => registerPackFormQuickAdd(null);
  }, [openQuickAdd]);

  useEffect(() => {
    if (stack.length === 0) setCreatedOptions({});
  }, [stack.length]);

  const top = stack[stack.length - 1] ?? null;

  return (
    <PackFormQuickAddContext.Provider value={value}>
      {children}
      {top ? (
        <PackFormQuickAddDialog
          entry={top}
          lookupOptions={lookupOptions}
          createdOptions={createdOptions}
          openQuickAdd={openQuickAdd}
          onClose={closeQuickAdd}
          onFieldChange={updateField}
          onSave={handleSave}
          isSaving={isSaving}
          error={error}
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
