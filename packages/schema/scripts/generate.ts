// Generates src/generated.ts from /schema/strata-content.schema.json (the single source of truth).
// Run with `pnpm --filter @strata/schema gen`; CI fails if the committed output is stale.
import { readFile, writeFile } from "node:fs/promises";
import { compile, type JSONSchema } from "json-schema-to-typescript";

const schemaPath = new URL("../../../schema/strata-content.schema.json", import.meta.url);
const outputPath = new URL("../src/generated.ts", import.meta.url);

const schema = JSON.parse(await readFile(schemaPath, "utf8")) as JSONSchema;

const ts = await compile(schema, "StrataContent", {
  bannerComment:
    "/* eslint-disable */\n/**\n * GENERATED from schema/strata-content.schema.json — do not edit by hand.\n * Regenerate with `pnpm --filter @strata/schema gen`.\n */",
  unreachableDefinitions: true,
  additionalProperties: false,
  strictIndexSignatures: true,
  enableConstEnums: false,
  format: true,
  style: { printWidth: 110, singleQuote: false, trailingComma: "all" },
});

await writeFile(outputPath, ts);
console.log(`Wrote ${outputPath.pathname}`);
