import { expect, type Page, test } from "@playwright/test";
import { accounts } from "../support/accounts";
import { api } from "../support/api";
import { login } from "../support/auth";

const run = String(Date.now());
const names = { hero: `Publish hero ${run}`, contact: `Publish contact ${run}` };
const slug = `m5-${run}`;

const text = (key: string, label: string, value: string) => ({
  key,
  label,
  type: "text",
  mode: "editable",
  required: false,
  default: { $type: "text", text: value },
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

const heroDefinition = section([
  { $type: "heading", id: "h", level: 1, align: "start", text: text("headline", "Headline", "Welcome") },
  {
    $type: "image",
    id: "i",
    aspect: "16:9",
    fit: "cover",
    radius: "theme",
    image: {
      key: "photo",
      label: "Photo",
      type: "image",
      mode: "editable",
      required: true,
      default: { $type: "image", mediaId: null, alt: "" },
    },
  },
]);
const contactDefinition = section([
  {
    $type: "heading",
    id: "h",
    level: 2,
    align: "start",
    text: text("contactTitle", "Title", "Get in touch"),
  },
  {
    $type: "contactForm",
    id: "f",
    submitLabel: text("submit", "Submit label", "Send message"),
    successMessage: text("thanks", "Success message", "Thanks, we will reply within one business day."),
  },
]);

const canvas = (page: Page) => page.frameLocator('[data-testid="canvas-frame"]');

// 1×1 PNG.
const tinyPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);

test("owner fixes a blocking issue, publishes, and the public site follows publishes only", async ({
  page,
  browser,
}, testInfo) => {
  await login(page, accounts.designer);
  const designer = await api(page);
  await designer.publishSection(names.hero, "Hero", heroDefinition);
  await designer.publishSection(names.contact, "Contact", contactDefinition);
  await page.getByRole("button", { name: "Sign out" }).click();

  // A blank site with the hero and contact sections.
  await login(page, accounts.owner);
  await page.goto("/sites/new");
  await page.getByTestId("template-blank").click();
  await page.getByLabel("Site name").fill(`Publishing ${run}`);
  await page.getByLabel("Address").fill(slug);
  await page.getByRole("button", { name: "Create site" }).click();
  await expect(page).toHaveURL(/\/sites\/[0-9a-f-]+$/);
  const editorUrl = page.url();
  await page.getByRole("tab", { name: "Add section" }).click();
  await page.getByTestId(`library-card-${names.hero}`).click();
  await page.getByTestId(`library-card-${names.contact}`).click();

  // Upload an image but leave the alt text empty.
  await canvas(page).getByRole("button", { name: "Change image: Photo" }).click();
  await page
    .getByTestId("media-upload-input")
    .setInputFiles({ name: "office.png", mimeType: "image/png", buffer: tinyPng });
  await expect(page.getByTestId("image-dialog-preview")).toBeVisible();
  await page.getByRole("button", { name: "Apply" }).click();

  // Publishing is blocked by the missing alt text.
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  const missingAlt = page.getByTestId("publish-issue-publish.missingAlt");
  await expect(missingAlt).toHaveText("The image “Photo” needs alt text.");
  await expect(page.getByRole("button", { name: "Publish now" })).toBeDisabled();
  await page.screenshot({ path: testInfo.outputPath("publish-blocked.png") });

  // Clicking the issue jumps to the section; fix it there.
  await missingAlt.click();
  await expect(page.locator(`[data-section-name="${names.hero}"]`).getByRole("toolbar")).toBeVisible();
  await canvas(page).getByRole("button", { name: "Change image: Photo" }).click();
  await page.getByLabel("Alt text").fill("Our office by the harbour");
  await page.getByRole("button", { name: "Apply" }).click();
  const headline = canvas(page).getByRole("textbox", { name: "Headline" });
  await headline.click();
  await headline.press("ControlOrMeta+a");
  await headline.pressSequentially("First edition");

  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await expect(page.getByTestId("publish-issue-publish.missingAlt")).toHaveCount(0);
  await page.getByRole("button", { name: "Publish now" }).click();
  await expect(page.getByTestId("publish-result")).toHaveText(/Published version 1/);
  await expect(page.getByTestId("public-url")).toHaveAttribute("href", `/s/${slug}/`);
  await page.getByRole("button", { name: "Done" }).click();
  await expect(page.getByTestId("publish-status")).toHaveText("Published");

  // The public URL serves the published content (path and host routing).
  const visitor = await browser.newPage();
  await visitor.goto(`/s/${slug}/`);
  await expect(visitor.locator("h1")).toHaveText("First edition");
  await expect(visitor.locator('img[alt="Our office by the harbour"]')).toBeVisible();
  await expect(visitor).toHaveTitle(`Publishing ${run}`);
  await visitor.screenshot({ path: testInfo.outputPath("public-site.png"), fullPage: true });
  const hostRouted = await visitor.request.get(`http://${slug}.localhost:5081/`);
  expect(await hostRouted.text()).toContain("First edition");

  // Draft edits stay private until the next publish.
  await headline.click();
  await headline.press("ControlOrMeta+a");
  await headline.pressSequentially("Second edition");
  await expect(page.getByTestId("save-status")).toHaveAttribute("data-status", "saved");
  await expect(page.getByTestId("publish-status")).toHaveText("Unpublished changes");
  await visitor.reload();
  await expect(visitor.locator("h1")).toHaveText("First edition");

  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await page.getByRole("button", { name: "Publish now" }).click();
  await expect(page.getByTestId("publish-result")).toHaveText(/Published version 2/);
  await page.getByRole("button", { name: "Done" }).click();
  await visitor.reload();
  await expect(visitor.locator("h1")).toHaveText("Second edition");

  // A visitor sends a message through the published contact form (no JavaScript involved).
  await visitor.getByLabel("Name").fill("Grace Hopper");
  await visitor.getByLabel("Email").fill("grace@example.com");
  await visitor.getByLabel("Message").fill("Can we talk about retirement planning?");
  await visitor.getByRole("button", { name: "Send message" }).click();
  await expect(visitor.getByRole("status")).toHaveText("Thanks, we will reply within one business day.");

  // It appears in the editor.
  await page.goto(editorUrl);
  await page.getByRole("link", { name: "Messages" }).click();
  const message = page.getByTestId("submission");
  await expect(message).toHaveCount(1);
  await expect(message).toContainText("Grace Hopper");
  await expect(message).toContainText("grace@example.com");
  await expect(message).toContainText("Can we talk about retirement planning?");
  await page.screenshot({ path: testInfo.outputPath("messages.png") });
});
