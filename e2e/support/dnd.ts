import type { Locator, Page } from "@playwright/test";

/**
 * Drags with real pointer events in small steps. dnd-kit's PointerSensor only activates after the
 * pointer travels a few pixels, which Playwright's one-step `dragTo` does not do.
 * `at` is the vertical drop position within the target (0 = top edge, 1 = bottom edge).
 */
export async function dragTo(page: Page, source: Locator, target: Locator, at = 0.5) {
  const from = await source.boundingBox();
  if (!from) throw new Error("Drag source is not visible");
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2 + 10, from.y + from.height / 2 + 10, { steps: 5 });

  // Measure the target only once the drag is active: rows can shift when drag state renders.
  const to = await target.boundingBox();
  if (!to) throw new Error("Drop target is not visible");
  await page.mouse.move(to.x + to.width / 2, to.y + to.height * at, { steps: 15 });
  await page.mouse.up();
}
