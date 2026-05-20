export const ACCOUNTING_NAV = [
  { slug: "general-pack-pricing", label: "General Pack Pricing" },
  { slug: "general-fumigant-pricing", label: "General Fumigant Pricing" },
  { slug: "packs-ready-to-invoice", label: "Packs Ready To Invoice" },
  { slug: "fees-and-charges", label: "Fees and Charges" },
  { slug: "terminal-price", label: "Terminal Price", href: "/reference-data/terminal" },
  { slug: "empty-park-prices", label: "Empty Park Prices", href: "/reference-data/container-park" },
];

export function accountingLabel(slug) {
  return ACCOUNTING_NAV.find((entry) => entry.slug === slug)?.label;
}
