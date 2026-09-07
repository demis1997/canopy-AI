import { test, expect } from "@playwright/test";

test("demo conversations workspace is public and interactive", async ({ page }) => {
  await page.goto("/demo/conversations");
  await expect(page.getByText("Demo environment")).toBeVisible();
  await expect(page.getByText("Alex P.").first()).toBeVisible();
  await page.getByRole("button", { name: /Generate with Canopy/ }).click();
  await expect(page.getByText("Demo AI response").first()).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "Insert" }).first().click();
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.getByText("Sam Rivera").first()).toBeVisible();
  await page.getByRole("button", { name: "Debug" }).click();
  await expect(page.getByText(/Database product query/)).toBeVisible();
});

test("demo products and welcome builder are public", async ({ page }) => {
  await page.goto("/demo/products");
  await expect(page.getByText("Product catalogue")).toBeVisible();
  await expect(page.getByText("PLATFORM_VAULT_SYNC")).toBeVisible();
  await page.goto("/demo/automations/welcome-message");
  await expect(page.getByText("Welcome-message builder")).toBeVisible();
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Saved in this browser.")).toBeVisible();
});
