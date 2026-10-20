import { expect, type Page, test } from "@playwright/test";
import { accounts } from "../support/accounts";
import { api } from "../support/api";
import { login } from "../support/auth";
import { dragTo } from "../support/dnd";

test.describe.configure({ mode: "serial" });

const run = String(Date.now());
const names = {
  hero: `Hero ${run}`,
  band: `Feature band ${run}`,
  team: `Team grid ${run}`,
  template: `Advisor starter ${run}`,
};

const text = (key: string, label: string, value: string, extra: object = {}) => ({
  key,
  label,
  type: "text",
  mode: "editable",
  required: false,
  default: { $type: "text", text: value },
  ...extra,
});
const rich = (key: string, label: string, html: string, mode = "editable") => ({
  key,
  label,
  type: "richText",
  mode,
  required: false,
  default: { $type: "richText", html },
});
const image = (key: string, label: string, alt: string) => ({
  key,
  label,
  type: "image",
  mode: "editable",
  required: false,
  default: { $type: "image", mediaId: null, alt },
});
const section = (children: unknown[]) => ({
  schemaVersion: 1,
  root: {
    $type: "section",
    id: "root",
    background: "background",
    paddingY: "lg",
    width: "standard",
    children,
  },
});

// A hero with a locked compliance line, a band with a button, and the M3-shaped team grid.
const heroDefinition = section([
  {
    $type: "heading",
    id: "h",
    level: 1,
    align: "start",
    text: text("headline", "Headline", "Plan with confidence", { maxLength: 80 }),
  },
  {
    $type: "richText",
    id: "d",
    align: "start",
    content: rich("disclaimer", "Disclaimer", "<p>Investing involves risk.</p>", "locked"),
  },
  {
    $type: "image",
    id: "i",
    aspect: "16:9",
    fit: "cover",
    radius: "theme",
    image: image("heroImage", "Hero image", "Advisor meeting"),
  },
]);
const bandDefinition = section([
  { $type: "heading", id: "h", level: 2, align: "center", text: text("bandTitle", "Title", "Our approach") },
  {
    $type: "button",
    id: "b",
    variant: "primary",
    align: "center",
    label: text("ctaLabel", "Button label", "Book a call"),
    link: {
      key: "ctaLink",
      label: "Button link",
      type: "link",
      mode: "editable",
      required: false,
      default: { $type: "link", target: { kind: "url", url: "https://example.com" } },
    },
  },
]);
const teamDefinition = section([
  {
    $type: "columns",
    id: "c",
    ratio: "1:1",
    gap: "lg",
    valign: "start",
    stackAt: "tablet",
    columns: [
      {
        children: [
          {
            $type: "repeater",
            id: "r",
            key: "members",
            itemLabel: "Member",
            min: 1,
            max: 6,
            defaultItemCount: 2,
            layout: "stack",
            gap: "md",
            children: [
              {
                $type: "image",
                id: "p",
                aspect: "1:1",
                fit: "cover",
                radius: "full",
                image: image("photo", "Photo", "Team member"),
              },
              {
                $type: "heading",
                id: "n",
                level: 3,
                align: "start",
                text: text("memberName", "Name", "Team member"),
              },
              {
                $type: "richText",
                id: "bio",
                align: "start",
                content: rich("bio", "Bio", "<p>A short bio.</p>"),
              },
            ],
          },
        ],
      },
      { children: [] },
    ],
  },
]);

const canvas = (page: Page) => page.frameLocator('[data-testid="canvas-frame"]');
const box = (page: Page, name: string) => page.locator(`[data-section-name="${name}"]`);
const sectionOrder = (page: Page) =>
  page
    .locator("[data-section-name]")
    .evaluateAll((els) => els.map((e) => e.getAttribute("data-section-name")));

