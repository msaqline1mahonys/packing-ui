"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { SectionRouteDropdown } from "@/components/section-route-dropdown";
import { cn } from "@/lib/utils";

const MORE_SETTINGS_ITEMS = [{ label: "Site", href: "/more-settings/site" }];

function MoreSettingsTabs() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="System settings categories"
      className="flex w-full min-w-0 flex-nowrap items-end gap-1 overflow-x-auto py-0 [scrollbar-width:thin]"
      role="tablist"
    >
      {MORE_SETTINGS_ITEMS.map(({ label, href }) => {
        const active = pathname === href;
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

export function MoreSettingsBubbleNav() {
  return (
    <>
      <div className="w-full min-w-0 md:hidden">
        <SectionRouteDropdown
          ariaLabel="System settings categories"
          items={MORE_SETTINGS_ITEMS}
          placeholder="Select setting"
        />
      </div>
      <div className="hidden w-full min-w-0 md:block">
        <MoreSettingsTabs />
      </div>
    </>
  );
}
