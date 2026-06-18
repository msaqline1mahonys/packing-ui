export function normalizePriceValue(value) {
  if (value === "" || value == null) return 0;
  return Number(value);
}

export function preparePriceRowsForSave(rows) {
  return rows.map((row) => ({
    ...row,
    revenuePrice: normalizePriceValue(row.revenuePrice),
    expensePrice: normalizePriceValue(row.expensePrice),
  }));
}

export function countUnsavedPriceChanges(currentRows, savedRows) {
  const savedById = new Map(savedRows.map((row) => [row.id, row]));
  let count = 0;

  for (const row of currentRows) {
    const saved = savedById.get(row.id);
    if (!saved) continue;
    if (normalizePriceValue(row.revenuePrice) !== normalizePriceValue(saved.revenuePrice)) count += 1;
    if (normalizePriceValue(row.expensePrice) !== normalizePriceValue(saved.expensePrice)) count += 1;
  }

  return count;
}

export function clonePriceRows(rows) {
  return rows.map((row) => ({ ...row }));
}
