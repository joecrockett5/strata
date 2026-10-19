import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { listFixtures, type ParityFixture } from "../parity/fixtures";
import { type EditingAdapter, EditingAdapterContext } from "./adapter";
import { PageView } from "./PageView";
import { SectionView } from "./SectionView";
import { SiteRoot } from "./SiteRoot";

function render(fixture: ParityFixture, adapter?: EditingAdapter): string {
  const content =
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
  return renderToStaticMarkup(
    adapter ? (
      <EditingAdapterContext.Provider value={adapter}>{content}</EditingAdapterContext.Provider>
    ) : (
      content
    ),
  );
}

const fixtures = listFixtures();
const fixture = (name: string) => {
  const found = fixtures.find((f) => f.name === name);
  if (!found) throw new Error(`missing fixture ${name}`);
  return found.fixture;
};

describe("editing adapter", () => {
  it.each(fixtures)("an adapter with no hooks leaves $name exactly as published", ({ fixture }) => {
    expect(render(fixture, {})).toBe(render(fixture));
  });

  it("can replace text slots with inline editors and knows which slot is which", () => {
    const html = render(fixture("columns-in-repeater"), {
      text: ({ value, target }) => (
        <span data-editor={`${target.slotKey}${target.itemId ? `@${target.itemId}` : ""}`}>{value.text}</span>
      ),
    });

    expect(html).toContain('data-editor="title"');
    expect(html).toContain('data-editor="name@cccccccc-0000-4000-8000-000000000001"');
  });

  it("renders empty headings when an editor needs something to type into", () => {
    const withoutAdapter = render(fixture("text-primitives"));
    const withAdapter = render(fixture("text-primitives"), { text: ({ value }) => value.text || "[empty]" });

    expect(withoutAdapter).not.toContain("[empty]");
    expect(withAdapter).toContain("[empty]");
  });

  it("can decorate nodes, sections and repeater items", () => {
    const html = render(fixture("columns-in-repeater"), {
      decorateSection: ({ instance, element }) => <div data-section={instance.id}>{element}</div>,
      decorateNode: ({ path, element }) => <div data-path={path}>{element}</div>,
      repeaterItem: ({ index, count, element }) => <div data-item={`${index + 1}/${count}`}>{element}</div>,
      afterRepeater: ({ node }) => <button type="button">Add {node.itemLabel}</button>,
    });

    expect(html).toContain('data-section="aaaaaaaa-0000-4000-8000-000000000003"');
    expect(html).toContain('data-path="/root/children/1/children/0/columns/1/children/0"');
    expect(html).toContain('data-item="3/3"');
    expect(html).toContain("Add Item");
  });
});
