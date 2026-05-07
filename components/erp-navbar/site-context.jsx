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

import { PACKING_SITES } from "./packing-defaults";
import { readSiteOptions, SITES_UPDATED_EVENT } from "@/lib/site-data";

const SiteContext = createContext(null);

const DEFAULT_STORAGE_KEY = "packing-erp-site";

function parseStoredId(raw, sites) {
  if (!raw || !sites?.length) return null;
  return sites.some((s) => s.id === raw) ? raw : null;
}

export function SiteProvider({
  children,
  sites,
  /** First matching site id when nothing valid is stored. */
  defaultSiteId,
  storageKey = DEFAULT_STORAGE_KEY,
}) {
  const [resolvedSites, setResolvedSites] = useState(() => {
    if (sites?.length) return sites;
    return PACKING_SITES;
  });
  const sitesRef = useRef(resolvedSites);
  sitesRef.current = resolvedSites;

  useEffect(() => {
    if (sites?.length) {
      setResolvedSites(sites);
      return;
    }

    const syncSites = () => {
      const next = readSiteOptions();
      setResolvedSites(next.length ? next : PACKING_SITES);
    };

    syncSites();
    window.addEventListener("storage", syncSites);
    window.addEventListener(SITES_UPDATED_EVENT, syncSites);
    return () => {
      window.removeEventListener("storage", syncSites);
      window.removeEventListener(SITES_UPDATED_EVENT, syncSites);
    };
  }, [sites]);

  const initialId =
    defaultSiteId && resolvedSites.some((s) => s.id === defaultSiteId)
      ? defaultSiteId
      : (resolvedSites[0]?.id ?? "");

  const [siteId, setSiteIdState] = useState(initialId);

  useEffect(() => {
    const parsed = parseStoredId(localStorage.getItem(storageKey), sitesRef.current);
    if (parsed) {
      setSiteIdState(parsed);
      return;
    }
    const fallback =
      (defaultSiteId && sitesRef.current.some((s) => s.id === defaultSiteId)
        ? defaultSiteId
        : sitesRef.current[0]?.id) ?? "";
    setSiteIdState(fallback);
  }, [storageKey, defaultSiteId]);

  useEffect(() => {
    if (!siteId || !resolvedSites.length) return;
    if (!resolvedSites.some((s) => s.id === siteId)) {
      const next = resolvedSites[0]?.id ?? "";
      setSiteIdState(next);
      if (next) localStorage.setItem(storageKey, next);
    }
  }, [resolvedSites, siteId, storageKey]);

  const storageKeyRef = useRef(storageKey);
  storageKeyRef.current = storageKey;

  const setSiteId = useCallback((next) => {
    if (!sitesRef.current.some((s) => s.id === next)) return;
    setSiteIdState(next);
    localStorage.setItem(storageKeyRef.current, next);
  }, []);

  const value = useMemo(() => {
    const site = resolvedSites.find((s) => s.id === siteId) ?? resolvedSites[0] ?? null;
    return {
      sites: resolvedSites,
      siteId: site?.id ?? "",
      site,
      setSiteId,
    };
  }, [resolvedSites, siteId, setSiteId]);

  return <SiteContext.Provider value={value}>{children}</SiteContext.Provider>;
}

export function useSite() {
  const ctx = useContext(SiteContext);
  if (!ctx) throw new Error("useSite must be used within SiteProvider");
  return ctx;
}
