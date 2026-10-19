import { existsSync, readFileSync } from "node:fs";
import { Ajv2020 } from "ajv/dist/2020.js";
import { describe, expect, it } from "vitest";
import { expectedPath, formatHtml, listFixtures, renderFixture } from "../parity/fixtures";

const schema = JSON.parse(
  readFileSync(new URL("../../../schema/strata-content.schema.json", import.meta.url), "utf8"),
) as { $id: string };
const ajv = new Ajv2020({ allErrors: true, strict: false });
ajv.addSchema(schema);
const validator = (def: string) => {
  const fn = ajv.getSchema(`${schema.$id}#/$defs/${def}`);
  if (!fn) throw new Error(`missing ${def}`);
  return fn;
};

const fixtures = listFixtures();

describe("parity fixtures", () => {
  it("exist", () => {
    expect(fixtures.length).toBeGreaterThan(0);
  });

  it.each(fixtures)("$name is valid content", ({ fixture }) => {
    if (fixture.kind === "section") {
      expect(
        validator("SectionDefinition")(fixture.definition),
        JSON.stringify(validator("SectionDefinition").errors),
      ).toBe(true);
      expect(validator("SectionInstance")(fixture.instance)).toBe(true);
      expect(validator("Theme")(fixture.theme)).toBe(true);
    } else {
      expect(validator("SiteDocument")(fixture.document)).toBe(true);
      for (const definition of Object.values(fixture.definitions)) {
        expect(validator("SectionDefinition")(definition)).toBe(true);
      }
    }
  });

  // A failure here means the React markup changed. If intended, run `pnpm parity:generate`,
  // review the diff, and make the same change in the Razor renderer.
  it.each(fixtures)("$name matches the committed expected HTML", async ({ name, fixture }) => {
    expect(existsSync(expectedPath(name)), `missing ${name}.expected.html — run parity:generate`).toBe(true);
    const rendered = await formatHtml(renderFixture(fixture));
    expect(rendered).toBe(readFileSync(expectedPath(name), "utf8"));
  });
});
