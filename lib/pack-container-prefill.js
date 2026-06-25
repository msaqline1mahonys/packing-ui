import { getSessionPackerForPack } from "@/lib/packers-session-store";

function trimField(value) {
  return String(value ?? "").trim();
}

export function isDraftContainer(container) {
  return String(container?.status ?? "Draft").toLowerCase() === "draft";
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
