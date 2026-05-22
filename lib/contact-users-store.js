"use client";

import { CONTACT_USER_ROWS } from "@/lib/Data";
import { normalizeUserWithClassifications } from "@/lib/user-classifications";

const CONTACT_USERS_KEY = "packing-contact-users-v1";

function normalizeUser(user) {
  return normalizeUserWithClassifications({
    ...user,
    aoNumber: String(user?.aoNumber || "").trim(),
  });
}

export function loadContactUsers() {
  if (typeof window === "undefined") return CONTACT_USER_ROWS.map(normalizeUser);
  try {
    const raw = window.localStorage.getItem(CONTACT_USERS_KEY);
    if (!raw) return CONTACT_USER_ROWS.map(normalizeUser);
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(normalizeUser) : CONTACT_USER_ROWS.map(normalizeUser);
  } catch {
    return CONTACT_USER_ROWS.map(normalizeUser);
  }
}

export function saveContactUsers(rows) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CONTACT_USERS_KEY, JSON.stringify((rows || []).map(normalizeUser)));
}
