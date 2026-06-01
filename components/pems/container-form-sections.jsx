"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CONTAINER_INSPECTION_REMARK_FIELD } from "@/lib/pems-container-fields";

const defaultFieldNames = {
  containerNo: "containerNo",
  sealNo: "sealNo",
  isoCode: "isoCode",
  startDate: "startDate",
  startHour: "startHour",
  startMinute: "startMinute",
  stockBayId: "stockBayId",
  grainLocation: "grainLocation",
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
  yesNoOptions,
  inspectionOptions,
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
}) {
  const names = { ...defaultFieldNames, ...(fieldNames || {}) };
  const setField = (key, value) => onChange?.({ [names[key] || key]: value });
  const submitted = Boolean(getValue(container, names, "praSubmitted", false));

  return (
    <>
      <div className={cn(sectionCardClass, "border-blue-200/90 bg-blue-50/30")}>
        <div className={cn(sectionHeaderClass, "border-blue-200 bg-blue-100/80 text-blue-900")}>Packing Order</div>
        <div className="grid gap-3 p-3 md:grid-cols-2 xl:grid-cols-3">
          <PemsInput label="Container No" value={getValue(container, names, "containerNo")} onChange={(value) => setField("containerNo", value)} inputClass={inputClass} />
          <PemsInput label="Seal No" value={getValue(container, names, "sealNo")} onChange={(value) => setField("sealNo", value)} inputClass={inputClass} />
          <PemsSelect label="Container ISO" value={getValue(container, names, "isoCode")} options={isoOptions} onChange={(value) => setField("isoCode", value)} inputClass={inputClass} />
          <div className="space-y-1 md:col-span-2 xl:col-span-1">
            <label className="text-xs font-medium text-slate-600">Start Time (24-hour)</label>
            <div className="grid grid-cols-[1fr_92px_92px] gap-2">
              <input suppressHydrationWarning className={inputClass} type="date" value={getValue(container, names, "startDate")} onChange={(event) => setField("startDate", event.target.value)} />
              <select suppressHydrationWarning className={inputClass} value={getValue(container, names, "startHour")} onChange={(event) => setField("startHour", event.target.value)}>
                <option value="">HH</option>
                {Array.from({ length: 24 }).map((_, hour) => {
                  const option = String(hour).padStart(2, "0");
                  return (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  );
                })}
              </select>
              <select suppressHydrationWarning className={inputClass} value={getValue(container, names, "startMinute")} onChange={(event) => setField("startMinute", event.target.value)}>
                <option value="">MM</option>
                {["00", "05", "10", "15", "20", "25", "30", "35", "40", "45", "50", "55"].map((minute) => (
                  <option key={minute} value={minute}>
                    {minute}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <PemsSelect label="Stock/Bay ID" value={getValue(container, names, "stockBayId")} options={stockBayOptions} onChange={(value) => setField("stockBayId", value)} inputClass={inputClass} />
          <PemsInput label="Grain location" value={getValue(container, names, "grainLocation")} onChange={(value) => setField("grainLocation", value)} inputClass={inputClass} />
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
          <PemsInput label="Release Number" value={getValue(container, names, "releaseNumber")} onChange={(value) => setField("releaseNumber", value)} inputClass={inputClass} />
          <PemsInput label="Container Park" value={getValue(container, names, "releasePark")} onChange={(value) => setField("releasePark", value)} inputClass={inputClass} />
          <PemsInput label="Transporter" value={getValue(container, names, "transporter")} onChange={(value) => setField("transporter", value)} inputClass={inputClass} />
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
          <PemsSelect label="AO signoff" value={getValue(container, names, "aoSignoff")} options={packerNames} onChange={(value) => setField("aoSignoff", value)} inputClass={inputClass} />
        </div>
        <div className="px-3 pb-3">
          <label className="mb-1 block text-xs font-medium text-slate-600">Container inspection remark</label>
          <textarea suppressHydrationWarning className={`${inputClass} min-h-[82px] w-full resize-y`} value={getValue(container, names, "aoInspectionRemark")} onChange={(event) => setField("aoInspectionRemark", event.target.value)} />
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
        <option value="">{options.length ? "Select option" : "â€”"}</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );
}