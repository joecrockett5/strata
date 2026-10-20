import { type EditingAdapter, EditingAdapterContext, SectionView, SiteRoot } from "@strata/renderer";
import type { SectionDefinition, Theme } from "@strata/schema";
import { type ReactNode, useMemo } from "react";
import { imagePlaceholders } from "./placeholders";
import { sampleContext, sampleInstance } from "./sample";

/** Published markup with sample content (plus image placeholders), e.g. for previews and library cards. */
export function SectionPreview({
  definition,
  theme,
  sectionTypeId,
}: {
  definition: SectionDefinition;
  theme: Theme;
  sectionTypeId: string;
}) {
  const adapter = useMemo<EditingAdapter>(() => ({ image: imagePlaceholders(definition) }), [definition]);
  return (
    <EditingAdapterContext.Provider value={adapter}>
      <InertSite theme={theme}>
        <SectionView
          definition={definition}
          instance={sampleInstance(sectionTypeId)}
          context={sampleContext}
        />
      </InertSite>
    </EditingAdapterContext.Provider>
  );
}

/** Links and forms in a canvas must not navigate or submit. */
export function InertSite({ theme, children }: { theme: Theme; children: ReactNode }) {
  return (
    <div
      onClickCapture={(e) => {
        if ((e.target as Element).closest("a, button[type=submit]")) e.preventDefault();
      }}
      onSubmitCapture={(e) => {
        e.preventDefault();
      }}
    >
      <SiteRoot theme={theme}>{children}</SiteRoot>
    </div>
  );
}
