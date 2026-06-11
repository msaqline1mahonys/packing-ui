"use client";

/**
 * Pure date helpers for the four scheduled cadences. Returns { from, to } as
 * inclusive ISO date strings (YYYY-MM-DD), since the upstream data stores dates
 * as plain ISO date strings.
 *
 * The UI-only phase computes windows in the browser's local time zone; the
 * backend spec covers proper site-timezone math.
 */

export const CADENCES = ["daily", "weekly", "monthly", "yearly"];

export const CADENCE_LABELS = {
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
  yearly: "Yearly",
};

export const CADENCE_DESCRIPTIONS = {
  daily: "Sends yesterday's data each morning at the site fire time.",
  weekly: "Sends last week's data (Mon-Sun) every Monday morning.",
  monthly: "Sends last calendar month's data on the 1st of each month.",
  yearly: "Sends last calendar year's data on January 1st.",
};

function toIsoDate(d) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function startOfDay(d) {
  const n = new Date(d);
  n.setHours(0, 0, 0, 0);
  return n;
}

function addDays(d, n) {
  const next = new Date(d);
  next.setDate(next.getDate() + n);
  return next;
}

/** Previous calendar day. */
export function previousDayWindow(now = new Date()) {
  const today = startOfDay(now);
  const yesterday = addDays(today, -1);
  return { from: toIsoDate(yesterday), to: toIsoDate(yesterday) };
}

/**
 * Previous Mon-Sun. ISO weekday: Mon=1..Sun=7.
 * Today is Mon -> previous Mon-Sun is the seven days before today.
 * Today is Wed -> previous Mon-Sun is the most recent completed week.
 */
export function previousWeekWindow(now = new Date()) {
  const today = startOfDay(now);
  const jsDow = today.getDay(); // Sun=0..Sat=6
  const isoDow = jsDow === 0 ? 7 : jsDow; // Mon=1..Sun=7
  const thisMonday = addDays(today, -(isoDow - 1));
  const prevMonday = addDays(thisMonday, -7);
  const prevSunday = addDays(prevMonday, 6);
  return { from: toIsoDate(prevMonday), to: toIsoDate(prevSunday) };
}

/** Previous calendar month. */
export function previousMonthWindow(now = new Date()) {
  const firstOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastOfPrev = addDays(firstOfThisMonth, -1);
  const firstOfPrev = new Date(lastOfPrev.getFullYear(), lastOfPrev.getMonth(), 1);
  return { from: toIsoDate(firstOfPrev), to: toIsoDate(lastOfPrev) };
}

/** Previous calendar year. */
export function previousYearWindow(now = new Date()) {
  const year = now.getFullYear() - 1;
  return { from: `${year}-01-01`, to: `${year}-12-31` };
}

export function windowForCadence(cadence, now = new Date()) {
  switch (cadence) {
    case "daily":
      return previousDayWindow(now);
    case "weekly":
      return previousWeekWindow(now);
    case "monthly":
      return previousMonthWindow(now);
    case "yearly":
      return previousYearWindow(now);
    default:
      return previousDayWindow(now);
  }
}

/**
 * Returns true when `now` has crossed into a new window for `cadence` since
 * `lastFiredAt` (also ISO). Used by the client-side simulator to decide
 * whether to surface a "would have fired" history entry.
 */
export function hasCadenceElapsed(cadence, lastFiredAt, now = new Date()) {
  if (!lastFiredAt) return true;
  const last = new Date(lastFiredAt);
  if (Number.isNaN(last.getTime())) return true;
  const win = windowForCadence(cadence, now);
  const lastWin = windowForCadence(cadence, last);
  return win.from !== lastWin.from || win.to !== lastWin.to;
}

/** Quick-pick presets for the ad-hoc builder. */
export function adHocPreset(key, now = new Date()) {
  const today = startOfDay(now);
  switch (key) {
    case "yesterday":
      return previousDayWindow(now);
    case "last7": {
      const start = addDays(today, -7);
      const end = addDays(today, -1);
      return { from: toIsoDate(start), to: toIsoDate(end) };
    }
    case "monthToDate": {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      return { from: toIsoDate(start), to: toIsoDate(today) };
    }
    case "lastMonth":
      return previousMonthWindow(now);
    case "yearToDate": {
      const start = new Date(today.getFullYear(), 0, 1);
      return { from: toIsoDate(start), to: toIsoDate(today) };
    }
    case "lastQuarter": {
      const currentQuarter = Math.floor(today.getMonth() / 3);
      const prevQuarterStart = currentQuarter === 0
        ? new Date(today.getFullYear() - 1, 9, 1)
        : new Date(today.getFullYear(), (currentQuarter - 1) * 3, 1);
      const prevQuarterEnd = currentQuarter === 0
        ? new Date(today.getFullYear() - 1, 11, 31)
        : new Date(today.getFullYear(), currentQuarter * 3, 0);
      return { from: toIsoDate(prevQuarterStart), to: toIsoDate(prevQuarterEnd) };
    }
    case "lastYear":
      return previousYearWindow(now);
    case "allTime":
      return { from: "2015-01-01", to: toIsoDate(today) };
    default:
      return null;
  }
}
