import type { SiteDocument } from "@strata/schema";
import type { NavLink, SiteInfo } from "./context";

/** Builds navigation from the pages panel. Mirrors `Navigation.Build` in Strata.Rendering. */
export function buildSiteInfo(
  document: SiteDocument,
  currentPageId: string,
  hrefFor: (slug: string) => string,
): SiteInfo {
  const nav: NavLink[] = document.pages
    .filter((page) => page.showInNav)
    .map((page) => ({
      pageId: page.id,
      title: page.title,
      href: hrefFor(page.slug),
      current: page.id === currentPageId,
    }));
  return { firmName: document.settings.firmName, logo: document.settings.logo, homeHref: hrefFor(""), nav };
}

/** href for every page, for resolving internal links. */
export function pageHrefs(document: SiteDocument, hrefFor: (slug: string) => string): Record<string, string> {
  return Object.fromEntries(document.pages.map((page) => [page.id, hrefFor(page.slug)]));
}
