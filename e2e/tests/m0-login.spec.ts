import { expect, test } from "@playwright/test";
import { accounts } from "../support/accounts";
import { login } from "../support/auth";

test("designer signs in and lands on the section library", async ({ page }) => {
  await login(page, accounts.designer);
  await expect(page).toHaveURL(/\/designer\/sections$/);
  await expect(page.getByRole("link", { name: "Templates" })).toBeVisible();
  await expect(page.getByRole("link", { name: "My sites" })).toHaveCount(0);
});

test("site owner signs in, lands on their sites and can sign out", async ({ page }) => {
  await login(page, accounts.owner);
  await expect(page).toHaveURL(/\/sites$/);
  await expect(page.getByRole("link", { name: "Sections" })).toHaveCount(0);

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login$/);
});

test("wrong password shows an error", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(accounts.owner.email);
  await page.getByLabel("Password").fill("definitely-wrong");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("alert")).toHaveText("Invalid email or password");
});
