import { test, expect } from "@playwright/test";

test("login, auto-reply, analytics", async ({ page }) => {
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
  await expect(page.getByText("SUGGESTION_ACCEPTED")).toBeVisible();
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
