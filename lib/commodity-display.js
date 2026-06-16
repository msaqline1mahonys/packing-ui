/**
 * Label shown in commodity dropdowns, checkboxes, and other form controls.
 */
export function commodityOptionLabel(commodity) {
  if (!commodity) return "";
  return (
    commodity.commodityCode ??
    commodity.commodity_code ??
    commodity.description ??
    commodity.name ??
    ""
  );
}
