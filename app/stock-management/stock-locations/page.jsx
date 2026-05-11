"use client";

import { useState } from "react";
import { Grid } from "@/components/clutch-table";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const inputClass =
  "w-full rounded-lg border border-slate-200/95 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-brand/15 placeholder:text-slate-400 focus:border-brand/35 focus:ring-2";

const INITIAL_LOCATIONS = [
  { id: 1, name: "Bay 1 – Main Shed", type: "Bay", capacity: 500, unit: "MT", status: "Active", description: "Primary grain storage bay" },
  { id: 2, name: "Bay 2 – Overflow", type: "Bay", capacity: 300, unit: "MT", status: "Active", description: "Secondary overflow storage" },
  { id: 3, name: "Silo A", type: "Silo", capacity: 1000, unit: "MT", status: "Active", description: "Bulk grain silo" },
  { id: 4, name: "Silo B", type: "Silo", capacity: 800, unit: "MT", status: "Under Maintenance", description: "Under repair" },
  { id: 5, name: "Dock Staging", type: "Staging", capacity: 100, unit: "MT", status: "Active", description: "Temporary staging area at dock" },
];

const LOCATION_TYPES = ["Bay", "Silo", "Staging", "Yard", "Other"];
const STATUSES = ["Active", "Under Maintenance", "Inactive"];

function blankLocation() {
  return { name: "", type: "Bay", capacity: "", unit: "MT", status: "Active", description: "" };
}

const gridColumns = [
  { key: "name", header: "Name", type: "text", sortable: true, filterable: true, resizable: true },
  { key: "type", header: "Type", type: "text", sortable: true, filterable: true, resizable: true },
  { key: "capacityDisplay", header: "Capacity", type: "text", sortable: true, filterable: true, resizable: true },
  { key: "status", header: "Status", type: "text", sortable: true, filterable: true, resizable: true },
  { key: "description", header: "Description", type: "text", sortable: true, filterable: true, resizable: true },
];

/* Mock stock data logic for locations */
function getLocationStock(locationId) {
  if (locationId === 1) return { totalWeight: 240.5, items: [{ comm: "Wheat", type: "Grain", qty: 180.5 }, { comm: "Barley", type: "Grain", qty: 60.0 }] };
  if (locationId === 2) return { totalWeight: 22.5, items: [{ comm: "Chickpeas", type: "Pulse", qty: 22.5 }] };
  if (locationId === 3) return { totalWeight: 130.0, items: [{ comm: "Wheat", type: "Grain", qty: 45.0 }, { comm: "Canola", type: "Oilseed", qty: 85.0 }] };
  if (locationId === 4) return { totalWeight: 119.2, items: [{ comm: "Barley", type: "Grain", qty: 119.2 }] };
  return { totalWeight: 0, items: [] };
}

