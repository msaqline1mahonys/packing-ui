"use client";

/**
 * Demo / default menus for Packing MTS — replace or pass modules via ErpNavbar props in another project.
 */

import {
  CircleDollarSign,
  FileText,
  HelpCircle,
  LayoutDashboard,
  Package,
  Settings2,
  Ticket,
  Users,
  Warehouse,
} from "lucide-react";
import { DEFAULT_SITE_OPTIONS } from "@/lib/site-data";

/** Default sites for the packing shell — override via `SiteProvider` props. */
export const PACKING_SITES = DEFAULT_SITE_OPTIONS;

export const PACKING_NAV_DEFAULT_UI = {
  brandTitle: "Clutch.",
  brandSubtitle: "Australia",
  brandIconSrc: "/clutch-mark.png",
  userName: "Alec Stead",
  userEmail: "ops@packing.local",
  userInitials: "AS",
  avatarSrc: "",
  accountSettingsHref: "/contact",
};

export const PACKING_NAV_MODULES = [
  {
    name: "Home",
    href: "/",
    icon: <LayoutDashboard className="size-5" strokeWidth={1.5} />,
    // No permission — always visible
    children: [
      { name: "Overview", href: "/" },
      // No permission — always visible
      { name: "Reference data", href: "/reference-data", permission: "reference-data.view" },
      { name: "Shipping details", href: "/shipping-details" },
      // No permission — always visible
      { name: "Contacts", href: "/contact", permission: "contacts.view" },
      { name: "Product settings", href: "/product-settings", permission: "product-settings.view" },
      { name: "Fumigation", href: "/fumigation", permission: "fumigation.records.view" },
    ],
  },
  {
    name: "Packing schedule",
    href: "/packing-schedule",
    icon: <Package className="size-5" strokeWidth={1.5} />,
    permission: "packing.schedule.view",
    children: [
      { name: "Packs", href: "/packing-schedule" },
      { name: "Containers", href: "/packing-schedule/containers" },
    ],
  },
  {
    name: "Stock Management",
    href: "/stock-management",
    icon: <Warehouse className="size-5" strokeWidth={1.5} />,
    permission: "stock.view",
  },
  {
    name: "Packers schedule",
    href: "/packers-schedule",
    icon: <Users className="size-5" strokeWidth={1.5} />,
    permission: "packing.schedule.view",
  },
  {
    name: "Ticketing",
    href: "/ticketing",
    icon: <Ticket className="size-5" strokeWidth={1.5} />,
    permission: "ticketing.tickets.view",
  },
  {
    name: "Reports",
    href: "/reports",
    icon: <FileText className="size-5" strokeWidth={1.5} />,
    permission: "reports.view",
  },
  {
    name: "Accounting",
    href: "/accounting",
    icon: <CircleDollarSign className="size-5" strokeWidth={1.5} />,
    permission: "accounting.view",
  },
];

export const PACKING_NAV_FOOTER = [
  {
    name: "Help",
    href: "/help",
    icon: <HelpCircle className="size-5" strokeWidth={1.5} />,
  },
  {
    name: "System settings",
    href: "/more-settings/site",
    icon: <Settings2 className="size-5" strokeWidth={1.5} />,
    permission: "system-settings.view",
  },
];
