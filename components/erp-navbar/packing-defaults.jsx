"use client";

/**
 * Demo / default menus for Packing MTS — replace or pass modules via ErpNavbar props in another project.
 */

import {
  CircleDollarSign,
  FlaskConical,
  HelpCircle,
  LayoutDashboard,
  Package,
  Settings2,
  Ticket,
  Users,
  Waypoints,
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
    children: [
      { name: "Overview", href: "/" },
      { name: "Reference data", href: "/reference-data" },
      { name: "Contacts", href: "/contact" },
      { name: "Product settings", href: "/product-settings" },
    ],
  },
  {
    name: "Packing schedule",
    href: "/packing-schedule",
    icon: <Package className="size-5" strokeWidth={1.5} />,
  },
  {
    name: "Packers schedule",
    href: "/packers-schedule",
    icon: <Users className="size-5" strokeWidth={1.5} />,
  },
  {
    name: "Ticketing",
    href: "/ticketing",
    icon: <Ticket className="size-5" strokeWidth={1.5} />,
  },
  {
    name: "Transactions",
    href: "/transactions",
    icon: <Waypoints className="size-5" strokeWidth={1.5} />,
  },
  {
    name: "Accounting",
    href: "/accounting",
    icon: <CircleDollarSign className="size-5" strokeWidth={1.5} />,
  },
  {
    name: "Fumigation",
    href: "/fumigation",
    icon: <FlaskConical className="size-5" strokeWidth={1.5} />,
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
  },
];
