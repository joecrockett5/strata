import { type SectionDefinition, type SectionInstance, type SiteDocument, versionKey } from "@strata/schema";
import type { ReactNode } from "react";
import type { RenderContext } from "./context";
import { SectionView } from "./SectionView";
import { SiteRoot } from "./SiteRoot";

export interface PageViewProps {
  document: SiteDocument;
  pageId: string;
  /** Section definitions keyed by `typeId@version`. */
  definitions: Readonly<Record<string, SectionDefinition | undefined>>;
  context: RenderContext;
  /** Editor only: render hidden sections too (the adapter marks them). */
  includeHidden?: boolean;
}

/** A whole page: skip link, global header, main content, global footer. Mirrors PageView.razor. */
export function PageView({ document, pageId, definitions, context, includeHidden = false }: PageViewProps) {
  const page = document.pages.find((p) => p.id === pageId);
  const render = (instance: SectionInstance | null): ReactNode => {
    if (!instance || (instance.hidden && !includeHidden)) return null;
    const definition = definitions[versionKey(instance)];
    return definition ? (
      <SectionView key={instance.id} definition={definition} instance={instance} context={context} />
    ) : null;
  };

  const header = render(document.header);
  const footer = render(document.footer);

  return (
    <SiteRoot theme={document.theme}>
      <a className="st-skip-link" href="#main">
        Skip to content
      </a>
      {header ? <header className="st-site-header">{header}</header> : null}
      <main id="main" className="st-main" tabIndex={-1}>
        {page?.sections.map(render)}
      </main>
      {footer ? <footer className="st-site-footer">{footer}</footer> : null}
    </SiteRoot>
  );
}
