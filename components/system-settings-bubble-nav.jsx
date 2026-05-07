"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { SectionRouteDropdown } from "@/components/section-route-dropdown";
import { SYSTEM_SETTINGS_NAV } from "@/lib/system-settings-nav";
import { cn } from "@/lib/utils";

const SYSTEM_SETTINGS_ITEMS = SYSTEM_SETTINGS_NAV.map(({ slug, label }) => ({
  label,
  href: `/contact/${slug}`,
}));

function SystemSettingsTabs() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Contacts categories"
      className="flex w-full min-w-0 flex-nowrap items-end gap-1 overflow-x-auto py-0 [scrollbar-width:thin]"
      role="tablist"
    >
      {SYSTEM_SETTINGS_ITEMS.map(({ label, href }) => {
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

export function SystemSettingsBubbleNav() {
  return (
    <>
      <div className="w-full min-w-0 md:hidden">
        <SectionRouteDropdown
          ariaLabel="Contacts categories"
          items={SYSTEM_SETTINGS_ITEMS}
          placeholder="Select contacts section"
        />
      </div>
      <div className="hidden w-full min-w-0 md:block">
        <SystemSettingsTabs />
      </div>
    </>
  );
}
