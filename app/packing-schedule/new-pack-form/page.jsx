"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { PACK_FORM_LOOKUPS, PACK_STATUSES, PACK_TEMPLATE, SAMPLE_STATUSES } from "@/lib/Data";

const {
  sites: SITES,
  customers,
  commodityTypes,
  commodities,
  shippingLines,
  containerParks,
  transporters,
  packers,
  vesselScheduleCsvRows: vesselSchedule,
} = PACK_FORM_LOOKUPS;

const inputClass =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-brand/15 focus:border-brand/35 focus:ring-2";

const gridClass = "grid gap-4 md:grid-cols-2";
const sectionClass = "rounded-xl border border-slate-200/95 bg-white p-5 shadow-sm";

const blankPack = (siteId) => ({
  ...PACK_TEMPLATE,
  siteId,
  releaseIds: [],
  releaseDetails: [],
  emptyContainerParkIds: [],
  transporterIds: [],
  assignedPackerIds: [],
  importPermitFiles: [],
  additionalDeclarationFiles: [],
  rfpFiles: [],
  sampleLocations: [],
  sampleSentDates: [],
  sampleStatuses: [],
  packingInstructionFiles: [],
});

function parseList(str) {
  if (!str || typeof str !== "string") return [];
  return str
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function listToStr(arr) {
  return Array.isArray(arr) ? arr.join(", ") : "";
}

function FormRow({ label, children, className = "" }) {
  return (
    <div className={`space-y-1 ${className}`}>
      <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</label>
      {children}
    </div>
  );
}

function Pills({ items, resolveLabel, onRemove }) {
  if (!items?.length) return <p className="text-xs text-slate-400">None selected</p>;
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {items.map((item, index) => (
        <span key={`${item}-${index}`} className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-700">
          {resolveLabel ? resolveLabel(item) : item}
          <button type="button" onClick={() => onRemove(item, index)} className="text-slate-500 hover:text-slate-800">
            ×
          </button>
        </span>
      ))}
    </div>
  );
}

