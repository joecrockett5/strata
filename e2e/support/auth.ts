import { expect, type Page } from "@playwright/test";

export async function login(page: Page, account: { email: string; password: string; displayName: string }) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(account.email);
  await page.getByLabel("Password").fill(account.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByTestId("current-user")).toHaveText(account.displayName);
}