test("designer builds and publishes a starter template with locks", async ({ page }) => {
  await login(page, accounts.designer);
  const client = await api(page);
  await client.publishSection(names.hero, "Hero", heroDefinition);
  await client.publishSection(names.band, "Content", bandDefinition);
  await client.publishSection(names.team, "Team", teamDefinition);

  await page.getByRole("link", { name: "Templates" }).click();
  await page.getByRole("button", { name: "New template" }).click();
  await page.getByLabel("Name").fill(names.template);
  await page.getByRole("button", { name: "Create" }).click();
  await expect(page).toHaveURL(/\/designer\/templates\/[0-9a-f-]+$/);

  // Build the home page from the library (same editor owners use).
  await page.getByRole("tab", { name: "Add section" }).click();
  await page.getByTestId(`library-card-${names.hero}`).click();
  await page.getByTestId(`library-card-${names.band}`).click();
  await expect(canvas(page).locator("h1")).toHaveText("Plan with confidence");

  // Template-only control: lock the band so owners can neither edit, move nor remove it.
  await canvas(page).getByText("Our approach").click();
  await box(page, names.band).getByRole("combobox", { name: "Section lock" }).selectOption("locked");

  // Brand colours are locked for owners.
  await page.getByRole("tab", { name: "Theme" }).click();
  await page.getByRole("button", { name: "Lock primary for site owners" }).click();
  await page.getByRole("button", { name: "Lock secondary for site owners" }).click();
  await expect(page.getByRole("button", { name: "Unlock primary for site owners" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  await page.getByRole("button", { name: "Publish version" }).click();
  await expect(page.getByTestId("publish-result")).toHaveText(/Published version 1/);
});

test("owner creates a site from the template and edits it", async ({ page }, testInfo) => {
  await login(page, accounts.owner);

  // Create a site from the template.
  await page.getByRole("link", { name: "New site" }).click();
  await page.getByTestId(`template-${names.template}`).click();
  await page.getByLabel("Site name").fill(`Harbor test ${run}`);
  await page.getByRole("button", { name: "Create site" }).click();
  await expect(page).toHaveURL(/\/sites\/[0-9a-f-]+$/);
  const siteId = page.url().split("/").at(-1) ?? "";
  await expect(canvas(page).locator("h1")).toHaveText("Plan with confidence");

  // Add the M3-style section (Columns → Repeater → Image + Heading + RichText) by dragging it
  // from the library to just above the band.
  await page.getByRole("tab", { name: "Add section" }).click();
  await dragTo(page, page.getByTestId(`library-card-${names.team}`), box(page, names.band), 0.2);
  await expect.poll(() => sectionOrder(page)).toEqual([names.hero, names.team, names.band]);
  await expect(canvas(page).locator(".st-columns .st-repeater .st-repeater__item")).toHaveCount(2);

  // Edit text inline.
  const headline = canvas(page).getByRole("textbox", { name: "Headline" });
  await headline.click();
  await headline.press("End");
  await headline.pressSequentially(" today");
  await expect(headline).toHaveText("Plan with confidence today");

  // Locked slot: read-only with a lock indicator and tooltip; the locked band cannot be edited either.
  const disclaimer = canvas(page).locator('[data-stx-locked="slot"]');
  await expect(disclaimer).toContainText("Investing involves risk.");
  await expect(disclaimer).toHaveAttribute("title", /Locked by the template designer/);
  await expect(disclaimer.locator("[contenteditable]")).toHaveCount(0);
  await expect(canvas(page).getByRole("textbox", { name: "Title" })).toHaveCount(0);
  await expect(canvas(page).locator('[data-stx-locked="section"]').first()).toContainText("Our approach");
  await canvas(page).getByText("Our approach").click();
  await expect(box(page, names.band).getByRole("button", { name: "Delete section" })).toBeDisabled();

  // Reorder by drag: move the team grid above the hero with its drag handle.
  await canvas(page).getByRole("textbox", { name: "Name" }).first().click();
  await page.getByTestId("canvas-scroll").evaluate((el) => {
    el.scrollTo(0, 0);
  });
  await dragTo(
    page,
    box(page, names.team).getByRole("button", { name: `Drag ${names.team} to reorder` }),
    box(page, names.hero),
    0.2,
  );
  await expect.poll(() => sectionOrder(page)).toEqual([names.team, names.hero, names.band]);

  // Undo and redo (keyboard shortcuts from the editor chrome).
  await page.getByTestId("current-page").click();
  await page.keyboard.press("ControlOrMeta+z");
  await expect.poll(() => sectionOrder(page)).toEqual([names.hero, names.team, names.band]);
  await page.keyboard.press("ControlOrMeta+Shift+z");
  await expect.poll(() => sectionOrder(page)).toEqual([names.team, names.hero, names.band]);

  // Repeater items: add one, then edit its rich-text bio inline (TipTap inside the canvas iframe)
  // and make a word bold with the formatting bar in the editor chrome.
  await canvas(page).getByRole("button", { name: "Add member" }).click();
  await expect(canvas(page).locator(".st-repeater__item")).toHaveCount(3);
  const bio = canvas(page).getByRole("textbox", { name: "Bio" }).nth(2);
  await bio.click();
  await bio.press("ControlOrMeta+a");
  await bio.pressSequentially("Fee-only advice");
  await bio.press("ControlOrMeta+a");
  await page.getByLabel("Text formatting").getByRole("button", { name: "Bold" }).click();
  await expect(bio.locator("strong")).toHaveText("Fee-only advice");

  // Buttons: an unlocked copy of the band lets the owner change the label and link to a page.
  await page.getByTestId(`library-card-${names.band}`).click();
  await canvas(page).getByRole("button", { name: "example.com" }).click();
  await page.getByLabel("Label").fill("Talk to us");
  await page.getByRole("radio", { name: "A page" }).click();
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(canvas(page).getByRole("button", { name: "Home" })).toBeVisible();
  await expect(canvas(page).getByRole("textbox", { name: "Button label" })).toHaveText("Talk to us");

  // Theme: an unlocked colour changes, a locked brand colour cannot.
  await page.getByRole("tab", { name: "Theme" }).click();
  await expect(page.getByLabel("Primary hex value", { exact: true })).toBeDisabled();
  await expect(page.getByTestId("token-colors.primary").getByLabel("Locked by the template")).toBeVisible();
  await page.getByLabel("Accent hex value", { exact: true }).fill("#aa3366");
  await expect(page.getByLabel("Accent hex value", { exact: true })).toHaveValue("#aa3366");

  // Upload an image into the hero's image slot, with alt text.
  await canvas(page).getByRole("button", { name: "Change image: Hero image" }).click();
  await page
    .getByTestId("media-upload-input")
    .setInputFiles({ name: "office.png", mimeType: "image/png", buffer: tinyPng });
  await expect(page.getByTestId("image-dialog-preview")).toBeVisible();
  await page.getByLabel("Alt text").fill("Our office on the harbour");
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(canvas(page).locator('img[alt="Our office on the harbour"]')).toHaveAttribute(
    "src",
    /^\/media\/[0-9a-f-]+$/,
  );

  await expect(page.getByTestId("save-status")).toHaveAttribute("data-status", "saved");
  await page.screenshot({ path: testInfo.outputPath("site-editor.png"), fullPage: true });

  // The server stored everything (and kept the locked values out of the instance).
  const saved = await (await api(page)).get<{ document: SiteDocumentShape }>(`/api/sites/${siteId}`);
  const home = saved.document.pages[0];
  const [team, hero, band, band2] = home?.sections ?? [];
  expect(saved.document.theme.colors.accent).toBe("#aa3366");
  expect(saved.document.theme.colors.primary).not.toBe("#aa3366");
  expect(hero?.values.headline).toEqual({ $type: "text", text: "Plan with confidence today" });
  expect(hero?.values.disclaimer).toBeUndefined();
  expect(hero?.values.heroImage).toMatchObject({ $type: "image", alt: "Our office on the harbour" });
  expect(band?.lock).toBe("locked");
  const members = (team?.repeaters as { members?: { values: { bio?: { html: string } } }[] }).members ?? [];
  expect(members).toHaveLength(3);
  expect(members[2]?.values.bio?.html).toBe("<p><strong>Fee-only advice</strong></p>");
  expect(band2?.values.ctaLabel).toEqual({ $type: "text", text: "Talk to us" });
  expect(band2?.values.ctaLink).toEqual({ $type: "link", target: { kind: "page", pageId: home?.id } });
});

interface SiteDocumentShape {
  theme: { colors: Record<string, string> };
  pages: {
    id: string;
    sections: { lock: string; values: Record<string, unknown>; repeaters: Record<string, unknown> }[];
  }[];
}

// 1×1 PNG.
const tinyPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);
