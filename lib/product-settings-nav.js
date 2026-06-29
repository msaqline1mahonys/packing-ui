export const PRODUCT_SETTINGS_NAV = [
  { slug: "commodity-type", label: "Commodity Types" },
  { slug: "commodity", label: "Commodity Grade" },
  { slug: "test", label: "Tests" },
  { slug: "shrink-settings", label: "Shrink Settings" },
];

export function productSettingsLabel(slug) {
  return PRODUCT_SETTINGS_NAV.find((e) => e.slug === slug)?.label;
}
