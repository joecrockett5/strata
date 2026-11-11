import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";
import { accounts } from "../support/accounts";
import { DemoRecorder } from "../support/recorder";

// Records the README demo (docs/media/demo.gif) from the seeded content. Run with ./scripts/demo-gif.sh.
test.skip(!process.env.STRATA_DEMO, "Set STRATA_DEMO=1 (./scripts/demo-gif.sh) to record the README demo.");

const framesDir = fileURLToPath(new URL("../../.data/demo-frames", import.meta.url));

test("site owner edits and publishes the demo site", async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1680, height: 1000 });
  await page.goto("/login");
  const rec = new DemoRecorder(page, framesDir);
  await rec.start();
  await rec.pause(600);

  // Sign in as the site owner.
  await rec.click(page.getByLabel("Email"));
  await page.getByLabel("Email").pressSequentially(accounts.owner.email, { delay: 25 });
  await rec.click(page.getByLabel("Password"));
  await page.getByLabel("Password").pressSequentially(accounts.owner.password, { delay: 25 });
  await rec.click(page.getByRole("button", { name: "Sign in" }));
  await expect(page.getByTestId("current-user")).toHaveText(accounts.owner.displayName);
  await rec.pause(700);

  // Open the published demo site in the editor.
  await rec.click(page.getByRole("link", { name: "Harbor & Pine Wealth Partners" }));
  const canvas = page.frameLocator('[data-testid="canvas-frame"]');
  const headline = canvas.getByRole("textbox", { name: "Headline" });
  await expect(headline).toBeVisible();
  await rec.pause(900);

  // Edit the hero headline inline.
  await rec.click(headline, { x: 0.9, y: 0.5 });
  await headline.press("ControlOrMeta+a");
  await headline.pressSequentially("Financial clarity, for life", { delay: 55 });
  await rec.pause(700);

  // Drag a section from the library into the page, between the hero and the services grid.
  await rec.click(page.getByRole("tab", { name: "Add section" }));
  await rec.pause(500);
  const services = page.locator('[data-section-name="Services grid"]');
  await rec.drag(page.getByTestId("library-card-Call to action band"), services, 0.15);
  await expect
    .poll(() =>
      page.locator("[data-section-name]").evaluateAll((els) => els.map((e) => e.dataset.sectionName)),
    )
    .toEqual(expect.arrayContaining(["Call to action band"]));
  await rec.pause(900);

  // Theme: brand colours are locked by the template, the accent is not.
  await rec.click(page.getByRole("tab", { name: "Theme" }));
  await rec.pause(900);
  await rec.moveToLocator(page.getByTestId("token-colors.primary").getByLabel("Locked by the template"));
  await rec.pause(900);

  // Publish: checks run first, then the snapshot goes live.
  await expect(page.getByTestId("save-status")).toHaveAttribute("data-status", "saved");
  await rec.click(page.getByRole("button", { name: "Publish", exact: true }));
  await expect(page.getByTestId("publish-dialog")).toContainText("All checks passed.");
  await rec.pause(1200);
  await rec.click(page.getByRole("button", { name: "Publish now" }));
  await expect(page.getByTestId("publish-result")).toHaveText(/Published version \d+/);
  await rec.pause(1000);

  // The server-rendered public site shows the change.
  await rec.moveToLocator(page.getByTestId("public-url"));
  await rec.pause(300);
  await page.goto("/s/harbor-pine/");
  await rec.restoreCursor();
  await expect(page.locator("h1")).toHaveText("Financial clarity, for life");
  await rec.pause(1500);
  await page.mouse.wheel(0, 420);
  await rec.pause(1500);
  await rec.stop();
});
