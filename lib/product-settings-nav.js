export const PRODUCT_SETTINGS_NAV = [
  { slug: "commodity", label: "Commodity Grade" },
  { slug: "commodity-type", label: "Commodity Type" },
  { slug: "shrink-settings", label: "Shrink Settings" },
  { slug: "test", label: "Test" },
];

export function productSettingsLabel(slug) {
  return PRODUCT_SETTINGS_NAV.find((e) => e.slug === slug)?.label;
}
