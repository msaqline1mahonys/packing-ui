export function stageBadgeClass(stage) {
  switch (stage) {
    case "Complete":
      return "bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200";
    case "PRA Passed":
      return "bg-lime-100 text-lime-800 ring-1 ring-lime-200";
    case "PRA Failed":
      return "bg-rose-100 text-rose-800 ring-1 ring-rose-200";
    case "PRA Submitted":
      return "bg-amber-100 text-amber-900 ring-1 ring-amber-200";
    case "Packing":
      return "bg-blue-100 text-blue-800 ring-1 ring-blue-200";
    default:
      return "bg-slate-100 text-slate-700 ring-1 ring-slate-200";
  }
}

export const CONTAINER_STAGE_OPTIONS = [
  "Draft",
  "Packing",
  "PRA Submitted",
  "PRA Passed",
  "PRA Failed",
];

export const ACTIVE_PACK_STATUSES = [
  "Pending",
  "Inprogress",
  "Awaiting Approval",
  "Pending Fumigation",
  "Approved",
];
