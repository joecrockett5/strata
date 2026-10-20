import type { SectionDefinition, SectionInstance, SiteDocument } from "@strata/schema";
import { produce } from "immer";
import { describe, expect, it } from "vitest";
import {
  addPage,
  addRepeaterItem,
  canDeletePage,
  duplicatePage,
  duplicateSection,
  isTokenLocked,
  moveRepeaterItem,
  moveSection,
  moveSectionBy,
  movePage,
  removeRepeaterItem,
  removeSection,
  sectionPermissions,
  setSlotValue,
  slotEditable,
  slugify,
  uniqueSlug,
} from "./siteModel";

function counter() {
  let n = 0;
  return () => `id-${String(++n)}`;
}

const definition: SectionDefinition = {
  schemaVersion: 1,
  root: {
    $type: "section",
    id: "root",
    background: "background",
    paddingY: "lg",
    width: "standard",
    children: [
      {
        $type: "heading",
        id: "h",
        level: 2,
        align: "start",
        text: {
          key: "title",
          label: "Title",
          type: "text",
          mode: "editable",
          required: false,
          default: { $type: "text", text: "T" },
        },
      },
      {
        $type: "repeater",
        id: "r",
        key: "items",
        itemLabel: "Item",
        min: 1,
        max: 3,
        defaultItemCount: 2,
        layout: "stack",
        gap: "md",
        children: [
          {
            $type: "heading",
            id: "ih",
            level: 3,
            align: "start",
            text: {
              key: "name",
              label: "Name",
              type: "text",
              mode: "editable",
              required: false,
              default: { $type: "text", text: "N" },
            },
          },
        ],
      },
    ],
  },
};

const instance = (id: string, lock: SectionInstance["lock"] = "none"): SectionInstance => ({
  id,
  sectionTypeId: "type",
  version: 1,
  lock,
  hidden: false,
  values: {},
  repeaters: {},
});

function site(): SiteDocument {
  return {
    schemaVersion: 1,
    settings: { firmName: "Firm", logo: null },
    theme: {
      colors: {
        primary: "#000000",
        onPrimary: "#ffffff",
        secondary: "#111111",
        accent: "#222222",
        background: "#ffffff",
        surface: "#eeeeee",
        text: "#000000",
        mutedText: "#555555",
      },
      fonts: { heading: "system-ui", body: "system-ui" },
      radius: "small",
    },
    themeLocks: ["colors.primary"],
    header: instance("header", "required"),
    footer: instance("footer", "locked"),
    pages: [
      {
        id: "home",
        title: "Home",
        slug: "",
        showInNav: true,
        seo: { title: "", description: "" },
        sections: [instance("a"), instance("b", "required"), instance("c", "locked")],
      },
      {
        id: "about",
        title: "About",
        slug: "about",
        showInNav: true,
        seo: { title: "", description: "" },
        sections: [instance("d")],
      },
    ],
  };
}

const order = (doc: SiteDocument, page = 0) => doc.pages[page]?.sections.map((s) => s.id);

describe("permissions mirror the server lock rules", () => {
  it("restricts owners by section lock and leaves designers free", () => {
    expect(sectionPermissions(instance("x", "locked"), "owner")).toEqual({
      edit: false,
      move: false,
      remove: false,
      hide: false,
      duplicate: false,
    });
    expect(sectionPermissions(instance("x", "required"), "owner")).toEqual({
      edit: true,
      move: true,
      remove: false,
      hide: false,
      duplicate: true,
    });
    expect(sectionPermissions(instance("x"), "owner")).toEqual({
      edit: true,
      move: true,
      remove: true,
      hide: true,
      duplicate: true,
    });
    expect(sectionPermissions(instance("x", "locked"), "designer").edit).toBe(true);
  });

  it("never lets anyone edit a locked slot", () => {
    const locked = {
      key: "k",
      label: "K",
      type: "text",
      mode: "locked",
      required: false,
      default: { $type: "text", text: "" },
    } as const;
    expect(slotEditable(locked, instance("x"), "designer")).toBe(false);
    expect(slotEditable({ ...locked, mode: "editable" }, instance("x", "locked"), "owner")).toBe(false);
    expect(slotEditable({ ...locked, mode: "editable" }, instance("x", "locked"), "designer")).toBe(true);
  });

  it("protects the home page and pages with locked or required sections", () => {
    const doc = site();
    expect(canDeletePage(doc, "home", "designer")).toBe(false);
    expect(canDeletePage(doc, "about", "owner")).toBe(true);
    const withRequired = produce(doc, (d) => {
      const about = d.pages[1]?.sections[0];
      if (about) about.lock = "required";
    });
    expect(canDeletePage(withRequired, "about", "owner")).toBe(false);
    expect(canDeletePage(withRequired, "about", "designer")).toBe(true);
  });

  it("locks theme tokens for owners only", () => {
    expect(isTokenLocked(site(), "colors.primary", "owner")).toBe(true);
    expect(isTokenLocked(site(), "colors.primary", "designer")).toBe(false);
    expect(isTokenLocked(site(), "colors.accent", "owner")).toBe(false);
  });
});

