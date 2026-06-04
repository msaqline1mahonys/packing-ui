"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api"
).replace(/\/+$/, "");
const CMOS_ENDPOINT = `${API_BASE_URL}/ticketing/cmos`;
const CUSTOMERS_ENDPOINT = `${API_BASE_URL}/reference-data/customers`;
const COMMODITY_TYPES_ENDPOINT = `${API_BASE_URL}/product-settings/commodity-types`;
const COMMODITIES_ENDPOINT = `${API_BASE_URL}/product-settings/commodities`;

const inputClass =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-brand/15 focus:border-brand/35 focus:ring-2";
const sectionClass = "rounded-xl border border-slate-200/95 bg-white p-5 shadow-sm";

const DIRECTION_OPTIONS = [
  { value: "incoming", label: "Incoming" },
  { value: "outgoing", label: "Outgoing" },
];
const STATUS_OPTIONS = ["Open", "In Progress", "Completed", "Cancelled"];

function readAuthPayload() {
  try {
    return JSON.parse(localStorage.getItem("authPayload") || "{}");
  } catch {
    return {};
  }
}

function getAuthHeaders() {
  const token = localStorage.getItem("authToken");
  return {
    Accept: "application/json",
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function getTenantPayload() {
  const authPayload = readAuthPayload();
  return {
    ...(authPayload.organization?.id ? { organization_id: authPayload.organization.id } : {}),
    ...(authPayload.current_site?.id ? { site_id: authPayload.current_site.id } : {}),
  };
}

function extractApiError(result, fallback) {
  if (result?.errors) {
    return Object.values(result.errors).flat().join(", ");
  }
  return result?.message || fallback;
}

async function apiRequest(url, path = "", options = {}) {
  const response = await fetch(`${url}${path}`, {
    ...options,
    headers: {
      ...getAuthHeaders(),
      ...(options.headers || {}),
    },
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || result?.success === false) {
    throw new Error(extractApiError(result, "Request failed."));
  }
  return result;
}

async function cmoRequest(path = "", options = {}) {
  return apiRequest(CMOS_ENDPOINT, path, options);
}

function parseList(result) {
  const pager = result?.data;
  return Array.isArray(pager?.data) ? pager.data : Array.isArray(pager) ? pager : [];
}

function fromApiCmo(row) {
  if (!row) return null;
  const customer = row.customer ?? null;
  const commodityType = row.commodity_type ?? row.commodityType ?? null;
  const commodity = row.commodity ?? null;

  return {
    id: row.id,
    cmoReference: row.cmo_reference ?? row.cmoReference ?? "",
    direction: row.direction ?? "incoming",
    customerId: row.customer_id ?? row.customerId ?? customer?.id ?? "",
    customerName: customer?.name ?? "",
    commodityTypeId: row.commodity_type_id ?? row.commodityTypeId ?? commodityType?.id ?? "",
    commodityTypeName: commodityType?.name ?? "",
    commodityId: row.commodity_id ?? row.commodityId ?? commodity?.id ?? "",
    commodityName: commodity?.description ?? commodity?.commodity_code ?? "",
    status: row.status ?? STATUS_OPTIONS[0],
    estimatedAmount:
      row.estimated_amount != null ? String(row.estimated_amount) : row.estimatedAmount ?? "0",
    actualAmountDelivered:
      row.actual_amount_delivered != null
        ? String(row.actual_amount_delivered)
        : row.actualAmountDelivered ?? "0",
    additionalReferences: Array.isArray(row.additional_references)
      ? row.additional_references
      : Array.isArray(row.additionalReferences)
        ? row.additionalReferences
        : [],
    attachments: Array.isArray(row.attachments) ? row.attachments : [],
    note: row.note ?? "",
  };
}

function toApiPayload(draft) {
  const tenant = getTenantPayload();
  return {
    ...tenant,
    cmo_reference: String(draft.cmoReference ?? "").trim(),
    direction: draft.direction || "incoming",
    customer_id: draft.customerId,
    commodity_type_id: draft.commodityTypeId,
    commodity_id: draft.commodityId,
    status: draft.status || STATUS_OPTIONS[0],
    estimated_amount: draft.estimatedAmount === "" ? 0 : Number(draft.estimatedAmount) || 0,
    actual_amount_delivered: draft.actualAmountDelivered === "" ? 0 : Number(draft.actualAmountDelivered) || 0,
    additional_references: draft.additionalReferences ?? [],
    attachments: draft.attachments ?? [],
    note: String(draft.note ?? "").trim() || null,
  };
}

function emptyForm() {
  return {
    cmoReference: "",
    direction: "incoming",
    customerId: "",
    commodityTypeId: "",
    commodityId: "",
    status: STATUS_OPTIONS[0],
    estimatedAmount: "0",
    actualAmountDelivered: "0",
    additionalReferenceDraft: "",
    additionalReferences: [],
    attachments: [],
    note: "",
  };
}

export default function CmoForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("edit");
  const isEdit = Boolean(editId);

  const [form, setForm] = useState(() => emptyForm());
  const [customers, setCustomers] = useState([]);
  const [commodityTypes, setCommodityTypes] = useState([]);
  const [commodities, setCommodities] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  const loadOptions = useCallback(async () => {
    const tenant = getTenantPayload();
    const params = new URLSearchParams({ per_page: "500", ...tenant });

    const [customersResult, typesResult, commoditiesResult] = await Promise.all([
      apiRequest(CUSTOMERS_ENDPOINT, `?${params.toString()}`),
      apiRequest(COMMODITY_TYPES_ENDPOINT, `?${params.toString()}`),
      apiRequest(COMMODITIES_ENDPOINT, `?${params.toString()}`),
    ]);

    setCustomers(parseList(customersResult));
    setCommodityTypes(parseList(typesResult));
    setCommodities(parseList(commoditiesResult));
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setIsLoading(true);
      setError("");
      try {
        await loadOptions();

        if (editId) {
          const result = await cmoRequest(`/${editId}`);
          const row = fromApiCmo(result?.data);
          if (cancelled || !row) return;
          setForm({
            cmoReference: row.cmoReference,
            direction: row.direction,
            customerId: row.customerId,
            commodityTypeId: row.commodityTypeId,
            commodityId: row.commodityId,
            status: row.status,
            estimatedAmount: row.estimatedAmount,
            actualAmountDelivered: row.actualAmountDelivered,
            additionalReferenceDraft: "",
            additionalReferences: row.additionalReferences,
            attachments: row.attachments,
            note: row.note,
          });
        }
      } catch (err) {
        if (!cancelled) setError(err.message || "Failed to load CMO form data.");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [editId, loadOptions]);

  const commodityChoices = useMemo(
    () =>
      commodities.filter(
        (item) =>
          !form.commodityTypeId ||
          (item.commodity_type_id ?? item.commodityTypeId) === form.commodityTypeId
      ),
    [commodities, form.commodityTypeId]
  );

  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const addAdditionalReference = () => {
    const ref = form.additionalReferenceDraft.trim();
    if (!ref) return;
    setForm((prev) => ({
      ...prev,
      additionalReferences: [...prev.additionalReferences, ref],
      additionalReferenceDraft: "",
    }));
  };

  const removeAdditionalReference = (idx) => {
    setForm((prev) => ({
      ...prev,
      additionalReferences: prev.additionalReferences.filter((_, i) => i !== idx),
    }));
  };

  const canSave =
    form.cmoReference.trim() &&
    form.customerId &&
    form.commodityTypeId &&
    form.commodityId &&
    form.status;

  const saveCmo = async () => {
    if (!canSave || isSaving) return;

    setIsSaving(true);
    setError("");
    try {
      const payload = toApiPayload(form);
      if (isEdit) {
        await cmoRequest(`/${editId}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
      } else {
        await cmoRequest("", {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }
      router.push("/ticketing/cmo");
    } catch (err) {
      setError(err.message || "Failed to save CMO.");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-[min(92rem,calc(100%-2rem))] px-5 py-10 text-sm text-slate-500 sm:px-6 lg:px-8">
        Loading CMO…
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[min(92rem,calc(100%-2rem))] space-y-3 px-5 pt-2 pb-10 sm:px-6 sm:pt-3 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">{isEdit ? "Edit CMO" : "Create CMO"}</h1>
          <p className="mt-1 text-xs text-slate-500">
            {isEdit ? "Update an existing CMO record." : "Create and save a new CMO record."}
          </p>
        </div>
        <Link href="/ticketing/cmo" className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
          Back
        </Link>
      </div>

      {error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</div>
      ) : null}

      <section className={sectionClass}>
        <div className="space-y-4">
          <input suppressHydrationWarning className="h-10 w-full rounded-md border border-slate-200 bg-slate-100 px-3 text-xs font-semibold uppercase tracking-wide text-slate-500" value="CMO reference will be auto-generated" disabled readOnly />
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Field label="CMO Reference" required>
              <input
                className={inputClass}
                value={form.cmoReference}
                onChange={(e) => setField("cmoReference", e.target.value)}
                placeholder="e.g. CMO-0142"
              />
            </Field>

            <Field label="Direction" required>
              <select suppressHydrationWarning className={inputClass} value={form.direction} onChange={(e) => setField("direction", e.target.value)}>
                {DIRECTION_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Customer / Account" required>
              <select suppressHydrationWarning className={inputClass} value={form.customerId} onChange={(e) => setField("customerId", e.target.value)}>
                <option value="">â€” Select Customer / Account â€”</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Status" required>
              <select suppressHydrationWarning className={inputClass} value={form.status} onChange={(e) => setField("status", e.target.value)}>
                <option value="">â€” Select Status â€”</option>
                {STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Commodity Type" required>
              <select
                className={inputClass}
                value={form.commodityTypeId}
                onChange={(e) => {
                  setField("commodityTypeId", e.target.value);
                  setField("commodityId", "");
                }}
              >
                <option value="">â€” Select Commodity Type â€”</option>
                {commodityTypes.map((ct) => (
                  <option key={ct.id} value={ct.id}>
                    {ct.name}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Commodity" required>
              <select suppressHydrationWarning className={inputClass} value={form.commodityId} onChange={(e) => setField("commodityId", e.target.value)} disabled={!form.commodityTypeId}>
                <option value="">â€” Select Commodity â€”</option>
                {commodityChoices.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.description || c.commodity_code || c.name}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Estimated Amount (T)">
              <input suppressHydrationWarning className={inputClass} inputMode="decimal" value={form.estimatedAmount} onChange={(e) => setField("estimatedAmount", e.target.value)} />
            </Field>

            <Field label="Actual Amount Delivered (T)">
              <input suppressHydrationWarning className={inputClass} inputMode="decimal" value={form.actualAmountDelivered} onChange={(e) => setField("actualAmountDelivered", e.target.value)} />
            </Field>
          </div>
        </div>
      </section>

      <section className={sectionClass}>
        <div className="grid gap-4 lg:grid-cols-2">
          <Field label="Additional References">
            <div className="flex gap-2">
              <input suppressHydrationWarning className={inputClass} value={form.additionalReferenceDraft} onChange={(e) => setField("additionalReferenceDraft", e.target.value)} placeholder="e.g. REF-2024-001" />
              <Button type="button" variant="secondary" onClick={addAdditionalReference}>
                + Add
              </Button>
            </div>
            {form.additionalReferences.length ? (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {form.additionalReferences.map((ref, index) => (
                  <button
                    key={`${ref}-${index}`}
                    type="button"
                    onClick={() => removeAdditionalReference(index)}
                    className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-700 hover:bg-slate-200"
                    title="Click to remove"
                  >
                    {ref}
                  </button>
                ))}
              </div>
            ) : null}
          </Field>

          <Field label="Attach Files">
            <div className="space-y-2">
              <input
                type="file"
                multiple
                className="block h-9 w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-sm text-slate-700 file:me-3 file:rounded file:border-0 file:bg-brand/10 file:px-2.5 file:py-1 file:text-xs file:font-semibold file:text-brand hover:file:bg-brand/15"
                onChange={(e) => {
                  const files = Array.from(e.target.files || []).map((file) => file.name);
                  setField("attachments", files);
                }}
              />
              {form.attachments.length ? (
                <div className="flex flex-wrap gap-1.5">
                  {form.attachments.map((fileName, index) => (
                    <span key={`${fileName}-${index}`} className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-700">
                      {fileName}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500">No files selected.</p>
              )}
            </div>
          </Field>
        </div>

        <div className="mt-4">
          <Field label="Note">
            <textarea suppressHydrationWarning className={`${inputClass} min-h-[90px] resize-y`} value={form.note} onChange={(e) => setField("note", e.target.value)} />
          </Field>
        </div>
      </section>

      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="ghost" onClick={() => router.push("/ticketing/cmo")}>
          Cancel
        </Button>
        <Button type="button" onClick={saveCmo} disabled={!canSave || isSaving}>
          {isSaving ? "Saving…" : isEdit ? "Update CMO" : "Create CMO"}
        </Button>
      </div>
    </div>
  );
}

function Field({ label, required, children }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold uppercase tracking-wide text-slate-600">
        {label} {required ? <span className="text-rose-500">*</span> : null}
      </label>
      {children}
    </div>
  );
}