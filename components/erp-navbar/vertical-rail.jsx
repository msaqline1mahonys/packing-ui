"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import * as Avatar from "@radix-ui/react-avatar";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { ChevronDown, LogOut } from "lucide-react";

import { notifyAuthSessionChanged } from "@/lib/auth-session";
import { cn } from "@/lib/utils";

import { pathnameMatchesHref } from "./nav-path";
import { NavDockSelect } from "./nav-dock-select";
import { SiteSelect } from "./site-select";
import { useSite } from "./site-context";
import { AccountDropdownHeader } from "./account-dropdown-header";
import { useErpNavUi } from "./nav-ui-context";
import { useNavDock } from "./nav-dock-context";

/** Collapsed rail: w-14 on small screens, md:w-[4.5rem] from md up; expanded: w-[17.25rem]. */
const WIDTH_EXPANDED_CLASS = "w-[17.25rem]";

const CALM_DURATION = "duration-[480ms]";
const CALM_EASE = "ease-[cubic-bezier(0.4,0,0.2,1)]";
const CALM = cn(CALM_DURATION, CALM_EASE, "motion-reduce:transition-none");

const SURFACE_TRANSITION = cn("transition-colors", CALM_DURATION, CALM_EASE, "motion-reduce:transition-none");

const COLLAPSE_HOVER_DELAY_MS = 280;

function labelReveal(expanded) {
  return cn(
    "overflow-hidden whitespace-nowrap transition-[opacity,max-width,margin-inline-start]",
    CALM,
    expanded
      ? "pointer-events-auto ms-2 max-w-[min(13rem,calc(100vw-8rem))] opacity-100"
      : "pointer-events-none ms-0 max-w-0 opacity-0"
  );
}

