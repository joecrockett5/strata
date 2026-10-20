import { buildSiteInfo, pageHrefs, type RenderContext } from "@strata/renderer";
import type { SiteDocument } from "@strata/schema";

/** Page links in the canvas switch pages instead of navigating. */
export const pageLinkPrefix = "#stx-page=";

export function renderContextFor(site: SiteDocument, pageId: string): RenderContext {
  const hrefFor = (slug: string) => `${pageLinkPrefix}${slug}`;
  return {
    site: buildSiteInfo(site, pageId, hrefFor),
    pageHrefs: pageHrefs(site, hrefFor),
    mediaBase: "/media/",
    formAction: "#",
    pageId,
  };
}
