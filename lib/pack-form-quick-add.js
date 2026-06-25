/**
 * Quick-add routes for packing schedule form lookups.
 * Opens the target admin screen in a new tab so the heavy pack form stays intact.
 * Append ?add=1 where the destination page supports auto-opening its add modal.
 */

export const PACK_FORM_QUICK_ADD = {
  customer: { href: "/contact/customers?add=1", label: "➕ Add customer…" },
  commodity: { href: "/product-settings/commodity?add=1", label: "➕ Add commodity…" },
  stockLocation: { href: "/stock-management/stock-locations?add=1", label: "➕ Add location…" },
  packer: { href: "/reference-data/packer?add=1", label: "➕ Add packer…" },
  containerCode: { href: "/reference-data/container-codes?add=1", label: "➕ Add container ISO…" },
  release: { href: "/packing-schedule/releases?add=1", label: "➕ Add release…" },
  shippingLine: { href: "/reference-data/shipping-line?add=1", label: "➕ Add shipping line…" },
  terminal: { href: "/reference-data/terminal?add=1", label: "➕ Add terminal…" },
  vesselVoyage: { href: "/shipping-details/vessel-voyage?add=1", label: "➕ Add vessel voyage…" },
  vessel: { href: "/shipping-details/vessel?add=1", label: "➕ Add vessel…" },
  country: { href: "/reference-data/countries?add=1", label: "➕ Add country…" },
  port: { href: "/reference-data/port?add=1", label: "➕ Add port…" },
  fumigant: { href: "/fumigation/fumigants?add=1", label: "➕ Add fumigant…" },
  methodology: { href: "/fumigation/fumigation-methodologies?add=1", label: "➕ Add methodology…" },
  certificateTemplate: { href: "/fumigation/fumigation-templates?add=1", label: "➕ Add certificate template…" },
  recordTemplate: { href: "/fumigation/fumigation-record-templates?add=1", label: "➕ Add record template…" },
  transporter: { href: "/contact/transporter?add=1", label: "➕ Add transporter…" },
  containerPark: { href: "/reference-data/container-park?add=1", label: "➕ Add container park…" },
  user: { href: "/contact/users?add=1", label: "➕ Add user…" },
};

export function openPackFormQuickAdd(entityKey) {
  const route = PACK_FORM_QUICK_ADD[entityKey];
  if (!route?.href || typeof window === "undefined") return;
  window.open(route.href, "_blank", "noopener,noreferrer");
}

/** ClutchSelect `addNew` prop for pack-form lookup dropdowns. */
export function packFormQuickAdd(entityKey) {
  const route = PACK_FORM_QUICK_ADD[entityKey];
  if (!route) return {};
  return {
    addNew: {
      label: route.label ?? "➕ Add new…",
      onAddNew: () => openPackFormQuickAdd(entityKey),
    },
  };
}
