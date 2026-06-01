"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const inputClass =
  "w-full rounded-lg border border-slate-200/95 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-brand/15 placeholder:text-slate-400 focus:border-brand/35 focus:ring-2";

const INSPECTION_RESULTS = ["Pass", "Fail", "N/A"];
const MOCK_CONTAINER_CODES = [
  { id: 1, isoCode: "22G1", containerSize: "20ft" },
  { id: 2, isoCode: "42G1", containerSize: "40ft" },
  { id: 3, isoCode: "45G1", containerSize: "40ft HC" },
];
const MOCK_STOCK_LOCATIONS = [
  { id: 1, name: "Bay 1 â€“ Main Shed" },
  { id: 2, name: "Bay 2 â€“ Overflow" },
  { id: 3, name: "Silo A" },
];
const MOCK_PACKERS = [
  { id: 1, name: "James Turner" },
  { id: 2, name: "Sarah Mitchell" },
];
const MOCK_CUSTOMERS = [
  { id: 1, name: "ACME Corp" },
  { id: 2, name: "GrainLink" },
  { id: 3, name: "Southern Export" },
];
const MOCK_COMMODITIES = [
  {
    id: 1,
    description: "Wheat",
    testThresholds: [
      { test: "Moisture", min: "", max: "12.5" },
      { test: "Type 1", min: "", max: "4" },
    ],
  },
  { id: 2, description: "Chickpeas", testThresholds: [] },
  { id: 3, description: "Canola", testThresholds: [] },
];

const MOCK_TESTS = [
  { id: 1, testName: "Moisture", type: "Percentage", unit: "%", appliesTo: ["Incoming Tickets", "Outgoing Tickets", "Outgoing Containers"], status: "Active" },
  { id: 2, testName: "Double Gees", type: "Count", unit: "seeds", appliesTo: ["Outgoing Containers"], status: "Active" },
  { id: 3, testName: "Poppy seed", type: "Count", unit: "seeds", appliesTo: ["Outgoing Containers"], status: "Active" },
  { id: 4, testName: "Jute", type: "Count", unit: "seeds", appliesTo: ["Outgoing Containers"], status: "Active" },
  { id: 5, testName: "Type 1", type: "Group", unit: "seeds", members: [2, 3, 4], appliesTo: ["Outgoing Containers"], status: "Active" },
];

function getApplicableTests(commodity) {
  const thresholds = commodity?.testThresholds ?? [];
  if (thresholds.length === 0) return [];
  return thresholds
    .map((t) => {
      const def = MOCK_TESTS.find((d) => d.testName === t.test);
      if (!def) return null;
      if (def.status !== "Active") return null;
      if (!(def.appliesTo ?? []).includes("Outgoing Containers")) return null;
      return { def, threshold: t };
    })
    .filter(Boolean);
}

function getGroupMembers(groupDef) {
  return (groupDef.members ?? []).map((mid) => MOCK_TESTS.find((d) => d.id === mid)).filter(Boolean);
}

function evaluateIndividual(rawValue, min, max) {
  if (rawValue === "" || rawValue == null) return { status: "empty" };
  const v = Number(rawValue);
  if (Number.isNaN(v)) return { status: "empty" };
  const minN = min !== "" && min != null ? Number(min) : null;
  const maxN = max !== "" && max != null ? Number(max) : null;
  if (minN != null && !Number.isNaN(minN) && v < minN) return { status: "fail" };
  if (maxN != null && !Number.isNaN(maxN) && v > maxN) return { status: "fail" };
  return { status: "pass" };
}

function sumFindings(findings) {
  return (findings ?? []).reduce((s, f) => s + (Number(f.count) || 0), 0);
}

function evaluateGroup(findings, max) {
  const total = sumFindings(findings);
  const maxN = max !== "" && max != null ? Number(max) : null;
  if (findings == null || findings.length === 0) return { status: "empty", total: 0 };
  if (maxN != null && !Number.isNaN(maxN) && total > maxN) return { status: "fail", total };
  return { status: "pass", total };
}

