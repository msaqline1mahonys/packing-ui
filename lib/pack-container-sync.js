/**
 * Validation and helpers for syncing pack_containers when the container list changes.
 */

import { getContainerNumber, isContainerSlotEmpty } from "@/lib/container-bulk-import";
import { getSealNumberFromRecord } from "@/lib/container-number-validation";

function trimField(value) {
  return String(value ?? "").trim();
}

function containerOrder(container, index) {
  const order = Number(container?.order);
  if (Number.isFinite(order) && order > 0) return order;
  return index + 1;
}

function normalizeCount(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.floor(n);
}

/** True when the slot has packer/planning data beyond an empty placeholder. */
export function containerHasPackDetails(container) {
  if (!container) return false;
  if (getContainerNumber(container)) return true;
  if (trimField(getSealNumberFromRecord(container))) return true;
  if (trimField(container.packer)) return true;
  if (trimField(container.packerSignoff)) return true;
  if (trimField(container.aoSignoff)) return true;
  if (trimField(container.stockBayId)) return true;
  if (trimField(container.grainLocation)) return true;
  if (container.outLoaded === "Yes") return true;
  if (Number(container.nettWeight) > 0) return true;
  if (Number(container.grossWeight) > 0) return true;
  if (container.emptyInspection && container.emptyInspection !== "Pending") return true;
  if (container.grainInspection && container.grainInspection !== "Pending") return true;
  if (container.praSubmitted) return true;
  if (container.ecrSubmitted) return true;
  if (container.gppirSubmitted) return true;
  return false;
}

/** Out-loaded containers with nett weight may have active stock ledger transactions. */
export function containerMayHaveStockTransactions(container) {
  return container?.outLoaded === "Yes" && Number(container?.nettWeight) > 0;
}

export function describeContainerSlot(container, index) {
  const order = containerOrder(container, index);
  const number = getContainerNumber(container);
  const parts = [];
  const seal = trimField(getSealNumberFromRecord(container));
  if (seal) parts.push(`seal ${seal}`);
  if (Number(container?.nettWeight) > 0) parts.push(`${container.nettWeight} MT nett`);
  if (container?.outLoaded === "Yes") parts.push("out-loaded");
  if (trimField(container?.packerSignoff)) parts.push("packer signoff");
  if (container?.grainInspection && container.grainInspection !== "Pending") {
    parts.push(`grain ${String(container.grainInspection).toLowerCase()}`);
  }
  if (!parts.length && trimField(container?.releaseNumber)) parts.push(`release ${container.releaseNumber}`);

  return {
    id: container?.id,
    order,
    number,
    summary: parts.length ? parts.join(" · ") : "Empty slot",
    hasDetails: containerHasPackDetails(container),
  };
}

/** Remove selected containers and renumber remaining slots 1..n. */
export function applyContainerRemovals(containers, idsToRemove) {
  const idSet = new Set((idsToRemove || []).map(String));
  const remaining = (Array.isArray(containers) ? containers : []).filter(
    (container) => !idSet.has(String(container.id))
  );
  return remaining.map((container, index) => ({
    ...container,
    order: index + 1,
  }));
}

/**
 * Validate a change to containersRequired before save when only trimming empty tail slots.
 *
 * @param {Array} containers - Current pack container slots (from buildPackContainers)
 * @param {number} previousCount - Baseline containers_required from the saved pack
 * @param {number} nextCount - Proposed containers_required
 * @returns {{ ok: boolean, message?: string, slotsToRemove: number, minimumCount: number, emptySlotCount: number, needsSelection?: boolean }}
 */
export function validateContainersRequiredChange(containers, previousCount, nextCount) {
  const prev = normalizeCount(previousCount);
  const next = normalizeCount(nextCount);
  const list = Array.isArray(containers) ? containers : [];

  const emptySlotCount = list.filter((c) => isContainerSlotEmpty(c)).length;
  const filled = list
    .map((c, i) => ({ container: c, order: containerOrder(c, i) }))
    .filter(({ container }) => !isContainerSlotEmpty(container));

  const minimumCount = filled.length ? Math.max(...filled.map(({ order }) => order)) : 0;
  const slotsToRemove = Math.max(0, prev - next);

  if (next < minimumCount) {
    const positions = filled
      .filter(({ order }) => order > next)
      .map(({ order, container }) => {
        const num = getContainerNumber(container);
        return num ? `position ${order} (${num})` : `position ${order}`;
      });
    const detail =
      positions.length > 0 ? positions.join(", ") : `position ${minimumCount} or higher`;
    return {
      ok: false,
      needsSelection: true,
      message: `Cannot reduce to ${next} without removing containers at ${detail}. Use Remove containers to choose which slots to delete.`,
      slotsToRemove,
      minimumCount,
      emptySlotCount,
    };
  }

  if (slotsToRemove > emptySlotCount) {
    return {
      ok: false,
      needsSelection: true,
      message: `Select ${slotsToRemove} container slot${slotsToRemove === 1 ? "" : "s"} to remove — only ${emptySlotCount} empty slot${emptySlotCount === 1 ? "" : "s"} can be dropped from the end automatically.`,
      slotsToRemove,
      minimumCount,
      emptySlotCount,
    };
  }

  const tailSlots = list
    .map((c, i) => ({ container: c, order: containerOrder(c, i) }))
    .filter(({ order }) => order > next);

  const nonEmptyTail = tailSlots.filter(({ container }) => !isContainerSlotEmpty(container));
  if (nonEmptyTail.length) {
    const positions = nonEmptyTail
      .map(({ order, container }) => {
        const num = getContainerNumber(container);
        return num ? `position ${order} (${num})` : `position ${order}`;
      })
      .join(", ");
    return {
      ok: false,
      needsSelection: true,
      message: `Select which containers to remove — numbers are still assigned at ${positions}.`,
      slotsToRemove,
      minimumCount,
      emptySlotCount,
    };
  }

  return {
    ok: true,
    slotsToRemove,
    minimumCount,
    emptySlotCount,
  };
}
