/**
 * Ticket weights are stored in kilograms (kg). Display/input follows the commodity unit_type.
 */

function normalizeUnit(unitType) {
  return String(unitType ?? "")
    .trim()
    .toLowerCase();
}

export function isTonnesUnit(unitType) {
  const u = normalizeUnit(unitType);
  if (!u) return false;
  return (
    u === "mt" ||
    u === "t" ||
    u === "ton" ||
    u === "tons" ||
    u === "tonne" ||
    u === "tonnes" ||
    u.startsWith("t ") ||
    u.includes("tonne")
  );
}

export function isKilogramsUnit(unitType) {
  const u = normalizeUnit(unitType);
  return u === "kg" || u.startsWith("kg ") || u.includes("kilogram");
}

export function isPoundsUnit(unitType) {
  const u = normalizeUnit(unitType);
  return u === "lb" || u === "lbs" || u.startsWith("lb ") || u.includes("pound");
}

export function isGramsUnit(unitType) {
  const u = normalizeUnit(unitType);
  return u === "g" || u.startsWith("g ") || u.includes("gram");
}

/** Short label for UI (t, kg, lb, g). */
export function weightUnitLabel(unitType) {
  if (isTonnesUnit(unitType)) return "t";
  if (isPoundsUnit(unitType)) return "lb";
  if (isGramsUnit(unitType)) return "g";
  return "kg";
}

/** Convert stored kg to the unit shown in inputs and summaries. */
export function displayFromStorageKg(storageKg, unitType) {
  const kg = Number(storageKg) || 0;
  if (isTonnesUnit(unitType)) return kg / 1000;
  if (isPoundsUnit(unitType)) return kg / 0.45359237;
  if (isGramsUnit(unitType)) return kg * 1000;
  return kg;
}

/** Convert user input in commodity units to kg for storage. */
export function storageKgFromDisplay(displayValue, unitType) {
  if (displayValue === "" || displayValue == null) return null;
  const n = Number(displayValue);
  if (!Number.isFinite(n)) return null;
  if (isTonnesUnit(unitType)) return Math.round(n * 1000);
  if (isPoundsUnit(unitType)) return Math.round(n * 0.45359237);
  if (isGramsUnit(unitType)) return Math.round(n / 1000);
  return Math.round(n);
}

export function formatWeightFromStorageKg(storageKg, unitType, options = {}) {
  const display = displayFromStorageKg(storageKg, unitType);
  const unit = weightUnitLabel(unitType);
  const useFractions = isTonnesUnit(unitType) || isPoundsUnit(unitType);
  const formatted = display.toLocaleString(undefined, {
    minimumFractionDigits: useFractions ? 2 : 0,
    maximumFractionDigits: useFractions ? 3 : 2,
    ...options,
  });
  return { formatted, unit, display };
}