function summarizeContainerTests(container, applicableTests) {
  let pass = 0;
  let fail = 0;
  let empty = 0;
  for (const { def, threshold } of applicableTests) {
    const entry = container?.tests?.[def.testName];
    if (def.type === "Group") {
      const r = evaluateGroup(entry?.findings, threshold.max);
      if (r.status === "pass") pass++;
      else if (r.status === "fail") fail++;
      else empty++;
    } else {
      const r = evaluateIndividual(entry?.value, threshold.min, threshold.max);
      if (r.status === "pass") pass++;
      else if (r.status === "fail") fail++;
      else empty++;
    }
  }
  return { pass, fail, empty, total: applicableTests.length };
}
const MOCK_TRANSPORTERS = [
  { id: 1, name: "Fast Freight" },
  { id: 2, name: "Coastal Haulage" },
];
const MOCK_CONTAINER_PARKS = [
  { id: 1, name: "West Yard Empty Park" },
  { id: 2, name: "East Depot" },
];

function blankContainer() {
  return {
    containerNumber: "", sealNumber: "", containerIsoCode: "", startDateTime: "",
    stockLocationId: "", packerId: "", releaseRef: "", emptyContainerParkId: "",
    transporterId: "", tare: "", containerTare: "", gross: "", nett: "",
    packerSignoff: "", packerSignoffDateTime: "", authorisedOfficer: "",
    emptyContainerInspectionResult: "", emptyContainerInspectionRemark: "",
    grainInspectionResult: "", grainInspectionRemark: "",
    authorisedOfficerSignoff: "", authorisedOfficerSignoffDateTime: "",
    tests: {},
    status: "draft",
  };
}

const INITIAL_PACKS = [
  {
    id: 1, jobReference: "JOB-2026-001", customerId: 1, commodityId: 1,
    importExport: "Export", status: "Inprogress", containersRequired: 4,
    verification: { importDetailsChecked: true, sampleRequirementsChecked: true, rfpDetailsChecked: true, micorRequirementsChecked: true },
    containers: [
      { id: 1, containerNumber: "MSKU1234567", sealNumber: "SL-001", containerIsoCode: "22G1", stockLocationId: 1, packerId: 1, nett: 25000, status: "completed", emptyContainerInspectionResult: "Pass", grainInspectionResult: "Pass", packerSignoff: "J. Turner" },
      { id: 2, containerNumber: "TCLU7654321", sealNumber: "SL-002", containerIsoCode: "42G1", stockLocationId: 2, packerId: 2, nett: null, status: "draft", emptyContainerInspectionResult: "", grainInspectionResult: "", packerSignoff: "" },
    ],
  },
  {
    id: 2, jobReference: "JOB-2026-005", customerId: 2, commodityId: 2,
    importExport: "Export", status: "Pending", containersRequired: 2,
    verification: { importDetailsChecked: false, sampleRequirementsChecked: false, rfpDetailsChecked: false, micorRequirementsChecked: false },
    containers: [],
  },
  {
    id: 3, jobReference: "JOB-2026-007", customerId: 3, commodityId: 3,
    importExport: "Import", status: "Inprogress", containersRequired: 3,
    verification: { importDetailsChecked: true, sampleRequirementsChecked: true, rfpDetailsChecked: false, micorRequirementsChecked: false },
    containers: [],
  },
];

function StatusBadge({ status }) {
  const map = {
    Pending: "bg-amber-100 text-amber-800", Inprogress: "bg-blue-100 text-blue-800",
    completed: "bg-emerald-100 text-emerald-800", draft: "bg-slate-100 text-slate-600",
  };
  return <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", map[status] || "bg-slate-100 text-slate-600")}>{status}</span>;
}

const VERIFY_ITEMS = [
  { key: "importDetailsChecked", label: "Import details checked" },
  { key: "sampleRequirementsChecked", label: "Sample requirements checked" },
  { key: "rfpDetailsChecked", label: "RFP details checked" },
  { key: "micorRequirementsChecked", label: "MICOR requirements checked" },
];

