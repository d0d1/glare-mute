import { expect, test } from "@playwright/test";

test.describe("GlareMute product shell", () => {
  test.setTimeout(60000);

  test("renders a stable system-dark preview", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "GlareMute" })).toBeVisible();
    await expect(page.getByText("Available windows")).toBeVisible();
    await expect(page.getByRole("button", { name: "Choose a window", exact: true })).toBeDisabled();
    await expect(page.getByText(/^Support & diagnostics$/)).toHaveCount(0);
    await expect(page.getByText(/^Appearance$/)).toHaveCount(0);
    await expect(page.getByText(/^Visible windows$/)).toHaveCount(0);
    await expect(page.locator(".app-frame")).toHaveScreenshot("dashboard-dark.png", {
      maxDiffPixels: 500,
    });
  });

  test("renders a stable manual-light preview", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto("/");
    await page.locator(".settings-panel > summary").click();
    await page.locator("#theme-select").selectOption("light");
    await page.locator(".settings-panel > summary").click();
    await expect(page.locator(".app-frame")).toHaveScreenshot("dashboard-light.png", {
      maxDiffPixels: 500,
    });
  });
});
