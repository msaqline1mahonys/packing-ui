export const REFERENCE_DATA_NAV = [
  { slug: "countries", label: "Countries" },
  { slug: "trucks", label: "Trucks" },
  { slug: "packer", label: "Packer" },
  { slug: "container-codes", label: "Container Codes" },
  { slug: "port", label: "Port" },
  { slug: "shipping-line", label: "Shipping Line" },
  { slug: "terminal", label: "Terminal" },
  { slug: "container-park", label: "Container Park" },
];

export function referenceDataLabel(slug) {
  return REFERENCE_DATA_NAV.find((e) => e.slug === slug)?.label;
}
