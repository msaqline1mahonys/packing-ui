/**
 * Parse, plan, and apply bulk container number imports against pack container slots.
 */

import { normalizeContainerNumber, validateContainerNumber } from "@/lib/container-number-validation";

function trimUpper(value) {
  return String(value ?? "").trim().toUpperCase();
}

export function getContainerNumber(container, fieldName = "containerNumber") {
  const primary = container?.[fieldName];
  if (primary != null && String(primary).trim()) return trimUpper(primary);
  return trimUpper(container?.containerNumber ?? container?.containerNo ?? container?.container_number ?? "");
}

export function isContainerSlotEmpty(container, fieldName = "containerNumber") {
  return !getContainerNumber(container, fieldName);
}

export function parseContainerNumbers(text) {
  const raw = String(text ?? "")
    .split(/[\n,\t]+/)
    .map((part) => normalizeContainerNumber(part))
    .filter(Boolean);

  const seen = new Set();
  const numbers = [];
  const duplicateNumbers = [];

  raw.forEach((number) => {
    if (seen.has(number)) {
      if (!duplicateNumbers.includes(number)) duplicateNumbers.push(number);
      return;
    }
    seen.add(number);
    numbers.push(number);
  });

  return { numbers, duplicateNumbers };
}

function coerceArray(value) {
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object") return Object.values(value);
  return [];
}

export function getReleaseRef(row) {
  return String(
    row?.releaseRef ?? row?.release_ref ?? row?.releaseNumber ?? row?.release_number ?? ""
  ).trim();
}

/** Stable key for a pack release line: ref + park + transporter. */
export function releaseLineKey(line) {
  const ref = trimUpper(getReleaseRef(line));
  const park = String(line?.emptyContainerParkId ?? line?.empty_container_park_id ?? "");
  const trans = String(line?.transporterId ?? line?.transporter_id ?? "");
  return `${ref}|${park}|${trans}`;
}

function isBlankReleaseLine(line) {
  return !getReleaseRef(line) && !line?.emptyContainerParkId && !line?.transporterId;
}

/**
 * Flatten reference release parks into pack release lines — one line per park × transporter.
 * If a park has no transporters, emit one line with park only.
 */
export function expandParksToPackLines(releaseRef, parks) {
  const ref = String(releaseRef ?? "").trim();
  if (!ref) return [];

  const normalizedParks = Array.isArray(parks) ? parks : [];
  const lines = [];

  for (const park of normalizedParks) {
    const parkId =
      park.container_park_id ?? park.containerParkId ?? park.container_park?.id ?? "";
    if (!parkId) continue;
    const transporterIds = Array.isArray(park.transporters)
      ? park.transporters.map((t) => t?.id ?? t).filter(Boolean)
      : (park.transporterIds ?? park.transporter_ids ?? []).filter(Boolean);

    if (!transporterIds.length) {
      lines.push({ releaseRef: ref, emptyContainerParkId: parkId, transporterId: null });
    } else {
      for (const tid of transporterIds) {
        lines.push({ releaseRef: ref, emptyContainerParkId: parkId, transporterId: tid });
      }
    }
  }

  return lines;
}

/** Remove duplicate release lines (same ref + park + transporter), preserve order. */
export function dedupeReleaseLines(lines) {
  const seen = new Set();
  const result = [];
  for (const line of lines) {
    if (isBlankReleaseLine(line)) {
      result.push(line);
      continue;
    }
    const key = releaseLineKey(line);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(line);
  }
  return result;
}

/** Append incoming lines that are not already present on existing. */
export function mergeReleaseLines(existing, incoming) {
  const merged = [...existing];
  const existingKeys = new Set(
    existing.filter((line) => !isBlankReleaseLine(line)).map(releaseLineKey)
  );
  for (const line of incoming) {
    if (isBlankReleaseLine(line)) continue;
    const key = releaseLineKey(line);
    if (existingKeys.has(key)) continue;
    existingKeys.add(key);
    merged.push(line);
  }
  return merged;
}