describe("sections", () => {
  it("moves with drop-indicator semantics and by one step", () => {
    expect(order(produce(site(), (d) => void moveSection(d, "a", 3)))).toEqual(["b", "c", "a"]);
    expect(order(produce(site(), (d) => void moveSection(d, "c", 0)))).toEqual(["c", "a", "b"]);
    expect(order(produce(site(), (d) => void moveSectionBy(d, "b", 1)))).toEqual(["a", "c", "b"]);
    expect(order(produce(site(), (d) => void moveSectionBy(d, "a", -1)))).toEqual(["a", "b", "c"]);
  });

  it("duplicates without copying the lock flag", () => {
    const doc = produce(site(), (d) => void duplicateSection(d, "b", counter()));
    expect(order(doc)).toEqual(["a", "b", "id-1", "c"]);
    expect(doc.pages[0].sections[2]?.lock).toBe("none");
  });

  it("removes global and page sections", () => {
    const doc = produce(site(), (d) => {
      removeSection(d, "header");
      removeSection(d, "a");
    });
    expect(doc.header).toBeNull();
    expect(order(doc)).toEqual(["b", "c"]);
  });
});

describe("slot values and repeater items", () => {
  it("stores top-level values on the instance", () => {
    const doc = produce(
      site(),
      (d) =>
        void setSlotValue(
          d,
          definition,
          { instanceId: "a", slotKey: "title" },
          { $type: "text", text: "Hi" },
          counter(),
        ),
    );
    expect(doc.pages[0].sections[0]?.values.title).toEqual({ $type: "text", text: "Hi" });
  });

  it("materialises default items when one of them is edited", () => {
    const doc = produce(
      site(),
      (d) =>
        void setSlotValue(
          d,
          definition,
          { instanceId: "a", slotKey: "name", repeaterKey: "items", itemId: "default-1" },
          { $type: "text", text: "Second" },
          counter(),
        ),
    );
    expect(doc.pages[0].sections[0]?.repeaters.items).toEqual([
      { id: "id-1", values: {} },
      { id: "id-2", values: { name: { $type: "text", text: "Second" } } },
    ]);
  });

  it("adds, moves and removes items within min and max", () => {
    const ids = counter();
    let doc = produce(site(), (d) => void addRepeaterItem(d, definition, "a", "items", ids));
    expect(doc.pages[0].sections[0]?.repeaters.items?.map((i) => i.id)).toEqual(["id-1", "id-2", "id-3"]);
    doc = produce(doc, (d) => void addRepeaterItem(d, definition, "a", "items", ids)); // max 3
    expect(doc.pages[0].sections[0]?.repeaters.items).toHaveLength(3);
    doc = produce(doc, (d) => void moveRepeaterItem(d, definition, "a", "items", "id-3", -1, ids));
    expect(doc.pages[0].sections[0]?.repeaters.items?.map((i) => i.id)).toEqual(["id-1", "id-3", "id-2"]);
    doc = produce(doc, (d) => {
      removeRepeaterItem(d, definition, "a", "items", "id-1", ids);
      removeRepeaterItem(d, definition, "a", "items", "id-3", ids);
      removeRepeaterItem(d, definition, "a", "items", "id-2", ids); // min 1
    });
    expect(doc.pages[0].sections[0]?.repeaters.items?.map((i) => i.id)).toEqual(["id-2"]);
  });
});

describe("pages", () => {
  it("slugifies titles and keeps slugs unique", () => {
    expect(slugify("  Our Services & Fees ")).toBe("our-services-fees");
    expect(slugify("Café Société")).toBe("cafe-societe");
    expect(uniqueSlug(site(), "about")).toBe("about-2");
    expect(uniqueSlug(site(), "about", "about")).toBe("about");
  });

  it("adds, duplicates and reorders pages", () => {
    const ids = counter();
    let doc = produce(site(), (d) => void addPage(d, "Contact us", ids));
    expect(doc.pages.at(-1)).toMatchObject({ id: "id-1", slug: "contact-us", showInNav: true });
    doc = produce(doc, (d) => void duplicatePage(d, "home", ids));
    expect(doc.pages[1]).toMatchObject({ title: "Home (copy)", slug: "home" });
    expect(doc.pages[1]?.sections.map((s) => s.lock)).toEqual(["none", "none", "none"]);
    doc = produce(doc, (d) => void movePage(d, "id-1", 0));
    expect(doc.pages.map((p) => p.id)[0]).toBe("id-1");
  });
});