export default function NewPackFormPage() {
  const router = useRouter();
  const [currentSite] = useState(1);
  const [vesselDepartures, setVesselDepartures] = useState([]);
  const [pack, setPack] = useState(() => blankPack(currentSite));

  const set = (key, val) => setPack((prev) => ({ ...prev, [key]: val }));

  const commoditiesForType = useMemo(() => {
    if (!pack.commodityTypeId) return commodities;
    return commodities.filter((c) => c.commodityTypeId === Number(pack.commodityTypeId));
  }, [pack.commodityTypeId]);

  const selectedVessel = useMemo(() => {
    if (!pack.vesselDepartureId) return null;
    return vesselDepartures.find((v) => v.id === Number(pack.vesselDepartureId)) || null;
  }, [pack.vesselDepartureId, vesselDepartures]);

  const save = () => {
    const normalized = {
      ...pack,
      customerId: pack.customerId ? Number(pack.customerId) : null,
      commodityTypeId: pack.commodityTypeId ? Number(pack.commodityTypeId) : null,
      commodityId: pack.commodityId ? Number(pack.commodityId) : null,
      siteId: Number(pack.siteId || currentSite),
      containersRequired: pack.containersRequired === "" ? null : Number(pack.containersRequired),
      quantityPerContainer: pack.quantityPerContainer === "" ? null : Number(pack.quantityPerContainer),
      maxQtyPerContainer: pack.maxQtyPerContainer === "" ? null : Number(pack.maxQtyPerContainer),
      mtTotal: pack.mtTotal === "" ? null : Number(pack.mtTotal),
      shippingLineId: pack.shippingLineId ? Number(pack.shippingLineId) : null,
      vesselDepartureId: pack.vesselDepartureId ? Number(pack.vesselDepartureId) : null,
    };
    window.alert(`Form saved (demo only)\n\n${JSON.stringify(normalized, null, 2)}`);
  };

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-slate-900">Add Pack</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" type="button" onClick={() => router.push("/packing-schedule")}>
            Cancel
          </Button>
          <Button type="button" onClick={save}>
            Save
          </Button>
        </div>
      </div>

      <section className={sectionClass}>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-700">Basic</h2>
        <div className={gridClass}>
          <FormRow label="Pack type">
            <select className={inputClass} value={pack.packType} onChange={(e) => set("packType", e.target.value)}>
              <option value="container">Container</option>
              <option value="bulk">Bulk</option>
            </select>
          </FormRow>
          <FormRow label="Import / Export">
            <select className={inputClass} value={pack.importExport} onChange={(e) => set("importExport", e.target.value)}>
              <option value="Import">Import</option>
              <option value="Export">Export</option>
            </select>
          </FormRow>
          <FormRow label="Status">
            <select className={inputClass} value={pack.status} onChange={(e) => set("status", e.target.value)}>
              {PACK_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </FormRow>
          <FormRow label="Customer">
            <select className={inputClass} value={pack.customerId} onChange={(e) => set("customerId", e.target.value)}>
              <option value="">- Select -</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </FormRow>
          <FormRow label="Exporter">
            <input className={inputClass} value={pack.exporter} onChange={(e) => set("exporter", e.target.value)} placeholder="Exporter name" />
          </FormRow>
          <FormRow label="Commodity type">
            <select
              className={inputClass}
              value={pack.commodityTypeId}
              onChange={(e) => {
                set("commodityTypeId", e.target.value);
                set("commodityId", "");
              }}
            >
              <option value="">- Select -</option>
              {commodityTypes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </FormRow>
          <FormRow label="Commodity">
            <select className={inputClass} value={pack.commodityId} onChange={(e) => set("commodityId", e.target.value)} disabled={!pack.commodityTypeId}>
              <option value="">- Select -</option>
              {commoditiesForType.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.description}
                </option>
              ))}
            </select>
          </FormRow>
          <FormRow label="Job reference">
            <input className={inputClass} value={pack.jobReference} onChange={(e) => set("jobReference", e.target.value)} placeholder="Job reference" />
          </FormRow>
          <FormRow label="Site">
            <select className={inputClass} value={pack.siteId} onChange={(e) => set("siteId", Number(e.target.value))}>
              {SITES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </FormRow>
          {pack.packType === "bulk" ? (
            <FormRow label="Test required">
              <select className={inputClass} value={pack.testRequired ? "yes" : "no"} onChange={(e) => set("testRequired", e.target.value === "yes")}>
                <option value="no">No</option>
                <option value="yes">Yes</option>
              </select>
            </FormRow>
          ) : null}
          <FormRow label="Shrink taken (Import jobs)">
            <select className={inputClass} value={pack.shrinkTaken ? "yes" : "no"} onChange={(e) => set("shrinkTaken", e.target.value === "yes")}>
              <option value="no">No</option>
              <option value="yes">Yes</option>
            </select>
          </FormRow>
          <FormRow label="Fumigation" className="md:col-span-2">
            <input className={inputClass} value={pack.fumigation} onChange={(e) => set("fumigation", e.target.value)} placeholder="Fumigation details" />
          </FormRow>
        </div>
      </section>

      <section className={sectionClass}>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-700">Containers & quantity</h2>
        {pack.packType === "container" ? (
          <FormRow label="Assigned packers" className="mb-4">
            <div className="flex flex-wrap gap-3">
              {packers
                .filter((p) => p.status === "active")
                .map((pkr) => {
                  const ids = Array.isArray(pack.assignedPackerIds) ? pack.assignedPackerIds : [];
                  const checked = ids.includes(pkr.id);
                  return (
                    <label key={pkr.id} className="inline-flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          const next = e.target.checked ? [...ids, pkr.id] : ids.filter((id) => id !== pkr.id);
                          set("assignedPackerIds", next);
                        }}
                      />
                      {pkr.name}
                    </label>
                  );
                })}
            </div>
          </FormRow>
        ) : null}

        <div className="grid gap-4 md:grid-cols-3">
          <FormRow label="Containers required">
            <input
              className={inputClass}
              type="number"
              value={pack.containersRequired}
              onChange={(e) => set("containersRequired", e.target.value)}
              placeholder="Number"
            />
          </FormRow>
          <FormRow label="Quantity per container">
            <input className={inputClass} type="number" value={pack.quantityPerContainer} onChange={(e) => set("quantityPerContainer", e.target.value)} placeholder="MT" />
          </FormRow>
          <FormRow label="Max qty per container">
            <input className={inputClass} type="number" value={pack.maxQtyPerContainer} onChange={(e) => set("maxQtyPerContainer", e.target.value)} placeholder="MT" />
          </FormRow>
          <FormRow label="MT total" className="md:col-span-3">
            <input className={inputClass} type="number" value={pack.mtTotal} onChange={(e) => set("mtTotal", e.target.value)} placeholder="Total MT" />
          </FormRow>
        </div>

        <FormRow label="Release details (ref + park + transporter per release)" className="mt-4">
          <div className="space-y-2">
            {(pack.releaseDetails || []).map((rd, idx) => (
              <div key={idx} className="grid gap-2 md:grid-cols-[1fr_1fr_1fr_auto]">
                <input
                  className={inputClass}
                  value={rd.releaseRef || ""}
                  onChange={(e) => {
                    const next = [...(pack.releaseDetails || [])];
                    next[idx] = { ...next[idx], releaseRef: e.target.value };
                    set("releaseDetails", next);
                  }}
                  placeholder="Release ref"
                />
                <select
                  className={inputClass}
                  value={rd.emptyContainerParkId ?? ""}
                  onChange={(e) => {
                    const next = [...(pack.releaseDetails || [])];
                    next[idx] = { ...next[idx], emptyContainerParkId: e.target.value ? Number(e.target.value) : null };
                    set("releaseDetails", next);
                  }}
                >
                  <option value="">- Park -</option>
                  {containerParks.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <select
                  className={inputClass}
                  value={rd.transporterId ?? ""}
                  onChange={(e) => {
                    const next = [...(pack.releaseDetails || [])];
                    next[idx] = { ...next[idx], transporterId: e.target.value ? Number(e.target.value) : null };
                    set("releaseDetails", next);
                  }}
                >
                  <option value="">- Transporter -</option>
                  {transporters.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
                <Button
                  variant="destructive"
                  type="button"
                  onClick={() => set("releaseDetails", (pack.releaseDetails || []).filter((_, i) => i !== idx))}
                >
                  Remove
                </Button>
              </div>
            ))}
            <Button
              variant="secondary"
              size="sm"
              type="button"
              onClick={() =>
                set("releaseDetails", [...(pack.releaseDetails || []), { releaseRef: "", emptyContainerParkId: null, transporterId: null }])
              }
            >
              + Add release
            </Button>
          </div>
        </FormRow>

        <div className={`${gridClass} mt-4`}>
          <FormRow label="Empty container park(s)">
            <select
              className={inputClass}
              value=""
              onChange={(e) => {
                const id = Number(e.target.value);
                if (!id) return;
                const current = Array.isArray(pack.emptyContainerParkIds) ? pack.emptyContainerParkIds : [];
                if (!current.includes(id)) set("emptyContainerParkIds", [...current, id]);
                e.target.value = "";
              }}
            >
              <option value="">- Add park -</option>
              {containerParks.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <Pills
              items={pack.emptyContainerParkIds}
              resolveLabel={(id) => containerParks.find((p) => p.id === id)?.name || id}
              onRemove={(id) => set("emptyContainerParkIds", pack.emptyContainerParkIds.filter((x) => x !== id))}
            />
          </FormRow>
          <FormRow label="Transporter(s)">
            <select
              className={inputClass}
              value=""
              onChange={(e) => {
                const id = Number(e.target.value);
                if (!id) return;
                const current = Array.isArray(pack.transporterIds) ? pack.transporterIds : [];
                if (!current.includes(id)) set("transporterIds", [...current, id]);
                e.target.value = "";
              }}
            >
              <option value="">- Add transporter -</option>
              {transporters.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <Pills
              items={pack.transporterIds}
              resolveLabel={(id) => transporters.find((t) => t.id === id)?.name || id}
              onRemove={(id) => set("transporterIds", pack.transporterIds.filter((x) => x !== id))}
            />
          </FormRow>
        </div>
      </section>

      <section className={sectionClass}>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-700">Destination & shipping</h2>
        <div className={gridClass}>
          <FormRow label="Destination country">
            <input className={inputClass} value={pack.destinationCountry} onChange={(e) => set("destinationCountry", e.target.value)} placeholder="Country" />
          </FormRow>
          <FormRow label="Destination port">
            <input className={inputClass} value={pack.destinationPort} onChange={(e) => set("destinationPort", e.target.value)} placeholder="Port" />
          </FormRow>
          <FormRow label="Transshipment port">
            <input className={inputClass} value={pack.transshipmentPort} onChange={(e) => set("transshipmentPort", e.target.value)} placeholder="Port" />
          </FormRow>
          <FormRow label="Transshipment port code">
            <input className={inputClass} value={pack.transshipmentPortCode} onChange={(e) => set("transshipmentPortCode", e.target.value)} placeholder="Code" />
          </FormRow>
          <FormRow label="Shipping line">
            <select className={inputClass} value={pack.shippingLineId} onChange={(e) => set("shippingLineId", e.target.value)}>
              <option value="">- Select -</option>
              {shippingLines.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name} ({l.code})
                </option>
              ))}
            </select>
          </FormRow>
          <FormRow label="Vessel departure">
            <select className={inputClass} value={pack.vesselDepartureId ?? ""} onChange={(e) => set("vesselDepartureId", e.target.value ? Number(e.target.value) : null)}>
              <option value="">- Select vessel -</option>
              {vesselDepartures.map((vd) => (
                <option key={vd.id} value={vd.id}>
                  {vd.vessel} {vd.voyageNumber ? `(${vd.voyageNumber})` : ""}
                  {vd.vesselCutoffDate ? ` - Cut-off ${vd.vesselCutoffDate}` : ""}
                </option>
              ))}
            </select>
          </FormRow>
          <FormRow label="Add from CSV schedule">
            <select
              className={inputClass}
              value=""
              onChange={(e) => {
                const idx = e.target.value;
                if (idx === "") return;
                const row = vesselSchedule[Number(idx)];
                if (!row) return;
                const key = `${(row.shipName || "").trim()}|${(row.voyageOut || "").trim()}`;
                const existing = vesselDepartures.find((v) => `${v.vessel}|${v.voyageNumber}` === key);
                if (existing) {
                  set("vesselDepartureId", existing.id);
                } else {
                  const id = Date.now();
                  const newDeparture = {
                    id,
                    vessel: row.shipName?.trim() || "",
                    voyageNumber: row.voyageOut || "",
                    vesselCutoffDate: row.cargoCutoffDate || "",
                  };
                  setVesselDepartures((prev) => [...prev, newDeparture]);
                  set("vesselDepartureId", id);
                }
                e.target.value = "";
              }}
            >
              <option value="">- Import from uploaded CSV -</option>
              {vesselSchedule.map((row, idx) => (
                <option key={idx} value={idx}>
                  {row.shipName} {row.voyageOut ? `(${row.voyageOut})` : ""} - Cut-off {row.cargoCutoffDate || "-"}
                </option>
              ))}
            </select>
          </FormRow>
          {selectedVessel ? (
            <div className="rounded-md bg-slate-50 p-3 text-sm text-slate-600 md:col-span-2">
              <span className="font-semibold text-slate-800">Vessel schedule: </span>
              {selectedVessel.vessel} {selectedVessel.voyageNumber ? `(${selectedVessel.voyageNumber})` : ""}
              {selectedVessel.vesselCutoffDate ? ` · Cut-off: ${selectedVessel.vesselCutoffDate}` : ""}
            </div>
          ) : null}
        </div>
      </section>

      <section className={sectionClass}>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-700">Import permit</h2>
        <div className={gridClass}>
          <FormRow label="Import permit required">
            <select
              className={inputClass}
              value={pack.importPermitRequired ? "yes" : "no"}
              onChange={(e) => set("importPermitRequired", e.target.value === "yes")}
            >
              <option value="no">No</option>
              <option value="yes">Yes</option>
            </select>
          </FormRow>
          <FormRow label="Import permit number">
            <input className={inputClass} value={pack.importPermitNumber} onChange={(e) => set("importPermitNumber", e.target.value)} placeholder="Number" />
          </FormRow>
          <FormRow label="Import permit date">
            <input className={inputClass} type="date" value={pack.importPermitDate} onChange={(e) => set("importPermitDate", e.target.value)} />
          </FormRow>
        </div>
        <FormRow label="Import permit file(s) (comma separated for mock)" className="mt-4">
          <input
            className={inputClass}
            value={listToStr(pack.importPermitFiles)}
            onChange={(e) => set("importPermitFiles", parseList(e.target.value))}
            placeholder="file1.pdf, file2.pdf"
          />
        </FormRow>
      </section>

      <section className={sectionClass}>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-700">RFP</h2>
        <div className={gridClass}>
          <FormRow label="RFP">
            <input className={inputClass} value={pack.rfp} onChange={(e) => set("rfp", e.target.value)} placeholder="RFP reference" />
          </FormRow>
          <FormRow label="RFP additional declaration required">
            <select
              className={inputClass}
              value={pack.rfpAdditionalDeclarationRequired ? "yes" : "no"}
              onChange={(e) => set("rfpAdditionalDeclarationRequired", e.target.value === "yes")}
            >
              <option value="no">No</option>
              <option value="yes">Yes</option>
            </select>
          </FormRow>
          <FormRow label="RFP comment">
            <input className={inputClass} value={pack.rfpComment} onChange={(e) => set("rfpComment", e.target.value)} placeholder="Comment" />
          </FormRow>
          <FormRow label="RFP expiry">
            <input className={inputClass} type="date" value={pack.rfpExpiry} onChange={(e) => set("rfpExpiry", e.target.value)} />
          </FormRow>
          <FormRow label="RFP commodity code">
            <input className={inputClass} value={pack.rfpCommodityCode} onChange={(e) => set("rfpCommodityCode", e.target.value)} placeholder="Code" />
          </FormRow>
        </div>
        <FormRow label="Additional declaration file(s) (comma separated)" className="mt-4">
          <input
            className={inputClass}
            value={listToStr(pack.additionalDeclarationFiles)}
            onChange={(e) => set("additionalDeclarationFiles", parseList(e.target.value))}
            placeholder="file1.pdf"
          />
        </FormRow>
        <FormRow label="RFP file(s) (comma separated)" className="mt-4">
          <input className={inputClass} value={listToStr(pack.rfpFiles)} onChange={(e) => set("rfpFiles", parseList(e.target.value))} placeholder="rfp.pdf" />
        </FormRow>
      </section>

      <section className={sectionClass}>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-700">Sample</h2>
        <FormRow label="Sample required">
          <select className={inputClass} value={pack.sampleRequired ? "yes" : "no"} onChange={(e) => set("sampleRequired", e.target.value === "yes")}>
            <option value="no">No</option>
            <option value="yes">Yes</option>
          </select>
        </FormRow>
        <div className={`${gridClass} mt-4`}>
          <FormRow label="Sample location(s) (comma separated)">
            <input
              className={inputClass}
              value={listToStr(pack.sampleLocations)}
              onChange={(e) => set("sampleLocations", parseList(e.target.value))}
              placeholder="Lab A, Port QC"
            />
          </FormRow>
          <FormRow label="Sample sent date(s) (comma separated)">
            <input
              className={inputClass}
              value={listToStr(pack.sampleSentDates)}
              onChange={(e) => set("sampleSentDates", parseList(e.target.value))}
              placeholder="2026-02-05, 2026-02-06"
            />
          </FormRow>
        </div>
        <FormRow label="Sample status(es)" className="mt-4">
          <select
            className={inputClass}
            value=""
            onChange={(e) => {
              const v = e.target.value;
              if (!v) return;
              const current = Array.isArray(pack.sampleStatuses) ? pack.sampleStatuses : [];
              set("sampleStatuses", [...current, v]);
              e.target.value = "";
            }}
          >
            <option value="">- Add status -</option>
            {SAMPLE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <Pills items={pack.sampleStatuses} onRemove={(_, index) => set("sampleStatuses", pack.sampleStatuses.filter((__, i) => i !== index))} />
        </FormRow>
      </section>

      <section className={sectionClass}>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-700">Packing & notes</h2>
        <FormRow label="Packing instruction file(s) (comma separated)">
          <input
            className={inputClass}
            value={listToStr(pack.packingInstructionFiles)}
            onChange={(e) => set("packingInstructionFiles", parseList(e.target.value))}
            placeholder="file1.pdf"
          />
        </FormRow>
        <FormRow label="Job notes" className="mt-4">
          <textarea className={`${inputClass} min-h-[92px] resize-y`} value={pack.jobNotes} onChange={(e) => set("jobNotes", e.target.value)} placeholder="Notes..." />
        </FormRow>
        <FormRow label="Date" className="mt-4">
          <input className={inputClass} type="date" value={pack.date} onChange={(e) => set("date", e.target.value)} />
        </FormRow>
      </section>
    </div>
  );
}
