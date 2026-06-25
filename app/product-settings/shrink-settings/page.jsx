"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import FormRow from "@/components/form/form-row";
import FormInput from "@/components/form/form-input";
import { commodityOptionLabel } from "@/lib/commodity-display";
import { buildRequiredFieldErrorsFromRules, clearFieldError, hasFieldErrors } from "@/lib/form-validation";
import { inputClassName } from "@/lib/form-styles";

const TYPE_MODAL_FIELD_RULES = [
    { key: "commodityType", required: true },
    { key: "shrinkPct", required: true },
];
const COMMODITY_MODAL_FIELD_RULES = [
    { key: "commodity", required: true },
    { key: "shrinkPct", required: true },
];
const CC_MODAL_FIELD_RULES = [
    { key: "customer", required: true },
    { key: "commodity", required: true },
    { key: "shrinkPct", required: true },
];

const API_BASE_URL = (
    process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api"
).replace(/\/+$/, "");
const SHRINK_SETTINGS_ENDPOINT = `${API_BASE_URL}/product-settings/shrink-settings`;
const SHRINK_DEFAULT_ENDPOINT = `${API_BASE_URL}/product-settings/shrink-default`;
const CUSTOMER_COMMODITY_RULES_ENDPOINT = `${API_BASE_URL}/product-settings/customer-commodity-shrink-rules`;

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

