"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/* â”€â”€â”€ Shared input class â”€â”€â”€ */
const inputClass =
  "w-full rounded-lg border border-slate-200/95 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-brand/15 placeholder:text-slate-400 focus:border-brand/35 focus:ring-2";

/* â”€â”€â”€ Mock data â”€â”€â”€ */
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

const MOCK_TRUCKS = [
  { id: 1, name: "Truck A â€“ XYZ-001" },
  { id: 2, name: "Truck B â€“ ABC-002" },
  { id: 3, name: "Truck C â€“ DEF-003" },
];

const MOCK_STOCK_LOCATIONS = [
  { id: 1, name: "Bay 1 â€“ Main Shed" },
  { id: 2, name: "Bay 2 â€“ Overflow" },
  { id: 3, name: "Silo A" },
];

function blankTicket() {
  return {
    id: null,
    date: new Date().toISOString().split("T")[0],
    truckId: "",
    grossWeight: "",
    tareWeight: "",
    locationId: "",
    signoff: "",
    notes: "",
    status: "pending",
  };
}

function calcNetWeight(ticket) {
  const gross = Number(ticket.grossWeight);
  const tare = Number(ticket.tareWeight);
  if (!Number.isFinite(gross) || !Number.isFinite(tare)) return 0;
  return Math.max(0, (gross - tare) / 1000); // kg -> MT
}

/* â”€â”€â”€ Initial mock packs â”€â”€â”€ */
const INITIAL_PACKS = [
  {
    id: 1,
    jobReference: "JOB-2026-010",
    customerId: 1,
    commodityId: 1,
    importExport: "Export",
    status: "Pending",
    testRequired: false,
    shrinkTaken: false,
    destinationCountry: "Japan",
    destinationPort: "Yokohama",
    mtTotal: 250,
    bulkTickets: [],
  },
  {
    id: 2,
    jobReference: "JOB-2026-011",
    customerId: 2,
    commodityId: 2,
    importExport: "Export",
    status: "Inprogress",
    testRequired: true,
    shrinkTaken: false,
    destinationCountry: "India",
    destinationPort: "Mumbai",
    mtTotal: 180,
    bulkTickets: [
      { id: 101, date: "2026-05-10", truckId: 1, grossWeight: 32000, tareWeight: 8000, locationId: 1, signoff: "J. Turner", notes: "", status: "completed" },
      { id: 102, date: "2026-05-10", truckId: 2, grossWeight: 28500, tareWeight: 7800, locationId: 2, signoff: "S. Mitchell", notes: "Second load", status: "pending" },
    ],
  },
  {
    id: 3,
    jobReference: "JOB-2026-012",
    customerId: 3,
    commodityId: 3,
    importExport: "Import",
    status: "Pending",
    testRequired: false,
    shrinkTaken: true,
    destinationCountry: "Australia",
    destinationPort: "Melbourne",
    mtTotal: 120,
    bulkTickets: [],
  },
];

/* â”€â”€â”€ Status badge â”€â”€â”€ */
function StatusBadge({ status }) {
  const map = {
    Pending: "bg-amber-100 text-amber-800",
    Inprogress: "bg-blue-100 text-blue-800",
    Completed: "bg-emerald-100 text-emerald-800",
    completed: "bg-emerald-100 text-emerald-800",
    pending: "bg-slate-100 text-slate-600",
  };
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", map[status] || "bg-slate-100 text-slate-600")}>
      {status}
    </span>
  );
}

