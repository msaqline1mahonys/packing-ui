import { validateContainerNumber } from "@/lib/container-number-validation";
import {
  containerHasEnteredPackingDetails,
  filterOperationalContainers,
  getContainerNumberFromRecord,
} from "@/lib/packers-work-store";

/** Empty planner slots with no packing data yet — no container number required on pack save. */
export function containerSlotRequiresContainerNumber(container) {
  if (getContainerNumberFromRecord(container)) return true;
  return containerHasEnteredPackingDetails(container);
}

/** Returns an error message when the container number is missing or invalid, or null if OK. */
export function getRequiredContainerNumberError(container) {
  const value = getContainerNumberFromRecord(container);
  if (!value) return "Container number is required.";
  return validateContainerNumber(value);
}

/** Validates container numbers for slots that have been started — not blank draft placeholders. */
export function validatePackContainerNumbers(containers) {
  const operational = filterOperationalContainers(containers);
  const toValidate = operational.filter(containerSlotRequiresContainerNumber);
  if (!toValidate.length) {
    return { ok: true };
  }

  const missingOrders = toValidate
    .filter((container) => !getContainerNumberFromRecord(container))
    .map((container) => container.order)
    .filter((order) => order != null);

  if (missingOrders.length) {
    const label = missingOrders.map((order) => `#${order}`).join(", ");
    return {
      ok: false,
      message: `Container number is required for container slot${missingOrders.length === 1 ? "" : "s"} ${label}.`,
    };
  }

  for (const container of toValidate) {
    const formatError = validateContainerNumber(getContainerNumberFromRecord(container));
    if (formatError) {
      const order = container.order != null ? ` #${container.order}` : "";
      return {
        ok: false,
        message: `Container${order}: ${formatError}`,
      };
    }
  }

  return { ok: true };
}
