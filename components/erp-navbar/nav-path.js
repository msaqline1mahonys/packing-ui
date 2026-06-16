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

function hasMoreSpecificSibling(pathname, href, siblingHrefs = []) {
  return siblingHrefs.some((sibling) => {
    if (!sibling || sibling === href || sibling.length <= href.length) return false;
    return pathname === sibling || pathname.startsWith(`${sibling}/`);
  });
}

/**
 * Section landing child (e.g. Packs at `/packing-schedule` with sibling `/packing-schedule/containers`).
 * Only the exact path is active — not deeper routes like `/packing-schedule/new-pack-form`.
 */
function isSectionLandingChild(href, siblingHrefs = []) {
  return siblingHrefs.some((sibling) => sibling !== href && sibling.startsWith(`${href}/`));
}

/**
 * Active state for a child nav item among siblings (e.g. Packs vs Containers).
 * Prefix matching applies unless a more specific sibling also matches.
 */
export function pathnameMatchesNavChild(pathname, href, siblingHrefs = []) {
  if (href === "/") return pathname === "/";
  if (pathname === href) return true;
  if (isSectionLandingChild(href, siblingHrefs)) return false;
  if (!pathname.startsWith(`${href}/`)) return false;

  return !hasMoreSpecificSibling(pathname, href, siblingHrefs);
}

/**
 * Client nav for ERP child links. Avoids duplicate history entries when the target is
 * already active, and uses replace when leaving a sibling/deep route in the same section.
 */
export function navigateNavHref(router, pathname, href, { siblingHrefs = [] } = {}) {
  if (pathname === href) return;

  const withinSection =
    pathname.startsWith(`${href}/`) || hasMoreSpecificSibling(pathname, href, siblingHrefs);

  if (withinSection) {
    router.replace(href);
    return;
  }

  router.push(href);
}
