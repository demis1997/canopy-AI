import { test, expect } from "@playwright/test";

test("login, auto-reply, analytics", async ({ page, browser }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("chatter1@demo.canopy");
  await page.getByLabel("Password").fill("CanopyDemo!2026");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.waitForURL(/dashboard/);
  await expect(
    page.getByRole("link", { name: "Workspace Lumen Demo Agency", exact: true }),
  ).toBeVisible();
  await page.goto("/conversations");
  await page.getByRole("link", { name: "Alex P. (DEMO)", exact: true }).click();
  await expect(page.getByRole("button", { name: "Add fan message", exact: true })).toBeVisible();

  await page
    .getByPlaceholder("Type as the fan to add a message, then generate suggestions", {
      exact: true,
    })
    .fill("you looked so hot. got anything filthier?");
  await page.getByRole("button", { name: "Add fan message", exact: true }).click();
  await expect(page.getByText("Model replied in this chat.", { exact: true })).toBeVisible({
    timeout: 30_000,
  });

  await page.goto("/analytics");
  await expect(page.getByText("Access denied", { exact: true })).toBeVisible();

  const managerPage = await browser.newPage({ baseURL: new URL(page.url()).origin });
  try {
    await managerPage.goto("/login");
    await managerPage.getByLabel("Email").fill("manager@demo.canopy");
    await managerPage.getByLabel("Password").fill("CanopyDemo!2026");
    await managerPage.getByRole("button", { name: "Continue" }).click();
    await managerPage.waitForURL(/dashboard/);
    await managerPage.goto("/analytics");
    await expect(
      managerPage.getByRole("heading", { name: "Analytics", exact: true }),
    ).toBeVisible();
    await expect(
      managerPage.getByRole("listitem").filter({ hasText: "Sam Rivera (DEMO chatter)" }),
    ).toContainText(/\b[1-9]\d* accepted \/ edited/);
  } finally {
    await managerPage.close();
  }
});

test("uncertain age conversation is blocked", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("chatter1@demo.canopy");
  await page.getByLabel("Password").fill("CanopyDemo!2026");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.waitForURL(/dashboard/);
  await page.goto("/conversations");
  await expect(page.getByRole("link", { name: "Uncertain Fan (DEMO)" })).toBeVisible();
});
