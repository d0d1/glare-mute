import type { Page } from "@playwright/test";

export async function chooseSettingOption(page: Page, settingId: string, optionLabel: string) {
  await page.locator(".settings-panel > summary").click();
  await page.locator(`#${settingId}`).click();
  await page.getByRole("button", { name: optionLabel, exact: true }).click();
  await page.locator(".settings-panel > summary").click();
}
