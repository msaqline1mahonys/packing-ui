import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

/** Local date/time string for `<input type="datetime-local" />` (no timezone suffix). */
export function nowDatetimeLocal() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

/** Local date string for `<input type="date" />`. */
export function nowDatetimeLocalDate() {
  return nowDatetimeLocal().slice(0, 10);
}
