// Renders every fixtures/parity/*.json with the React renderer into *.expected.html.
// Run after an intentional markup change: `pnpm --filter @strata/renderer parity:generate`.
// The Vitest parity test and the .NET Razor parity test both compare against these files.
import { writeFileSync } from "node:fs";
import { expectedPath, formatHtml, listFixtures, renderFixture } from "../parity/fixtures";

for (const { name, fixture } of listFixtures()) {
  writeFileSync(expectedPath(name), await formatHtml(renderFixture(fixture)));
  console.log(`wrote ${name}.expected.html`);
}
