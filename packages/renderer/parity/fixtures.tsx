// Parity fixtures: one JSON input rendered by both the React renderer (this file) and the Razor
// renderer (Strata.Rendering.Tests). The React output is committed as *.expected.html.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { SectionDefinition, SectionInstance, SiteDocument, Theme } from "@strata/schema";
import { format } from "prettier";
import { renderToStaticMarkup } from "react-dom/server";
import { PageView, type RenderContext, SectionView, SiteRoot } from "../src";

export const parityDir = new URL("../../../fixtures/parity/", import.meta.url).pathname;

export type ParityFixture =
  | {
      kind: "section";
      description: string;
      theme: Theme;
      context: RenderContext;
      definition: SectionDefinition;
      instance: SectionInstance;
    }
  | {
      kind: "page";
      description: string;
      context: RenderContext;
      document: SiteDocument;
      pageId: string;
      definitions: Record<string, SectionDefinition>;
    };

export function listFixtures(): { name: string; fixture: ParityFixture }[] {
  return readdirSync(parityDir)
    .filter((file) => file.endsWith(".json"))
    .sort()
    .map((file) => ({
      name: file.replace(/\.json$/, ""),
      fixture: JSON.parse(readFileSync(join(parityDir, file), "utf8")) as ParityFixture,
    }));
}

export function expectedPath(name: string): string {
  return join(parityDir, `${name}.expected.html`);
}

/** Renders a fixture with the published (adapter-free) React renderer. */
export function renderFixture(fixture: ParityFixture): string {
  const element =
    fixture.kind === "section" ? (
      <SiteRoot theme={fixture.theme}>
        <SectionView definition={fixture.definition} instance={fixture.instance} context={fixture.context} />
      </SiteRoot>
    ) : (
      <PageView
        document={fixture.document}
        pageId={fixture.pageId}
        definitions={fixture.definitions}
        context={fixture.context}
      />
    );
  return stripHoistedResourceHints(renderToStaticMarkup(element));
}

/**
 * React 19's server renderer hoists `<link rel="preload" as="image">` hints for eager images to the
 * front of the output. They are resource hints, not component markup (a client render puts them
 * in <head>), so they are not part of the published-markup contract.
 */
function stripHoistedResourceHints(html: string): string {
  return html.replace(/^(?:<link\b[^>]*\brel="preload"[^>]*\/?>)+/, "");
}

/** Formats HTML for readable, reviewable snapshots. The .NET side compares after normalisation. */
export function formatHtml(html: string): Promise<string> {
  return format(html, { parser: "html", printWidth: 110, htmlWhitespaceSensitivity: "css" });
}
