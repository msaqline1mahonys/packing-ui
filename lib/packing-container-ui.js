export function stageBadgeClass(stage) {
  switch (stage) {
    case "Complete":
      return "bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200";
    case "PRA Passed":
      return "bg-lime-100 text-lime-800 ring-1 ring-lime-200";
    case "PRA Failed":
      return "bg-rose-100 text-rose-800 ring-1 ring-rose-200";
    case "EC Failed":
      return "bg-rose-100 text-rose-900 ring-1 ring-rose-300";
    case "PRA Submitted":
      return "bg-amber-100 text-amber-900 ring-1 ring-amber-200";
    case "Packing":
      return "bg-blue-100 text-blue-800 ring-1 ring-blue-200";
    case "On Site":
      return "bg-teal-100 text-teal-800 ring-1 ring-teal-200";
    case "Off Site":
      return "bg-slate-100 text-slate-600 ring-1 ring-slate-200";
    default:
      return "bg-slate-100 text-slate-700 ring-1 ring-slate-200";
  }
}

export const CONTAINER_STAGE_OPTIONS = [
  "Draft",
  "Off Site",
  "On Site",
  "Packing",
  "EC Failed",
  "PRA Submitted",
  "PRA Passed",
  "PRA Failed",
];

export const ACTIVE_PACK_STATUSES = [
  "Pending",
  "On Hold",
  "Inprogress",
  "Awaiting Approval",
  "Pending Fumigation",
  "Approved",
];

/** Pack statuses shown in the Packers Schedule queue. */
export const PACKERS_SCHEDULE_STATUSES = ["Pending", "On Hold", "Inprogress"];

/** Packers queue pack statuses that lock container fields once packer signoff is set. */
export const PACKERS_SIGNOFF_LOCKED_STATUSES = [...PACKERS_SCHEDULE_STATUSES];

export function isPackersContainerLockedAfterSignoff(packStatus, container, options = {}) {
  if (options.isDirty) return false;
  if (!PACKERS_SIGNOFF_LOCKED_STATUSES.includes(packStatus)) return false;
  if (!String(container?.packerSignoff ?? "").trim()) return false;
  if (String(container?.packerEditUnlockReason ?? "").trim()) return false;
  return true;
}
