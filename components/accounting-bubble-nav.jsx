"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { SectionRouteDropdown } from "@/components/section-route-dropdown";
import { ACCOUNTING_NAV } from "@/lib/accounting-nav";
import { cn } from "@/lib/utils";

const ACCOUNTING_ITEMS = ACCOUNTING_NAV.map(({ slug, label, href }) => ({
  label,
  href: href ?? `/accounting/${slug}`,
}));

function AccountingTabs() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Accounting sections"
      className="flex w-full min-w-0 flex-nowrap items-end gap-1 overflow-x-auto py-0 [scrollbar-width:thin]"
      role="tablist"
    >
      {ACCOUNTING_NAV.map(({ slug, label, href: itemHref }) => {
        const href = itemHref ?? `/accounting/${slug}`;
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

export function AccountingBubbleNav() {
  return (
    <>
      <div className="w-full min-w-0 md:hidden">
        <SectionRouteDropdown
          ariaLabel="Accounting sections"
          items={ACCOUNTING_ITEMS}
          placeholder="Select section"
        />
      </div>
      <div className="hidden w-full min-w-0 md:block">
        <AccountingTabs />
      </div>
    </>
  );
}