/** Count filled container slots matching a release line's ref + park + transporter. */
export function countContainersForReleaseLine(containers, line, options = {}) {
  const containerNumberField = options.containerNumberField ?? "containerNumber";
  const releaseNumberField = options.releaseNumberField ?? "releaseNumber";
  const ref = trimUpper(getReleaseRef(line));
  const park = String(line?.emptyContainerParkId ?? line?.empty_container_park_id ?? "");
  const trans = String(line?.transporterId ?? line?.transporter_id ?? "");

  let count = 0;
  for (const c of coerceArray(containers)) {
    if (!getContainerNumber(c, containerNumberField)) continue;
    const cRef = getReleaseNumber(c, releaseNumberField);
    const cPark = String(c.emptyContainerParkId ?? c.empty_container_park_id ?? "");
    const cTrans = String(c.transporterId ?? c.transporter_id ?? "");
    if (cRef === ref && cPark === park && cTrans === trans) count += 1;
  }
  return count;
}

export function normalizePackReleases(packReleases) {
  return coerceArray(packReleases)
    .map((row) => {
      const releaseRef = getReleaseRef(row);
      if (!releaseRef) return null;
      return {
        ...row,
        releaseRef,
        emptyContainerParkId:
          row.emptyContainerParkId ?? row.empty_container_park_id ?? row.emptyContainerPark?.id ?? null,
        transporterId: row.transporterId ?? row.transporter_id ?? row.transporter?.id ?? null,
      };
    })
    .filter(Boolean);
}

function parksFromPackLine(line) {
  const parkId = line.emptyContainerParkId ?? line.empty_container_park_id ?? "";
  const transId = line.transporterId ?? line.transporter_id ?? "";
  if (!parkId && !transId) return [{ containerParkId: "", transporterIds: [] }];
  return [
    {
      containerParkId: parkId,
      transporterIds: transId ? [transId] : [],
    },
  ];
}

function packLineToBulkOption(line) {
  const parkId = line.emptyContainerParkId ?? line.empty_container_park_id ?? null;
  const transId = line.transporterId ?? line.transporter_id ?? null;
  return {
    ...line,
    releaseRef: getReleaseRef(line),
    emptyContainerParkId: parkId,
    transporterId: transId,
    parks: parksFromPackLine(line),
  };
}

function referenceReleaseToPackLine(row) {
  const normalized = Array.isArray(row?.parks) ? row : normalizeReferenceReleaseOption(row);
  const parks =
    Array.isArray(normalized.parks) && normalized.parks.length
      ? normalized.parks
      : [{ containerParkId: "", transporterIds: [] }];
  const firstPark = parks[0] || {};
  const parkId = firstPark.containerParkId ?? "";
  const transporterIds = firstPark.transporterIds ?? [];

  return {
    id: normalized.id ?? row?.id,
    releaseRef: getReleaseRef(normalized),
    emptyContainerParkId: parkId || null,
    transporterId: transporterIds[0] ?? null,
    status: normalized.status ?? row?.status ?? "",
    parks,
  };
}

/** Normalize a reference-data release into the shape used by bulk import. */
export function normalizeReferenceReleaseOption(row) {
  const parks = (Array.isArray(row?.parks) ? row.parks : []).map((p) => ({
    containerParkId: p.container_park_id ?? p.containerParkId ?? p.container_park?.id ?? "",
    transporterIds: Array.isArray(p.transporters)
      ? p.transporters.map((t) => t?.id ?? t).filter(Boolean)
      : (p.transporterIds ?? p.transporter_ids ?? []).filter(Boolean),
  }));
  const releaseRef = getReleaseRef(row);
  return {
    id: row?.id,
    releaseNumber: releaseRef,
    releaseRef,
    status: row?.status ?? "",
    parks: parks.length ? parks : [{ containerParkId: "", transporterIds: [] }],
  };
}

/**
 * Merge pack release lines (park/transporter from pack) with reference-data releases
 * so the bulk-import dropdown matches the release picker on the pack form.
 */
export function buildBulkImportReleaseOptions({ packReleases = [], referenceReleases = [] } = {}) {
  const byKey = new Map();

  normalizePackReleases(packReleases).forEach((line) => {
    byKey.set(releaseLineKey(line), packLineToBulkOption(line));
  });

  coerceArray(referenceReleases).forEach((row) => {
    const normalized = normalizeReferenceReleaseOption(row);
    const expanded = expandParksToPackLines(normalized.releaseRef, normalized.parks);
    if (!expanded.length) {
      const converted = referenceReleaseToPackLine(row);
      if (!converted.releaseRef) return;
      const key = releaseLineKey(converted);
      if (!byKey.has(key)) byKey.set(key, converted);
      return;
    }
    expanded.forEach((line) => {
      const key = releaseLineKey(line);
      if (!byKey.has(key)) byKey.set(key, packLineToBulkOption({ ...line, status: normalized.status }));
    });
  });

  return Array.from(byKey.values());
}