function NavMenu({
  icon,
  label,
  items,
  pathname,
  parentHref,
  expanded,
  branchActive,
  invertBar,
}) {
  const router = useRouter();
  const descendantActive =
    pathnameMatchesHref(pathname, parentHref) ||
    items.some((item) => pathnameMatchesHref(pathname, item.href));
  const [open, setOpen] = useState(descendantActive);
  useEffect(() => {
    if (!descendantActive) return undefined;

    const frame = requestAnimationFrame(() => setOpen(true));
    return () => cancelAnimationFrame(frame);
  }, [descendantActive]);

  useEffect(() => {
    if (expanded) return undefined;

    const frame = requestAnimationFrame(() => setOpen(false));
    return () => cancelAnimationFrame(frame);
  }, [expanded]);

  const baseId = useId();
  const panelId = `${baseId}-submenu`;

  const showSubPanel = expanded && open;

  return (
    <div>
      <button
        type="button"
        title={label}
        aria-label={label}
        className={cn(
          SURFACE_TRANSITION,
          "flex min-h-9 w-full cursor-pointer rounded-lg px-2 text-slate-600 outline-none ring-brand/35 hover:bg-slate-100 hover:text-slate-950 focus-visible:ring-2",
          "items-center justify-between gap-1 py-1.5 md:min-h-10 md:py-2",
          !expanded && "justify-center",
          expanded && open && "bg-slate-100 text-slate-900",
            expanded &&
            descendantActive &&
            (invertBar
              ? "border-r-2 border-brand bg-brand/10 py-1.5 pr-[6px] pl-2 text-slate-900 md:py-2"
              : "border-l-2 border-brand bg-brand/10 py-1.5 pl-[6px] pr-2 text-slate-900 md:py-2"),
          !expanded &&
            descendantActive &&
            "border border-brand/45 bg-brand/10 shadow-sm shadow-[0_1px_10px_-3px_rgba(0,112,255,0.14)]"
        )}
        aria-expanded={expanded ? open : undefined}
        aria-controls={expanded ? panelId : undefined}
        onClick={() => {
          if (!expanded) {
            router.push(parentHref);
            return;
          }
          setOpen((v) => !v);
        }}
      >
        <div className={cn("flex min-w-0 overflow-hidden", expanded ? "flex-1 items-center" : "")}>
          <span
            className={cn(
              "flex size-8 shrink-0 items-center justify-center md:size-9",
              branchActive ? "text-brand-ink" : "text-slate-500"
            )}
          >
            {icon}
          </span>
          <span className={cn("min-w-0 font-medium tracking-tight", labelReveal(expanded))}>{label}</span>
        </div>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 overflow-hidden text-slate-400 transition-[transform,opacity,max-width]",
            CALM_DURATION,
            CALM_EASE,
            "motion-reduce:transition-none",
            expanded ? "max-w-[1.25rem] opacity-100" : "pointer-events-none max-w-0 opacity-0",
            expanded && open && "rotate-180"
          )}
          aria-hidden={!expanded}
        />
      </button>

      <div
        className={cn(
          "grid overflow-hidden transition-[grid-template-rows]",
          CALM_DURATION,
          CALM_EASE,
          "motion-reduce:transition-none",
          showSubPanel ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        )}
      >
        <div id={panelId} className="min-h-0">
          <ul
            className={cn(
              "mt-1 space-y-0.5 border-brand/30 pb-1 pt-1 text-sm font-medium",
              invertBar ? "mr-3 border-r pr-3" : "mx-3 border-l pl-3"
            )}
          >
            {items.map((item) => {
              const subActive = pathnameMatchesHref(pathname, item.href);
              return (
                <li key={`${parentHref}:${item.name}`}>
                  <Link
                    href={item.href}
                    className={cn(
                      SURFACE_TRANSITION,
                      "flex items-center gap-x-2 rounded-md px-2 py-1.5 md:py-2",
                      subActive
                        ? "bg-brand/15 font-medium text-brand-ink"
                        : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                    )}
                  >
                    {item.name}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}

function NavLinkRow({ href, icon, label, active, expanded, invertBar }) {
  return (
    <Link
      href={href}
      title={!expanded ? label : undefined}
      aria-label={label}
      className={cn(
        SURFACE_TRANSITION,
        "flex min-h-9 cursor-pointer items-center rounded-lg px-2 py-1.5 text-sm font-medium outline-none ring-brand/35 md:min-h-10 md:py-2",
        expanded ? "justify-start" : "justify-center",
        active
          ? expanded
            ? invertBar
              ? "border-r-2 border-brand bg-brand/10 py-1.5 pr-[6px] pl-2 text-brand-ink shadow-sm shadow-[0_1px_12px_-4px_rgba(0,112,255,0.18)] md:py-2"
              : "border-l-2 border-brand bg-brand/10 py-1.5 pl-[6px] pr-2 text-brand-ink shadow-sm shadow-[0_1px_12px_-4px_rgba(0,112,255,0.18)] md:py-2"
            : "border border-brand/45 bg-brand/10 text-brand-ink"
          : expanded
            ? invertBar
              ? "border-r-2 border-transparent pr-2 text-slate-700 hover:bg-slate-50 hover:text-slate-950"
              : "border-l-2 border-transparent pl-2 text-slate-700 hover:bg-slate-50 hover:text-slate-950"
            : "border border-transparent text-slate-600 hover:bg-slate-50 hover:text-slate-950"
      )}
    >
      <span className={cn("flex size-8 shrink-0 items-center justify-center md:size-9", active ? "text-brand" : "text-slate-500")}>
        {icon}
      </span>
      <span className={cn("font-medium tracking-tight", labelReveal(expanded))}>{label}</span>
    </Link>
  );
}

export function ErpVerticalRail({ edge }) {
  const pathname = usePathname();
  const router = useRouter();
  const invertBar = edge === "end";
  const ui = useErpNavUi();
  const { sites, site } = useSite();
  const { setVerticalExpanded } = useNavDock();

  const [hoveredRail, setHoveredRail] = useState(false);
  const [focusedWithin, setFocusedWithin] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const hoverLeaveTimerRef = useRef(null);

  const expanded = hoveredRail || focusedWithin || accountMenuOpen;

  useEffect(() => {
    setVerticalExpanded(expanded);
    return () => setVerticalExpanded(false);
  }, [expanded, setVerticalExpanded]);

  useEffect(() => {
    return () => {
      if (hoverLeaveTimerRef.current) clearTimeout(hoverLeaveTimerRef.current);
    };
  }, []);

  const onRailEnter = () => {
    if (hoverLeaveTimerRef.current) {
      clearTimeout(hoverLeaveTimerRef.current);
      hoverLeaveTimerRef.current = null;
    }
    setHoveredRail(true);
  };

  const onRailLeave = () => {
    hoverLeaveTimerRef.current = setTimeout(() => setHoveredRail(false), COLLAPSE_HOVER_DELAY_MS);
  };

  return (
    <nav
      className={cn(
        "relative z-40 flex h-dvh shrink-0 flex-col overflow-hidden border-slate-200/90 bg-gradient-to-b from-slate-50 via-white to-slate-50/95",
        invertBar
          ? "border-l shadow-[inset_1px_0_0_rgba(0,112,255,0.1)]"
          : "border-r shadow-[inset_-1px_0_0_rgba(0,112,255,0.1)]",
        "transition-[width]",
        CALM_DURATION,
        CALM_EASE,
        "motion-reduce:transition-none",
        expanded ? WIDTH_EXPANDED_CLASS : "w-14 md:w-[4.5rem]"
      )}
      aria-label="ERP modules"
      onMouseEnter={onRailEnter}
      onMouseLeave={onRailLeave}
      onFocusCapture={() => setFocusedWithin(true)}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) {
          setFocusedWithin(false);
        }
      }}
    >
      <div className="relative flex min-h-11 shrink-0 items-center border-b border-slate-200/80 bg-white/60 px-2 py-0 backdrop-blur-sm md:min-h-[4.5rem]">
        <div className="pointer-events-none absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent via-brand/35 to-transparent" />
        <div
          className={cn(
            "flex min-w-0 flex-1 items-center overflow-hidden transition-[gap]",
            CALM_DURATION,
            CALM_EASE,
            "motion-reduce:transition-none",
            expanded ? "justify-start gap-2 px-1.5 md:gap-2 md:px-2 lg:gap-2.5 lg:px-2" : "justify-center gap-0"
          )}
        >
          <div className="grid size-7 shrink-0 place-content-center rounded-lg border border-brand/25 bg-gradient-to-br from-brand/[0.07] to-white shadow-sm shadow-[0_1px_10px_-3px_rgba(0,112,255,0.12)] md:size-8 lg:size-9">
            <img src={ui.brandIconSrc} alt="Brand mark" className="size-4 object-contain md:size-[1.125rem] lg:size-5" />
          </div>
          <div
            className={cn(
              "min-w-0 overflow-hidden transition-[max-width,opacity]",
              CALM_DURATION,
              CALM_EASE,
              "motion-reduce:transition-none",
              expanded ? "max-w-[min(15rem,calc(100vw-10rem))] opacity-100" : "max-w-0 opacity-0"
            )}
          >
            <div className="min-w-0 leading-none md:leading-tight">
              <span className="block truncate text-[13px] font-bold tracking-tight text-brand md:text-[15px] lg:text-base">{ui.brandTitle}</span>
              <p className="truncate text-[8px] font-semibold uppercase tracking-[0.12em] text-slate-900 md:text-[9px] md:tracking-[0.15em]">
                {ui.brandSubtitle}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-2 py-2 md:py-3">
        <div className="mb-1 flex h-7 shrink-0 items-end px-2 md:mb-2 md:h-8">
          <p
            aria-hidden={!expanded}
            className={cn(
              "font-mono text-[10px] font-medium uppercase tracking-widest text-slate-400 transition-[opacity]",
              CALM_DURATION,
              CALM_EASE,
              "motion-reduce:transition-none",
              expanded ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
            )}
          >
            Modules
          </p>
        </div>
        <ul className="space-y-1 text-sm">
          {ui.modules.map((item) => {
            if (item.children?.length) {
              const branchActive =
                pathnameMatchesHref(pathname, item.href) ||
                item.children.some((c) => pathnameMatchesHref(pathname, c.href));
              return (
                <li key={item.name}>
                  <NavMenu
                    icon={item.icon}
                    label={item.name}
                    items={item.children}
                    pathname={pathname}
                    parentHref={item.href}
                    expanded={expanded}
                    branchActive={branchActive}
                    invertBar={invertBar}
                  />
                </li>
              );
            }
            return (
              <li key={item.name}>
                <NavLinkRow
                  href={item.href}
                  icon={item.icon}
                  label={item.name}
                  active={pathnameMatchesHref(pathname, item.href)}
                  expanded={expanded}
                  invertBar={invertBar}
                />
              </li>
            );
          })}
        </ul>

        <div className="mt-6 border-t border-slate-200/90 pt-4">
          <ul className="space-y-1 text-sm font-medium">
            {ui.footerNav.map((item) => (
              <li key={item.name}>
                <NavLinkRow
                  href={item.href}
                  icon={item.icon}
                  label={item.name}
                  active={pathnameMatchesHref(pathname, item.href)}
                  expanded={expanded}
                  invertBar={invertBar}
                />
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="shrink-0 space-y-1.5 border-t border-slate-200/90 px-2 py-2 md:space-y-2 md:py-3">
        {sites?.length && expanded ? (
          <SiteSelect
            selectId="erp-site-v-footer"
            className="rounded-lg border border-slate-200/90 bg-white/90 px-1 py-0.5 shadow-sm hover:bg-slate-50 [&_select]:w-full [&_select]:max-w-none [&_select]:text-xs"
          />
        ) : null}
        {sites?.length && !expanded ? (
          <p
            className="pointer-events-none mx-auto block max-w-[3.25rem] truncate text-center text-[10px] font-semibold leading-tight tracking-tight text-slate-600 md:max-w-[4.5rem]"
            title={site?.label ?? ""}
          >
            {site?.label}
          </p>
        ) : null}
        <DropdownMenu.Root open={accountMenuOpen} onOpenChange={setAccountMenuOpen}>
          <DropdownMenu.Trigger asChild>
            <button
              type="button"
              className={cn(
                "flex w-full min-h-11 cursor-pointer items-center rounded-xl border border-slate-200/90 bg-white/90 p-1.5 text-left outline-none ring-brand/35 hover:bg-slate-50 focus-visible:ring-2 md:min-h-[3.25rem] md:p-2",
                "transition-[padding,gap,color,background-color]",
                CALM_DURATION,
                CALM_EASE,
                "motion-reduce:transition-none",
                expanded ? "justify-start gap-2" : "justify-center gap-0"
              )}
            >
              <Avatar.Root className="relative shrink-0">
                {ui.avatarSrc ? (
                  <Avatar.Image
                    src={ui.avatarSrc}
                    alt=""
                    className="size-9 rounded-full object-cover ring-2 ring-brand/30 md:size-10"
                    width={40}
                    height={40}
                  />
                ) : null}
                <Avatar.Fallback
                  className="flex size-9 items-center justify-center rounded-full bg-gradient-to-br from-brand to-blue-700 text-[11px] font-semibold text-white md:size-10 md:text-xs"
                  delayMs={400}
                >
                  {ui.userInitials}
                </Avatar.Fallback>
              </Avatar.Root>
              <div
                className={cn(
                  "min-w-0 flex-1 overflow-hidden text-left transition-[max-width,opacity]",
                  CALM_DURATION,
                  CALM_EASE,
                  "motion-reduce:transition-none",
                  expanded ? "max-w-[min(12rem,calc(100vw-8rem))] opacity-100" : "max-w-0 opacity-0"
                )}
              >
                <span className="block truncate text-sm font-medium text-slate-900">{ui.userName}</span>
                <span className="block truncate text-xs text-slate-500">{ui.userEmail}</span>
              </div>
              <ChevronDown
                className={cn(
                  "size-4 shrink-0 overflow-hidden text-slate-400 transition-[opacity,max-width]",
                  CALM_DURATION,
                  CALM_EASE,
                  "motion-reduce:transition-none",
                  expanded ? "max-w-[1.25rem] opacity-100" : "pointer-events-none max-w-0 opacity-0"
                )}
                aria-hidden
              />
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              side="top"
              align="start"
              sideOffset={8}
              className="z-50 w-64 rounded-xl border border-slate-200 bg-white p-2 text-sm text-slate-700 shadow-lg shadow-slate-200/80"
            >
              <AccountDropdownHeader />
              <DropdownMenu.Item asChild>
                <Link
                  href={ui.accountSettingsHref}
                  className="block cursor-pointer rounded-lg px-2 py-2 outline-none transition-colors hover:bg-slate-50 hover:text-slate-900"
                >
                  Account &amp; workspace
                </Link>
              </DropdownMenu.Item>
              {sites?.length ? (
                <div className={cn(!expanded ? "block" : "hidden")}>
                  <SiteSelect selectId="erp-site-v-menu" className="hover:bg-transparent" />
                </div>
              ) : null}
              <NavDockSelect selectId="erp-nav-dock-v" />
              <div className="relative rounded-lg px-1 py-1 hover:bg-slate-50">
                <label htmlFor="erp-theme" className="sr-only">
                  Theme
                </label>
                <select
                  id="erp-theme"
                  className="w-full cursor-pointer appearance-none rounded-md bg-transparent py-2 pl-2 pr-8 text-sm text-slate-800 outline-none"
                  defaultValue="light"
                >
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                  <option value="system">Match system</option>
                </select>
                <ChevronDown
                  className="pointer-events-none absolute right-2 top-1/2 size-4 -translate-y-1/2 text-slate-400"
                  aria-hidden
                />
              </div>
              <DropdownMenu.Item asChild>
                <button
                  type="button"
                  onClick={() => {
                    localStorage.removeItem("isAuthenticated");
                    localStorage.removeItem("authToken");
                    localStorage.removeItem("authPayload");
                    notifyAuthSessionChanged();
                    router.push("/login");
                  }}
                  className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-left outline-none transition-colors hover:bg-red-50 hover:text-red-800"
                >
                  <LogOut className="size-4" />
                  Log out
                </button>
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>
    </nav>
  );
}
