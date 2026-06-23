"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import ClutchSelect, { toOptions } from "@/components/custom/ClutchSelect";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CONTAINER_INSPECTION_REMARK_FIELD, buildRemarkSelectOptions } from "@/lib/pems-container-fields";
import {
  findSamePackContainerDuplicates,
  findSamePackSealDuplicates,
  normalizeContainerNumber,
  normalizeSealNumber,
  sanitizeContainerNumberInput,
  sanitizeSealNumberInput,
  validateContainerNumber,
  validateSealNumber,
} from "@/lib/container-number-validation";
import {
  resolveEntityId,
  useContainerDuplicateCheck,
} from "@/lib/hooks/use-container-duplicate-check";
import { useSealDuplicateCheck } from "@/lib/hooks/use-seal-duplicate-check";
import { hasPermission } from "@/lib/use-user-permissions";
import { numberInputProps } from "@/lib/number-input";
import {
  MAX_CONTAINER_GROSS_WEIGHT_MT,
  getContainerWeightLimitWarnings,
  sanitizeGrossWeightInput,
  validateGrossWeight,
} from "@/lib/packers-container-validation";

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

function hasStoredStartDateTime(container, names) {
  return Boolean(String(container?.[names.startDate] ?? "").trim());
}

function buildCurrentStartDatetimePatch(names) {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return {
    [names.startDate]: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
    [names.startHour]: pad(now.getHours()),
    [names.startMinute]: pad(now.getMinutes()),
  };
}

