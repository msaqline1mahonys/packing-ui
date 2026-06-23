"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { ErpNavbar, NavDockProvider, SiteProvider, useNavDock } from "@/components/erp-navbar";
import { useAuthNavUser } from "@/components/erp-navbar/use-auth-nav-user";

import { useDisableNumberInputScroll } from "@/lib/number-input";
import { SITE_CHANGED_EVENT } from "@/lib/site-switch";
import { cn } from "@/lib/utils";

const SHELL_BG =
  "bg-[#f6f8fc] bg-[radial-gradient(ellipse_120%_80%_at_50%_-12%,rgba(0,112,255,0.09),transparent_55%)]";

const AUTH_ROUTES = ["/login", "/register", "/forgot-password", "/reset-password"];

function isPrintRoute(pathname) {
  return (
    /\/ticketing\/(?:in|outgoing)\/[^/]+\/print\/?$/.test(pathname) ||
    /^\/reports\/preview\/[^/]+\/?$/.test(pathname) ||
    /^\/fumigation\/(?:certificates|records)\/[^/]+\/print\/?$/.test(pathname)
  );
}

function MainPanel({ children, compactTop = false, tightPadding = false, contentKey = 0 }) {
  return (
    <main
      className={cn(
        "relative min-h-dvh min-w-0 flex-1 overflow-x-hidden",
        compactTop
          ? "px-4 pb-4 pt-2 md:px-6 md:pb-6 md:pt-3"
          : tightPadding
            ? "pb-6 ps-6 pt-2 pe-2 md:pb-10 md:ps-10 md:pt-3 md:pe-4"
            : "p-6 md:p-10"
      )}
    >
      <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-brand/35 to-transparent" />
      <div key={contentKey} className="relative">
        {children}
      </div>
    </main>
  );
}

function AppShellInner({ children }) {
  useDisableNumberInputScroll();
  const pathname = usePathname();
  const router = useRouter();
  const authUser = useAuthNavUser();
  const { dock, isVertical, verticalExpanded } = useNavDock();
  const compactMainTop = pathname.startsWith("/packing-schedule/new-pack-form");
  const tightMainPadding =
    pathname.startsWith("/packing-schedule") && !compactMainTop;
  const [contentKey, setContentKey] = useState(0);

  useEffect(() => {
    const onSiteChanged = () => setContentKey((key) => key + 1);
    window.addEventListener(SITE_CHANGED_EVENT, onSiteChanged);
    return () => window.removeEventListener(SITE_CHANGED_EVENT, onSiteChanged);
  }, []);

  useEffect(() => {
    const isAuthRoute = AUTH_ROUTES.some((r) => pathname.startsWith(r));
    const isAuthenticated = localStorage.getItem("isAuthenticated") === "true";

    if (!isAuthenticated && !isAuthRoute) {
      router.push("/login");
    }
  }, [pathname, router]);

  /* Auth and print pages bypass the ERP shell entirely */
  if (AUTH_ROUTES.some((r) => pathname.startsWith(r)) || isPrintRoute(pathname)) {
    return <>{children}</>;
  }

  if (!isVertical) {
    const top = dock === "horizontal-top";
    return (
      <div className={cn("flex min-h-dvh flex-col text-slate-900", SHELL_BG)}>
        {top ? (
          <>
            <ErpNavbar user={authUser ?? undefined} />
            <MainPanel compactTop={compactMainTop} tightPadding={tightMainPadding} contentKey={contentKey}>
              {children}
            </MainPanel>
          </>
        ) : (
          <>
            <MainPanel compactTop={compactMainTop} tightPadding={tightMainPadding} contentKey={contentKey}>
              {children}
            </MainPanel>
            <ErpNavbar user={authUser ?? undefined} />
          </>
        )}
      </div>
    );
  }

  if (dock === "vertical-end") {
    return (
      <div className={cn("relative min-h-dvh text-slate-900", SHELL_BG)}>
        <div
          className={cn(
            "min-w-0 transition-[padding] duration-[480ms] ease-[cubic-bezier(0.4,0,0.2,1)] motion-reduce:transition-none",
            verticalExpanded ? "pe-14 md:pe-[17.25rem]" : "pe-14 md:pe-[4.5rem]"
          )}
        >
          <MainPanel compactTop={compactMainTop} tightPadding={tightMainPadding} contentKey={contentKey}>
            {children}
          </MainPanel>
        </div>
        <div className="fixed inset-y-0 right-0 z-40">
          <ErpNavbar user={authUser ?? undefined} />
        </div>
      </div>
    );
  }

  return (
    <div className={cn("relative min-h-dvh text-slate-900", SHELL_BG)}>
      <div
        className={cn(
          "min-w-0 transition-[padding] duration-[480ms] ease-[cubic-bezier(0.4,0,0.2,1)] motion-reduce:transition-none",
          verticalExpanded ? "ps-14 md:ps-[17.25rem]" : "ps-14 md:ps-[4.5rem]"
        )}
      >
        <MainPanel compactTop={compactMainTop} tightPadding={tightMainPadding} contentKey={contentKey}>
          {children}
        </MainPanel>
      </div>
      <div className="fixed inset-y-0 left-0 z-40">
        <ErpNavbar user={authUser ?? undefined} />
      </div>
    </div>
  );
}

export function AppShell({ children }) {
  // QueryClient is created once per app instance (stable across re-renders).
  // refetchOnWindowFocus means switching back to this tab after editing
  // reference data in another tab will automatically refresh stale lookups.
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5 * 60 * 1000, // 5 minutes
            retry: 1,
            refetchOnWindowFocus: true,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <SiteProvider>
        <NavDockProvider>
          <AppShellInner>{children}</AppShellInner>
        </NavDockProvider>
      </SiteProvider>
    </QueryClientProvider>
  );
}
