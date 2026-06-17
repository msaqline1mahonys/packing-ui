export const SYSTEM_SETTINGS_NAV = [
  { slug: "users", label: "Users" },
  { slug: "user-permission", label: "User Permission" },
  { slug: "customers", label: "Customers" },
  { slug: "transporter", label: "Transporter" },
];

export function systemSettingsLabel(slug) {
  return SYSTEM_SETTINGS_NAV.find((entry) => entry.slug === slug)?.label;
}