export default function StockLocationsPage() {
  const [locations, setLocations] = useState(() => [...INITIAL_LOCATIONS]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(() => blankLocation());
  const [selectedId, setSelectedId] = useState(null);

  const selected = selectedId != null ? locations.find((l) => l.id === selectedId) : null;
  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const displayRows = locations.map(l => ({
    ...l,
    capacityDisplay: `${l.capacity} ${l.unit}`,
    description: l.description || "—"
  }));

  function openNew() { setEditingId(null); setForm(blankLocation()); setModalOpen(true); }
  function openEdit() {
    if (!selected) return;
    setEditingId(selected.id);
    setForm({ name: selected.name, type: selected.type, capacity: String(selected.capacity), unit: selected.unit, status: selected.status, description: selected.description || "" });
    setModalOpen(true);
  }

  function save() {
    const payload = { ...form, capacity: Number(form.capacity) || 0 };
    if (editingId) {
      setLocations((p) => p.map((l) => l.id === editingId ? { ...l, ...payload } : l));
    } else {
      const nextId = locations.length > 0 ? Math.max(...locations.map((l) => l.id)) + 1 : 1;
      setLocations((p) => [{ id: nextId, ...payload }, ...p]);
    }
    setModalOpen(false);
  }

  function remove() {
    if (!selected) return;
    setLocations((p) => p.filter((l) => l.id !== selected.id));
    setSelectedId(null);
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs text-slate-500">Stock Management / Stock Locations</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">Stock Locations</h1>
        <p className="mt-1 text-xs text-slate-500">Manage storage locations, capacities, and operational status.</p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(320px,360px)] xl:items-start">
        <div className="overflow-hidden rounded-xl bg-white shadow-sm">
          <Grid
            columns={gridColumns}
            rows={displayRows}
            getRowId={(row) => row.id}
            theme="light"
            density="standard"
            fileName="Stock Locations"
            visibleRows={10}
            onRowClick={(row) => setSelectedId((prev) => (prev === row.id ? null : row.id))}
            toolbarActions={
              <div className="flex gap-2">
                <Button size="sm" onClick={openNew}>+ Add</Button>
                <Button variant="outline" size="sm" disabled={!selected} onClick={openEdit}>Edit</Button>
                <Button variant="destructive" size="sm" disabled={!selected} onClick={remove}>Delete</Button>
              </div>
            }
          />
        </div>

        <aside className="rounded-xl border border-slate-200/90 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">Location Details</h2>
          {!selected ? (
            <p className="mt-4 text-sm text-slate-500">Select a row to view details.</p>
          ) : (
            <>
              <dl className="mt-4 space-y-3 text-sm">
                <DI label="Name" value={selected.name} highlight />
                <DI label="Type" value={selected.type} />
                <DI label="Capacity" value={`${selected.capacity} ${selected.unit}`} />
                <DI label="Status" value={selected.status} />
                <DI label="Description" value={selected.description} />
              </dl>

              {/* Current Stock Section */}
              <div className="mt-5 border-t border-slate-100 pt-5">
                <span className="mb-2 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Current Stock</span>
                {(() => {
                  const { totalWeight, items } = getLocationStock(selected.id);
                  const utilPercent = selected.capacity > 0 ? Math.round((totalWeight / selected.capacity) * 100) : 0;
                  const barColor = utilPercent >= 90 ? "bg-red-600" : utilPercent >= 70 ? "bg-amber-500" : "bg-emerald-600";
                  const textColor = utilPercent >= 90 ? "text-red-600" : utilPercent >= 70 ? "text-amber-500" : "text-emerald-600";

                  return (
                    <div className="space-y-4">
                      {selected.capacity > 0 && (
                        <div>
                          <div className="mb-1 flex justify-between text-[10px]">
                            <span className="text-slate-500">Utilization</span>
                            <span className={cn("font-bold", textColor)}>{utilPercent}%</span>
                          </div>
                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                            <div className={cn("h-full transition-all duration-300", barColor)} style={{ width: `${Math.min(utilPercent, 100)}%` }} />
                          </div>
                        </div>
                      )}

                      <div className="rounded-lg bg-slate-50 p-3">
                        <div className="text-[10px] text-slate-500">Total</div>
                        <div className="text-lg font-bold text-brand">{totalWeight.toFixed(2)} <span className="text-xs font-medium text-slate-500">MT</span></div>
                      </div>

                      {items.length === 0 ? (
                        <p className="py-3 text-center text-xs italic text-slate-400">No stock currently stored</p>
                      ) : (
                        <div className="max-h-48 space-y-2 overflow-y-auto">
                          {items.map((item, idx) => (
                            <div key={idx} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                              <div className="text-xs font-semibold text-slate-900">{item.comm}</div>
                              <div className="mt-0.5 text-[10px] text-slate-500">Type: {item.type}</div>
                              <div className="mt-1 text-sm font-bold text-brand">{item.qty.toFixed(2)} MT</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            </>
          )}
        </aside>
      </div>

      <Modal open={modalOpen} title={editingId ? "Edit Location" : "Add Location"} onClose={() => setModalOpen(false)}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Name" required><input className={inputClass} value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Location name" /></Field>
          <Field label="Type">
            <select className={inputClass} value={form.type} onChange={(e) => set("type", e.target.value)}>
              {LOCATION_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="Capacity"><input type="number" className={inputClass} value={form.capacity} onChange={(e) => set("capacity", e.target.value)} placeholder="0" /></Field>
          <Field label="Status">
            <select className={inputClass} value={form.status} onChange={(e) => set("status", e.target.value)}>
              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
        </div>
        <div className="mt-3">
          <Field label="Description"><textarea className={cn(inputClass, "min-h-16 resize-y")} value={form.description} onChange={(e) => set("description", e.target.value)} rows={2} /></Field>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => setModalOpen(false)}>Cancel</Button>
          <Button size="sm" onClick={save}>{editingId ? "Save changes" : "Create"}</Button>
        </div>
      </Modal>
    </div>
  );
}

function DI({ label, value, highlight }) {
  return (<div><dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</dt><dd className={cn("mt-0.5 text-slate-800", highlight && "font-semibold text-brand")}>{value || "—"}</dd></div>);
}
function Field({ label, required, children }) {
  return (<div className="space-y-1"><label className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">{label}{required && <span className="text-red-500"> *</span>}</label>{children}</div>);
}
function Modal({ open, title, onClose, children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button type="button" className="absolute inset-0 bg-black/40" aria-label="Close" onClick={onClose} />
      <div role="dialog" aria-modal="true" className="relative max-h-[min(90vh,720px)] w-full max-w-xl overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
          <button type="button" className="rounded-md px-2 py-1 text-lg text-slate-500 hover:bg-slate-100" onClick={onClose}>×</button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}
