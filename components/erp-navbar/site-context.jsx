"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { notifyAuthSessionChanged } from "@/lib/auth-session";
import {
  currentSiteIdFromAuth,
  notifySiteChanged,
  sitesFromAuthPayload,
  switchActiveSite,
} from "@/lib/site-switch";

const SiteContext = createContext(null);

export function SiteProvider({
  children,
  sites,
  /** First matching site id when nothing valid is stored. */
  defaultSiteId,
}) {
  const [resolvedSites, setResolvedSites] = useState(() => {
    if (sites?.length) return sites;
    return sitesFromAuthPayload();
  });
  const sitesRef = useRef(resolvedSites);
  sitesRef.current = resolvedSites;

  const [siteId, setSiteIdState] = useState(() => {
    const fromAuth = currentSiteIdFromAuth();
    const list = sites?.length ? sites : sitesFromAuthPayload();
    if (fromAuth && list.some((s) => s.id === fromAuth)) return fromAuth;
    if (defaultSiteId && list.some((s) => s.id === defaultSiteId)) return defaultSiteId;
    return list[0]?.id ?? "";
  });
  const [isSwitching, setIsSwitching] = useState(false);

  useEffect(() => {
    if (sites?.length) {
      setResolvedSites(sites);
      return;
    }

    const syncSites = () => {
      const next = sitesFromAuthPayload();
      setResolvedSites(next);

      const current = currentSiteIdFromAuth();
      if (current && next.some((s) => s.id === current)) {
        setSiteIdState(current);
        return;
      }

      const fallback =
        (defaultSiteId && next.some((s) => s.id === defaultSiteId) ? defaultSiteId : next[0]?.id) ??
        "";
      setSiteIdState(fallback);
    };

    syncSites();
    window.addEventListener("auth-session-changed", syncSites);
    window.addEventListener("storage", syncSites);
    return () => {
      window.removeEventListener("auth-session-changed", syncSites);
      window.removeEventListener("storage", syncSites);
    };
  }, [sites, defaultSiteId]);

  useEffect(() => {
    if (!siteId || !resolvedSites.length) return;
    if (!resolvedSites.some((s) => s.id === siteId)) {
      const next = resolvedSites[0]?.id ?? "";
      setSiteIdState(next);
    }
  }, [resolvedSites, siteId]);

  const siteIdRef = useRef(siteId);
  siteIdRef.current = siteId;

  const setSiteId = useCallback(async (next) => {
    const nextId = String(next ?? "").trim();
    if (!sitesRef.current.some((s) => s.id === nextId)) return;
    if (nextId === siteIdRef.current) return;

    const token = typeof window !== "undefined" ? localStorage.getItem("authToken") : null;
    if (!token) {
      setSiteIdState(nextId);
      return;
    }

    setIsSwitching(true);
    try {
      await switchActiveSite(nextId);
      setSiteIdState(nextId);
      notifyAuthSessionChanged();
      notifySiteChanged();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSwitching(false);
    }
  }, []);

  const value = useMemo(() => {
    const site = resolvedSites.find((s) => s.id === siteId) ?? resolvedSites[0] ?? null;
    return {
      sites: resolvedSites,
      siteId: site?.id ?? "",
      site,
      setSiteId,
      isSwitching,
    };
  }, [resolvedSites, siteId, setSiteId, isSwitching]);

  return <SiteContext.Provider value={value}>{children}</SiteContext.Provider>;
}

export function useSite() {
  const ctx = useContext(SiteContext);
  if (!ctx) throw new Error("useSite must be used within SiteProvider");
  return ctx;
}
