"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/* ─── Shared input class ─── */
const inputClass =
  "w-full rounded-lg border border-slate-200/95 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-brand/15 placeholder:text-slate-400 focus:border-brand/35 focus:ring-2";

/* ─── Static options (mock) ─── */
const PACK_STATUSES = ["Pending", "Scheduled", "In Progress", "Packed", "Dispatched", "Completed", "On Hold", "Cancelled"];
const SAMPLE_STATUSES = ["Pending", "Sent", "Received", "Pass", "Fail", "Resend"];
const PACK_TYPES = [
  { value: "container", label: "Container" },
  { value: "bulk", label: "Bulk" },
];
const IMPORT_EXPORT = [
  { value: "Import", label: "Import" },
  { value: "Export", label: "Export" },
];
const YES_NO = [
  { value: "no", label: "No" },
  { value: "yes", label: "Yes" },
];

/* ─── Blank pack factory ─── */
function blankPack() {
  return {
    packType: "container",
    importExport: "Export",
    customerId: "",
    exporter: "",
    commodityTypeId: "",
    commodityId: "",
    status: "Pending",
    jobReference: "",
    siteId: "",
    fumigationRequired: false,
    testRequired: false,
    shrinkTaken: false,
    containersRequired: "",
    quantityPerContainer: "",
    maxQtyPerContainer: "",
    mtTotal: "",
    destinationCountry: "",
    destinationPort: "",
    transshipmentPort: "",
    transshipmentPortCode: "",
    shippingLineId: "",
    vesselDepartureId: "",
    terminalId: "",
    importPermitRequired: false,
    importPermitNumber: "",
    importPermitDate: "",
    rfp: "",
    rfpAdditionalDeclarationRequired: false,
    rfpComment: "",
    rfpExpiry: "",
    rfpCommodityCode: "",
    sampleRequired: false,
    jobNotes: "",
    date: new Date().toISOString().split("T")[0],
  };
}

/* ─── Form sections definition ─── */
const FORM_SECTIONS = [
  {
    id: "basic",
    title: "Basic",
    fields: [
      { key: "packType", label: "Pack Type", type: "select", options: PACK_TYPES, required: true },
      { key: "importExport", label: "Import / Export", type: "select", options: IMPORT_EXPORT, required: true },
      { key: "status", label: "Status", type: "select", options: PACK_STATUSES.map((s) => ({ value: s, label: s })), required: true },
      { key: "customerId", label: "Customer", placeholder: "Customer name or ID" },
      { key: "exporter", label: "Exporter", placeholder: "Exporter name" },
      { key: "commodityTypeId", label: "Commodity Type", placeholder: "Commodity type" },
      { key: "commodityId", label: "Commodity", placeholder: "Commodity" },
      { key: "jobReference", label: "Job Reference", placeholder: "Job reference" },
      { key: "siteId", label: "Site", placeholder: "Site" },
      { key: "fumigationRequired", label: "Fumigation Required", type: "select", options: YES_NO, isBool: true },
      { key: "testRequired", label: "Test Required", type: "select", options: YES_NO, isBool: true },
      { key: "shrinkTaken", label: "Shrink Taken (Import)", type: "select", options: YES_NO, isBool: true },
    ],
  },
  {
    id: "containers",
    title: "Containers & Quantity",
    fields: [
      { key: "containersRequired", label: "Containers Required", type: "number", placeholder: "Number" },
      { key: "quantityPerContainer", label: "Qty per Container (MT)", type: "number", placeholder: "MT" },
      { key: "maxQtyPerContainer", label: "Max Qty per Container (MT)", type: "number", placeholder: "MT" },
      { key: "mtTotal", label: "MT Total", type: "number", placeholder: "Total MT", wide: true },
    ],
  },
  {
    id: "destination",
    title: "Destination & Shipping",
    fields: [
      { key: "destinationCountry", label: "Destination Country", placeholder: "Country" },
      { key: "destinationPort", label: "Destination Port", placeholder: "Port" },
      { key: "transshipmentPort", label: "Transshipment Port", placeholder: "Port" },
      { key: "transshipmentPortCode", label: "Transshipment Port Code", placeholder: "Code" },
      { key: "shippingLineId", label: "Shipping Line", placeholder: "Shipping line" },
      { key: "vesselDepartureId", label: "Vessel Departure", placeholder: "Vessel departure" },
      { key: "terminalId", label: "Terminal", placeholder: "Terminal" },
    ],
  },
  {
    id: "importPermit",
    title: "Import Permit",
    fields: [
      { key: "importPermitRequired", label: "Import Permit Required", type: "select", options: YES_NO, isBool: true },
      { key: "importPermitNumber", label: "Import Permit Number", placeholder: "Number" },
      { key: "importPermitDate", label: "Import Permit Date", type: "date" },
    ],
  },
  {
    id: "rfp",
    title: "RFP",
    fields: [
      { key: "rfp", label: "RFP", placeholder: "RFP reference" },
      { key: "rfpAdditionalDeclarationRequired", label: "Additional Declaration Required", type: "select", options: YES_NO, isBool: true },
      { key: "rfpComment", label: "RFP Comment", placeholder: "Comment" },
      { key: "rfpExpiry", label: "RFP Expiry", type: "date" },
      { key: "rfpCommodityCode", label: "RFP Commodity Code", placeholder: "Code" },
    ],
  },
  {
    id: "sample",
    title: "Sample",
    fields: [
      { key: "sampleRequired", label: "Sample Required", type: "select", options: YES_NO, isBool: true },
    ],
  },
  {
    id: "notes",
    title: "Packing & Notes",
    fields: [
      { key: "jobNotes", label: "Job Notes", type: "textarea", placeholder: "Notes…", wide: true },
      { key: "date", label: "Date", type: "date" },
    ],
  },
];