/** Pre-fill park + transporter from an explicit pack line or a release's first park. */
export function prefillParkTransporterFromRelease(release) {
  if (!release) return { parkId: "", transporterId: "" };

  const explicitPark = release.emptyContainerParkId ?? release.empty_container_park_id;
  const explicitTrans = release.transporterId ?? release.transporter_id;
  if (
    (explicitPark != null && explicitPark !== "") ||
    (explicitTrans != null && explicitTrans !== "")
  ) {
    return {
      parkId: explicitPark ? String(explicitPark) : "",
      transporterId: explicitTrans ? String(explicitTrans) : "",
    };
  }

  const parks = Array.isArray(release.parks) ? release.parks : parksFromPackLine(release);
  const firstPark = parks[0] || {};
  const parkId = firstPark.containerParkId ?? "";
  const transporterIds = firstPark.transporterIds ?? [];
  const transporterId = transporterIds[0] ?? "";

  return {
    parkId: parkId ? String(parkId) : "",
    transporterId: transporterId ? String(transporterId) : "",
  };
}

/** Initial logistics selection when the dialog opens (auto-fill when only one release). */
export function initialBulkImportLogistics(releases) {
  if (!Array.isArray(releases) || releases.length !== 1) {
    return { releaseRef: "", parkId: "", transporterId: "" };
  }
  const release = releases[0];
  const { parkId, transporterId } = prefillParkTransporterFromRelease(release);
  return {
    releaseRef: release.releaseRef ?? "",
    parkId,
    transporterId,
  };
}

export function buildReleasePatch(release, { containerParkOptions = [], transporterOptions = [] } = {}) {
  if (!release) return {};

  const releaseRef = release.releaseRef ?? release.release_ref ?? "";
  const parkId = release.emptyContainerParkId ?? release.empty_container_park_id ?? null;
  const transId = release.transporterId ?? release.transporter_id ?? null;

  const parkName =
    containerParkOptions.find((p) => String(p.id) === String(parkId))?.name ||
    release.emptyContainerPark?.name ||
    release.empty_container_park?.name ||
    "";

  const transName =
    transporterOptions.find((t) => String(t.id) === String(transId))?.name ||
    release.transporter?.name ||
    "";

  return {
    releaseNumber: releaseRef,
    emptyContainerParkId: parkId || null,
    transporterId: transId || null,
    releasePark: parkName,
    transporter: transName,
  };
}

/**
 * Ensure the release/park/transporter combo used for an import exists on the pack's
 * release list. Releases are a positional list (not keyed by ref), so a release ref
 * can legitimately appear with more than one park/transporter combo. Returns the same
 * array reference when the combo is already present (so callers can skip a save).
 */
export function ensureReleaseLineOnPack(releaseDetails, logistics) {
  const list = Array.isArray(releaseDetails) ? releaseDetails : [];
  const releaseRef = String(logistics?.releaseRef ?? "").trim();
  if (!releaseRef) return list;

  const parkId = logistics?.emptyContainerParkId ? String(logistics.emptyContainerParkId) : "";
  const transporterId = logistics?.transporterId ? String(logistics.transporterId) : "";

  const alreadyPresent = list.some((row) => {
    const rowRef = String(row.releaseRef ?? row.release_ref ?? "").trim();
    const rowPark = String(row.emptyContainerParkId ?? row.empty_container_park_id ?? "");
    const rowTrans = String(row.transporterId ?? row.transporter_id ?? "");
    return rowRef === releaseRef && rowPark === parkId && rowTrans === transporterId;
  });
  if (alreadyPresent) return list;

  return [
    ...list,
    {
      releaseRef,
      emptyContainerParkId: logistics?.emptyContainerParkId || null,
      transporterId: logistics?.transporterId || null,
    },
  ];
}

function getReleaseNumber(container, fieldName = "releaseNumber") {
  return trimUpper(container?.[fieldName] ?? container?.releaseNumber ?? container?.release_number ?? "");
}

function sortByOrder(containers) {
  return [...containers].sort((a, b) => Number(a.order ?? 0) - Number(b.order ?? 0));
}

function findContainerByNumber(containers, number, fieldName) {
  const target = trimUpper(number);
  if (!target) return null;
  return containers.find((container) => getContainerNumber(container, fieldName) === target) || null;
}

