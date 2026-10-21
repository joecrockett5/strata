import { fileURLToPath } from "node:url";
import { expect, type Page, test } from "@playwright/test";
import { accounts } from "../support/accounts";
import { login } from "../support/auth";

// Captures the README screenshots from the seeded demo content. Run with ./scripts/screenshots.sh.
test.skip(
  !process.env.STRATA_SCREENSHOTS,
  "Set STRATA_SCREENSHOTS=1 (./scripts/screenshots.sh) to capture README screenshots.",
);

const out = (name: string) => fileURLToPath(new URL(`../../docs/screenshots/${name}.png`, import.meta.url));
// Wide enough for the 1280 px desktop canvas next to the editor panels.
const editorViewport = { width: 1680, height: 1000 };
const settle = (page: Page) => page.waitForTimeout(400); // let iframes measure and fonts settle

test("public site", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/s/harbor-pine/");
  await expect(page.locator("h1")).toBeVisible();
  await page.screenshot({ path: out("public-site") });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/s/harbor-pine/about");
  // Portraits are lazy-loaded: bring the first into view and wait until it has decoded.
  const portrait = page.getByRole("img", { name: "Portrait of Maren Holt" });
  await portrait.scrollIntoViewIfNeeded();
  await expect(portrait).toHaveJSProperty("complete", true);
  await page.getByRole("heading", { name: "Meet the team" }).evaluate((el) => {
    el.scrollIntoView({ block: "start" });
  });
  await settle(page);
  await page.screenshot({ path: out("public-site-mobile") });
});

test("site editor", async ({ page }) => {
  await page.setViewportSize(editorViewport);
  await login(page, accounts.owner);
  await page.getByRole("link", { name: "Harbor & Pine Wealth Partners" }).click();
  const canvas = page.frameLocator('[data-testid="canvas-frame"]');
  await canvas.getByRole("textbox", { name: "Headline" }).click();
  await settle(page);
  await page.screenshot({ path: out("site-editor") });

  await page.getByRole("tab", { name: "Theme" }).click();
  await settle(page);
  await page.screenshot({ path: out("site-editor-theme-locks") });

  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await expect(page.getByTestId("publish-dialog")).toContainText("All checks passed.");
  await page.screenshot({ path: out("publish-checks") });
});

test("section designer", async ({ page }) => {
  await page.setViewportSize(editorViewport);
  await login(page, accounts.designer);
  await page.getByRole("link", { name: "Team bios" }).click();
  await page.getByTestId("outline-row-r").click();
  await settle(page);
  await page.screenshot({ path: out("section-designer") });

  await page.getByRole("link", { name: "Sections" }).click();
  await page.screenshot({ path: out("section-library") });
});
