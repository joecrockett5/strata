import { readFileSync } from "node:fs";
import { Ajv2020 } from "ajv/dist/2020.js";
import { describe, expect, it } from "vitest";
import type { SectionDefinition, SiteDocument } from "../index";
import { effectiveValue, slotCatalog, walkDefinition } from "../index";

const read = (path: string): unknown => JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8"));

const schema = read("../../../../schema/strata-content.schema.json") as { $id: string };
const kitchenSink = read("../../../../fixtures/content/kitchen-sink.section.json") as SectionDefinition;
const siteDocument = read("../../../../fixtures/content/site.document.json") as SiteDocument;

const ajv = new Ajv2020({ allErrors: true, strict: false });
ajv.addSchema(schema);
const validate = (def: string, data: unknown) => {
  const fn = ajv.getSchema(`${schema.$id}#/$defs/${def}`);
  if (!fn) throw new Error(`Missing schema definition ${def}`);
  return { valid: fn(data), errors: fn.errors };
};

describe("content schema", () => {
  it("accepts the shared fixtures used by the .NET tests", () => {
    expect(validate("SectionDefinition", kitchenSink).valid).toBe(true);
    expect(validate("SiteDocument", siteDocument).valid).toBe(true);
  });

  it("rejects unknown primitives and unexpected properties", () => {
    const bad = structuredClone(kitchenSink) as unknown as { root: { children: Record<string, unknown>[] } };
    bad.root.children[0] = { $type: "marquee", id: "x" };
    expect(validate("SectionDefinition", bad).valid).toBe(false);

    const extra = structuredClone(siteDocument) as unknown as { pages: Record<string, unknown>[] };
    extra.pages[0] = { ...extra.pages[0], style: "color: red" };
    expect(validate("SiteDocument", extra).valid).toBe(false);
  });
});

describe("slotCatalog", () => {
  it("separates section slots from per-item repeater slots", () => {
    const catalog = slotCatalog(kitchenSink);

    expect([...catalog.slots.keys()].sort()).toEqual(
      ["background", "body", "ctaLabel", "ctaLink", "submitLabel", "successMessage", "title"].sort(),
    );
    expect([...catalog.repeaters.keys()]).toEqual(["cards"]);
    expect([...(catalog.repeaters.get("cards")?.slots.keys() ?? [])]).toEqual([
      "photo",
      "cardTitle",
      "cardBody",
    ]);
  });

  it("walks nested columns with JSON pointers", () => {
    const paths = [...walkDefinition(kitchenSink)].map((w) => w.path);
    expect(paths).toContain("/root/children/3/children/0/columns/1/children/1");
  });
});

describe("effectiveValue", () => {
  const catalog = slotCatalog(kitchenSink);

  it("uses the stored value for editable slots", () => {
    const slot = catalog.slots.get("title");
    if (slot?.type !== "text") throw new Error("expected a text slot");
    expect(effectiveValue(slot, { title: { $type: "text", text: "Mine" } })).toEqual({
      $type: "text",
      text: "Mine",
    });
    expect(effectiveValue(slot, {})).toEqual(slot.default);
  });

  it("always uses the designer's default for locked slots", () => {
    const slot = catalog.slots.get("successMessage");
    if (slot?.type !== "text") throw new Error("expected a text slot");
    expect(effectiveValue(slot, { successMessage: { $type: "text", text: "Hacked" } })).toEqual(slot.default);
  });
});