function rankEmptySlots(containers, selectedReleaseRef, fieldName, releaseNumberField) {
  const releaseMatch = trimUpper(selectedReleaseRef);
  const empty = sortByOrder(containers).filter((container) => isContainerSlotEmpty(container, fieldName));

  const matchingRelease = empty.filter((container) => getReleaseNumber(container, releaseNumberField) === releaseMatch);
  const otherEmpty = empty.filter((container) => getReleaseNumber(container, releaseNumberField) !== releaseMatch);

  return [...matchingRelease, ...otherEmpty];
}

/**
 * Build an import plan from pasted text and current container slots.
 * userActions: { [importRowKey]: "skip" | "overwrite" }
 */
export function planBulkImport({
  pastedText,
  containers,
  selectedReleaseRef,
  containerNumberField = "containerNumber",
  releaseNumberField = "releaseNumber",
  userActions = {},
}) {
  const { numbers, duplicateNumbers } = parseContainerNumbers(pastedText);
  const emptySlots = rankEmptySlots(containers, selectedReleaseRef, containerNumberField, releaseNumberField);
  const blocked = numbers.length > emptySlots.length;

  const rows = numbers.map((number, index) => {
    const rowKey = String(index);
    const proposedSlot = blocked ? null : emptySlots[index] || null;
    const existingSlot = findContainerByNumber(containers, number, containerNumberField);

    let conflictType = null;
    let defaultAction = "apply";

    if (existingSlot && proposedSlot && existingSlot.id !== proposedSlot.id) {
      conflictType = "number_on_other_slot";
      defaultAction = "skip";
    }

    const userAction = userActions[rowKey];
    let action = userAction || defaultAction;
    if (action === "overwrite" && conflictType !== "number_on_other_slot") {
      action = defaultAction;
    }
    if (blocked) action = "skip";

    const targetSlotId =
      action === "overwrite" && existingSlot ? existingSlot.id : proposedSlot?.id ?? null;
    const targetSlotOrder =
      action === "overwrite" && existingSlot
        ? existingSlot.order
        : proposedSlot?.order ?? null;

    let status = "ready";
    const formatError = validateContainerNumber(number);
    if (formatError) {
      status = "invalid_format";
    } else if (duplicateNumbers.includes(number) && numbers.indexOf(number) !== index) {
      status = "duplicate_paste";
    } else if (blocked) {
      status = "blocked";
    } else if (conflictType && action === "skip") {
      status = "conflict_skip";
    } else if (conflictType && action === "overwrite") {
      status = "conflict_overwrite";
    }

    return {
      rowKey,
      importIndex: index + 1,
      number,
      formatError: formatError || "",
      slotId: proposedSlot?.id ?? null,
      slotOrder: proposedSlot?.order ?? null,
      currentValue: proposedSlot ? getContainerNumber(proposedSlot, containerNumberField) : "",
      status,
      conflictType,
      conflictSlotId: existingSlot?.id ?? null,
      conflictSlotOrder: existingSlot?.order ?? null,
      defaultAction,
      action,
      targetSlotId,
      targetSlotOrder,
    };
  });

  const toApply = rows.filter(
    (row) => !blocked && row.action !== "skip" && row.targetSlotId && row.status !== "invalid_format"
  ).length;

  return {
    blocked,
    blockReason: blocked
      ? `Need ${numbers.length} empty slot${numbers.length === 1 ? "" : "s"}, but only ${emptySlots.length} available — increase Containers Required first.`
      : "",
    duplicateNumbers,
    emptySlotCount: emptySlots.length,
    parsedCount: numbers.length,
    rows,
    toApply,
  };
}

/**
 * Apply planned import rows to a containers array.
 * Returns a new array with patches merged per container id.
 */
export function applyBulkImport({
  containers,
  planRows,
  selectedRelease,
  containerNumberField = "containerNumber",
  lookupOptions = {},
}) {
  const releasePatch = buildReleasePatch(selectedRelease, lookupOptions);
  const updatesById = new Map();

  planRows.forEach((row) => {
    if (row.action === "skip" || !row.targetSlotId || row.status === "invalid_format") return;

    const patch = { ...releasePatch };
    const isOverwriteExisting =
      row.action === "overwrite" && row.conflictType === "number_on_other_slot";

    if (!isOverwriteExisting) {
      patch[containerNumberField] = row.number;
    }

    const prev = updatesById.get(row.targetSlotId) || {};
    updatesById.set(row.targetSlotId, { ...prev, ...patch });
  });

  return containers.map((container) =>
    updatesById.has(container.id) ? { ...container, ...updatesById.get(container.id) } : container
  );
}
