"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

import { ErpNavbar, NavDockProvider, SiteProvider, useNavDock } from "@/components/erp-navbar";

import { cn } from "@/lib/utils";

const SHELL_BG =
  "bg-[#f6f8fc] bg-[radial-gradient(ellipse_120%_80%_at_50%_-12%,rgba(0,112,255,0.09),transparent_55%)]";

const AUTH_ROUTES = ["/login", "/register", "/forgot-password", "/reset-password"];

function isPrintRoute(pathname) {
  return /\/ticketing\/(?:in|outgoing)\/\d+\/print\/?$/.test(pathname);
}

function MainPanel({ children, compactTop = false }) {
  return (
    <main
      className={cn(
        "relative min-h-dvh min-w-0 flex-1 overflow-x-hidden",
        compactTop ? "px-4 pb-4 pt-2 md:px-6 md:pb-6 md:pt-3" : "p-6 md:p-10"
      )}
    >
      <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-brand/35 to-transparent" />
      <div className="relative">{children}</div>
    </main>
  );
}

function AppShellInner({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const { dock, isVertical, verticalExpanded } = useNavDock();
  const compactMainTop = pathname.startsWith("/packing-schedule/new-pack-form");

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
            <ErpNavbar />
            <MainPanel compactTop={compactMainTop}>{children}</MainPanel>
          </>
        ) : (
          <>
            <MainPanel compactTop={compactMainTop}>{children}</MainPanel>
            <ErpNavbar />
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
          <MainPanel compactTop={compactMainTop}>{children}</MainPanel>
        </div>
        <div className="fixed inset-y-0 right-0 z-40">
          <ErpNavbar />
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
        <MainPanel compactTop={compactMainTop}>{children}</MainPanel>
      </div>
      <div className="fixed inset-y-0 left-0 z-40">
        <ErpNavbar />
      </div>
    </div>
  );
}

export function AppShell({ children }) {
  return (
    <SiteProvider>
      <NavDockProvider>
        <AppShellInner>{children}</AppShellInner>
      </NavDockProvider>
    </SiteProvider>
  );
}
