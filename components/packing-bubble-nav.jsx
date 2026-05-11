"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { SectionRouteDropdown } from "@/components/section-route-dropdown";
import { cn } from "@/lib/utils";

const PACKING_NAV = [
  { slug: "packing-table", label: "Packing Table" },
  { slug: "bulk-packing", label: "Bulk Packing" },
  { slug: "container-packing", label: "Container Packing" },
  { slug: "schedule", label: "Schedule" },
];

const PACKING_ITEMS = PACKING_NAV.map(({ slug, label }) => ({
  label,
  href: `/packing/${slug}`,
}));

function PackingTabs() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Packing categories"
      className="flex w-full min-w-0 flex-nowrap items-end gap-1 overflow-x-auto py-0 [scrollbar-width:thin]"
      role="tablist"
    >
      {PACKING_NAV.map(({ slug, label }) => {
        const href = `/packing/${slug}`;
        const active = pathname === href;
        return (
          <Link
            key={slug}
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

export function PackingBubbleNav() {
  return (
    <>
      <div className="w-full min-w-0 md:hidden">
        <SectionRouteDropdown
          ariaLabel="Packing categories"
          items={PACKING_ITEMS}
          placeholder="Select category"
        />
      </div>
      <div className="hidden w-full min-w-0 md:block">
        <PackingTabs />
      </div>
    </>
  );
}
