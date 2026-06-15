/**
 * Copy this folder (`components/erp-navbar`) into another Next.js + Tailwind app that already has
 * the same primitives (Lucide, Radix Avatar/Dropdown, `cn()` utility, brand CSS variables).
 *
 * @example
 * ```jsx
 * import { NavDockProvider, SiteProvider, ErpNavbar } from "@/components/erp-navbar";
 *
 * export default function Shell({ children }) {
 *   return (
 *     <SiteProvider storageKey="my-app-site" sites={[ { id: "syd", label: "Sydney" } ]}>
 *     <NavDockProvider storageKey="my-app-nav-dock">
 *       <div className="flex min-h-dvh">
 *         <ErpNavbar
 *           branding={{ title: "Acme", subtitle: "Operations", iconSrc: "/acme-mark.png" }}
 *           sections={{
 *             main: [
 *               { title: "Home", path: "/", icon: <LayoutDashboard className="size-5" /> },
 *               { title: "Orders", path: "/orders", icon: <Package className="size-5" /> },
 *             ],
 *             bottom: [{ title: "Settings", path: "/settings", icon: <Settings2 className="size-5" /> }],
 *           }}
 *           user={{ name: "Alec Stead", email: "alec@acme.com", initials: "AS" }}
 *         />
 *         <main className="flex-1">{children}</main>
 *       </div>
 *     </NavDockProvider>
 *     </SiteProvider>
 *   );
 * }
 * ```
 */

export { ErpNavbar } from "./erp-navbar";
export { NavDockProvider, useNavDock } from "./nav-dock-context";
export { NavDockSelect } from "./nav-dock-select";
export { SiteProvider, useSite } from "./site-context";
export { SiteSelect } from "./site-select";
export { PACKING_SITES } from "./packing-defaults";
export { ErpNavUiProvider, useErpNavUi } from "./nav-ui-context";
export { pathnameMatchesHref, pathnameMatchesNavChild } from "./nav-path";
export {
  PACKING_NAV_DEFAULT_UI,
  PACKING_NAV_FOOTER,
  PACKING_NAV_MODULES,
} from "./packing-defaults";
export { ErpHorizontalNav } from "./horizontal-nav";
export { ErpVerticalRail } from "./vertical-rail";
