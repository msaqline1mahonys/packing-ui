"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { COMMODITY_MASTER_ROWS, COMMODITY_TYPE_MASTER_ROWS, CUSTOMER_MASTER_ROWS, SHRINK_SETTINGS_DATA } from "@/lib/Data";

export default function ShrinkSettingsPage() {
    const [defaultShrink, setDefaultShrink] = useState(String(SHRINK_SETTINGS_DATA.defaultShrinkPercent));
    const [savedDefaultShrink, setSavedDefaultShrink] = useState(String(SHRINK_SETTINGS_DATA.defaultShrinkPercent));

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [customer, setCustomer] = useState("");
    const [commodity, setCommodity] = useState("");
    const [shrinkPct, setShrinkPct] = useState("");
    const [customerCommodityRules, setCustomerCommodityRules] = useState(() =>
        SHRINK_SETTINGS_DATA.customerCommodityShrinkRules.map((rule) => ({ ...rule }))
    );

    const commodityTypeById = useMemo(
        () => new Map(COMMODITY_TYPE_MASTER_ROWS.map((item) => [item.id, item])),
        []
    );
    const commodityById = useMemo(() => new Map(COMMODITY_MASTER_ROWS.map((item) => [item.id, item])), []);
    const customerById = useMemo(() => new Map(CUSTOMER_MASTER_ROWS.map((item) => [item.id, item])), []);

    const handleSaveDefault = () => {
        setSavedDefaultShrink(defaultShrink);
    };

    const handleAddShrink = () => {
        if (!customer || !commodity || !shrinkPct.trim()) return;
        const parsed = Number.parseFloat(shrinkPct);
        if (!Number.isFinite(parsed) || parsed < 0) return;

        setCustomerCommodityRules((prev) => {
            const customerId = Number(customer);
            const commodityId = Number(commodity);
            const existing = prev.find((rule) => rule.customerId === customerId && rule.commodityId === commodityId);
            if (existing) {
                return prev.map((rule) =>
                    rule.id === existing.id ? { ...rule, shrinkPct: parsed } : rule
                );
            }
            const nextId = Math.max(0, ...prev.map((rule) => Number(rule.id) || 0)) + 1;
            return [...prev, { id: nextId, customerId, commodityId, shrinkPct: parsed }];
        });
        setIsModalOpen(false);
        setCustomer("");
        setCommodity("");
        setShrinkPct("");
    };

    return (
        <div className="mx-auto w-full max-w-[96rem] space-y-6">
            <div>
                <h1 className="text-2xl font-semibold tracking-tight text-slate-900 md:text-[1.65rem]">Shrink Settings</h1>
                <p className="mt-1 text-xs text-slate-500">
                    Shrink is applied on incoming tickets. The effective percentage is resolved in order: <strong>Customer-commodity agreement &rarr; Commodity &rarr; Commodity type &rarr; Default</strong>. The first value set wins.
                </p>
            </div>

            <div className="space-y-4">
                {/* 1. Default shrink */}
                <div className="rounded-xl border border-slate-200/90 bg-white p-5 shadow-sm">
                    <h2 className="text-sm font-bold text-slate-900">1. Default shrink</h2>
                    <p className="mt-1 text-xs text-slate-500">
                        Applied to all commodity types when no shrink is set at type, commodity, or customer-commodity level.
                    </p>
                    <div className="mt-4 flex items-center gap-3">
                        <input
                            type="number"
                            value={defaultShrink}
                            onChange={(e) => setDefaultShrink(e.target.value)}
                            className="w-24 rounded-lg border border-slate-200/95 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-brand/15 focus:border-brand/35 focus:ring-2"
                        />
                        <span className="text-sm text-slate-600">%</span>
                        <Button type="button" size="sm" onClick={handleSaveDefault} className="bg-blue-600 hover:bg-blue-700 text-white">
                            Save default
                        </Button>
                        <span className="text-xs text-slate-500 ml-2">Current: {savedDefaultShrink}%</span>
                    </div>
                </div>

                {/* 2. Commodity type shrink */}
                <div className="rounded-xl border border-slate-200/90 bg-white p-5 shadow-sm">
                    <h2 className="text-sm font-bold text-slate-900">2. Commodity type shrink</h2>
                    <p className="mt-1 text-xs text-slate-500">
                        Overrides the default for all commodities under this type when no commodity-specific or customer-commodity shrink is set.
                    </p>
                    <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-50/95 border-b border-slate-200">
                                <tr>
                                    <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wide text-slate-500">COMMODITY TYPE</th>
                                    <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wide text-slate-500 text-right">SHRINK %</th>
                                </tr>
                            </thead>
                            <tbody>
                                {SHRINK_SETTINGS_DATA.commodityTypeShrinkRules.map((rule) => (
                                    <tr key={rule.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/90">
                                        <td className="px-4 py-3 text-slate-700">{commodityTypeById.get(rule.commodityTypeId)?.name || "-"}</td>
                                        <td className="px-4 py-3 text-slate-700 text-right">{rule.shrinkPct}%</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* 3. Commodity shrink */}
                <div className="rounded-xl border border-slate-200/90 bg-white p-5 shadow-sm">
                    <h2 className="text-sm font-bold text-slate-900">3. Commodity shrink</h2>
                    <p className="mt-1 text-xs text-slate-500">
                        Overrides commodity type and default for this commodity when no customer-commodity agreement exists.
                    </p>
                    <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-50/95 border-b border-slate-200">
                                <tr>
                                    <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wide text-slate-500">COMMODITY</th>
                                    <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wide text-slate-500">TYPE</th>
                                    <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wide text-slate-500 text-right">SHRINK %</th>
                                </tr>
                            </thead>
                            <tbody>
                                {SHRINK_SETTINGS_DATA.commodityShrinkRules.map((rule) => {
                                    const item = commodityById.get(rule.commodityId);
                                    const type = commodityTypeById.get(item?.commodityTypeId);
                                    return (
                                        <tr key={rule.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/90">
                                            <td className="px-4 py-3 text-slate-700">{item?.description || "-"}</td>
                                            <td className="px-4 py-3 text-slate-700">{type?.name || "-"}</td>
                                            <td className="px-4 py-3 text-slate-700 text-right">{rule.shrinkPct}%</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* 4. Customer-commodity shrink */}
                <div className="rounded-xl border border-slate-200/90 bg-white p-5 shadow-sm">
                    <h2 className="text-sm font-bold text-slate-900">4. Customer-commodity shrink (special agreements)</h2>
                    <p className="mt-1 text-xs text-slate-500">
                        Overrides all other shrink for tickets for this customer and commodity combination.
                    </p>
                    <div className="mt-4">
                        <Button type="button" size="sm" className="bg-blue-600 hover:bg-blue-700 text-white" onClick={() => setIsModalOpen(true)}>
                            + Add customer-commodity shrink
                        </Button>
                        {customerCommodityRules.length === 0 ? (
                            <p className="mt-4 text-[11px] text-slate-400">
                                No customer-commodity agreements. Add one to apply a special shrink % for a specific customer and commodity.
                            </p>
                        ) : (
                            <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-slate-50/95 border-b border-slate-200">
                                        <tr>
                                            <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wide text-slate-500">CUSTOMER</th>
                                            <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wide text-slate-500">COMMODITY</th>
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

            <Modal open={isModalOpen} title="Add customer-commodity shrink" onClose={() => setIsModalOpen(false)}>
                <div className="space-y-4">
                    <div className="space-y-1.5">
                        <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                            CUSTOMER <span className="text-red-400">*</span>
                        </label>
                        <select
                            className="w-full rounded-md border border-blue-500/40 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                            value={customer}
                            onChange={(e) => setCustomer(e.target.value)}
                        >
                            <option value="">Select customer</option>
                            {CUSTOMER_MASTER_ROWS.map((item) => (
                                <option key={item.id} value={item.id}>
                                    {item.name} ({item.code})
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                            COMMODITY <span className="text-red-400">*</span>
                        </label>
                        <select
                            className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                            value={commodity}
                            onChange={(e) => setCommodity(e.target.value)}
                        >
                            <option value="">Select commodity</option>
                            {COMMODITY_MASTER_ROWS.map((item) => (
                                <option key={item.id} value={item.id}>
                                    {item.description}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                            SHRINK % <span className="text-red-400">*</span>
                        </label>
                        <div className="flex items-center gap-3">
                            <input
                                type="number"
                                placeholder="0"
                                className="flex-1 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                value={shrinkPct}
                                onChange={(e) => setShrinkPct(e.target.value)}
                            />
                            <span className="text-sm font-medium text-slate-500">%</span>
                        </div>
                    </div>
                </div>

                <div className="mt-8 flex justify-end gap-3">
                    <Button type="button" variant="outline" className="border-blue-100 text-blue-700 hover:bg-blue-50" onClick={() => setIsModalOpen(false)}>
                        Cancel
                    </Button>
                    <Button type="button" className="bg-[#3b82f6] hover:bg-blue-600 text-white px-6 font-semibold" onClick={handleAddShrink}>
                        Add
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
