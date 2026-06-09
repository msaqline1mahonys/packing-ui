export const SHIPPING_DETAILS_NAV = [
  { slug: "vessel", label: "Vessel" },
  { slug: "vessel-voyage", label: "Vessel Voyage" },
  { slug: "releases", label: "Releases" },
];

export function shippingDetailsLabel(slug) {
  return SHIPPING_DETAILS_NAV.find((e) => e.slug === slug)?.label;
}
