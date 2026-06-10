/** Stock transfer / movement direction options (legacy parity). */
export const STOCK_TRANSFER_DIRECTIONS = [
  { value: "stock_take", label: "STOCK TAKE" },
  { value: "in", label: "IN" },
  { value: "out", label: "OUT" },
  { value: "move", label: "MOVE" },
  { value: "xferin", label: "XFERIN" },
  { value: "xferout", label: "XFEROUT" },
  { value: "mixin", label: "MIXIN" },
  { value: "mixout", label: "MIXOUT" },
];

/**
 * Per-direction field visibility and validation rules.
 * `fields` lists every field that can appear for that direction.
 * Required flags drive the asterisk and submit validation.
 */
export const DIRECTION_FIELD_RULES = {
  stock_take: {
    description: "Adjust stock on hand to match a physical count.",
    fields: {
      datetime: { required: true },
      siteId: { required: false },
      locationId: { required: true },
      amount: { required: true, sign: "any" },
      stockOwnerId: { required: true },
      commodityId: { required: true },
      notes: { required: false },
    },
  },
  in: {
    description: "Add stock into a location.",
    fields: {
      datetime: { required: true },
      siteId: { required: false },
      locationId: { required: true },
      amount: { required: true, sign: "positive" },
      stockOwnerId: { required: true },
      commodityId: { required: true },
      notes: { required: false },
    },
  },
  out: {
    description: "Remove stock from a location.",
    fields: {
      datetime: { required: true },
      siteId: { required: false },
      locationId: { required: true },
      amount: { required: true, sign: "negative" },
      stockOwnerId: { required: true },
      commodityId: { required: true },
      notes: { required: false },
    },
  },
  move: {
    description: "Move stock between two locations for the same stock owner.",
    fields: {
      datetime: { required: true },
      siteId: { required: false },
      fromLocationId: { required: true, label: "From Location" },
      toLocationId: { required: true, label: "To Location" },
      amount: { required: true, sign: "positive" },
      stockOwnerId: { required: true },
      commodityId: { required: true },
      notes: { required: false },
    },
  },
  xferin: {
    description: "Receive stock transferred in from another stock owner.",
    fields: {
      datetime: { required: true },
      siteId: { required: false },
      locationId: { required: true },
      amount: { required: true, sign: "positive" },
      stockOwnerId: { required: true, label: "Receiving Stock Owner" },
      counterpartyStockOwnerId: { required: true, label: "From Stock Owner" },
      commodityId: { required: true },
      notes: { required: false },
    },
  },
  xferout: {
    description: "Send stock transferred out to another stock owner.",
    fields: {
      datetime: { required: true },
      siteId: { required: false },
      locationId: { required: true },
      amount: { required: true, sign: "negative" },
      stockOwnerId: { required: true, label: "Sending Stock Owner" },
      counterpartyStockOwnerId: { required: true, label: "To Stock Owner" },
      commodityId: { required: true },
      notes: { required: false },
    },
  },
  mixin: {
    description: "Blend commodities into a mixed stock position.",
    fields: {
      datetime: { required: true },
      siteId: { required: false },
      locationId: { required: true },
      amount: { required: true, sign: "positive" },
      stockOwnerId: { required: true },
      sourceCommodityId: { required: true, label: "Source Commodity" },
      commodityId: { required: true, label: "Result Commodity" },
      notes: { required: false },
    },
  },
  mixout: {
    description: "Split or extract from a mixed stock position.",
    fields: {
      datetime: { required: true },
      siteId: { required: false },
      locationId: { required: true },
      amount: { required: true, sign: "negative" },
      stockOwnerId: { required: true },
      sourceCommodityId: { required: true, label: "Mixed Commodity" },
      commodityId: { required: true, label: "Extracted Commodity" },
      notes: { required: false },
    },
  },
};

export function getDirectionRules(direction) {
  return DIRECTION_FIELD_RULES[direction] ?? null;
}

export function isFieldVisible(direction, fieldKey) {
  const rules = getDirectionRules(direction);
  return Boolean(rules?.fields[fieldKey]);
}

export function isFieldRequired(direction, fieldKey) {
  const rules = getDirectionRules(direction);
  return Boolean(rules?.fields[fieldKey]?.required);
}

export function getFieldMeta(direction, fieldKey) {
  return getDirectionRules(direction)?.fields[fieldKey] ?? null;
}

export function getAmountRules(direction) {
  return getDirectionRules(direction)?.fields.amount ?? null;
}

/** Returns { valid, errors } for the current direction. */
export function validateStockTransferForm(form) {
  const rules = getDirectionRules(form.direction);
  const errors = {};

  if (!rules) {
    errors.direction = "Select a direction";
    return { valid: false, errors };
  }

  Object.entries(rules.fields).forEach(([key, meta]) => {
    if (!meta.required) return;
    const value = form[key];
    if (value === "" || value == null) {
      errors[key] = "Required";
    }
  });

  const amount = parseFloat(form.amount);
  if (form.amount !== "" && !Number.isNaN(amount)) {
    const amountRules = rules.fields.amount;
    if (amountRules?.sign === "positive" && amount <= 0) {
      errors.amount = "Amount must be positive";
    }
    if (amountRules?.sign === "negative" && amount >= 0) {
      errors.amount = "Amount must be negative";
    }
    if (amountRules?.sign === "positive" && amount === 0) {
      errors.amount = "Amount must be greater than zero";
    }
  }

  if (form.direction === "move" && form.fromLocationId && form.toLocationId && form.fromLocationId === form.toLocationId) {
    errors.toLocationId = "Must differ from source";
  }

  if ((form.direction === "mixin" || form.direction === "mixout") && form.commodityId && form.sourceCommodityId && form.commodityId === form.sourceCommodityId) {
    errors.commodityId = "Must differ from source commodity";
  }

  return { valid: Object.keys(errors).length === 0, errors };
}