async function apiRequest(url, options = {}) {
    const response = await fetch(url, {
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

    return result?.data ?? result;
}

export default function ShrinkSettingsPage() {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [savingDefault, setSavingDefault] = useState(false);
    const [savingRule, setSavingRule] = useState(false);

    const [defaultShrink, setDefaultShrink] = useState("0");
    const [savedDefaultShrink, setSavedDefaultShrink] = useState("0");

    const [commodityTypeShrinkRules, setCommodityTypeShrinkRules] = useState([]);
    const [commodityShrinkRules, setCommodityShrinkRules] = useState([]);
    const [customerCommodityRules, setCustomerCommodityRules] = useState([]);

    const [formCustomers, setFormCustomers] = useState([]);
    const [formCommodities, setFormCommodities] = useState([]);
    const [formCommodityTypes, setFormCommodityTypes] = useState([]);

    const [ccModalOpen, setCcModalOpen] = useState(false);
    const [typeModalOpen, setTypeModalOpen] = useState(false);
    const [commodityModalOpen, setCommodityModalOpen] = useState(false);

    const [customer, setCustomer] = useState("");
    const [commodity, setCommodity] = useState("");
    const [commodityType, setCommodityType] = useState("");
    const [shrinkPct, setShrinkPct] = useState("");

    const [typeFieldErrors, setTypeFieldErrors] = useState({});
    const [commodityFieldErrors, setCommodityFieldErrors] = useState({});
    const [ccFieldErrors, setCcFieldErrors] = useState({});

    const commodityTypeById = useMemo(
        () => new Map(formCommodityTypes.map((item) => [item.id, item])),
        [formCommodityTypes]
    );
    const commodityById = useMemo(
        () => new Map(formCommodities.map((item) => [item.id, item])),
        [formCommodities]
    );
    const customerById = useMemo(
        () => new Map(formCustomers.map((item) => [item.id, item])),
        [formCustomers]
    );

    const loadSettings = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const [settings, formData] = await Promise.all([
                apiRequest(SHRINK_SETTINGS_ENDPOINT),
                apiRequest(`${SHRINK_SETTINGS_ENDPOINT}/form-data`),
            ]);

            const defaultPct = String(settings?.defaultShrinkPercent ?? 0);
            setDefaultShrink(defaultPct);
            setSavedDefaultShrink(defaultPct);
            setCommodityTypeShrinkRules(settings?.commodityTypeShrinkRules ?? []);
            setCommodityShrinkRules(settings?.commodityShrinkRules ?? []);
            setCustomerCommodityRules(settings?.customerCommodityShrinkRules ?? []);

            setFormCustomers(formData?.customers ?? []);
            setFormCommodityTypes(formData?.commodityTypes ?? []);
            setFormCommodities(formData?.commodities ?? []);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Unable to load shrink settings.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadSettings();
    }, [loadSettings]);

    const handleSaveDefault = async () => {
        const parsed = Number.parseFloat(defaultShrink);
        if (!Number.isFinite(parsed) || parsed < 0) return;

        setSavingDefault(true);
        setError("");
        try {
            const result = await apiRequest(SHRINK_DEFAULT_ENDPOINT, {
                method: "PUT",
                body: JSON.stringify({
                    ...getTenantPayload(),
                    default_shrink_percent: parsed,
                }),
            });
            const saved = String(result?.defaultShrinkPercent ?? parsed);
            setSavedDefaultShrink(saved);
            setDefaultShrink(saved);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Unable to save default shrink.");
        } finally {
            setSavingDefault(false);
        }
    };

    const resetModalFields = () => {
        setCustomer("");
        setCommodity("");
        setCommodityType("");
        setShrinkPct("");
        setTypeFieldErrors({});
        setCommodityFieldErrors({});
        setCcFieldErrors({});
    };

    const handleAddTypeShrink = async () => {
        const values = { commodityType, shrinkPct };
        const nextFieldErrors = buildRequiredFieldErrorsFromRules(TYPE_MODAL_FIELD_RULES, values);
        if (hasFieldErrors(nextFieldErrors)) {
            setTypeFieldErrors(nextFieldErrors);
            return;
        }
        setTypeFieldErrors({});
        const parsed = Number.parseFloat(shrinkPct);
        if (!Number.isFinite(parsed) || parsed < 0) return;

        setSavingRule(true);
        setError("");
        try {
            await apiRequest(`${SHRINK_SETTINGS_ENDPOINT}/commodity-types/${commodityType}`, {
                method: "PUT",
                body: JSON.stringify({ shrink_pct: parsed }),
            });
            setTypeModalOpen(false);
            resetModalFields();
            await loadSettings();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Unable to save commodity type shrink.");
        } finally {
            setSavingRule(false);
        }
    };

    const handleAddCommodityShrink = async () => {
        const values = { commodity, shrinkPct };
        const nextFieldErrors = buildRequiredFieldErrorsFromRules(COMMODITY_MODAL_FIELD_RULES, values);
        if (hasFieldErrors(nextFieldErrors)) {
            setCommodityFieldErrors(nextFieldErrors);
            return;
        }
        setCommodityFieldErrors({});
        const parsed = Number.parseFloat(shrinkPct);
        if (!Number.isFinite(parsed) || parsed < 0) return;

        setSavingRule(true);
        setError("");
        try {
            await apiRequest(`${SHRINK_SETTINGS_ENDPOINT}/commodities/${commodity}`, {
                method: "PUT",
                body: JSON.stringify({ shrink_pct: parsed }),
            });
            setCommodityModalOpen(false);
            resetModalFields();
            await loadSettings();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Unable to save commodity grade shrink.");
        } finally {
            setSavingRule(false);
        }
    };

    const handleAddCustomerCommodityShrink = async () => {
        const values = { customer, commodity, shrinkPct };
        const nextFieldErrors = buildRequiredFieldErrorsFromRules(CC_MODAL_FIELD_RULES, values);
        if (hasFieldErrors(nextFieldErrors)) {
            setCcFieldErrors(nextFieldErrors);
            return;
        }
        setCcFieldErrors({});
        const parsed = Number.parseFloat(shrinkPct);
        if (!Number.isFinite(parsed) || parsed < 0) return;

        setSavingRule(true);
        setError("");
        try {
            await apiRequest(CUSTOMER_COMMODITY_RULES_ENDPOINT, {
                method: "POST",
                body: JSON.stringify({
                    ...getTenantPayload(),
                    customer_id: customer,
                    commodity_id: commodity,
                    shrink_pct: parsed,
                }),
            });
            setCcModalOpen(false);
            resetModalFields();
            await loadSettings();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Unable to save customer-commodity grade shrink.");
        } finally {
            setSavingRule(false);
        }
    };

    if (loading) {
        return (
            <div className="mx-auto w-full max-w-[96rem] p-6 text-sm text-slate-500">
                Loading shrink settings...
            </div>
        );
    }

    return (
        <div className="mx-auto w-full max-w-[96rem] space-y-6">
            <div>
                <h1 className="text-2xl font-semibold tracking-tight text-slate-900 md:text-[1.65rem]">Shrink Settings</h1>
                <p className="mt-1 text-xs text-slate-500">
                    Shrink is applied on incoming tickets. The effective percentage is resolved in order: <strong>Customer-commodity grade agreement &rarr; Commodity Grade &rarr; Commodity type &rarr; Default</strong>. The first value set wins.
                </p>
                {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
            </div>

            <div className="space-y-4">
                <div className="rounded-xl border border-slate-200/90 bg-white p-5 shadow-sm">
                    <h2 className="text-sm font-bold text-slate-900">1. Default shrink</h2>
                    <p className="mt-1 text-xs text-slate-500">
                        Applied to all commodity types when no shrink is set at type, commodity grade, or customer-commodity grade level.
                    </p>
                    <div className="mt-4 flex items-center gap-3">
                        <input
                            type="number"
                            value={defaultShrink}
                            onChange={(e) => setDefaultShrink(e.target.value)}
                            className="w-24 rounded-lg border border-slate-200/95 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-brand/15 focus:border-brand/35 focus:ring-2"
                        />
                        <span className="text-sm text-slate-600">%</span>
                        <Button
                            type="button"
                            size="sm"
                            onClick={handleSaveDefault}
                            disabled={savingDefault}
                            className="bg-blue-600 hover:bg-blue-700 text-white"
                        >
                            {savingDefault ? "Saving..." : "Save default"}
                        </Button>
                        <span className="text-xs text-slate-500 ml-2">Current: {savedDefaultShrink}%</span>
                    </div>
                </div>

                <div className="rounded-xl border border-slate-200/90 bg-white p-5 shadow-sm">
                    <h2 className="text-sm font-bold text-slate-900">2. Commodity type shrink</h2>
                    <p className="mt-1 text-xs text-slate-500">
                        Overrides the default for all commodity grades under this type when no commodity-grade-specific or customer-commodity grade shrink is set. Stored on the commodity type record.
                    </p>
                    <div className="mt-4">
                        <Button
                            type="button"
                            size="sm"
                            className="bg-blue-600 hover:bg-blue-700 text-white"
                            onClick={() => {
                                resetModalFields();
                                setTypeModalOpen(true);
                            }}
                        >
                            + Set commodity type shrink
                        </Button>
                    </div>
                    <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-50/95 border-b border-slate-200">
                                <tr>
                                    <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wide text-slate-500">COMMODITY TYPE</th>
                                    <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wide text-slate-500 text-right">SHRINK %</th>
                                </tr>
                            </thead>
                            <tbody>
                                {commodityTypeShrinkRules.length === 0 ? (
                                    <tr>
                                        <td colSpan={2} className="px-4 py-3 text-xs text-slate-400">
                                            No commodity type shrink rules configured.
                                        </td>
                                    </tr>
                                ) : (
                                    commodityTypeShrinkRules.map((rule) => (
                                        <tr key={rule.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/90">
                                            <td className="px-4 py-3 text-slate-700">
                                                {commodityTypeById.get(rule.commodityTypeId)?.name || "-"}
                                            </td>
                                            <td className="px-4 py-3 text-slate-700 text-right">{rule.shrinkPct}%</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="rounded-xl border border-slate-200/90 bg-white p-5 shadow-sm">
                    <h2 className="text-sm font-bold text-slate-900">3. Commodity Grade shrink</h2>
                    <p className="mt-1 text-xs text-slate-500">
                        Overrides commodity type and default for this commodity grade when no customer-commodity grade agreement exists. Stored on the commodity grade record.
                    </p>
                    <div className="mt-4">
                        <Button
                            type="button"
                            size="sm"
                            className="bg-blue-600 hover:bg-blue-700 text-white"
                            onClick={() => {
                                resetModalFields();
                                setCommodityModalOpen(true);
                            }}
                        >
                            + Set commodity grade shrink
                        </Button>
                    </div>
                    <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-50/95 border-b border-slate-200">
                                <tr>
                                    <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wide text-slate-500">COMMODITY GRADE</th>
                                    <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wide text-slate-500">TYPE</th>
                                    <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wide text-slate-500 text-right">SHRINK %</th>
                                </tr>
                            </thead>
                            <tbody>
                                {commodityShrinkRules.length === 0 ? (
                                    <tr>
                                        <td colSpan={3} className="px-4 py-3 text-xs text-slate-400">
                                            No commodity grade shrink rules configured.
                                        </td>
                                    </tr>
                                ) : (
                                    commodityShrinkRules.map((rule) => {
                                        const item = commodityById.get(rule.commodityId);
                                        const type = commodityTypeById.get(rule.commodityTypeId ?? item?.commodityTypeId);
                                        return (
                                            <tr key={rule.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/90">
                                                <td className="px-4 py-3 text-slate-700">{item?.description || "-"}</td>
                                                <td className="px-4 py-3 text-slate-700">{type?.name || "-"}</td>
                                                <td className="px-4 py-3 text-slate-700 text-right">{rule.shrinkPct}%</td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="rounded-xl border border-slate-200/90 bg-white p-5 shadow-sm">
                    <h2 className="text-sm font-bold text-slate-900">4. Customer-commodity grade shrink (special agreements)</h2>
                    <p className="mt-1 text-xs text-slate-500">
                        Overrides all other shrink for tickets for this customer and commodity grade combination.
                    </p>
                    <div className="mt-4">
                        <Button
                            type="button"
                            size="sm"
                            className="bg-blue-600 hover:bg-blue-700 text-white"
                            onClick={() => {
                                resetModalFields();
                                setCcModalOpen(true);
                            }}
                        >
                            + Add customer-commodity grade shrink
                        </Button>
                        {customerCommodityRules.length === 0 ? (
                            <p className="mt-4 text-[11px] text-slate-400">
                                No customer-commodity grade agreements. Add one to apply a special shrink % for a specific customer and commodity grade.
                            </p>
                        ) : (
                            <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-slate-50/95 border-b border-slate-200">
                                        <tr>
                                            <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wide text-slate-500">CUSTOMER</th>
                                            <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wide text-slate-500">COMMODITY GRADE</th>
                                            <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wide text-slate-500 text-right">SHRINK %</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {customerCommodityRules.map((rule) => (
                                            <tr key={rule.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/90">
                                                <td className="px-4 py-3 text-slate-700">{customerById.get(rule.customerId)?.name || "-"}</td>
                                                <td className="px-4 py-3 text-slate-700">{commodityById.get(rule.commodityId)?.description || "-"}</td>
                                                <td className="px-4 py-3 text-slate-700 text-right">{rule.shrinkPct}%</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <Modal open={typeModalOpen} title="Set commodity type shrink" onClose={() => { setTypeFieldErrors({}); setTypeModalOpen(false); }}>
                <div className="space-y-4">
                    <FormRow label="Commodity type" required hasError={Boolean(typeFieldErrors.commodityType)}>
                        <select
                            className={inputClassName(Boolean(typeFieldErrors.commodityType))}
                            value={commodityType}
                            onChange={(e) => {
                                setTypeFieldErrors((prev) => clearFieldError(prev, "commodityType"));
                                setCommodityType(e.target.value);
                            }}
                        >
                            <option value="">Select commodity type</option>
                            {formCommodityTypes.map((item) => (
                                <option key={item.id} value={item.id}>
                                    {item.name}
                                    {item.shrinkPct != null ? ` (current: ${item.shrinkPct}%)` : ""}
                                </option>
                            ))}
                        </select>
                    </FormRow>
                    <FormRow label="Shrink %" required hasError={Boolean(typeFieldErrors.shrinkPct)}>
                        <div className="flex items-center gap-3">
                            <FormInput
                                type="number"
                                placeholder="0"
                                className="flex-1"
                                hasError={Boolean(typeFieldErrors.shrinkPct)}
                                value={shrinkPct}
                                onChange={(e) => {
                                    setTypeFieldErrors((prev) => clearFieldError(prev, "shrinkPct"));
                                    setShrinkPct(e.target.value);
                                }}
                            />
                            <span className="text-sm font-medium text-slate-500">%</span>
                        </div>
                    </FormRow>
                </div>
                <div className="mt-8 flex justify-end gap-3">
                    <Button type="button" variant="outline" className="border-blue-100 text-blue-700 hover:bg-blue-50" onClick={() => { setTypeFieldErrors({}); setTypeModalOpen(false); }}>
                        Cancel
                    </Button>
                    <Button type="button" className="bg-[#3b82f6] hover:bg-blue-600 text-white px-6 font-semibold" onClick={handleAddTypeShrink} disabled={savingRule}>
                        {savingRule ? "Saving..." : "Save"}
                    </Button>
                </div>
            </Modal>

            <Modal open={commodityModalOpen} title="Set commodity grade shrink" onClose={() => { setCommodityFieldErrors({}); setCommodityModalOpen(false); }}>
                <div className="space-y-4">
                    <FormRow label="Commodity grade" required hasError={Boolean(commodityFieldErrors.commodity)}>
                        <select
                            className={inputClassName(Boolean(commodityFieldErrors.commodity))}
                            value={commodity}
                            onChange={(e) => {
                                setCommodityFieldErrors((prev) => clearFieldError(prev, "commodity"));
                                setCommodity(e.target.value);
                            }}
                        >
                            <option value="">Select commodity grade</option>
                            {formCommodities.map((item) => (
                                <option key={item.id} value={item.id}>
                                    {commodityOptionLabel(item)}
                                    {item.shrinkPct != null ? ` (current: ${item.shrinkPct}%)` : ""}
                                </option>
                            ))}
                        </select>
                    </FormRow>
                    <FormRow label="Shrink %" required hasError={Boolean(commodityFieldErrors.shrinkPct)}>
                        <div className="flex items-center gap-3">
                            <FormInput
                                type="number"
                                placeholder="0"
                                className="flex-1"
                                hasError={Boolean(commodityFieldErrors.shrinkPct)}
                                value={shrinkPct}
                                onChange={(e) => {
                                    setCommodityFieldErrors((prev) => clearFieldError(prev, "shrinkPct"));
                                    setShrinkPct(e.target.value);
                                }}
                            />
                            <span className="text-sm font-medium text-slate-500">%</span>
                        </div>
                    </FormRow>
                </div>
                <div className="mt-8 flex justify-end gap-3">
                    <Button type="button" variant="outline" className="border-blue-100 text-blue-700 hover:bg-blue-50" onClick={() => { setCommodityFieldErrors({}); setCommodityModalOpen(false); }}>
                        Cancel
                    </Button>
                    <Button type="button" className="bg-[#3b82f6] hover:bg-blue-600 text-white px-6 font-semibold" onClick={handleAddCommodityShrink} disabled={savingRule}>
                        {savingRule ? "Saving..." : "Save"}
                    </Button>
                </div>
            </Modal>

            <Modal open={ccModalOpen} title="Add customer-commodity grade shrink" onClose={() => { setCcFieldErrors({}); setCcModalOpen(false); }}>
                <div className="space-y-4">
                    <FormRow label="Customer" required hasError={Boolean(ccFieldErrors.customer)}>
                        <select
                            className={inputClassName(Boolean(ccFieldErrors.customer))}
                            value={customer}
                            onChange={(e) => {
                                setCcFieldErrors((prev) => clearFieldError(prev, "customer"));
                                setCustomer(e.target.value);
                            }}
                        >
                            <option value="">Select customer</option>
                            {formCustomers.map((item) => (
                                <option key={item.id} value={item.id}>
                                    {item.name} ({item.code})
                                </option>
                            ))}
                        </select>
                    </FormRow>

                    <FormRow label="Commodity grade" required hasError={Boolean(ccFieldErrors.commodity)}>
                        <select
                            className={inputClassName(Boolean(ccFieldErrors.commodity))}
                            value={commodity}
                            onChange={(e) => {
                                setCcFieldErrors((prev) => clearFieldError(prev, "commodity"));
                                setCommodity(e.target.value);
                            }}
                        >
                            <option value="">Select commodity grade</option>
                            {formCommodities.map((item) => (
                                <option key={item.id} value={item.id}>
                                    {commodityOptionLabel(item)}
                                </option>
                            ))}
                        </select>
                    </FormRow>

                    <FormRow label="Shrink %" required hasError={Boolean(ccFieldErrors.shrinkPct)}>
                        <div className="flex items-center gap-3">
                            <FormInput
                                type="number"
                                placeholder="0"
                                className="flex-1"
                                hasError={Boolean(ccFieldErrors.shrinkPct)}
                                value={shrinkPct}
                                onChange={(e) => {
                                    setCcFieldErrors((prev) => clearFieldError(prev, "shrinkPct"));
                                    setShrinkPct(e.target.value);
                                }}
                            />
                            <span className="text-sm font-medium text-slate-500">%</span>
                        </div>
                    </FormRow>
                </div>

                <div className="mt-8 flex justify-end gap-3">
                    <Button
                        type="button"
                        variant="outline"
                        className="border-blue-100 text-blue-700 hover:bg-blue-50"
                        onClick={() => { setCcFieldErrors({}); setCcModalOpen(false); }}
                    >
                        Cancel
                    </Button>
                    <Button
                        type="button"
                        className="bg-[#3b82f6] hover:bg-blue-600 text-white px-6 font-semibold"
                        onClick={handleAddCustomerCommodityShrink}
                        disabled={savingRule}
                    >
                        {savingRule ? "Saving..." : "Add"}
                    </Button>
                </div>
            </Modal>
        </div>
    );
}

function Modal({ open, title, onClose, children }) {
    if (!open) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <button type="button" className="absolute inset-0 bg-slate-900/40 backdrop-blur-[1px]" aria-label="Close dialog" onClick={onClose} />
            <div role="dialog" aria-modal="true" aria-labelledby="modal-title" className="relative w-full max-w-[420px] rounded-xl bg-white shadow-2xl">
                <div className="flex items-center justify-between p-5 pb-4">
                    <h2 id="modal-title" className="text-[15px] font-semibold text-[#1e293b] tracking-tight">{title}</h2>
                    <button type="button" className="text-slate-400 hover:text-slate-600 text-lg leading-none" onClick={onClose}>
                        ×
                    </button>
                </div>
                <div className="px-5 pb-6">{children}</div>
            </div>
        </div>
    );
}