/* â”€â”€â”€ Main page â”€â”€â”€ */
export default function BulkPackingPage() {
  const [packs, setPacks] = useState(() => [...INITIAL_PACKS]);
  const [selectedPackId, setSelectedPackId] = useState(null);
  const [ticketModalOpen, setTicketModalOpen] = useState(false);
  const [editingTicketId, setEditingTicketId] = useState(null);
  const [ticketForm, setTicketForm] = useState(() => blankTicket());

  const bulkPacks = useMemo(
    () => packs.filter((p) => ["Pending", "Inprogress"].includes(p.status)),
    [packs]
  );

  const selectedPack = selectedPackId ? packs.find((p) => p.id === selectedPackId) : null;
  const bulkTickets = selectedPack?.bulkTickets || [];
  const customer = selectedPack ? MOCK_CUSTOMERS.find((c) => c.id === selectedPack.customerId) : null;
  const commodity = selectedPack ? MOCK_COMMODITIES.find((c) => c.id === selectedPack.commodityId) : null;

  /* â”€â”€ Ticket CRUD â”€â”€ */
  function openNewTicket() {
    setEditingTicketId(null);
    setTicketForm(blankTicket());
    setTicketModalOpen(true);
  }

  function openEditTicket(bt) {
    setEditingTicketId(bt.id);
    setTicketForm({ ...bt, truckId: bt.truckId ?? "", locationId: bt.locationId ?? "" });
    setTicketModalOpen(true);
  }

  function saveTicket() {
    if (!selectedPackId) return;
    const payload = {
      ...ticketForm,
      truckId: ticketForm.truckId ? Number(ticketForm.truckId) : null,
      locationId: ticketForm.locationId ? Number(ticketForm.locationId) : null,
      grossWeight: ticketForm.grossWeight !== "" ? Number(ticketForm.grossWeight) : null,
      tareWeight: ticketForm.tareWeight !== "" ? Number(ticketForm.tareWeight) : null,
    };

    setPacks((prev) =>
      prev.map((p) => {
        if (p.id !== selectedPackId) return p;
        let tickets = [...(p.bulkTickets || [])];
        if (editingTicketId) {
          tickets = tickets.map((t) => (t.id === editingTicketId ? { ...t, ...payload } : t));
        } else {
          const nextId = tickets.length > 0 ? Math.max(...tickets.map((t) => t.id)) + 1 : 1;
          tickets.push({ ...payload, id: nextId, status: "pending" });
        }
        return { ...p, bulkTickets: tickets };
      })
    );
    setTicketModalOpen(false);
  }

  function completeTicket(bt) {
    if (!selectedPackId) return;
    setPacks((prev) =>
      prev.map((p) => {
        if (p.id !== selectedPackId) return p;
        return {
          ...p,
          bulkTickets: (p.bulkTickets || []).map((t) =>
            t.id === bt.id ? { ...t, status: "completed" } : t
          ),
        };
      })
    );
  }

  function removeTicket(ticketId) {
    if (!selectedPackId) return;
    setPacks((prev) =>
      prev.map((p) => {
        if (p.id !== selectedPackId) return p;
        return { ...p, bulkTickets: (p.bulkTickets || []).filter((t) => t.id !== ticketId) };
      })
    );
    setTicketModalOpen(false);
  }

  function startJob() {
    if (!selectedPackId) return;
    setPacks((prev) =>
      prev.map((p) => (p.id === selectedPackId ? { ...p, status: "Inprogress" } : p))
    );
  }

  const set = (key, val) => setTicketForm((prev) => ({ ...prev, [key]: val }));

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs text-slate-500">Packing / Bulk Packing</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">Bulk Packing</h1>
      </div>

      <div className="flex gap-4" style={{ minHeight: 520 }}>
        {/* â”€â”€ Left: Pack list â”€â”€ */}
        <div className="w-72 shrink-0 overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-sm">
          <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Bulk pack jobs</p>
          </div>
          <div className="overflow-y-auto" style={{ maxHeight: 480 }}>
            {bulkPacks.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-slate-400">
                No bulk pack jobs (Pending / In progress).
              </p>
            ) : (
              bulkPacks.map((p) => {
                const cust = MOCK_CUSTOMERS.find((c) => c.id === p.customerId);
                const isSelected = selectedPackId === p.id;
                const cnt = (p.bulkTickets || []).length;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSelectedPackId(p.id)}
                    className={cn(
                      "w-full border-b border-slate-100 px-4 py-3 text-left text-sm transition-colors",
                      isSelected ? "bg-blue-50" : "hover:bg-slate-50"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-brand">#{p.id}</span>
                      <StatusBadge status={p.status} />
                    </div>
                    <p className="mt-1 text-xs text-slate-500">{p.jobReference || "â€”"}</p>
                    <p className="text-xs text-slate-700">{cust?.name || "â€”"}</p>
                    <p className="mt-1 text-[10px] text-slate-400">Tickets: {cnt}</p>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* â”€â”€ Right: Selected pack detail + tickets â”€â”€ */}
        <div className="flex flex-1 flex-col overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-sm">
          {!selectedPack ? (
            <div className="flex flex-1 items-center justify-center text-sm text-slate-400">
              Select a bulk pack job.
            </div>
          ) : (
            <>
              {/* Pack header */}
              <div className="border-b border-slate-200 px-5 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">
                      Pack #{selectedPack.id} Â· {selectedPack.jobReference || "â€”"}
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      {customer?.name} Â· {commodity?.description} Â· {selectedPack.importExport}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      Destination: {selectedPack.destinationCountry || "â€”"}{" "}
                      {selectedPack.destinationPort ? `Â· ${selectedPack.destinationPort}` : ""}
                    </p>
                    <p className="mt-0.5 text-[11px] text-slate-400">
                      Test required: {selectedPack.testRequired ? "Yes" : "No"} Â· Shrink taken: {selectedPack.shrinkTaken ? "Yes" : "No"}
                    </p>
                  </div>
                  {selectedPack.status === "Pending" && (
                    <Button size="sm" onClick={startJob}>
                      Start job
                    </Button>
                  )}
                </div>
              </div>

              {/* Tickets area */}
              <div className="flex-1 overflow-auto p-5">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-700">
                    Bulk tickets ({bulkTickets.length})
                  </span>
                  <Button size="sm" onClick={openNewTicket}>
                    + Add ticket
                  </Button>
                </div>

                {bulkTickets.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-slate-200 py-10 text-center text-sm text-slate-400">
                    No tickets yet. Add tickets with weights and location.
                  </div>
                ) : (
                  <div className="overflow-hidden rounded-lg border border-slate-200">
                    <table className="w-full border-collapse text-xs">
                      <thead>
                        <tr className="border-b-2 border-slate-100 bg-slate-50 text-left">
                          <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Date</th>
                          <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Truck</th>
                          <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Gross (kg)</th>
                          <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Tare (kg)</th>
                          <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Net (MT)</th>
                          <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Location</th>
                          <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Status</th>
                          <th className="px-3 py-2.5" />
                        </tr>
                      </thead>
                      <tbody>
                        {bulkTickets.map((bt) => {
                          const truck = MOCK_TRUCKS.find((t) => t.id === bt.truckId);
                          const loc = MOCK_STOCK_LOCATIONS.find((l) => l.id === bt.locationId);
                          const net = calcNetWeight(bt);
                          const canComplete = net > 0 && bt.grossWeight != null && bt.tareWeight != null && bt.locationId;
                          return (
                            <tr key={bt.id} className="border-b border-slate-50">
                              <td className="px-3 py-2.5 text-slate-800">{bt.date || "â€”"}</td>
                              <td className="px-3 py-2.5 text-slate-800">{truck?.name || "â€”"}</td>
                              <td className="px-3 py-2.5 text-slate-800">{bt.grossWeight ?? "â€”"}</td>
                              <td className="px-3 py-2.5 text-slate-800">{bt.tareWeight ?? "â€”"}</td>
                              <td className="px-3 py-2.5 font-semibold text-emerald-600">
                                {net > 0 ? net.toFixed(3) : "â€”"}
                              </td>
                              <td className="px-3 py-2.5 text-slate-800">{loc?.name || "â€”"}</td>
                              <td className="px-3 py-2.5">
                                <StatusBadge status={bt.status} />
                              </td>
                              <td className="whitespace-nowrap px-3 py-2.5">
                                {bt.status !== "completed" && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => openEditTicket(bt)}
                                      className="mr-2 text-xs font-medium text-brand hover:underline"
                                    >
                                      Edit
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => completeTicket(bt)}
                                      disabled={!canComplete}
                                      className={cn(
                                        "text-xs font-medium",
                                        canComplete ? "text-emerald-600 hover:underline" : "cursor-not-allowed text-slate-300"
                                      )}
                                    >
                                      Complete
                                    </button>
                                  </>
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

      {/* â”€â”€ Ticket modal â”€â”€ */}
      <Modal
        open={ticketModalOpen}
        title={editingTicketId ? "Edit bulk ticket" : "Add bulk ticket"}
        onClose={() => setTicketModalOpen(false)}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label="Date" required>
            <input suppressHydrationWarning type="date" className={inputClass} value={ticketForm.date || ""} onChange={(e) => set("date", e.target.value)} />
          </FormField>
          <FormField label="Truck">
            <select suppressHydrationWarning className={inputClass} value={ticketForm.truckId ?? ""} onChange={(e) => set("truckId", e.target.value)}>
              <option value="">â€” Select â€”</option>
              {MOCK_TRUCKS.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </FormField>
          <FormField label="Gross weight (kg)">
            <input suppressHydrationWarning type="number" className={inputClass} value={ticketForm.grossWeight ?? ""} onChange={(e) => set("grossWeight", e.target.value)} placeholder="kg" />
          </FormField>
          <FormField label="Tare weight (kg)">
            <input suppressHydrationWarning type="number" className={inputClass} value={ticketForm.tareWeight ?? ""} onChange={(e) => set("tareWeight", e.target.value)} placeholder="kg" />
          </FormField>
          <FormField label="Location">
            <select suppressHydrationWarning className={inputClass} value={ticketForm.locationId ?? ""} onChange={(e) => set("locationId", e.target.value)}>
              <option value="">â€” Select â€”</option>
              {MOCK_STOCK_LOCATIONS.map((l) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          </FormField>
          <FormField label="Signoff">
            <input suppressHydrationWarning className={inputClass} value={ticketForm.signoff || ""} onChange={(e) => set("signoff", e.target.value)} placeholder="Name" />
          </FormField>
        </div>
        <div className="mt-3">
          <FormField label="Notes" wide>
            <textarea
              className={cn(inputClass, "min-h-16 resize-y")}
              value={ticketForm.notes || ""}
              onChange={(e) => set("notes", e.target.value)}
              placeholder="Notes"
              rows={2}
            />
          </FormField>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          {editingTicketId && (
            <Button type="button" variant="destructive" size="sm" onClick={() => removeTicket(editingTicketId)}>
              Remove
            </Button>
          )}
          <Button type="button" variant="ghost" size="sm" onClick={() => setTicketModalOpen(false)}>
            Cancel
          </Button>
          <Button type="button" size="sm" onClick={saveTicket}>
            Save
          </Button>
        </div>
      </Modal>
    </div>
  );
}

/* â”€â”€â”€ Sub components â”€â”€â”€ */

function FormField({ label, required, wide, children }) {
  return (
    <div className={cn("space-y-1", wide && "sm:col-span-2")}>
      <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">
        {label}
        {required ? <span className="text-red-500"> *</span> : null}
      </label>
      {children}
    </div>
  );
}

function Modal({ open, title, onClose, children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button type="button" className="absolute inset-0 bg-black/40" aria-label="Close dialog" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        className="relative max-h-[min(90vh,720px)] w-full max-w-xl overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
          <button type="button" className="rounded-md px-2 py-1 text-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800" onClick={onClose}>
            Ã—
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}