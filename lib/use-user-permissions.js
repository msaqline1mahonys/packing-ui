"use client";

import { useEffect, useState } from "react";
import { readAuthPayload } from "@/lib/auth-session";
import { loadUserPermissions } from "@/lib/user-permissions-store";

function slugify(text) {
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function getCurrentUserId() {
  const payload = readAuthPayload();
  return payload?.user?.id ?? null;
}

export function useCurrentUserPermissions() {
  const [permissions, setPermissions] = useState(null);

  useEffect(() => {
    function sync() {
      const userId = getCurrentUserId();
      if (!userId) {
        setPermissions(null);
        return;
      }
      const allPerms = loadUserPermissions();
      if (!(userId in allPerms)) {
        setPermissions(null);
        return;
      }
      setPermissions(allPerms[userId] || []);
    }
    sync();
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);

  return permissions;
}

export function filterModulesByPermissions(modules, permissions) {
  if (permissions === null) return modules;

  const permSet = new Set(permissions);

  return modules
    .filter((mod) => {
      const moduleId = `module:${slugify(mod.name)}`;
      return permSet.has(moduleId);
    })
    .map((mod) => {
      if (!mod.children?.length) return mod;

      const parentSlug = slugify(mod.name);
      const filteredChildren = mod.children.filter((child) => {
        const childId = `module:${parentSlug}:${slugify(child.name)}`;
        return permSet.has(childId);
      });

      return { ...mod, children: filteredChildren };
    });
}
