"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { SectionRouteDropdown } from "@/components/section-route-dropdown";
import { FUMIGATION_NAV } from "@/lib/fumigation-nav";
import { cn } from "@/lib/utils";

const FUMIGATION_ITEMS = FUMIGATION_NAV.map(({ label, href }) => ({ label, href }));

function FumigationTabs() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Fumigation sections"
      className="flex w-full min-w-0 flex-nowrap items-end gap-1 overflow-x-auto py-0 [scrollbar-width:thin]"
      role="tablist"
    >
      {FUMIGATION_NAV.map(({ slug, label, href }) => {
        const active = pathname === href;
        return (
          <Link
            key={slug}
            href={href}
            role="tab"
            aria-selected={active}
            className={cn(
              "inline-flex shrink-0 items-center border-b-2 border-transparent px-2 py-1.5 text-xs font-medium transition-colors md:px-3 md:py-2 md:text-sm",
              active ? "border-brand text-brand-ink" : "text-slate-600 hover:border-slate-300 hover:text-slate-900"
            )}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

export function FumigationBubbleNav() {
  return (
    <>
      <div className="w-full min-w-0 md:hidden">
        <SectionRouteDropdown ariaLabel="Fumigation sections" items={FUMIGATION_ITEMS} placeholder="Fumigation" />
      </div>
      <div className="hidden w-full min-w-0 md:block">
        <FumigationTabs />
      </div>
    </>
  );
}
