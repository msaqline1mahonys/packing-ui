export const ACCOUNTING_NAV = [
  { slug: "packs-ready-to-invoice", label: "Ready To Invoice" },
  { slug: "general-pack-pricing", label: "General Pack Pricing" },
  { slug: "general-fumigant-pricing", label: "General Fumigant Pricing" },
  { slug: "fees-and-charges", label: "Fees and Charges" },
  { slug: "terminal-price", label: "Terminal Price" },
  { slug: "empty-park-prices", label: "Empty Park Prices" },
];

export function accountingLabel(slug) {
  return ACCOUNTING_NAV.find((entry) => entry.slug === slug)?.label;
}
