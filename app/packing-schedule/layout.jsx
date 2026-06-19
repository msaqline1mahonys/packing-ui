"use client";

import { usePathname } from "next/navigation";

import { PackingScheduleBubbleNav } from "@/components/packing-schedule-bubble-nav";

export default function PackingScheduleLayout({ children }) {
  const pathname = usePathname();
  const showSectionNav = !pathname.startsWith("/packing-schedule/new-pack-form");

  return (
    <div className="space-y-8">
      {showSectionNav ? (
        <div className="-mx-6 -mt-6 flex min-h-11 items-center border-b border-slate-200/85 bg-white/85 px-3 py-0 shadow-[inset_0_1px_0_rgba(0,112,255,0.06)] backdrop-blur-md md:-mx-10 md:-mt-10 md:min-h-[4.5rem] md:px-10 md:py-0">
          <PackingScheduleBubbleNav />
        </div>
      ) : null}

      <div className="mx-auto w-full max-w-[96rem] space-y-6">{children}</div>
    </div>
  );
}
