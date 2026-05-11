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
  { id: 1, name: "Bay 1 – Main Shed" },
  { id: 2, name: "Bay 2 – Overflow" },
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
  { id: 1, description: "Wheat" },
  { id: 2, description: "Chickpeas" },
  { id: 3, description: "Canola" },
];
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
                  <p className="mt-1 text-xs text-slate-500">{p.jobReference || "—"}</p>
                  <p className="text-xs text-slate-700">{cust?.name || "—"}</p>
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
                    <h2 className="text-lg font-bold text-slate-900">Pack #{selectedPack.id} · {selectedPack.jobReference || "—"}</h2>
                    <p className="mt-1 text-sm text-slate-500">{customer?.name} · {commodity?.description} · {selectedPack.importExport}</p>
                  </div>
                  {selectedPack.status === "Pending" && <Button size="sm" onClick={startJob}>Start job</Button>}
                </div>

                {/* Verification checklist */}
                <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <p className="mb-3 text-xs font-bold text-slate-600">Verify before packing</p>
                  <div className="flex flex-wrap gap-x-6 gap-y-2">
                    {VERIFY_ITEMS.map(({ key, label }) => (
                      <label key={key} className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                        <input type="checkbox" checked={!!verification[key]} onChange={(e) => setVerification(key, e.target.checked)} className="accent-blue-500" />
                        {label}
                      </label>
                    ))}
                  </div>
                  {!allVerified && <p className="mt-2 text-xs text-amber-600">Complete all checks before packing containers.</p>}
                </div>
              </div>

              {/* Containers table */}
              <div className="flex-1 overflow-auto p-5">
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
              </div>
            </>
          )}
        </div>
      </div>

      {/* Container modal */}
      <Modal open={containerModalOpen} title={editingContainerId ? "Edit container" : "Add container"} onClose={() => setContainerModalOpen(false)}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Container number"><input className={inputClass} value={containerForm.containerNumber || ""} onChange={(e) => set("containerNumber", e.target.value)} placeholder="e.g. MSKU1234567" /></Field>
          <Field label="Seal number"><input className={inputClass} value={containerForm.sealNumber || ""} onChange={(e) => set("sealNumber", e.target.value)} placeholder="Seal" /></Field>
          <Field label="Container ISO code">
            <select className={inputClass} value={containerForm.containerIsoCode || ""} onChange={(e) => set("containerIsoCode", e.target.value)}>
              <option value="">— Select —</option>
              {MOCK_CONTAINER_CODES.map((c) => <option key={c.id} value={c.isoCode}>{c.isoCode} ({c.containerSize})</option>)}
            </select>
          </Field>
          <Field label="Start date & time"><input type="datetime-local" className={inputClass} value={containerForm.startDateTime || ""} onChange={(e) => set("startDateTime", e.target.value)} /></Field>
          <Field label="Stock location">
            <select className={inputClass} value={containerForm.stockLocationId ?? ""} onChange={(e) => set("stockLocationId", e.target.value)}>
              <option value="">— Select —</option>
              {MOCK_STOCK_LOCATIONS.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </Field>
          <Field label="Packer">
            <select className={inputClass} value={containerForm.packerId ?? ""} onChange={(e) => set("packerId", e.target.value)}>
              <option value="">— Select —</option>
              {MOCK_PACKERS.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Field>
          <Field label="Container park">
            <select className={inputClass} value={containerForm.emptyContainerParkId ?? ""} onChange={(e) => set("emptyContainerParkId", e.target.value)}>
              <option value="">— Select —</option>
              {MOCK_CONTAINER_PARKS.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Field>
          <Field label="Transporter">
            <select className={inputClass} value={containerForm.transporterId ?? ""} onChange={(e) => set("transporterId", e.target.value)}>
              <option value="">— Select —</option>
              {MOCK_TRANSPORTERS.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </Field>
        </div>

        <p className="mt-4 text-xs font-bold text-slate-600">Weights (t)</p>
        <div className="mt-2 grid grid-cols-4 gap-3">
          <Field label="Tare"><input type="number" className={inputClass} value={containerForm.tare ?? ""} onChange={(e) => set("tare", e.target.value)} /></Field>
          <Field label="Container tare"><input type="number" className={inputClass} value={containerForm.containerTare ?? ""} onChange={(e) => set("containerTare", e.target.value)} /></Field>
          <Field label="Gross"><input type="number" className={inputClass} value={containerForm.gross ?? ""} onChange={(e) => set("gross", e.target.value)} /></Field>
          <Field label="Nett"><input type="number" className={inputClass} value={containerForm.nett ?? ""} onChange={(e) => set("nett", e.target.value)} /></Field>
        </div>

        <p className="mt-4 text-xs font-bold text-slate-600">Packer signoff</p>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          <Field label="Packer signoff"><input className={inputClass} value={containerForm.packerSignoff || ""} onChange={(e) => set("packerSignoff", e.target.value)} placeholder="Name" /></Field>
          <Field label="Signoff date & time"><input type="datetime-local" className={inputClass} value={containerForm.packerSignoffDateTime || ""} onChange={(e) => set("packerSignoffDateTime", e.target.value)} /></Field>
        </div>

        <div className="mt-3">
          <Field label="Authorised officer"><input className={inputClass} value={containerForm.authorisedOfficer || ""} onChange={(e) => set("authorisedOfficer", e.target.value)} placeholder="Name" /></Field>
        </div>

        <p className="mt-4 text-xs font-bold text-slate-600">Empty container inspection</p>
        <div className="mt-2 grid gap-3" style={{ gridTemplateColumns: "140px 1fr" }}>
          <Field label="Result">
            <select className={inputClass} value={containerForm.emptyContainerInspectionResult || ""} onChange={(e) => set("emptyContainerInspectionResult", e.target.value)}>
              <option value="">—</option>
              {INSPECTION_RESULTS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </Field>
          <Field label="Remark"><input className={inputClass} value={containerForm.emptyContainerInspectionRemark || ""} onChange={(e) => set("emptyContainerInspectionRemark", e.target.value)} placeholder="Remark" /></Field>
        </div>

        <p className="mt-4 text-xs font-bold text-slate-600">Grain inspection</p>
        <div className="mt-2 grid gap-3" style={{ gridTemplateColumns: "140px 1fr" }}>
          <Field label="Result">
            <select className={inputClass} value={containerForm.grainInspectionResult || ""} onChange={(e) => set("grainInspectionResult", e.target.value)}>
              <option value="">—</option>
              {INSPECTION_RESULTS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </Field>
          <Field label="Remark"><input className={inputClass} value={containerForm.grainInspectionRemark || ""} onChange={(e) => set("grainInspectionRemark", e.target.value)} placeholder="Remark" /></Field>
        </div>

        <p className="mt-4 text-xs font-bold text-slate-600">Authorised officer sign-off</p>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          <Field label="Officer signoff"><input className={inputClass} value={containerForm.authorisedOfficerSignoff || ""} onChange={(e) => set("authorisedOfficerSignoff", e.target.value)} placeholder="Name" /></Field>
          <Field label="Sign-off date & time"><input type="datetime-local" className={inputClass} value={containerForm.authorisedOfficerSignoffDateTime || ""} onChange={(e) => set("authorisedOfficerSignoffDateTime", e.target.value)} /></Field>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          {editingContainerId && <Button type="button" variant="destructive" size="sm" onClick={() => removeContainer(editingContainerId)}>Remove</Button>}
          <Button type="button" variant="ghost" size="sm" onClick={() => setContainerModalOpen(false)}>Cancel</Button>
          <Button type="button" size="sm" onClick={saveContainer}>Save</Button>
        </div>
      </Modal>
    </div>
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

function Modal({ open, title, onClose, children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button type="button" className="absolute inset-0 bg-black/40" aria-label="Close" onClick={onClose} />
      <div role="dialog" aria-modal="true" className="relative max-h-[min(90vh,780px)] w-full max-w-2xl overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
          <button type="button" className="rounded-md px-2 py-1 text-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800" onClick={onClose}>×</button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}
