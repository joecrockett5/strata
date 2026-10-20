import { expect, test } from "@playwright/test";
import { accounts } from "../support/accounts";
import { login } from "../support/auth";

// The e2e database is created fresh for every run and the API seeds it on startup, exactly like
// a fresh `make dev`.

test("the seeded demo site is live at its public URL", async ({ page }, testInfo) => {
  await page.goto("/s/harbor-pine/");
  await expect(page).toHaveTitle("Harbor & Pine Wealth Partners | Independent financial advice");
  await expect(page.locator("h1")).toHaveText("Plan with confidence");
  await expect(page.locator(".st-site-footer")).toContainText("Investing involves risk");
  await expect(page.getByRole("img", { name: "Harbor & Pine Wealth Partners logo" })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("demo-home-1280.png"), fullPage: true });

  // Navigation is generated from the pages panel.
  const nav = page.getByRole("navigation");
  await nav.getByRole("link", { name: "About" }).click();
  await expect(page).toHaveURL(/\/s\/harbor-pine\/about$/);
  await expect(page.getByRole("heading", { name: "Meet the team" })).toBeVisible();
  await expect(page.getByRole("img", { name: "Portrait of Maren Holt" })).toBeVisible();
  await nav.getByRole("link", { name: "Services" }).click();
  await expect(page.getByRole("heading", { name: "Frequently asked questions" })).toBeVisible();
  await nav.getByRole("link", { name: "Contact" }).click();
  await expect(page.getByRole("button", { name: "Send message" })).toBeVisible();

  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto("/s/harbor-pine/");
  await page.screenshot({ path: testInfo.outputPath("demo-home-375.png"), fullPage: true });

  // Also on its own host.
  const hostRouted = await page.request.get("http://harbor-pine.localhost:5081/about");
  expect(await hostRouted.text()).toContain("Meet the team");
});

test("the seeded template is usable end to end", async ({ page }, testInfo) => {
  await login(page, accounts.owner);
  await expect(
    page.getByTestId("site-card").filter({ hasText: "Harbor & Pine Wealth Partners" }),
  ).toContainText("Published");

  await page.getByRole("link", { name: "New site" }).click();
  await page.getByTestId("template-Harbor & Pine Advisor").click();
  const slug = `pine-${String(Date.now())}`;
  await page.getByLabel("Site name").fill("Cedar Cove Advisors");
  await page.getByLabel("Address").fill(slug);
  await page.getByRole("button", { name: "Create site" }).click();
  await expect(page).toHaveURL(/\/sites\/[0-9a-f-]+$/);

  const canvas = page.frameLocator('[data-testid="canvas-frame"]');
  const headline = canvas.getByRole("textbox", { name: "Headline" });
  await headline.click();
  await headline.press("ControlOrMeta+a");
  await headline.pressSequentially("Clear advice for Cedar Cove");
  await page.getByRole("tab", { name: "Settings" }).click();
  await page.getByLabel("Firm name").fill("Cedar Cove Advisors");
  await expect(
    canvas.locator(".st-site-footer [data-stx-locked]").filter({ hasText: "Investing involves risk" }),
  ).toHaveAttribute("data-stx-locked", "section");
  await page.screenshot({ path: testInfo.outputPath("template-in-editor.png") });

  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await expect(page.getByTestId("publish-dialog")).toContainText("All checks passed.");
  await page.getByRole("button", { name: "Publish now" }).click();
  await expect(page.getByTestId("publish-result")).toHaveText(/Published version 1/);

  await page.goto(`/s/${slug}/`);
  await expect(page.locator("h1")).toHaveText("Clear advice for Cedar Cove");
  await expect(page.getByRole("navigation")).toContainText("Cedar Cove Advisors");
});
