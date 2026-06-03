"use client";

import { useErpNavUi } from "./nav-ui-context";

export function AccountDropdownHeader() {
  const ui = useErpNavUi();
  const workspace =
    [ui.organizationName, ui.siteName].filter(Boolean).join(" · ") || null;

  return (
    <div className="mb-1 border-b border-slate-100 px-2 py-2.5">
      <span className="block truncate text-sm font-medium text-slate-900">{ui.userName}</span>
      {ui.userEmail ? (
        <span className="mt-0.5 block truncate text-xs text-slate-500">{ui.userEmail}</span>
      ) : null}
      {workspace ? (
        <span className="mt-1 block truncate text-[11px] text-slate-400">{workspace}</span>
      ) : null}
    </div>
  );
}
