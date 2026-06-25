/** Returns true when a single field value should be treated as empty. */
export function isEmptyFieldValue(value) {
  if (Array.isArray(value)) return value.length === 0;
  if (value === null || value === undefined) return true;
  if (typeof value === "boolean") return false;
  if (typeof value === "number") return Number.isNaN(value);
  return !String(value).trim();
}

/** Whether a configured field is currently applicable (respects showWhen). */
export function isFieldApplicable(field, draft) {
  if (field.type === "section") return false;
  if (typeof field.showWhen === "function") return field.showWhen(draft);
  return true;
}

/** Keys of required fields that are empty in draft. */
export function getMissingRequiredFieldKeys(fields, draft) {
  if (!Array.isArray(fields)) return [];
  return fields
    .filter((field) => field.required && isFieldApplicable(field, draft))
    .filter((field) => isEmptyFieldValue(draft[field.key]))
    .map((field) => field.key);
}

/** Object map `{ fieldKey: true }` for missing required fields. */
export function buildRequiredFieldErrors(fields, draft) {
  return Object.fromEntries(getMissingRequiredFieldKeys(fields, draft).map((key) => [key, true]));
}

/** Validate explicit `{ key, required?, showWhen? }` rules against a values object. */
export function buildRequiredFieldErrorsFromRules(rules, values) {
  const errors = {};
  for (const rule of rules) {
    if (!rule.required) continue;
    if (typeof rule.showWhen === "function" && !rule.showWhen(values)) continue;
    if (isEmptyFieldValue(values[rule.key])) {
      errors[rule.key] = true;
    }
  }
  return errors;
}

export function hasFieldErrors(errors) {
  return Boolean(errors && Object.values(errors).some(Boolean));
}

/** Clear a single field error when the user edits it. */
export function clearFieldError(errors, key) {
  if (!errors?.[key]) return errors;
  const next = { ...errors };
  delete next[key];
  return next;
}
