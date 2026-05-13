"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import * as Avatar from "@radix-ui/react-avatar";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { ChevronDown, LogOut } from "lucide-react";

import { cn } from "@/lib/utils";

import { pathnameMatchesHref } from "./nav-path";
import { NavDockSelect } from "./nav-dock-select";
import { SiteSelect } from "./site-select";
import { useSite } from "./site-context";
import { useErpNavUi } from "./nav-ui-context";

function IconSlot({ icon, className }) {
  return <span className={cn("inline-flex shrink-0 items-center justify-center text-current", className)}>{icon}</span>;
}

export function ErpHorizontalNav({ edge }) {
  const pathname = usePathname();
  const router = useRouter();
  const [accountOpen, setAccountOpen] = useState(false);
  const ui = useErpNavUi();
  const { sites } = useSite();

  const menuSide = edge === "bottom" ? "top" : "bottom";

  return (
    <header
      className={cn(
        "sticky z-40 flex min-h-11 w-full shrink-0 flex-nowrap items-center gap-x-1 border-slate-200/90 bg-gradient-to-b from-white/95 to-slate-50/90 px-1.5 py-0 shadow-[0_0_0_1px_rgba(0,112,255,0.06)] backdrop-blur-md md:min-h-[4.5rem] md:gap-x-2 md:px-2.5",
        edge === "top" ? "top-0 border-b" : "bottom-0 border-t"
      )}
    >
      <div className="flex min-w-0 max-w-[40%] shrink-0 items-center gap-0.5 md:max-w-none md:gap-1.5">
        <div className="grid size-7 shrink-0 place-content-center rounded-md border border-brand/25 bg-gradient-to-br from-brand/[0.07] to-white shadow-sm md:size-8 md:rounded-lg lg:size-9 lg:rounded-lg">
          <img src={ui.brandIconSrc} alt="Brand mark" className="size-4 object-contain md:size-[1.125rem] lg:size-5" />
        </div>
        <div className="min-w-0 leading-none md:leading-tight">
          <span className="block text-[13px] font-bold tracking-tight text-brand md:text-[15px] lg:text-base">{ui.brandTitle}</span>
          <p className="text-[8px] font-semibold uppercase tracking-[0.12em] text-slate-900 md:text-[9px] md:tracking-[0.15em]">
            {ui.brandSubtitle}
          </p>
        </div>
      </div>

      <nav
        className="flex min-h-0 min-w-0 flex-1 items-center gap-0.5 overflow-x-auto py-0 [scrollbar-width:thin] md:gap-1"
        aria-label="ERP modules"
      >
        {ui.modules.map((item) => (
          <HorizontalModule key={item.name} item={item} pathname={pathname} />
        ))}
      </nav>

      <div className="ml-auto flex min-w-0 shrink-0 items-center gap-0 border-l border-slate-200/80 pl-1 md:gap-0.5 md:pl-2">
        {ui.footerNav.map((item) => {
          const active = pathnameMatchesHref(pathname, item.href);
          return (
            <Link
              key={item.name}
              href={item.href}
              title={item.name}
              className={cn(
                "flex size-8 items-center justify-center rounded-md text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 md:size-9 md:rounded-lg",
                active && "bg-brand/10 text-brand"
              )}
            >
              <IconSlot icon={item.icon} className="[&>svg]:size-[1rem] md:[&>svg]:size-[1.15rem]" />
            </Link>
          );
        })}

        <div className="ml-0.5 flex min-w-0 shrink-0 items-center gap-1 md:ml-1 md:gap-2">
          {sites?.length ? (
            <div className="hidden min-w-0 sm:block">
              <SiteSelect selectId="erp-site-h-bar" className="hover:bg-slate-50/80" />
            </div>
          ) : null}
          <DropdownMenu.Root open={accountOpen} onOpenChange={setAccountOpen}>
          <DropdownMenu.Trigger asChild>
            <button
              type="button"
              className="flex cursor-pointer items-center gap-0.5 rounded-md border border-slate-200/90 bg-white/90 p-0.5 pr-1 outline-none ring-brand/35 hover:bg-slate-50 focus-visible:ring-2 md:gap-1 md:rounded-lg md:p-1 md:pr-2"
            >
              <Avatar.Root>
                {ui.avatarSrc ? (
                  <Avatar.Image
                    src={ui.avatarSrc}
                    alt=""
                    className="size-7 rounded-full object-cover ring-2 ring-brand/25 md:size-8"
                    width={32}
                    height={32}
                  />
                ) : null}
                <Avatar.Fallback
                  className="flex size-7 items-center justify-center rounded-full bg-gradient-to-br from-brand to-blue-700 text-[9px] font-semibold text-white md:size-8 md:text-[10px]"
                  delayMs={400}
                >
                  {ui.userInitials}
                </Avatar.Fallback>
              </Avatar.Root>
              <ChevronDown className="size-3 shrink-0 text-slate-400 md:size-3.5" aria-hidden />
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              side={menuSide}
              align="end"
              sideOffset={8}
              className="z-50 w-64 rounded-xl border border-slate-200 bg-white p-2 text-sm text-slate-700 shadow-lg"
            >
              <span className="block px-2 py-2 text-xs text-slate-500">{ui.userEmail}</span>
              <DropdownMenu.Item asChild>
                <Link
                  href={ui.accountSettingsHref}
                  className="block cursor-pointer rounded-lg px-2 py-2 outline-none hover:bg-slate-50"
                >
                  Account &amp; workspace
                </Link>
              </DropdownMenu.Item>
              {sites?.length ? (
                <div className="sm:hidden">
                  <SiteSelect selectId="erp-site-h-menu" className="hover:bg-transparent" />
                </div>
              ) : null}
              <NavDockSelect selectId="erp-nav-dock-h" className="hover:bg-transparent" />
              <div className="relative rounded-lg px-1 py-1 hover:bg-slate-50">
                <label htmlFor="erp-theme-h" className="sr-only">
                  Theme
                </label>
                <select
                  id="erp-theme-h"
                  className="w-full cursor-pointer appearance-none rounded-md bg-transparent py-2 pl-2 pr-8 text-sm outline-none"
                  defaultValue="light"
                >
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                  <option value="system">Match system</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-2 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              </div>
              <DropdownMenu.Item asChild>
                <button
                  type="button"
                  onClick={() => {
                    localStorage.removeItem("isAuthenticated");
                    localStorage.removeItem("authToken");
                    localStorage.removeItem("authPayload");
                    router.push("/login");
                  }}
                  className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-left outline-none hover:bg-red-50 hover:text-red-800"
                >
                  <LogOut className="size-4" />
                  Log out
                </button>
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
        </div>
      </div>
    </header>
  );
}

