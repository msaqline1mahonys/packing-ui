/**
 * Match a temperature (°C) to a methodology dosage band.
 * Both min and max are inclusive. When a value sits on a shared boundary
 * (e.g. 15°C between 10–15 and 15–20), the band with the higher min wins.
 */
export function findDosageBandForTemp(ranges, rawTemp) {
  if (!Array.isArray(ranges) || ranges.length === 0) return null;
  if (rawTemp == null || String(rawTemp).trim() === "") return null;
  const t = Number(rawTemp);
  if (!Number.isFinite(t)) return null;

  let match = null;
  for (const range of ranges) {
    const min = Number(range.minTempC);
    const max = Number(range.maxTempC);
    if (!Number.isFinite(min) || !Number.isFinite(max)) continue;
    if (min <= t && t <= max) {
      if (!match || min >= Number(match.minTempC)) match = range;
    }
  }
  return match;
}
