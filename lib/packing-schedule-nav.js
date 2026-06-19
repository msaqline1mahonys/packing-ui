export const PACKING_SCHEDULE_NAV = [
  { slug: null, label: "Packs", href: "/packing-schedule" },
  { slug: "containers", label: "Containers", href: "/packing-schedule/containers" },
  { slug: "releases", label: "Releases", href: "/packing-schedule/releases" },
];

export function packingScheduleLabel(slug) {
  if (slug == null || slug === "") return "Packs";
  return PACKING_SCHEDULE_NAV.find((e) => e.slug === slug)?.label;
}
