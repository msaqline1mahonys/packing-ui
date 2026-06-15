"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";

/**
 * Route-level error boundary for the packers-schedule pack detail page.
 * Surfaces the thrown error on screen (instead of a blank crash) so the
 * failing component and message are visible and copyable.
 */
export default function PackersPackDetailError({ error, reset }) {
  useEffect(() => {
    // Also log to the console so the full stack is available in DevTools.
    console.error("[packers-schedule/[id]] render error:", error);
  }, [error]);

  return (
    <div className="space-y-4 p-4">
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
        <h2 className="text-sm font-semibold text-rose-800">
          This pack failed to open.
        </h2>
        <p className="mt-1 text-sm font-medium text-rose-700">
          {error?.message || "Unknown error"}
        </p>
        {error?.digest ? (
          <p className="mt-1 text-xs text-rose-600">digest: {error.digest}</p>
        ) : null}
        {error?.stack ? (
          <pre className="mt-3 max-h-[320px] overflow-auto whitespace-pre-wrap rounded-md border border-rose-200 bg-white p-3 text-[11px] leading-snug text-rose-900">
            {error.stack}
          </pre>
        ) : null}
      </div>
      <div className="flex gap-2">
        <Button type="button" onClick={() => reset()}>
          Try again
        </Button>
      </div>
    </div>
  );
}
