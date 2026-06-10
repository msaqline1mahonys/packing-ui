"use client";

const PERMISSIONS_KEY = "packing-user-permissions-v1";

export function loadUserPermissions() {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(PERMISSIONS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export function saveUserPermissions(permissionsByUser) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PERMISSIONS_KEY, JSON.stringify(permissionsByUser || {}));
}