export default function ContainerPackingPage() {
  const [packs, setPacks] = useState(() => [...INITIAL_PACKS]);
  const [selectedPackId, setSelectedPackId] = useState(null);
  const [rightTab, setRightTab] = useState("checklist");
  const [containerModalOpen, setContainerModalOpen] = useState(false);
  const [editingContainerId, setEditingContainerId] = useState(null);
  const [containerForm, setContainerForm] = useState(() => blankContainer());

  const containerPacks = useMemo(() => packs.filter((p) => ["Pending", "Inprogress"].includes(p.status)), [packs]);
  const selectedPack = selectedPackId ? packs.find((p) => p.id === selectedPackId) : null;
  const verification = selectedPack?.verification || {};
  const containers = selectedPack?.containers || [];
  const allVerified = VERIFY_ITEMS.every((v) => !!verification[v.key]);
  const customer = selectedPack ? MOCK_CUSTOMERS.find((c) => c.id === selectedPack.customerId) : null;
  const commodity = selectedPack ? MOCK_COMMODITIES.find((c) => c.id === selectedPack.commodityId) : null;

  function setVerification(key, value) {
    if (!selectedPackId) return;
    setPacks((prev) => prev.map((p) => p.id !== selectedPackId ? p : { ...p, verification: { ...p.verification, [key]: value } }));
  }

  function startJob() {
    if (!selectedPackId) return;
    setPacks((prev) => prev.map((p) => p.id === selectedPackId ? { ...p, status: "Inprogress" } : p));
  }

  function openNewContainer() { setEditingContainerId(null); setContainerForm(blankContainer()); setContainerModalOpen(true); }

  function openEditContainer(c) {
    setEditingContainerId(c.id);
    setContainerForm({
      ...c,
      tare: c.tare != null && c.tare !== "" ? c.tare / 1000 : "",
      containerTare: c.containerTare != null && c.containerTare !== "" ? c.containerTare / 1000 : "",
      gross: c.gross != null && c.gross !== "" ? c.gross / 1000 : "",
      nett: c.nett != null && c.nett !== "" ? c.nett / 1000 : "",
      stockLocationId: c.stockLocationId ?? "", packerId: c.packerId ?? "",
      emptyContainerParkId: c.emptyContainerParkId ?? "", transporterId: c.transporterId ?? "",
      tests: c.tests ?? {},
    });
    setContainerModalOpen(true);
  }

  function saveContainer() {
    if (!selectedPackId) return;
    const toKg = (v) => v !== "" && v != null ? Math.round(Number(v) * 1000) : null;
    const payload = {
      ...containerForm,
      stockLocationId: containerForm.stockLocationId ? Number(containerForm.stockLocationId) : null,
      packerId: containerForm.packerId ? Number(containerForm.packerId) : null,
      emptyContainerParkId: containerForm.emptyContainerParkId ? Number(containerForm.emptyContainerParkId) : null,
      transporterId: containerForm.transporterId ? Number(containerForm.transporterId) : null,
      tare: toKg(containerForm.tare), containerTare: toKg(containerForm.containerTare),
      gross: toKg(containerForm.gross), nett: toKg(containerForm.nett),
    };
    setPacks((prev) => prev.map((p) => {
      if (p.id !== selectedPackId) return p;
      let ctrs = [...(p.containers || [])];
      if (editingContainerId) {
        ctrs = ctrs.map((c) => c.id === editingContainerId ? { ...c, ...payload } : c);
      } else {
        const nextId = ctrs.length > 0 ? Math.max(...ctrs.map((c) => c.id)) + 1 : 1;
        ctrs.push({ ...payload, id: nextId, status: "draft" });
      }
      return { ...p, containers: ctrs };
    }));
    setContainerModalOpen(false);
  }

  function removeContainer(id) {
    if (!selectedPackId) return;
    setPacks((prev) => prev.map((p) => p.id !== selectedPackId ? p : { ...p, containers: (p.containers || []).filter((c) => c.id !== id) }));
    setContainerModalOpen(false);
  }

  function completeContainer(c) {
    if (!selectedPackId) return;
    setPacks((prev) => prev.map((p) => p.id !== selectedPackId ? p : { ...p, containers: (p.containers || []).map((ct) => ct.id === c.id ? { ...ct, status: "completed" } : ct) }));
  }

  const set = (key, val) => setContainerForm((prev) => ({ ...prev, [key]: val }));

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs text-slate-500">Packing / Container Packing</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">Container Packing</h1>
      </div>

      <div className="flex gap-4" style={{ minHeight: 560 }}>
        {/* Left: pack list */}
        <div className="w-72 shrink-0 overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-sm">
          <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Container pack jobs</p>
          </div>
          <div className="overflow-y-auto" style={{ maxHeight: 510 }}>
            {containerPacks.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-slate-400">No container pack jobs.</p>
            ) : containerPacks.map((p) => {
              const cust = MOCK_CUSTOMERS.find((c) => c.id === p.customerId);
              const isSelected = selectedPackId === p.id;
              const cnt = (p.containers || []).length;
              return (
                <button key={p.id} type="button" onClick={() => setSelectedPackId(p.id)}
                  className={cn("w-full border-b border-slate-100 px-4 py-3 text-left text-sm transition-colors", isSelected ? "bg-blue-50" : "hover:bg-slate-50")}>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-brand">#{p.id}</span>
                    <StatusBadge status={p.status} />
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{p.jobReference || "â€”"}</p>
                  <p className="text-xs text-slate-700">{cust?.name || "â€”"}</p>
                  <p className="mt-1 text-[10px] text-slate-400">Containers: {cnt} / {p.containersRequired ?? 0}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: detail */}
        <div className="flex flex-1 flex-col overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-sm">
          {!selectedPack ? (
            <div className="flex flex-1 items-center justify-center text-sm text-slate-400">Select a pack job to pack containers.</div>
          ) : (
            <>
              {/* Header */}
              <div className="border-b border-slate-200 px-5 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">Pack #{selectedPack.id} Â· {selectedPack.jobReference || "â€”"}</h2>
                    <p className="mt-1 text-sm text-slate-500">{customer?.name} Â· {commodity?.description} Â· {selectedPack.importExport}</p>
                  </div>
                  {selectedPack.status === "Pending" && <Button size="sm" onClick={startJob}>Start job</Button>}
                </div>
                {/* Tab bar */}
                <div className="mt-4 flex gap-1">
                  {[["checklist", "Checklist"], ["containers", "Containers"]].map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setRightTab(key)}
                      className={cn(
                        "rounded-md px-3 py-1.5 text-xs font-semibold transition-colors",
                        rightTab === key ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tab content */}
              <div className="flex-1 overflow-auto p-5">
                {rightTab === "checklist" && (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <p className="mb-3 text-xs font-bold text-slate-600">Verify before packing</p>
                    <div className="flex flex-wrap gap-x-6 gap-y-2">
                      {VERIFY_ITEMS.map(({ key, label }) => (
                        <label key={key} className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                          <input suppressHydrationWarning type="checkbox" checked={!!verification[key]} onChange={(e) => setVerification(key, e.target.checked)} className="accent-blue-500" />
                          {label}
                        </label>
                      ))}
                    </div>
                    {!allVerified && <p className="mt-2 text-xs text-amber-600">Complete all checks before packing containers.</p>}
                  </div>
                )}

                {rightTab === "containers" && (
                  <>
                    <div className="mb-3 flex items-center justify-between">
                      <span className="text-sm font-semibold text-slate-700">Containers ({containers.length} / {selectedPack.containersRequired ?? 0})</span>
                      <Button size="sm" disabled={!allVerified} onClick={openNewContainer}>+ Add container</Button>
                    </div>

                    {containers.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-slate-200 py-10 text-center text-sm text-slate-400">No containers yet. Complete verification and add containers.</div>
                    ) : (
                      <div className="overflow-hidden rounded-lg border border-slate-200">
                        <table className="w-full border-collapse text-xs">
                          <thead>
                            <tr className="border-b-2 border-slate-100 bg-slate-50 text-left">
                              {["Container", "Packer", "Seal", "ISO", "Release", "Nett (t)", "Empty", "Grain", "Signoff", "Status", ""].map((h) => (
                                <th key={h} className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {containers.map((c) => {
                              const packer = c.packerId ? MOCK_PACKERS.find((p) => p.id === c.packerId) : null;
                              const isCompleted = c.status === "completed";
                              const canComplete = !isCompleted && c.nett != null && c.nett > 0 && c.stockLocationId != null;
                              return (
                                <tr key={c.id} onClick={() => openEditContainer(c)} className="cursor-pointer border-b border-slate-50 transition-colors hover:bg-slate-50">
                                  <td className="px-3 py-2.5 text-slate-800">{c.containerNumber || "—"}</td>
                                  <td className="px-3 py-2.5 text-slate-800">{packer?.name || "—"}</td>
                                  <td className="px-3 py-2.5 text-slate-800">{c.sealNumber || "—"}</td>
                                  <td className="px-3 py-2.5 text-slate-800">{c.containerIsoCode || "—"}</td>
                                  <td className="px-3 py-2.5 text-slate-800">{c.releaseRef || "—"}</td>
                                  <td className="px-3 py-2.5 font-semibold text-emerald-600">{c.nett != null ? (c.nett / 1000).toFixed(3) : "—"}</td>
                                  <td className="px-3 py-2.5 text-slate-800">{c.emptyContainerInspectionResult || "—"}</td>
                                  <td className="px-3 py-2.5 text-slate-800">{c.grainInspectionResult || "—"}</td>
                                  <td className="px-3 py-2.5 text-slate-800">{c.packerSignoff || "—"}</td>
                                  <td className="px-3 py-2.5"><StatusBadge status={c.status || "draft"} /></td>
                                  <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                                    {!isCompleted && (
                                      <button type="button" disabled={!canComplete} onClick={() => canComplete && completeContainer(c)}
                                        className={cn("text-xs font-medium", canComplete ? "text-emerald-600 hover:underline" : "cursor-not-allowed text-slate-300")}>
                                        Complete
                                      </button>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Container modal */ }
  <Modal open={containerModalOpen} title={editingContainerId ? "Edit container" : "Add container"} onClose={() => setContainerModalOpen(false)}>
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Container number"><input suppressHydrationWarning className={inputClass} value={containerForm.containerNumber || ""} onChange={(e) => set("containerNumber", e.target.value)} placeholder="e.g. MSKU1234567" /></Field>
      <Field label="Seal number"><input suppressHydrationWarning className={inputClass} value={containerForm.sealNumber || ""} onChange={(e) => set("sealNumber", e.target.value)} placeholder="Seal" /></Field>
      <Field label="Container ISO code">
        <select suppressHydrationWarning className={inputClass} value={containerForm.containerIsoCode || ""} onChange={(e) => set("containerIsoCode", e.target.value)}>
          <option value="">â€” Select â€”</option>
          {MOCK_CONTAINER_CODES.map((c) => <option key={c.id} value={c.isoCode}>{c.isoCode} ({c.containerSize})</option>)}
        </select>
      </Field>
      <Field label="Start date & time"><input suppressHydrationWarning type="datetime-local" className={inputClass} value={containerForm.startDateTime || ""} onChange={(e) => set("startDateTime", e.target.value)} /></Field>
      <Field label="Stock location">
        <select suppressHydrationWarning className={inputClass} value={containerForm.stockLocationId ?? ""} onChange={(e) => set("stockLocationId", e.target.value)}>
          <option value="">â€” Select â€”</option>
          {MOCK_STOCK_LOCATIONS.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
      </Field>
      <Field label="Packer">
        <select suppressHydrationWarning className={inputClass} value={containerForm.packerId ?? ""} onChange={(e) => set("packerId", e.target.value)}>
          <option value="">â€” Select â€”</option>
          {MOCK_PACKERS.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </Field>
      <Field label="Container park">
        <select suppressHydrationWarning className={inputClass} value={containerForm.emptyContainerParkId ?? ""} onChange={(e) => set("emptyContainerParkId", e.target.value)}>
          <option value="">â€” Select â€”</option>
          {MOCK_CONTAINER_PARKS.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </Field>
      <Field label="Transporter">
        <select suppressHydrationWarning className={inputClass} value={containerForm.transporterId ?? ""} onChange={(e) => set("transporterId", e.target.value)}>
          <option value="">â€” Select â€”</option>
          {MOCK_TRANSPORTERS.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </Field>
    </div>

    <p className="mt-4 text-xs font-bold text-slate-600">Weights (t)</p>
    <div className="mt-2 grid grid-cols-4 gap-3">
      <Field label="Tare"><input suppressHydrationWarning type="number" className={inputClass} value={containerForm.tare ?? ""} onChange={(e) => set("tare", e.target.value)} /></Field>
      <Field label="Container tare"><input suppressHydrationWarning type="number" className={inputClass} value={containerForm.containerTare ?? ""} onChange={(e) => set("containerTare", e.target.value)} /></Field>
      <Field label="Gross"><input suppressHydrationWarning type="number" className={inputClass} value={containerForm.gross ?? ""} onChange={(e) => set("gross", e.target.value)} /></Field>
      <Field label="Nett"><input suppressHydrationWarning type="number" className={inputClass} value={containerForm.nett ?? ""} onChange={(e) => set("nett", e.target.value)} /></Field>
    </div>

    <p className="mt-4 text-xs font-bold text-slate-600">Packer signoff</p>
    <div className="mt-2 grid gap-3 sm:grid-cols-2">
      <Field label="Packer signoff"><input suppressHydrationWarning className={inputClass} value={containerForm.packerSignoff || ""} onChange={(e) => set("packerSignoff", e.target.value)} placeholder="Name" /></Field>
      <Field label="Signoff date & time"><input suppressHydrationWarning type="datetime-local" className={inputClass} value={containerForm.packerSignoffDateTime || ""} onChange={(e) => set("packerSignoffDateTime", e.target.value)} /></Field>
    </div>

    <div className="mt-3">
      <Field label="Authorised officer"><input suppressHydrationWarning className={inputClass} value={containerForm.authorisedOfficer || ""} onChange={(e) => set("authorisedOfficer", e.target.value)} placeholder="Name" /></Field>
    </div>

    <p className="mt-4 text-xs font-bold text-slate-600">Empty container inspection</p>
    <div className="mt-2 grid gap-3" style={{ gridTemplateColumns: "140px 1fr" }}>
      <Field label="Result">
        <select suppressHydrationWarning className={inputClass} value={containerForm.emptyContainerInspectionResult || ""} onChange={(e) => set("emptyContainerInspectionResult", e.target.value)}>
          <option value="">â€”</option>
          {INSPECTION_RESULTS.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
      </Field>
      <Field label="Remark"><input suppressHydrationWarning className={inputClass} value={containerForm.emptyContainerInspectionRemark || ""} onChange={(e) => set("emptyContainerInspectionRemark", e.target.value)} placeholder="Remark" /></Field>
    </div>

    <p className="mt-4 text-xs font-bold text-slate-600">Grain inspection</p>
    <div className="mt-2 grid gap-3" style={{ gridTemplateColumns: "140px 1fr" }}>
      <Field label="Result">
        <select suppressHydrationWarning className={inputClass} value={containerForm.grainInspectionResult || ""} onChange={(e) => set("grainInspectionResult", e.target.value)}>
          <option value="">â€”</option>
          {INSPECTION_RESULTS.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
      </Field>
      <Field label="Remark"><input suppressHydrationWarning className={inputClass} value={containerForm.grainInspectionRemark || ""} onChange={(e) => set("grainInspectionRemark", e.target.value)} placeholder="Remark" /></Field>
    </div>

    <TestsSection
      commodity={commodity}
      tests={containerForm.tests || {}}
      onChange={(nextTests) => set("tests", nextTests)}
    />

    <p className="mt-4 text-xs font-bold text-slate-600">Authorised officer sign-off</p>
    <div className="mt-2 grid gap-3 sm:grid-cols-2">
      <Field label="Officer signoff"><input suppressHydrationWarning className={inputClass} value={containerForm.authorisedOfficerSignoff || ""} onChange={(e) => set("authorisedOfficerSignoff", e.target.value)} placeholder="Name" /></Field>
      <Field label="Sign-off date & time"><input suppressHydrationWarning type="datetime-local" className={inputClass} value={containerForm.authorisedOfficerSignoffDateTime || ""} onChange={(e) => set("authorisedOfficerSignoffDateTime", e.target.value)} /></Field>
    </div>

    <div className="mt-5 flex justify-end gap-2">
      {editingContainerId && <Button type="button" variant="destructive" size="sm" onClick={() => removeContainer(editingContainerId)}>Remove</Button>}
      <Button type="button" variant="ghost" size="sm" onClick={() => setContainerModalOpen(false)}>Cancel</Button>
      <Button type="button" size="sm" onClick={saveContainer}>Save</Button>
    </div>
  </Modal>
    </div >
  );
}


function Field({ label, children }) {
  return (
    <div className="space-y-1">
      <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">{label}</label>
      {children}
    </div>
  );
}

function StatusBadgeSmall({ status, label }) {
  const cls = status === "pass"
    ? "bg-emerald-100 text-emerald-700"
    : status === "fail"
      ? "bg-red-100 text-red-700"
      : "bg-slate-100 text-slate-500";
  const icon = status === "pass" ? "✓" : status === "fail" ? "✗" : "·";
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold", cls)}>
      {icon} {label}
    </span>
  );
}

function TestsSection({ commodity, tests, onChange }) {
  const applicable = commodity ? getApplicableTests(commodity) : [];
  if (applicable.length === 0) return null;

  function setIndividual(name, value) {
    onChange({ ...tests, [name]: { value } });
  }

  function setGroupFindings(name, findings) {
    onChange({ ...tests, [name]: { findings } });
  }

  return (
    <>
      <p className="mt-4 text-xs font-bold text-slate-600">Tests</p>
      <div className="mt-2 space-y-3">
        {applicable.map(({ def, threshold }) => {
          if (def.type === "Group") {
            const findings = tests?.[def.testName]?.findings ?? [];
            return (
              <GroupTestPanel
                key={def.id}
                def={def}
                threshold={threshold}
                findings={findings}
                onChange={(next) => setGroupFindings(def.testName, next)}
              />
            );
          }
          const value = tests?.[def.testName]?.value ?? "";
          const result = evaluateIndividual(value, threshold.min, threshold.max);
          return (
            <IndividualTestRow
              key={def.id}
              def={def}
              threshold={threshold}
              value={value}
              status={result.status}
              onChange={(v) => setIndividual(def.testName, v)}
            />
          );
        })}
      </div>
    </>
  );
}

function thresholdLabel(threshold, unit) {
  const parts = [];
  if (threshold.min !== "" && threshold.min != null) parts.push(`min ${threshold.min}`);
  if (threshold.max !== "" && threshold.max != null) parts.push(`max ${threshold.max}`);
  if (parts.length === 0) return "";
  return `${parts.join(" · ")}${unit ? ` ${unit}` : ""}`;
}

function IndividualTestRow({ def, threshold, value, status, onChange }) {
  return (
    <div className={cn(
      "flex items-center gap-3 rounded-lg border px-3 py-2.5",
      status === "fail" ? "border-red-200 bg-red-50/40" : "border-slate-200 bg-white"
    )}>
      <div className="min-w-[140px]">
        <p className="text-sm font-semibold text-slate-800">{def.testName}</p>
        <p className="text-[11px] text-slate-500">{def.type}{def.unit ? ` · ${def.unit}` : ""}</p>
      </div>
      <span className="text-xs text-slate-500 min-w-[120px]">{thresholdLabel(threshold, def.unit) || "—"}</span>
      <input
        type="number"
        className={cn(inputClass, "max-w-[120px]")}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Enter value"
      />
      <div className="ml-auto">
        <StatusBadgeSmall
          status={status}
          label={status === "pass" ? "Pass" : status === "fail" ? "Out of range" : "Not entered"}
        />
      </div>
    </div>
  );
}

function GroupTestPanel({ def, threshold, findings, onChange }) {
  const [addOpen, setAddOpen] = useState(false);
  const allMembers = getGroupMembers(def);
  const usedNames = new Set(findings.map((f) => f.name));
  const available = allMembers.filter((m) => !usedNames.has(m.testName));

  const { status, total } = evaluateGroup(findings, threshold.max);
  const maxLabel = threshold.max !== "" && threshold.max != null ? threshold.max : "—";

  function addFinding(memberName) {
    onChange([...findings, { name: memberName, count: "" }]);
    setAddOpen(false);
  }

  function updateCount(idx, count) {
    onChange(findings.map((f, i) => (i === idx ? { ...f, count } : f)));
  }

  function removeFinding(idx) {
    onChange(findings.filter((_, i) => i !== idx));
  }

  return (
    <div className={cn(
      "rounded-lg border",
      status === "fail" ? "border-red-200 bg-red-50/40" : "border-slate-200 bg-white"
    )}>
      <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2.5">
        <div>
          <p className="text-sm font-semibold text-slate-800">
            {def.testName} <span className="text-[11px] font-normal text-slate-500">(Group)</span>
          </p>
          <p className="text-[11px] text-slate-500">max {maxLabel}{def.unit ? ` ${def.unit}` : ""}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className={cn(
            "text-sm font-bold tabular-nums",
            status === "fail" ? "text-red-600" : "text-slate-700"
          )}>
            Sum: {total} / {maxLabel}
          </span>
          <StatusBadgeSmall
            status={status}
            label={status === "pass" ? "Pass" : status === "fail" ? "Over max" : "Not entered"}
          />
        </div>
      </div>

      <div className="space-y-1.5 p-3">
        {findings.length === 0 ? (
          <p className="px-1 text-xs text-slate-400">No findings recorded.</p>
        ) : (
          findings.map((f, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <span className="flex-1 text-sm text-slate-700">{f.name}</span>
              <input
                type="number"
                min="0"
                value={f.count}
                onChange={(e) => updateCount(idx, e.target.value)}
                className={cn(inputClass, "max-w-[100px] text-center")}
                placeholder="0"
              />
              <button
                type="button"
                onClick={() => removeFinding(idx)}
                className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-500 hover:bg-red-50 hover:text-red-500 hover:border-red-200"
                title="Remove finding"
              >
                ×
              </button>
            </div>
          ))
        )}

        {available.length > 0 ? (
          <div className="pt-1">
            {!addOpen ? (
              <button
                type="button"
                onClick={() => setAddOpen(true)}
                className="text-xs font-semibold text-brand hover:underline"
              >
                + Add finding
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <select
                  autoFocus
                  className={inputClass}
                  defaultValue=""
                  onChange={(e) => { if (e.target.value) addFinding(e.target.value); }}
                >
                  <option value="" disabled>Select a member…</option>
                  {available.map((m) => (
                    <option key={m.id} value={m.testName}>{m.testName}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setAddOpen(false)}
                  className="text-xs text-slate-500 hover:underline"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        ) : findings.length > 0 ? (
          <p className="pt-1 text-[11px] text-slate-400">All members recorded.</p>
        ) : null}
      </div>
    </div>
  );
}

function Modal({ open, title, onClose, children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button type="button" className="absolute inset-0 bg-black/40" aria-label="Close" onClick={onClose} />
      <div role="dialog" aria-modal="true" className="relative max-h-[min(90vh,780px)] w-full max-w-2xl overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
          <button type="button" className="rounded-md px-2 py-1 text-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800" onClick={onClose}>Ã—</button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}