function buildIdentityFieldPatch(container, names, key, value) {
  const patch = { [names[key] || key]: value };
  if ((key === "containerNo" || key === "sealNo") && String(value ?? "").trim() && !hasStoredStartDateTime(container, names)) {
    Object.assign(patch, buildCurrentStartDatetimePatch(names));
  }
  return patch;
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
  ecInspectionRemarkCode: "ecInspectionRemarkCode",
  ecInspectionRemark: "ecInspectionRemark",
  grainInspectionRemarkCode: "grainInspectionRemarkCode",
  grainInspectionRemark: "grainInspectionRemark",
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

function isInspectionFailed(value) {
  return String(value ?? "").trim().toLowerCase() === "failed";
}

function formatDuplicateMatch(match) {
  const parts = [
    match.jobReference || match.packNumber || "Pack",
    match.customerName,
    match.packingStartDate || match.packDate,
    match.order ? `container #${match.order}` : null,
  ].filter(Boolean);
  return parts.join(" · ");
}

function formatSamePackDuplicateOrders(matches) {
  if (!matches?.length) return "";
  if (matches.length === 1) return `container #${matches[0].order ?? "?"}`;
  return `containers #${matches.map((match) => match.order ?? "?").join(", #")}`;
}

function CrossPackDuplicateWarning({ fieldLabel, matches }) {
  if (!matches?.length) return null;
  return (
    <div className="md:col-span-2 xl:col-span-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-950">
      <p className="font-semibold">
        This {fieldLabel} is already used on{" "}
        {matches.length === 1 ? "another pack" : `${matches.length} other packs`} in the last 3 months
      </p>
      <ul className="mt-1.5 space-y-1">
        {matches.map((match) => (
          <li key={`${match.packId}-${match.containerId}`}>
            {match.packId ? (
              <Link
                href={`/packing-schedule/new-pack-form?mode=edit&id=${match.packId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="underline decoration-amber-400 underline-offset-2 hover:text-amber-900"
              >
                {formatDuplicateMatch(match)}
              </Link>
            ) : (
              formatDuplicateMatch(match)
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function SamePackDuplicateWarning({ fieldLabel, matches }) {
  if (!matches?.length) return null;
  return (
    <div className="md:col-span-2 xl:col-span-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-950">
      <p className="font-semibold">
        This {fieldLabel} is already used on {formatSamePackDuplicateOrders(matches)} in this pack
      </p>
    </div>
  );
}

function IsoWeightLimitWarnings({ warnings }) {
  if (!warnings?.length) return null;
  return (
    <div className="md:col-span-2 xl:col-span-4 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-950">
      <p className="font-semibold">Weight exceeds ISO container limits</p>
      <ul className="mt-1.5 list-disc space-y-1 pl-4">
        {warnings.map((warning) => (
          <li key={warning}>{warning}</li>
        ))}
      </ul>
    </div>
  );
}

export default function ContainerFormSections({
  container,
  onChange,
  packId,
  containerId,
  packerNames,
  packerSelectOptions,
  yesNoOptions,
  inspectionOptions,
  inspectionLevelOptions = ["Consumable", "Standard"],
  rectificationOptions = ["N", "Y"],
  ecInspectionRemarks = [],
  goodsInspectionRemarks = [],
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
  packContainers = [],
  containerCodes = [],
  isImportPack = false,
}) {
  const names = { ...defaultFieldNames, ...(fieldNames || {}) };
  const setField = (key, value) => onChange?.({ [names[key] || key]: value });
  const containerNoValue = getValue(container, names, "containerNo");
  const sealNoValue = getValue(container, names, "sealNo");
  const grossWeightValue = getValue(container, names, "grossWeight");
  const containerNoNormalized = normalizeContainerNumber(containerNoValue);
  const containerNoError =
    containerNoNormalized.length === 11 ? validateContainerNumber(containerNoValue) : null;
  const sealNoError = sealNoValue ? validateSealNumber(sealNoValue) : null;
  const grossWeightError = validateGrossWeight(grossWeightValue);
  const isoWeightLimitWarnings = useMemo(
    () => getContainerWeightLimitWarnings(container, containerCodes),
    [container, containerCodes]
  );
  const sealRequiredForSignoff = showPackersNote && !String(sealNoValue ?? "").trim();
  const resolvedPackId = resolveEntityId(packId, container?.packId, container?.pack_id);
  const resolvedContainerId = resolveEntityId(containerId, container?.id);
  const [baselineContainerNo, setBaselineContainerNo] = useState("");
  const [baselineSealNo, setBaselineSealNo] = useState("");
  useEffect(() => {
    setBaselineContainerNo(normalizeContainerNumber(getValue(container, names, "containerNo")));
    setBaselineSealNo(normalizeSealNumber(getValue(container, names, "sealNo")));
    // Snapshot saved values when switching containers — not on every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedContainerId]);
  const isOriginalContainerNumber =
    Boolean(resolvedContainerId) &&
    containerNoNormalized.length === 11 &&
    containerNoNormalized === baselineContainerNo;
  const duplicateCheckEnabled =
    containerNoNormalized.length === 11 && !containerNoError && !isOriginalContainerNumber;
  const { matches: duplicateMatches, loading: duplicateLoading } = useContainerDuplicateCheck(
    containerNoValue,
    {
      packId: resolvedPackId,
      containerId: resolvedContainerId,
      baselineContainerNumber: baselineContainerNo,
      enabled: duplicateCheckEnabled,
    }
  );
  const samePackDuplicates = useMemo(() => {
    if (containerNoNormalized.length !== 11 || containerNoError) return [];
    return findSamePackContainerDuplicates(containerNoValue, packContainers, {
      excludeContainerId: resolvedContainerId ?? container?.id,
      excludeOrder: container?.order,
    });
  }, [
    containerNoValue,
    containerNoNormalized,
    containerNoError,
    packContainers,
    resolvedContainerId,
    container?.id,
    container?.order,
  ]);
  const sealNoNormalized = normalizeSealNumber(sealNoValue);
  const isOriginalSealNumber =
    Boolean(resolvedContainerId) &&
    Boolean(sealNoNormalized) &&
    sealNoNormalized === baselineSealNo;
  const sealDuplicateCheckEnabled = Boolean(sealNoNormalized) && !sealNoError && !isOriginalSealNumber;
  const { matches: sealDuplicateMatches, loading: sealDuplicateLoading } = useSealDuplicateCheck(
    sealNoValue,
    {
      packId: resolvedPackId,
      containerId: resolvedContainerId,
      baselineSealNumber: baselineSealNo,
      enabled: sealDuplicateCheckEnabled,
    }
  );
  const samePackSealDuplicates = useMemo(() => {
    if (!sealNoNormalized || sealNoError) return [];
    return findSamePackSealDuplicates(sealNoValue, packContainers, {
      excludeContainerId: resolvedContainerId ?? container?.id,
      excludeOrder: container?.order,
    });
  }, [
    sealNoValue,
    sealNoNormalized,
    sealNoError,
    packContainers,
    resolvedContainerId,
    container?.id,
    container?.order,
  ]);
  const submitted = Boolean(getValue(container, names, "praSubmitted", false));
  // AO sign-off action gating
  const canAoSignoff = hasPermission("packing.container.ao-signoff");
  const packerOptions = packerSelectOptions ?? packerNames ?? [];
  const releaseSelectOptions = useMemo(
    () =>
      packReleases.map((r, idx) => ({
        value: String(r.releaseId ?? r.id ?? r.releaseRef ?? r.releaseNumber ?? idx),
        label: r.releaseNumber ?? r.releaseRef ?? "Release",
        key: r.packReleaseId ?? r.id ?? idx,
      })),
    [packReleases]
  );

  const selectedRelease = useMemo(() => {
    const currentId = container?.releaseId ?? container?.release_id;
    const currentRef = getValue(container, names, "releaseNumber");
    return (
      packReleases.find((r) => currentId && String(r.releaseId ?? r.id) === String(currentId)) ||
      packReleases.find((r) => (r.releaseNumber ?? r.releaseRef) === currentRef) ||
      null
    );
  }, [packReleases, container, names]);

  const parkSelectOptions = useMemo(() => {
    const parks = Array.isArray(selectedRelease?.parks) ? selectedRelease.parks : [];
    if (!parks.length) {
      return containerParkOptions.map((park) => ({ value: park.id, label: park.name }));
    }
    return parks
      .map((park) => {
        const id = park.containerParkId ?? park.container_park_id ?? "";
        const name =
          park.containerParkName ??
          containerParkOptions.find((p) => String(p.id) === String(id))?.name ??
          id;
        return id ? { value: id, label: name } : null;
      })
      .filter(Boolean);
  }, [selectedRelease, containerParkOptions]);

  const transporterSelectOptions = useMemo(() => {
    const parks = Array.isArray(selectedRelease?.parks) ? selectedRelease.parks : [];
    const parkId = container?.emptyContainerParkId;
    const park = parks.find((p) => String(p.containerParkId ?? p.container_park_id) === String(parkId));
    const ids = park
      ? Array.isArray(park.transporterIds)
        ? park.transporterIds
        : (park.transporters || []).map((t) => t.id)
      : [];
    if (!ids.length) {
      return transporterOptions.map((t) => ({ value: t.id, label: t.name }));
    }
    return ids
      .map((id) => {
        const name =
          park?.transporters?.find((t) => String(t.id) === String(id))?.name ??
          transporterOptions.find((t) => String(t.id) === String(id))?.name ??
          id;
        return { value: id, label: name };
      })
      .filter(Boolean);
  }, [selectedRelease, container?.emptyContainerParkId, transporterOptions]);

  function handleReleaseSelect(releaseKey) {
    const release = packReleases.find(
      (r) => String(r.releaseId ?? r.id ?? r.releaseRef) === String(releaseKey)
    );
    if (release) {
      const releaseNumber = release.releaseNumber ?? release.releaseRef ?? "";
      const firstPark = (release.parks || [])[0];
      const parkId = firstPark?.containerParkId ?? release.emptyContainerParkId ?? null;
      const transId =
        (firstPark?.transporterIds || [])[0] ??
        (firstPark?.transporters || [])[0]?.id ??
        release.transporterId ??
        null;
      const parkName =
        containerParkOptions.find((p) => String(p.id) === String(parkId))?.name ||
        firstPark?.containerParkName ||
        release.emptyContainerPark?.name ||
        "";
      const transName =
        transporterOptions.find((t) => String(t.id) === String(transId))?.name ||
        release.transporter?.name ||
        "";
      onChange?.({
        releaseId: release.releaseId ?? release.id ?? null,
        [names.releaseNumber || "releaseNumber"]: releaseNumber,
        emptyContainerParkId: parkId,
        transporterId: transId,
        [names.releasePark || "releasePark"]: parkName,
        [names.transporter || "transporter"]: transName,
      });
    } else {
      onChange?.({ [names.releaseNumber || "releaseNumber"]: releaseKey });
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

  const ecRemarkOptions = buildRemarkSelectOptions(ecInspectionRemarks);
  const goodsRemarkOptions = buildRemarkSelectOptions(goodsInspectionRemarks);
  const emptyFailed = isInspectionFailed(getValue(container, names, "emptyInspection"));
  const grainFailed = isInspectionFailed(getValue(container, names, "grainInspection"));

  function applyRemarkPatch(patch) {
    onChange?.(patch);
  }

  function handleRemarkCodeSelect(type, option) {
    const codeField = type === "goods" ? names.grainInspectionRemarkCode : names.ecInspectionRemarkCode;
    const remarkField = type === "goods" ? names.grainInspectionRemark : names.ecInspectionRemark;
    if (!option) {
      applyRemarkPatch({
        [codeField]: "",
        [remarkField]: "",
      });
      return;
    }
    applyRemarkPatch({
      [codeField]: option.value,
      [remarkField]: option.name || option.label,
      [names.inspectionRemarkCode]: option.value,
      [names.aoInspectionRemark]: option.name || option.label,
    });
  }

  return (
    <>
      <div className={cn(sectionCardClass, "border-blue-200/90 bg-blue-50/30")}>
        <div className={cn(sectionHeaderClass, "border-blue-200 bg-blue-100/80 text-blue-900")}>Packing Order</div>
        <div className="grid gap-3 p-3 md:grid-cols-2 xl:grid-cols-3">
          <PemsInput
            label="Container No"
            value={containerNoValue}
            onChange={(value) =>
              onChange?.(buildIdentityFieldPatch(container, names, "containerNo", sanitizeContainerNumberInput(value)))
            }
            placeholder="e.g. MSKU1234567"
            error={containerNoError}
            inputClass={inputClass}
          />
          {duplicateLoading && duplicateCheckEnabled ? (
            <p className="md:col-span-2 xl:col-span-3 text-xs text-slate-500">
              Checking for duplicate container numbers…
            </p>
          ) : null}
          <SamePackDuplicateWarning fieldLabel="container number" matches={samePackDuplicates} />
          <CrossPackDuplicateWarning fieldLabel="container number" matches={duplicateMatches} />
          <PemsInput
            label="Seal No"
            value={sealNoValue}
            onChange={(value) =>
              onChange?.(buildIdentityFieldPatch(container, names, "sealNo", sanitizeSealNumberInput(value)))
            }
            placeholder="e.g. SL12345"
            error={sealNoError}
            inputClass={inputClass}
          />
          {sealDuplicateLoading && sealDuplicateCheckEnabled ? (
            <p className="md:col-span-2 xl:col-span-3 text-xs text-slate-500">
              Checking for duplicate seal numbers…
            </p>
          ) : null}
          <SamePackDuplicateWarning fieldLabel="seal number" matches={samePackSealDuplicates} />
          <CrossPackDuplicateWarning fieldLabel="seal number" matches={sealDuplicateMatches} />
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
          <PemsInput
            label="Gross Weight"
            value={grossWeightValue}
            onChange={(value) => setField("grossWeight", sanitizeGrossWeightInput(value))}
            type="number"
            step="0.01"
            max={MAX_CONTAINER_GROSS_WEIGHT_MT}
            inputClass={inputClass}
            error={grossWeightError}
          />
          <PemsInput label="Nett Weight" value={getValue(container, names, "nettWeight")} readOnly inputClass={inputClass} />
          <PemsInput
            label="Container tare weight"
            value={getValue(container, names, "containerTareWeight")}
            onChange={(value) => setField("containerTareWeight", value)}
            type="number"
            step="0.01"
            inputClass={inputClass}
          />
          <IsoWeightLimitWarnings warnings={isoWeightLimitWarnings} />
        </div>
      </div>

      <div className={cn(sectionCardClass, "border-slate-200/90 bg-slate-50/30")}>
        <div className={cn(sectionHeaderClass, "border-slate-200 bg-slate-100 text-slate-800")}>Release Details</div>
        <div className="grid gap-3 p-3 md:grid-cols-3">
          {packReleases.length > 0 ? (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-600">Release Number</label>
              <ClutchSelect
                options={releaseSelectOptions}
                value={
                  releaseSelectOptions.find(
                    (o) =>
                      o.value === String(container?.releaseId ?? container?.release_id ?? "") ||
                      o.label === getValue(container, names, "releaseNumber")
                  ) ?? null
                }
                onChange={(option) => handleReleaseSelect(option ? option.value : "")}
                placeholder="- Select release -"
              />
            </div>
          ) : (
            <PemsInput label="Release Number" value={getValue(container, names, "releaseNumber")} onChange={(value) => setField("releaseNumber", value)} inputClass={inputClass} />
          )}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-600">Empty Container Park</label>
            <ClutchSelect
              options={parkSelectOptions}
              value={parkSelectOptions.find((o) => String(o.value) === String(container?.emptyContainerParkId ?? "")) ?? null}
              onChange={(option) => handleParkSelect(option ? option.value : "")}
              placeholder="- Select park -"
            />
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-600">Transporter</label>
            <ClutchSelect
              options={transporterSelectOptions}
              value={transporterSelectOptions.find((o) => String(o.value) === String(container?.transporterId ?? "")) ?? null}
              onChange={(option) => handleTransporterSelect(option ? option.value : "")}
              placeholder="- Select transporter -"
            />
          </div>
        </div>
      </div>

      <div className={cn(sectionCardClass, "border-slate-200/90 bg-slate-50/30")}>
        <div className={cn(sectionHeaderClass, "border-slate-200 bg-slate-100 text-slate-800")}>Signoff</div>
        <div className="grid gap-3 p-3 md:grid-cols-2 xl:grid-cols-4">
          <PemsSelect
            label="Packer signoff"
            value={getValue(container, names, "packerSignoff")}
            options={packerNames}
            onChange={(value) => setField("packerSignoff", value)}
            disabled={sealRequiredForSignoff}
            hint={sealRequiredForSignoff ? "Enter a seal number first" : ""}
          />
          <PemsSelect
            label={isImportPack ? "In-loaded?" : "Out-loaded?"}
            value={getValue(container, names, "outLoaded", "No")}
            options={yesNoOptions}
            onChange={(value) => setField("outLoaded", value)}
            disabled={sealRequiredForSignoff}
            hint={sealRequiredForSignoff ? "Enter a seal number first" : ""}
          />
          {!isImportPack ? (
            <>
              <PemsSelect label="PRA signoff" value={getValue(container, names, "praSignoff")} options={packerNames} onChange={(value) => setField("praSignoff", value)} inputClass={inputClass} />
              <PemsSelect label="PRA template" value={getValue(container, names, "praTemplate")} options={praTemplateOptions} onChange={(value) => setField("praTemplate", value)} inputClass={inputClass} />
            </>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t border-slate-200 px-3 py-3">
          <Button type="button" variant="secondary" size="sm" onClick={onResetContainer}>
            Reset container
          </Button>
          <Button type="button" size="sm" onClick={onMarkPacked}>
            {isImportPack ? "Mark in-loaded" : "Mark packed"}
          </Button>
          {!isImportPack ? (
            <>
              <Button type="button" size="sm" onClick={onSubmitPra}>
                Submit PRA
              </Button>
              <span className="ms-auto text-sm font-semibold text-rose-600">{submitted ? "PRA Submitted" : "PRA Pending"}</span>
            </>
          ) : null}
        </div>
      </div>

      {!isImportPack ? (
      <>
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
        {emptyFailed ? (
          <div className="px-3 pb-2">
            <label className="mb-1 block text-xs font-medium text-slate-600">Empty container fail reason</label>
            {ecRemarkOptions.length ? (
              <ClutchSelect
                options={ecRemarkOptions}
                value={ecRemarkOptions.find((opt) => opt.value === getValue(container, names, "ecInspectionRemarkCode")) ?? null}
                onChange={(option) => handleRemarkCodeSelect("ec", option)}
                placeholder="Select fail reason…"
                isClearable
              />
            ) : (
              <p className="text-[11px] text-amber-700">
                Fail-reason codes are not loaded. Run backend migrations and seed PEMS inspection remarks, then refresh this page.
              </p>
            )}
          </div>
        ) : null}
        {grainFailed ? (
          <div className="px-3 pb-2">
            <label className="mb-1 block text-xs font-medium text-slate-600">Grain inspection fail reason</label>
            {goodsRemarkOptions.length ? (
              <ClutchSelect
                options={goodsRemarkOptions}
                value={goodsRemarkOptions.find((opt) => opt.value === getValue(container, names, "grainInspectionRemarkCode")) ?? null}
                onChange={(option) => handleRemarkCodeSelect("goods", option)}
                placeholder="Select fail reason…"
                isClearable
              />
            ) : (
              <p className="text-[11px] text-amber-700">
                Fail-reason codes are not loaded. Run backend migrations and seed PEMS inspection remarks, then refresh this page.
              </p>
            )}
          </div>
        ) : null}
        <div className="px-3 pb-3">
          {emptyFailed ? (
            <div className="mb-3">
              <label className="mb-1 block text-xs font-medium text-slate-600">Empty container inspection remark</label>
              <textarea
                className={`${inputClass} min-h-[82px] w-full resize-y`}
                value={getValue(container, names, "ecInspectionRemark") || getValue(container, names, "aoInspectionRemark")}
                onChange={(event) => setField("ecInspectionRemark", event.target.value)}
              />
            </div>
          ) : null}
          {grainFailed ? (
            <div className="mb-3">
              <label className="mb-1 block text-xs font-medium text-slate-600">Grain inspection remark</label>
              <textarea
                className={`${inputClass} min-h-[82px] w-full resize-y`}
                value={getValue(container, names, "grainInspectionRemark") || getValue(container, names, "aoInspectionRemark")}
                onChange={(event) => setField("grainInspectionRemark", event.target.value)}
              />
            </div>
          ) : null}
          {!emptyFailed && !grainFailed ? (
            <>
              <label className="mb-1 block text-xs font-medium text-slate-600">Container inspection remark (notes)</label>
              <textarea className={`${inputClass} min-h-[82px] w-full resize-y`} value={getValue(container, names, "aoInspectionRemark")} onChange={(event) => setField("aoInspectionRemark", event.target.value)} />
            </>
          ) : null}
        </div>
      </div>
      </>
      ) : null}

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

function PemsInput({ label, value, onChange, type = "text", readOnly = false, step, min, max, inputClass, error, placeholder }) {
  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-slate-600">{label}</label>
      <input
        className={cn(
          inputClass,
          "block w-full",
          readOnly ? "cursor-default bg-slate-50 text-slate-700" : "",
          error ? "border-rose-300 focus:border-rose-400 focus:ring-rose-100" : ""
        )}
        value={value ?? ""}
        type={type}
        onChange={(event) => onChange?.(event.target.value)}
        readOnly={readOnly}
        step={step}
        min={min}
        max={max}
        placeholder={placeholder}
        aria-invalid={error ? "true" : undefined}
        {...numberInputProps(type)}
      />
      {error ? <p className="text-xs text-rose-600">{error}</p> : null}
    </div>
  );
}

function PemsSelect({ label, value, options, onChange, disabled = false, hint = "" }) {
  const opts = useMemo(() => normalizeSelectOptions(options), [options]);
  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-slate-600">{label}</label>
      <ClutchSelect
        options={opts}
        value={opts.find((o) => String(o.value) === String(value ?? "")) ?? null}
        onChange={(option) => onChange?.(option ? option.value : "")}
        placeholder={opts.length ? "Select option" : ""}
        isDisabled={disabled}
      />
      {hint ? <p className="text-xs text-amber-700">{hint}</p> : null}
    </div>
  );
}

function normalizeSelectOptions(options = []) {
  if (!options.length) return [];
  if (typeof options[0] === "object" && options[0] !== null && "value" in options[0]) {
    return options;
  }
  return toOptions(options);
}