"use client";

import { usePathname } from "next/navigation";

import { TicketingBubbleNav } from "@/components/ticketing-bubble-nav";

function isPrintRoute(pathname) {
  return /\/ticketing\/(?:in|outgoing)\/[^/]+\/print\/?$/.test(pathname ?? "");
}

export default function TicketingLayout({ children }) {
  const pathname = usePathname();

  if (isPrintRoute(pathname)) {
    return <>{children}</>;
  }

  return (
    <div className="space-y-8">
      <div className="-mx-6 -mt-6 flex min-h-11 items-center border-b border-slate-200/85 bg-white/85 px-6 py-0 shadow-[inset_0_1px_0_rgba(0,112,255,0.06)] backdrop-blur-md md:-mx-10 md:-mt-10 md:min-h-[4.5rem] md:px-10 md:py-0">
        <TicketingBubbleNav />
      </div>

      <div className="mx-auto w-full max-w-[96rem] space-y-6">{children}</div>
    </div>
  );
}
