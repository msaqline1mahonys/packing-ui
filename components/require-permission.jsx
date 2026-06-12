"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { useHasPermission } from "@/lib/use-user-permissions";

/**
 * Client-side route guard — redirects to `/` when the user lacks a permission.
 * Mirrors nav gating; API routes should enforce the same permission server-side.
 */
export function RequirePermission({ permission, children, redirectTo = "/" }) {
  const allowed = useHasPermission(permission);
  const router = useRouter();

  useEffect(() => {
    if (!allowed) {
      router.replace(redirectTo);
    }
  }, [allowed, redirectTo, router]);

  if (!allowed) {
    return null;
  }

  return children;
}
