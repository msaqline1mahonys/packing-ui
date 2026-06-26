import { getSessionPackerForPack } from "@/lib/packers-session-store";

function trimField(value) {
  return String(value ?? "").trim();
}

import { getContainerNumberFromRecord } from "@/lib/packers-work-store";

export function isDraftContainer(container) {
  return !getContainerNumberFromRecord(container);
}

export function resolvePackLocationName(packRow, stockLocations = []) {
  const nested = packRow?.packingLocation ?? packRow?.packing_location;
  if (nested && typeof nested === "object" && nested.name) {
    return String(nested.name).trim();
  }
  const nestedName = packRow?.packingLocationName ?? packRow?.packing_location_name;
  if (nestedName) return String(nestedName).trim();
  const locationId = packRow?.packingLocationId ?? packRow?.packing_location_id;
  if (!locationId) return "";
  const match = (stockLocations || []).find((row) => String(row.id) === String(locationId));
  return match?.name ? String(match.name).trim() : "";
}

export function resolveSessionPackerName(packRow) {
  const packId = packRow?.id;
  if (!packId) return "";
  return getSessionPackerForPack(packId)?.packerName ?? "";
}

export function applyDraftContainerPrefills(container, { packRow, stockLocations = [] } = {}) {
  if (!container || !isDraftContainer(container)) return container;
  // EC replacement slots inherit logistics from the failed container; skip UI hints so
  // an untouched replacement stays revertible and saves do not persist unintended defaults.
  if (container.replacesContainerId ?? container.replaces_container_id) {
    return container;
  }

  const next = { ...container };
  const locationName = resolvePackLocationName(packRow, stockLocations);
  if (locationName && !trimField(next.stockBayId)) {
    next.stockBayId = locationName;
  }

  const sessionPacker = resolveSessionPackerName(packRow);
  if (sessionPacker && !trimField(next.packer)) {
    next.packer = sessionPacker;
  }

  return next;
}
