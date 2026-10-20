import { expect, type Page, test } from "@playwright/test";
import { accounts } from "../support/accounts";
import { login } from "../support/auth";
import { dragTo } from "../support/dnd";

const row = (page: Page, key: string) => page.getByTestId(`outline-row-${key}`);
const canvas = (page: Page) => page.frameLocator('[data-testid="canvas-frame"]');

test("designer builds Columns → Repeater → (Image + Heading + RichText), locks a slot, previews at 375px and publishes v1", async ({
  page,
}, testInfo) => {
  const name = `Team grid ${String(Date.now())}`;
  await login(page, accounts.designer);

  // Create the section type from the library.
  await page.getByRole("button", { name: "New section type" }).click();
  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Category").fill("Team");
  await page.getByRole("button", { name: "Create" }).click();
  await expect(page).toHaveURL(/\/designer\/sections\/[0-9a-f-]+$/);
  await expect(page.getByLabel("Section type name")).toHaveValue(name);

  // Drag Columns from the palette into the section, then a Repeater into the first column.
  await dragTo(page, page.getByTestId("palette-columns"), row(page, "root"));
  await expect(row(page, "columns-1")).toBeVisible();
  await expect(row(page, "columns-1#0")).toBeVisible();
  await dragTo(page, page.getByTestId("palette-repeater"), row(page, "columns-1#0"));
  await expect(row(page, "repeater-1")).toHaveAttribute("aria-level", "4");
  await expect(row(page, "repeater-1")).toHaveAttribute("aria-selected", "true");

  // Click to add into the selection: image into the repeater, then heading and rich text after it.
  await page.getByTestId("palette-image").click();
  await page.getByTestId("palette-heading").click();
  await page.getByTestId("palette-richText").click();
  for (const key of ["image-1", "heading-1", "richText-1"]) {
    await expect(row(page, key)).toHaveAttribute("aria-level", "5");
  }

  // Nav cannot go inside a repeater: the palette disables it rather than offering a bad drop.
  await expect(page.getByTestId("palette-nav")).toBeDisabled();

  // Keyboard fallback in the outline: Alt+↑ moves the heading above the image; Ctrl+Z undoes it.
  await row(page, "heading-1").click();
  await page.keyboard.press("Alt+ArrowUp");
  await expect(page.getByTestId("outline").getByRole("treeitem").nth(4)).toHaveAttribute(
    "data-row-key",
    "heading-1",
  );
  await page.getByRole("button", { name: "Undo (Ctrl+Z)" }).click();
  await expect(page.getByTestId("outline").getByRole("treeitem").nth(4)).toHaveAttribute(
    "data-row-key",
    "image-1",
  );

  // The canvas renders the tree with the real renderer: default repeater items show sample content.
  await expect(canvas(page).locator(".st-columns .st-repeater .st-repeater__item")).toHaveCount(3);
  await expect(canvas(page).locator(".st-repeater__item h2").first()).toHaveText("Heading");

  // Configure and lock the heading slot.
  await row(page, "heading-1").click();
  const slot = page.getByTestId("properties").locator("fieldset").first();
  await slot.getByLabel("Default content").fill("Team member");
  await slot.getByRole("radio", { name: "Locked" }).click();
  await expect(slot.getByRole("radio", { name: "Locked" })).toHaveAttribute("aria-checked", "true");
  await expect(canvas(page).locator(".st-repeater__item h2").first()).toHaveText("Team member");

  // Publish checks run on every save: an impossible repeater default blocks publishing.
  await row(page, "repeater-1").click();
  await page.getByTestId("properties").getByLabel("Min").fill("4");
  await expect(page.getByTestId("publish-issues")).toBeVisible();
  await expect(page.getByRole("button", { name: "Publish version" })).toBeDisabled();
  await page.getByTestId("properties").getByLabel("Min").fill("1");
  await expect(page.getByTestId("publish-issues")).toBeHidden();
  await expect(page.getByTestId("save-status")).toHaveAttribute("data-status", "saved");

  // Preview at 375px: the canvas narrows and the repeater grid collapses to one column.
  await page.getByRole("radio", { name: "Mobile (375px)" }).click();
  const frame = page.getByTestId("canvas-frame");
  await expect.poll(async () => (await frame.boundingBox())?.width).toBe(375);
  const items = canvas(page).locator(".st-repeater__item");
  const lefts = await items.evaluateAll((els) =>
    els.map((el) => Math.round(el.getBoundingClientRect().left)),
  );
  expect(new Set(lefts).size).toBe(1);
  await page.screenshot({ path: testInfo.outputPath("designer-375.png"), fullPage: true });

  // The preview dialog shows all three widths with the selected theme preset.
  await page.getByLabel("Preview theme").selectOption({ label: "Coastal" });
  await page.getByRole("button", { name: "Preview" }).click();
  const previews = page.getByTestId("preview-all").locator("iframe");
  await expect(previews).toHaveCount(3);
  await expect(previews.first().contentFrame().locator(".st-repeater__item")).toHaveCount(3);
  await page.screenshot({ path: testInfo.outputPath("designer-preview.png") });
  await page.keyboard.press("Escape");

  // Publish version 1.
  await page.getByRole("button", { name: "Publish version" }).click();
  await expect(page.getByTestId("publish-result")).toHaveText(/Published version 1/);
  await expect(page.getByTestId("latest-version")).toHaveText("Latest: v1");
  await expect(page.getByRole("button", { name: "Publish version" })).toBeDisabled(); // nothing new to publish
  await page.screenshot({ path: testInfo.outputPath("designer-published.png"), fullPage: true });

  // It is now in the library owners pick from, with the heading slot locked in the frozen version.
  const library = (await (await page.request.get("/api/library")).json()) as {
    name: string;
    version: number;
    definition: unknown;
  }[];
  const entry = library.find((s) => s.name === name);
  expect(entry?.version).toBe(1);
  expect(JSON.stringify(entry?.definition)).toContain('"mode":"locked"');

  await page.getByRole("button", { name: "Back to section library" }).click();
  const libraryRow = page.getByTestId("section-type-row").filter({ hasText: name });
  await expect(libraryRow).toContainText("v1");
  await expect(libraryRow).toContainText("Published");
  await page.screenshot({ path: testInfo.outputPath("library.png") });
});
