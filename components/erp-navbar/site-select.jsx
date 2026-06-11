"use client";

import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

import { useSite } from "./site-context";

/**
 * Active site selector — options come from login `allowed_sites`; switching
 * calls the backend and refreshes tenant-scoped data.
 */
export function SiteSelect({ selectId, className }) {
  const { sites, siteId, setSiteId, isSwitching } = useSite();

  if (!sites?.length) return null;

  return (
    <div className={cn("relative rounded-lg px-1 py-1 hover:bg-slate-50", className)}>
      <label htmlFor={selectId ?? "erp-site"} className="sr-only">
        Site
      </label>
      <select
        id={selectId ?? "erp-site"}
        value={siteId}
        disabled={isSwitching}
        onChange={(e) => setSiteId(e.target.value)}
        className="max-w-[11rem] cursor-pointer appearance-none rounded-md bg-transparent py-2 pl-2 pr-8 text-sm text-slate-800 outline-none disabled:cursor-wait disabled:opacity-60 sm:max-w-[13rem]"
      >
        {sites.map((s) => (
          <option key={s.id} value={s.id}>
            {s.label}
          </option>
        ))}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-2 top-1/2 size-4 -translate-y-1/2 text-slate-400"
        aria-hidden
      />
    </div>
  );
}
