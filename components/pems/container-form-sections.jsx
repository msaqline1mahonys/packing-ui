"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CONTAINER_INSPECTION_REMARK_FIELD } from "@/lib/pems-container-fields";
import { hasPermission } from "@/lib/use-user-permissions";

/** Combine stored date + hour + minute into a datetime-local value string. */
function buildDatetimeValue(container, names) {
  const date = String(container?.[names.startDate] ?? "").trim();
  const hour = String(container?.[names.startHour] ?? "").trim();
  const minute = String(container?.[names.startMinute] ?? "").trim();
  if (!date) return "";
  return `${date}T${(hour || "00").padStart(2, "0")}:${(minute || "00").padStart(2, "0")}`;
}

/** Return today's datetime string for the datetime-local input default display. */
function getTodayDatetime() {
  if (typeof window === "undefined") return "";
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

/** Split a datetime-local value back into startDate / startHour / startMinute. */
function splitDatetimeValue(value, names) {
  if (!value) {
    return {
      [names.startDate]: "",
      [names.startHour]: "",
      [names.startMinute]: "",
    };
  }
  const [datePart = "", timePart = ""] = value.split("T");
  const [hourPart = "00", minutePart = "00"] = timePart.split(":");
  return {
    [names.startDate]: datePart,
    [names.startHour]: hourPart.padStart(2, "0"),
    [names.startMinute]: minutePart.padStart(2, "0"),
  };
}

const defaultFieldNames = {
  containerNo: "containerNo",
  sealNo: "sealNo",
  isoCode: "isoCode",
  startDate: "startDate",
  startHour: "startHour",
  startMinute: "startMinute",
  stockBayId: "stockBayId",
  packer: "packer",
  tare: "tare",
  grossWeight: "grossWeight",
  nettWeight: "nettWeight",
  containerTareWeight: "containerTareWeight",
  releaseNumber: "releaseNumber",
  releasePark: "releasePark",
  transporter: "transporter",
  packerSignoff: "packerSignoff",
  outLoaded: "outLoaded",
  praSignoff: "praSignoff",
  praTemplate: "praTemplate",
  praSubmitted: "praSubmitted",
  praLastStatus: "praLastStatus",
  praLastSubmittedTime: "praLastSubmittedTime",
  praLastError: "praLastError",
  emptyInspection: "emptyInspection",
  grainInspection: "grainInspection",
  inspectionLevelCode: "inspectionLevelCode",
  passedAfterRectification: "passedAfterRectification",
  inspectionRemarkCode: "inspectionRemarkCode",
  aoSignoff: "aoSignoff",
  aoInspectionRemark: CONTAINER_INSPECTION_REMARK_FIELD,
  packerNotes: "packerNotes",
};

function getValue(container, fieldNames, key, fallback = "") {
  const field = fieldNames[key] || key;
  const value = container?.[field];
  return value == null ? fallback : value;
}

export default function ContainerFormSections({
  container,
  onChange,
  packerNames,
  packerSelectOptions,
  yesNoOptions,
  inspectionOptions,
  inspectionLevelOptions = ["Consumable", "Standard"],
  rectificationOptions = ["N", "Y"],
  remarkCodeOptions = [],
  praTemplateOptions,
  praStatusOptions,
  isoOptions,
  stockBayOptions,
  inputClass,
  sectionCardClass,
  sectionHeaderClass,
  fieldNames = {},
  onResetContainer,
  onMarkPacked,
  onSubmitPra,
  showPackersNote = false,
  // Release Details dropdown options
  packReleases = [],
  containerParkOptions = [],
  transporterOptions = [],
}) {
  const names = { ...defaultFieldNames, ...(fieldNames || {}) };
  const setField = (key, value) => onChange?.({ [names[key] || key]: value });
  const submitted = Boolean(getValue(container, names, "praSubmitted", false));
  // AO sign-off action gating
  const canAoSignoff = hasPermission("packing.container.ao-signoff");
  const packerOptions = packerSelectOptions ?? packerNames ?? [];

  function handleReleaseSelect(releaseRef) {
    const release = packReleases.find((r) => r.releaseRef === releaseRef);
    if (release) {
      const parkId = release.emptyContainerParkId ?? null;
      const transId = release.transporterId ?? null;
      const parkName =
        containerParkOptions.find((p) => String(p.id) === String(parkId))?.name ||
        release.emptyContainerPark?.name ||
        "";
      const transName =
        transporterOptions.find((t) => String(t.id) === String(transId))?.name ||
        release.transporter?.name ||
        "";
      onChange?.({
        [names.releaseNumber || "releaseNumber"]: releaseRef,
        emptyContainerParkId: parkId,
        transporterId: transId,
        [names.releasePark || "releasePark"]: parkName,
        [names.transporter || "transporter"]: transName,
      });
    } else {
      onChange?.({ [names.releaseNumber || "releaseNumber"]: releaseRef });
    }
  }

  function handleParkSelect(parkId) {
    const parkName = containerParkOptions.find((p) => String(p.id) === String(parkId))?.name || "";
    onChange?.({
      emptyContainerParkId: parkId || null,
      [names.releasePark || "releasePark"]: parkName,
    });
  }

  function handleTransporterSelect(transId) {
    const transName = transporterOptions.find((t) => String(t.id) === String(transId))?.name || "";
    onChange?.({
      transporterId: transId || null,
      [names.transporter || "transporter"]: transName,
    });
  }

  return (
    <>
      <div className={cn(sectionCardClass, "border-blue-200/90 bg-blue-50/30")}>
        <div className={cn(sectionHeaderClass, "border-blue-200 bg-blue-100/80 text-blue-900")}>Packing Order</div>
        <div className="grid gap-3 p-3 md:grid-cols-2 xl:grid-cols-3">
          <PemsInput label="Container No" value={getValue(container, names, "containerNo")} onChange={(value) => setField("containerNo", value)} inputClass={inputClass} />
          <PemsInput label="Seal No" value={getValue(container, names, "sealNo")} onChange={(value) => setField("sealNo", value)} inputClass={inputClass} />
          <PemsSelect label="Container ISO" value={getValue(container, names, "isoCode")} options={isoOptions} onChange={(value) => setField("isoCode", value)} inputClass={inputClass} />
          <div className="space-y-1 md:col-span-2 xl:col-span-1">
            <label className="text-xs font-medium text-slate-600">Start Date &amp; Time</label>
            {(() => {
              const stored = buildDatetimeValue(container, names);
              const isDefault = !stored;
              const displayValue = stored || getTodayDatetime();
              return (
                <div className="relative">
                  <input
                    suppressHydrationWarning
                    className={cn(inputClass, "block w-full", isDefault ? "text-slate-400" : "")}
                    type="datetime-local"
                    value={displayValue}
                    onChange={(event) => onChange?.(splitDatetimeValue(event.target.value, names))}
                  />
                  {isDefault ? (
                    <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-[10px] text-slate-400">
                      today
                    </span>
                  ) : null}
                </div>
              );
            })()}
          </div>
          <PemsSelect label="Stock/Bay ID" value={getValue(container, names, "stockBayId")} options={stockBayOptions} onChange={(value) => setField("stockBayId", value)} inputClass={inputClass} />
          <PemsSelect label="Packer" value={getValue(container, names, "packer")} options={packerOptions} onChange={(value) => setField("packer", value)} inputClass={inputClass} />
        </div>
      </div>

      <div className={cn(sectionCardClass, "border-slate-200/90 bg-slate-50/30")}>
        <div className={cn(sectionHeaderClass, "border-slate-200 bg-slate-100 text-slate-800")}>Weights</div>
        <div className="grid gap-3 p-3 md:grid-cols-2 xl:grid-cols-4">
          <PemsInput label="Tare" value={getValue(container, names, "tare")} onChange={(value) => setField("tare", value)} type="number" step="0.01" inputClass={inputClass} />
          <PemsInput label="Gross Weight" value={getValue(container, names, "grossWeight")} onChange={(value) => setField("grossWeight", value)} type="number" step="0.01" inputClass={inputClass} />
          <PemsInput label="Nett Weight" value={getValue(container, names, "nettWeight")} readOnly inputClass={inputClass} />
          <PemsInput
            label="Container tare weight"
            value={getValue(container, names, "containerTareWeight")}
            onChange={(value) => setField("containerTareWeight", value)}
            type="number"
            step="0.01"
            inputClass={inputClass}
          />
        </div>
      </div>

      <div className={cn(sectionCardClass, "border-slate-200/90 bg-slate-50/30")}>
        <div className={cn(sectionHeaderClass, "border-slate-200 bg-slate-100 text-slate-800")}>Release Details</div>
        <div className="grid gap-3 p-3 md:grid-cols-3">
          {packReleases.length > 0 ? (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-600">Release Number</label>
              <select
                suppressHydrationWarning
                className={cn(inputClass, "block w-full")}
                value={getValue(container, names, "releaseNumber")}
                onChange={(e) => handleReleaseSelect(e.target.value)}
              >
                <option value="">- Select release -</option>
                {packReleases.map((r, idx) => (
                  <option key={r.id ?? idx} value={r.releaseRef}>
                    {r.releaseRef}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <PemsInput label="Release Number" value={getValue(container, names, "releaseNumber")} onChange={(value) => setField("releaseNumber", value)} inputClass={inputClass} />
          )}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-600">Empty Container Park</label>
            <select
              suppressHydrationWarning
              className={cn(inputClass, "block w-full")}
              value={String(container?.emptyContainerParkId ?? "")}
              onChange={(e) => handleParkSelect(e.target.value)}
            >
              <option value="">- Select park -</option>
              {containerParkOptions.map((park) => (
                <option key={park.id} value={park.id}>
                  {park.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-600">Transporter</label>
            <select
              suppressHydrationWarning
              className={cn(inputClass, "block w-full")}
              value={String(container?.transporterId ?? "")}
              onChange={(e) => handleTransporterSelect(e.target.value)}
            >
              <option value="">- Select transporter -</option>
              {transporterOptions.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className={cn(sectionCardClass, "border-slate-200/90 bg-slate-50/30")}>
        <div className={cn(sectionHeaderClass, "border-slate-200 bg-slate-100 text-slate-800")}>Signoff</div>
        <div className="grid gap-3 p-3 md:grid-cols-2 xl:grid-cols-4">
          <PemsSelect label="Packer signoff" value={getValue(container, names, "packerSignoff")} options={packerNames} onChange={(value) => setField("packerSignoff", value)} inputClass={inputClass} />
          <PemsSelect label="Out-loaded?" value={getValue(container, names, "outLoaded", "No")} options={yesNoOptions} onChange={(value) => setField("outLoaded", value)} inputClass={inputClass} />
          <PemsSelect label="PRA signoff" value={getValue(container, names, "praSignoff")} options={packerNames} onChange={(value) => setField("praSignoff", value)} inputClass={inputClass} />
          <PemsSelect label="PRA template" value={getValue(container, names, "praTemplate")} options={praTemplateOptions} onChange={(value) => setField("praTemplate", value)} inputClass={inputClass} />
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t border-slate-200 px-3 py-3">
          <Button type="button" variant="secondary" size="sm" onClick={onResetContainer}>
            Reset container
          </Button>
          <Button type="button" size="sm" onClick={onMarkPacked}>
            Mark packed
          </Button>
          <Button type="button" size="sm" onClick={onSubmitPra}>
            Submit PRA
          </Button>
          <span className="ms-auto text-sm font-semibold text-rose-600">{submitted ? "PRA Submitted" : "PRA Pending"}</span>
        </div>
      </div>

      <div className={cn(sectionCardClass, "border-slate-200/90 bg-slate-50/30")}>
        <div className={cn(sectionHeaderClass, "border-slate-200 bg-slate-100 text-slate-800")}>1-Stop PRA Info</div>
        <div className="grid gap-3 p-3 md:grid-cols-3">
          <PemsSelect label="PRA last status" value={getValue(container, names, "praLastStatus")} options={praStatusOptions} onChange={(value) => setField("praLastStatus", value)} inputClass={inputClass} />
          <PemsInput label="PRA last submitted time" value={getValue(container, names, "praLastSubmittedTime")} onChange={(value) => setField("praLastSubmittedTime", value)} inputClass={inputClass} />
          <PemsInput label="PRA last error" value={getValue(container, names, "praLastError")} onChange={(value) => setField("praLastError", value)} inputClass={inputClass} />
        </div>
      </div>

      <div className={cn(sectionCardClass, "border-slate-200/90 bg-slate-50/30")}>
        <div className={cn(sectionHeaderClass, "border-slate-200 bg-slate-100 text-slate-800")}>Authorised Officer Inspection</div>
        <div className="grid gap-3 p-3 md:grid-cols-3">
          <PemsSelect label="Empty container inspection" value={getValue(container, names, "emptyInspection")} options={inspectionOptions} onChange={(value) => setField("emptyInspection", value)} inputClass={inputClass} />
          <PemsSelect label="Grain inspection" value={getValue(container, names, "grainInspection")} options={inspectionOptions} onChange={(value) => setField("grainInspection", value)} inputClass={inputClass} />
          <PemsSelect label="Inspection level (PEMS)" value={getValue(container, names, "inspectionLevelCode", "Consumable")} options={inspectionLevelOptions} onChange={(value) => setField("inspectionLevelCode", value)} inputClass={inputClass} />
          <PemsSelect label="Passed after rectification" value={getValue(container, names, "passedAfterRectification", "N")} options={rectificationOptions} onChange={(value) => setField("passedAfterRectification", value)} inputClass={inputClass} />
          {canAoSignoff ? (
            <PemsSelect label="AO signoff" value={getValue(container, names, "aoSignoff")} options={packerNames} onChange={(value) => setField("aoSignoff", value)} inputClass={inputClass} />
          ) : (
            <div className="space-y-1">
              <p className="text-xs font-medium text-slate-600">AO signoff</p>
              <div className={cn(inputClass, "cursor-not-allowed bg-slate-50 text-slate-400")}>
                {getValue(container, names, "aoSignoff") || "—"}
              </div>
              <p className="text-[10px] text-amber-600">Requires Authorised Officer permission</p>
            </div>
          )}
          {remarkCodeOptions.length ? (
            <PemsSelect
              label="Inspection remark code"
              value={getValue(container, names, "inspectionRemarkCode")}
              options={remarkCodeOptions}
              onChange={(value) => setField("inspectionRemarkCode", value)}
              inputClass={inputClass}
            />
          ) : null}
        </div>
        <div className="px-3 pb-3">
          <label className="mb-1 block text-xs font-medium text-slate-600">Container inspection remark (notes)</label>
          <textarea className={`${inputClass} min-h-[82px] w-full resize-y`} value={getValue(container, names, "aoInspectionRemark")} onChange={(event) => setField("aoInspectionRemark", event.target.value)} />
        </div>
      </div>

      {showPackersNote ? (
        <div className={cn(sectionCardClass, "border-slate-200/90 bg-slate-50/30")}>
          <div className={cn(sectionHeaderClass, "border-slate-200 bg-slate-100 text-slate-800")}>Packers</div>
          <div className="px-3 pb-3 pt-3">
            <label className="mb-1 block text-xs font-medium text-slate-600">Packers note</label>
            <textarea
              className={`${inputClass} min-h-[82px] w-full resize-y`}
              value={getValue(container, names, "packerNotes")}
              onChange={(event) => setField("packerNotes", event.target.value)}
              placeholder="Notes for this container"
            />
          </div>
        </div>
      ) : null}
    </>
  );
}

function PemsInput({ label, value, onChange, type = "text", readOnly = false, step, inputClass }) {
  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-slate-600">{label}</label>
      <input
        className={cn(inputClass, "block w-full", readOnly ? "cursor-default bg-slate-50 text-slate-700" : "")}
        value={value ?? ""}
        type={type}
        onChange={(event) => onChange?.(event.target.value)}
        readOnly={readOnly}
        step={step}
      />
    </div>
  );
}

function PemsSelect({ label, value, options, onChange, inputClass }) {
  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-slate-600">{label}</label>
      <select suppressHydrationWarning className={cn(inputClass, "block w-full")} value={value ?? ""} onChange={(event) => onChange?.(event.target.value)}>
        <option value="">{options.length ? "Select option" : ""}</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );
}