/* ─── Tabs ─── */
const TABS = [
  { id: "general", label: "General" },
  { id: "accounting", label: "Accounting" },
];

/* ─── Section component ─── */
function Section({ title, children }) {
  return (
    <div className="rounded-xl border border-slate-200/90 bg-white p-5 shadow-sm">
      <h3 className="mb-4 border-b-2 border-slate-100 pb-2 text-sm font-bold text-slate-900">{title}</h3>
      {children}
    </div>
  );
}

/* ─── FormField component ─── */
function FormField({ field, value, onChange }) {
  const displayValue = field.isBool ? (value ? "yes" : "no") : value;
  const handleChange = field.isBool
    ? (v) => onChange(v === "yes")
    : onChange;

  return (
    <div className={cn("space-y-1", field.wide && "sm:col-span-2")}>
      <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">
        {field.label}
        {field.required ? <span className="text-red-500"> *</span> : null}
      </label>
      {field.type === "select" ? (
        <select
          className={inputClass}
          value={displayValue}
          onChange={(e) => handleChange(e.target.value)}
        >
          <option value="">— Select —</option>
          {(field.options || []).map((opt) => {
            const optValue = typeof opt === "object" ? opt.value : opt;
            const optLabel = typeof opt === "object" ? opt.label : opt;
            return (
              <option key={optValue} value={optValue}>
                {optLabel}
              </option>
            );
          })}
        </select>
      ) : field.type === "textarea" ? (
        <textarea
          className={cn(inputClass, "min-h-20 resize-y")}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          rows={4}
        />
      ) : (
        <input
          type={field.type || "text"}
          className={inputClass}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
        />
      )}
    </div>
  );
}

/* ─── Main page ─── */
export default function PackingFormPage() {
  const router = useRouter();
  const params = useSearchParams();

  const mode = params.get("mode") || "create";
  const packId = params.get("id");
  const isCreate = mode === "create";

  const [pack, setPack] = useState(() => blankPack());
  const [activeTab, setActiveTab] = useState("general");

  const set = (key, val) => setPack((prev) => ({ ...prev, [key]: val }));

  const save = () => {
    // Persist to localStorage so packing-table can read it
    const stored = JSON.parse(localStorage.getItem("packing_rows") || "[]");
    if (isCreate) {
      const nextId = stored.length > 0 ? Math.max(...stored.map((r) => Number(r.id) || 0)) + 1 : 1;
      const newRow = { id: nextId, ...pack };
      stored.unshift(newRow);
      localStorage.setItem("packing_rows", JSON.stringify(stored));
    } else if (packId) {
      const idx = stored.findIndex((r) => String(r.id) === String(packId));
      if (idx >= 0) {
        stored[idx] = { ...stored[idx], ...pack };
        localStorage.setItem("packing_rows", JSON.stringify(stored));
      }
    }
    router.push("/packing/packing-table");
  };

  // General tab shows sections: basic, containers, destination, importPermit, rfp, sample, notes
  const generalSections = FORM_SECTIONS;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-slate-500">Packing / Packing Table / {isCreate ? "Create" : `Edit #${packId}`}</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
            {isCreate ? "Create Pack" : `Edit Pack #${packId}`}
          </h1>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => router.push("/packing/packing-table")}>
            Cancel
          </Button>
          <Button type="button" size="sm" onClick={save}>
            Save
          </Button>
        </div>
      </div>

      {/* Tab strip */}
      <div className="flex gap-2 flex-wrap">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "rounded-lg border px-3.5 py-2 text-sm font-medium transition-colors",
              activeTab === tab.id
                ? "border-brand bg-brand/5 text-brand-ink"
                : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-800"
            )}
          >
            {tab.label}
          </button>
        ))}
        {pack.fumigationRequired && (
          <button
            type="button"
            onClick={() => setActiveTab("fumigation")}
            className={cn(
              "rounded-lg border px-3.5 py-2 text-sm font-medium transition-colors",
              activeTab === "fumigation"
                ? "border-brand bg-brand/5 text-brand-ink"
                : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-800"
            )}
          >
            Fumigation
          </button>
        )}
      </div>

      {/* General tab */}
      {activeTab === "general" && (
        <div className="space-y-4">
          {generalSections.map((section) => (
            <Section key={section.id} title={section.title}>
              <div className="grid gap-3 sm:grid-cols-2">
                {section.fields.map((field) => (
                  <FormField
                    key={field.key}
                    field={field}
                    value={pack[field.key]}
                    onChange={(v) => set(field.key, v)}
                  />
                ))}
              </div>
            </Section>
          ))}
        </div>
      )}

      {/* Fumigation tab */}
      {activeTab === "fumigation" && pack.fumigationRequired && (
        <Section title="Fumigation Details">
          <p className="text-sm text-slate-500">
            Fumigation detail fields will be available once fumigant and methodology data are connected.
          </p>
        </Section>
      )}

      {/* Accounting tab */}
      {activeTab === "accounting" && (
        <div className="space-y-4">
          <Section title="Revenue">
            <p className="text-sm text-slate-500">
              Revenue calculations will appear once commodity pricing and container data are connected.
            </p>
          </Section>
          <Section title="Expense">
            <p className="text-sm text-slate-500">
              Cost-side lines will be added in a future release.
            </p>
          </Section>
        </div>
      )}
    </div>
  );
}
