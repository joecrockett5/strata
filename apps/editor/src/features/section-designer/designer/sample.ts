import type { RenderContext } from "@strata/renderer";
import type { SectionInstance } from "@strata/schema";

/** Stand-in site data so Nav and links render plausibly while designing. */
export const sampleContext: RenderContext = {
  site: {
    firmName: "Your Firm",
    logo: null,
    homeHref: "#",
    nav: ["Home", "About", "Services", "Contact"].map((title, i) => ({
      pageId: `sample-${String(i)}`,
      title,
      href: "#",
      current: i === 0,
    })),
  },
  pageHrefs: {},
  mediaBase: "/media/",
  formAction: "#",
  pageId: "sample-0",
};

/** An instance with no stored values: every slot renders its default (the designer's sample content). */
export function sampleInstance(sectionTypeId: string): SectionInstance {
  return { id: "preview", sectionTypeId, version: 1, lock: "none", hidden: false, values: {}, repeaters: {} };
}