function HorizontalModule({ item, pathname }) {
  const children = item.children;
  const active =
    pathnameMatchesHref(pathname, item.href) ||
    (children?.some((c) => pathnameMatchesHref(pathname, c.href)) ?? false);

  if (children?.length) {
    return (
      <DropdownMenu.Root>
        <DropdownMenu.Trigger
          className={cn(
            "flex shrink-0 cursor-pointer items-center gap-1 rounded-md px-1.5 py-1.5 text-xs font-medium text-slate-700 outline-none ring-brand/30 transition-colors hover:bg-slate-100 hover:text-slate-950 focus-visible:ring-2 md:gap-1 md:rounded-lg md:px-2 md:py-1.5 md:text-[13px] lg:gap-1.5 lg:px-2.5 lg:py-2 lg:text-sm",
            active && "bg-brand/10 text-brand-ink"
          )}
        >
          <IconSlot icon={item.icon} className="[&>svg]:size-3.5 md:[&>svg]:size-[0.9375rem] lg:[&>svg]:size-4" />
          <span className="max-w-[6rem] truncate md:max-w-[8rem] lg:max-w-[9rem]">{item.name}</span>
          <ChevronDown className="size-3 shrink-0 text-slate-400 lg:size-3.5" />
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            side="bottom"
            align="start"
            sideOffset={4}
            className="z-50 min-w-[12rem] rounded-lg border border-slate-200 bg-white p-1 text-sm shadow-lg"
          >
            {children.map((sub) => (
              <DropdownMenu.Item key={sub.href} asChild>
                <Link
                  href={sub.href}
                  className={cn(
                    "block cursor-pointer rounded-md px-2 py-2 outline-none",
                    pathnameMatchesHref(pathname, sub.href)
                      ? "bg-brand/15 font-medium text-brand-ink"
                      : "hover:bg-slate-50"
                  )}
                >
                  {sub.name}
                </Link>
              </DropdownMenu.Item>
            ))}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    );
  }

  return (
    <Link
      href={item.href}
      className={cn(
        "flex shrink-0 items-center gap-1 rounded-md px-1.5 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-950 md:gap-1 md:rounded-lg md:px-2 md:py-1.5 md:text-[13px] lg:gap-1.5 lg:px-2.5 lg:py-2 lg:text-sm",
        pathnameMatchesHref(pathname, item.href) && "bg-brand/10 text-brand-ink"
      )}
    >
      <IconSlot icon={item.icon} className="[&>svg]:size-3.5 md:[&>svg]:size-[0.9375rem] lg:[&>svg]:size-4" />
      <span className="max-w-[6rem] truncate md:max-w-[8rem] lg:max-w-[9rem]">{item.name}</span>
    </Link>
  );
}
