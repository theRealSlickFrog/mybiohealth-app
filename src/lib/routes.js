// URL ↔ page mapping for the /app portal.
//
// Page identity lives in the URL rather than in React state, so a reload keeps
// you where you were, Back and Forward move between pages, and a page can be
// linked to or bookmarked. Netlify already returns index.html for any non-asset
// path (netlify.toml), so a deep link reaches the app instead of 404ing.
//
// Slugs are derived from the NAV_ITEMS key rather than written out separately:
// a second hand-maintained list is a second thing to forget when adding a page,
// and the drawer has already shown what a silently-missing entry costs.

import { NAV_ITEMS } from './constants.js';

export const DEFAULT_PAGE = 'strategy';

const slugOf = (key) => key.replace(/_/g, '-');

const BY_SLUG = new Map(NAV_ITEMS.map((n) => [slugOf(n.key), n.key]));

const slugFromPath = (pathname) => {
  const m = pathname.match(/^\/app(?:\/([^/]*))?\/?$/);
  return m && m[1] ? m[1].toLowerCase() : null;
};

/** Canonical path for a page key, e.g. 'voice_test' -> '/app/voice-test'. */
export function pathForPage(key) {
  return `/app/${slugOf(key)}`;
}

/**
 * Page key for a URL. Falls back to the default page for a bare /app and for
 * any slug we don't recognise — a mistyped or retired link should land
 * somewhere usable rather than on a dead end.
 */
export function pageFromPath(pathname = window.location.pathname) {
  const slug = slugFromPath(pathname);
  if (!slug) return DEFAULT_PAGE;
  return BY_SLUG.get(slug) || DEFAULT_PAGE;
}

/** Whether the URL names a page that exists — false for an unknown slug. */
export function isKnownPath(pathname = window.location.pathname) {
  const slug = slugFromPath(pathname);
  return slug === null || BY_SLUG.has(slug);
}
