"use client";

import {
  Archive,
  CheckCircle2,
  FolderOpen,
  Import,
  Pause,
  Sun,
} from "lucide-react";

import { PACK_STATUSES } from "@/lib/Data";
import { cn } from "@/lib/utils";

/** Preset views matching the legacy packing schedule tab bar. */
export const SCHEDULE_VIEW_TABS = [
  {
    id: "all",
    label: "All orders",
    icon: FolderOpen,
    statuses: [...PACK_STATUSES],
    importExport: "all",
  },
  {
    id: "pending",
    label: "Pending",
    icon: FolderOpen,
    statuses: ["Pending"],
    importExport: "all",
  },
  {
    id: "onhold",
    label: "On Hold",
    icon: Pause,
    statuses: ["On Hold"],
    importExport: "all",
  },
  {
    id: "imports",
    label: "Imports",
    icon: Import,
    statuses: [...PACK_STATUSES],
    importExport: "Import",
  },
  {
    id: "inprogress",
    label: "In Progress",
    icon: CheckCircle2,
    statuses: ["Inprogress"],
    importExport: "all",
  },
  {
    id: "fumigation",
    label: "Fumigation Pending",
    icon: Sun,
    statuses: ["Pending Fumigation"],
    importExport: "all",
  },
  {
    id: "completed",
    label: "Completed",
    icon: CheckCircle2,
    statuses: ["Completed"],
    importExport: "all",
  },
  {
    id: "archive",
    label: "Archive",
    icon: Archive,
    statuses: ["Invoiced"],
    importExport: "all",
  },
];

export function ScheduleViewTabs({ activeTabId, onTabChange, actions, className }) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-x-2 gap-y-1", className)}>
      <div className="flex min-w-0 flex-1 flex-wrap items-end gap-0.5" role="tablist" aria-label="Schedule views">
        {SCHEDULE_VIEW_TABS.map((tab) => {
          const Icon = tab.icon;
          const active = tab.id === activeTabId;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onTabChange(tab.id)}
              className={cn(
                "group relative inline-flex h-[26px] min-w-0 max-w-[148px] shrink-0 cursor-pointer items-center gap-1 border-0 px-2.5 pb-0.5 text-[11px] font-semibold leading-none text-white transition-colors",
                "rounded-tl-md rounded-tr-[10px]",
                active
                  ? "z-[2] bg-[#4a4a4a] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                  : "z-[1] bg-[#8f8f8f] hover:bg-[#7a7a7a]"
              )}
            >
              <Icon className="size-3 shrink-0 opacity-90" aria-hidden />
              <span className="truncate">{tab.label}</span>
              <span
                aria-hidden
                className={cn(
                  "pointer-events-none absolute -bottom-px left-0 right-0 h-px",
                  active ? "bg-[#4a4a4a]" : "bg-[#8f8f8f] group-hover:bg-[#7a7a7a]"
                )}
              />
            </button>
          );
        })}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-1 pb-0.5">{actions}</div>
      ) : null}
    </div>
  );
}
