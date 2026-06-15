/**
 * True when the current pathname is this nav href or nested under it
 * (e.g. `/reference-data/countries` matches `/reference-data`).
 * `/` only matches exactly so the whole app is not treated as Overview.
 */
export function pathnameMatchesHref(pathname, href) {
  if (href === "/") return pathname === "/";
  if (pathname === href) return true;
  return pathname.startsWith(`${href}/`);
}

/**
 * Active state for a child nav item among siblings (e.g. Packs vs Containers).
 * Prefix matching applies unless a more specific sibling also matches.
 */
export function pathnameMatchesNavChild(pathname, href, siblingHrefs = []) {
  if (href === "/") return pathname === "/";
  if (pathname === href) return true;
  if (!pathname.startsWith(`${href}/`)) return false;

  return !siblingHrefs.some((sibling) => {
    if (!sibling || sibling === href || sibling.length <= href.length) return false;
    return pathname === sibling || pathname.startsWith(`${sibling}/`);
  });
}
