"use client";

import { useEffect, useState } from "react";
import { readAuthPayload } from "@/lib/auth-session";

export { slugify };

function slugify(text) {
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * User types that always see everything, regardless of their permission list.
 * Mirrors the backend: system users + the organization admin (org creator).
 * These users hold ALL permissions server-side, so the UI must not gate them.
 */
const SHOW_ALL_USER_TYPES = new Set(["super_admin", "developer", "support", "admin"]);

/**
 * Read the flat permissions array from the cached authPayload.
 * Returns the array, or null when access should not be filtered.
 *
 * null = "show all". Returned when:
 *  - there is no payload / no permissions array (unconfigured fallback), OR
 *  - the user is an admin / system user (org creator etc.) who sees everything.
 */
function readPermissionsFromPayload() {
  const payload = readAuthPayload();
  if (!payload) return null;

  const userType = payload.user?.user_type ?? payload.user?.userType;
  if (userType && SHOW_ALL_USER_TYPES.has(String(userType))) return null;

  const perms = payload.permissions;
  if (!Array.isArray(perms)) return null;
  return perms;
}

/**
 * Plain (non-hook) helper. Returns true if the current user has the given
 * permission string, OR if permissions are missing/not-an-array (admin fallback).
 */
export function hasPermission(perm) {
  const perms = readPermissionsFromPayload();
  if (perms === null) return true; // admin / unconfigured fallback
  return perms.includes(perm);
}

/**
 * React hook version of hasPermission. Re-evaluates on storage changes so
 * nav and gated controls update when the user logs in/out.
 */
export function useHasPermission(perm) {
  const [allowed, setAllowed] = useState(() => hasPermission(perm));

  useEffect(() => {
    function sync() {
      setAllowed(hasPermission(perm));
    }
    window.addEventListener("storage", sync);
    window.addEventListener("auth-session-changed", sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("auth-session-changed", sync);
    };
  }, [perm]);

  return allowed;
}

/**
 * Hook that returns the current user's permissions array from authPayload,
 * or null if absent (null = admin / show-all fallback).
 * Re-evaluates on storage / auth-session-changed events.
 */
export function useCurrentUserPermissions() {
  const [permissions, setPermissions] = useState(() => readPermissionsFromPayload());

  useEffect(() => {
    function sync() {
      setPermissions(readPermissionsFromPayload());
    }
    window.addEventListener("storage", sync);
    window.addEventListener("auth-session-changed", sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("auth-session-changed", sync);
    };
  }, []);

  return permissions;
}

/**
 * Filter nav modules by permissions.
 *
 * - permissions === null  → return modules unchanged (admin / no perms configured).
 * - A node without a `permission` field is always visible.
 * - A node with a `permission` field is visible only when that string is in the set.
 * - A parent is kept when it is itself visible AND (has no children OR ≥1 visible child).
 */
export function filterModulesByPermissions(modules, permissions) {
  if (permissions === null) return modules;

  const permSet = new Set(permissions);

  function isNodeVisible(node) {
    if (!node.permission) return true;
    return permSet.has(node.permission);
  }

  return modules
    .map((mod) => {
      if (!mod.children?.length) {
        return isNodeVisible(mod) ? mod : null;
      }

      // Parent with children: filter children first, then decide parent visibility
      const visibleChildren = mod.children.filter(isNodeVisible);
      if (!isNodeVisible(mod)) return null;
      if (visibleChildren.length === 0) return null;
      return { ...mod, children: visibleChildren };
    })
    .filter(Boolean);
}
