import { expect, test } from "@playwright/test";

test.describe("GlareMute product shell", () => {
  test.setTimeout(60000);

  test("renders a stable system-dark preview", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Greyscale Invert" })).toBeVisible();
    await expect(page.getByText("Effect backends")).toHaveCount(0);
    await expect(page.getByText("Session overview")).toHaveCount(0);
    await expect(page.locator(".app-frame")).toHaveScreenshot("dashboard-dark.png", {
      maxDiffPixels: 500,
    });
  });

  test("renders a stable manual-light preview", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto("/");
    await page.getByRole("button", { name: "Light" }).click();
    await expect(page.locator(".app-frame")).toHaveScreenshot("dashboard-light.png", {
      maxDiffPixels: 500,
    });
  });
});
