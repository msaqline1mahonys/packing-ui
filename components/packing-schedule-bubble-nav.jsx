"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { SectionRouteDropdown } from "@/components/section-route-dropdown";
import { PACKING_SCHEDULE_NAV } from "@/lib/packing-schedule-nav";
import { cn } from "@/lib/utils";

const PACKING_SCHEDULE_ITEMS = PACKING_SCHEDULE_NAV.map(({ label, href }) => ({
  label,
  href,
}));

function isActive(pathname, href) {
  if (href === "/packing-schedule") return pathname === "/packing-schedule";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function PackingScheduleTabs() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Packing schedule categories"
      className="flex w-full min-w-0 flex-nowrap items-end gap-1 overflow-x-auto py-0 [scrollbar-width:thin]"
      role="tablist"
    >
      {PACKING_SCHEDULE_NAV.map(({ label, href }) => {
        const active = isActive(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            role="tab"
            aria-selected={active}
            className={cn(
              "inline-flex shrink-0 items-center border-b-2 border-transparent px-2 py-1.5 text-xs font-medium transition-colors md:px-3 md:py-2 md:text-sm",
              active
                ? "border-brand text-brand-ink"
                : "text-slate-600 hover:border-slate-300 hover:text-slate-900"
            )}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

export function PackingScheduleBubbleNav() {
  return (
    <>
      <div className="w-full min-w-0 md:hidden">
        <SectionRouteDropdown
          ariaLabel="Packing schedule categories"
          items={PACKING_SCHEDULE_ITEMS}
          placeholder="Select category"
        />
      </div>
      <div className="hidden w-full min-w-0 md:block">
        <PackingScheduleTabs />
      </div>
    </>
  );
}
